const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatLogEntry(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let log = `[${timestamp}] [${level}] ${message}`;
  if (data) {
    log += ` | ${typeof data === 'object' ? JSON.stringify(data) : data}`;
  }
  return log;
}

function log(level, message, data = null) {
  const entry = formatLogEntry(level, message, data);
  console.log(entry);
  
  try {
    fs.appendFileSync(LOG_FILE, entry + '\n', 'utf8');
    if (level === 'ERROR') {
      fs.appendFileSync(ERROR_LOG_FILE, entry + '\n', 'utf8');
    }
  } catch (error) {
    console.error('Failed to write log:', error.message);
  }
}

function info(message, data = null) { log('INFO', message, data); }
function success(message, data = null) { log('SUCCESS', message, data); }
function warning(message, data = null) { log('WARNING', message, data); }
function error(message, data = null) { log('ERROR', message, data); }
function debug(message, data = null) { 
  if (process.env.DEBUG === 'true') {
    log('DEBUG', message, data);
  }
}
function logError(err, context = null) {
  error(context || 'Error occurred', {
    message: err.message || String(err),
    stack: err.stack || null
  });
}

module.exports = {
  info,
  success,
  warning,
  error,
  debug,
  logError,
  LOG_LEVELS: { INFO: 'INFO', SUCCESS: 'SUCCESS', WARNING: 'WARNING', ERROR: 'ERROR', DEBUG: 'DEBUG' }
};