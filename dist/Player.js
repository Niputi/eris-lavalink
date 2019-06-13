"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const eris_1 = require("eris");
const events_1 = require("events");
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
class Player extends events_1.EventEmitter {
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
    constructor(id, options) {
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
            let event = this.sendQueue.splice(0, 1);
            this.sendEvent(event[0]);
        }
    }
    /**
     * Queue an event to be sent to Lavalink
     * @param {*} data The payload to queue
     * @private
     */
    queueEvent(data) {
        if (this.sendQueue.length > 0) {
            this.sendQueue.push(data);
        }
        else {
            return this.sendEvent(data);
        }
    }
    /**
     * Send a payload to Lavalink
     * @param {*} data The payload to send
     * @private
     */
    async sendEvent(data) {
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
    connect(data) {
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
    disconnect(msg) {
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
    setEQ(options) {
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
    play(track, options) {
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
    stop() {
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
    stateUpdate(state) {
        this.state = state;
    }
    /**
     * Used to pause/resume the player
     * @param {boolean} pause Set pause to true/false
     * @returns {void}
     */
    setPause(pause) {
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
            this.setPause(false);
        }
    }
    /**
     * Used for seeking to a track position
     * @param {number} position The position to seek to
     * @returns {void}
     */
    seek(position) {
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
    setVolume(volume) {
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
    onTrackEnd(message) {
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
    onTrackException(message) {
        this.emit('error', message);
    }
    /**
     * Called on track stuck
     * @param {Object} message The message if exists
     * @private
     */
    onTrackStuck(message) {
        this.stop();
        process.nextTick(() => this.emit('end', message));
    }
    /**
     * Switch voice channel
     * @param {string} channelId Called when switching channels
     * @param {boolean} [reactive] Used if you want the bot to switch channels
     * @returns {void}
     */
    switchChannel(channelId, reactive) {
        if (this.channelId === channelId) {
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
    updateVoiceState(channelId, selfMute, selfDeaf) {
        if (this.shard.sendWS) {
            this.shard.sendWS(eris_1.Constants.GatewayOPCodes.VOICE_STATE_UPDATE, {
                guild_id: this.id === 'call' ? null : this.id,
                channel_id: channelId || null,
                self_mute: !!selfMute,
                self_deaf: !!selfDeaf,
            });
        }
    }
}
exports.default = Player;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGxheWVyLmpzIiwic291cmNlUm9vdCI6Ii4vc3JjLyIsInNvdXJjZXMiOlsiUGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsK0JBQXdDO0FBQ3hDLG1DQUFzQztBQUt0Qzs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILE1BQU0sTUFBTyxTQUFRLHFCQUFZO0lBbUI3Qjs7Ozs7Ozs7Ozs7T0FXRztJQUNILFlBQVksRUFBVSxFQUFFLE9BQXVJO1FBQzNKLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDYixJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUMvQixJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFDbkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQztRQUN2QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDL0IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDckIsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFDcEIsSUFBSSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQzNCLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7O09B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