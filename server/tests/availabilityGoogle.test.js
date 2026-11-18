const {test}=require('node:test');
const assert=require('node:assert/strict');
const {google}=require('googleapis');
const Connection=require('../models/CalendarConnection');
const {Mirror}=require('../models/Availability');
const calendar=require('../utils/googleCalendar');
test('Google availability excludes managed mirrors but preserves personal busy events and all-day DST intervals',async()=>{
 const previous={calendar:google.calendar,connection:Connection.findById,mirrors:Mirror.find};
 process.env.CALENDAR_TOKEN_ENCRYPTION_KEY='a'.repeat(64);
 process.env.GOOGLE_CLIENT_ID='test';process.env.GOOGLE_CLIENT_SECRET='test';process.env.GOOGLE_REDIRECT_URI='http://localhost/callback';
 let page=0;
 try {
  Connection.findById=async()=>({status:'connected',calendarId:'test',token:calendar.encrypt('fake-refresh')});
  Mirror.find=()=>({select:()=>({lean:async()=>[{googleEventId:'managed'}]})});
  google.calendar=()=>({events:{list:async()=>{
   page++;
   return{data:page===1?{items:[
    {id:'managed_instance',recurringEventId:'managed',start:{dateTime:'2027-03-14T10:00:00-07:00'},end:{dateTime:'2027-03-14T11:00:00-07:00'}},
    {id:'personal',start:{dateTime:'2027-03-14T12:00:00-07:00'},end:{dateTime:'2027-03-14T13:00:00-07:00'}},
   ],nextPageToken:'next'}:{items:[
    {id:'all-day',start:{date:'2027-03-14'},end:{date:'2027-03-15'}},
    {id:'free',transparency:'transparent',start:{date:'2027-03-14'},end:{date:'2027-03-15'}},
   ]}};
  }}});
  const busy=await calendar.busy(new Date('2027-03-14T08:00Z'),new Date('2027-03-16T08:00Z'));
  assert.equal(page,2);assert.equal(busy.length,2);assert.equal(busy[0].duration,60);assert.equal(busy[1].duration,23*60);
 } finally {google.calendar=previous.calendar;Connection.findById=previous.connection;Mirror.find=previous.mirrors;}
});
