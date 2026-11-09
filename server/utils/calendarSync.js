const crypto = require('crypto');
const rules = require('./calendarSyncRules');
function createService({ Event, Connection, Request, Lock, calendar, sendNotices }) {
  const active = { cancellationState: { $nin: ['cancelling','cancelled'] }, deletedAt: null };
  async function conflict(event, message, status = 'conflict') {
    await Event.updateOne({ _id: event._id, syncVersion: event.syncVersion || 0, ...active }, { $set: { syncStatus: status, syncError: message } });
  }
  async function overlaps(event, shape) {
    const start = new Date(shape.start), end = new Date(shape.end);
    if (await Event.exists({ ...active, _id: { $ne: event._id }, date: { $lt: end }, $or: [{booked:true},{syncEnabled:true}], $expr: { $gt: [{ $add: ['$date', { $multiply: [{ $ifNull: ['$duration',120] },60000] }] },start] } })) return true;
    return !!await Lock.exists({ requestId: { $ne: event._id }, date: { $lt: end, $gt: new Date(+start-3600000) } });
  }
  async function reconcile(event, remote, api, calendarId, force) {
    if (event.googleCalendarId !== calendarId) return conflict(event, 'Connected calendar changed. Reconnect the original calendar.', 'error');
    let external;
    try { external = rules.remoteShape(remote); }
    catch (e) { return conflict(event, e.message); }
    const local = rules.localShape(event);
    if (external && !external.name) external.name = local.name;
    if (external?.name === 'Private Sauna Booking' && local.name.startsWith('Private Sauna - ')) external.name = local.name;
    const action = rules.plan(event.syncBase, local, external, force);
    if (action === 'deleted') return conflict(event, 'Linked Google event was deleted. No refund was issued. Cancel the event in admin or restore it in Google.', 'google_deleted');
    if (action === 'conflict') return conflict(event, 'Both calendars differ. Choose which version to keep.');
    const target = action === 'pull' ? external : local;
    if (action !== 'same' && await overlaps(event,target)) return conflict(event,'The requested time overlaps another website event or held request. Choose a free time.');
    if (action !== 'same') {
      const {data}=await api.events.list({calendarId,timeMin:target.start,timeMax:target.end,singleEvents:true,showDeleted:false,maxResults:2500});
      if(data.nextPageToken || (data.items||[]).some(item=>item.id!==event.googleEventId && item.transparency!=='transparent' && item.status!=='cancelled')) return conflict(event,'This time overlaps another Google Calendar event. Choose a free time.');
    }
    const previous = event.syncBase ? JSON.parse(event.syncBase) : local;
    let etag = remote.etag;
    if (action === 'push') {
      try {
        const { data } = await api.events.patch({ calendarId, eventId: event.googleEventId, requestBody: { summary: local.name, start: { dateTime: local.start, timeZone: 'America/Los_Angeles' }, end: { dateTime: local.end, timeZone: 'America/Los_Angeles' }, location: local.location } }, { headers: { 'If-Match': remote.etag } });
        etag = data.etag;
      } catch (e) {
        if (Number(e.code) === 412) return conflict(event,'Google changed during the update. Sync again to review both versions.');
        throw e;
      }
    }
    const snapshot = rules.serialize(target);
    const set = { googleEtag: etag, syncBase: snapshot, syncStatus:'synced', syncError:'', lastSyncedAt:new Date() };
    if (action === 'pull') {
      set.date = new Date(target.start); set.duration = (+new Date(target.end)-+new Date(target.start))/60000; set.name=target.name || event.name;
      if (local.location !== target.location) set.location = { name: target.location, address:target.location };
    }
    if (rules.scheduleChanged(previous,target)) { set.syncNoticeKey=rules.key(snapshot + ':' + ((event.syncVersion||0)+1)); set.syncNoticePayload=snapshot; }
    // An admin edit racing with this write must not be overwritten.
    await Event.updateOne({ _id:event._id, syncVersion:event.syncVersion || 0, ...active }, { $set:set, $inc:{syncVersion:1} });
  }
  async function exportNew(event, api, calendarId) {
    const shape=rules.localShape(event);
    if (await overlaps(event,shape)) return conflict(event,'This time overlaps another website event or held request.');
    const {data:busy}=await api.events.list({calendarId,timeMin:shape.start,timeMax:shape.end,singleEvents:true,showDeleted:false,maxResults:2500});
    if(busy.nextPageToken || (busy.items||[]).some(item=>item.id!==rules.key(event._id) && item.transparency!=='transparent' && item.status!=='cancelled')) return conflict(event,'This time overlaps another Google Calendar event.');
    const id=rules.key(event._id);
    // Persist linkage first so retries cannot create a second event.
    const claimed=await Event.updateOne({ _id:event._id, syncVersion:event.syncVersion || 0, ...active }, { $set:{googleEventId:id, googleCalendarId:calendarId}, $inc:{syncVersion:1} });
    if (!claimed.modifiedCount) return;
    event.syncVersion=(event.syncVersion||0)+1; event.googleEventId=id; event.googleCalendarId=calendarId;
    const { data } = await api.events.insert({ calendarId, requestBody:{ id, summary:shape.name, start:{dateTime:shape.start,timeZone:'America/Los_Angeles'},end:{dateTime:shape.end,timeZone:'America/Los_Angeles'},location:shape.location, transparency:'opaque', extendedProperties:{private:{siteEventId:event._id}} } });
    const committed=await Event.updateOne({ _id:event._id, syncVersion:event.syncVersion,...active }, { $set:{syncBase:rules.serialize(shape),googleEtag:data.etag,syncStatus:'synced',syncError:'',lastSyncedAt:new Date()},$inc:{syncVersion:1} });
    if(!committed.modifiedCount) {
      const current=await Event.findById(event._id);
      if(current && (current.deletedAt || ['cancelling','cancelled'].includes(current.cancellationState))) {
        try {await api.events.delete({calendarId,eventId:id});} catch(e) {if(![404,410].includes(Number(e.code))) throw e;}
      }
    }
  }
  async function one(event, api, calendarId, force) {
    try {
      if (!event.googleEventId) return await exportNew(event,api,calendarId);
      let remote;
      try { remote=(await api.events.get({calendarId:event.googleCalendarId,eventId:event.googleEventId})).data; }
      catch(e) {
        if (![404,410].includes(Number(e.code))) throw e;
        // A failed first export can be retried; a formerly synced deletion needs admin review.
        if (!event.syncBase) {
          await Event.updateOne({_id:event._id,syncVersion:event.syncVersion||0,...active},{$unset:{googleEventId:1},$set:{syncStatus:'pending'},$inc:{syncVersion:1}});
          return;
        }
        remote={status:'cancelled'};
      }
      await reconcile(event,remote,api,calendarId,force);
    } catch { await conflict(event,'Calendar sync failed. Check Google access, reconnect if needed, then retry.','error'); }
  }
  async function backfill() {
    await Event.updateMany({syncVersion:{$exists:false}},{$set:{syncVersion:0}});
    const requests=await Request.find({status:'confirmed',googleEventId:{$exists:true}});
    for(const request of requests) {
      const event=await Event.findOne({_id:request._id,syncEnabled:{$ne:true},...active});
      if (!event) continue;
      // The original Google title was fixed; use the original request as the shared baseline.
      const shape={name:event.name,start:request.start.toISOString(),end:request.end.toISOString(),location:request.location?.address||''};
      await Event.updateOne({_id:event._id,syncEnabled:{$ne:true},...active},{$set:{syncEnabled:true,googleEventId:request.googleEventId,googleCalendarId:request.calendarId,syncBase:rules.serialize(shape),syncStatus:'pending'}});
    }
  }
  async function tick(forceId, force) {
    const owner=crypto.randomUUID();
    let connection;
    try {connection=await Connection.findOneAndUpdate({_id:'saunaman',status:'connected',$or:[{syncLease:{$exists:false}},{syncLease:null},{syncLease:{$lt:new Date()}}]},{$set:{syncLease:new Date(Date.now()+300000),syncOwner:owner}},{new:true});} catch {console.error('Calendar sync could not acquire database lease; will retry');return;}
    if(!connection) return;
    try {
      await backfill();
      const {api,calendarId}=await calendar.eventClient();
      const events=await Event.find({syncEnabled:true,...active});
      // Incremental listing consumes every page before advancing the sync cursor.
      let pageToken, nextToken;
      const changed=new Map();
      try {
        do {
          const {data}=await api.events.list({calendarId,showDeleted:true,singleEvents:false,maxResults:2500,...(connection.syncToken?{syncToken:connection.syncToken}:{}),...(pageToken?{pageToken}:{})});
          for(const item of data.items||[]) changed.set(item.id,item);
          pageToken=data.nextPageToken;nextToken=data.nextSyncToken;
        } while(pageToken);
      } catch(e) {
        if(Number(e.code)===410) {await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$unset:{syncToken:1}});return;}
        throw e;
      }
      for(const event of events) {
        // Refresh lease between events; another worker must not run this batch concurrently.
        const lease=await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncLease:new Date(Date.now()+300000)}});
        if(!lease.matchedCount) return;
        if(event.googleEventId && changed.has(event.googleEventId) && event._id !== forceId) {
          try {await reconcile(event,changed.get(event.googleEventId),api,calendarId);}
          catch {await conflict(event,'Calendar sync failed; retry.','error');}
        } else if(!connection.syncToken || !event.syncBase || ['pending','error'].includes(event.syncStatus) || event._id===forceId) {
          await one(event,api,calendarId,event._id===forceId?force:undefined);
        }
      }
      if(nextToken) await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncToken:nextToken}});
      // Notifications remain durable on the event if sending fails or the process restarts.
      const notices=await Event.find({syncEnabled:true,syncNoticeKey:{$exists:true},$expr:{$ne:['$syncNoticeKey',{$ifNull:['$syncNotifiedKey','']}]},...active});
      for(const event of notices) {
        try {await sendNotices(event);await Event.updateOne({_id:event._id,syncNoticeKey:event.syncNoticeKey},{$set:{syncNotifiedKey:event.syncNoticeKey}});}
        catch {await conflict(event,'Calendar updated, but customer notification failed. Delivery will retry.','error');}
      }
      await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncCheckedAt:new Date(),syncError:''}});
    } catch {await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncError:'Synchronization unavailable. Check connection and calendar permissions.'}});}
    finally {await Connection.updateOne({_id:'saunaman',syncOwner:owner},{$unset:{syncLease:1,syncOwner:1}});}
  }
  return {tick,reconcile,exportNew,one,backfill};
}
module.exports.createService=createService;
module.exports.service=()=>createService({Event:require('../models/Event'),Connection:require('../models/CalendarConnection'),Request:require('../models/BookingRequest'),Lock:require('../models/BookingSlotLock'),calendar:require('./googleCalendar'),sendNotices:require('./calendarSyncEmail').sendNotices});
