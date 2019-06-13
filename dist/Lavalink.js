"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const events_1 = require("events");
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
class Lavalink extends events_1.EventEmitter {
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
    constructor(options) {
        super();
        this.host = options.host;
        this.port = options.port || 80;
        this.address = `ws://${this.host}:${this.port}`;
        this.region = options.region || null;
        this.userId = options.userId;
        this.numShards = options.numShards;
        this.password = options.password || 'youshallnotpass';
        this.connected = false;
        this.draining = false;
        this.retries = 0;
        this.reconnectTimeout = options.timeout || 5000;
        this.reconnectInterval = null;
        this.stats = { players: 0, playingPlayers: 0 };
        this.disconnectHandler = this.disconnected.bind(this);
        this.connect();
    }
    /**
     * Connect to the websocket server
     * @private
     */
    connect() {
        //@ts-ignore
        this.ws = new ws_1.default(this.address, { headers: {
                'Authorization': this.password,
                'Num-Shards': this.numShards,
                'User-Id': this.userId,
            } });
        this.ws.on('open', this.ready.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.disconnectHandler);
        this.ws.on('error', (err) => {
            this.emit('error', err);
        });
    }
    /**
     * Reconnect to the websocket
     * @private
     */
    reconnect() {
        let interval = this.retryInterval();
        this.reconnectInterval = setTimeout(this.reconnect.bind(this), interval);
        this.retries++;
        this.connect();
    }
    /**
     * Destroy the websocket connection
     */
    destroy() {
        if (this.ws) {
            this.ws.removeListener('close', this.disconnectHandler);
            this.ws.close();
        }
    }
    /**
     * Called when the websocket is open
     * @private
     */
    ready() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        this.connected = true;
        this.retries = 0;
        this.emit('ready');
    }
    /**
     * Called when the websocket disconnects
    */
    disconnected() {
        this.connected = false;
        if (!this.reconnectInterval) {
            this.emit('disconnect');
        }
        delete this.ws;
        if (!this.reconnectInterval) {
            this.reconnectInterval = setTimeout(this.reconnect.bind(this), this.reconnectTimeout);
        }
    }
    /**
     * Get the retry interval
     * @private
     */
    retryInterval() {
        let retries = Math.min(this.retries - 1, 5);
        return Math.pow(retries + 5, 2) * 1000;
    }
    /**
     * Send data to Lavalink
     * @param {*} data Data to send
     */
    send(data) {
        const ws = this.ws;
        if (!ws)
            return;
        try {
            var payload = JSON.stringify(data);
        }
        catch (err) {
            return this.emit('error', 'Unable to stringify payload.');
        }
        ws.send(payload);
    }
    /**
     * Handle message from the server
     * @param {string} message Raw websocket message
     * @private
     */
    onMessage(message) {
        try {
            var data = JSON.parse(message);
        }
        catch (e) {
            return this.emit('error', 'Unable to parse ws message.');
        }
        if (data.op && data.op === 'stats') {
            this.stats = data;
        }
        this.emit('message', data);
    }
}
exports.default = Lavalink;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGF2YWxpbmsuanMiLCJzb3VyY2VSb290IjoiLi9zcmMvIiwic291cmNlcyI6WyJMYXZhbGluay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJCQUEyQjtBQUMzQixtQ0FBc0M7QUFFdEM7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQU0sUUFBUyxTQUFRLHFCQUFZO0lBa0JsQzs7Ozs7Ozs7OztPQVVHO0lBQ0gsWUFBWSxPQUE2SDtRQUN4SSxLQUFLLEVBQUUsQ0FBQztRQUVSLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztRQUN6QixJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxPQUFPLEdBQUcsUUFBUSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoRCxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDO1FBQ3JDLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFDbkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJLGlCQUFpQixDQUFDO1FBQ3RELElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQztRQUNoRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1FBQzlCLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FB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