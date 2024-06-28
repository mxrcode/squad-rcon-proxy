
import { POOL_SIZE, rconOptions, logger } from '../config';

import Rcon from './client'

export class PoolManager {
  #poolMaxSize = POOL_SIZE;
  #pool = [];
  #connections = [];
  #executionQueue = [];

  constructor() {
    this.setupPool()
  }

  setupPool() {
    for (let i = 0; i < this.#poolMaxSize; i++) {
      const rconInstance = new Rcon(rconOptions);
      rconInstance.connect()
        .then(() => {
          logger(
            'RCON',
            0,
            `Connected to RCON instance ${i}`
          );
        }).catch((error) => {
          logger(
            'RCON',
            0,
            `Error connecting to RCON instance ${i}: ${error}`
          );
        });
      this.#connections.push(rconInstance);
      this.#pool.push(rconInstance);
    }
  }

  async execute(command) {
    return new Promise((resolve, fail) => {
      this.#executionQueue.push({ command, resolve, fail });
      this.#tick();
    });
  }

  #tick() {
    const hasFreeConnections = this.#pool.length > 0;
    const isHasTask = this.#executionQueue.length > 0;

    if (hasFreeConnections && isHasTask) {
      const connection = this.#pool.shift();
      const task = this.#executionQueue.shift();

      connection.execute(task.command)
        .then(task.resolve)
        .catch(task.fail)
        .finally(() => {
          this.#pool.push(connection);
          this.#tick();
        });
    }
  }

  disconnect() {
    return Promise.all(this.#connections.map(c => c.disconnect()))
  }
}