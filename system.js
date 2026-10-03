/* ============================================================
   THE SEEKER
   BlackHollow Games
   system.js
   ------------------------------------------------------------
   MASTER SYSTEM FILE

   Includes:
   - Audio system
   - Footstep audio
   - Seeker proximity music
   - Dynamic scary ambience
   - 3-minute setup timer
   - Game state system
   - Save / load settings
   - PC / Mobile platform mode
   - Inventory / flashlight events
   - Multiplayer lobby state
   - Voice-chat hooks
   - UI notifications
   - Screen effects
   - Loading system
   - Pause system
   - Game-over / caught state
   - Event bridge for main.js / game.js
   - Performance helpers
   - Browser autoplay handling
   - Automatic connection to SeekerDetails
============================================================ */

(() => {
    "use strict";

    /* =========================================================
       GLOBAL ROOT
    ========================================================= */

    const System = {

        version: "SEEKER-SYSTEM-100X",

        initialized: false,

        gameState: "boot",

        platform: "pc",

        difficulty: "normal",

        muted: false,

        masterVolume: 0.82,

        effectsVolume: 0.9,

        musicVolume: 0.65,

        ambienceVolume: 0.55,

        voiceVolume: 0.85,

        seekerDistance: Infinity,

        seekerThreat: 0,

        setupDuration: 180,

        setupTimeLeft: 180,

        gameTime: 0,

        paused: false,

        playerAlive: true,

        gateUnlocked: false,

        keyCollected: false,

        buttonsFound: 0,

        totalButtons: 3,

        currentMap: "main",

        lobby: null,

        voiceEnabled: false,

        microphoneStream: null,

        audioContext: null,

        masterGain: null,

        musicGain: null,

        effectsGain: null,

        ambienceGain: null,

        voiceGain: null,

        audioReady: false,

        audioStartedByGesture: false,

        loadedAudio: new Map(),

        activeSources: new Map(),

        procedural: {},

        timers: {},

        intervals: {},

        eventHandlers: new Map(),

        settings: {

            reduceMotion: false,

            highQuality: true,

            subtitles: false,

            screenEffects: true,

            proximityMusic: true,

            footsteps: true,

            ambience: true,

            flashlightSounds: true,

            interactionSounds: true,

            voiceChat: true,

            autoPause: false,

            cameraShake: true

        },

        paths: {

            footstep: "footstep.mp3",

            seekerMusic: "seeker-1980.mp3",

            ambience: "ambience.mp3",

            menuMusic: "menu.mp3",

            caught: "caught.mp3",

            flashlightOn: "flashlight-on.mp3",

            flashlightOff: "flashlight-off.mp3",

            key: "key.mp3",

            button: "button.mp3",

            gate: "gate.mp3",

            uiClick: "click.mp3",

            door: "door.mp3",

            pickup: "pickup.mp3"

        },

        ids: {

            hud: "systemHUD",

            loading: "systemLoading",

            notification: "systemNotification",

            timer: "systemTimer",

            threat: "systemThreat",

            pause: "systemPause",

            caught: "systemCaught",

            platform: "systemPlatform"

        }

    };

    /* =========================================================
       HELPERS
    ========================================================= */

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function random(min, max) {
        return min +
            Math.random() *
            (max - min);
    }

    function now() {
        return performance.now();
    }

    function safeNumber(value, fallback = 0) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function emit(name, detail = {}) {

        try {

            window.dispatchEvent(
                new CustomEvent(
                    name,
                    {
                        detail
                    }
                )
            );

        } catch (error) {

            console.warn(
                "[system.js] Event error:",
                error
            );
        }
    }

    function getElement(id) {

        return document.getElementById(id) ||
            null;
    }

    function createElement(
        tag,
        id,
        parent = document.body
    ) {

        const element =
            document.createElement(tag);

        if (id) {
            element.id = id;
        }

        if (parent) {
            parent.appendChild(element);
        }

        return element;
    }

    function setText(
        element,
        text
    ) {

        if (!element) {
            return;
        }

        element.textContent =
            text;
    }

    /* =========================================================
       EVENT BUS
    ========================================================= */

    System.on =
        function on(
            eventName,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {
                return () => {};
            }

            if (
                !System.eventHandlers.has(
                    eventName
                )
            ) {

                System.eventHandlers.set(
                    eventName,
                    new Set()
                );
            }

            const handlers =
                System.eventHandlers.get(
                    eventName
                );

            handlers.add(
                callback
            );

            return () => {

                handlers.delete(
                    callback
                );
            };
        };

    System.emit =
        function emitLocal(
            eventName,
            data = {}
        ) {

            const handlers =
                System.eventHandlers.get(
                    eventName
                );

            if (handlers) {

                handlers.forEach(
                    callback => {

                        try {
                            callback(data);
                        } catch (error) {
                            console.error(
                                "[system.js] Handler error:",
                                error
                            );
                        }
                    }
                );
            }

            emit(
                `seeker:${eventName}`,
                data
            );
        };

    /* =========================================================
       INITIALIZATION
    ========================================================= */

    System.init =
        async function init(
            options = {}
        ) {

            if (
                System.initialized
            ) {
                return System;
            }

            System.initialized =
                true;

            System.platform =
                options.platform ||
                System.detectPlatform();

            System.loadSettings();

            System.createSystemHUD();

            System.createLoadingOverlay();

            System.createNotifications();

            System.createTimerUI();

            System.createThreatUI();

            System.createPauseUI();

            System.createCaughtUI();

            System.bindEvents();

            System.bindBrowserEvents();

            System.setupInput();

            System.setupAudio();

            System.emit(
                "system-ready",
                {
                    version:
                        System.version
                }
            );

            return System;
        };

    /* =========================================================
       PLATFORM
    ========================================================= */

    System.detectPlatform =
        function detectPlatform() {

            const touch =
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0;

            const narrow =
                window.innerWidth < 900;

            const userAgent =
                navigator.userAgent
                    .toLowerCase();

            const mobileUA =
                /android|iphone|ipad|ipod|mobile/
                    .test(userAgent);

            if (
                mobileUA ||
                (touch && narrow)
            ) {

                return "mobile";
            }

            return "pc";
        };

    System.setPlatform =
        function setPlatform(
            platform
        ) {

            platform =
                String(platform)
                    .toLowerCase();

            if (
                platform !== "pc" &&
                platform !== "mobile"
            ) {
                platform =
                    System.detectPlatform();
            }

            System.platform =
                platform;

            document.body
                .setAttribute(
                    "data-platform",
                    platform
                );

            const element =
                getElement(
                    System.ids.platform
                );

            if (element) {

                setText(
                    element,
                    platform === "mobile"
                        ? "MOBILE"
                        : "PC"
                );
            }

            System.saveSettings();

            System.emit(
                "platform-changed",
                {
                    platform
                }
            );

            emit(
                "seeker:platform",
                {
                    platform
                }
            );

            return platform;
        };

    /* =========================================================
       GAME STATE
    ========================================================= */

    System.setState =
        function setState(
            state,
            data = {}
        ) {

            if (!state) {
                return;
            }

            const previous =
                System.gameState;

            System.gameState =
                state;

            if (
                state === "playing"
            ) {

                System.paused =
                    false;

                System.playerAlive =
                    true;

            } else if (
                state === "caught" ||
                state === "gameover"
            ) {

                System.playerAlive =
                    false;

            } else if (
                state === "paused"
            ) {

                System.paused =
                    true;

            } else {

                System.paused =
                    false;
            }

            System.emit(
                "state-changed",
                {
                    previous,
                    state,
                    ...data
                }
            );
        };

    System.startGame =
        function startGame(
            options = {}
        ) {

            System.currentMap =
                options.map ||
                System.currentMap ||
                "main";

            System.difficulty =
                options.difficulty ||
                System.difficulty;

            System.setupTimeLeft =
                safeNumber(
                    options.setupTime,
                    System.setupDuration
                );

            System.gameTime =
                0;

            System.buttonsFound =
                0;

            System.totalButtons =
                3;

            System.keyCollected =
                false;

            System.gateUnlocked =
                false;

            System.seekerDistance =
                Infinity;

            System.seekerThreat =
                0;

            System.playerAlive =
                true;

            System.paused =
                false;

            System.clearGameTimers();

            System.setState(
                "setup",
                {
                    map:
                        System.currentMap
                }
            );

            System.startSetupTimer();

            System.playMenuMusic(false);

            System.playAmbient();

            System.emit(
                "game-started",
                {
                    map:
                        System.currentMap,
                    platform:
                        System.platform
                }
            );

            emit(
                "seeker:game-start",
                {
                    map:
                        System.currentMap,
                    platform:
                        System.platform
                }
            );

            return true;
        };

    System.beginSeeking =
        function beginSeeking() {

            if (
                !System.playerAlive
            ) {
                return;
            }

            System.setupTimeLeft =
                0;

            System.setState(
                "seeking"
            );

            System.showNotification(
                "THE SEEKER IS AWAKE",
                "danger"
            );

            System.startProximityMusic();

            System.emit(
                "seeker-started",
                {}
            );

            emit(
                "seeker:hunting-started",
                {}
            );
        };

    /* =========================================================
       THREE-MINUTE SETUP TIMER
    ========================================================= */

    System.startSetupTimer =
        function startSetupTimer() {

            System.clearTimer(
                "setup"
            );

            System.updateTimerUI();

            System.timers.setup =
                setInterval(
                    () => {

                        if (
                            System.paused
                        ) {
                            return;
                        }

                        if (
                            System.gameState !==
                                "setup"
                        ) {
                            return;
                        }

                        System.setupTimeLeft =
                            Math.max(
                                0,
                                System.setupTimeLeft -
                                1
                            );

                        System.updateTimerUI();

                        if (
                            System.setupTimeLeft <=
                            0
                        ) {

                            System.clearTimer(
                                "setup"
                            );

                            System.beginSeeking();
                        }
                    },
                    1000
                );
        };

    System.updateTimerUI =
        function updateTimerUI() {

            const timer =
                getElement(
                    System.ids.timer
                );

            if (!timer) {
                return;
            }

            const seconds =
                Math.max(
                    0,
                    Math.ceil(
                        System.setupTimeLeft
                    )
                );

            const minutes =
                Math.floor(
                    seconds / 60
                );

            const remainingSeconds =
                seconds % 60;

            const formatted =
                `${String(minutes)
                    .padStart(2, "0")}:${String(
                        remainingSeconds
                    ).padStart(2, "0")}`;

            setText(
                timer,
                formatted
            );

            timer.classList.toggle(
                "warning",
                seconds <= 30
            );

            timer.classList.toggle(
                "critical",
                seconds <= 10
            );
        };

    /* =========================================================
       GAME TIMER
    ========================================================= */

    System.updateGameTime =
        function updateGameTime(
            delta
        ) {

            if (
                System.paused ||
                !System.playerAlive
            ) {
                return;
            }

            if (
                System.gameState !==
                    "setup" &&
                System.gameState !==
                    "seeking"
            ) {
                return;
            }

            System.gameTime +=
                delta;
        };

    /* =========================================================
       AUDIO INITIALIZATION
    ========================================================= */

    System.setupAudio =
        function setupAudio() {

            try {

                const AudioContext =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (
                    !AudioContext
                ) {
                    return;
                }

                System.audioContext =
                    new AudioContext();

                System.masterGain =
                    System.audioContext
                        .createGain();

                System.musicGain =
                    System.audioContext
                        .createGain();

                System.effectsGain =
                    System.audioContext
                        .createGain();

                System.ambienceGain =
                    System.audioContext
                        .createGain();

                System.voiceGain =
                    System.audioContext
                        .createGain();

                System.masterGain.gain.value =
                    System.masterVolume;

                System.musicGain.gain.value =
                    System.musicVolume;

                System.effectsGain.gain.value =
                    System.effectsVolume;

                System.ambienceGain.gain.value =
                    System.ambienceVolume;

                System.voiceGain.gain.value =
                    System.voiceVolume;

                System.musicGain.connect(
                    System.masterGain
                );

                System.effectsGain.connect(
                    System.masterGain
                );

                System.ambienceGain.connect(
                    System.masterGain
                );

                System.voiceGain.connect(
                    System.masterGain
                );

                System.masterGain.connect(
                    System.audioContext.destination
                );

                System.audioReady =
                    true;

            } catch (error) {

                console.warn(
                    "[system.js] Web Audio unavailable:",
                    error
                );

                System.audioReady =
                    false;
            }
        };

    /* =========================================================
       AUDIO UNLOCK
    ========================================================= */

    System.unlockAudio =
        async function unlockAudio() {

            System.audioStartedByGesture =
                true;

            if (
                !System.audioContext
            ) {

                System.setupAudio();
            }

            if (
                !System.audioContext
            ) {
                return false;
            }

            try {

                if (
                    System.audioContext.state ===
                        "suspended"
                ) {

                    await System.audioContext
                        .resume();
                }

                System.audioReady =
                    true;

                return true;

            } catch (error) {

                console.warn(
                    "[system.js] Audio resume failed:",
                    error
                );

                return false;
            }
        };

    /* =========================================================
       LOAD AUDIO FILE
    ========================================================= */

    System.loadAudio =
        async function loadAudio(
            name,
            src
        ) {

            if (
                System.loadedAudio.has(
                    name
                )
            ) {

                return System.loadedAudio
                    .get(name);
            }

            const audio =
                new Audio();

            audio.preload =
                "auto";

            audio.src =
                src;

            audio.loop =
                false;

            audio.volume =
                1;

            audio.setAttribute(
                "playsinline",
                ""
            );

            audio.load();

            System.loadedAudio.set(
                name,
                audio
            );

            return audio;
        };

    /* =========================================================
       PLAY FILE AUDIO
    ========================================================= */

    System.playFile =
        async function playFile(
            name,
            options = {}
        ) {

            if (
                System.muted
            ) {
                return null;
            }

            const src =
                options.src ||
                System.paths[name];

            if (!src) {
                return null;
            }

            await System.unlockAudio();

            let audio =
                System.loadedAudio.get(
                    name
                );

            if (!audio) {

                audio =
                    await System.loadAudio(
                        name,
                        src
                    );
            }

            if (!audio) {
                return null;
            }

            try {

                audio.pause();

                audio.currentTime =
                    options.startTime ||
                    0;

                audio.loop =
                    Boolean(
                        options.loop
                    );

                const baseVolume =
                    options.volume !==
                        undefined
                        ? options.volume
                        : 1;

                audio.volume =
                    clamp(
                        baseVolume *
                        System.getCategoryVolume(
                            options.category
                        ),
                        0,
                        1
                    );

                const result =
                    await audio.play();

                System.activeSources.set(
                    name,
                    audio
                );

                return audio;

            } catch (error) {

                /*
                 * A missing optional MP3 should not
                 * break the whole game.
                 */

                console.warn(
                    `[system.js] Could not play ${name}:`,
                    error
                );

                return null;
            }
        };

    /* =========================================================
       CATEGORY VOLUME
    ========================================================= */

    System.getCategoryVolume =
        function getCategoryVolume(
            category
        ) {

            switch (
                category
            ) {

                case "music":
                    return System.musicVolume;

                case "effects":
                    return System.effectsVolume;

                case "ambience":
                    return System.ambienceVolume;

                case "voice":
                    return System.voiceVolume;

                default:
                    return 1;
            }
        };

    /* =========================================================
       FOOTSTEP AUDIO
    ========================================================= */

    System.playFootstep =
        function playFootstep(
            intensity = 1
        ) {

            if (
                !System.settings.footsteps ||
                System.muted ||
                !System.playerAlive
            ) {
                return;
            }

            intensity =
                clamp(
                    intensity,
                    0,
                    2
                );

            const audio =
                System.loadedAudio.get(
                    "footstep"
                );

            if (audio) {

                const clone =
                    audio.cloneNode();

                clone.volume =
                    clamp(
                        0.32 *
                        intensity *
                        System.effectsVolume,
                        0,
                        1
                    );

                clone.play().catch(
                    () => {}
                );

                return;
            }

            /*
             * Procedural footstep fallback.
             */

            System.proceduralFootstep(
                intensity
            );
        };

    /* =========================================================
       PROCEDURAL FOOTSTEP
    ========================================================= */

    System.proceduralFootstep =
        function proceduralFootstep(
            intensity = 1
        ) {

            if (
                !System.audioContext ||
                System.muted
            ) {
                return;
            }

            const ctx =
                System.audioContext;

            const oscillator =
                ctx.createOscillator();

            const gain =
                ctx.createGain();

            const filter =
                ctx.createBiquadFilter();

            oscillator.type =
                "triangle";

            oscillator.frequency.value =
                random(
                    65,
                    95
                );

            filter.type =
                "lowpass";

            filter.frequency.value =
                700;

            gain.gain.setValueAtTime(
                0.0001,
                ctx.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.16 *
                intensity *
                System.effectsVolume,
                ctx.currentTime +
                0.008
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                ctx.currentTime +
                0.09
            );

            oscillator.connect(
                filter
            );

            filter.connect(
                gain
            );

            gain.connect(
                System.effectsGain
            );

            oscillator.start();

            oscillator.stop(
                ctx.currentTime +
                0.11
            );
        };

    /* =========================================================
       FOOTSTEP SEQUENCER
    ========================================================= */

    System.footstepInterval =
        null;

    System.setPlayerMoving =
        function setPlayerMoving(
            moving,
            speed = 1
        ) {

            System.playerMoving =
                Boolean(moving);

            System.playerSpeed =
                safeNumber(
                    speed,
                    1
                );

            if (
                !moving
            ) {

                if (
                    System.footstepInterval
                ) {

                    clearInterval(
                        System.footstepInterval
                    );

                    System.footstepInterval =
                        null;
                }

                return;
            }

            if (
                System.footstepInterval
            ) {
                return;
            }

            const interval =
                clamp(
                    560 /
                    Math.max(
                        0.2,
                        System.playerSpeed
                    ),
                    230,
                    650
                );

            System.playFootstep(
                0.7
            );

            System.footstepInterval =
                setInterval(
                    () => {

                        if (
                            !System.paused &&
                            System.playerAlive
                        ) {

                            System.playFootstep(
                                clamp(
                                    System.playerSpeed,
                                    0.5,
                                    1.4
                                )
                            );
                        }
                    },
                    interval
                );
        };

    /* =========================================================
       FLASHLIGHT SOUNDS
    ========================================================= */

    System.flashlightOn =
        function flashlightOn() {

            System.playFile(
                "flashlightOn",
                {
                    category:
                        "effects",
                    volume:
                        0.45
                }
            );

            System.emit(
                "flashlight-on"
            );
        };

    System.flashlightOff =
        function flashlightOff() {

            System.playFile(
                "flashlightOff",
                {
                    category:
                        "effects",
                    volume:
                        0.4
                }
            );

            System.emit(
                "flashlight-off"
            );
        };

    /* =========================================================
       MENU MUSIC
    ========================================================= */

    System.playMenuMusic =
        function playMenuMusic(
            enabled = true
        ) {

            if (!enabled) {

                System.stopAudio(
                    "menuMusic"
                );

                return;
            }

            if (
                !System.audioStartedByGesture
            ) {
                return;
            }

            return System.playFile(
                "menuMusic",
                {
                    category:
                        "music",
                    volume:
                        0.42,
                    loop:
                        true
                }
            );
        };

    /* =========================================================
       AMBIENCE
    ========================================================= */

    System.playAmbient =
        function playAmbient() {

            if (
                !System.settings.ambience
            ) {
                return;
            }

            if (
                !System.audioStartedByGesture
            ) {
                return;
            }

            return System.playFile(
                "ambience",
                {
                    category:
                        "ambience",
                    volume:
                        0.5,
                    loop:
                        true
                }
            );
        };

    /* =========================================================
       SEEKER PROXIMITY MUSIC
    ========================================================= */

    System.startProximityMusic =
        function startProximityMusic() {

            if (
                !System.settings.proximityMusic
            ) {
                return;
            }

            if (
                !System.audioStartedByGesture
            ) {
                return;
            }

            if (
                System.activeSources.has(
                    "seekerMusic"
                )
            ) {
                return;
            }

            const audio =
                System.playFile(
                    "seekerMusic",
                    {
                        category:
                            "music",
                        volume:
                            0,
                        loop:
                            true
                    }
                );

            System.proximityAudio =
                audio;

            return audio;
        };

    System.updateProximityMusic =
        function updateProximityMusic(
            delta
        ) {

            if (
                !System.settings.proximityMusic
            ) {
                return;
            }

            if (
                !System.playerAlive
            ) {
                return;
            }

            const distance =
                System.seekerDistance;

            /*
             * 0 = safe
             * 1 = extremely close
             */

            let threat;

            if (
                !Number.isFinite(
                    distance
                )
            ) {

                threat = 0;

            } else {

                threat =
                    1 -
                    clamp(
                        (
                            distance -
                            2
                        ) / 25,
                        0,
                        1
                    );
            }

            /*
             * Smooth response.
             */

            System.seekerThreat =
                lerp(
                    System.seekerThreat,
                    threat,
                    1 -
                    Math.pow(
                        0.001,
                        delta
                    )
                );

            const amount =
                System.seekerThreat;

            const audio =
                System.proximityAudio ||
                System.loadedAudio.get(
                    "seekerMusic"
                );

            if (
                audio
            ) {

                audio.volume =
                    clamp(
                        amount *
                        0.92 *
                        System.musicVolume,
                        0,
                        1
                    );
            }

            /*
             * Procedural emergency layer.
             */

            if (
                amount > 0.55
            ) {

                System.startThreatDrone();

            } else {

                System.stopThreatDrone();
            }

            /*
             * Send the value to details.js.
             */

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails
                        .setSeekerThreat ===
                    "function"
            ) {

                window.SeekerDetails
                    .setSeekerThreat(
                        amount
                    );
            }

            if (
                amount > 0.82
            ) {

                System.emit(
                    "high-threat",
                    {
                        amount
                    }
                );
            }
        };

    /* =========================================================
       PROCEDURAL THREAT DRONE
    ========================================================= */

    System.startThreatDrone =
        function startThreatDrone() {

            if (
                System.procedural
                    .threatDrone
            ) {
                return;
            }

            if (
                !System.audioContext
            ) {
                return;
            }

            const ctx =
                System.audioContext;

            const oscillatorA =
                ctx.createOscillator();

            const oscillatorB =
                ctx.createOscillator();

            const gain =
                ctx.createGain();

            const filter =
                ctx.createBiquadFilter();

            oscillatorA.type =
                "sawtooth";

            oscillatorB.type =
                "sine";

            oscillatorA.frequency.value =
                42;

            oscillatorB.frequency.value =
                46;

            filter.type =
                "lowpass";

            filter.frequency.value =
                260;

            gain.gain.value =
                0.0001;

            oscillatorA.connect(
                filter
            );

            oscillatorB.connect(
                filter
            );

            filter.connect(
                gain
            );

            gain.connect(
                System.musicGain
            );

            oscillatorA.start();

            oscillatorB.start();

            gain.gain.exponentialRampToValueAtTime(
                0.08 *
                System.musicVolume,
                ctx.currentTime +
                0.8
            );

            System.procedural
                .threatDrone =
                {
                    oscillatorA,
                    oscillatorB,
                    gain,
                    filter
                };
        };

    System.stopThreatDrone =
        function stopThreatDrone() {

            const drone =
                System.procedural
                    .threatDrone;

            if (!drone) {
                return;
            }

            try {

                const ctx =
                    System.audioContext;

                drone.gain.gain
                    .exponentialRampToValueAtTime(
                        0.0001,
                        ctx.currentTime +
                        0.35
                    );

                setTimeout(
                    () => {

                        try {
                            drone.oscillatorA.stop();
                        } catch {}

                        try {
                            drone.oscillatorB.stop();
                        } catch {}

                    },
                    400
                );

            } catch {}

            System.procedural
                .threatDrone =
                null;
        };

    /* =========================================================
       STOP AUDIO
    ========================================================= */

    System.stopAudio =
        function stopAudio(
            name
        ) {

            const source =
                System.activeSources.get(
                    name
                );

            if (!source) {
                return;
            }

            try {
                source.pause();
                source.currentTime =
                    0;
            } catch {}

            System.activeSources.delete(
                name
            );
        };

    System.stopAllAudio =
        function stopAllAudio() {

            System.activeSources
                .forEach(
                    audio => {

                        try {
                            audio.pause();
                            audio.currentTime =
                                0;
                        } catch {}
                    }
                );

            System.activeSources.clear();

            System.stopThreatDrone();
        };

    /* =========================================================
       MUTE
    ========================================================= */

    System.setMuted =
        function setMuted(
            muted
        ) {

            System.muted =
                Boolean(muted);

            if (
                System.masterGain
            ) {

                System.masterGain.gain.value =
                    System.muted
                        ? 0
                        : System.masterVolume;
            }

            System.emit(
                "mute-changed",
                {
                    muted:
                        System.muted
                }
            );
        };

    /* =========================================================
       BUTTON SYSTEM
    ========================================================= */

    System.registerButton =
        function registerButton(
            buttonId
        ) {

            if (!buttonId) {
                return false;
            }

            System.buttonsFound =
                clamp(
                    System.buttonsFound +
                    1,
                    0,
                    System.totalButtons
                );

            System.playFile(
                "button",
                {
                    category:
                        "effects",
                    volume:
                        0.7
                }
            );

            System.showNotification(
                `BUTTON FOUND ${System.buttonsFound}/${System.totalButtons}`,
                "success"
            );

            System.emit(
                "button-found",
                {
                    buttonId,
                    count:
                        System.buttonsFound,
                    total:
                        System.totalButtons
                }
            );

            emit(
                "seeker:button-found",
                {
                    buttonId,
                    count:
                        System.buttonsFound,
                    total:
                        System.totalButtons
                }
            );

            return true;
        };

    /* =========================================================
       KEY SYSTEM
    ========================================================= */

    System.collectKey =
        function collectKey() {

            if (
                System.keyCollected
            ) {
                return false;
            }

            if (
                System.buttonsFound <
                System.totalButtons
            ) {

                System.showNotification(
                    "YOU NEED ALL 3 BUTTONS",
                    "danger"
                );

                return false;
            }

            System.keyCollected =
                true;

            System.playFile(
                "key",
                {
                    category:
                        "effects",
                    volume:
                        0.8
                }
            );

            System.showNotification(
                "KEY ACQUIRED",
                "success"
            );

            System.emit(
                "key-collected",
                {}
            );

            return true;
        };

    /* =========================================================
       GATE SYSTEM
    ========================================================= */

    System.unlockGate =
        function unlockGate() {

            if (
                System.gateUnlocked
            ) {
                return false;
            }

            if (
                !System.keyCollected
            ) {

                System.showNotification(
                    "THE GATE IS LOCKED",
                    "danger"
                );

                return false;
            }

            System.gateUnlocked =
                true;

            System.playFile(
                "gate",
                {
                    category:
                        "effects",
                    volume:
                        0.85
                }
            );

            System.showNotification(
                "GATE UNLOCKED",
                "success"
            );

            System.emit(
                "gate-unlocked",
                {}
            );

            emit(
                "seeker:gate-unlocked",
                {}
            );

            return true;
        };

    /* =========================================================
       DOOR SOUND
    ========================================================= */

    System.playDoorSound =
        function playDoorSound(
            open = true
        ) {

            System.playFile(
                "door",
                {
                    category:
                        "effects",
                    volume:
                        open
                            ? 0.75
                            : 0.58
                }
            );
        };

    /* =========================================================
       PICKUP
    ========================================================= */

    System.playPickup =
        function playPickup() {

            System.playFile(
                "pickup",
                {
                    category:
                        "effects",
                    volume:
                        0.55
                }
            );
        };

    /* =========================================================
       SEER / SEEKER DISTANCE
    ========================================================= */

    System.setSeekerDistance =
        function setSeekerDistance(
            distance
        ) {

            System.seekerDistance =
                safeNumber(
                    distance,
                    Infinity
                );
        };

    /* =========================================================
       GAME LOOP
    ========================================================= */

    System.update =
        function update(
            delta = 0.016
        ) {

            delta =
                clamp(
                    safeNumber(
                        delta,
                        0.016
                    ),
                    0,
                    0.1
                );

            if (
                System.initialized
            ) {

                System.updateGameTime(
                    delta
                );

                if (
                    !System.paused
                ) {

                    System.updateProximityMusic(
                        delta
                    );

                    System.updateScreenEffects(
                        delta
                    );
                }

                /*
                 * Keep SeekerDetails synchronized.
                 */

                if (
                    window.SeekerDetails &&
                    typeof
                        window.SeekerDetails
                            .update ===
                        "function"
                ) {

                    window.SeekerDetails
                        .update(
                            delta,
                            System.gameTime
                        );
                }
            }
        };

    /* =========================================================
       SCREEN EFFECTS
    ========================================================= */

    System.updateScreenEffects =
        function updateScreenEffects(
            delta
        ) {

            if (
                !System.settings.screenEffects
            ) {
                return;
            }

            const threat =
                System.seekerThreat;

            const caught =
                getElement(
                    System.ids.caught
                );

            if (
                caught &&
                threat > 0
            ) {

                const intensity =
                    threat * 0.18;

                caught.style.boxShadow =
                    `inset 0 0 100px rgba(130,0,0,${intensity})`;

                caught.style.opacity =
                    String(
                        clamp(
                            threat *
                            0.22,
                            0,
                            0.22
                        )
                    );
            }
        };

    /* =========================================================
       GAME CAUGHT
    ========================================================= */

    System.playerCaught =
        function playerCaught(
            reason = "seeker"
        ) {

            if (
                !System.playerAlive
            ) {
                return;
            }

            System.playerAlive =
                false;

            System.setState(
                "caught",
                {
                    reason
                }
            );

            System.clearGameTimers();

            System.stopAudio(
                "seekerMusic"
            );

            System.playFile(
                "caught",
                {
                    category:
                        "effects",
                    volume:
                        0.9
                }
            );

            System.showCaughtScreen();

            System.emit(
                "player-caught",
                {
                    reason
                }
            );

            emit(
                "seeker:player-caught",
                {
                    reason
                }
            );

            if (
                window.SeekerDetails
            ) {

                if (
                    typeof
                        window.SeekerDetails
                            .cameraShake ===
                    "function"
                ) {

                    window.SeekerDetails
                        .cameraShake(
                            0.12,
                            0.5
                        );
                }
            }
        };

    /* =========================================================
       WIN
    ========================================================= */

    System.playerEscaped =
        function playerEscaped() {

            if (
                !System.playerAlive
            ) {
                return false;
            }

            System.setState(
                "escaped"
            );

            System.stopAllAudio();

            System.showNotification(
                "YOU ESCAPED",
                "success",
                4500
            );

            System.emit(
                "player-escaped",
                {}
            );

            emit(
                "seeker:player-escaped",
                {}
            );

            return true;
        };

    /* =========================================================
       PAUSE
    ========================================================= */

    System.togglePause =
        function togglePause() {

            if (
                System.gameState !==
                    "playing" &&
                System.gameState !==
                    "setup" &&
                System.gameState !==
                    "seeking"
            ) {
                return;
            }

            if (
                System.paused
            ) {

                System.resume();

            } else {

                System.pause();
            }
        };

    System.pause =
        function pause() {

            if (
                System.paused
            ) {
                return;
            }

            System.paused =
                true;

            System.setState(
                "paused"
            );

            System.showPause();

            System.emit(
                "paused",
                {}
            );
        };

    System.resume =
        function resume() {

            if (
                !System.paused
            ) {
                return;
            }

            System.paused =
                false;

            if (
                System.setupTimeLeft > 0
            ) {

                System.setState(
                    "setup"
                );

            } else {

                System.setState(
                    "seeking"
                );
            }

            System.hidePause();

            System.emit(
                "resumed",
                {}
            );
        };

    /* =========================================================
       LOADING UI
    ========================================================= */

    System.createLoadingOverlay =
        function createLoadingOverlay() {

            if (
                getElement(
                    System.ids.loading
                )
            ) {
                return;
            }

            const overlay =
                createElement(
                    "div",
                    System.ids.loading
                );

            overlay.innerHTML = `
                <div class="system-loading-box">
                    <div class="system-loading-brand">
                        BLACKHOLLOW GAMES
                    </div>
                    <div class="system-loading-title">
                        THE SEEKER
                    </div>
                    <div class="system-loading-bar">
                        <div class="system-loading-progress"></div>
                    </div>
                    <div class="system-loading-status">
                        INITIALIZING
                    </div>
                </div>
            `;

            Object.assign(
                overlay.style,
                {
                    position: "fixed",
                    inset: "0",
                    zIndex: "99999",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#050505",
                    color: "#e9e4d5",
                    fontFamily:
                        "system-ui, sans-serif",
                    transition:
                        "opacity .45s ease"
                }
            );

            this.injectSystemStyles();
        };

    System.setLoading =
        function setLoading(
            progress = 0,
            status = "LOADING"
        ) {

            const overlay =
                getElement(
                    System.ids.loading
                );

            if (!overlay) {
                return;
            }

            const bar =
                overlay.querySelector(
                    ".system-loading-progress"
                );

            const label =
                overlay.querySelector(
                    ".system-loading-status"
                );

            if (bar) {

                bar.style.width =
                    `${clamp(
                        progress,
                        0,
                        100
                    )}%`;
            }

            setText(
                label,
                status
            );
        };

    System.hideLoading =
        function hideLoading() {

            const overlay =
                getElement(
                    System.ids.loading
                );

            if (!overlay) {
                return;
            }

            overlay.style.opacity =
                "0";

            setTimeout(
                () => {

                    overlay.style.pointerEvents =
                        "none";

                    overlay.style.visibility =
                        "hidden";

                },
                500
            );
        };

    /* =========================================================
       SYSTEM HUD
    ========================================================= */

    System.createSystemHUD =
        function createSystemHUD() {

            if (
                getElement(
                    System.ids.hud
                )
            ) {
                return;
            }

            const hud =
                createElement(
                    "div",
                    System.ids.hud
                );

            Object.assign(
                hud.style,
                {
                    position: "fixed",
                    inset: "0",
                    pointerEvents: "none",
                    zIndex: "6000"
                }
            );

            const platform =
                createElement(
                    "div",
                    System.ids.platform,
                    hud
                );

            Object.assign(
                platform.style,
                {
                    position: "absolute",
                    right: "16px",
                    top: "14px",
                    font:
                        "700 10px system-ui",
                    letterSpacing:
                        "2px",
                    color:
                        "rgba(255,255,255,.4)"
                }
            );

            this.setPlatform(
                this.platform
            );
        };

    /* =========================================================
       TIMER UI
    ========================================================= */

    System.createTimerUI =
        function createTimerUI() {

            const hud =
                getElement(
                    System.ids.hud
                );

            if (!hud) {
                return;
            }

            const wrapper =
                createElement(
                    "div",
                    "systemSetupTimer",
                    hud
                );

            Object.assign(
                wrapper.style,
                {
                    position: "absolute",
                    top: "18px",
                    left: "50%",
                    transform:
                        "translateX(-50%)",
                    minWidth: "135px",
                    textAlign: "center",
                    opacity: "0",
                    transition:
                        "opacity .2s ease"
                }
            );

            const label =
                createElement(
                    "div",
                    null,
                    wrapper
                );

            setText(
                label,
                "SEEKER AWAKENS IN"
            );

            Object.assign(
                label.style,
                {
                    font:
                        "700 9px system-ui",
                    letterSpacing:
                        "2px",
                    color:
                        "rgba(255,255,255,.55)"
                }
            );

            const timer =
                createElement(
                    "div",
                    System.ids.timer,
                    wrapper
                );

            Object.assign(
                timer.style,
                {
                    marginTop: "4px",
                    font:
                        "800 26px monospace",
                    letterSpacing:
                        "3px",
                    color: "#e7e1d2",
                    textShadow:
                        "0 3px 16px rgba(0,0,0,.5)"
                }
            );

            System.timerWrapper =
                wrapper;
        };

    /* =========================================================
       THREAT UI
    ========================================================= */

    System.createThreatUI =
        function createThreatUI() {

            const hud =
                getElement(
                    System.ids.hud
                );

            if (!hud) {
                return;
            }

            const threat =
                createElement(
                    "div",
                    System.ids.threat,
                    hud
                );

            Object.assign(
                threat.style,
                {
                    position: "absolute",
                    inset: "0",
                    pointerEvents: "none",
                    border:
                        "0 solid rgba(150,0,0,0)",
                    transition:
                        "border-width .1s linear"
                }
            );

            System.threatOverlay =
                threat;
        };

    /* =========================================================
       NOTIFICATION UI
    ========================================================= */

    System.createNotifications =
        function createNotifications() {

            const hud =
                getElement(
                    System.ids.hud
                );

            if (!hud) {
                return;
            }

            const notification =
                createElement(
                    "div",
                    System.ids.notification,
                    hud
                );

            Object.assign(
                notification.style,
                {
                    position: "absolute",
                    left: "50%",
                    bottom: "15%",
                    transform:
                        "translate(-50%, 12px)",
                    opacity: "0",
                    padding:
                        "11px 16px",
                    border:
                        "1px solid rgba(255,255,255,.15)",
                    background:
                        "rgba(5,5,5,.86)",
                    backdropFilter:
                        "blur(12px)",
                    color: "#eee",
                    font:
                        "700 11px system-ui",
                    letterSpacing:
                        "1.5px",
                    transition:
                        "opacity .18s ease, transform .18s ease"
                }
            );
        };

    System.showNotification =
        function showNotification(
            message,
            type = "normal",
            duration = 2400
        ) {

            const box =
                getElement(
                    System.ids.notification
                );

            if (!box) {
                return;
            }

            setText(
                box,
                message
            );

            if (
                type === "danger"
            ) {

                box.style.borderColor =
                    "rgba(179,48,48,.65)";

                box.style.color =
                    "#d98b8b";

            } else if (
                type === "success"
            ) {

                box.style.borderColor =
                    "rgba(42,138,74,.65)";

                box.style.color =
                    "#9ad0aa";

            } else {

                box.style.borderColor =
                    "rgba(255,255,255,.15)";

                box.style.color =
                    "#eee";
            }

            box.style.opacity =
                "1";

            box.style.transform =
                "translate(-50%, 0)";

            if (
                System.timers.notification
            ) {

                clearTimeout(
                    System.timers.notification
                );
            }

            System.timers.notification =
                setTimeout(
                    () => {

                        box.style.opacity =
                            "0";

                        box.style.transform =
                            "translate(-50%, 12px)";

                    },
                    duration
                );
        };

    /* =========================================================
       PAUSE UI
    ========================================================= */

    System.createPauseUI =
        function createPauseUI() {

            const overlay =
                createElement(
                    "div",
                    System.ids.pause
                );

            overlay.innerHTML = `
                <div class="system-pause-box">
                    <div class="system-pause-title">
                        PAUSED
                    </div>
                    <button data-system-resume>
                        RESUME
                    </button>
                    <button data-system-menu>
                        MAIN MENU
                    </button>
                </div>
            `;

            Object.assign(
                overlay.style,
                {
                    position: "fixed",
                    inset: "0",
                    zIndex: "9000",
                    display: "none",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                        "rgba(0,0,0,.76)",
                    backdropFilter:
                        "blur(5px)",
                    fontFamily:
                        "system-ui, sans-serif"
                }
            );

            overlay.querySelector(
                "[data-system-resume]"
            ).addEventListener(
                "click",
                () => {
                    System.resume();
                }
            );

            overlay.querySelector(
                "[data-system-menu]"
            ).addEventListener(
                "click",
                () => {
                    System.returnToMenu();
                }
            );
        };

    System.showPause =
        function showPause() {

            const overlay =
                getElement(
                    System.ids.pause
                );

            if (!overlay) {
                return;
            }

            overlay.style.display =
                "flex";
        };

    System.hidePause =
        function hidePause() {

            const overlay =
                getElement(
                    System.ids.pause
                );

            if (!overlay) {
                return;
            }

            overlay.style.display =
                "none";
        };

    /* =========================================================
       CAUGHT UI
    ========================================================= */

    System.createCaughtUI =
        function createCaughtUI() {

            const caught =
                createElement(
                    "div",
                    System.ids.caught
                );

            caught.innerHTML = `
                <div class="system-caught-box">
                    <div class="system-caught-title">
                        YOU WERE CAUGHT
                    </div>
                    <div class="system-caught-subtitle">
                        THE SEEKER FOUND YOU
                    </div>
                    <div class="system-caught-actions">
                        <button data-system-retry>
                            TRY AGAIN
                        </button>
                        <button data-system-menu>
                            MAIN MENU
                        </button>
                    </div>
                </div>
            `;

            Object.assign(
                caught.style,
                {
                    position: "fixed",
                    inset: "0",
                    zIndex: "9500",
                    display: "none",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                        "rgba(6,0,0,.93)",
                    color: "#eee",
                    opacity: "0",
                    transition:
                        "opacity .35s ease",
                    fontFamily:
                        "system-ui, sans-serif",
                    pointerEvents: "none"
                }
            );

            const retry =
                caught.querySelector(
                    "[data-system-retry]"
                );

            const menu =
                caught.querySelector(
                    "[data-system-menu]"
                );

            retry.addEventListener(
                "click",
                () => {

                    System.hideCaughtScreen();

                    System.emit(
                        "retry-requested",
                        {}
                    );
                }
            );

            menu.addEventListener(
                "click",
                () => {

                    System.hideCaughtScreen();

                    System.returnToMenu();
                }
            );
        };

    System.showCaughtScreen =
        function showCaughtScreen() {

            const overlay =
                getElement(
                    System.ids.caught
                );

            if (!overlay) {
                return;
            }

            overlay.style.display =
                "flex";

            overlay.style.pointerEvents =
                "auto";

            requestAnimationFrame(
                () => {

                    overlay.style.opacity =
                        "1";
                }
            );
        };

    System.hideCaughtScreen =
        function hideCaughtScreen() {

            const overlay =
                getElement(
                    System.ids.caught
                );

            if (!overlay) {
                return;
            }

            overlay.style.opacity =
                "0";

            overlay.style.pointerEvents =
                "none";

            setTimeout(
                () => {

                    overlay.style.display =
                        "none";

                },
                350
            );
        };

    /* =========================================================
       RETURN TO MENU
    ========================================================= */

    System.returnToMenu =
        function returnToMenu() {

            System.clearGameTimers();

            System.stopAllAudio();

            System.paused =
                false;

            System.playerAlive =
                true;

            System.setState(
                "menu"
            );

            System.hideCaughtScreen();
            System.hidePause();

            System.emit(
                "return-to-menu",
                {}
            );

            emit(
                "seeker:return-to-menu",
                {}
            );
        };

    /* =========================================================
       INPUT
    ========================================================= */

    System.setupInput =
        function setupInput() {

            window.addEventListener(
                "keydown",
                event => {

                    /*
                     * Escape = pause.
                     */

                    if (
                        event.code ===
                        "Escape"
                    ) {

                        event.preventDefault();

                        if (
                            System.gameState ===
                                "playing" ||
                            System.gameState ===
                                "setup" ||
                            System.gameState ===
                                "seeking" ||
                            System.gameState ===
                                "paused"
                        ) {

                            System.togglePause();
                        }
                    }

                    /*
                     * Number 1 = flashlight.
                     */

                    if (
                        event.code ===
                        "Digit1"
                    ) {

                        System.selectFlashlight();
                    }

                    /*
                     * F = flashlight.
                     */

                    if (
                        event.code ===
                        "KeyF"
                    ) {

                        System.toggleFlashlight();
                    }
                }
            );
        };

    /* =========================================================
       FLASHLIGHT BRIDGE
    ========================================================= */

    System.selectFlashlight =
        function selectFlashlight() {

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails
                        .selectFlashlightSlot ===
                    "function"
            ) {

                window.SeekerDetails
                    .selectFlashlightSlot();
            }

            System.emit(
                "flashlight-selected",
                {
                    slot: 1
                }
            );
        };

    System.toggleFlashlight =
        function toggleFlashlight() {

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails
                        .isFlashlightVisible ===
                    "function"
            ) {

                const visible =
                    window.SeekerDetails
                        .isFlashlightVisible();

                if (!visible) {

                    System.selectFlashlight();

                    return;
                }
            }

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails
                        .toggleFlashlight ===
                    "function"
            ) {

                const enabled =
                    window.SeekerDetails
                        .toggleFlashlight();

                if (enabled) {
                    System.flashlightOn();
                } else {
                    System.flashlightOff();
                }
            } else {

                emit(
                    "seeker:toggle-flashlight"
                );
            }
        };

    /* =========================================================
       BROWSER EVENTS
    ========================================================= */

    System.bindBrowserEvents =
        function bindBrowserEvents() {

            /*
             * Browser autoplay protection.
             */

            const unlock =
                () => {

                    System.unlockAudio();

                    document.removeEventListener(
                        "pointerdown",
                        unlock
                    );

                    document.removeEventListener(
                        "keydown",
                        unlock
                    );
                };

            document.addEventListener(
                "pointerdown",
                unlock,
                {
                    once: false,
                    passive: true
                }
            );

            document.addEventListener(
                "keydown",
                unlock,
                {
                    once: false,
                    passive: true
                }
            );

            document.addEventListener(
                "visibilitychange",
                () => {

                    if (
                        document.hidden
                    ) {

                        if (
                            System.settings.autoPause &&
                            System.playerAlive
                        ) {

                            System.pause();
                        }
                    }
                }
            );

            window.addEventListener(
                "resize",
                () => {

                    System.emit(
                        "resize",
                        {
                            width:
                                window.innerWidth,
                            height:
                                window.innerHeight
                        }
                    );
                }
            );
        };

    /* =========================================================
       GAME EVENTS
    ========================================================= */

    System.bindEvents =
        function bindEvents() {

            window.addEventListener(
                "seeker:player-moving",
                event => {

                    const data =
                        event.detail ||
                        {};

                    System.setPlayerMoving(
                        data.moving,
                        data.speed
                    );
                }
            );

            window.addEventListener(
                "seeker:seeker-distance",
                event => {

                    const data =
                        event.detail ||
                        {};

                    System.setSeekerDistance(
                        data.distance
                    );
                }
            );

            window.addEventListener(
                "seeker:button",
                event => {

                    const data =
                        event.detail ||
                        {};

                    System.registerButton(
                        data.id ||
                        `button-${System.buttonsFound + 1}`
                    );
                }
            );

            window.addEventListener(
                "seeker:key",
                () => {

                    System.collectKey();
                }
            );

            window.addEventListener(
                "seeker:gate",
                () => {

                    System.unlockGate();
                }
            );

            window.addEventListener(
                "seeker:player-caught",
                event => {

                    const data =
                        event.detail ||
                        {};

                    System.playerCaught(
                        data.reason ||
                        "seeker"
                    );
                }
            );

            window.addEventListener(
                "seeker:player-escaped",
                () => {

                    System.playerEscaped();
                }
            );

            window.addEventListener(
                "seeker:flashlight-on",
                () => {

                    System.flashlightOn();
                }
            );

            window.addEventListener(
                "seeker:flashlight-off",
                () => {

                    System.flashlightOff();
                }
            );
        };

    /* =========================================================
       SETTINGS
    ========================================================= */

    System.storageKey =
        "the_seeker_settings";

    System.loadSettings =
        function loadSettings() {

            try {

                const raw =
                    localStorage.getItem(
                        System.storageKey
                    );

                if (!raw) {
                    return;
                }

                const parsed =
                    JSON.parse(raw);

                if (
                    parsed &&
                    typeof parsed ===
                        "object"
                ) {

                    if (
                        parsed.settings
                    ) {

                        Object.assign(
                            System.settings,
                            parsed.settings
                        );
                    }

                    if (
                        typeof parsed.platform ===
                            "string"
                    ) {

                        System.platform =
                            parsed.platform;
                    }

                    if (
                        typeof parsed.muted ===
                            "boolean"
                    ) {

                        System.muted =
                            parsed.muted;
                    }

                    System.masterVolume =
                        clamp(
                            safeNumber(
                                parsed.masterVolume,
                                System.masterVolume
                            ),
                            0,
                            1
                        );

                    System.musicVolume =
                        clamp(
                            safeNumber(
                                parsed.musicVolume,
                                System.musicVolume
                            ),
                            0,
                            1
                        );

                    System.effectsVolume =
                        clamp(
                            safeNumber(
                                parsed.effectsVolume,
                                System.effectsVolume
                            ),
                            0,
                            1
                        );

                    System.ambienceVolume =
                        clamp(
                            safeNumber(
                                parsed.ambienceVolume,
                                System.ambienceVolume
                            ),
                            0,
                            1
                        );
                }

            } catch (error) {

                console.warn(
                    "[system.js] Could not load settings:",
                    error
                );
            }
        };

    System.saveSettings =
        function saveSettings() {

            try {

                localStorage.setItem(
                    System.storageKey,
                    JSON.stringify({
                        settings:
                            System.settings,
                        platform:
                            System.platform,
                        muted:
                            System.muted,
                        masterVolume:
                            System.masterVolume,
                        musicVolume:
                            System.musicVolume,
                        effectsVolume:
                            System.effectsVolume,
                        ambienceVolume:
                            System.ambienceVolume
                    })
                );

            } catch (error) {

                console.warn(
                    "[system.js] Could not save settings:",
                    error
                );
            }
        };

    System.setVolume =
        function setVolume(
            type,
            value
        ) {

            value =
                clamp(
                    safeNumber(
                        value,
                        0
                    ),
                    0,
                    1
                );

            switch (
                type
            ) {

                case "master":
                    System.masterVolume =
                        value;

                    if (
                        System.masterGain
                    ) {
                        System.masterGain.gain.value =
                            System.muted
                                ? 0
                                : value;
                    }
                    break;

                case "music":
                    System.musicVolume =
                        value;

                    if (
                        System.musicGain
                    ) {
                        System.musicGain.gain.value =
                            value;
                    }
                    break;

                case "effects":
                    System.effectsVolume =
                        value;

                    if (
                        System.effectsGain
                    ) {
                        System.effectsGain.gain.value =
                            value;
                    }
                    break;

                case "ambience":
                    System.ambienceVolume =
                        value;

                    if (
                        System.ambienceGain
                    ) {
                        System.ambienceGain.gain.value =
                            value;
                    }
                    break;

                case "voice":
                    System.voiceVolume =
                        value;

                    if (
                        System.voiceGain
                    ) {
                        System.voiceGain.gain.value =
                            value;
                    }
                    break;
            }

            System.saveSettings();
        };

    /* =========================================================
       MULTIPLAYER LOBBY
    ========================================================= */

    System.createLobby =
        function createLobby(
            options = {}
        ) {

            const name =
                String(
                    options.name ||
                    "SEEKER LOBBY"
                ).trim();

            const maxPlayers =
                clamp(
                    safeNumber(
                        options.maxPlayers,
                        4
                    ),
                    1,
                    12
                );

            const map =
                options.map ||
                "main";

            System.lobby =
                {
                    id:
                        `${Date.now()}-${Math
                            .random()
                            .toString(
                                36
                            )
                            .slice(
                                2,
                                9
                            )}`,

                    name,

                    maxPlayers,

                    players: [
                        {
                            id:
                                "local-player",
                            name:
                                options.playerName ||
                                "PLAYER",
                            host:
                                true
                        }
                    ],

                    map,

                    createdAt:
                        Date.now(),

                    voice:
                        System.settings
                            .voiceChat
                };

            System.emit(
                "lobby-created",
                {
                    lobby:
                        System.lobby
                }
            );

            emit(
                "seeker:lobby-created",
                {
                    lobby:
                        System.lobby
                }
            );

            return System.lobby;
        };

    System.joinLobby =
        function joinLobby(
            lobby
        ) {

            if (!lobby) {
                return false;
            }

            System.lobby =
                lobby;

            System.emit(
                "lobby-joined",
                {
                    lobby
                }
            );

            emit(
                "seeker:lobby-joined",
                {
                    lobby
                }
            );

            return true;
        };

    System.leaveLobby =
        function leaveLobby() {

            if (
                !System.lobby
            ) {
                return;
            }

            const oldLobby =
                System.lobby;

            System.lobby =
                null;

            System.emit(
                "lobby-left",
                {
                    lobby:
                        oldLobby
                }
            );
        };

    System.getLobby =
        function getLobby() {

            return System.lobby;
        };

    System.addLobbyPlayer =
        function addLobbyPlayer(
            player
        ) {

            if (
                !System.lobby ||
                !player
            ) {
                return false;
            }

            if (
                System.lobby.players
                    .length >=
                System.lobby.maxPlayers
            ) {
                return false;
            }

            System.lobby.players.push(
                {
                    id:
                        player.id ||
                        `player-${Date.now()}`,
                    name:
                        player.name ||
                        "PLAYER",
                    host:
                        false
                }
            );

            System.emit(
                "lobby-updated",
                {
                    lobby:
                        System.lobby
                }
            );

            return true;
        };

    /* =========================================================
       MAPS
    ========================================================= */

    System.maps = [
        {
            id: "main",
            name: "THE FACILITY",
            description:
                "The main abandoned complex.",
            size: "LARGE"
        },
        {
            id: "basement",
            name: "THE BASEMENT",
            description:
                "A darker underground section.",
            size: "LARGE"
        },
        {
            id: "forest",
            name: "THE FOREST",
            description:
                "A remote wooded area.",
            size: "LARGE"
        }
    ];

    System.getMaps =
        function getMaps() {
            return System.maps.slice();
        };

    /* =========================================================
       VOICE CHAT
       ---------------------------------------------------------
       Browser microphone access is handled here.
       Real multiplayer voice transmission still needs a
       signaling / networking layer supplied by the game server.
    ========================================================= */

    System.startVoiceChat =
        async function startVoiceChat() {

            if (
                !System.settings.voiceChat
            ) {

                return false;
            }

            if (
                System.voiceEnabled
            ) {
                return true;
            }

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices
                    .getUserMedia
            ) {

                System.showNotification(
                    "VOICE CHAT IS NOT AVAILABLE",
                    "danger"
                );

                return false;
            }

            try {

                System.microphoneStream =
                    await navigator
                        .mediaDevices
                        .getUserMedia({
                            audio: {
                                echoCancellation:
                                    true,
                                noiseSuppression:
                                    true,
                                autoGainControl:
                                    true
                            },
                            video:
                                false
                        });

                System.voiceEnabled =
                    true;

                System.emit(
                    "voice-started",
                    {
                        stream:
                            System.microphoneStream
                    }
                );

                emit(
                    "seeker:voice-started",
                    {
                        stream:
                            System.microphoneStream
                    }
                );

                System.showNotification(
                    "VOICE CHAT ENABLED",
                    "success"
                );

                return true;

            } catch (error) {

                console.warn(
                    "[system.js] Microphone permission failed:",
                    error
                );

                System.showNotification(
                    "MICROPHONE ACCESS DENIED",
                    "danger"
                );

                return false;
            }
        };

    System.stopVoiceChat =
        function stopVoiceChat() {

            if (
                System.microphoneStream
            ) {

                System.microphoneStream
                    .getTracks()
                    .forEach(
                        track => {
                            track.stop();
                        }
                    );
            }

            System.microphoneStream =
                null;

            System.voiceEnabled =
                false;

            System.emit(
                "voice-stopped",
                {}
            );

            emit(
                "seeker:voice-stopped",
                {}
            );
        };

    System.createVoicePeer =
        function createVoicePeer(
            configuration = {}
        ) {

            if (
                !window.RTCPeerConnection
            ) {

                return null;
            }

            const peer =
                new RTCPeerConnection(
                    configuration
                );

            if (
                System.microphoneStream
            ) {

                System.microphoneStream
                    .getTracks()
                    .forEach(
                        track => {

                            peer.addTrack(
                                track,
                                System.microphoneStream
                            );
                        }
                    );
            }

            peer.addEventListener(
                "track",
                event => {

                    const stream =
                        event.streams &&
                        event.streams[0];

                    if (
                        !stream
                    ) {
                        return;
                    }

                    System.playVoiceStream(
                        stream
                    );
                }
            );

            return peer;
        };

    System.playVoiceStream =
        function playVoiceStream(
            stream
        ) {

            if (!stream) {
                return null;
            }

            const audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay =
                true;

            audio.playsInline =
                true;

            audio.srcObject =
                stream;

            audio.volume =
                System.voiceVolume;

            audio.setAttribute(
                "data-seeker-voice",
                "true"
            );

            document.body.appendChild(
                audio
            );

            audio.play().catch(
                () => {}
            );

            return audio;
        };

    /* =========================================================
       MENU / GAME UI EVENTS
    ========================================================= */

    System.attachPlayButton =
        function attachPlayButton(
            selector,
            platform =
                System.platform
        ) {

            const element =
                document.querySelector(
                    selector
                );

            if (!element) {
                return false;
            }

            element.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    await System.unlockAudio();

                    System.setPlatform(
                        platform
                    );

                    System.emit(
                        "play-requested",
                        {
                            platform
                        }
                    );

                    emit(
                        "seeker:play-requested",
                        {
                            platform
                        }
                    );
                }
            );

            return true;
        };

    /* =========================================================
       AUDIO PRELOAD
    ========================================================= */

    System.preloadImportantAudio =
        async function preloadImportantAudio() {

            const files = [
                [
                    "footstep",
                    System.paths.footstep
                ],
                [
                    "seekerMusic",
                    System.paths.seekerMusic
                ],
                [
                    "ambience",
                    System.paths.ambience
                ],
                [
                    "caught",
                    System.paths.caught
                ],
                [
                    "flashlightOn",
                    System.paths.flashlightOn
                ],
                [
                    "flashlightOff",
                    System.paths.flashlightOff
                ],
                [
                    "key",
                    System.paths.key
                ],
                [
                    "button",
                    System.paths.button
                ],
                [
                    "gate",
                    System.paths.gate
                ],
                [
                    "door",
                    System.paths.door
                ],
                [
                    "pickup",
                    System.paths.pickup
                ]
            ];

            let completed = 0;

            for (
                const [name, src]
                of files
            ) {

                try {

                    await System.loadAudio(
                        name,
                        src
                    );

                } catch {}

                completed++;

                System.setLoading(
                    completed /
                    files.length *
                    100,
                    `LOADING AUDIO ${completed}/${files.length}`
                );
            }

            return true;
        };

    /* =========================================================
       CLEAR TIMERS
    ========================================================= */

    System.clearTimer =
        function clearTimer(
            name
        ) {

            if (
                System.timers[name]
            ) {

                clearTimeout(
                    System.timers[name]
                );

                clearInterval(
                    System.timers[name]
                );

                delete System.timers[name];
            }
        };

    System.clearGameTimers =
        function clearGameTimers() {

            Object.keys(
                System.timers
            ).forEach(
                name => {

                    System.clearTimer(
                        name
                    );
                }
            );

            if (
                System.footstepInterval
            ) {

                clearInterval(
                    System.footstepInterval
                );

                System.footstepInterval =
                    null;
            }

            Object.keys(
                System.intervals
            ).forEach(
                name => {

                    clearInterval(
                        System.intervals[name]
                    );

                    delete System.intervals[
                        name
                    ];
                }
            );
        };

    /* =========================================================
       TIMER UI STATE
    ========================================================= */

    System.updateHUDState =
        function updateHUDState() {

            if (
                System.timerWrapper
            ) {

                const showTimer =
                    System.gameState ===
                        "setup";

                System.timerWrapper
                    .style.opacity =
                    showTimer
                        ? "1"
                        : "0";
            }
        };

    /* =========================================================
       RESPECT REDUCED MOTION
    ========================================================= */

    System.detectReducedMotion =
        function detectReducedMotion() {

            try {

                const query =
                    window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    );

                System.settings.reduceMotion =
                    query.matches;

                query.addEventListener(
                    "change",
                    event => {

                        System.settings
                            .reduceMotion =
                            event.matches;

                        System.saveSettings();
                    }
                );

            } catch {}
        };

    /* =========================================================
       STYLE INJECTION
    ========================================================= */

    System.injectSystemStyles =
        function injectSystemStyles() {

            if (
                document.getElementById(
                    "systemInjectedStyles"
                )
            ) {
                return;
            }

            const style =
                document.createElement(
                    "style"
                );

            style.id =
                "systemInjectedStyles";

            style.textContent = `
                .system-loading-box {
                    width:min(440px,86vw);
                    text-align:center;
                }

                .system-loading-brand {
                    font-size:10px;
                    font-weight:800;
                    letter-spacing:4px;
                    opacity:.45;
                    margin-bottom:18px;
                }

                .system-loading-title {
                    font-size:clamp(34px,8vw,74px);
                    font-weight:950;
                    letter-spacing:8px;
                    line-height:.95;
                    margin-bottom:32px;
                }

                .system-loading-bar {
                    height:3px;
                    width:100%;
                    background:rgba(255,255,255,.08);
                    overflow:hidden;
                }

                .system-loading-progress {
                    height:100%;
                    width:0%;
                    background:#c9a227;
                    transition:width .2s ease;
                }

                .system-loading-status {
                    margin-top:14px;
                    font:
                        700 9px/1
                        system-ui,
                        sans-serif;
                    letter-spacing:2px;
                    opacity:.45;
                }

                .system-pause-box,
                .system-caught-box {
                    min-width:min(380px,84vw);
                    padding:28px;
                    text-align:center;
                    border:
                        1px solid
                        rgba(255,255,255,.12);
                    background:
                        rgba(7,7,7,.92);
                    box-shadow:
                        0 30px 90px
                        rgba(0,0,0,.55);
                }

                .system-pause-title,
                .system-caught-title {
                    font:
                        900 28px/1
                        system-ui,
                        sans-serif;
                    letter-spacing:4px;
                }

                .system-caught-title {
                    color:#c1a9a9;
                }

                .system-caught-subtitle {
                    margin-top:10px;
                    font:
                        700 10px
                        system-ui,
                        sans-serif;
                    letter-spacing:2px;
                    opacity:.45;
                }

                .system-pause-box button,
                .system-caught-box button {
                    display:block;
                    width:100%;
                    margin-top:14px;
                    padding:12px 15px;
                    border:
                        1px solid
                        rgba(255,255,255,.12);
                    background:#151515;
                    color:#eee;
                    font:
                        800 10px
                        system-ui,
                        sans-serif;
                    letter-spacing:2px;
                    cursor:pointer;
                }

                .system-pause-box button:hover,
                .system-caught-box button:hover {
                    background:#202020;
                    border-color:
                        rgba(255,255,255,.25);
                }

                #${System.ids.timer}.warning {
                    color:#c9a227 !important;
                }

                #${System.ids.timer}.critical {
                    color:#b33030 !important;
                    animation:
                        seekerTimerPulse
                        .7s
                        infinite;
                }

                @keyframes seekerTimerPulse {
                    0%,100% {
                        opacity:1;
                    }

                    50% {
                        opacity:.42;
                    }
                }

                @media (max-width:700px) {

                    #${System.ids.timer} {
                        font-size:21px !important;
                    }

                    #${System.ids.platform} {
                        display:none;
                    }

                    .system-loading-title {
                        letter-spacing:5px;
                    }
                }

                @media (prefers-reduced-motion:reduce) {

                    * {
                        scroll-behavior:auto !important;
                        animation-duration:.001ms !important;
                        animation-iteration-count:1 !important;
                        transition-duration:.001ms !important;
                    }
                }
            `;

            document.head.appendChild(
                style
            );
        };

    /* =========================================================
       WORLD CONNECTION
    ========================================================= */

    System.connectWorld =
        function connectWorld(
            options = {}
        ) {

            System.scene =
                options.scene ||
                window.scene ||
                null;

            System.camera =
                options.camera ||
                window.camera ||
                null;

            System.player =
                options.player ||
                window.player ||
                null;

            System.seeker =
                options.seeker ||
                window.seeker ||
                null;

            System.emit(
                "world-connected",
                {
                    scene:
                        System.scene,
                    camera:
                        System.camera,
                    player:
                        System.player,
                    seeker:
                        System.seeker
                }
            );

            return true;
        };

    /* =========================================================
       SEEKER DISTANCE AUTO-CALCULATION
    ========================================================= */

    System.calculateSeekerDistance =
        function calculateSeekerDistance() {

            if (
                !System.player ||
                !System.seeker
            ) {

                return Infinity;
            }

            if (
                !System.player.position ||
                !System.seeker.position
            ) {

                return Infinity;
            }

            return System.player.position
                .distanceTo(
                    System.seeker.position
                );
        };

    /* =========================================================
       AUTO WORLD UPDATE
    ========================================================= */

    System.autoWorldCheck =
        function autoWorldCheck() {

            if (
                !System.player ||
                !System.seeker
            ) {
                return;
            }

            const distance =
                System.calculateSeekerDistance();

            System.setSeekerDistance(
                distance
            );

            emit(
                "seeker:seeker-distance",
                {
                    distance
                }
            );
        };

    /* =========================================================
       MAIN AUTO LOOP
    ========================================================= */

    System.startLoop =
        function startLoop() {

            if (
                System.loopRunning
            ) {
                return;
            }

            System.loopRunning =
                true;

            let last =
                now();

            const loop =
                timestamp => {

                    if (
                        !System.loopRunning
                    ) {
                        return;
                    }

                    const delta =
                        Math.min(
                            0.05,
                            (
                                timestamp -
                                last
                            ) / 1000
                        );

                    last =
                        timestamp;

                    System.autoWorldCheck();

                    System.update(
                        delta
                    );

                    System.updateHUDState();

                    requestAnimationFrame(
                        loop
                    );
                };

            requestAnimationFrame(
                loop
            );
        };

    System.stopLoop =
        function stopLoop() {

            System.loopRunning =
                false;
        };

    /* =========================================================
       DEBUG API
    ========================================================= */

    System.debug =
        function debug() {

            console.table({

                state:
                    System.gameState,

                platform:
                    System.platform,

                map:
                    System.currentMap,

                buttons:
                    `${System.buttonsFound}/${System.totalButtons}`,

                key:
                    System.keyCollected,

                gate:
                    System.gateUnlocked,

                setupTime:
                    System.setupTimeLeft,

                gameTime:
                    System.gameTime.toFixed(2),

                seekerDistance:
                    Number.isFinite(
                        System.seekerDistance
                    )
                        ? System.seekerDistance
                            .toFixed(2)
                        : "UNKNOWN",

                seekerThreat:
                    System.seekerThreat
                        .toFixed(3),

                flashlight:
                    window.SeekerDetails &&
                    typeof
                        window.SeekerDetails
                            .isFlashlightOn ===
                        "function"
                        ? window.SeekerDetails
                            .isFlashlightOn()
                        : "UNKNOWN",

                voice:
                    System.voiceEnabled,

                audio:
                    System.audioReady
            });

            return System;
        };

    /* =========================================================
       PUBLIC GAME API
    ========================================================= */

    window.SeekerSystem =
        System;

    window.GameSystem =
        System;

    /* =========================================================
       AUTO START
    ========================================================= */

    System.init()
        .then(
            async () => {

                System.detectReducedMotion();

                System.setLoading(
                    12,
                    "SYSTEMS ONLINE"
                );

                await System.preloadImportantAudio();

                System.setLoading(
                    100,
                    "READY"
                );

                setTimeout(
                    () => {
                        System.hideLoading();
                    },
                    250
                );

                System.startLoop();

                System.emit(
                    "ready",
                    {
                        platform:
                            System.platform
                    }
                );

                console.log(
                    "%cTHE SEEKER%c system.js READY",
                    "font-weight:900;color:#c9a227;",
                    "color:inherit;"
                );
            }
        )
        .catch(
            error => {

                console.error(
                    "[system.js] Startup failed:",
                    error
                );

                System.setLoading(
                    100,
                    "SYSTEM ERROR"
                );
            }
        );

})();