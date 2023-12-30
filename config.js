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

export const enableLogging = true;

export { webOptions, rconOptions };