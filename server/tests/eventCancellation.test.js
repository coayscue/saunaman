const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createService} = require('../utils/eventCancellation');
function fixture({credit=false, deleted=false, failEmail=false, failRefund=false, priorRefund=0}={}) {
  let refunds=0, notifications=0, removed=0, credits=0;
  const event={_id:'event', name:'Test', price:450, cancellationState:'cancelling',deleteRequested:deleted,booked:true,save:async()=>{}};
  const reservation={_id:'reservation',user:{_id:'user',email:'test@example.com'},cancelled:false};
  const charge={amount:45000,amount_refunded:priorRefund};
  const service=createService({
    Event:{findOneAndUpdate:async()=>event,updateOne:async()=>{},findById:async()=>event},
    Reservation:{find:()=>({populate:async()=>[reservation]}),updateMany:async()=>{reservation.cancelled=true},updateOne:async()=>{reservation.eventCancellationNotified=true}},
    User:{updateOne:async()=>{credits++}},
    Payment:{findOne:async()=>({stripe_payment_id:credit?'credit_used':'pi'})},
    Request:{findById:async()=>({googleEventId:'google'})},
    stripe:{paymentIntents:{retrieve:async()=>({id:'pi',status:'succeeded',latest_charge:charge})},refunds:{create:async(args,options)=>{
      assert.deepEqual(args,{payment_intent:'pi'}); // no 75% amount: full remaining refund
      assert.equal(options.idempotencyKey,'admin-event-cancel-event-reservation');
      if(failRefund) throw new Error('failed');
      refunds++;charge.amount_refunded=45000;return{status:'succeeded'};
    }}},
    calendar:{removeBookingEvent:async()=>{removed++}},
    send:async()=>{if(failEmail) throw new Error('email');notifications++},
  });
  return {service,event,reservation,counts:()=>({refunds,notifications,removed,credits}),emailWorks:()=>{failEmail=false},refundWorks:()=>{failRefund=false}};
}
test('admin cancellation fully refunds, notifies customer, removes Google event and releases slot',async()=>{
 const f=fixture();await f.service.process('event');
 assert.equal(f.event.cancellationState,'cancelled');assert.equal(f.event.booked,false);assert.equal(f.reservation.cancelled,true);
 assert.deepEqual(f.counts(),{refunds:1,notifications:1,removed:1,credits:0});
 await f.service.process('event');assert.equal(f.counts().refunds,1);assert.equal(f.counts().notifications,1);
});
test('delete archives only after refund processing; retains reservation history',async()=>{
 const f=fixture({deleted:true,failRefund:true});await f.service.process('event');
 assert.equal(f.event.deletedAt,undefined);assert.equal(f.event.booked,true);assert.ok(f.event.cancellationError);
 f.refundWorks();await f.service.process('event');assert.ok(f.event.deletedAt);assert.equal(f.event.booked,false);
});
test('email retries do not repeat refund',async()=>{
 const f=fixture({failEmail:true});await f.service.process('event');
 assert.equal(f.event.booked,false);assert.ok(f.event.cancellationError);assert.equal(f.event.cancellationNotificationsComplete,undefined);
 f.emailWorks();await f.service.process('event');assert.equal(f.counts().refunds,1);assert.equal(f.counts().notifications,1);assert.equal(f.event.cancellationNotificationsComplete,true);
});
test('credit payments restore one credit and do not refund money',async()=>{
 const f=fixture({credit:true});await f.service.process('event');await f.service.process('event');
 assert.equal(f.counts().refunds,0);assert.equal(f.counts().credits,1);
});
test('previous partial refund is topped up rather than a new percentage refund',async()=>{
 const f=fixture({priorRefund:33750});await f.service.process('event');assert.equal(f.counts().refunds,1);assert.equal(f.event.booked,false);
});
