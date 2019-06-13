/// <reference types="node" />
import WebSocket from "ws";
import { EventEmitter } from "events";
/**
 * Represents a Lavalink node
 * @extends EventEmitter
 * @prop {string} host The hostname for the node
 * @prop {number} port The port number for the node
 * @prop {string} address The full ws address for the node
 * @prop {string} region The region for this node
 * @prop {string} userId The client user id
 * @prop {number} numShards The total number of shards the bot is running
 * @prop {string} password The password used to connect
 * @prop {boolean} connected If it's connected to the node
 * @prop {boolean} draining True if this node will no longer take new connections
 * @prop {object} stats The Lavalink node stats
 */
declare class Lavalink extends EventEmitter {
    address: string;
    port: number;
    region: string;
    host: string;
    numShards: number;
    userId: string;
    password: string;
    connected: boolean;
    draining: boolean;
    retries: number;
    reconnectTimeout: number;
    stats: {
        players?: number;
        playingPlayers?: number;
        cpu?: {
            systemLoad: number;
            cores: number;
        };
    };
    ws: WebSocket;
    reconnectInterval: NodeJS.Timeout;
    disconnectHandler: () => void;
    /**
     * Lavalink constructor
     * @param {Object} options Lavalink node options
     * @param {string} options.host The hostname to connect to
     * @param {string} options.port The port to connect with
     * @param {string} options.region The region of the node
     * @param {number} options.numShards The number of shards the bot is running
     * @param {string} options.userId The user id of the bot
     * @param {string} options.password The password for the Lavalink node
     * @param {number} [options.timeout=5000] Optional timeout in ms used for the reconnect backoff
     */
    constructor(options: {
        host: string;
        port: number;
        region: string;
        numShards: number;
        userId: string;
        password: string;
        timeout?: number;
    });
    /**
     * Connect to the websocket server
     * @private
     */
    connect(): void;
    /**
     * Reconnect to the websocket
     * @private
     */
    reconnect(): void;
    /**
     * Destroy the websocket connection
     */
    destroy(): void;
    /**
     * Called when the websocket is open
     * @private
     */
    ready(): void;
    /**
     * Called when the websocket disconnects
    */
    private disconnected;
    /**
     * Get the retry interval
     * @private
     */
    private retryInterval;
    /**
     * Send data to Lavalink
     * @param {*} data Data to send
     */
    send(data: any): boolean;
    /**
     * Handle message from the server
     * @param {string} message Raw websocket message
     * @private
     */
    private onMessage;
}
export default Lavalink;
