import Rcon from './rcon.js';
import express from 'express';

import { webOptions, rconOptions, rconPoolSize, logger } from './config.js';

const app = express();

// Create pool connection
const rconPool = [];
let currentRconIndex = 0;

const createRconInstance = async () => {
  for (let i = 0; i < rconPoolSize; i++) {
    const rconInstance = new Rcon(rconOptions, i);
    rconInstance.connect().then(() => {
      logger('RCON', 0, `Connected to RCON instance ${i}`);
    }).catch((error) => {
      logger('RCON', 0, `Error connecting to RCON instance ${i}: ${error}`);
    });
    rconPool.push(rconInstance);
  }
}

createRconInstance();

const authenticateMiddleware = (req, res, next) => {
  const token = req.header('Authorization');

  if (token === webOptions.secretToken) {
    next();
  } else {
    res.status(401).send('Unauthorized');
    logger('HTTP', 1, `Unauthorized request from ${req.ip}`);
  }
};

app.use(express.text({ defaultCharset: 'utf-8' }));

app.post('/rcon', authenticateMiddleware, async (req, res) => {
  const command = req.body;
  
  logger('HTTP', 1, `[${currentRconIndex}] ${req.method} request to ${req.path} from ${req.ip}`);

  // Get the next RCON instance from the pool
  const rconInstance = rconPool[currentRconIndex];
  currentRconIndex = (currentRconIndex + 1) % rconPool.length;

  try {
    const response = await rconInstance.execute(command);
    res.status(200).send({ response });
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

const server = app.listen(webOptions.port_web, webOptions.ip_web, () => {
  logger('HTTP', 1, `Server listening on ${webOptions.ip_web}:${webOptions.port_web}`);
});

// Add an event listener to close the RCON connections when the HTTP server is stopped
server.on('close', async () => {
  for (let i = 0; i < rconPool.length; i++) {
    try {
      await rconPool[i].disconnect();
      logger('RCON', 0, `RCON instance ${i} disconnected`);
    } catch (error) {
      logger('RCON', 0, `Error disconnecting RCON instance ${i}: ${error}`);
    }
  }
});