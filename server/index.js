import express from 'express';

import Rcon from '../rcon';

import { webOptions, logger } from '../config';

export const bootstrapServer = () => {
    const app = express();

    // Middleware for logging HTTP requests
    app.use((req, res, next) => {
      logger(
        'HTTP',
        1,
        `${req.method} request to ${req.path} from ${req.ip}`
      );
      next();
    });
    
    const authenticateMiddleware = (req, res, next) => {
      const token = req.header('Authorization');
    
      if (token === webOptions.secretToken) {
        next();
      } else {
        res.status(401).send('Unauthorized');
        logger(
          'HTTP',
          1,
          `Unauthorized request from ${req.ip}`
        );
      }
    };
    
    app.use(express.text({ defaultCharset: 'utf-8' }));
    
    app.post('/rcon', authenticateMiddleware, async (req, res) => {
      const command = req.body;
    
      try {
        const response = await Rcon.execute(command);
        res.status(200).send({ response });
      } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
      }
    });
    
    const server = app.listen(webOptions.port_web, webOptions.ip_web, () => {
      logger(
        'HTTP',
        0,
        `HTTP server listening on ${webOptions.ip_web}:${webOptions.port_web}`
      );
    });
    
    // Add an event listener to close the RCON connections when the HTTP server is stopped
    server.on('close', async () => {
      try {
        await Rcon.disconnect();
        logger(
          'RCON',
          0,
          `RCON disconnected`
        );
      } catch (error) {
        logger(
          'RCON',
          0,
          `Error disconnecting RCON instance: ${error}`
        );
      }
    });
}
