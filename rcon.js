import EventEmitter from 'events';
import net from 'net';
import util from 'util';

import { logger } from './config.js';

EventEmitter.defaultMaxListeners = 128; // Increase the default max listeners to prevent memory leaks

const SERVERDATA_EXECCOMMAND = 0x02;
const SERVERDATA_RESPONSE_VALUE = 0x00;
const SERVERDATA_AUTH = 0x03;
const SERVERDATA_AUTH_RESPONSE = 0x02;
const SERVERDATA_CHAT_VALUE = 0x01;

const MID_PACKET_ID = 0x01;
const END_PACKET_ID = 0x02;

export default class Rcon extends EventEmitter {
  constructor(options = {}, index) {
    super();

    // store config
    for (const option of ['host', 'port', 'password'])
      if (!(option in options)) throw new Error(`${option} must be specified.`);

    this.host = options.host;
    this.port = options.port;
    this.password = options.password;
    this.autoReconnectDelay = options.autoReconnectDelay || 5000;

    // bind methods
    this.connect = this.connect.bind(this); // we bind this as we call it on the auto reconnect timeout
    this.onPacket = this.onPacket.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onError = this.onError.bind(this);
    this.decodeData = this.decodeData.bind(this);
    this.encodePacket = this.encodePacket.bind(this);

    // setup socket
    this.client = new net.Socket();
    this.client.on('data', this.decodeData);
    this.client.on('close', this.onClose);
    this.client.on('error', this.onError);

    // constants
    this.maximumPacketSize = 4096;

    // internal variables
    this.connected = false;
    this.autoReconnect = false;
    this.autoReconnectTimeout = null;

    this.incomingData = Buffer.from([]);
    this.incomingResponse = [];
    this.responseCallbackQueue = [];
    // Used For tracking Callbacks
    this.callbackIds = [];
    this.count = 1;
    this.loggedin = false;

    this.reconnecting = false;

    this.instanceIndex = index;
  }

  onPacket(decodedPacket) {
    // the logic in this method simply splits data sent via the data event into packets regardless of how they're
    // distributed in the event calls
    
    logger(
      'RCON',
      3,
      `[${this.instanceIndex}] Processing decoded packet: ${this.decodedPacketToString(decodedPacket)}`
    );

    switch (decodedPacket.type) {
      case SERVERDATA_RESPONSE_VALUE:
      case SERVERDATA_AUTH_RESPONSE:
        switch (decodedPacket.id) {
          case MID_PACKET_ID:
            this.incomingResponse.push(decodedPacket);

            break;
          case END_PACKET_ID:
            this.callbackIds = this.callbackIds.filter((p) => p.id !== decodedPacket.count);

            this.responseCallbackQueue.shift()(
              this.incomingResponse.map((packet) => packet.body).join()
            );
            this.incomingResponse = [];

            break;
          default:
            logger(
              'RCON',
              1,
              `[${this.instanceIndex}] Unknown packet ID ${decodedPacket.id} in: ${this.decodedPacketToString(
                decodedPacket
              )}`
            );
            this.onClose('Unknown Packet');
        }
        break;

      case SERVERDATA_CHAT_VALUE:
        this.processChatPacket(decodedPacket);
        break;

      default:
        logger(
          'RCON',
          1,
          `[${this.instanceIndex}] Unknown packet type ${decodedPacket.type} in: ${this.decodedPacketToString(
            decodedPacket
          )}`
        );
        this.onClose('Unknown Packet');
    }
  }

  decodeData(data) {
    logger('RCON', 4, `Got data: ${this.bufToHexString(data)}`);

    this.incomingData = Buffer.concat([this.incomingData, data]);

    while (this.incomingData.byteLength >= 4) {
      const size = this.incomingData.readInt32LE(0);
      const packetSize = size + 4;

      if (this.incomingData.byteLength < packetSize) {
        logger(
          'RCON',
          4,
          `[${this.instanceIndex}] Waiting for more data... Have: ${this.incomingData.byteLength} Expected: ${packetSize}`
        );
        break;
      }
      const packet = this.incomingData.slice(0, packetSize);

      logger('RCON', 4, `[${this.instanceIndex}] Processing packet: ${this.bufToHexString(packet)}`);
      const decodedPacket = this.decodePacket(packet);

      const matchCount = this.callbackIds.filter((d) => d.id === decodedPacket.count);

      if (
        matchCount.length > 0 ||
        [SERVERDATA_AUTH_RESPONSE, SERVERDATA_CHAT_VALUE].includes(decodedPacket.type)
      ) {
        this.onPacket(decodedPacket);
        this.incomingData = this.incomingData.slice(packetSize);
        continue;
      }
      // The packet following an empty packet will report to be 10 long (14 including the size header bytes), but in
      // it should report 17 long (21 including the size header bytes). Therefore, if the packet is 10 in size
      // and there's enough data for it to be a longer packet then we need to probe to check it's this broken packet.
      const probePacketSize = 21;

      if (size === 10 && this.incomingData.byteLength >= 21) {
        // copy the section of the incoming data of interest
        const probeBuf = this.incomingData.slice(0, probePacketSize);
        // decode it
        const decodedProbePacket = this.decodePacket(probeBuf);
        // check whether body matches
        if (decodedProbePacket.body === '\x00\x00\x00\x01\x00\x00\x00') {
          // it does so it's the broken packet
          // remove the broken packet from the incoming data
          this.incomingData = this.incomingData.slice(probePacketSize);
          logger('RCON', 4, `[${this.instanceIndex}] Ignoring some data: ${this.bufToHexString(probeBuf)}`);
          continue;
        }
      }

      // We should only get this far into the loop when we are done processing packets from this onData event.
      break;
    }
  }

  decodePacket(packet) {
    return {
      size: packet.readUInt32LE(0),
      id: packet.readUInt8(4),
      count: packet.readUInt16LE(6),
      type: packet.readUInt32LE(8),
      body: packet.toString('utf8', 12, packet.byteLength - 2)
    };
  }

  processChatPacket(decodedPacket) {}

  cleanupState() {
    if (this.incomingData.length > 0) {
      logger('RCON', 2, `[${this.instanceIndex}] Clearing Buffered Data`);
      this.incomingData = Buffer.from([]);
    }
    if (this.incomingResponse.length > 0) {
      logger('RCON', 2, `[${this.instanceIndex}] Clearing Buffered Response Data`);
      this.incomingResponse = [];
    }
    if (this.responseCallbackQueue.length > 0) {
      logger('RCON', 2, `[${this.instanceIndex}] Clearing Pending Callbacks`);
      while (this.responseCallbackQueue.length > 0) {
        this.responseCallbackQueue.shift()(new Error('RCON DISCONNECTED'));
      }
      this.callbackIds = [];
    }
  }  

  onClose(hadError) {
    this.connected = false;
    this.loggedin = false;
    logger('RCON', 1, `[${this.instanceIndex}] Socket closed ${hadError ? 'with' : 'without'} an error. ${hadError}`);
  
    // Cleanup all local state onClose
    this.cleanupState();
  
    if (this.autoReconnect && !this.reconnecting) {
      this.reconnecting = true;
      logger('RCON', 1, `[${this.instanceIndex}] Sleeping ${this.autoReconnectDelay}ms before reconnecting.`);
      setTimeout(async () => {
        try {
          await this.connect();
          logger('RCON', 1, `[${this.instanceIndex}] Reconnected successfully.`);
        } catch (err) {
          logger('RCON', 1, `[${this.instanceIndex}] Reconnection attempt failed: ${err}`);
        } finally {
          this.reconnecting = false;
        }
      }, this.autoReconnectDelay);
    }
  }

  onError(err) {
    logger('RCON', 1, `Socket had error: ${err}`);
    this.emit('RCON_ERROR', err);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.autoReconnect = true;
      logger('RCON', 1, `[${this.instanceIndex}] Connecting to: ${this.host}:${this.port}`);

      const onConnect = async () => {
        this.client.removeListener('error', onError);
        this.connected = true;

        logger('RCON', 1, `[${this.instanceIndex}] Connected to: ${this.host}:${this.port}`);

        try {
          // connected successfully, now try auth...
          await this.write(SERVERDATA_AUTH, this.password);

          // connected and authed successfully
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      const onError = (err) => {
        this.client.removeListener('connect', onConnect);

        logger('RCON', 1, `[${this.instanceIndex}] Failed to connect to: ${this.host}:${this.port}`, err);

        reject(err);
      };

      this.client.once('connect', onConnect);
      this.client.once('error', onError);

      this.client.connect(this.port, this.host);
    });
  }

  disconnect() {
    return new Promise((resolve, reject) => {
      logger('RCON', 1, `[${this.instanceIndex}] Disconnecting from: ${this.host}:${this.port}`);

      const onClose = () => {
        this.client.removeListener('error', onError);

        logger('RCON', 1, `[${this.instanceIndex}] Disconnected from: ${this.host}:${this.port}`);

        resolve();
      };

      const onError = (err) => {
        this.client.removeListener('close', onClose);

        logger('RCON', 1, `[${this.instanceIndex}] Failed to disconnect from: ${this.host}:${this.port}`, err);

        reject(err);
      };

      this.client.once('close', onClose);
      this.client.once('error', onError);

      // prevent any auto reconnection happening
      this.autoReconnect = false;
      // clear the timeout just in case the socket closed and then we DCed
      clearTimeout(this.autoReconnectTimeout);

      this.client.end();
    });
  }

  execute(command) {
    return this.write(SERVERDATA_EXECCOMMAND, command);
  }

  write(type, body) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected.'));
        return;
      }

      if (!this.client.writable) {
        reject(new Error('Unable to write to socket.'));
        return;
      }

      if (!this.loggedin && type !== SERVERDATA_AUTH) {
        reject(new Error('RCON not Logged in'));
        return;
      }

      logger('RCON', 2, `[${this.instanceIndex}] Writing packet with type "${type}" and body "${body}".`);

      const encodedPacket = this.encodePacket(
        type,
        type !== SERVERDATA_AUTH ? MID_PACKET_ID : END_PACKET_ID,
        body
      );

      const encodedEmptyPacket = this.encodePacket(type, END_PACKET_ID, '');

      if (this.maximumPacketSize < encodedPacket.length) {
        reject(new Error('Packet too long.'));
        return;
      }

      const onError = (err) => {
        logger('RCON', 1, `[${this.instanceIndex}] Error occurred. Wiping response action queue. ${err}`);
        this.responseCallbackQueue = [];
        reject(err);
      };

      // the auth packet also sends a normal response, so we add an extra empty action to ignore it

      if (type === SERVERDATA_AUTH) {
        this.callbackIds.push({ id: this.count, cmd: body });
        logger('RCON', 2, `[${this.instanceIndex}] Writing Auth Packet`);
        logger('RCON', 4, `[${this.instanceIndex}] Writing packet with type "${type}" and body "${body}".`);
        this.responseCallbackQueue.push(() => {});
        this.responseCallbackQueue.push((decodedPacket) => {
          this.client.removeListener('error', onError);
          if (decodedPacket.id === -1) {
            logger('RCON', 1, `[${this.instanceIndex}] Authentication failed.`);
            reject(new Error('Authentication failed.'));
          } else {
            logger('RCON', 1, `[${this.instanceIndex}] Authentication succeeded.`);
            this.loggedin = true;
            resolve();
          }
        });
      } else {
        logger('RCON', 2, `[${this.instanceIndex}] Writing packet with type "${type}" and body "${body}".`);
        this.callbackIds.push({ id: this.count, cmd: body });
        this.responseCallbackQueue.push((response) => {
          this.client.removeListener('error', onError);

          if (response instanceof Error) {
            // Called from onClose()
            reject(response);
          } else {
            // logger(
            //   'RCON',
            //   2,
            //   `Returning complete response: ${response.replace(/\r\n|\r|\n/g, '\\n')}`
            // );
            logger(
              'RCON',
              2,
              `[${this.instanceIndex}] Returning complete response.`
            );

            resolve(response);
          }
        });
      }

      this.client.once('error', onError);

      if (this.count + 1 > 65535) {
        this.count = 1;
      }

      logger('RCON', 4, `[${this.instanceIndex}] Sending packet: ${this.bufToHexString(encodedPacket)}`);
      this.client.write(encodedPacket);

      if (type !== SERVERDATA_AUTH) {
        logger(
          'RCON',
          4,
          `[${this.instanceIndex}] Sending empty packet: ${this.bufToHexString(encodedEmptyPacket)}`
        );
        this.client.write(encodedEmptyPacket);
        this.count++;
      }
    });
  }

  encodePacket(type, id, body, encoding = 'utf8') {
    const size = Buffer.byteLength(body) + 14;
    const buf = Buffer.alloc(size);

    buf.writeUInt32LE(size - 4, 0);
    buf.writeUInt8(id, 4);
    buf.writeUInt8(0, 5);
    buf.writeUInt16LE(this.count, 6);
    buf.writeUInt32LE(type, 8);
    buf.write(body, 12, size - 2, encoding);
    buf.writeUInt16LE(0, size - 2);

    return buf;
  }

  bufToHexString(buf) {
    return buf.toString('hex').match(/../g).join(' ');
  }

  decodedPacketToString(decodedPacket) {
    return util.inspect(decodedPacket, { breakLength: Infinity });
  }
}