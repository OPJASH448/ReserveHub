const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Resource = require('../src/models/Resource');
  
  const result = await Resource.updateMany(
    { 'operatingHours.start': { $ne: '05:00' } },
    { $set: { 'operatingHours.start': '05:00', 'operatingHours.end': '22:00' } }
  );
  
  console.log(`Updated ${result.modifiedCount} resources to 05:00-22:00`);
  
  const all = await Resource.find().select('name operatingHours');
  all.forEach(r => console.log(`  ${r.name}: ${r.operatingHours.start}-${r.operatingHours.end}`));
  
  await mongoose.disconnect();
}

fix().catch(e => { console.error(e); process.exit(1); });
