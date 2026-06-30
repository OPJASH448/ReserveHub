const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/orgs');
const roleRoutes = require('./routes/roles');
const joinRequestRoutes = require('./routes/joinRequests');

const app = express();

// Standard middleware
app.use(express.json());
app.use(cookieParser());

// API route registrations
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', orgRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/join-requests', joinRequestRoutes);

// Root path response
app.get('/', (req, res) => {
  res.json({ message: 'Strata API Engine is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
