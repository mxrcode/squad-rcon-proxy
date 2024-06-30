// config.js
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const webOptions = {
  ip_web: '127.0.0.1',
  port_web: 17392,
  secretToken: 'HTTP_TOKEN'
};
  
const rconOptions = {
  host: '127.0.0.1',
  port: 21114,
  password: 'RCON_PASSWORD',
  autoReconnectDelay: 1000
};

const rconPoolSize = 1; // Warning, using more than 1 connection currently will cause a bug.

const logLevel = 1; // 0 =  only essential, 5 = all logs
const enableLogging = true; // Set to false to disable logging

// Utility function for logging
function logger(component, level, message) {
  if (level <= logLevel) {
    console.log(`[${new Date().toISOString()}] [${level}] [${component}] ${message}`);
  }
}
if (enableLogging) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  const logDir = join(__dirname, './log');
  mkdirSync(logDir, { recursive: true });

  const logFileName = `${new Date().toISOString().replace(/:/g, '-')}.log`;
  const logFilePath = join(logDir, logFileName);
  
  const logStream = createWriteStream(logFilePath, { flags: 'a' });
  
  console.log = message => {
    const formattedMessage = `${message}`;
    process.stdout.write(formattedMessage + '\n');
    logStream.write(formattedMessage + '\n');
  };
}

export { webOptions, rconOptions, rconPoolSize, logger };