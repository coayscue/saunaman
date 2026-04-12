const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Review = require('../models/Review');
const Reservation = require('../models/Reservation');

// Multer config for photo uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'reviews'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.replace('image/', ''));
    cb(null, ext || mime);
  }
});

// GET all approved reviews (public - for the booking page)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET check if a reservation already has a review
router.get('/check/:reservationId', async (req, res) => {
  try {
    const existing = await Review.findOne({ reservation: req.params.reservationId });
    res.json({ hasReview: !!existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET reservation info for review page
router.get('/reservation/:reservationId', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reservationId)
      .populate('event')
      .populate('user');
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a review (with optional photo uploads)
router.post('/', upload.array('photos', 5), async (req, res) => {
  try {
    const { reservationId, stars, text, name } = req.body;

    if (!reservationId || !stars || !name) {
      return res.status(400).json({ error: 'reservationId, stars, and name are required' });
    }

    // Verify the reservation exists
    const reservation = await Reservation.findById(reservationId).populate('event').populate('user');
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

    // Check for duplicate review
    const existing = await Review.findOne({ reservation: reservationId });
    if (existing) return res.status(400).json({ error: 'You have already submitted a review for this event' });

    const photoFilenames = (req.files || []).map(f => f.filename);

    const review = new Review({
      reservation: reservationId,
      user: reservation.user._id,
      event: reservation.event._id,
      stars: parseInt(stars, 10),
      text: text || '',
      photos: photoFilenames,
      name
    });
    await review.save();

    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
