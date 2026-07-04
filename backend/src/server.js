require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const seedData = require('../scripts/seed');

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reservehub';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB.');
    // Seed test data to ensure IIT Madras org and resources are available
    await seedData();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
