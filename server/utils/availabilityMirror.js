const {DateTime}=require('luxon');
const {createHash,randomUUID}=require('crypto');
const {Schedule,Rule,Mirror,defaultWeekly}=require('../models/Availability');
const zone='America/Los_Angeles';
const eventId=key=>'a11'+createHash('sha256').update('availability:'+key).digest('hex');
function desiredEvents(schedule,rules) {
  const events=[];
  const make=(key,day,startMinute,endMinute,kind,recurrence)=>{
    const start=DateTime.fromISO(day,{zone}).startOf('day');
    const at=minute=>minute===1440?start.plus({days:1}):start.set({hour:minute/60});
    events.push({key,body:{id:eventId(key),summary:kind==='blocked'?'Saunaman Unavailable':'Saunaman Availability',start:{dateTime:at(startMinute).toISO(),timeZone:zone},end:{dateTime:at(endMinute).toISO(),timeZone:zone},transparency:kind==='blocked'?'opaque':'transparent',recurrence,extendedProperties:{private:{saunamanAvailability:'true'}}}});
  };
  for(const row of schedule.weekly) {
    const day=DateTime.fromISO('2000-01-03',{zone}).plus({days:row.weekday-1}).toISODate();
    make(`weekly-${row.weekday}-${row.startMinute}-${row.endMinute}`,day,row.startMinute,row.endMinute,'available',['RRULE:FREQ=WEEKLY']);
  }
  for(const rule of rules.filter(r=>!r.deleted)) {
    const count=Math.round(DateTime.fromISO(rule.toDate,{zone}).diff(DateTime.fromISO(rule.fromDate,{zone}),'days').days)+1;
    make(rule._id,rule.fromDate,rule.startMinute,rule.endMinute,rule.kind,count>1?[`RRULE:FREQ=DAILY;COUNT=${count}`]:[]);
  }
  return events;
}
async function tick() {
  const owner=randomUUID();
  let lease;
  try {
    await Schedule.updateOne({_id:'saunaman'},{$setOnInsert:{weekly:defaultWeekly,revision:0}},{upsert:true});
    lease=await Schedule.findOneAndUpdate({_id:'saunaman',$or:[{syncLease:null},{syncLease:{$exists:false}},{syncLease:{$lt:new Date()}}]},{$set:{syncLease:new Date(Date.now()+300000),syncOwner:owner}},{new:true});
    if(!lease)return;
    const {api,calendarId}=await require('./googleCalendar').eventClient();
    const rules=await Rule.find({deleted:false}).lean();
    const desired=desiredEvents(lease,rules);
    const active=new Set(desired.map(item=>`${calendarId}:${item.key}`));
    for(const item of desired) {
      const id=`${calendarId}:${item.key}`;
      const hash=createHash('sha256').update(JSON.stringify(item.body)).digest('hex');
      const mirror=await Mirror.findById(id);
      if(mirror?.active && mirror.contentHash===hash && !mirror.error)continue;
      let googleEventId=mirror?.googleEventId || item.body.id;
      let body={...item.body,id:googleEventId};
      await Mirror.updateOne({_id:id},{$set:{calendarId,googleEventId}},{upsert:true});
      try {
        // Full update restores the admin-defined window if a previous attempt partly succeeded.
        try {await api.events.update({calendarId,eventId:googleEventId,requestBody:body});}
        catch(e) {
          if(![404,410].includes(Number(e.code)))throw e;
          if(Number(e.code)===410) {
            // A deleted Google ID cannot be reused. Save its replacement before insertion.
            googleEventId=eventId(item.key+'-'+randomUUID());
            body={...item.body,id:googleEventId};
            await Mirror.updateOne({_id:id},{$set:{googleEventId}});
          }
          await api.events.insert({calendarId,requestBody:body});
        }
        await Mirror.updateOne({_id:id},{$set:{active:true,contentHash:hash,error:''}});
      } catch {await Mirror.updateOne({_id:id},{$set:{error:'Google availability mirror needs retry. Website hours are saved.'}});}
      await Schedule.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncLease:new Date(Date.now()+300000)}});
    }
    await Schedule.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncError:''}});
    const obsolete=await Mirror.find({active:{$ne:false}});
    for(const mirror of obsolete) {
      if(active.has(mirror._id))continue;
      try {
        try {await api.events.delete({calendarId:mirror.calendarId,eventId:mirror.googleEventId});}
        catch(e) {if(![404,410].includes(Number(e.code)))throw e;}
        await Mirror.updateOne({_id:mirror._id},{$set:{active:false,error:''}});
      } catch {await Mirror.updateOne({_id:mirror._id},{$set:{error:'A removed Google availability window needs cleanup. Retry synchronization.'}});}
    }
  } catch {if(lease)await Schedule.updateOne({_id:'saunaman',syncOwner:owner},{$set:{syncError:'Connect Google Calendar to mirror availability changes.'}});}
  finally {if(lease)await Schedule.updateOne({_id:'saunaman',syncOwner:owner},{$unset:{syncLease:1,syncOwner:1}});}
}
module.exports={tick,desiredEvents,eventId};
