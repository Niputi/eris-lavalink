/// <reference types="node" />
import { Shard } from "eris";
import { EventEmitter } from "events";
import PlayerManager from "./PlayerManager";
import Lavalink from "./Lavalink";
/**
 * Represents a player/voice connection to Lavalink
 * @extends EventEmitter
 * @prop {string} id Guild id for the player
 * @prop {PlayerManager} manager Reference to the player manager
 * @prop {Lavalink} node Lavalink node the player is connected to
 * @prop {object} shard The eris shard the player is associated with
 * @prop {string} hostname Hostname of the lavalink node
 * @prop {string} guildId Guild ID
 * @prop {string} channelId Channel ID
 * @prop {boolean} ready If the connection is ready
 * @prop {boolean} playing If the player is playing
 * @prop {object} state The lavalink player state
 * @prop {string} track The lavalink track to play
 */
declare class Player extends EventEmitter {
    id: string;
    node: Lavalink;
    hostname: string;
    guildId: string;
    channelId: string;
    manager: PlayerManager;
    ready: boolean;
    playing: boolean;
    paused: boolean;
    shard: Shard;
    state: {
        position?: number;
    };
    track: string;
    sendQueue: any[];
    timestamp: number;
    lastTrack: string;
    playOptions: object;
    options: Object;
    /**
     * Player constructor
     * @param {string} id Guild ID
     * @param {Object} data Player data
     * @param {string} data.channelId The channel id of the player
     * @param {string} data.guildId The guild id of the player
     * @param {string} data.hostname The hostname of the lavalink node
     * @param {PlayerManager} data.manager The PlayerManager associated with this player
     * @param {Lavalink} data.node The Lavalink node associated with this player
     * @param {Shard} data.shard The eris shard associated with this player
     * @param {Object} [data.options] Additional passed from the user to the player
     */
    constructor(id: string, options: {
        channelId: string;
        guildId: string;
        hostname: string;
        manager: PlayerManager;
        node: Lavalink;
        shard: Shard;
        options?: Object;
    });
    /**
     * Check the event queue
     * @private
     */
    checkEventQueue(): void;
    /**
     * Queue an event to be sent to Lavalink
     * @param {*} data The payload to queue
     * @private
     */
    queueEvent(data: any): Promise<void>;
    /**
     * Send a payload to Lavalink
     * @param {*} data The payload to send
     * @private
     */
    sendEvent(data: any): Promise<void>;
    /**
     * Connect to the Lavalink node
     * @param {Object} data The data used to connect
     * @param {string} data.guildId The guild ID to connect
     * @param {string} data.sessionId The voice connection session ID
     * @param {object} data.event The event data from the voice server update
     * @returns {void}
     */
    connect(data: {
        guildId: string;
        sessionId: string;
        event: Object;
    }): void;
    /**
     * Disconnect from Lavalink
     * @param {*} [msg] An optional disconnect message
     * @returns {void}
     */
    disconnect(msg?: any): void;
    _disconnect(): void;
    /**
     *
     * @param {{band: number, gain: number}} options The bands range from 0 to 15 and the gain ranges from -0.25 to 1, 0 is the default gain.
     * @memberof Player
     */
    setEQ(options: {
        band: number;
        gain: number;
    }): void;
    /**
     * destroy the player
     */
    destroy(): void;
    /**
     * Play a Lavalink track
     * @param {string} track The track to play
     * @param {Object} [options] Optional options to send
     * @returns {void}
     */
    play(track: string, options?: object): void;
    /**
     * Stop playing
     * @returns {void}
     */
    stop(): void;
    /**
     * Update player state
     * @param {Object} state The state object received from Lavalink
     * @private
     */
    stateUpdate(state: object): void;
    /**
     * Used to pause/resume the player
     * @param {boolean} pause Set pause to true/false
     * @returns {void}
     */
    setPause(pause: boolean): void;
    /**
     * Used to pause the player
     */
    pause(): void;
    /**
     * Used to resume the player
     */
    resume(): void;
    /**
     * Used for seeking to a track position
     * @param {number} position The position to seek to
     * @returns {void}
     */
    seek(position: number): void;
    /**
     * Set the volume of the player
     * @param {number} volume The volume level to set
     * @returns {void}
     */
    setVolume(volume: number): void;
    /**
     * Called on track end
     * @param {Object} message The end reason
     * @private
     */
    onTrackEnd(message: {
        reason: string;
    }): void;
    /**
     * Called on track exception
     * @param {Object} message The exception encountered
     * @private
     */
    onTrackException(message: object): void;
    /**
     * Called on track stuck
     * @param {Object} message The message if exists
     * @private
     */
    onTrackStuck(message: object): void;
    /**
     * Switch voice channel
     * @param {string} channelId Called when switching channels
     * @param {boolean} [reactive] Used if you want the bot to switch channels
     * @returns {void}
     */
    switchChannel(channelId: string, reactive?: boolean): void;
    getTimestamp(): number;
    /**
     * Update the bot's voice state
     * @param {boolean} selfMute Whether the bot muted itself or not (audio sending is unaffected)
     * @param {boolean} selfDeaf Whether the bot deafened itself or not (audio receiving is unaffected)
     * @private
     */
    updateVoiceState(channelId: string, selfMute?: boolean, selfDeaf?: boolean): void;
}
export default Player;
