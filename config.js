// config.js
import { createWriteStream } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const webOptions = {
  ip_web: '127.0.0.1',
  port_web: 17392,
  secretToken: 'HTTP_TOKEN'
};
  
const rconOptions = {
  host: '127.0.0.1',
  port: 21114,
  password: 'RCON_PASSWORD',
};

const POOL_SIZE = 10; // Number of connections to keep in the pool

const LOG_LEVEL = 5; // 0 = no logging, 5 = all logs
const ENABLE_LOGGING = true; // Set to false to disable logging

// Utility function for logging
function logger(component, level, message) {
  if (level <= LOG_LEVEL) {
    console.log(`[${new Date().toISOString()}] [${level}] [${component}] ${message}`);
  }
}
if (ENABLE_LOGGING) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  const logFileName = `./log/${new Date().toISOString().replace(/:/g, '-')}.log`;
  const logFilePath = join(__dirname, logFileName);
  
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  
  console.log = message => {
    const formattedMessage = `${message}`;
    process.stdout.write(formattedMessage + '\n');
    logStream.write(formattedMessage + '\n');
  };
}

export { POOL_SIZE, webOptions, rconOptions, logger };