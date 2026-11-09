const publicRouter = require('express').Router();
const adminRouter = require('express').Router();
const Event = require('../models/Event');
const Reservation = require('../models/Reservation');
const User = require('../models/User');

// PUBLIC: Get all events
publicRouter.get('/', async (req, res) => {
  try {
    const filter = { cancellationState: { $nin: ['cancelling', 'cancelled'] }, deletedAt: null };
    if (req.query.type) filter.type = req.query.type;
    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Get single event
publicRouter.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (['cancelling','cancelled'].includes(event.cancellationState) || event.deletedAt) return res.status(410).json({ error: 'Event cancelled' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC: Get registered guest names for an event
publicRouter.get('/:id/guests', async (req, res) => {
  try {
    const reservations = await Reservation.find({ event: req.params.id, cancelled: false }).populate('user', 'name');
    const guests = reservations.map((r) => r.user?.name).filter(Boolean);
    res.json(guests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const synchronization = require('../utils/calendarSync').service();
const cancellations = require('../utils/eventCancellation').service();
adminRouter.get('/', async (req, res) => {
  try { res.json(await Event.find({ deletedAt: null }).sort({ date: 1 })); }
  catch { res.status(503).json({ error: 'Unable to load events' }); }
});
adminRouter.post('/:id/cancel', async (req, res) => {
  try {
    const event = await cancellations.request(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch { res.status(503).json({ error: 'Unable to start cancellation. Refresh before retrying.' }); }
});

adminRouter.post('/:id/sync', async (req,res) => {
  try {
    const event=await Event.findById(req.params.id);
    if(!event || ['cancelling','cancelled'].includes(event.cancellationState) || event.deletedAt) return res.status(409).json({error:'Event is not active'});
    if(!['website','google',undefined].includes(req.body.source)) return res.status(400).json({error:'Invalid synchronization source'});
    if(!event.syncEnabled) await Event.updateOne({_id:event._id},{$set:{syncEnabled:true,syncStatus:'pending'},$inc:{syncVersion:1}});
    await synchronization.tick(event._id,req.body.source);
    res.json(await Event.findById(event._id));
  } catch {res.status(503).json({error:'Unable to synchronize. Check connection and retry.'});}
});

// ADMIN: Create event
adminRouter.post('/', async (req, res) => {
  try {
    const { name, date, duration, price, max_capacity, type, location } = req.body;
    if (!name || !Number.isFinite(+new Date(date)) || !Number.isFinite(duration) || duration <= 0 || duration > 1440) return res.status(400).json({ error: 'Valid event name, date and duration required' });
    const event = new Event({ name, date, duration, price, max_capacity, type, location, syncEnabled: true, syncStatus: 'pending' });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Update event
adminRouter.put('/:id', async (req, res) => {
  try {
    const existing = await Event.findById(req.params.id);
    if (!existing || ['cancelling','cancelled'].includes(existing.cancellationState)) return res.status(409).json({ error: 'Cancelled events cannot be edited' });
    const { name, date, duration, price, max_capacity, type, location } = req.body;
    if (!name || !Number.isFinite(+new Date(date)) || !Number.isFinite(duration) || duration <= 0 || duration > 1440) return res.status(400).json({ error: 'Valid name, date and duration required' });
    const event = await Event.findOneAndUpdate({ _id: req.params.id, cancellationState: { $nin: ['cancelling','cancelled'] }, ...(existing.syncVersion ? {syncVersion:existing.syncVersion} : {$or:[{syncVersion:0},{syncVersion:{$exists:false}}]}) }, { $set: { name, date, duration, price, max_capacity, type, location, ...(existing.syncEnabled ? {syncStatus:'pending',syncError:''} : {}) }, $inc:{syncVersion:1} }, { new:true,runValidators:true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN: Delete event
adminRouter.delete('/:id', async (req, res) => {
  try {
    const event = await cancellations.request(req.params.id, true);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { publicRouter, adminRouter };
