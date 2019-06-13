/**
 * Created by Julian & NoobLance on 25.05.2017.
 * DISCLAIMER: We reuse some eris code
 */
/// <reference types="node" />
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
declare class PlayerManager {
    client: Client;
    players: Map<string, Player>;
    nodes: Map<string | number, Lavalink>;
    options: any;
    pendingGuilds: {
        [s: string]: {
            channelId: string;
            hostname?: string;
            options: Object | {};
            player: Player | null;
            node: Lavalink;
            res: (value?: Player | PromiseLike<Player>) => void;
            rej: any;
            timeout: NodeJS.Timeout;
        };
    };
    defaultRegions: {
        asia: string[];
        eu: string[];
        us: string[];
    };
    shardReadyListener: (id: number) => void;
    failoverQueue: Function[];
    failoverRate: number;
    failoverLimit: number;
    regions: {
        [s: string]: string[];
    };
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
    constructor(client: Client, nodes: {
        host: string;
        port: number;
        region: string;
        password: string;
    }[], options?: {
        defaultRegion?: string;
        failoverRate?: number;
        failoverLimit?: number;
        player?: Player;
        reconnectThreshold?: number;
        regions: {
            [s: string]: string[];
        };
    });
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
    createNode(options: {
        host: string;
        port: number;
        region: string;
        numShards: number;
        userId: string;
        password: string;
    }): void;
    /**
     * Remove a Lavalink node
     * @param {string} host The hostname of the node
     * @returns {void}
     */
    removeNode(host: string): void;
    /**
     * Check the failover queue
     * @private
     */
    checkFailoverQueue(): void;
    /**
     * Queue a failover
     * @param {Function} fn The failover function to queue
     * @private
     */
    queueFailover(fn: Function): void;
    /**
     * Process the failover queue
     * @param {Function} fn The failover function to call
     * @private
     */
    processQueue(fn: Function): void;
    /**
     * Called when an error is received from a Lavalink node
     * @param {string|Error} err The error received
     * @private
     */
    onError(err: string | Error | Lavalink): void;
    /**
     * Called when a node disconnects
     * @param {Lavalink} node The Lavalink node
     * @private
     */
    onDisconnect(node: Lavalink): void;
    /**
     * Called when a shard readies
     * @param {number} id Shard ID
     * @private
     */
    shardReady(id: number): void;
    /**
     * Switch the voice node of a player
     * @param {Player} player The Player instance
     * @param {boolean} leave Whether to leave the channel or not on our side
     * @returns {void}
     */
    switchNode(player: Player, leave?: boolean): void;
    /**
     * Called when a message is received from the voice node
     * @param {*} message The message received
     * @private
     */
    onMessage(message: any): boolean | void;
    /**
     * Join a voice channel
     * @param {string} guildId The guild ID
     * @param {string} channelId The channel ID
     * @param {Object} options Join options
     * @param {Player} [player] Optionally pass an existing player
     * @returns {Promise<Player>}
     */
    join(guildId: string, channelId: string, options: {
        node?: any;
        region?: string;
    }, player: Player): Promise<Player>;
    /**
     * Leave a voice channel
     * @param {string} guildId The guild ID
     * @returns {void}
     */
    leave(guildId: string): Promise<void>;
    /**
     * Find the ideal voice node based on load and region
     * @param {string} region Guild region
     * @returns {Lavalink} node Node with the lowest load for a region
     */
    findIdealNode(region: string): Promise<Lavalink>;
    /**
     * Called by eris when a voice server update is received
     * @param {*} data The voice server update from eris
     * @private
     */
    voiceServerUpdate(data: any): Promise<any | undefined>;
    /**
     * Get ideal region from data
     * @param {string} endpoint Endpoint or region
     * @private
     */
    getRegionFromData(endpoint: string): any;
}
export default PlayerManager;
