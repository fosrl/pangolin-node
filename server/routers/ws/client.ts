import WebSocket from 'ws';
import { URL } from 'url';
import { EventEmitter } from 'events';
import logger from '@server/logger';

export interface Config {
  id: string;
  secret: string;
  endpoint: string;
}

export interface WSMessage {
  type: string;
  data: any;
}

export type MessageHandler = (message: WSMessage) => void;

export interface ClientOptions {
  baseURL?: string;
  reconnectInterval?: number;
  pingInterval?: number;
  pingTimeout?: number;
}

export class WebSocketClient extends EventEmitter {
  private conn: WebSocket | null = null;
  private baseURL: string;
  private handlers: Map<string, MessageHandler> = new Map();
  private reconnectInterval: number;
  private isConnected: boolean = false;
  private pingInterval: number;
  private pingTimeout: number;
  private shouldReconnect: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pingTimeoutTimer: NodeJS.Timeout | null = null;
  private token: string;
  private isConnecting: boolean = false;

  constructor(
    token: string,
    endpoint: string,
    options: ClientOptions = {}
  ) {
    super();
    
    this.token = token;
    this.baseURL = options.baseURL || endpoint;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.pingInterval = options.pingInterval || 30000;
    this.pingTimeout = options.pingTimeout || 10000;
  }

  public async connect(): Promise<void> {
    this.shouldReconnect = true;
    if (!this.isConnecting) {
      await this.connectWithRetry();
    }
  }

  public async close(): Promise<void> {
    this.shouldReconnect = false;
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }

    if (this.conn) {
      this.conn.close(1000, 'Client closing');
      this.conn = null;
    }
    
    this.setConnected(false);
  }

  public sendMessage(messageType: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const message: WSMessage = {
        type: messageType,
        data: data
      };

      logger.debug(`Sending message: ${messageType}`, data);
      
      this.conn.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public sendMessageInterval(
    messageType: string, 
    data: any, 
    interval: number
  ): () => void {
    // Send immediately
    this.sendMessage(messageType, data).catch(err => {
      logger.error('Failed to send initial message:', err);
    });

    // Set up interval
    const intervalId = setInterval(() => {
      this.sendMessage(messageType, data).catch(err => {
        logger.error('Failed to send message:', err);
      });
    }, interval);

    // Return stop function
    return () => {
      clearInterval(intervalId);
    };
  }

  public registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  public unregisterHandler(messageType: string): void {
    this.handlers.delete(messageType);
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  private async connectWithRetry(): Promise<void> {
    if (this.isConnecting || this.isConnected) return;
    
    this.isConnecting = true;
    
    while (this.shouldReconnect && !this.isConnected && this.isConnecting) {
      try {
        await this.establishConnection();
        this.isConnecting = false;
        return;
      } catch (error) {
        logger.error(`Failed to connect: ${error}. Retrying in ${this.reconnectInterval}ms...`);
        
        if (!this.shouldReconnect || !this.isConnecting) {
          this.isConnecting = false;
          return;
        }
        
        await new Promise(resolve => {
          this.reconnectTimer = setTimeout(resolve, this.reconnectInterval);
        });
      }
    }
    
    this.isConnecting = false;
  }

  private async establishConnection(): Promise<void> {
    // Clean up any existing connection before establishing a new one
    if (this.conn) {
      this.conn.removeAllListeners();
      this.conn.close();
      this.conn = null;
    }

    // Parse the base URL to determine protocol and hostname
    const baseURL = new URL(this.baseURL);
    const wsProtocol = baseURL.protocol === 'https:' ? 'wss' : 'ws';
    const wsURL = new URL(`${wsProtocol}://${baseURL.host}/api/v1/ws`);
    
    // Add token and client type to query parameters
    wsURL.searchParams.set('token', this.token);
    wsURL.searchParams.set('clientType', "remoteExitNode");

    return new Promise((resolve, reject) => {
      const conn = new WebSocket(wsURL.toString());

      conn.on('open', () => {
        logger.debug('WebSocket connection established');
        this.conn = conn;
        this.setConnected(true);
        this.isConnecting = false;
        this.startPingMonitor();
        this.emit('connect');
        resolve();
      });

      conn.on('message', (data: WebSocket.Data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          const handler = this.handlers.get(message.type);
          if (handler) {
            handler(message);
          }
          this.emit('message', message);
        } catch (error) {
          logger.error('Failed to parse message:', error);
        }
      });

      conn.on('close', (code, reason) => {
        logger.debug(`WebSocket connection closed: ${code} ${reason}`);
        this.handleDisconnect();
      });

      conn.on('error', (error) => {
        logger.error('WebSocket error:', error);
        if (this.conn === null) {
          // Connection failed during establishment
          reject(error);
        }
        // Don't call handleDisconnect here as the 'close' event will handle it
      });

      conn.on('pong', () => {
        if (this.pingTimeoutTimer) {
          clearTimeout(this.pingTimeoutTimer);
          this.pingTimeoutTimer = null;
        }
      });
    });
  }

  private startPingMonitor(): void {
    // Clear any existing ping timer to prevent duplicates
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    this.pingTimer = setInterval(() => {
      if (this.conn && this.conn.readyState === WebSocket.OPEN) {
        this.conn.ping();
        
        // Set timeout for pong response
        this.pingTimeoutTimer = setTimeout(() => {
          logger.error('Ping timeout - no pong received');
          this.handleDisconnect();
        }, this.pingTimeout);
      }
    }, this.pingInterval);
  }

  private handleDisconnect(): void {
    // Prevent multiple disconnect handlers from running simultaneously
    if (!this.isConnected && !this.isConnecting) {
      return;
    }

    this.setConnected(false);
    this.isConnecting = false;
    
    // Clear ping timers
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }

    // Clear any existing reconnect timer to prevent multiple reconnection attempts
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.conn) {
      this.conn.removeAllListeners();
      this.conn = null;
    }

    this.emit('disconnect');

    // Reconnect if needed
    if (this.shouldReconnect) {
      // Add a small delay before starting reconnection to prevent immediate retry
      this.reconnectTimer = setTimeout(() => {
        this.connectWithRetry();
      }, 1000);
    }
  }

  private setConnected(status: boolean): void {
    this.isConnected = status;
  }
}

// Factory function for easier instantiation
export function createWebSocketClient(
    token: string,
    endpoint: string,
  options?: ClientOptions
): WebSocketClient {
  return new WebSocketClient(token, endpoint, options);
}

export default WebSocketClient;