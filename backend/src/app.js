const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/orgs');
const roleRoutes = require('./routes/roles');
const joinRequestRoutes = require('./routes/joinRequests');
const resourceRoutes = require('./routes/resources');
const bookingRoutes = require('./routes/bookings');
const waitlistRoutes = require('./routes/waitlists');
const waitingQueueRoutes = require('./routes/waitingQueue');
const cronRoutes = require('./routes/cron');

// Load observers so event listeners are registered
require('./observers/waitlistObserver');

const app = express();

// Standard middleware
app.use(express.json());
app.use(cookieParser());

// CORS for Vite dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API route registrations
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', orgRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/join-requests', joinRequestRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/waitlists', waitlistRoutes);
app.use('/api/waiting-queue', waitingQueueRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/members', require('./routes/members'));

// Root path response
app.get('/', (req, res) => {
  res.json({ message: 'ReserveHub API Engine is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
