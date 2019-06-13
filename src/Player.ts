import { Constants, Shard } from "eris";
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
class Player extends EventEmitter {
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
    state: { position?: number };
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
    constructor(id: string, options: {channelId: string, guildId: string, hostname: string, manager: PlayerManager, node: Lavalink, shard: Shard, options?: Object}) {
        super();
        this.id = id;
        this.node = options.node;
        this.hostname = options.hostname;
        this.guildId = options.guildId;
        this.channelId = options.channelId;
        this.manager = options.manager || null;
        this.options = options.options;
        this.ready = false;
        this.playing = false;
        this.paused = false;
        this.shard = options.shard;
        this.state = {};
        this.track = null;
        this.sendQueue = [];
        this.timestamp = Date.now();
    }

    /**
     * Check the event queue
     * @private
     */
    checkEventQueue() {
        if (this.sendQueue.length > 0) {
            let event = this.sendQueue.splice(0,1);
            this.sendEvent(event[0]);
        }
    }

    /**
     * Queue an event to be sent to Lavalink
     * @param {*} data The payload to queue
     * @private
     */
    queueEvent(data: any) {
        if (this.sendQueue.length > 0) {
            this.sendQueue.push(data);
        } else {
            return this.sendEvent(data);
        }
    }

    /**
     * Send a payload to Lavalink
     * @param {*} data The payload to send
     * @private
     */
    async sendEvent(data: any) {
        this.node.send(data);
        process.nextTick(() => this.checkEventQueue());
    }

    /**
     * Connect to the Lavalink node
     * @param {Object} data The data used to connect
     * @param {string} data.guildId The guild ID to connect
     * @param {string} data.sessionId The voice connection session ID
     * @param {object} data.event The event data from the voice server update
     * @returns {void}
     */
    connect(data: {guildId: string, sessionId: string, event: Object}): void {
        this.emit('connect');
        this.queueEvent({
            op: 'voiceUpdate',
            guildId: data.guildId,
            sessionId: data.sessionId,
            event: data.event,
        });

        process.nextTick(() => this.emit('ready'));
    }

    /**
     * Disconnect from Lavalink
     * @param {*} [msg] An optional disconnect message
     * @returns {void}
     */
    disconnect(msg?: any): void {
        this._disconnect();
        this.emit('disconnect', msg);
    }

    _disconnect() {
        this.playing = false;

        if (this.paused) {
            this.resume();
        }

        this.queueEvent({ op: 'destroy', guildId: this.guildId });

        this.stop();
    }

    /**
     *
     * @param {{band: number, gain: number}} options The bands range from 0 to 15 and the gain ranges from -0.25 to 1, 0 is the default gain.
     * @memberof Player
     */
    setEQ(options : {band: number, gain: number}) {
        this.node.send({
            op: 'equalizer',
            guildId: this.guildId,
            bands: options,
        });
    }


    /**
     * destroy the player
     */
    destroy() {
        this.node.send({
            op: 'equalizer',
            guildId: this.guildId
        });
    }

    /**
     * Play a Lavalink track
     * @param {string} track The track to play
     * @param {Object} [options] Optional options to send
     * @returns {void}
     */
    play(track: string, options?: object): void {
        this.lastTrack = this.track;
        this.track = track;
        this.playOptions = options;

        if (this.node.draining) {
            this.state.position = 0;
            return this.manager.switchNode(this);
        }

        let payload = Object.assign({
            op: 'play',
            guildId: this.guildId,
            track: track,
        }, options);

        this.queueEvent(payload);
        this.playing = !this.paused;
        this.timestamp = Date.now();
    }

    /**
     * Stop playing
     * @returns {void}
     */
    stop(): void {
        let payload = {
            op: 'stop',
            guildId: this.guildId,
        };

        this.queueEvent(payload);
        this.playing = false;
        this.lastTrack = this.track;
        this.track = null;
    }

    /**
     * Update player state
     * @param {Object} state The state object received from Lavalink
     * @private
     */
    stateUpdate(state: object) {
        this.state = state;
    }

    /**
     * Used to pause/resume the player
     * @param {boolean} pause Set pause to true/false
     * @returns {void}
     */
    setPause(pause: boolean): void {
        this.node.send({
            op: 'pause',
            guildId: this.guildId,
            pause: pause,
        });

        this.paused = pause;
        this.playing = !pause;
    }

    /**
     * Used to pause the player
     */
    pause() {
        if (this.playing) {
            this.setPause(true);
        }
    }

    /**
     * Used to resume the player
     */
    resume() {
        if (!this.playing && this.paused) {
            this.setPause(false)
        }
    }

    /**
     * Used for seeking to a track position
     * @param {number} position The position to seek to
     * @returns {void}
     */
    seek(position: number): void {
        this.node.send({
            op: 'seek',
            guildId: this.guildId,
            position: position,
        });
    }

    /**
     * Set the volume of the player
     * @param {number} volume The volume level to set
     * @returns {void}
     */
    setVolume(volume: number): void {
        this.node.send({
            op: 'volume',
            guildId: this.guildId,
            volume: volume,
        });
    }

    /**
     * Called on track end
     * @param {Object} message The end reason
     * @private
     */
    onTrackEnd(message: {reason: string}) {
        if (message.reason !== 'REPLACED') {
            this.playing = false;
            this.lastTrack = this.track;
            this.track = null;
        }
        this.emit('end', message);
    }

    /**
     * Called on track exception
     * @param {Object} message The exception encountered
     * @private
     */
    onTrackException(message: object) {
        this.emit('error', message);
    }

    /**
     * Called on track stuck
     * @param {Object} message The message if exists
     * @private
     */
    onTrackStuck(message: object) {
        this.stop();
        process.nextTick(() => this.emit('end', message));
    }

    /**
     * Switch voice channel
     * @param {string} channelId Called when switching channels
     * @param {boolean} [reactive] Used if you want the bot to switch channels
     * @returns {void}
     */
    switchChannel(channelId: string, reactive?: boolean): void {
        if(this.channelId === channelId) {
            return;
        }

        this.channelId = channelId;
        if (reactive === true) {
            this.updateVoiceState(channelId);
        }
    }

    getTimestamp() {
        return Date.now() - this.timestamp;
    }

    /**
     * Update the bot's voice state
     * @param {boolean} selfMute Whether the bot muted itself or not (audio sending is unaffected)
     * @param {boolean} selfDeaf Whether the bot deafened itself or not (audio receiving is unaffected)
     * @private
     */
    updateVoiceState(channelId: string, selfMute?: boolean, selfDeaf?: boolean) {
        if (this.shard.sendWS) {
            this.shard.sendWS(Constants.GatewayOPCodes.VOICE_STATE_UPDATE, {
                guild_id: this.id === 'call' ? null : this.id,
                channel_id: channelId || null,
                self_mute: !!selfMute,
                self_deaf: !!selfDeaf,
            });
        }
    }
}

export default Player;
