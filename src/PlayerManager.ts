/**
 * Created by Julian & NoobLance on 25.05.2017.
 * DISCLAIMER: We reuse some eris code
 */

import { Client } from "eris";
import Lavalink from "./Lavalink";
import Player from "./Player";


/**
 * Player Manager
 * @extends Map
 * @prop {Player} baseObject The player class used to create new players
 * @prop {object} client The eris client
 * @prop {object} defaultRegions The default region config
 * @prop {object} regions The region config being used
 */
class PlayerManager {
    client: Client;
    players: Map<string, Player>
    nodes: Map<string | number, Lavalink>;
    options: any;
    pendingGuilds: {[s: string]: { channelId: string, hostname?: string, options: Object | {}, player: Player | null, node: Lavalink, res: (value?: Player | PromiseLike<Player>) => void, rej: any, timeout: NodeJS.Timeout }};
    defaultRegions: { asia: string[]; eu: string[]; us: string[]; };
    shardReadyListener: (id: number) => void;
    failoverQueue: Function[];
    failoverRate: number;
    failoverLimit: number;
    regions: { [s: string]: string[]; };

    
    /**
     * PlayerManager constructor
     * @param {Client} client Eris client
     * @param {Object[]} nodes The Lavalink nodes to connect to
     * @param {Object} [options] Setup options
     * @param {string} [options.defaultRegion] The default region
     * @param {number} [options.failoverRate=250] Failover rate in ms
     * @param {number} [options.failoverLimit=1] Number of connections to failover per rate limit
     * @param {Object} [options.player] Optional Player class to replace the default Player
     * @param {number} [options.reconnectThreshold=2000] The amount of time to skip ahead in a song when reconnecting in ms
     * @param {Object} [options.regions] Region mapping object
     */
    constructor(client : Client, nodes: {host: string, port: number, region: string, password: string }[], options?: { defaultRegion?: string, failoverRate?: number, failoverLimit?: number, player?: Player, reconnectThreshold?: number, regions: {[s: string]: string[]} }) {

        this.client = client;
        this.nodes = new Map();
        this.players = new Map();
        this.pendingGuilds = {};
        this.options = options || {};
        this.failoverQueue = [];
        this.failoverRate = options.failoverRate || 250;
        this.failoverLimit = options.failoverLimit || 1;

        this.defaultRegions = {
            asia: ['hongkong', 'singapore', 'sydney'],
            eu: ['eu', 'amsterdam', 'frankfurt', 'russia'],
            us: ['us', 'brazil'],
        };

        this.regions = options.regions || this.defaultRegions;

        for (let node of nodes) {
            //@ts-ignore
            this.createNode(Object.assign({}, node, options));
        }

        this.shardReadyListener = this.shardReady.bind(this);
        this.client.on('shardReady', this.shardReadyListener);
    }

    /**
     * Create a Lavalink node
     * @param {Object} options Lavalink node options
     * @param {string} options.host The hostname to connect to
     * @param {string} options.port The port to connect with
     * @param {string} options.region The region of the node
     * @param {number} options.numShards The number of shards the bot is running
     * @param {string} options.userId The user id of the bot
     * @param {string} options.password The password for the Lavalink node
     * @returns {void}
     */
    createNode(options: {host: string, port: number, region: string, numShards: number, userId: string, password: string }): void {
        let node = new Lavalink({
            host: options.host,
            port: options.port,
            region: options.region,
            numShards: options.numShards,
            userId: options.userId,
            password: options.password,
        });

        node.on('error', this.onError.bind(this, node));
        node.on('disconnect', this.onDisconnect.bind(this, node));
        node.on('message', this.onMessage.bind(this, node));

        this.nodes.set(options.host, node);
    }

    /**
     * Remove a Lavalink node
     * @param {string} host The hostname of the node
     * @returns {void}
     */
    removeNode(host: string): void {
        let node = this.nodes.get(host);
        if (!host) return;
        node.destroy();
        this.nodes.delete(host);
        this.onDisconnect(node);
    }

    /**
     * Check the failover queue
     * @private
     */
    checkFailoverQueue() {
        if (this.failoverQueue.length > 0) {
            let fns = this.failoverQueue.splice(0, this.failoverLimit);
            for (let fn of fns) {
                this.processQueue(fn);
            }
        }
    }

    /**
     * Queue a failover
     * @param {Function} fn The failover function to queue
     * @private
     */
    queueFailover(fn: Function) {
        if (this.failoverQueue.length > 0) {
            this.failoverQueue.push(fn);
        } else {
            return this.processQueue(fn);
        }
    }

    /**
     * Process the failover queue
     * @param {Function} fn The failover function to call
     * @private
     */
    processQueue(fn: Function) {
        fn();
        setTimeout(() => this.checkFailoverQueue(), this.failoverRate);
    }

    /**
     * Called when an error is received from a Lavalink node
     * @param {string|Error} err The error received
     * @private
     */
    onError(err: string | Error | Lavalink) {
        this.client.emit('error', err);
    }

    /**
     * Called when a node disconnects
     * @param {Lavalink} node The Lavalink node
     * @private
     */
    onDisconnect(node: Lavalink) {
        let players = Array.from(this.players.values()).filter(player => player.node.host === node.host);
        for (let player of players) {
            this.queueFailover(this.switchNode.bind(this, player, true));
        }
    }

    /**
     * Called when a shard readies
     * @param {number} id Shard ID
     * @private
     */
    shardReady(id: number) {
        let players = Array.from(this.players.values()).filter(player => player.shard.id && player.shard.id === id);
        for (let player of players) {
            this.queueFailover(this.switchNode.bind(this, player));
        }
    }

    /**
     * Switch the voice node of a player
     * @param {Player} player The Player instance
     * @param {boolean} leave Whether to leave the channel or not on our side
     * @returns {void}
     */
    switchNode(player: Player, leave?: boolean): void {
        let { guildId, channelId, track, paused } = player,
            position = (player.state.position || 0) + (this.options.reconnectThreshold || 2000);

        let listeners = player.listeners('end'),
            endListeners : any[] = [];

        if (listeners && listeners.length) {
            for (let listener of listeners) {
                endListeners.push(listener);
                //@ts-ignore
                player.removeListener('end', listener);
            }
        }

        player.once('end', () => {
            for (let listener of endListeners) {
                player.on('end', listener);
            }
        });

        this.players.delete(guildId);

        player.playing = false;

        if (leave) {
            player.updateVoiceState(null);
        }

        process.nextTick(() => {
            this.join(guildId, channelId, null, player).then(player => {
                if (paused) {
                    player.pause();
                }
                player.play(track, { startTime: position });
                player.emit('reconnect');
                this.players.set(guildId, player);
            })
            .catch(() => {
                player.disconnect();
            });
        });
    }

    /**
     * Called when a message is received from the voice node
     * @param {*} message The message received
     * @private
     */
    onMessage(message: any) {
        if (!message.op) return;

        switch (message.op) {
            case 'playerUpdate': {
                let player = this.players.get(message.guildId);
                if (!player) return;

                return player.stateUpdate(message.state);
            }
            case 'event': {
                let player = this.players.get(message.guildId);
                if (!player) return;

                switch (message.type) {
                    case 'TrackEndEvent':
                        return player.onTrackEnd(message);
                    case 'TrackExceptionEvent':
                        return player.onTrackException(message);
                    case 'TrackStuckEvent':
                        return player.onTrackStuck(message);
                    default:
                        return player.emit('warn', `Unexpected event type: ${message.type}`);
                }
            }
        }
    }

    /**
     * Join a voice channel
     * @param {string} guildId The guild ID
     * @param {string} channelId The channel ID
     * @param {Object} options Join options
     * @param {Player} [player] Optionally pass an existing player
     * @returns {Promise<Player>}
     */
    async join(guildId: string, channelId: string, options: {node?: any, region?: string }, player: Player): Promise<Player> {
        options = options || {};

        player = player || this.players.get(guildId);
        if (player && player.channelId !== channelId) {
            player.switchChannel(channelId);
            return Promise.resolve(player);
        }

        let region, node: Lavalink;

        if(options.node) {
            node = this.nodes.get(options.node);
            region = node.region;
        } else {
            region = this.getRegionFromData(options.region || 'us');
            node = await this.findIdealNode(region);
        }

        if (!node) {
            return Promise.reject('No available voice nodes.');
        }

        return new Promise((res, rej) => {
            this.pendingGuilds[guildId] = {
                channelId: channelId,
                options: options || {},
                player: player || null,
                node: node,
                res: res,
                rej: rej,
                timeout: setTimeout(() => {
                    delete this.pendingGuilds[guildId];
                    rej(new Error('Voice connection timeout'));
                }, 10000),
            };
        });
    }

    /**
     * Leave a voice channel
     * @param {string} guildId The guild ID
     * @returns {void}
     */
    async leave(guildId: string): Promise<void> {
        let player = this.players.get(guildId);
        if (!player) {
            return;
        }
        player._disconnect();
        this.players.delete(guildId);
    }

    /**
     * Find the ideal voice node based on load and region
     * @param {string} region Guild region
     * @returns {Lavalink} node Node with the lowest load for a region
     */
    async findIdealNode(region: string): Promise<Lavalink> {
        let nodes = [...this.nodes.values()].filter(node => !node.draining && node.ws && node.connected);

        if (region) {
            let regionalNodes = nodes.filter(node => node.region === region);
            if (regionalNodes && regionalNodes.length) {
                nodes = regionalNodes;
            }
        }

        nodes = nodes.sort((a, b) => {
            let aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0,
                bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0;
            return aload - bload;
        });
        return nodes[0];
    }

    /**
     * Called by eris when a voice server update is received
     * @param {*} data The voice server update from eris
     * @private
     */
    async voiceServerUpdate(data: any) : Promise<any | undefined> {
        if (this.pendingGuilds[data.guild_id] && this.pendingGuilds[data.guild_id].timeout) {
            clearTimeout(this.pendingGuilds[data.guild_id].timeout);
            this.pendingGuilds[data.guild_id].timeout = null;
        }

        let player = this.players.get(data.guild_id);
        if (!player) {
            if (!this.pendingGuilds[data.guild_id]) {
                return;
            }

            player = this.pendingGuilds[data.guild_id].player;

            if (player) {
                //player.sessionId = data.session_id;
                player.hostname = this.pendingGuilds[data.guild_id].hostname;
                player.node = this.pendingGuilds[data.guild_id].node;
                //player.event = data;
                this.players.set(data.guild_id, player);
            } else {
                player = new Player(data.guild_id, {
                    shard: data.shard,
                    guildId: data.guild_id,
                    //sessionId: data.session_id,
                    channelId: this.pendingGuilds[data.guild_id].channelId,
                    hostname: this.pendingGuilds[data.guild_id].hostname,
                    node: this.pendingGuilds[data.guild_id].node,
                    options: this.pendingGuilds[data.guild_id].options,
                    //event: data,
                    manager: this,
                });
                this.players.set(data.guild_id, player);
            }
        }

        const channelId = player.channelId || this.pendingGuilds[data.guild_id].channelId;
        if (!channelId) {
            if (this.pendingGuilds[data.guild_id]) {
                delete this.pendingGuilds[data.guild_id];
                return this.pendingGuilds[data.guild_id].rej(new Error('Invalid Channel ID'));
            }
            return;
        }
        
        player.connect({
            sessionId: data.session_id,
            guildId: data.guild_id,
            //channelId: channelId,
            event: {
                endpoint: data.endpoint,
                guild_id: data.guild_id,
                token: data.token,
            },
        });

        let disconnectHandler = () => {
            player = this.players.get(data.guild_id);
            if (!this.pendingGuilds[data.guild_id]) {
                if (player) {
                    player.removeListener('ready', readyHandler);
                }
                return;
            }
            player.removeListener('ready', readyHandler);
            this.pendingGuilds[data.guild_id].rej(new Error('Disconnected'));
            delete this.pendingGuilds[data.guild_id];
        };

        let readyHandler = () => {
            player = this.players.get(data.guild_id);
            if (!this.pendingGuilds[data.guild_id]) {
                if (player) {
                    player.removeListener('disconnect', disconnectHandler);
                }
                return;
            }
            player.removeListener('disconnect', disconnectHandler);
            this.pendingGuilds[data.guild_id].res(player);
            delete this.pendingGuilds[data.guild_id];
        };

        player.once('ready', readyHandler).once('disconnect', disconnectHandler);
    }

    /**
     * Get ideal region from data
     * @param {string} endpoint Endpoint or region
     * @private
     */
    getRegionFromData(endpoint: string) {
        if (!endpoint) return this.options.defaultRegion || 'us';

        endpoint = endpoint.replace('vip-', '');

        for (let key in this.regions) {
            let nodes = Array.from(this.nodes.values()).filter(n => n.region === key);
            if (!nodes || !nodes.length) continue;
            if (!nodes.find(n => n.connected && !n.draining)) continue;
            for (let region of this.regions[key]) {
                if (endpoint.startsWith(region)) {
                    return key;
                }
            }
        }

        return this.options.defaultRegion || 'us';
    }
}

export default PlayerManager;
