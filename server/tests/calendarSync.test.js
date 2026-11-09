const {test}=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../utils/calendarSyncRules');
const {createService}=require('../utils/calendarSync');
const base={name:'Test',start:'2099-01-03T17:00:00.000Z',end:'2099-01-03T19:00:00.000Z',location:'Beach'};
function fixture(options={}) {
  const event={_id:'event',name:base.name,date:new Date(base.start),duration:120,price:450,location:{address:base.location},syncVersion:1,googleCalendarId:'cal',googleEventId:'google',syncBase:JSON.stringify(base),syncEnabled:true,syncStatus:'synced',...options.event};
  const writes=[],patches=[],inserts=[];let occupied=!!options.occupied;
  const remote={id:'google',summary:base.name,start:{dateTime:base.start},end:{dateTime:base.end},location:base.location,etag:'etag',...options.remote};
  const api={events:{list:async()=>({data:{items:options.googleBusy?[{id:'other'}]:[]}}),get:async()=>({data:remote}),patch:async(params,headers)=>{patches.push({params,headers});if(options.precondition){const e=new Error();e.code=412;throw e;}return{data:{etag:'new-etag'}};},insert:async params=>{inserts.push(params);return{data:{etag:'created'}}}}};
  const service=createService({Event:{exists:async()=>occupied,updateOne:async(filter,update)=>{writes.push({filter,update});return{modifiedCount:options.casFail?0:1};}},Connection:{},Request:{},Lock:{exists:async()=>false},calendar:{},sendNotices:async()=>{}});
  return{event,remote,api,service,writes,patches,inserts};
}
test('reconciliation plans distinguish unchanged, one-sided and conflicting edits',()=>{
 assert.equal(rules.plan(JSON.stringify(base),base,base),'same');
 assert.equal(rules.plan(JSON.stringify(base),{...base,location:'A'},base),'push');
 assert.equal(rules.plan(JSON.stringify(base),base,{...base,location:'B'}),'pull');
 assert.equal(rules.plan(JSON.stringify(base),{...base,location:'A'},{...base,location:'B'}),'conflict');
 assert.equal(rules.plan(JSON.stringify(base),base,null),'deleted');
});
test('Google schedule edits update website interval and queue a customer notice without changing price',async()=>{
 const f=fixture({remote:{start:{dateTime:'2099-01-04T17:00:00Z'},end:{dateTime:'2099-01-04T20:00:00Z'}}});
 await f.service.reconcile(f.event,f.remote,f.api,'cal');
 const set=f.writes.at(-1).update.$set;
 assert.equal(set.duration,180);assert.equal(set.date.toISOString(),'2099-01-04T17:00:00.000Z');assert.ok(set.syncNoticeKey);assert.equal(set.price,undefined);assert.equal(f.patches.length,0);
});
test('website edits use If-Match and preserve unrelated Google fields through patch',async()=>{
 const f=fixture({event:{date:new Date('2099-01-04T17:00:00Z')}});
 await f.service.reconcile(f.event,f.remote,f.api,'cal');
 assert.equal(f.patches.length,1);assert.deepEqual(f.patches[0].headers,{headers:{'If-Match':'etag'}});
 assert.equal(f.patches[0].params.requestBody.attendees,undefined);assert.equal(f.writes.at(-1).update.$set.syncStatus,'synced');
});
test('simultaneous edits flag conflict without overwriting either calendar',async()=>{
 const f=fixture({event:{location:{address:'Website'}},remote:{location:'Google'}});
 await f.service.reconcile(f.event,f.remote,f.api,'cal');
 assert.equal(f.writes.at(-1).update.$set.syncStatus,'conflict');assert.equal(f.writes.at(-1).update.$set.date,undefined);assert.equal(f.patches.length,0);
 await f.service.reconcile(f.event,f.remote,f.api,'cal','website');assert.equal(f.patches.length,1);
});
test('overlapping website bookings or Google busy intervals require review',async()=>{
 for(const option of [{occupied:true},{googleBusy:true}]){
  const f=fixture({...option,remote:{location:'Elsewhere'}});await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.writes.at(-1).update.$set.syncStatus,'conflict');assert.equal(f.writes.at(-1).update.$set.date,undefined);
 }
});
test('Google deletion flags review and does not cancel, release availability or move money',async()=>{
 const f=fixture({remote:{status:'cancelled'}});await f.service.reconcile(f.event,f.remote,f.api,'cal');
 const set=f.writes.at(-1).update.$set;assert.equal(set.syncStatus,'google_deleted');assert.equal(set.booked,undefined);assert.equal(set.cancellationState,undefined);assert.equal(f.patches.length,0);
});
test('all-day or recurring linked events are flagged rather than silently changing bookings',async()=>{
 assert.throws(()=>rules.remoteShape({start:{date:'2099-01-03'},end:{date:'2099-01-04'}}));
 const f=fixture({remote:{recurrence:['RRULE:FREQ=WEEKLY']}});await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.writes.at(-1).update.$set.syncStatus,'conflict');
});
test('unchanged data does not patch Google or queue repeat notifications',async()=>{
 const f=fixture();await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.patches.length,0);assert.equal(f.writes.at(-1).update.$set.syncNoticeKey,undefined);
});
test('Google etag precondition failure becomes a conflict',async()=>{
 const f=fixture({precondition:true,event:{location:{address:'New'}}});await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.writes.at(-1).update.$set.syncStatus,'conflict');
});
test('website updates compare event revision so a concurrent admin edit is not overwritten',async()=>{
 const f=fixture({casFail:true,remote:{location:'New'}});await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.writes.at(-1).filter.syncVersion,1);
});
test('admin event export persists deterministic linkage before insert',async()=>{
 const f=fixture({event:{googleEventId:undefined,syncBase:undefined}});await f.service.exportNew(f.event,f.api,'cal');
 assert.equal(f.inserts.length,1);assert.equal(f.inserts[0].requestBody.id,rules.key('event'));assert.equal(f.writes[0].update.$set.googleEventId,rules.key('event'));
});
test('legacy booking titles do not create false conflicts when Google reschedules',async()=>{
 const baseline={...base,name:'Private Sauna - Customer'};
 const f=fixture({event:{name:baseline.name,syncBase:JSON.stringify(baseline)},remote:{summary:'Private Sauna Booking',location:'New Beach'}});
 await f.service.reconcile(f.event,f.remote,f.api,'cal');assert.equal(f.writes.at(-1).update.$set.syncStatus,'synced');assert.equal(f.writes.at(-1).update.$set.location.address,'New Beach');
});
test('incremental sync advances token only after every page and ignores unrelated events',async()=>{
 const calls=[],updates=[];let page=0;
 const service=createService({Event:{updateMany:async()=>{},find:async()=>[]},Request:{find:async()=>[]},Connection:{findOneAndUpdate:async()=>({_id:'saunaman',syncToken:'old'}),updateOne:async(filter,update)=>{updates.push(update);return{matchedCount:1};}},Lock:{},calendar:{eventClient:async()=>({calendarId:'cal',api:{events:{list:async params=>{calls.push(params);page++;return{data:page===1?{items:[{id:'personal'}],nextPageToken:'page2'}:{items:[],nextSyncToken:'new'}};}}}})},sendNotices:async()=>{}});
 await service.tick();assert.equal(calls.length,2);assert.equal(calls[1].pageToken,'page2');assert.equal(calls[1].syncToken,'old');assert.ok(updates.some(u=>u.$set?.syncToken==='new'));
});
test('expired Google sync token is reset for a full synchronization',async()=>{
 const updates=[];
 const service=createService({Event:{updateMany:async()=>{},find:async()=>[]},Request:{find:async()=>[]},Connection:{findOneAndUpdate:async()=>({syncToken:'expired'}),updateOne:async(f,u)=>{updates.push(u);return{matchedCount:1};}},calendar:{eventClient:async()=>({calendarId:'cal',api:{events:{list:async()=>{const e=new Error();e.code=410;throw e;}}}})}});
 await service.tick();assert.ok(updates.some(u=>u.$unset?.syncToken===1));
});
