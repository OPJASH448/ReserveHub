const mongoose = require('mongoose');
const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');

let mongod;

const connect = async () => {
  try {
    // Attempt to start an in-memory replica set for transaction testing
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    console.log('Started MongoMemoryReplSet for transaction support.');
  } catch (error) {
    console.warn('Failed to start replica set, falling back to standalone MongoMemoryServer:', error.message);
    mongod = await MongoMemoryServer.create();
  }

  const uri = mongod.getUri();
  await mongoose.connect(uri);
};

const closeDatabase = async () => {
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
};

const clearDatabase = async () => {
  if (mongoose.connection.readyState) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  }
};

module.exports = { connect, closeDatabase, clearDatabase };
