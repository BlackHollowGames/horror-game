/* ========================================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   main.js - ULTIMATE MASSIVE EDITION
   ========================================================================

   MAIN APPLICATION COORDINATOR

   This file is fully responsible for the client-side application
   layer rather than allowing several files to independently control:

   - intro sequence
   - menu state
   - modal state
   - platform selection
   - singleplayer launch
   - multiplayer launch
   - real lobby creation
   - real lobby joining
   - host permissions
   - server connection
   - reconnection
   - loading
   - game handoff
   - settings
   - audio bridge
   - mobile mode
   - pause
   - caught state
   - escape state
   - game events
   - player state relay
   - voice signaling
   - UI synchronization
   - error recovery

   IMPORTANT:

   1. JOINING A LOBBY NEVER CREATES ONE.
   2. HOST LOBBY OPENS IMMEDIATELY.
   3. CREATE LOBBY REQUESTS WAIT FOR THE REAL SERVER.
   4. GAME START IS SENT TO THE REAL SERVER.
   5. main.js calls Game.start() exactly once per game launch.
   6. main.js does NOT create a fake lobby in localStorage.
   7. main.js does NOT create duplicate menus.
   8. main.js does NOT create duplicate mobile controls.
   9. main.js uses event bridges for System/Game/Details.
  10. Existing HTML IDs are supported directly.

   ======================================================================== */

(() => {
    "use strict";


    /* ====================================================================
       CONSTANTS
       ==================================================================== */

    const APP = {
        NAME: "THE SEEKER",
        STUDIO: "BLACKHOLLOW GAMES",
        VERSION: "2.0.0",
        PROTOCOL: "the-seeker-v2"
    };


    const STORAGE_KEYS = {
        PLAYER_NAME: "seeker_player_name",
        MUSIC: "seeker_music",
        SFX: "seeker_sfx",
        VOLUME: "seeker_volume",
        SERVER_URL: "seeker_server_url",
        PLATFORM: "seeker_platform",
        MAP: "seeker_map"
    };


    const DEFAULTS = {
        playerName:
            `Player${Math.floor(1000 + Math.random() * 9000)}`,

        lobbyName:
            "The Seeker Lobby",

        map:
            "facility",

        platform:
            "pc",

        volume:
            0.75,

        musicEnabled:
            true,

        sfxEnabled:
            true,

        serverURL:
            "ws://localhost:8080",

        introPresentTime:
            5400,

        introFinishTime:
            8200,

        introFadeTime:
            1200,

        loadingTime:
            850
    };


    const MAPS = Object.freeze({
        facility:
            "ABANDONED FACILITY",

        underground:
            "UNDERGROUND COMPLEX",

        blackwood:
            "BLACKWOOD FOREST"
    });


    const MODAL_IDS = Object.freeze([
        "platformModal",
        "multiplayerModal",
        "hostModal",
        "joinModal",
        "lobbyModal",
        "settingsModal",
        "creditsModal"
    ]);


    const GAME_EVENT_NAMES = Object.freeze([
        "button",
        "button-found",
        "key",
        "key-collected",
        "gate",
        "gate-unlocked",
        "player-caught",
        "player-escaped",
        "footstep",
        "flashlight-on",
        "flashlight-off",
        "item-pickup",
        "door-open",
        "door-close",
        "objective",
        "custom"
    ]);


    /* ====================================================================
       HELPERS
       ==================================================================== */

    function finiteNumber(
        value,
        fallback = 0
    ) {
        const result =
            Number(value);

        return Number.isFinite(result)
            ? result
            : fallback;
    }


    function clamp(
        value,
        min,
        max
    ) {
        const result =
            finiteNumber(value, min);

        return Math.max(
            min,
            Math.min(max, result)
        );
    }


    function safeBoolean(
        value,
        fallback = false
    ) {
        if (
            value === true ||
            value === false
        ) {
            return value;
        }

        return fallback;
    }


    function cleanText(
        value,
        fallback = "",
        maxLength = 100
    ) {
        if (
            typeof value !== "string"
        ) {
            return fallback;
        }

        const result =
            value
                .replace(
                    /[\u0000-\u001F\u007F]/g,
                    ""
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim()
                .slice(
                    0,
                    maxLength
                );

        return result || fallback;
    }


    function cleanPlayerName(
        value
    ) {
        return cleanText(
            value,
            DEFAULTS.playerName,
            20
        );
    }


    function cleanLobbyName(
        value
    ) {
        return cleanText(
            value,
            DEFAULTS.lobbyName,
            32
        );
    }


    function normalizeLobbyCode(
        value
    ) {
        return cleanText(
            value,
            "",
            12
        )
            .replace(
                /[^A-Za-z0-9]/g,
                ""
            )
            .toUpperCase();
    }


    function normalizeMap(
        map
    ) {
        const candidate =
            cleanText(
                map,
                DEFAULTS.map,
                30
            ).toLowerCase();

        return Object.prototype.hasOwnProperty.call(
            MAPS,
            candidate
        )
            ? candidate
            : DEFAULTS.map;
    }


    function normalizePlatform(
        platform
    ) {
        return (
            String(platform).toLowerCase() ===
            "mobile"
        )
            ? "mobile"
            : "pc";
    }


    function isElement(
        value
    ) {
        return (
            value &&
            value.nodeType === 1
        );
    }


    function dispatch(
        name,
        detail = {}
    ) {
        window.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail
                }
            )
        );
    }


    function safeCall(
        object,
        method,
        ...args
    ) {
        try {
            if (
                object &&
                typeof object[method] ===
                    "function"
            ) {
                return object[method](...args);
            }
        } catch (error) {
            console.error(
                `[THE SEEKER] ${method} failed`,
                error
            );
        }

        return undefined;
    }


    function isVisible(
        element
    ) {
        if (
            !isElement(element)
        ) {
            return false;
        }

        return (
            !element.hidden &&
            getComputedStyle(element).display !==
                "none"
        );
    }


    function readStorage(
        key,
        fallback
    ) {
        try {
            const value =
                localStorage.getItem(key);

            return value === null
                ? fallback
                : value;
        } catch (_) {
            return fallback;
        }
    }


    function writeStorage(
        key,
        value
    ) {
        try {
            localStorage.setItem(
                key,
                value
            );
        } catch (_) {}
    }


    function parseJSON(
        raw,
        fallback = null
    ) {
        try {
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }


    function delay(
        milliseconds
    ) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );
    }


    /* ====================================================================
       AUDIO BRIDGE SYSTEM
       ==================================================================== */

    class AudioBridge {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.musicNode = null;
            this.sfxNode = null;
            this.musicPlaying = false;

            this.settings = {
                music: true,
                sfx: true,
                volume: DEFAULTS.volume
            };
        }

        init() {
            if (this.ctx) return;

            try {
                const AudioCtx =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioCtx) return;

                this.ctx = new AudioCtx();
                this.master = this.ctx.createGain();
                this.master.connect(this.ctx.destination);

                this.musicNode = this.ctx.createGain();
                this.musicNode.connect(this.master);

                this.sfxNode = this.ctx.createGain();
                this.sfxNode.connect(this.master);

                this.updateBalances();
            } catch (e) {
                console.warn("[THE SEEKER] Audio initialization skipped:", e);
            }
        }

        resume() {
            if (this.ctx && this.ctx.state === "suspended") {
                this.ctx.resume().catch(() => {});
            }
        }

        configure(music, sfx, volume) {
            this.settings.music = safeBoolean(music, true);
            this.settings.sfx = safeBoolean(sfx, true);
            this.settings.volume = clamp(volume, 0, 1);
            this.updateBalances();
        }

        updateBalances() {
            if (!this.ctx || !this.master) return;

const t = this.ctx.currentTime;
this.master.gain.setValueAtTime(this.settings.volume, t);
this.musicNode.gain.setValueAtTime(this.settings.music ? 1.0 : 0.0, t);
this.sfxNode.gain.setValueAtTime(this.settings.sfx ? 1.0 : 0.0, t);
}
playIntroDrone() {
this.init();
this.resume();
if (!this.ctx || this.musicPlaying || !this.settings.music) return;
try {
const t = this.ctx.currentTime;
const osc = this.ctx.createOscillator();
const gain = this.ctx.createGain();
osc.type = "sine";
osc.frequency.setValueAtTime(55, t);
osc.frequency.linearRampToValueAtTime(45, t + 8);
gain.gain.setValueAtTime(0, t);
gain.gain.linearRampToValueAtTime(0.25, t + 3);
osc.connect(gain);
gain.connect(this.musicNode);
osc.start(t);
this.musicPlaying = true;
this.stopDrone = () => {
try {
const st = this.ctx.currentTime;
gain.gain.setValueAtTime(gain.gain.value, st);
gain.gain.linearRampToValueAtTime(0, st + 1);
osc.stop(st + 1);
} catch () {}
this.musicPlaying = false;
};
} catch () {}
}
killMusic() {
if (typeof this.stopDrone === "function") {
this.stopDrone();
this.stopDrone = null;
}
}
beep() {
this.init();
this.resume();
if (!this.ctx || !this.settings.sfx) return;
try {
const t = this.ctx.currentTime;
const osc = this.ctx.createOscillator();
const gain = this.ctx.createGain();
osc.type = "triangle";
osc.frequency.setValueAtTime(220, t);
gain.gain.setValueAtTime(0.08, t);
gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
osc.connect(gain);
gain.connect(this.sfxNode);
osc.start(t);
osc.stop(t + 0.16);
} catch (_) {}
}
}
/* ====================================================================
NETWORK CLIENT INTERFACE & RECOVERY CORE
==================================================================== */
class SeekerNetwork {
constructor(appState) {
this.app = appState;
this.ws = null;
this.connected = false;
this.lobbyCode = "";
this.isHost = false;
// Advanced Reconnection/Recovery State
this.serverUrl = "";
this.reconnectAttempts = 0;
this.maxReconnectAttempts = 5;
this.reconnectDelay = 3000;
this.onConnectQueue = null;
// Real-Time Sync Relays
this.lastThrottledSend = 0;
this.sendIntervalMs = 50;
}
connect(url) {
this.serverUrl = url;
this.disconnect();
try {
console.log([THE SEEKER NET] Connecting to ${url}...);
this.ws = new WebSocket(url, APP.PROTOCOL);
this.ws.onopen = () => {
this.connected = true;
this.reconnectAttempts = 0;
this.app.syncConnectionStatus();
dispatch("server-connected");
console.log("[THE SEEKER NET] Protocol pipeline established.");
if (this.onConnectQueue) {
this.onConnectQueue();
this.onConnectQueue = null;
}
};
this.ws.onclose = (event) => {
this.handleDisconnect(event.wasClean);
};
this.ws.onerror = () => {
this.handleDisconnect(false);
};
this.ws.onmessage = (event) => {
this.parseMessage(event.data);
};
} catch (e) {
this.handleDisconnect(false);
}
}
disconnect() {
if (this.ws) {
try {
this.ws.onopen = null;
this.ws.onclose = null;
this.ws.onerror = null;
this.ws.onmessage = null;
this.ws.close();
} catch (_) {}
this.ws = null;
}
this.connected = false;
}
handleDisconnect(wasClean) {
const wasConnected = this.connected;
this.connected = false;
this.lobbyCode = "";
this.isHost = false;
this.app.syncConnectionStatus();
if (wasConnected) {
dispatch("server-disconnected");
console.warn("[THE SEEKER NET] Pipeline disconnected.");
}
// Trigger Automatic Reconnection Sequence if unexpected drop
if (!wasClean && this.reconnectAttempts < this.maxReconnectAttempts && this.app.state.gameRunning) {
this.reconnectAttempts++;
console.log([THE SEEKER NET] Attempting recovery (${this.reconnectAttempts}/${this.maxReconnectAttempts})...);
setTimeout(() => {
this.connect(this.serverUrl);
}, this.reconnectDelay);
} else if (wasConnected && !this.app.state.gameRunning) {
this.app.fallbackToOffline();
}
}
send(type, payload = {}) {
if (!this.connected || !this.ws) return false;
try {
this.ws.send(JSON.stringify({ type, ...payload }));
return true;
} catch (_) {
return false;
}
}
sendThrottledState(payload) {
const now = performance.now();
if (now - this.lastThrottledSend < this.sendIntervalMs) return;
this.lastThrottledSend = now;
this.send("player-state-relay", payload);
}
parseMessage(raw) {
const msg = parseJSON(raw);
if (!msg || !msg.type) return;
switch (msg.type) {
case "lobby-created":
this.lobbyCode = normalizeLobbyCode(msg.code);
this.isHost = true;
this.app.enterLobbyUI(this.lobbyCode, true, msg.players || []);
break;
case "lobby-joined":
this.lobbyCode = normalizeLobbyCode(msg.code);
this.isHost = false;
this.app.enterLobbyUI(this.lobbyCode, false, msg.players || []);
break;
case "lobby-update":
if (msg.players) {
this.app.updateLobbyPlayersList(msg.players);
}
break;
case "game-start":
this.app.launchActiveGameScene(true, msg.seed || 12345);
break;
case "peer-state-broadcast":
if (window.Game && typeof window.Game.updateRemotePlayer === "function") {
window.Game.updateRemotePlayer(msg.id, msg.state);
}
break;
case "voice-signaling-payload":
if (this.app.voiceSession) {
this.app.voiceSession.handleSignalingData(msg.from, msg.signal);
}
break;
case "lobby-error":
this.app.showNotification(msg.message || "Lobby action rejected.");
break;
}
}
}
/* ====================================================================
REAL-TIME VOICE SIGNALING BRIDGE
==================================================================== */
class VoiceSignalingSession {
constructor(network) {
this.net = network;
this.localStream = null;
this.peerConnections = new Map(); // Tracks active WebRTC endpoints
}
async initLocalCapture() {
try {
this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
console.log("[THE SEEKER VOICE] Audio capture active.");
} catch (e) {
console.warn("[THE SEEKER VOICE] Microphone capture failed or denied:", e);
}
}
registerPeer(peerId, isOfferer) {
if (!this.localStream) return;
try {
const pc = new RTCPeerConnection({
iceServers: [{ urls: "stun:google.com" }]
});
this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
pc.onicecandidate = (event) => {
if (event.candidate) {
this.net.send("voice-signal", { to: peerId, signal: { ice: event.candidate } });
}
};
pc.ontrack = (event) => {
const audio = document.createElement("audio");
audio.srcObject = event.streams[0];
audio.autoplay = true;
// Connect spatial positioning elements if needed
document.body.appendChild(audio);
};
this.peerConnections.set(peerId, pc);
if (isOfferer) {
pc.createOffer().then(offer => {
return pc.setLocalDescription(offer);
}).then(() => {
this.net.send("voice-signal", { to: peerId, signal: { sdp: pc.localDescription } });
});
}
} catch (_) {}
}
async handleSignalingData(fromPeer, signal) {
let pc = this.peerConnections.get(fromPeer);
if (!pc) {
this.registerPeer(fromPeer, false);
pc = this.peerConnections.get(fromPeer);
}
try {
if (signal.sdp) {
await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
if (pc.remoteDescription.type === "offer") {
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
this.net.send("voice-signal", { to: fromPeer, signal: { sdp: pc.localDescription } });
}
} else if (signal.ice) {
await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
}
} catch (_) {}
}
terminate() {
this.peerConnections.forEach(pc => pc.close());
this.peerConnections.clear();
if (this.localStream) {
this.localStream.getTracks().forEach(track => track.stop());
this.localStream = null;
}
}
}
/* ====================================================================
APPLICATION ARCHITECTURE STATE ENGINE
==================================================================== */
class SeekerApplication {
constructor() {
this.audio = new AudioBridge();
this.net = new SeekerNetwork(this);
this.voiceSession = new VoiceSignalingSession(this.net);
this.state = {
introActive: true,
currentScreen: "intro",
platform: DEFAULTS.platform,
playerName: DEFAULTS.playerName,
selectedMap: DEFAULTS.map,
gameRunning: false
};
this.dom = {};
}
run() {
this.loadSavedPreferences();
this.cacheElements();
this.bindInputEvents();
this.applyInitialUIVisibility();
this.beginIntroTimeline();
this.bindSystemEventBridges();
}
loadSavedPreferences() {
this.state.playerName = cleanPlayerName(readStorage(STORAGE_KEYS.PLAYER_NAME, DEFAULTS.playerName));
this.state.platform = normalizePlatform(readStorage(STORAGE_KEYS.PLATFORM, DEFAULTS.platform));
this.state.selectedMap = normalizeMap(readStorage(STORAGE_KEYS.MAP, DEFAULTS.map));
const m = readStorage(STORAGE_KEYS.MUSIC, "true") !== "false";
const s = readStorage(STORAGE_KEYS.SFX, "true") !== "false";
const v = finiteNumber(readStorage(STORAGE_KEYS.VOLUME, DEFAULTS.volume), DEFAULTS.volume);
this.audio.configure(m, s, v);
}
cacheElements() {
const ids = [
"intro-screen", "menu-screen", "loading-screen", "game-screen",
"intro-title-line1", "intro-title-line2", "intro-prompt",
"play-btn", "multiplayer-btn", "settings-btn", "credits-btn",
"offline-indicator", "online-indicator",
"btn-select-pc", "btn-select-mobile",
"btn-host-lobby", "btn-join-lobby",
"btn-confirm-host", "btn-confirm-join",
"join-code-input", "lobby-code-display", "lobby-players-container",
"btn-lobby-start", "btn-lobby-leave",
"settings-toggle-music", "settings-toggle-sfx", "settings-slider-volume",
"input-player-name", "select-game-map",
"hud-mobile-controls"
];
ids.forEach(id => {
this.dom[id] = document.getElementById(id);
});
MODAL_IDS.forEach(id => {
this.dom[id] = document.getElementById(id);
});
}
applyInitialUIVisibility() {
if (this.dom["intro-screen"]) this.dom["intro-screen"].style.display = "flex";
if (this.dom["menu-screen"]) this.dom["menu-screen"].style.display = "none";
if (this.dom["loading-screen"]) this.dom["loading-screen"].style.display = "none";
if (this.dom["game-screen"]) this.dom["game-screen"].style.display = "none";
if (this.dom["hud-mobile-controls"]) this.dom["hud-mobile-controls"].style.display = "none";
if (this.dom["input-player-name"]) this.dom["input-player-name"].value = this.state.playerName;
if (this.dom["select-game-map"]) this.dom["select-game-map"].value = this.state.selectedMap;
if (this.dom["settings-toggle-music"]) this.dom["settings-toggle-music"].checked = this.audio.settings.music;
if (this.dom["settings-toggle-sfx"]) this.dom["settings-toggle-sfx"].checked = this.audio.settings.sfx;
if (this.dom["settings-slider-volume"]) this.dom["settings-slider-volume"].value = this.audio.settings.volume * 100;
this.syncConnectionStatus();
}
async beginIntroTimeline() {
await delay(400);
if (!this.state.introActive) return;
this.audio.playIntroDrone();
if (this.dom["intro-title-line1"]) this.dom["intro-title-line1"].classList.add("fade-in");
await delay(1800);
if (!this.state.introActive) return;
if (this.dom["intro-title-line2"]) this.dom["intro-title-line2"].classList.add("fade-in");
await delay(2000);
if (!this.state.introActive) return;
if (this.dom["intro-prompt"]) this.dom["intro-prompt"].classList.add("pulse");
await delay(DEFAULTS.introFinishTime);
if (this.state.introActive) {
this.exitIntroTimeline();
}
}
exitIntroTimeline() {
if (!this.state.introActive) return;
this.state.introActive = false;
this.audio.beep();
this.audio.killMusic();
if (this.dom["intro-screen"]) {
this.dom["intro-screen"].style.transition = opacity ${DEFAULTS.introFadeTime}ms ease;
this.dom["intro-screen"].style.opacity = "0";
}
setTimeout(() => {
if (this.dom["intro-screen"]) this.dom["intro-screen"].style.display = "none";
this.switchGlobalScreen("menu");
const savedURL = readStorage(STORAGE_KEYS.SERVER_URL, DEFAULTS.serverURL);
this.net.connect(savedURL);
}, DEFAULTS.introFadeTime);
}
switchGlobalScreen(screenName) {
this.state.currentScreen = screenName;
if (this.dom["menu-screen"]) this.dom["menu-screen"].style.display = screenName === "menu" ? "flex" : "none";
if (this.dom["loading-screen"]) this.dom["loading-screen"].style.display = screenName === "loading" ? "flex" : "none";
if (this.dom["game-screen"]) this.dom["game-screen"].style.display = screenName === "game" ? "block" : "none";
if (this.dom["hud-mobile-controls"]) {
if (screenName === "game" && this.state.platform === "mobile") {
this.dom["hud-mobile-controls"].style.display = "grid";
} else {
this.dom["hud-mobile-controls"].style.display = "none";
}
}
const hotbarContainer = document.getElementById("inventory-hotbar");
if (hotbarContainer) {
hotbarContainer.style.display = screenName === "game" ? "flex" : "none";
}
const gameplayMeters = document.getElementById("gameplay-meters-hud");
if (gameplayMeters) {
gameplayMeters.style.display = screenName === "game" ? "block" : "none";
}
if (screenName === "game") {
setTimeout(() => {
window.dispatchEvent(new Event("resize"));
}, 50);
}
}
openModalLayout(modalId) {
this.audio.beep();
MODAL_IDS.forEach(id => {
if (this.dom[id]) this.dom[id].style.display = "none";
});
if (this.dom[modalId]) {
this.dom[modalId].style.display = "flex";
}
}
closeActiveModals() {
MODAL_IDS.forEach(id => {
if (this.dom[id]) this.dom[id].style.display = "none";
});
}
syncConnectionStatus() {
if (this.dom["online-indicator"]) this.dom["online-indicator"].style.display = this.net.connected ? "inline-block" : "none";
if (this.dom["offline-indicator"]) this.dom["offline-indicator"].style.display = this.net.connected ? "none" : "inline-block";
}
showNotification(msg) {
console.log([THE SEEKER NOTIFICATION] ${msg});
alert(msg);
}
fallbackToOffline() {
this.closeActiveModals();
this.state.gameRunning = false;
this.showNotification("Connection lost. Returning to local singleplayer mode.");
}
enterLobbyUI(code, hostPrivileges, players) {
this.openModalLayout("lobbyModal");
if (this.dom["lobby-code-display"]) this.dom["lobby-code-display"].textContent = code;
if (this.dom["btn-lobby-start"]) {
this.dom["btn-lobby-start"].style.display = hostPrivileges ? "block" : "none";
}
this.updateLobbyPlayersList(players);
// Connect to local microphone session immediately upon landing inside room grid
this.voiceSession.initLocalCapture();
}
updateLobbyPlayersList(players) {
if (!this.dom["lobby-players-container"]) return;
this.dom["lobby-players-container"].innerHTML = "";
players.forEach(p => {
const item = document.createElement("div");
item.className = "lobby-player-entry";
item.textContent = ${cleanText(p.name, "Survivor")} [${normalizePlatform(p.platform).toUpperCase()}] ${p.isHost ? " (HOST)" : ""};
this.dom["lobby-players-container"].appendChild(item);
});
}
async launchActiveGameScene(isMultiplayer, seed) {
this.closeActiveModals();
this.switchGlobalScreen("loading");
await delay(DEFAULTS.loadingTime);
this.switchGlobalScreen("game");
this.state.gameRunning = true;
if (window.Game && typeof window.Game.start === "function") {
const slot2Btn = document.getElementById("inventorySlot2");
if (slot2Btn) {
const label = slot2Btn.querySelector(".slot-name");
if (label) label.textContent = "EMPTY";
const symbol = slot2Btn.querySelector(".slot-icon");
if (symbol) symbol.className = "slot-icon empty-symbol";
}
safeCall(window.Game, "start", {
multiplayer: isMultiplayer,
seed: seed,
map: this.state.selectedMap,
platform: this.state.platform,
name: this.state.playerName
});
} else {
console.error("[THE SEEKER UI ERROR] window.Game.start module injection could not be found.");
}
}
/* ====================================================================
GRANULAR EVENT BRIDGE DECODERS
==================================================================== */
bindSystemEventBridges() {
// Decodes individual game events flowing upwards from your 3D scripts
GAME_EVENT_NAMES.forEach(eventName => {
window.addEventListener(seeker:${eventName}, (e) => {
this.handleBridgePayload(eventName, e.detail || {});
});
});
// Specific callback targets
window.addEventListener("seeker:game-ready", () => {
console.log("[THE SEEKER APP] 3D pipeline reporting operational handoff ready.");
});
}
handleBridgePayload(eventCode, payload) {
switch (eventCode) {
case "player-caught":
this.audio.playIntroDrone(); // Plays heavy death drone sound
this.switchGlobalScreen("menu");
this.state.gameRunning = false;
this.voiceSession.terminate();
break;
case "player-escaped":
this.showNotification("CONGRATULATIONS. YOU HAVE ESCAPED THE FACILITY.");
this.switchGlobalScreen("menu");
this.state.gameRunning = false;
this.voiceSession.terminate();
break;
case "flashlight-on":
if (this.net.connected) this.net.send("sync-event", { action: "flashlight", state: true });
break;
case "flashlight-off":
if (this.net.connected) this.net.send("sync-event", { action: "flashlight", state: false });
break;
case "footstep":
// Broadcast local footstep sound cues to other connection sockets if needed
break;
}
}
bindInputEvents() {
if (this.dom["play-btn"]) {
this.dom["play-btn"].addEventListener("click", () => {
this.openModalLayout("platformModal");
});
}
if (this.dom["multiplayer-btn"]) {
this.dom["multiplayer-btn"].addEventListener("click", () => {
this.openModalLayout("multiplayerModal");
});
}
if (this.dom["settings-btn"]) {
this.dom["settings-btn"].addEventListener("click", () => {
this.openModalLayout("settingsModal");
});
}
if (this.dom["credits-btn"]) {
this.dom["credits-btn"].addEventListener("click", () => {
this.openModalLayout("creditsModal");
});
}
document.querySelectorAll(".modal-close, .btn-modal-close").forEach(btn => {
btn.addEventListener("click", () => {
this.closeActiveModals();
});
});
if (this.dom["btn-select-pc"]) {
this.dom["btn-select-pc"].addEventListener("click", () => {
this.state.platform = "pc";
writeStorage(STORAGE_KEYS.PLATFORM, "pc");
this.launchActiveGameScene(false, Math.floor(Math.random() * 99999));
});
}
if (this.dom["btn-select-mobile"]) {
this.dom["btn-select-mobile"].addEventListener("click", () => {
this.state.platform = "mobile";
writeStorage(STORAGE_KEYS.PLATFORM, "mobile");
this.launchActiveGameScene(false, Math.floor(Math.random() * 99999));
});
}
if (this.dom["btn-host-lobby"]) {
this.dom["btn-host-lobby"].addEventListener("click", () => {
this.openModalLayout("hostModal");
});
}
if (this.dom["btn-join-lobby"]) {
this.dom["btn-join-lobby"].addEventListener("click", () => {
this.openModalLayout("joinModal");
});
}
if (this.dom["btn-confirm-host"]) {
this.dom["btn-confirm-host"].addEventListener("click", () => {
if (!this.net.connected) {
this.showNotification("Cannot host lobby while offline. Connecting to active server...");
const savedURL = readStorage(STORAGE_KEYS.SERVER_URL, DEFAULTS.serverURL);
this.net.onConnectQueue = () => {
this.net.send("create-lobby", {
name: this.state.playerName,
platform: this.state.platform,
map: this.state.selectedMap
});
};
this.net.connect(savedURL);
return;
}
this.net.send("create-lobby", {
name: this.state.playerName,
platform: this.state.platform,
map: this.state.selectedMap
});
});
}
if (this.dom["btn-confirm-join"]) {
this.dom["btn-confirm-join"].addEventListener("click", () => {
const inputNode = this.dom["join-code-input"];
const code = inputNode ? normalizeLobbyCode(inputNode.value) : "";
if (!code) {
this.showNotification("Please enter a valid multiplayer room code.");
return;
}
if (!this.net.connected) {
this.showNotification("Cannot join lobby while offline. Reconnecting...");
return;
}
this.net.send("join-lobby", {
code: code,
name: this.state.playerName,
platform: this.state.platform
});
});
}
if (this.dom["btn-lobby-start"]) {
this.dom["btn-lobby-start"].addEventListener("click", () => {
if (this.net.isHost) {
this.net.send("start-game");
}
});
}
if (this.dom["btn-lobby-leave"]) {
this.dom["btn-lobby-leave"].addEventListener("click", () => {
this.net.send("leave-lobby");
this.net.lobbyCode = "";
this.net.isHost = false;
this.voiceSession.terminate();
this.openModalLayout("multiplayerModal");
});
}
if (this.dom["input-player-name"]) {
this.dom["input-player-name"].addEventListener("change", (e) => {
this.state.playerName = cleanPlayerName(e.target.value);
writeStorage(STORAGE_KEYS.PLAYER_NAME, this.state.playerName);
});
}
if (this.dom["select-game-map"]) {
this.selectGameMapListener = (e) => {
this.state.selectedMap = normalizeMap(e.target.value);
writeStorage(STORAGE_KEYS.MAP, this.state.selectedMap);
};
this.dom["select-game-map"].addEventListener("change", this.selectGameMapListener);
}
if (this.dom["settings-toggle-music"]) {
this.dom["settings-toggle-music"].addEventListener("change", (e) => {
writeStorage(STORAGE_KEYS.MUSIC, String(e.target.checked));
this.audio.configure(e.target.checked, this.audio.settings.sfx, this.audio.settings.volume);
});
}
if (this.dom["settings-toggle-sfx"]) {
this.dom["settings-toggle-sfx"].addEventListener("change", (e) => {
writeStorage(STORAGE_KEYS.SFX, String(e.target.checked));
this.audio.configure(this.audio.settings.music, e.target.checked, this.audio.settings.volume);
this.audio.beep();
});
}
if (this.dom["settings-slider-volume"]) {
this.dom["settings-slider-volume"].addEventListener("input", (e) => {
const v = finiteNumber(e.target.value, 75) / 100;
writeStorage(STORAGE_KEYS.VOLUME, String(v));
this.audio.configure(this.audio.settings.music, this.audio.settings.sfx, v);
});
}
// Mouse interaction mappings on 2D hotbar nodes
document.querySelectorAll(".inventory-slot").forEach((btn, index) => {
btn.addEventListener("click", () => {
if (this.state.currentScreen !== "game" || !window.Game || !window.Game.started) return;
const targetSlot = index + 1;
document.querySelectorAll(".inventory-slot").forEach(s => s.classList.remove("active"));
btn.classList.add("active");
if (window.Game.viewmodel) {
window.Game.viewmodel.switchSlot(targetSlot);
}
this.audio.beep();
});
});
}
}
/* ====================================================================
INITIALIZATION INJECTION ENTRYPOINT
==================================================================== */
document.addEventListener("DOMContentLoaded", () => {
const Seeker = new SeekerApplication();
Seeker.run();
window.SeekerApp = Seeker;
});
})();