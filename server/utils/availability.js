const {Schedule, Rule, defaultWeekly} = require('../models/Availability');
const rules = require('./availabilityRules');
async function settings() {
  const schedule = await Schedule.findById('saunaman').lean();
  return schedule || {_id:'saunaman', revision:0, weekly:defaultWeekly};
}
async function rulesFor(start, end) {
  const {DateTime} = require('luxon');
  return Rule.find({deleted:false, fromDate:{$lte:DateTime.fromJSDate(end,{zone:rules.zone}).toISODate()}, toDate:{$gte:DateTime.fromJSDate(start,{zone:rules.zone}).toISODate()}}).lean();
}
async function isAllowed(start, end) {
  const [schedule, exceptions] = await Promise.all([settings(), rulesFor(start,end)]);
  const windows = rules.intervals(schedule,exceptions,start,end);
  return rules.fits(start,end,windows.available,windows.blocked);
}
async function availableSlots(start,end,duration) {
  const queryEnd = new Date(+end + duration * 3600000);
  const Event = require('../models/Event');
  const Lock = require('../models/BookingSlotLock');
  const [schedule, exceptions, google, events, locks] = await Promise.all([
    settings(), rulesFor(start,queryEnd), require('./googleCalendar').busy(start,queryEnd),
    Event.find({type:'private',booked:true,date:{$lt:queryEnd},$expr:{$gt:[{$add:['$date',{$multiply:[{$ifNull:['$duration',120]},60000]}]},start]}}).select('date duration').lean(),
    Lock.find({date:{$gte:new Date(+start-3600000),$lt:queryEnd}}).lean(),
  ]);
  return rules.slots(schedule,exceptions,[...google,...events,...locks.map(lock=>({date:lock.date,duration:60}))],start,end,duration);
}
module.exports = {settings, rulesFor, isAllowed, availableSlots};
