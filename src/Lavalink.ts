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
class Lavalink extends EventEmitter {

	address: string
	port: number
	region: string
	host: string
	numShards: number
	userId: string
	password: string
	connected: boolean
	draining: boolean
	retries: number
	reconnectTimeout: number
	stats: {players?: number, playingPlayers?: number, cpu?: { systemLoad: number, cores: number} }
	ws: WebSocket
	reconnectInterval: NodeJS.Timeout
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
	constructor(options:  {host: string, port: number, region: string, numShards: number, userId: string, password: string, timeout?: number}) {
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
		this.ws = new WebSocket(this.address, {headers: {
			'Authorization': this.password,
			'Num-Shards': this.numShards,
			'User-Id': this.userId,
		}});

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
	 private disconnected() {
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
	private retryInterval() {
		let retries = Math.min(this.retries-1, 5);
		return Math.pow(retries + 5, 2) * 1000;
	}

	/**
	 * Send data to Lavalink
	 * @param {*} data Data to send
	 */
	send(data: any) {
		const ws = this.ws;
		if (!ws) return;

		try {
			var payload = JSON.stringify(data);
		} catch (err) {
			return this.emit('error', 'Unable to stringify payload.');
		}
		ws.send(payload);
	}

	/**
	 * Handle message from the server
	 * @param {string} message Raw websocket message
	 * @private
	 */
	private onMessage(message: string) {
		try {
			var data = JSON.parse(message);
		} catch (e) {
			return this.emit('error', 'Unable to parse ws message.');
		}

		if (data.op && data.op === 'stats') {
			this.stats = data;
		}

		this.emit('message', data);
	}
}

export default Lavalink;
