const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Admin session tokens (in-memory)
const adminTokens = new Set();

// Admin path verification — issues a token on success
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin-secret-dashboard-254';
app.post('/api/admin/verify', (req, res) => {
  const valid = req.body.path === ADMIN_PATH;
  if (valid) {
    const token = uuidv4();
    adminTokens.add(token);
    return res.json({ valid: true, token });
  }
  res.json({ valid: false });
});

// Admin auth middleware
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// Public routes (customer-facing)
app.use('/api/events', require('./routes/events').publicRouter);
app.use('/api/users', require('./routes/users').publicRouter);
app.use('/api/reservations', require('./routes/reservations').publicRouter);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/donations', require('./routes/donations').publicRouter);

// Admin routes (require token)
app.use('/api/events', requireAdmin, require('./routes/events').adminRouter);
app.use('/api/users', requireAdmin, require('./routes/users').adminRouter);
app.use('/api/reservations', requireAdmin, require('./routes/reservations').adminRouter);
app.use('/api/donations', requireAdmin, require('./routes/donations').adminRouter);

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/saunaman';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
