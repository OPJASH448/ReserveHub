const mongoose = require('mongoose');

/**
 * Runs a set of operations in a transaction if the MongoDB environment supports it (Replica Set).
 * Otherwise, it gracefully falls back to normal execution.
 * 
 * @param {Function} callback - Async function containing DB operations. Receives the `session` object.
 * @returns {Promise<any>} - The return value of the callback
 */
async function runWithTransaction(callback) {
  const conn = mongoose.connection;
  if (!conn.readyState) {
    throw new Error('Database connection not established');
  }

  // Attempt to start a session and transaction
  let session;
  try {
    session = await conn.startSession();
    session.startTransaction();

    const result = await callback(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
    }

    // Check if the error is due to lack of transactions/sessions/replica set support
    const message = error.message ? error.message.toLowerCase() : '';
    const isUnsupported = 
      message.includes('transaction') || 
      message.includes('replica set') || 
      message.includes('sessions') ||
      error.code === 20 || // TransactionSystemFailed
      error.code === 251;  // NoSuchTransaction

    if (isUnsupported) {
      // Fallback to non-transactional execution
      return await callback(null);
    }

    // Rethrow other errors (validation, duplicate keys, etc.)
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

module.exports = { runWithTransaction };
