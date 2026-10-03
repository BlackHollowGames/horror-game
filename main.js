/* =================================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   MAIN GAME CONTROLLER

   This file controls:
   - Startup
   - BlackHollow Games splash
   - Loading
   - Main menu
   - PC / Mobile selection
   - Multiplayer navigation
   - Lobby creation UI
   - Lobby waiting room
   - Settings
   - Credits
   - Game loading
   - Game HUD initialization
   - Pause / resume
   - Death / victory flow
   - Input foundation
   - Audio foundation
   - Communication with game.js
   - Communication with details.js
   - Communication with systems.js

   The larger gameplay systems are intentionally designed to connect
   through window.SeekerGame, window.SeekerDetails and
   window.SeekerSystems when those files are added.
================================================================= */

"use strict";

/* ================================================================
   GLOBAL CONFIGURATION
================================================================ */

const SEEKER_CONFIG = Object.freeze({
    name: "THE SEEKER",
    studio: "BLACKHOLLOW GAMES",
    version: "1.0.0",
    build: "1.0.0",

    splashDuration: 3200,
    minimumLoadingDuration: 1600,

    preparationMinutes: 3,
    preparationSeconds: 180,

    defaultMode: "pc",

    defaultSettings: {
        graphicsQuality: "high",
        shadowQuality: "high",

        ambientEffects: true,
        cameraShake: true,

        masterVolume: 500,
        musicVolume: 70,
        sfxVolume: 85,

        voiceVolumeEnabled: true,

        subtitles: true,
        minimapEnabled: true,
        hintsEnabled: true,

        reducedMotion: false,
        highContrast: false,
        flashEffects: true
    },

    maps: {
        facility: {
            name: "THE FACILITY",
            description: "A sealed complex buried beneath the surface.",
            maxPlayers: 8
        },

        underground: {
            name: "THE UNDERGROUND",
            description: "A network of tunnels with no visible exit.",
            maxPlayers: 8
        },

        outskirts: {
            name: "THE OUTSKIRTS",
            description: "The abandoned grounds surrounding the complex.",
            maxPlayers: 8
        }
    }
});

/* ================================================================
   APPLICATION STATE
================================================================ */

const state = {
    initialized: false,

    currentScreen: "studioSplash",

    previousScreen: null,

    mode: "pc",

    gameRunning: false,
    gamePaused: false,

    gameOver: false,
    gameWon: false,

    preparationActive: false,
    preparationRemaining: SEEKER_CONFIG.preparationSeconds,

    selectedMap: "facility",

    selectedLobby: null,

    lobby: {
        active: false,
        hosted: false,
        private: false,
        code: "",
        name: "UNTITLED LOBBY",
        maxPlayers: 4,
        players: [],
        ready: false,
        voiceChat: true
    },

    objectives: {
        button1: false,
        button2: false,
        button3: false,
        keyFound: false,
        gateUnlocked: false
    },

    settings: structuredClone(SEEKER_CONFIG.defaultSettings),

    input: {
        keys: new Set(),

        mouseX: 0,
        mouseY: 0,

        mouseDeltaX: 0,
        mouseDeltaY: 0,

        pointerLocked: false,

        joystickActive: false,
        joystickX: 0,
        joystickY: 0,

        run: false,
        crouch: false
    },

    player: {
        x: 0,
        y: 0,
        z: 0,

        health: 100,

        speed: 1,
        sprinting: false,
        crouching: false,

        direction: 0
    },

    seeker: {
        active: false,
        x: 0,
        y: 0,
        z: 0,

        distance: Infinity,

        awareness: 0,
        intensity: 0,

        lastKnownPlayerX: 0,
        lastKnownPlayerY: 0,
        lastKnownPlayerZ: 0
    },

    audio: {
        initialized: false,

        master: null,
        music: null,
        sfx: null,

        context: null,

        muted: false,

        currentMusic: null
    },

    timers: {
        splash: null,
        loading: null,
        preparation: null,
        game: null,

        notification: null
    },

    lobbySimulation: {
        refreshTimer: null,
        fakeLobbies: []
    },

    notifications: [],

    diagnostics: {
        errors: [],
        warnings: [],
        startupTime: 0
    }
};

/* ================================================================
   DOM CACHE
================================================================ */

const DOM = {};

/**
 * Cache all important interface elements.
 */
function cacheDOM() {
    const ids = [
        "app",

        "studioSplash",
        "loadingScreen",
        "loadingProgress",
        "loadingPercent",
        "loadingText",
        "loadingState",

        "mainMenu",
        "playButton",
        "multiplayerButton",
        "settingsButton",
        "creditsButton",
        "buildVersion",
        "connectionStatus",

        "modeScreen",
        "pcModeButton",
        "mobileModeButton",
        "selectedModeText",
        "continueModeButton",

        "multiplayerScreen",
        "hostLobbyButton",
        "joinLobbyButton",
        "refreshLobbiesButton",
        "lobbyCodeInput",
        "connectLobbyButton",
        "lobbyMessage",
        "lobbyList",

        "hostScreen",
        "hostNameInput",
        "playerLimitSelect",
        "mapSelect",
        "voiceChatToggle",
        "privateLobbyToggle",
        "createLobbyButton",

        "previewMapName",
        "previewPlayerCount",
        "previewVoiceState",

        "waitingRoomScreen",
        "waitingLobbyName",
        "displayLobbyCode",
        "copyLobbyCodeButton",
        "waitingPlayerCount",
        "waitingPlayerList",
        "waitingMap",
        "waitingLimit",
        "waitingVoice",
        "readyButton",
        "startGameButton",
        "leaveLobbyButton",

        "settingsScreen",
        "resetSettingsButton",
        "settingsSavedMessage",

        "graphicsQuality",
        "shadowQuality",
        "ambientEffects",
        "cameraShake",

        "masterVolume",
        "masterVolumeValue",
        "musicVolume",
        "musicVolumeValue",
        "sfxVolume",
        "sfxVolumeValue",
        "voiceVolumeEnabled",

        "subtitles",
        "minimapEnabled",
        "hintsEnabled",

        "reducedMotion",
        "highContrast",
        "flashEffects",

        "creditsScreen",

        "gameLoadingScreen",
        "gameLoadingBuild",
        "gameLoadingTitle",
        "gameLoadingDescription",
        "gameLoadingProgress",
        "gameLoadingPercent",
        "gameLoadingStatus",

        "gameScreen",
        "gameCanvas",
        "gameCanvasContainer",

        "objectiveText",
        "objectiveSubtext",
        "prepTimer",

        "minimap",
        "minimapPlayer",
        "minimapSeeker",
        "minimapStatus",

        "centerNotification",
        "notificationSmall",
        "notificationText",

        "interactionPrompt",
        "interactionTitle",
        "interactionDescription",

        "threatIndicator",
        "threatText",

        "voiceChatHud",
        "voicePlayerList",

        "conditionFill",
        "conditionValue",

        "pcControls",
        "mobileControls",
        "mobileJoystick",
        "joystickKnob",
        "mobileInteract",
        "mobileRun",
        "mobileCrouch",

        "pauseOverlay",
        "resumeButton",
        "pauseSettingsButton",
        "quitGameButton",

        "deathOverlay",
        "deathTitle",
        "deathDescription",
        "retryButton",
        "deathMenuButton",

        "winOverlay",
        "winTime",
        "winButtons",
        "winPlayers",
        "winMenuButton",

        "errorOverlay",
        "errorMessage",
        "errorRetryButton",
        "errorCloseButton"
    ];

    for (const id of ids) {
        DOM[id] = document.getElementById(id);
    }

    DOM.settingsTabs = Array.from(
        document.querySelectorAll("[data-settings-tab]")
    );

    DOM.settingsPages = Array.from(
        document.querySelectorAll("[data-settings-page]")
    );

    DOM.backButtons = Array.from(
        document.querySelectorAll("[data-back]")
    );

    DOM.objectiveItems = Array.from(
        document.querySelectorAll(".objective-item")
    );
}

/* ================================================================
   UTILITY FUNCTIONS
================================================================ */

/**
 * Safely clamp a number.
 */
function clamp(value, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return min;
    }

    return Math.min(max, Math.max(min, number));
}

/**
 * Return a safe string.
 */
function safeString(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim();
}

/**
 * Generate a simple lobby code.
 */
function generateLobbyCode(length = 6) {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let output = "";

    for (let i = 0; i < length; i += 1) {
        const index = Math.floor(
            Math.random() * characters.length
        );

        output += characters[index];
    }

    return output;
}

/**
 * Format seconds as MM:SS.
 */
function formatTime(totalSeconds) {
    const seconds = Math.max(
        0,
        Math.floor(Number(totalSeconds) || 0)
    );

    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainder).padStart(2, "0")
    );
}

/**
 * Small async delay.
 */
function delay(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

/**
 * Check whether an element exists.
 */
function exists(element) {
    return Boolean(element);
}

/**
 * Safely set text content.
 */
function setText(element, value) {
    if (!element) {
        return;
    }

    element.textContent = String(value);
}

/**
 * Add a CSS class safely.
 */
function addClass(element, className) {
    if (element) {
        element.classList.add(className);
    }
}

/**
 * Remove a CSS class safely.
 */
function removeClass(element, className) {
    if (element) {
        element.classList.remove(className);
    }
}

/**
 * Toggle a CSS class safely.
 */
function toggleClass(element, className, force) {
    if (element) {
        element.classList.toggle(className, force);
    }
}

/* ================================================================
   SCREEN MANAGEMENT
================================================================ */

/**
 * Return a screen by ID.
 */
function getScreen(id) {
    return document.getElementById(id);
}

/**
 * Show one screen and hide all others.
 */
function showScreen(id, options = {}) {
    const {
        remember = true,
        immediate = false
    } = options;

    const target = getScreen(id);

    if (!target) {
        reportError(
            `Screen "${id}" could not be found.`,
            "screen"
        );

        return false;
    }

    if (state.currentScreen === id && !immediate) {
        return true;
    }

    if (remember && state.currentScreen) {
        state.previousScreen = state.currentScreen;
    }

    const screens = document.querySelectorAll(".screen");

    screens.forEach((screen) => {
        screen.classList.remove("active");
    });

    if (immediate) {
        target.classList.add("active");
    } else {
        requestAnimationFrame(() => {
            target.classList.add("active");
        });
    }

    state.currentScreen = id;

    return true;
}

/**
 * Return to a known screen.
 */
function goBackTo(id) {
    if (!id) {
        return;
    }

    showScreen(id);
}

/* ================================================================
   SPLASH
================================================================ */

/**
 * Start the BlackHollow Games presentation.
 */
async function startStudioSplash() {
    const splash = DOM.studioSplash;

    if (!splash) {
        startLoadingScreen();

        return;
    }

    showScreen(
        "studioSplash",
        {
            remember: false,
            immediate: true
        }
    );

    await delay(SEEKER_CONFIG.splashDuration);

    splash.classList.add("splash-exit");

    await delay(650);

    splash.classList.remove("active");
    splash.classList.remove("splash-exit");

    startLoadingScreen();
}

/* ================================================================
   LOADING
================================================================ */

/**
 * Load the application interface.
 */
async function startLoadingScreen() {
    showScreen(
        "loadingScreen",
        {
            remember: false,
            immediate: true
        }
    );

    const start = performance.now();

    const stages = [
        {
            progress: 8,
            text: "CHECKING SYSTEM...",
            state: "SYSTEM STARTUP"
        },
        {
            progress: 18,
            text: "INITIALIZING RENDERER...",
            state: "GRAPHICS"
        },
        {
            progress: 31,
            text: "LOADING INTERFACE...",
            state: "USER INTERFACE"
        },
        {
            progress: 44,
            text: "PREPARING AUDIO...",
            state: "AUDIO"
        },
        {
            progress: 58,
            text: "PREPARING WORLD SYSTEMS...",
            state: "WORLD"
        },
        {
            progress: 72,
            text: "CHECKING GAME MODULES...",
            state: "GAME SYSTEMS"
        },
        {
            progress: 86,
            text: "VERIFYING SESSION...",
            state: "SESSION"
        },
        {
            progress: 96,
            text: "ALMOST READY...",
            state: "FINAL CHECK"
        },
        {
            progress: 100,
            text: "READY.",
            state: "COMPLETE"
        }
    ];

    for (const stage of stages) {
        updateLoadingProgress(
            stage.progress,
            stage.text,
            stage.state
        );

        await delay(
            SEEKER_CONFIG.minimumLoadingDuration /
            stages.length
        );
    }

    const elapsed = performance.now() - start;

    if (elapsed < 700) {
        await delay(700 - elapsed);
    }

    initializeMainMenu();
}

/**
 * Update loading UI.
 */
function updateLoadingProgress(progress, text, status) {
    const safeProgress = clamp(progress, 0, 100);

    if (DOM.loadingProgress) {
        DOM.loadingProgress.style.width = `${safeProgress}%`;
    }

    setText(
        DOM.loadingPercent,
        `${Math.round(safeProgress)}%`
    );

    setText(DOM.loadingText, text);
    setText(DOM.loadingState, status);
}

/* ================================================================
   MAIN MENU
================================================================ */

/**
 * Initialize menu values.
 */
function initializeMainMenu() {
    setText(
        DOM.buildVersion,
        SEEKER_CONFIG.version
    );

    setText(
        DOM.connectionStatus,
        "LOCAL SYSTEM READY"
    );

    showScreen(
        "mainMenu",
        {
            remember: false
        }
    );
}

/**
 * Handle Play.
 */
function openPlayMenu() {
    resetTransientGameState();

    showScreen("modeScreen");
}

/**
 * Handle Multiplayer.
 */
function openMultiplayer() {
    showScreen("multiplayerScreen");

    refreshLobbyList();
}

/**
 * Handle Settings.
 */
function openSettings() {
    showScreen("settingsScreen");

    applySettingsToUI();
}

/**
 * Handle Credits.
 */
function openCredits() {
    showScreen("creditsScreen");
}

/* ================================================================
   MODE SELECTION
================================================================ */

/**
 * Select PC mode.
 */
function selectPCMode() {
    state.mode = "pc";

    toggleClass(
        DOM.pcModeButton,
        "selected",
        true
    );

    toggleClass(
        DOM.mobileModeButton,
        "selected",
        false
    );

    setText(
        DOM.selectedModeText,
        "PC CONFIGURATION SELECTED"
    );

    document.body.classList.remove("mobile-mode");
    document.body.classList.add("pc-mode");
}

/**
 * Select Mobile mode.
 */
function selectMobileMode() {
    state.mode = "mobile";

    toggleClass(
        DOM.pcModeButton,
        "selected",
        false
    );

    toggleClass(
        DOM.mobileModeButton,
        "selected",
        true
    );

    setText(
        DOM.selectedModeText,
        "MOBILE CONFIGURATION SELECTED"
    );

    document.body.classList.remove("pc-mode");
    document.body.classList.add("mobile-mode");
}

/**
 * Continue from mode selection.
 */
function continueFromMode() {
    state.selectedMap = "facility";

    beginGameLoading({
        map: state.selectedMap,
        mode: state.mode,
        multiplayer: false
    });
}

/* ================================================================
   MULTIPLAYER
================================================================ */

/**
 * Generate simulated public lobby data.
 *
 * This is only a frontend foundation. The actual online networking
 * layer belongs in systems.js.
 */
function generateFakeLobbies() {
    const names = [
        "NIGHT WATCH",
        "LAST LIGHT",
        "NO SIGNAL",
        "HOLLOW RUN",
        "DEEP SEARCH",
        "DARK HOUR"
    ];

    const maps = [
        "facility",
        "underground",
        "outskirts"
    ];

    const count = Math.floor(
        Math.random() * 3
    );

    const lobbies = [];

    for (let i = 0; i < count; i += 1) {
        const name = names[
            Math.floor(Math.random() * names.length)
        ];

        const map = maps[
            Math.floor(Math.random() * maps.length)
        ];

        const maxPlayers = 4;

        const players =
            1 +
            Math.floor(
                Math.random() * maxPlayers
            );

        lobbies.push({
            id: `public-${Date.now()}-${i}`,
            name,
            map,
            players,
            maxPlayers,
            voiceChat: true
        });
    }

    return lobbies;
}

/**
 * Refresh public lobbies.
 */
function refreshLobbyList() {
    if (!DOM.lobbyList) {
        return;
    }

    DOM.lobbyList.innerHTML = "";

    const lobbies = generateFakeLobbies();

    state.lobbySimulation.fakeLobbies = lobbies;

    if (lobbies.length === 0) {
        const empty = document.createElement("div");

        empty.className = "empty-lobby-state";

        empty.innerHTML = `
            <span class="empty-icon">—</span>
            <strong>NO PUBLIC LOBBIES</strong>
            <small>Host a lobby to begin.</small>
        `;

        DOM.lobbyList.appendChild(empty);

        return;
    }

    for (const lobby of lobbies) {
        const row = createLobbyRow(lobby);

        DOM.lobbyList.appendChild(row);
    }
}

/**
 * Create a lobby row.
 */
function createLobbyRow(lobby) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "lobby-action-card";

    const mapName =
        SEEKER_CONFIG.maps[lobby.map]?.name ||
        lobby.map.toUpperCase();

    button.innerHTML = `
        <span class="lobby-action-icon">◎</span>

        <div>
            <strong>${escapeHTML(lobby.name)}</strong>
            <small>
                ${escapeHTML(mapName)}
                · ${lobby.players}/${lobby.maxPlayers}
                · VOICE
            </small>
        </div>

        <span>›</span>
    `;

    button.addEventListener(
        "click",
        () => {
            joinPublicLobby(lobby);
        }
    );

    return button;
}

/**
 * Escape HTML before inserting text into generated UI.
 */
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * Open Host Lobby.
 */
function openHostLobby() {
    if (DOM.hostNameInput) {
        DOM.hostNameInput.value = "";
    }

    if (DOM.playerLimitSelect) {
        DOM.playerLimitSelect.value = "4";
    }

    if (DOM.mapSelect) {
        DOM.mapSelect.value = "facility";
    }

    if (DOM.voiceChatToggle) {
        DOM.voiceChatToggle.checked = true;
    }

    if (DOM.privateLobbyToggle) {
        DOM.privateLobbyToggle.checked = false;
    }

    updateHostPreview();

    showScreen("hostScreen");
}

/**
 * Open Join Lobby.
 */
function openJoinLobby() {
    showScreen("multiplayerScreen");

    if (DOM.lobbyCodeInput) {
        DOM.lobbyCodeInput.focus();
    }

    setLobbyMessage(
        "Enter a lobby code to connect.",
        "normal"
    );
}

/**
 * Create a local lobby foundation.
 */
function createLobby() {
    const name =
        safeString(
            DOM.hostNameInput?.value,
            ""
        ) || "UNTITLED LOBBY";

    const maxPlayers = clamp(
        Number(DOM.playerLimitSelect?.value || 4),
        2,
        8
    );

    const map =
        DOM.mapSelect?.value ||
        "facility";

    const voiceChat =
        Boolean(
            DOM.voiceChatToggle?.checked
        );

    const privateLobby =
        Boolean(
            DOM.privateLobbyToggle?.checked
        );

    state.lobby = {
        active: true,
        hosted: true,
        private: privateLobby,
        code: generateLobbyCode(6),
        name,
        maxPlayers,
        players: [
            {
                id: "local-player",
                name: "HOST",
                ready: true,
                host: true
            }
        ],
        ready: true,
        voiceChat
    };

    state.selectedMap = map;

    updateWaitingRoom();

    showScreen("waitingRoomScreen");
}

/**
 * Join a fake public lobby.
 */
function joinPublicLobby(lobby) {
    state.lobby = {
        active: true,
        hosted: false,
        private: false,
        code: generateLobbyCode(6),
        name: lobby.name,
        maxPlayers: lobby.maxPlayers,
        players: [
            {
                id: "local-player",
                name: "PLAYER",
                ready: false,
                host: false
            },
            {
                id: "remote-player",
                name: "HOST",
                ready: true,
                host: true
            }
        ],
        ready: false,
        voiceChat: lobby.voiceChat
    };

    state.selectedMap = lobby.map;

    updateWaitingRoom();

    showScreen("waitingRoomScreen");
}

/**
 * Attempt lobby-code connection.
 */
function connectToLobby() {
    const code = safeString(
        DOM.lobbyCodeInput?.value,
        ""
    ).toUpperCase();

    if (code.length < 4) {
        setLobbyMessage(
            "Enter a valid lobby code.",
            "error"
        );

        return;
    }

    state.lobby = {
        active: true,
        hosted: false,
        private: true,
        code,
        name: "CONNECTED SESSION",
        maxPlayers: 4,
        players: [
            {
                id: "local-player",
                name: "PLAYER",
                ready: false,
                host: false
            }
        ],
        ready: false,
        voiceChat: true
    };

    state.selectedMap = "facility";

    setLobbyMessage(
        "Connected.",
        "success"
    );

    updateWaitingRoom();

    window.setTimeout(() => {
        showScreen("waitingRoomScreen");
    }, 250);
}

/**
 * Update lobby message.
 */
function setLobbyMessage(message, type = "normal") {
    if (!DOM.lobbyMessage) {
        return;
    }

    DOM.lobbyMessage.classList.remove(
        "error",
        "success"
    );

    if (type === "error") {
        DOM.lobbyMessage.classList.add("error");
    }

    if (type === "success") {
        DOM.lobbyMessage.classList.add("success");
    }

    DOM.lobbyMessage.textContent = message;
}

/**
 * Update host preview.
 */
function updateHostPreview() {
    const map =
        DOM.mapSelect?.value ||
        "facility";

    const mapName =
        SEEKER_CONFIG.maps[map]?.name ||
        map.toUpperCase();

    const playerCount =
        Number(DOM.playerLimitSelect?.value || 4);

    const voice =
        Boolean(DOM.voiceChatToggle?.checked);

    setText(
        DOM.previewMapName,
        mapName
    );

    setText(
        DOM.previewPlayerCount,
        playerCount
    );

    setText(
        DOM.previewVoiceState,
        voice ? "ON" : "OFF"
    );
}

/**
 * Update waiting room UI.
 */
function updateWaitingRoom() {
    const lobby = state.lobby;

    if (!lobby.active) {
        return;
    }

    const mapName =
        SEEKER_CONFIG.maps[state.selectedMap]?.name ||
        state.selectedMap.toUpperCase();

    setText(
        DOM.waitingLobbyName,
        lobby.name
    );

    setText(
        DOM.displayLobbyCode,
        lobby.code
    );

    setText(
        DOM.waitingPlayerCount,
        `${lobby.players.length} / ${lobby.maxPlayers}`
    );

    setText(
        DOM.waitingMap,
        mapName
    );

    setText(
        DOM.waitingLimit,
        lobby.maxPlayers
    );

    setText(
        DOM.waitingVoice,
        lobby.voiceChat ? "ENABLED" : "DISABLED"
    );

    renderWaitingPlayers();

    if (DOM.readyButton) {
        DOM.readyButton.textContent =
            lobby.ready ? "NOT READY" : "READY";

        const arrow = document.createElement("span");

        arrow.textContent = "›";

        DOM.readyButton.appendChild(arrow);
    }
}

/**
 * Render player list.
 */
function renderWaitingPlayers() {
    if (!DOM.waitingPlayerList) {
        return;
    }

    DOM.waitingPlayerList.innerHTML = "";

    const lobby = state.lobby;

    for (
        let index = 0;
        index < lobby.maxPlayers;
        index += 1
    ) {
        const player = lobby.players[index];

        const row = document.createElement("div");

        row.className =
            "player-slot" +
            (player ? " occupied" : "");

        if (player) {
            row.innerHTML = `
                <span class="player-avatar">
                    P${index + 1}
                </span>

                <div>
                    <strong>
                        ${escapeHTML(player.name)}
                    </strong>

                    <small>
                        ${player.host ? "HOST" : "PLAYER"}
                    </small>
                </div>

                ${
                    player.ready
                        ? `<span class="player-ready">READY</span>`
                        : ""
                }
            `;
        } else {
            row.innerHTML = `
                <span class="player-avatar">
                    P${index + 1}
                </span>

                <div>
                    <strong>EMPTY SLOT</strong>
                    <small>WAITING</small>
                </div>
            `;
        }

        DOM.waitingPlayerList.appendChild(row);
    }
}

/**
 * Toggle local player ready state.
 */
function toggleReady() {
    if (!state.lobby.active) {
        return;
    }

    state.lobby.ready =
        !state.lobby.ready;

    const player =
        state.lobby.players.find(
            (entry) =>
                entry.id === "local-player"
        );

    if (player) {
        player.ready = state.lobby.ready;
    }

    updateWaitingRoom();
}

/**
 * Start session from lobby.
 */
function startLobbySession() {
    if (!state.lobby.active) {
        return;
    }

    if (!state.lobby.hosted) {
        setLobbyMessage(
            "Only the host can start the session.",
            "error"
        );

        return;
    }

    const everybodyReady =
        state.lobby.players.every(
            (player) => player.ready
        );

    if (!everybodyReady) {
        showNotification(
            "SESSION",
            "WAIT FOR ALL PLAYERS",
            2200
        );

        return;
    }

    beginGameLoading({
        map: state.selectedMap,
        mode: state.mode,
        multiplayer: true
    });
}

/**
 * Leave lobby.
 */
function leaveLobby() {
    state.lobby.active = false;
    state.lobby.hosted = false;
    state.lobby.players = [];

    showScreen("multiplayerScreen");

    refreshLobbyList();
}

/* ================================================================
   GAME LOADING
================================================================ */

/**
 * Begin game loading.
 */
async function beginGameLoading(options = {}) {
    const map =
        options.map ||
        "facility";

    const mode =
        options.mode ||
        state.mode;

    const multiplayer =
        Boolean(options.multiplayer);

    state.selectedMap = map;
    state.mode = mode;

    state.gameRunning = false;
    state.gamePaused = false;
    state.gameOver = false;
    state.gameWon = false;

    state.preparationRemaining =
        SEEKER_CONFIG.preparationSeconds;

    resetObjectives();

    showScreen(
        "gameLoadingScreen",
        {
            remember: false
        }
    );

    const mapInfo =
        SEEKER_CONFIG.maps[map] ||
        SEEKER_CONFIG.maps.facility;

    setText(
        DOM.gameLoadingBuild,
        `BUILD ${SEEKER_CONFIG.version}`
    );

    setText(
        DOM.gameLoadingTitle,
        mapInfo.name
    );

    setText(
        DOM.gameLoadingDescription,
        mapInfo.description
    );

    const stages = [
        [7, "CREATING ENVIRONMENT"],
        [18, "LOADING WORLD GEOMETRY"],
        [29, "BUILDING ROOMS"],
        [41, "PREPARING LIGHTING"],
        [52, "LOADING CHARACTERS"],
        [64, "PREPARING COLLISIONS"],
        [75, "INITIALIZING AUDIO"],
        [84, "INITIALIZING OBJECTIVES"],
        [93, "PREPARING THREAT SYSTEM"],
        [100, "SESSION READY"]
    ];

    for (const [progress, status] of stages) {
        updateGameLoading(
            progress,
            status
        );

        await delay(110);
    }

    /*
     * If game.js exists, let it prepare the world.
     */
    if (
        window.SeekerGame &&
        typeof window.SeekerGame.initialize === "function"
    ) {
        try {
            await window.SeekerGame.initialize({
                map,
                mode,
                multiplayer,
                canvas: DOM.gameCanvas,
                state
            });
        } catch (error) {
            reportError(
                error,
                "game-initialize"
            );
        }
    }

    /*
     * If details.js exists, let it prepare visual details.
     */
    if (
        window.SeekerDetails &&
        typeof window.SeekerDetails.initialize === "function"
    ) {
        try {
            await window.SeekerDetails.initialize({
                canvas: DOM.gameCanvas,
                map,
                mode,
                state
            });
        } catch (error) {
            reportError(
                error,
                "details-initialize"
            );
        }
    }

    /*
     * If systems.js exists, let it initialize supporting systems.
     */
    if (
        window.SeekerSystems &&
        typeof window.SeekerSystems.initialize === "function"
    ) {
        try {
            await window.SeekerSystems.initialize({
                state,
                map,
                mode,
                multiplayer
            });
        } catch (error) {
            reportError(
                error,
                "systems-initialize"
            );
        }
    }

    await delay(300);

    startGame();
}

/**
 * Update game-loading screen.
 */
function updateGameLoading(progress, status) {
    const safeProgress =
        clamp(progress, 0, 100);

    if (DOM.gameLoadingProgress) {
        DOM.gameLoadingProgress.style.width =
            `${safeProgress}%`;
    }

    setText(
        DOM.gameLoadingPercent,
        `${Math.round(safeProgress)}%`
    );

    setText(
        DOM.gameLoadingStatus,
        status
    );
}

/* ================================================================
   GAME START
================================================================ */

/**
 * Start gameplay.
 */
function startGame() {
    state.gameRunning = true;
    state.gamePaused = false;
    state.gameOver = false;
    state.gameWon = false;

    state.preparationActive = true;
    state.preparationRemaining =
        SEEKER_CONFIG.preparationSeconds;

    state.player.health = 100;

    showScreen(
        "gameScreen",
        {
            remember: false
        }
    );

    initializeGameCanvas();

    updateGameHUD();

    showNotification(
        "SYSTEM",
        "FIND THE THREE BUTTONS",
        3500
    );

    startPreparationTimer();

    startGameLoop();
}

/**
 * Prepare canvas.
 */
function initializeGameCanvas() {
    const canvas = DOM.gameCanvas;

    if (!canvas) {
        return;
    }

    resizeCanvas();

    const context =
        canvas.getContext("2d");

    if (!context) {
        reportError(
            "Canvas 2D context unavailable.",
            "canvas"
        );

        return;
    }

    drawFallbackWorld(context);
}

/**
 * Resize game canvas.
 */
function resizeCanvas() {
    const canvas = DOM.gameCanvas;

    if (!canvas) {
        return;
    }

    const rect =
        canvas.getBoundingClientRect();

    const ratio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        Math.max(
            1,
            Math.floor(rect.width * ratio)
        );

    canvas.height =
        Math.max(
            1,
            Math.floor(rect.height * ratio)
        );

    const context =
        canvas.getContext("2d");

    if (context) {
        context.setTransform(
            ratio,
            0,
            0,
            ratio,
            0,
            0
        );
    }
}

/**
 * Draw a temporary fallback environment.
 *
 * game.js will replace this with the actual world.
 */
function drawFallbackWorld(context) {
    const canvas = DOM.gameCanvas;

    if (!canvas) {
        return;
    }

    const width =
        canvas.clientWidth ||
        window.innerWidth;

    const height =
        canvas.clientHeight ||
        window.innerHeight;

    context.clearRect(
        0,
        0,
        width,
        height
    );

    const gradient =
        context.createRadialGradient(
            width * 0.5,
            height * 0.52,
            20,
            width * 0.5,
            height * 0.52,
            Math.max(width, height) * 0.7
        );

    gradient.addColorStop(
        0,
        "#25231d"
    );

    gradient.addColorStop(
        0.4,
        "#11110e"
    );

    gradient.addColorStop(
        1,
        "#030303"
    );

    context.fillStyle = gradient;

    context.fillRect(
        0,
        0,
        width,
        height
    );

    /*
     * Floor perspective.
     */
    context.save();

    context.globalAlpha = 0.12;

    for (
        let y = height * 0.55;
        y < height;
        y += 35
    ) {
        context.beginPath();

        context.moveTo(
            0,
            y
        );

        context.lineTo(
            width,
            y
        );

        context.strokeStyle =
            "#c9a227";

        context.lineWidth = 1;

        context.stroke();
    }

    for (
        let x = -width;
        x < width * 2;
        x += 90
    ) {
        context.beginPath();

        context.moveTo(
            width / 2,
            height * 0.48
        );

        context.lineTo(
            x,
            height
        );

        context.strokeStyle =
            "#c9a227";

        context.stroke();
    }

    context.restore();

    /*
     * Temporary distant corridor.
     */
    context.save();

    const corridorWidth =
        Math.min(
            width * 0.45,
            500
        );

    const corridorLeft =
        width / 2 -
        corridorWidth / 2;

    context.fillStyle =
        "rgba(2,2,2,0.75)";

    context.fillRect(
        corridorLeft,
        height * 0.15,
        corridorWidth,
        height * 0.6
    );

    context.strokeStyle =
        "rgba(190,180,150,0.16)";

    context.strokeRect(
        corridorLeft,
        height * 0.15,
        corridorWidth,
        height * 0.6
    );

    context.restore();
}

/* ================================================================
   PREPARATION TIMER
================================================================ */

/**
 * Start the 3-minute preparation period.
 */
function startPreparationTimer() {
    stopTimer("preparation");

    state.preparationActive = true;
    state.preparationRemaining =
        SEEKER_CONFIG.preparationSeconds;

    updatePreparationHUD();

    state.timers.preparation =
        window.setInterval(
            () => {
                if (
                    !state.gameRunning ||
                    state.gamePaused
                ) {
                    return;
                }

                state.preparationRemaining -= 1;

                if (
                    state.preparationRemaining <= 0
                ) {
                    state.preparationRemaining = 0;

                    finishPreparationPhase();

                    return;
                }

                updatePreparationHUD();
            },
            1000
        );
}

/**
 * Finish preparation.
 */
function finishPreparationPhase() {
    stopTimer("preparation");

    state.preparationActive = false;

    setText(
        DOM.objectiveSubtext,
        "SOMETHING IS MOVING"
    );

    showNotification(
        "WARNING",
        "THE HUNT HAS BEGUN",
        3500
    );

    setText(
        DOM.threatText,
        "ACTIVE"
    );

    addClass(
        DOM.threatIndicator,
        "warning"
    );

    state.seeker.active = true;

    if (
        window.SeekerGame &&
        typeof window.SeekerGame.beginHunt === "function"
    ) {
        try {
            window.SeekerGame.beginHunt();
        } catch (error) {
            reportError(
                error,
                "begin-hunt"
            );
        }
    }

    if (
        window.SeekerSystems &&
        typeof window.SeekerSystems.beginHunt === "function"
    ) {
        try {
            window.SeekerSystems.beginHunt();
        } catch (error) {
            reportError(
                error,
                "systems-begin-hunt"
            );
        }
    }
}

/**
 * Update preparation HUD.
 */
function updatePreparationHUD() {
    setText(
        DOM.prepTimer,
        formatTime(
            state.preparationRemaining
        )
    );

    if (state.preparationActive) {
        setText(
            DOM.prepTimer,
            formatTime(
                state.preparationRemaining
            )
        );
    }
}

/* ================================================================
   GAME LOOP
================================================================ */

/**
 * Start main frame loop.
 */
function startGameLoop() {
    stopTimer("game");

    let previous =
        performance.now();

    const frame = (now) => {
        if (!state.gameRunning) {
            return;
        }

        const delta =
            Math.min(
                0.1,
                Math.max(
                    0,
                    (now - previous) / 1000
                )
            );

        previous = now;

        if (!state.gamePaused) {
            updateGame(delta);
            renderGame(delta);
        }

        state.timers.game =
            window.requestAnimationFrame(frame);
    };

    state.timers.game =
        window.requestAnimationFrame(frame);
}

/**
 * Update gameplay.
 */
function updateGame(delta) {
    updateInput(delta);

    /*
     * Main game module.
     */
    if (
        window.SeekerGame &&
        typeof window.SeekerGame.update === "function"
    ) {
        try {
            window.SeekerGame.update(
                delta,
                state
            );
        } catch (error) {
            reportError(
                error,
                "game-update"
            );
        }
    }

    /*
     * Detail/visual module.
     */
    if (
        window.SeekerDetails &&
        typeof window.SeekerDetails.update === "function"
    ) {
        try {
            window.SeekerDetails.update(
                delta,
                state
            );
        } catch (error) {
            reportError(
                error,
                "details-update"
            );
        }
    }

    /*
     * Supporting systems.
     */
    if (
        window.SeekerSystems &&
        typeof window.SeekerSystems.update === "function"
    ) {
        try {
            window.SeekerSystems.update(
                delta,
                state
            );
        } catch (error) {
            reportError(
                error,
                "systems-update"
            );
        }
    }

    updateGameHUD();
}

/**
 * Render gameplay.
 */
function renderGame(delta) {
    if (
        window.SeekerGame &&
        typeof window.SeekerGame.render === "function"
    ) {
        try {
            window.SeekerGame.render(
                delta,
                state
            );

            return;
        } catch (error) {
            reportError(
                error,
                "game-render"
            );
        }
    }

    const context =
        DOM.gameCanvas?.getContext("2d");

    if (context) {
        drawFallbackWorld(context);
    }
}

/* ================================================================
   INPUT
================================================================ */

/**
 * Update input state.
 */
function updateInput(delta) {
    const input = state.input;

    const forward =
        input.keys.has("KeyW") ||
        input.keys.has("ArrowUp");

    const backward =
        input.keys.has("KeyS") ||
        input.keys.has("ArrowDown");

    const left =
        input.keys.has("KeyA") ||
        input.keys.has("ArrowLeft");

    const right =
        input.keys.has("KeyD") ||
        input.keys.has("ArrowRight");

    let moveX = 0;
    let moveY = 0;

    if (forward) {
        moveY -= 1;
    }

    if (backward) {
        moveY += 1;
    }

    if (left) {
        moveX -= 1;
    }

    if (right) {
        moveX += 1;
    }

    if (input.joystickActive) {
        moveX += input.joystickX;
        moveY += input.joystickY;
    }

    const length =
        Math.hypot(
            moveX,
            moveY
        );

    if (length > 1) {
        moveX /= length;
        moveY /= length;
    }

    input.run =
        input.keys.has("ShiftLeft") ||
        input.keys.has("ShiftRight");

    input.crouch =
        input.keys.has("ControlLeft") ||
        input.keys.has("ControlRight");

    state.player.sprinting =
        input.run &&
        length > 0 &&
        !input.crouch;

    state.player.crouching =
        input.crouch;

    /*
     * If the actual game module does not yet exist,
     * maintain a tiny logical position so the minimap works.
     */
    if (
        !window.SeekerGame ||
        typeof window.SeekerGame.update !== "function"
    ) {
        const speed =
            state.player.sprinting
                ? 4
                : 2;

        state.player.x +=
            moveX * speed * delta;

        state.player.z +=
            moveY * speed * delta;
    }
}

/**
 * Key down.
 */
function handleKeyDown(event) {
    state.input.keys.add(
        event.code
    );

    if (
        event.code === "Escape"
    ) {
        if (state.currentScreen === "gameScreen") {
            togglePause();
        }
    }

    if (
        event.code === "KeyE"
    ) {
        tryInteract();
    }

    if (
        event.code === "KeyV"
    ) {
        toggleVoiceChat();
    }
}

/**
 * Key up.
 */
function handleKeyUp(event) {
    state.input.keys.delete(
        event.code
    );
}

/**
 * Mouse movement.
 */
function handleMouseMove(event) {
    state.input.mouseX = event.clientX;
    state.input.mouseY = event.clientY;

    state.input.mouseDeltaX +=
        event.movementX || 0;

    state.input.mouseDeltaY +=
        event.movementY || 0;
}

/**
 * Pointer lock change.
 */
function handlePointerLockChange() {
    state.input.pointerLocked =
        document.pointerLockElement ===
        DOM.gameCanvas;
}

/* ================================================================
   MOBILE JOYSTICK
================================================================ */

function initializeMobileJoystick() {
    const joystick =
        DOM.mobileJoystick;

    const knob =
        DOM.joystickKnob;

    if (!joystick || !knob) {
        return;
    }

    let pointerId = null;

    const radius = 40;

    function updateJoystick(
        clientX,
        clientY
    ) {
        const rect =
            joystick.getBoundingClientRect();

        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;

        let dx =
            clientX -
            centerX;

        let dy =
            clientY -
            centerY;

        const distance =
            Math.hypot(dx, dy);

        if (distance > radius) {
            dx =
                dx /
                distance *
                radius;

            dy =
                dy /
                distance *
                radius;
        }

        state.input.joystickX =
            dx / radius;

        state.input.joystickY =
            dy / radius;

        knob.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    joystick.addEventListener(
        "pointerdown",
        (event) => {
            pointerId =
                event.pointerId;

            state.input.joystickActive =
                true;

            joystick.setPointerCapture(
                pointerId
            );

            updateJoystick(
                event.clientX,
                event.clientY
            );
        }
    );

    joystick.addEventListener(
        "pointermove",
        (event) => {
            if (
                event.pointerId !==
                pointerId
            ) {
                return;
            }

            updateJoystick(
                event.clientX,
                event.clientY
            );
        }
    );

    const stopJoystick = (event) => {
        if (
            event.pointerId !==
            pointerId
        ) {
            return;
        }

        pointerId = null;

        state.input.joystickActive =
            false;

        state.input.joystickX = 0;
        state.input.joystickY = 0;

        knob.style.transform =
            "translate(-50%, -50%)";
    };

    joystick.addEventListener(
        "pointerup",
        stopJoystick
    );

    joystick.addEventListener(
        "pointercancel",
        stopJoystick
    );
}

/* ================================================================
   INTERACTION
================================================================ */

/**
 * Try interacting with the nearest object.
 */
function tryInteract() {
    if (
        !state.gameRunning ||
        state.gamePaused ||
        state.gameOver
    ) {
        return;
    }

    if (
        window.SeekerGame &&
        typeof window.SeekerGame.interact === "function"
    ) {
        try {
            window.SeekerGame.interact();
            return;
        } catch (error) {
            reportError(
                error,
                "interaction"
            );
        }
    }

    showNotification(
        "SYSTEM",
        "NOTHING TO INTERACT WITH",
        1400
    );
}

/**
 * Toggle voice chat.
 */
function toggleVoiceChat() {
    if (
        !state.lobby.voiceChat &&
        state.lobby.active
    ) {
        return;
    }

    if (
        window.SeekerSystems &&
        typeof window.SeekerSystems.toggleVoiceChat === "function"
    ) {
        try {
            window.SeekerSystems.toggleVoiceChat();
        } catch (error) {
            reportError(
                error,
                "voice-chat"
            );
        }
    }

    const player =
        DOM.voicePlayerList?.querySelector(
            ".voice-player"
        );

    if (player) {
        player.classList.toggle(
            "speaking"
        );
    }
}

/* ================================================================
   HUD
================================================================ */

/**
 * Update all gameplay HUD values.
 */
function updateGameHUD() {
    updatePreparationHUD();
    updateConditionHUD();
    updateObjectiveHUD();
    updateMinimap();
    updateThreatHUD();
}

/**
 * Condition.
 */
function updateConditionHUD() {
    const health =
        clamp(
            state.player.health,
            0,
            100
        );

    if (DOM.conditionFill) {
        DOM.conditionFill.style.width =
            `${health}%`;
    }

    setText(
        DOM.conditionValue,
        Math.round(health)
    );
}

/**
 * Objective state.
 */
function updateObjectiveHUD() {
    const objectives =
        [
            state.objectives.button1,
            state.objectives.button2,
            state.objectives.button3
        ];

    DOM.objectiveItems.forEach(
        (element, index) => {
            const complete =
                Boolean(
                    objectives[index]
                );

            element.classList.toggle(
                "complete",
                complete
            );
        }
    );

    if (
        !state.objectives.button1 ||
        !state.objectives.button2 ||
        !state.objectives.button3
    ) {
        setText(
            DOM.objectiveText,
            "FIND THE THREE BUTTONS"
        );

        setText(
            DOM.objectiveSubtext,
            "SEARCH THE FACILITY"
        );

        return;
    }

    if (
        !state.objectives.keyFound
    ) {
        setText(
            DOM.objectiveText,
            "FIND THE KEY"
        );

        setText(
            DOM.objectiveSubtext,
            "THE GATE IS STILL LOCKED"
        );

        return;
    }

    if (
        !state.objectives.gateUnlocked
    ) {
        setText(
            DOM.objectiveText,
            "UNLOCK THE GATE"
        );

        setText(
            DOM.objectiveSubtext,
            "GET TO THE EXIT"
        );

        return;
    }

    setText(
        DOM.objectiveText,
        "ESCAPE"
    );

    setText(
        DOM.objectiveSubtext,
        "REACH THE EXIT"
    );
}

/**
 * Minimap.
 */
function updateMinimap() {
    if (
        !DOM.minimapPlayer ||
        !DOM.minimapSeeker
    ) {
        return;
    }

    const worldSize = 1000;

    const playerX =
        clamp(
            state.player.x,
            -worldSize,
            worldSize
        );

    const playerZ =
        clamp(
            state.player.z,
            -worldSize,
            worldSize
        );

    const playerLeft =
        50 +
        playerX /
        worldSize *
        40;

    const playerTop =
        50 +
        playerZ /
        worldSize *
        40;

    DOM.minimapPlayer.style.left =
        `${clamp(playerLeft, 5, 95)}%`;

    DOM.minimapPlayer.style.top =
        `${clamp(playerTop, 5, 95)}%`;

    if (
        Number.isFinite(
            state.seeker.x
        ) &&
        Number.isFinite(
            state.seeker.z
        )
    ) {
        const seekerLeft =
            50 +
            state.seeker.x /
            worldSize *
            40;

        const seekerTop =
            50 +
            state.seeker.z /
            worldSize *
            40;

        DOM.minimapSeeker.style.left =
            `${clamp(seekerLeft, 5, 95)}%`;

        DOM.minimapSeeker.style.top =
            `${clamp(seekerTop, 5, 95)}%`;
    }

    toggleClass(
        DOM.minimap,
        "hidden",
        !state.settings.minimapEnabled
    );
}

/**
 * Threat HUD.
 */
function updateThreatHUD() {
    const distance =
        Number(state.seeker.distance);

    if (
        !Number.isFinite(distance)
    ) {
        setText(
            DOM.threatText,
            "UNKNOWN"
        );

        return;
    }

    if (distance < 15) {
        setText(
            DOM.threatText,
            "CRITICAL"
        );

        addClass(
            DOM.threatIndicator,
            "warning"
        );

        return;
    }

    if (distance < 35) {
        setText(
            DOM.threatText,
            "CLOSE"
        );

        addClass(
            DOM.threatIndicator,
            "warning"
        );

        return;
    }

    if (distance < 70) {
        setText(
            DOM.threatText,
            "NEARBY"
        );

        addClass(
            DOM.threatIndicator,
            "warning"
        );

        return;
    }

    setText(
        DOM.threatText,
        "DISTANT"
    );

    removeClass(
        DOM.threatIndicator,
        "warning"
    );
}

/**
 * Show temporary notification.
 */
function showNotification(
    small,
    message,
    duration = 2000
) {
    setText(
        DOM.notificationSmall,
        small
    );

    setText(
        DOM.notificationText,
        message
    );

    addClass(
        DOM.centerNotification,
        "visible"
    );

    if (state.timers.notification) {
        window.clearTimeout(
            state.timers.notification
        );
    }

    state.timers.notification =
        window.setTimeout(
            () => {
                removeClass(
                    DOM.centerNotification,
                    "visible"
                );
            },
            duration
        );
}

/* ================================================================
   OBJECTIVES
================================================================ */

/**
 * Reset all objectives.
 */
function resetObjectives() {
    state.objectives.button1 = false;
    state.objectives.button2 = false;
    state.objectives.button3 = false;
    state.objectives.keyFound = false;
    state.objectives.gateUnlocked = false;
}

/**
 * Complete one button.
 */
function completeButton(number) {
    const buttonMap = {
        1: "button1",
        2: "button2",
        3: "button3"
    };

    const property =
        buttonMap[number];

    if (!property) {
        return;
    }

    if (
        state.objectives[property]
    ) {
        return;
    }

    state.objectives[property] = true;

    showNotification(
        "OBJECTIVE",
        `BUTTON ${number} ACTIVATED`,
        1800
    );

    updateObjectiveHUD();

    if (
        state.objectives.button1 &&
        state.objectives.button2 &&
        state.objectives.button3
    ) {
        showNotification(
            "OBJECTIVE COMPLETE",
            "THE KEY HAS BEEN RELEASED",
            2800
        );
    }
}

/**
 * Find key.
 */
function collectKey() {
    if (
        state.objectives.keyFound
    ) {
        return;
    }

    if (
        !(
            state.objectives.button1 &&
            state.objectives.button2 &&
            state.objectives.button3
        )
    ) {
        showNotification(
            "LOCKED",
            "THREE BUTTONS REQUIRED",
            1800
        );

        return;
    }

    state.objectives.keyFound = true;

    showNotification(
        "OBJECTIVE",
        "KEY ACQUIRED",
        1800
    );

    updateObjectiveHUD();
}

/**
 * Unlock gate.
 */
function unlockGate() {
    if (
        state.objectives.gateUnlocked
    ) {
        return;
    }

    if (
        !state.objectives.keyFound
    ) {
        showNotification(
            "LOCKED",
            "A KEY IS REQUIRED",
            1800
        );

        return;
    }

    state.objectives.gateUnlocked = true;

    showNotification(
        "GATE",
        "EXIT UNLOCKED",
        2200
    );

    updateObjectiveHUD();
}

/**
 * Escape.
 */
function completeGame() {
    if (
        state.gameOver ||
        state.gameWon
    ) {
        return;
    }

    if (
        !state.objectives.gateUnlocked
    ) {
        return;
    }

    state.gameWon = true;
    state.gameRunning = false;

    stopTimer("preparation");
    stopTimer("game");

    showWinScreen();
}

/* ================================================================
   PAUSE
================================================================ */

/**
 * Toggle pause.
 */
function togglePause() {
    if (
        !state.gameRunning ||
        state.gameOver ||
        state.gameWon
    ) {
        return;
    }

    state.gamePaused =
        !state.gamePaused;

    toggleClass(
        DOM.pauseOverlay,
        "visible",
        state.gamePaused
    );

    if (state.gamePaused) {
        showNotification(
            "SYSTEM",
            "SESSION PAUSED",
            800
        );
    }
}

/**
 * Resume.
 */
function resumeGame() {
    state.gamePaused = false;

    removeClass(
        DOM.pauseOverlay,
        "visible"
    );
}

/**
 * Open settings from pause.
 */
function openPauseSettings() {
    state.gamePaused = true;

    removeClass(
        DOM.pauseOverlay,
        "visible"
    );

    showScreen("settingsScreen");
}

/**
 * Quit to main menu.
 */
function quitToMenu() {
    state.gameRunning = false;
    state.gamePaused = false;
    state.gameOver = false;
    state.gameWon = false;

    stopTimer("preparation");
    stopTimer("game");

    resetTransientGameState();

    removeClass(
        DOM.pauseOverlay,
        "visible"
    );

    removeClass(
        DOM.deathOverlay,
        "visible"
    );

    removeClass(
        DOM.winOverlay,
        "visible"
    );

    showScreen(
        "mainMenu",
        {
            remember: false
        }
    );
}

/* ================================================================
   DEATH
================================================================ */

/**
 * Trigger player death.
 */
function playerDeath(reason = "FOUND") {
    if (
        state.gameOver ||
        state.gameWon
    ) {
        return;
    }

    state.gameOver = true;
    state.gameRunning = false;

    stopTimer("preparation");
    stopTimer("game");

    setText(
        DOM.deathTitle,
        reason
    );

    setText(
        DOM.deathDescription,
        "THE FACILITY HAS FALLEN SILENT."
    );

    addClass(
        DOM.deathOverlay,
        "visible"
    );
}

/**
 * Retry current game.
 */
function retryGame() {
    removeClass(
        DOM.deathOverlay,
        "visible"
    );

    beginGameLoading({
        map: state.selectedMap,
        mode: state.mode,
        multiplayer: state.lobby.active
    });
}

/**
 * Show win screen.
 */
function showWinScreen() {
    setText(
        DOM.winTime,
        formatTime(
            SEEKER_CONFIG.preparationSeconds -
            state.preparationRemaining
        )
    );

    setText(
        DOM.winButtons,
        "3 / 3"
    );

    setText(
        DOM.winPlayers,
        state.lobby.active
            ? state.lobby.players.length
            : 1
    );

    addClass(
        DOM.winOverlay,
        "visible"
    );
}

/* ================================================================
   SETTINGS
================================================================ */

/**
 * Apply settings to UI.
 */
function applySettingsToUI() {
    const settings =
        state.settings;

    if (DOM.graphicsQuality) {
        DOM.graphicsQuality.value =
            settings.graphicsQuality;
    }

    if (DOM.shadowQuality) {
        DOM.shadowQuality.value =
            settings.shadowQuality;
    }

    if (DOM.ambientEffects) {
        DOM.ambientEffects.checked =
            settings.ambientEffects;
    }

    if (DOM.cameraShake) {
        DOM.cameraShake.checked =
            settings.cameraShake;
    }

    if (DOM.masterVolume) {
        DOM.masterVolume.value =
            settings.masterVolume;

        setText(
            DOM.masterVolumeValue,
            `${settings.masterVolume}%`
        );
    }

    if (DOM.musicVolume) {
        DOM.musicVolume.value =
            settings.musicVolume;

        setText(
            DOM.musicVolumeValue,
            `${settings.musicVolume}%`
        );
    }

    if (DOM.sfxVolume) {
        DOM.sfxVolume.value =
            settings.sfxVolume;

        setText(
            DOM.sfxVolumeValue,
            `${settings.sfxVolume}%`
        );
    }

    if (DOM.voiceVolumeEnabled) {
        DOM.voiceVolumeEnabled.checked =
            settings.voiceVolumeEnabled;
    }

    if (DOM.subtitles) {
        DOM.subtitles.checked =
            settings.subtitles;
    }

    if (DOM.minimapEnabled) {
        DOM.minimapEnabled.checked =
            settings.minimapEnabled;
    }

    if (DOM.hintsEnabled) {
        DOM.hintsEnabled.checked =
            settings.hintsEnabled;
    }

    if (DOM.reducedMotion) {
        DOM.reducedMotion.checked =
            settings.reducedMotion;
    }

    if (DOM.highContrast) {
        DOM.highContrast.checked =
            settings.highContrast;
    }

    if (DOM.flashEffects) {
        DOM.flashEffects.checked =
            settings.flashEffects;
    }

    applyBodySettings();
}

/**
 * Read UI settings.
 */
function readSettingsFromUI() {
    state.settings.graphicsQuality =
        DOM.graphicsQuality?.value ||
        "high";

    state.settings.shadowQuality =
        DOM.shadowQuality?.value ||
        "high";

    state.settings.ambientEffects =
        Boolean(
            DOM.ambientEffects?.checked
        );

    state.settings.cameraShake =
        Boolean(
            DOM.cameraShake?.checked
        );

    state.settings.masterVolume =
        clamp(
            Number(
                DOM.masterVolume?.value || 80
            ),
            0,
            100
        );

    state.settings.musicVolume =
        clamp(
            Number(
                DOM.musicVolume?.value || 70
            ),
            0,
            100
        );

    state.settings.sfxVolume =
        clamp(
            Number(
                DOM.sfxVolume?.value || 85
            ),
            0,
            100
        );

    state.settings.voiceVolumeEnabled =
        Boolean(
            DOM.voiceVolumeEnabled?.checked
        );

    state.settings.subtitles =
        Boolean(
            DOM.subtitles?.checked
        );

    state.settings.minimapEnabled =
        Boolean(
            DOM.minimapEnabled?.checked
        );

    state.settings.hintsEnabled =
        Boolean(
            DOM.hintsEnabled?.checked
        );

    state.settings.reducedMotion =
        Boolean(
            DOM.reducedMotion?.checked
        );

    state.settings.highContrast =
        Boolean(
            DOM.highContrast?.checked
        );

    state.settings.flashEffects =
        Boolean(
            DOM.flashEffects?.checked
        );

    applyBodySettings();
}

/**
 * Apply settings to document.
 */
function applyBodySettings() {
    document.body.classList.toggle(
        "reduced-motion",
        state.settings.reducedMotion
    );

    document.body.classList.toggle(
        "high-contrast",
        state.settings.highContrast
    );
}

/**
 * Save settings.
 */
function saveSettings() {
    readSettingsFromUI();

    /*
     * Local persistence is intentionally limited to settings.
     */
    try {
        window.localStorage.setItem(
            "the_seeker_settings",
            JSON.stringify(
                state.settings
            )
        );
    } catch (error) {
        state.diagnostics.warnings.push(
            "Settings could not be persisted."
        );
    }

    setText(
        DOM.settingsSavedMessage,
        "CHANGES SAVED AUTOMATICALLY"
    );
}

/**
 * Load settings.
 */
function loadSettings() {
    try {
        const raw =
            window.localStorage.getItem(
                "the_seeker_settings"
            );

        if (!raw) {
            return;
        }

        const parsed =
            JSON.parse(raw);

        if (
            parsed &&
            typeof parsed === "object"
        ) {
            state.settings = {
                ...structuredClone(
                    SEEKER_CONFIG.defaultSettings
                ),
                ...parsed
            };
        }
    } catch (error) {
        state.diagnostics.warnings.push(
            "Saved settings were invalid."
        );

        state.settings =
            structuredClone(
                SEEKER_CONFIG.defaultSettings
            );
    }
}

/**
 * Reset settings.
 */
function resetSettings() {
    state.settings =
        structuredClone(
            SEEKER_CONFIG.defaultSettings
        );

    applySettingsToUI();
    saveSettings();
}

/**
 * Switch settings page.
 */
function switchSettingsTab(name) {
    DOM.settingsTabs.forEach(
        (tab) => {
            tab.classList.toggle(
                "active",
                tab.dataset.settingsTab === name
            );
        }
    );

    DOM.settingsPages.forEach(
        (page) => {
            page.classList.toggle(
                "active",
                page.dataset.settingsPage === name
            );
        }
    );
}

/* ================================================================
   AUDIO FOUNDATION
================================================================ */

/**
 * Initialize Web Audio.
 *
 * Actual music/SFX asset management will be handled by systems.js.
 */
function initializeAudio() {
    if (state.audio.initialized) {
        return;
    }

    state.audio.initialized = true;

    try {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (AudioContext) {
            state.audio.context =
                new AudioContext();
        }
    } catch (error) {
        state.audio.context = null;
    }
}

/**
 * Resume audio context after user gesture.
 */
async function resumeAudio() {
    if (
        state.audio.context &&
        state.audio.context.state === "suspended"
    ) {
        try {
            await state.audio.context.resume();
        } catch (error) {
            state.diagnostics.warnings.push(
                "Audio context could not resume."
            );
        }
    }
}

/**
 * Play a very small fallback tone.
 */
function playFallbackTone(
    frequency = 220,
    duration = 0.08
) {
    if (
        !state.audio.context ||
        state.settings.sfxVolume <= 0
    ) {
        return;
    }

    const context =
        state.audio.context;

    try {
        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        oscillator.frequency.value =
            clamp(
                frequency,
                30,
                2000
            );

        gain.gain.value =
            clamp(
                state.settings.sfxVolume / 100 * 0.04,
                0,
                0.08
            );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start();

        oscillator.stop(
            context.currentTime +
            duration
        );
    } catch (error) {
        /*
         * Audio is optional and should never stop gameplay.
         */
    }
}

/* ================================================================
   TIMER HELPERS
================================================================ */

/**
 * Stop one timer.
 */
function stopTimer(name) {
    const timer =
        state.timers[name];

    if (!timer) {
        return;
    }

    if (name === "game") {
        window.cancelAnimationFrame(
            timer
        );
    } else {
        window.clearInterval(
            timer
        );

        window.clearTimeout(
            timer
        );
    }

    state.timers[name] = null;
}

/**
 * Stop all timers.
 */
function stopAllTimers() {
    stopTimer("splash");
    stopTimer("loading");
    stopTimer("preparation");
    stopTimer("game");

    if (state.timers.notification) {
        window.clearTimeout(
            state.timers.notification
        );

        state.timers.notification = null;
    }
}

/* ================================================================
   RESET
================================================================ */

/**
 * Reset temporary game state.
 */
function resetTransientGameState() {
    stopTimer("preparation");
    stopTimer("game");

    state.gameRunning = false;
    state.gamePaused = false;
    state.gameOver = false;
    state.gameWon = false;

    state.preparationActive = false;
    state.preparationRemaining =
        SEEKER_CONFIG.preparationSeconds;

    state.player.x = 0;
    state.player.y = 0;
    state.player.z = 0;

    state.player.health = 100;

    state.player.sprinting = false;
    state.player.crouching = false;

    state.seeker.active = false;
    state.seeker.distance = Infinity;
    state.seeker.intensity = 0;
    state.seeker.awareness = 0;

    resetObjectives();

    removeClass(
        DOM.pauseOverlay,
        "visible"
    );

    removeClass(
        DOM.deathOverlay,
        "visible"
    );

    removeClass(
        DOM.winOverlay,
        "visible"
    );

    removeClass(
        DOM.threatIndicator,
        "warning"
    );
}

/* ================================================================
   COPY LOBBY CODE
================================================================ */

async function copyLobbyCode() {
    const code =
        safeString(
            state.lobby.code,
            ""
        );

    if (!code) {
        return;
    }

    try {
        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {
            await navigator.clipboard.writeText(
                code
            );

            showNotification(
                "LOBBY",
                "CODE COPIED",
                1200
            );

            return;
        }
    } catch (error) {
        /*
         * Continue with fallback.
         */
    }

    const temporary =
        document.createElement("textarea");

    temporary.value = code;

    temporary.style.position =
        "fixed";

    temporary.style.opacity = "0";

    document.body.appendChild(
        temporary
    );

    temporary.select();

    try {
        document.execCommand(
            "copy"
        );

        showNotification(
            "LOBBY",
            "CODE COPIED",
            1200
        );
    } catch (error) {
        showNotification(
            "LOBBY CODE",
            code,
            2200
        );
    }

    temporary.remove();
}

/* ================================================================
   EVENT LISTENERS
================================================================ */

function bindEvents() {

    /* Main menu */
    DOM.playButton?.addEventListener(
        "click",
        async () => {
            initializeAudio();
            await resumeAudio();
            openPlayMenu();
        }
    );

    DOM.multiplayerButton?.addEventListener(
        "click",
        async () => {
            initializeAudio();
            await resumeAudio();
            openMultiplayer();
        }
    );

    DOM.settingsButton?.addEventListener(
        "click",
        () => {
            openSettings();
        }
    );

    DOM.creditsButton?.addEventListener(
        "click",
        () => {
            openCredits();
        }
    );

    /* Mode */
    DOM.pcModeButton?.addEventListener(
        "click",
        selectPCMode
    );

    DOM.mobileModeButton?.addEventListener(
        "click",
        selectMobileMode
    );

    DOM.continueModeButton?.addEventListener(
        "click",
        continueFromMode
    );

    /* Back buttons */
    DOM.backButtons.forEach(
        (button) => {
            button.addEventListener(
                "click",
                () => {
                    goBackTo(
                        button.dataset.back
                    );
                }
            );
        }
    );

    /* Multiplayer */
    DOM.hostLobbyButton?.addEventListener(
        "click",
        openHostLobby
    );

    DOM.joinLobbyButton?.addEventListener(
        "click",
        openJoinLobby
    );

    DOM.refreshLobbiesButton?.addEventListener(
        "click",
        refreshLobbyList
    );

    DOM.connectLobbyButton?.addEventListener(
        "click",
        connectToLobby
    );

    DOM.lobbyCodeInput?.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Enter"
            ) {
                connectToLobby();
            }
        }
    );

    /* Host */
    DOM.createLobbyButton?.addEventListener(
        "click",
        createLobby
    );

    DOM.playerLimitSelect?.addEventListener(
        "change",
        updateHostPreview
    );

    DOM.mapSelect?.addEventListener(
        "change",
        updateHostPreview
    );

    DOM.voiceChatToggle?.addEventListener(
        "change",
        updateHostPreview
    );

    /* Waiting room */
    DOM.readyButton?.addEventListener(
        "click",
        toggleReady
    );

    DOM.startGameButton?.addEventListener(
        "click",
        startLobbySession
    );

    DOM.leaveLobbyButton?.addEventListener(
        "click",
        leaveLobby
    );

    DOM.copyLobbyCodeButton?.addEventListener(
        "click",
        copyLobbyCode
    );

    /* Settings */
    DOM.settingsTabs.forEach(
        (tab) => {
            tab.addEventListener(
                "click",
                () => {
                    switchSettingsTab(
                        tab.dataset.settingsTab
                    );
                }
            );
        }
    );

    const settingsInputs =
        document.querySelectorAll(
            "#settingsScreen input, #settingsScreen select"
        );

    settingsInputs.forEach(
        (input) => {
            input.addEventListener(
                "input",
                saveSettings
            );

            input.addEventListener(
                "change",
                saveSettings
            );
        }
    );

    DOM.resetSettingsButton?.addEventListener(
        "click",
        resetSettings
    );

    /* Game */
    DOM.resumeButton?.addEventListener(
        "click",
        resumeGame
    );

    DOM.pauseSettingsButton?.addEventListener(
        "click",
        openPauseSettings
    );

    DOM.quitGameButton?.addEventListener(
        "click",
        quitToMenu
    );

    DOM.retryButton?.addEventListener(
        "click",
        retryGame
    );

    DOM.deathMenuButton?.addEventListener(
        "click",
        quitToMenu
    );

    DOM.winMenuButton?.addEventListener(
        "click",
        quitToMenu
    );

    /* Mobile */
    DOM.mobileInteract?.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();
            tryInteract();
        }
    );

    DOM.mobileRun?.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();
            state.input.run = true;
        }
    );

    DOM.mobileRun?.addEventListener(
        "pointerup",
        () => {
            state.input.run = false;
        }
    );

    DOM.mobileRun?.addEventListener(
        "pointercancel",
        () => {
            state.input.run = false;
        }
    );

    DOM.mobileCrouch?.addEventListener(
        "pointerdown",
        (event) => {
            event.preventDefault();
            state.input.crouch = true;
        }
    );

    DOM.mobileCrouch?.addEventListener(
        "pointerup",
        () => {
            state.input.crouch = false;
        }
    );

    DOM.mobileCrouch?.addEventListener(
        "pointercancel",
        () => {
            state.input.crouch = false;
        }
    );

    /* Keyboard */
    window.addEventListener(
        "keydown",
        handleKeyDown
    );

    window.addEventListener(
        "keyup",
        handleKeyUp
    );

    window.addEventListener(
        "mousemove",
        handleMouseMove
    );

    document.addEventListener(
        "pointerlockchange",
        handlePointerLockChange
    );

    window.addEventListener(
        "resize",
        () => {
            resizeCanvas();

            if (
                state.gameRunning &&
                window.SeekerDetails &&
                typeof window.SeekerDetails.resize === "function"
            ) {
                try {
                    window.SeekerDetails.resize(
                        window.innerWidth,
                        window.innerHeight
                    );
                } catch (error) {
                    reportError(
                        error,
                        "details-resize"
                    );
                }
            }
        }
    );

    window.addEventListener(
        "blur",
        () => {
            state.input.keys.clear();
            state.input.run = false;
            state.input.crouch = false;
        }
    );

    /* Game canvas click */
    DOM.gameCanvas?.addEventListener(
        "click",
        async () => {
            if (
                state.gameRunning &&
                !state.gamePaused
            ) {
                await resumeAudio();

                try {
                    if (
                        DOM.gameCanvas.requestPointerLock
                    ) {
                        DOM.gameCanvas.requestPointerLock();
                    }
                } catch (error) {
                    /*
                     * Pointer lock is optional.
                     */
                }
            }
        }
    );

    /* Error */
    DOM.errorRetryButton?.addEventListener(
        "click",
        () => {
            removeClass(
                DOM.errorOverlay,
                "visible"
            );

            startLoadingScreen();
        }
    );

    DOM.errorCloseButton?.addEventListener(
        "click",
        () => {
            removeClass(
                DOM.errorOverlay,
                "visible"
            );
        }
    );
}

/* ================================================================
   ERROR HANDLING
================================================================ */

/**
 * Report a non-fatal error.
 */
function reportError(
    error,
    category = "unknown"
) {
    const message =
        error instanceof Error
            ? error.message
            : String(error);

    state.diagnostics.errors.push({
        category,
        message,
        time: Date.now()
    });

    /*
     * Keep the game alive whenever possible.
     */
    console.warn(
        `[THE SEEKER:${category}]`,
        message
    );
}

/**
 * Show fatal UI error.
 */
function showFatalError(message) {
    setText(
        DOM.errorMessage,
        message
    );

    addClass(
        DOM.errorOverlay,
        "visible"
    );
}

/* ================================================================
   GLOBAL GAME API
================================================================ */

window.SeekerMain = {
    state,

    config: SEEKER_CONFIG,

    showScreen,

    startGame,

    beginGameLoading,

    completeButton,

    collectKey,

    unlockGate,

    completeGame,

    playerDeath,

    showNotification,

    updateGameHUD,

    updateMinimap,

    updateThreatHUD,

    togglePause,

    resumeGame,

    quitToMenu,

    retryGame,

    resetTransientGameState,

    selectPCMode,

    selectMobileMode,

    createLobby,

    leaveLobby,

    refreshLobbyList,

    reportError
};

/* ================================================================
   INITIALIZATION
================================================================ */

async function initializeApplication() {
    if (state.initialized) {
        return;
    }

    state.initialized = true;

    state.diagnostics.startupTime =
        performance.now();

    cacheDOM();

    loadSettings();

    applySettingsToUI();

    bindEvents();

    initializeMobileJoystick();

    selectPCMode();

    /*
     * The app starts with the studio presentation.
     */
    await startStudioSplash();
}

/* ================================================================
   DOM READY
================================================================ */

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication,
        {
            once: true
        }
    );
} else {
    initializeApplication();
}

/* ================================================================
   END OF MAIN.JS FOUNDATION
================================================================ */