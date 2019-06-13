"use strict";
/**
 * Created by Julian & NoobLance on 25.05.2017.
 * DISCLAIMER: We reuse some eris code
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Lavalink_1 = require("./Lavalink");
const Player_1 = require("./Player");
/**
 * Player Manager
 * @extends Map
 * @prop {Player} baseObject The player class used to create new players
 * @prop {object} client The eris client
 * @prop {object} defaultRegions The default region config
 * @prop {object} regions The region config being used
 */
class PlayerManager {
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
    constructor(client, nodes, options) {
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
    createNode(options) {
        let node = new Lavalink_1.default({
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
    removeNode(host) {
        let node = this.nodes.get(host);
        if (!host)
            return;
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
    queueFailover(fn) {
        if (this.failoverQueue.length > 0) {
            this.failoverQueue.push(fn);
        }
        else {
            return this.processQueue(fn);
        }
    }
    /**
     * Process the failover queue
     * @param {Function} fn The failover function to call
     * @private
     */
    processQueue(fn) {
        fn();
        setTimeout(() => this.checkFailoverQueue(), this.failoverRate);
    }
    /**
     * Called when an error is received from a Lavalink node
     * @param {string|Error} err The error received
     * @private
     */
    onError(err) {
        this.client.emit('error', err);
    }
    /**
     * Called when a node disconnects
     * @param {Lavalink} node The Lavalink node
     * @private
     */
    onDisconnect(node) {
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
    shardReady(id) {
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
    switchNode(player, leave) {
        let { guildId, channelId, track, paused } = player, position = (player.state.position || 0) + (this.options.reconnectThreshold || 2000);
        let listeners = player.listeners('end'), endListeners = [];
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
    onMessage(message) {
        if (!message.op)
            return;
        switch (message.op) {
            case 'playerUpdate': {
                let player = this.players.get(message.guildId);
                if (!player)
                    return;
                return player.stateUpdate(message.state);
            }
            case 'event': {
                let player = this.players.get(message.guildId);
                if (!player)
                    return;
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
    async join(guildId, channelId, options, player) {
        options = options || {};
        player = player || this.players.get(guildId);
        if (player && player.channelId !== channelId) {
            player.switchChannel(channelId);
            return Promise.resolve(player);
        }
        let region, node;
        if (options.node) {
            node = this.nodes.get(options.node);
            region = node.region;
        }
        else {
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
    async leave(guildId) {
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
    async findIdealNode(region) {
        let nodes = [...this.nodes.values()].filter(node => !node.draining && node.ws && node.connected);
        if (region) {
            let regionalNodes = nodes.filter(node => node.region === region);
            if (regionalNodes && regionalNodes.length) {
                nodes = regionalNodes;
            }
        }
        nodes = nodes.sort((a, b) => {
            let aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0, bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0;
            return aload - bload;
        });
        return nodes[0];
    }
    /**
     * Called by eris when a voice server update is received
     * @param {*} data The voice server update from eris
     * @private
     */
    async voiceServerUpdate(data) {
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
            }
            else {
                player = new Player_1.default(data.guild_id, {
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
    getRegionFromData(endpoint) {
        if (!endpoint)
            return this.options.defaultRegion || 'us';
        endpoint = endpoint.replace('vip-', '');
        for (let key in this.regions) {
            let nodes = Array.from(this.nodes.values()).filter(n => n.region === key);
            if (!nodes || !nodes.length)
                continue;
            if (!nodes.find(n => n.connected && !n.draining))
                continue;
            for (let region of this.regions[key]) {
                if (endpoint.startsWith(region)) {
                    return key;
                }
            }
        }
        return this.options.defaultRegion || 'us';
    }
}
exports.default = PlayerManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGxheWVyTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIuL3NyYy8iLCJzb3VyY2VzIjpbIlBsYXllck1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7QUFHSCx5Q0FBa0M7QUFDbEMscUNBQThCO0FBRzlCOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLGFBQWE7SUFjZjs7Ozs7Ozs7Ozs7T0FXRztJQUNILFlBQVksTUFBZSxFQUFFLEtBQXdFLEVBQUUsT0FBbUs7UUFFdFEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztRQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLEdBQUcsQ0FBQztRQUNoRCxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDO1FBRWhELElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDbEIsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUM7WUFDekMsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDO1lBQzlDLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVGLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDO1FBRXRELEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3BCLFlB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