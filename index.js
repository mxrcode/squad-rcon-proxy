import Rcon from './rcon.js';
import express from 'express';

import { webOptions, rconOptions } from './config.js';

const app = express();

// Middleware for logging HTTP requests
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} request to ${req.path} from ${req.ip}`);
  next();
});

const authenticateMiddleware = (req, res, next) => {
  const token = req.header('Authorization');

  if (token === webOptions.secretToken) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
};

app.use(express.text());

app.post('/rcon', authenticateMiddleware, async (req, res) => {
  const command = req.body;

  try {
    const response = await rconInstance.execute(command);
    res.status(200).send({ response });
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

const server = app.listen(webOptions.port_web, webOptions.ip_web, () => {
  console.log(`[HTTP] HTTP server listening on ${webOptions.ip_web}:${webOptions.port_web}`);
});

// Add an event listener to close the RCON connection when the HTTP server is stopped
server.on('close', async () => {
  try {
    await rconInstance.disconnect();
    console.log('[RCON] RCON disconnected');
  } catch (error) {
    console.error('[RCON] Error disconnecting from RCON:', error);
  }
});

const rconInstance = new Rcon(rconOptions);

rconInstance.connect()
  .then(() => {
    console.log('[RCON] Connected to RCON');

    // You can now use rconInstance to send commands, e.g., rconInstance.execute('your_command');
  })
  .catch((error) => {
    console.error('[RCON] Error connecting to RCON:', error);
  });