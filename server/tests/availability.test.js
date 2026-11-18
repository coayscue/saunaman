const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DateTime}=require('luxon');
const rules=require('../utils/availabilityRules');
const zone=rules.zone;
const start=DateTime.fromISO('2099-01-05',{zone}).toJSDate();
const end=DateTime.fromISO('2099-01-06',{zone}).toJSDate();
const weekday=DateTime.fromJSDate(start,{zone}).weekday;
const schedule={weekly:[{weekday,startMinute:600,endMinute:840}]};
const slotHours=slots=>slots.map(s=>DateTime.fromISO(s.start).setZone(zone).hour);
test('weekly windows generate sessions that fit the whole duration',()=>{
 assert.deepEqual(slotHours(rules.slots(schedule,[],[],start,end,2)),[10,11,12]);
 assert.deepEqual(slotHours(rules.slots(schedule,[],[],start,end,4)),[10]);
});
test('date-specific available hours add sessions outside the weekly schedule',()=>{
 const extra={kind:'available',fromDate:'2099-01-05',toDate:'2099-01-05',startMinute:960,endMinute:1200};
 assert.deepEqual(slotHours(rules.slots(schedule,[extra],[],start,end,2)),[10,11,12,16,17,18]);
});
test('blocks override availability and removing them reopens the interval',()=>{
 const block={kind:'blocked',fromDate:'2099-01-05',toDate:'2099-01-05',startMinute:660,endMinute:720};
 assert.deepEqual(slotHours(rules.slots(schedule,[block],[],start,end,2)),[12]);
 assert.deepEqual(slotHours(rules.slots(schedule,[{...block,deleted:true}],[],start,end,2)),[10,11,12]);
});
test('whole-day blocks and closed weekly schedules offer no slots',()=>{
 const block={kind:'blocked',fromDate:'2099-01-05',toDate:'2099-01-05',startMinute:0,endMinute:1440};
 assert.equal(rules.slots(schedule,[block],[],start,end,2).length,0);
 assert.equal(rules.slots({weekly:[]},[],[],start,end,2).length,0);
});
test('busy calendar events, bookings and holds remove conflicting starts',()=>{
 const busy=[{date:DateTime.fromISO('2099-01-05T12:00',{zone}).toISO(),duration:60}];
 assert.deepEqual(slotHours(rules.slots(schedule,[],busy,start,end,2)),[10]);
});
test('adjacent and duplicate windows merge without duplicate slots',()=>{
 const rows={weekly:[{weekday,startMinute:600,endMinute:720},{weekday,startMinute:720,endMinute:840},{weekday,startMinute:600,endMinute:720}]};
 assert.deepEqual(slotHours(rules.slots(rows,[],[],start,end,2)),[10,11,12]);
});
test('36-hour notice is enforced',()=>{
 const now=+DateTime.fromISO('2099-01-04T00:00',{zone});
 assert.deepEqual(slotHours(rules.slots(schedule,[],[],start,end,2,now)),[12]);
});
test('weekday rules stay in San Francisco time across DST without duplicate starts',()=>{
 const day=DateTime.fromISO('2027-03-14',{zone});
 const config={weekly:[{weekday:7,startMinute:0,endMinute:1440}]};
 const slots=rules.slots(config,[],[],day.toJSDate(),day.plus({days:1}).toJSDate(),2,0);
 assert.equal(new Set(slots.map(s=>s.start)).size,slots.length);
 assert.ok(slots.every(s=>+new Date(s.end)-+new Date(s.start)===7200000));
});
test('invalid dates, unaligned hours and reversed intervals are rejected',()=>{
 assert.throws(()=>rules.validateRule({kind:'blocked',fromDate:'bad',toDate:'bad',startMinute:0,endMinute:1440}));
 assert.throws(()=>rules.validateWeekly([{weekday:1,startMinute:630,endMinute:720}]));
 assert.throws(()=>rules.validateWeekly([{weekday:8,startMinute:600,endMinute:720}]));
 assert.throws(()=>rules.validateRule({kind:'available',fromDate:'2099-01-05',toDate:'2099-01-04',startMinute:600,endMinute:720}));
});
test('Google mirror uses Free availability and Busy blocks with stable identities',()=>{
 const {desiredEvents,eventId}=require('../utils/availabilityMirror');
 const items=desiredEvents(schedule,[{_id:'rule',kind:'blocked',fromDate:'2099-01-05',toDate:'2099-01-06',startMinute:0,endMinute:1440}]);
 assert.equal(items[0].body.transparency,'transparent');assert.equal(items[1].body.transparency,'opaque');
 assert.equal(items[1].body.id,eventId('rule'));assert.deepEqual(items[1].body.recurrence,['RRULE:FREQ=DAILY;COUNT=2']);
});
