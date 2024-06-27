// config.js
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

function logger(component, level, message) {
    if (level <= LOG_LEVEL) {
      console.log(`[${new Date().toISOString()}] [${level}] [${component}] ${message}`);
    }
}

const LOG_LEVEL = 0;
const enableLogging = true;

export { enableLogging, webOptions, rconOptions, LOG_LEVEL, logger };
