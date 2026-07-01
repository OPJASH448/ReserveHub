const EventEmitter = require('events');

class AppEventEmitter extends EventEmitter {}

// Singleton event emitter
const appEvents = new AppEventEmitter();

module.exports = appEvents;
