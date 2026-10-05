/* ========================================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   main.js
   ========================================================================

   MAIN APPLICATION COORDINATOR

   This file is intentionally responsible for the client-side application
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
       MAIN APPLICATION
       ==================================================================== */

    const Main = {

        /* ================================================================
           APP STATE
           ================================================================ */

        state: {
            initialized:
                false,

            introStarted:
                false,

            introComplete:
                false,

            menuVisible:
                false,

            gameVisible:
                false,

            mode:
                "singleplayer",

            platform:
                readStorage(
                    STORAGE_KEYS.PLATFORM,
                    DEFAULTS.platform
                ),

            map:
                readStorage(
                    STORAGE_KEYS.MAP,
                    DEFAULTS.map
                ),

            playerName:
                cleanPlayerName(
                    readStorage(
                        STORAGE_KEYS.PLAYER_NAME,
                        DEFAULTS.playerName
                    )
                ),

            lobbyName:
                DEFAULTS.lobbyName,

            lobbyCode:
                "",

            lobby:
                null,

            localPlayerId:
                "",

            sessionToken:
                "",

            serverConnected:
                false,

            socketState:
                "CLOSED",

            socketGeneration:
                0,

            pendingRequest:
                null,

            pendingRequestType:
                "",

            reconnecting:
                false,

            reconnectAttempts:
                0,

            reconnectTimer:
                null,

            gameStarting:
                false,

            gameStarted:
                false,

            gameReady:
                false,

            paused:
                false,

            caught:
                false,

            escaped:
                false,

            settings: {
                musicEnabled:
                    readStorage(
                        STORAGE_KEYS.MUSIC,
                        "true"
                    ) !== "false",

                sfxEnabled:
                    readStorage(
                        STORAGE_KEYS.SFX,
                        "true"
                    ) !== "false",

                volume:
                    clamp(
                        readStorage(
                            STORAGE_KEYS.VOLUME,
                            DEFAULTS.volume
                        ),
                        0,
                        1
                    )
            },

            lastError:
                "",

            initializedAt:
                0,

            gameLaunchToken:
                0
        },


        /* ================================================================
           DOM CACHE
           ================================================================ */

        el: {},


        /* ================================================================
           INTERNAL TIMERS
           ================================================================ */

        timers: {
            introBoom:
                null,

            introFinish:
                null,

            introFade:
                null,

            loading:
                null,

            reconnect:
                null,

            statusClear:
                null,

            gameLaunch:
                null
        },


        /* ================================================================
           NETWORK
           ================================================================ */

        network: {
            socket:
                null,

            generation:
                0,

            manualClose:
                false,

            heartbeatTimer:
                null,

            lastMessageAt:
                0,

            lastOpenAt:
                0
        },


        /* ================================================================
           UI GUARD
           ================================================================ */

        binding: {
            menu:
                false,

            modals:
                false,

            platform:
                false,

            settings:
                false,

            game:
                false,

            keyboard:
                false,

            lifecycle:
                false,

            gameEvents:
                false,

            mobile:
                false
        },


        /* ================================================================
           AUDIO FALLBACK
           ================================================================ */

        fallbackAudio: {
            boom:
                null,

            click:
                null,

            success:
                null,

            warning:
                null,

            caught:
                null
        },


        /* ================================================================
           RUNTIME DATA
           ================================================================ */

        runtime: {
            remotePlayers:
                new Map(),

            lastPlayerState:
                null,

            lastPlayerStateSentAt:
                0,

            voiceEnabled:
                false,

            gameEventSequence:
                0,

            introBoomPlayed:
                false
        },


        /* ================================================================
           INITIALIZATION
           ================================================================ */

        init() {

            if (
                this.state.initialized
            ) {
                return;
            }


            this.state.initializedAt =
                Date.now();


            this.cacheElements();

            this.loadSettings();

            this.prepareFallbackAudio();

            this.bindMenu();

            this.bindModals();

            this.bindPlatform();

            this.bindSettings();

            this.bindGameControls();

            this.bindKeyboard();

            this.bindLifecycle();

            this.bindGameEvents();

            this.updatePlayerNameFields();

            this.updateAllServerIndicators();

            this.state.initialized =
                true;


            window.Main =
                this;

            window.TheSeekerMain =
                this;


            this.startIntro();

        },


        /* ================================================================
           ELEMENT CACHE
           ================================================================ */

        cacheElements() {

            const ids = [

                /* intro */

                "introScreen",
                "introPresent",
                "introDivider",
                "introSub",
                "introParticles",
                "introFlash",
                "introShockwave",
                "introBoom",
                "introSkip",


                /* menu */

                "mainMenu",
                "playButton",
                "multiplayerButton",
                "settingsButton",
                "creditsButton",
                "menuServerStatus",


                /* network */

                "networkStatus",


                /* modals */

                "platformModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal",


                /* host */

                "hostPlayerName",
                "hostLobbyName",
                "hostMap",
                "hostStatus",
                "createLobbyButton",


                /* join */

                "joinPlayerName",
                "joinCode",
                "joinStatus",
                "joinLobbyButton",


                /* lobby */

                "lobbyCode",
                "copyLobbyCode",
                "playerCount",
                "lobbyMap",
                "lobbyPlayers",
                "lobbyStatus",
                "startGameButton",
                "leaveLobbyButton",


                /* settings */

                "musicToggle",
                "sfxToggle",
                "volumeSlider",
                "volumeValue",


                /* loading */

                "loadingScreen",
                "loadingProgress",
                "loadingText",


                /* game */

                "gameScreen",
                "gameCanvas",

                "objectiveText",
                "buttonProgress",
                "setupTimer",
                "threatText",
                "threatDisplay",
                "dangerOverlay",

                "pauseOverlay",
                "caughtOverlay",

                "resumeButton",
                "pauseMenuButton",
                "restartButton",
                "caughtMenuButton",

                "voiceButton",


                /* mobile */

                "mobileControls",
                "mobileSprint",
                "mobileInteract",

                "movementJoystick",
                "lookJoystick",
                "movementKnob",
                "lookKnob"

            ];


            ids.forEach(
                id => {

                    this.el[id] =
                        document.getElementById(
                            id
                        );

                }
            );

        },


        /* ================================================================
           FALLBACK AUDIO
           ================================================================ */

        prepareFallbackAudio() {

            this.fallbackAudio.boom =
                this.createAudio(
                    "audio/boom.mp3",
                    false
                );


            this.fallbackAudio.click =
                this.createAudio(
                    "audio/click.mp3",
                    false
                );


            this.fallbackAudio.success =
                this.createAudio(
                    "audio/success.mp3",
                    false
                );


            this.fallbackAudio.warning =
                this.createAudio(
                    "audio/warning.mp3",
                    false
                );


            this.fallbackAudio.caught =
                this.createAudio(
                    "audio/caught.mp3",
                    false
                );

        },


        createAudio(
            src,
            loop = false
        ) {

            const audio =
                new Audio();

            audio.src =
                src;

            audio.preload =
                "auto";

            audio.loop =
                loop;

            return audio;

        },


        playFallbackSound(
            name
        ) {

            if (
                !this.state.settings.sfxEnabled
            ) {
                return;
            }


            const audio =
                this.fallbackAudio[name];


            if (!audio) {
                return;
            }


            audio.volume =
                this.state.settings.volume;


            try {

                audio.currentTime =
                    0;

                const promise =
                    audio.play();

                promise?.catch?.(
                    () => {}
                );

            } catch (_) {}

        },


        playSound(
            name,
            multiplier = 1
        ) {

            /*
             * Prefer the master System audio if it exists.
             * This prevents two copies of the same sound from playing.
             */

            if (
                window.SeekerSystem &&
                typeof
                    window.SeekerSystem.playSound ===
                    "function"
            ) {

                try {

                    window.SeekerSystem.playSound(
                        name,
                        multiplier
                    );

                    return;

                } catch (_) {}

            }


            this.playFallbackSound(
                name
            );

        },


        /* ================================================================
           INTRO
           ================================================================ */

        startIntro() {

            if (
                this.state.introStarted
            ) {
                return;
            }


            this.state.introStarted =
                true;


            const intro =
                this.el.introScreen;


            if (!intro) {

                this.finishIntro(
                    true
                );

                return;

            }


            intro.hidden =
                false;


            intro.classList.remove(
                "intro-visible",
                "intro-boom-active",
                "intro-complete"
            );


            this.runtime.introBoomPlayed =
                false;


            this.createIntroParticles();


            /*
             * Give the production card time to appear.
             * It stays readable before the boom occurs.
             */

            this.timers.introBoom =
                setTimeout(
                    () => {

                        this.playIntroBoom();

                    },
                    DEFAULTS.introPresentTime
                );


            /*
             * Finish after the cinematic has had time to play.
             */

            this.timers.introFinish =
                setTimeout(
                    () => {

                        this.finishIntro();

                    },
                    DEFAULTS.introFinishTime
                );


            requestAnimationFrame(
                () => {

                    intro.classList.add(
                        "intro-visible"
                    );

                }
            );

        },


        createIntroParticles() {

            const container =
                this.el.introParticles;


            if (!container) {
                return;
            }


            /*
             * Rebuild only particles that belong to this
             * application's intro layer.
             */

            container.innerHTML =
                "";


            const particleCount =
                120;


            for (
                let i = 0;
                i < particleCount;
                i++
            ) {

                const particle =
                    document.createElement(
                        "span"
                    );


                particle.className =
                    "intro-particle";


                const angle =
                    Math.random() *
                    360;


                const distance =
                    160 +
                    Math.random() *
                    560;


                const size =
                    1 +
                    Math.random() *
                    3.8;


                const scale =
                    0.45 +
                    Math.random() *
                    1.4;


                const delay =
                    Math.random() *
                    220;


                particle.style.setProperty(
                    "--angle",
                    `${angle}deg`
                );


                particle.style.setProperty(
                    "--distance",
                    `${distance}px`
                );


                particle.style.setProperty(
                    "--size",
                    `${size}px`
                );


                particle.style.setProperty(
                    "--end-scale",
                    `${scale}`
                );


                particle.style.setProperty(
                    "--delay",
                    `${delay}ms`
                );


                container.appendChild(
                    particle
                );

            }

        },


        playIntroBoom() {

            if (
                this.runtime.introBoomPlayed
            ) {
                return;
            }


            this.runtime.introBoomPlayed =
                true;


            const intro =
                this.el.introScreen;


            if (!intro) {
                return;
            }


            intro.classList.add(
                "intro-boom-active"
            );


            /*
             * System.js already handles the audio
             * bridge when available.
             */

            dispatch(
                "seeker:intro-boom",
                {
                    source:
                        "main",
                    time:
                        Date.now()
                }
            );


            if (
                !window.SeekerSystem
            ) {

                this.playFallbackSound(
                    "boom"
                );

            }

        },


        finishIntro(
            immediate = false
        ) {

            if (
                this.state.introComplete
            ) {
                return;
            }


            clearTimeout(
                this.timers.introBoom
            );

            clearTimeout(
                this.timers.introFinish
            );

            this.timers.introBoom =
                null;

            this.timers.introFinish =
                null;


            this.state.introComplete =
                true;


            const intro =
                this.el.introScreen;


            if (!intro) {

                this.showMenu();

                return;

            }


            if (immediate) {

                intro.hidden =
                    true;

                this.showMenu();

                return;

            }


            intro.classList.add(
                "intro-complete"
            );


            this.timers.introFade =
                setTimeout(
                    () => {

                        intro.hidden =
                            true;

                        this.showMenu();

                    },
                    DEFAULTS.introFadeTime
                );

        },


        /* ================================================================
           MENU
           ================================================================ */

        showMenu() {

            const menu =
                this.el.mainMenu;


            if (!menu) {
                return;
            }


            menu.hidden =
                false;


            this.hideGameScreen();

            this.hideAllModals();


            this.state.menuVisible =
                true;


            this.state.gameVisible =
                false;


            this.state.gameStarting =
                false;


            this.state.gameStarted =
                false;


            this.state.gameReady =
                false;


            this.state.paused =
                false;


            this.state.caught =
                false;


            this.state.escaped =
                false;


            document.body.classList.remove(
                "game-paused"
            );


            document.body.dataset.screen =
                "menu";


            this.updateAllServerIndicators();


            /*
             * Let System own the master menu audio
             * when it is available.
             */

            if (
                window.SeekerSystem
            ) {

                safeCall(
                    window.SeekerSystem,
                    "playMenuMusic"
                );

            }


            dispatch(
                "seeker:menu-shown",
                {
                    timestamp:
                        Date.now()
                }
            );

        },


        hideMenu() {

            if (
                this.el.mainMenu
            ) {

                this.el.mainMenu.hidden =
                    true;

            }


            this.state.menuVisible =
                false;

        },


        /* ================================================================
           MENU BINDINGS
           ================================================================ */

        bindMenu() {

            if (
                this.binding.menu
            ) {
                return;
            }


            this.binding.menu =
                true;


            /*
             * PLAY
             */

            this.bindClick(
                this.el.playButton,
                () => {

                    this.playClick();

                    this.state.mode =
                        "singleplayer";

                    this.openModal(
                        "platformModal"
                    );

                }
            );


            /*
             * MULTIPLAYER
             */

            this.bindClick(
                this.el.multiplayerButton,
                () => {

                    this.playClick();

                    this.state.mode =
                        "multiplayer";

                    this.openModal(
                        "multiplayerModal"
                    );

                    this.setStatus(
                        "networkStatus",
                        this.state.serverConnected
                            ? "ONLINE"
                            : "CONNECTING..."
                    );

                    this.connectServer();

                }
            );


            /*
             * SETTINGS
             */

            this.bindClick(
                this.el.settingsButton,
                () => {

                    this.playClick();

                    this.openModal(
                        "settingsModal"
                    );

                }
            );


            /*
             * CREDITS
             */

            this.bindClick(
                this.el.creditsButton,
                () => {

                    this.playClick();

                    this.openModal(
                        "creditsModal"
                    );

                }
            );

        },


        /* ================================================================
           MODAL BINDINGS
           ================================================================ */

        bindModals() {

            if (
                this.binding.modals
            ) {
                return;
            }


            this.binding.modals =
                true;


            /*
             * Close buttons.
             */

            document
                .querySelectorAll(
                    "[data-close]"
                )
                .forEach(
                    button => {

                        if (
                            button.dataset.mainBound ===
                            "true"
                        ) {
                            return;
                        }


                        button.dataset.mainBound =
                            "true";


                        button.addEventListener(
                            "click",
                            event => {

                                event.preventDefault();

                                this.playClick();

                                this.closeModal(
                                    button.dataset.close
                                );

                            }
                        );

                    }
                );


            /*
             * Click outside the panel closes the modal.
             * This only applies to the direct modal background.
             */

            MODAL_IDS.forEach(
                id => {

                    const modal =
                        this.el[id];


                    if (!modal) {
                        return;
                    }


                    modal.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target !==
                                modal
                            ) {
                                return;
                            }


                            this.playClick();

                            this.closeModal(
                                id
                            );

                        }
                    );

                }
            );


            /*
             * HOST
             *
             * This is intentionally independent from the
             * server state. Clicking HOST must always open
             * the host screen.
             */

            this.bindClick(
                this.findElement(
                    "hostButton"
                ),
                () => {

                    this.playClick();

                    this.state.mode =
                        "multiplayer";


                    this.closeModal(
                        "multiplayerModal"
                    );


                    this.openModal(
                        "hostModal"
                    );


                    this.prefillPlayerFields();


                    this.setStatus(
                        "hostStatus",
                        this.state.serverConnected
                            ? "SERVER ONLINE"
                            : "CONNECTING TO REAL SERVER..."
                    );


                    this.connectServer();

                }
            );


            /*
             * JOIN
             */

            this.bindClick(
                this.findElement(
                    "joinButton"
                ),
                () => {

                    this.playClick();

                    this.state.mode =
                        "multiplayer";


                    this.closeModal(
                        "multiplayerModal"
                    );


                    this.openModal(
                        "joinModal"
                    );


                    this.prefillPlayerFields();


                    this.setStatus(
                        "joinStatus",
                        this.state.serverConnected
                            ? "SERVER ONLINE"
                            : "CONNECTING TO REAL SERVER..."
                    );


                    this.connectServer();


                    setTimeout(
                        () => {

                            this.el.joinCode
                                ?.focus();

                        },
                        100
                    );

                }
            );


            /*
             * CREATE REAL LOBBY
             */

            this.bindClick(
                this.el.createLobbyButton,
                () => {

                    this.createLobby();

                }
            );


            /*
             * JOIN REAL LOBBY
             */

            this.bindClick(
                this.el.joinLobbyButton,
                () => {

                    this.joinExistingLobby();

                }
            );


            /*
             * START REAL GAME
             */

            this.bindClick(
                this.el.startGameButton,
                () => {

                    this.startHostedGame();

                }
            );


            /*
             * LEAVE
             */

            this.bindClick(
                this.el.leaveLobbyButton,
                () => {

                    this.leaveLobby();

                }
            );


            /*
             * COPY
             */

            this.bindClick(
                this.el.copyLobbyCode,
                () => {

                    this.copyLobbyCode();

                }
            );


            /*
             * CAUGHT -> MENU
             */

            this.bindClick(
                this.el.caughtMenuButton,
                () => {

                    this.playClick();

                    this.returnToMenu();

                }
            );

        },


        /* ================================================================
           PLATFORM
           ================================================================ */

        bindPlatform() {

            if (
                this.binding.platform
            ) {
                return;
            }


            this.binding.platform =
                true;


            document
                .querySelectorAll(
                    "[data-platform]"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () => {

                                const platform =
                                    normalizePlatform(
                                        button.dataset
                                            .platform
                                    );


                                this.playClick();


                                this.state.platform =
                                    platform;


                                writeStorage(
                                    STORAGE_KEYS.PLATFORM,
                                    platform
                                );


                                this.closeModal(
                                    "platformModal"
                                );


                                if (
                                    this.state.mode ===
                                    "multiplayer"
                                ) {

                                    this.openModal(
                                        "multiplayerModal"
                                    );

                                    this.connectServer();

                                    return;

                                }


                                this.startSingleplayer();

                            }
                        );

                    }
                );

        },


        /* ================================================================
           SETTINGS
           ================================================================ */

        bindSettings() {

            if (
                this.binding.settings
            ) {
                return;
            }


            this.binding.settings =
                true;


            this.bindChange(
                this.el.musicToggle,
                () => {

                    const enabled =
                        !!this.el.musicToggle.checked;


                    this.state.settings.musicEnabled =
                        enabled;


                    writeStorage(
                        STORAGE_KEYS.MUSIC,
                        String(enabled)
                    );


                    if (
                        window.SeekerSystem
                    ) {

                        safeCall(
                            window.SeekerSystem,
                            "setMusicEnabled",
                            enabled
                        );

                    }

                }
            );


            this.bindChange(
                this.el.sfxToggle,
                () => {

                    const enabled =
                        !!this.el.sfxToggle.checked;


                    this.state.settings.sfxEnabled =
                        enabled;


                    writeStorage(
                        STORAGE_KEYS.SFX,
                        String(enabled)
                    );


                    if (
                        window.SeekerSystem
                    ) {

                        safeCall(
                            window.SeekerSystem,
                            "setSfxEnabled",
                            enabled
                        );

                    }

                }
            );


            this.bindInput(
                this.el.volumeSlider,
                () => {

                    const value =
                        clamp(
                            this.el.volumeSlider.value,
                            0,
                            1
                        );


                    this.state.settings.volume =
                        value;


                    writeStorage(
                        STORAGE_KEYS.VOLUME,
                        String(value)
                    );


                    this.updateVolumeLabel();


                    if (
                        window.SeekerSystem
                    ) {

                        safeCall(
                            window.SeekerSystem,
                            "setVolume",
                            value
                        );

                    }

                }
            );

        },


        loadSettings() {

            this.state.settings.musicEnabled =
                readStorage(
                    STORAGE_KEYS.MUSIC,
                    "true"
                ) !== "false";


            this.state.settings.sfxEnabled =
                readStorage(
                    STORAGE_KEYS.SFX,
                    "true"
                ) !== "false";


            this.state.settings.volume =
                clamp(
                    readStorage(
                        STORAGE_KEYS.VOLUME,
                        DEFAULTS.volume
                    ),
                    0,
                    1
                );


            this.state.platform =
                normalizePlatform(
                    readStorage(
                        STORAGE_KEYS.PLATFORM,
                        DEFAULTS.platform
                    )
                );


            this.state.map =
                normalizeMap(
                    readStorage(
                        STORAGE_KEYS.MAP,
                        DEFAULTS.map
                    )
                );


            if (
                this.el.musicToggle
            ) {

                this.el.musicToggle.checked =
                    this.state.settings.musicEnabled;

            }


            if (
                this.el.sfxToggle
            ) {

                this.el.sfxToggle.checked =
                    this.state.settings.sfxEnabled;

            }


            if (
                this.el.volumeSlider
            ) {

                this.el.volumeSlider.value =
                    String(
                        this.state.settings.volume
                    );

            }


            this.updateVolumeLabel();

        },


        updateVolumeLabel() {

            if (
                this.el.volumeValue
            ) {

                this.el.volumeValue.textContent =
                    `${Math.round(
                        this.state.settings.volume *
                        100
                    )}%`;

            }

        },


        /* ================================================================
           GAME CONTROL BINDINGS
           ================================================================ */

        bindGameControls() {

            if (
                this.binding.game
            ) {
                return;
            }


            this.binding.game =
                true;


            this.bindClick(
                this.el.resumeButton,
                () => {

                    this.resumeGame();

                }
            );


            this.bindClick(
                this.el.pauseMenuButton,
                () => {

                    this.playClick();

                    this.returnToMenu();

                }
            );


            this.bindClick(
                this.el.restartButton,
                () => {

                    this.restartGame();

                }
            );


            this.bindClick(
                this.el.voiceButton,
                () => {

                    this.toggleVoice();

                }
            );


            this.bindClick(
                this.el.mobileInteract,
                () => {

                    dispatch(
                        "seeker:mobile-interact"
                    );

                }
            );


            this.bindClick(
                this.el.mobileSprint,
                () => {

                    dispatch(
                        "seeker:mobile-sprint"
                    );

                }
            );

        },


        /* ================================================================
           KEYBOARD
           ================================================================ */

        bindKeyboard() {

            if (
                this.binding.keyboard
            ) {
                return;
            }


            this.binding.keyboard =
                true;


            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.code ===
                        "Escape"
                    ) {

                        if (
                            this.state.introStarted &&
                            !this.state.introComplete
                        ) {

                            this.skipIntro();

                            return;

                        }


                        if (
                            this.anyModalOpen()
                        ) {

                            this.closeTopModal();

                            return;

                        }


                        if (
                            this.state.gameStarted
                        ) {

                            if (
                                this.state.paused
                            ) {

                                this.resumeGame();

                            } else {

                                this.pauseGame();

                            }

                        }

                        return;

                    }


                    if (
                        event.code ===
                        "Space"
                    ) {

                        if (
                            this.state.introStarted &&
                            !this.state.introComplete
                        ) {

                            this.skipIntro();

                        }

                    }

                }
            );

        },


        /* ================================================================
           LIFECYCLE
           ================================================================ */

        bindLifecycle() {

            if (
                this.binding.lifecycle
            ) {
                return;
            }


            this.binding.lifecycle =
                true;


            window.addEventListener(
                "beforeunload",
                () => {

                    this.closeSocket(
                        true
                    );

                }
            );


            document.addEventListener(
                "visibilitychange",
                () => {

                    if (
                        document.hidden
                    ) {
                        return;
                    }


                    if (
                        this.state.mode ===
                            "multiplayer" &&
                        this.state.lobby &&
                        !this.state.serverConnected
                    ) {

                        this.connectServer();

                    }

                }
            );

        },


        /* ================================================================
           GAME EVENT BINDINGS
           ================================================================ */

        bindGameEvents() {

            if (
                this.binding.gameEvents
            ) {
                return;
            }


            this.binding.gameEvents =
                true;


            /*
             * Game says it has finished creating the 3D scene.
             */

            window.addEventListener(
                "seeker:game-ready",
                () => {

                    this.state.gameReady =
                        true;


                    this.hideLoading();


                    dispatch(
                        "seeker:client-ready",
                        {
                            platform:
                                this.state.platform,

                            mode:
                                this.state.mode,

                            map:
                                this.state.map
                        }
                    );

                }
            );


            /*
             * Player caught.
             */

            window.addEventListener(
                "seeker:player-caught",
                event => {

                    this.handlePlayerCaught(
                        event
                    );

                }
            );


            window.addEventListener(
                "seeker:caught",
                event => {

                    this.handlePlayerCaught(
                        event
                    );

                }
            );


            /*
             * Escape.
             */

            window.addEventListener(
                "seeker:player-escaped",
                event => {

                    this.handlePlayerEscaped(
                        event
                    );

                }
            );


            /*
             * Objective.
             */

            window.addEventListener(
                "seeker:game-objective",
                event => {

                    const text =
                        cleanText(
                            event.detail?.text,
                            ""
                        );


                    if (
                        text &&
                        this.el.objectiveText
                    ) {

                        this.el.objectiveText.textContent =
                            text;

                    }


                    if (
                        this.state.mode ===
                        "multiplayer"
                    ) {

                        this.sendGameEvent(
                            "objective",
                            {
                                text
                            }
                        );

                    }

                }
            );


            /*
             * Button progress.
             */

            window.addEventListener(
                "seeker:button-progress",
                event => {

                    const found =
                        Math.max(
                            0,
                            Math.min(
                                3,
                                finiteNumber(
                                    event.detail?.found,
                                    0
                                )
                            )
                        );


                    if (
                        this.el.buttonProgress
                    ) {

                        this.el.buttonProgress.textContent =
                            `${found} / 3`;

                    }

                }
            );


            /*
             * Setup timer.
             */

            window.addEventListener(
                "seeker:setup-timer",
                event => {

                    const seconds =
                        Math.max(
                            0,
                            Math.ceil(
                                finiteNumber(
                                    event.detail?.seconds,
                                    0
                                )
                            )
                        );


                    if (
                        this.el.setupTimer
                    ) {

                        const minutes =
                            Math.floor(
                                seconds /
                                60
                            );


                        const remaining =
                            seconds %
                            60;


                        this.el.setupTimer.textContent =
                            `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;

                    }

                }
            );


            /*
             * Seeker distance.
             */

            window.addEventListener(
                "seeker:seeker-distance",
                event => {

                    this.updateThreatUI(
                        finiteNumber(
                            event.detail?.distance,
                            Infinity
                        )
                    );

                }
            );


            /*
             * Player moving.
             */

            window.addEventListener(
                "seeker:player-moving",
                event => {

                    if (
                        this.state.mode !==
                        "multiplayer"
                    ) {
                        return;
                    }


                    dispatch(
                        "seeker:local-motion",
                        {
                            moving:
                                !!event.detail?.moving,

                            speed:
                                finiteNumber(
                                    event.detail?.speed,
                                    0
                                )
                        }
                    );

                }
            );


            /*
             * Button / key / gate progression
             * can also be sent as a multiplayer event.
             */

            window.addEventListener(
                "seeker:button",
                event => {

                    this.sendGameEvent(
                        "button",
                        {
                            id:
                                event.detail?.id
                        }
                    );

                }
            );


            window.addEventListener(
                "seeker:key",
                event => {

                    this.sendGameEvent(
                        "key",
                        {
                            collected:
                                event.detail?.collected !== false
                        }
                    );

                }
            );


            window.addEventListener(
                "seeker:gate",
                event => {

                    this.sendGameEvent(
                        "gate",
                        {
                            unlocked:
                                event.detail?.unlocked !== false
                        }
                    );

                }
            );


            /*
             * Flashlight state.
             */

            window.addEventListener(
                "seeker:flashlight-on",
                () => {

                    this.sendGameEvent(
                        "flashlight-on",
                        {
                            on:
                                true
                        }
                    );

                }
            );


            window.addEventListener(
                "seeker:flashlight-off",
                () => {

                    this.sendGameEvent(
                        "flashlight-off",
                        {
                            on:
                                false
                        }
                    );

                }
            );


            /*
             * Voice signal from other clients.
             */

            window.addEventListener(
                "seeker:voice-signal",
                event => {

                    this.handleVoiceSignal(
                        event.detail
                    );

                }
            );


            /*
             * Explicit intro event.
             */

            window.addEventListener(
                "seeker:intro-boom",
                () => {

                    /*
                     * Do not call another boom audio copy
                     * when System is already available.
                     */

                    if (
                        !window.SeekerSystem
                    ) {

                        this.playFallbackSound(
                            "boom"
                        );

                    }

                }
            );

        },


        /* ================================================================
           PLAYER NAME FIELDS
           ================================================================ */

        updatePlayerNameFields() {

            const fields = [

                this.el.hostPlayerName,
                this.el.joinPlayerName

            ];


            fields.forEach(
                field => {

                    if (!field) {
                        return;
                    }


                    if (
                        !field.value.trim()
                    ) {

                        field.value =
                            this.state.playerName;

                    }

                }
            );

        },


        prefillPlayerFields() {

            this.updatePlayerNameFields();


            if (
                this.el.hostLobbyName &&
                !this.el.hostLobbyName.value.trim()
            ) {

                this.el.hostLobbyName.value =
                    this.state.lobbyName;

            }


            if (
                this.el.hostMap
            ) {

                this.el.hostMap.value =
                    this.state.map;

            }

        },


        savePlayerName(
            value
        ) {

            const name =
                cleanPlayerName(
                    value
                );


            this.state.playerName =
                name;


            writeStorage(
                STORAGE_KEYS.PLAYER_NAME,
                name
            );


            this.updatePlayerNameFields();


            return name;

        },


        /* ================================================================
           MODAL MANAGEMENT
           ================================================================ */

        openModal(
            id
        ) {

            const modal =
                this.el[id] ||
                document.getElementById(id);


            if (!modal) {

                console.warn(
                    `[THE SEEKER] Could not open missing modal: ${id}`
                );

                return false;

            }


            modal.hidden =
                false;


            modal.setAttribute(
                "aria-hidden",
                "false"
            );


            modal.classList.add(
                "modal-open"
            );


            return true;

        },


        closeModal(
            id
        ) {

            const modal =
                this.el[id] ||
                document.getElementById(id);


            if (!modal) {
                return false;
            }


            modal.hidden =
                true;


            modal.setAttribute(
                "aria-hidden",
                "true"
            );


            modal.classList.remove(
                "modal-open"
            );


            return true;

        },


        hideAllModals() {

            MODAL_IDS.forEach(
                id => {

                    this.closeModal(
                        id
                    );

                }
            );

        },


        anyModalOpen() {

            return MODAL_IDS.some(
                id => {

                    const modal =
                        this.el[id];

                    return (
                        modal &&
                        isVisible(modal)
                    );

                }
            );

        },


        closeTopModal() {

            const priority = [

                "creditsModal",
                "settingsModal",
                "lobbyModal",
                "joinModal",
                "hostModal",
                "multiplayerModal",
                "platformModal"

            ];


            for (
                const id of priority
            ) {

                const modal =
                    this.el[id];


                if (
                    modal &&
                    isVisible(modal)
                ) {

                    this.playClick();

                    this.closeModal(
                        id
                    );

                    return;

                }

            }

        },


        /* ================================================================
           CLICK / INPUT BIND HELPERS
           ================================================================ */

        bindClick(
            element,
            handler
        ) {

            if (
                !isElement(element)
            ) {
                return;
            }


            if (
                element.dataset.mainClickBound ===
                "true"
            ) {
                return;
            }


            element.dataset.mainClickBound =
                "true";


            element.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    try {

                        handler(
                            event
                        );

                    } catch (
                        error
                    ) {

                        console.error(
                            "[THE SEEKER] Click handler failed:",
                            error
                        );

                    }

                }
            );

        },


        bindChange(
            element,
            handler
        ) {

            if (
                !isElement(element)
            ) {
                return;
            }


            if (
                element.dataset.mainChangeBound ===
                "true"
            ) {
                return;
            }


            element.dataset.mainChangeBound =
                "true";


            element.addEventListener(
                "change",
                handler
            );

        },


        bindInput(
            element,
            handler
        ) {

            if (
                !isElement(element)
            ) {
                return;
            }


            if (
                element.dataset.mainInputBound ===
                "true"
            ) {
                return;
            }


            element.dataset.mainInputBound =
                "true";


            element.addEventListener(
                "input",
                handler
            );

        },


        findElement(
            id
        ) {

            return (
                document.getElementById(id) ||
                null
            );

        },


        /* ================================================================
           SINGLEPLAYER
           ================================================================ */

        async startSingleplayer() {

            if (
                this.state.gameStarting
            ) {
                return;
            }


            this.state.mode =
                "singleplayer";


            this.state.map =
                "facility";


            writeStorage(
                STORAGE_KEYS.MAP,
                this.state.map
            );


            this.closeModal(
                "platformModal"
            );


            this.hideAllModals();


            this.playClick();


            this.state.gameStarting =
                true;


            this.state.caught =
                false;


            this.state.escaped =
                false;


            this.showLoading(
                "INITIALIZING SINGLEPLAYER"
            );


            await delay(
                DEFAULTS.loadingTime
            );


            if (
                !this.state.gameStarting
            ) {
                return;
            }


            await this.launchGame({
                multiplayer:
                    false,

                platform:
                    this.state.platform,

                map:
                    this.state.map,

                lobby:
                    null
            });

        },


        /* ================================================================
           MULTIPLAYER ENTRY
           ================================================================ */

        openMultiplayer() {

            this.state.mode =
                "multiplayer";


            this.openModal(
                "multiplayerModal"
            );


            this.connectServer();

        },


        /* ================================================================
           SERVER URL
           ================================================================ */

        getServerURL() {

            /*
             * Priority:
             *
             * 1. runtime window setting
             * 2. ?server=
             * 3. localStorage
             * 4. localhost
             */

            if (
                typeof window.SEEKER_SERVER_URL ===
                "string" &&
                window.SEEKER_SERVER_URL.trim()
            ) {

                return window.SEEKER_SERVER_URL.trim();

            }


            try {

                const params =
                    new URLSearchParams(
                        window.location.search
                    );


                const queryServer =
                    params.get(
                        "server"
                    );


                if (
                    queryServer
                ) {

                    const clean =
                        queryServer.trim();


                    if (
                        clean.startsWith(
                            "ws://"
                        ) ||
                        clean.startsWith(
                            "wss://"
                        )
                    ) {

                        return clean;

                    }

                }

            } catch (_) {}


            return (
                readStorage(
                    STORAGE_KEYS.SERVER_URL,
                    DEFAULTS.serverURL
                )
            );

        },


        /* ================================================================
           SERVER CONNECTION
           ================================================================ */

        connectServer(
            options = {}
        ) {

            const force =
                !!options.force;


            const socket =
                this.network.socket;


            if (
                !force &&
                socket &&
                (
                    socket.readyState ===
                        WebSocket.OPEN ||
                    socket.readyState ===
                        WebSocket.CONNECTING
                )
            ) {

                return;

            }


            clearTimeout(
                this.timers.reconnect
            );


            this.timers.reconnect =
                null;


            this.state.socketState =
                "CONNECTING";


            this.state.serverConnected =
                false;


            this.state.reconnecting =
                this.state.reconnectAttempts >
                0;


            this.updateAllServerIndicators();


            const url =
                this.getServerURL();


            let ws;


            try {

                ws =
                    new WebSocket(
                        url
                    );

            } catch (
                error
            ) {

                this.handleSocketFailure(
                    error
                );

                return;

            }


            this.network.generation++;


            const generation =
                this.network.generation;


            this.network.socket =
                ws;


            this.state.socketGeneration =
                generation;


            this.network.manualClose =
                false;


            ws.binaryType =
                "arraybuffer";


            ws.addEventListener(
                "open",
                () => {

                    if (
                        generation !==
                        this.network.generation
                    ) {
                        return;
                    }


                    this.state.socketState =
                        "OPEN";


                    this.state.serverConnected =
                        true;


                    this.state.reconnecting =
                        false;


                    this.state.reconnectAttempts =
                        0;


                    this.network.lastOpenAt =
                        Date.now();


                    this.network.lastMessageAt =
                        Date.now();


                    this.updateAllServerIndicators();


                    this.startNetworkHeartbeat();


                    /*
                     * If we still have a valid previous session,
                     * ask the server to restore it.
                     *
                     * Otherwise any pending create/join request
                     * goes out immediately.
                     */

                    if (
                        this.state.sessionToken &&
                        this.state.lobbyCode &&
                        !this.state.pendingRequest
                    ) {

                        this.send({
                            type:
                                "reconnect",

                            sessionToken:
                                this.state.sessionToken

                        });


                        return;

                    }


                    if (
                        this.state.pendingRequest
                    ) {

                        const request =
                            this.state.pendingRequest;


                        this.state.pendingRequest =
                            null;


                        this.state.pendingRequestType =
                            "";


                        this.send(
                            request
                        );

                    }

                }
            );


            ws.addEventListener(
                "message",
                event => {

                    if (
                        generation !==
                        this.network.generation
                    ) {
                        return;
                    }


                    this.network.lastMessageAt =
                        Date.now();


                    this.handleServerMessage(
                        event.data
                    );

                }
            );


            ws.addEventListener(
                "error",
                error => {

                    if (
                        generation !==
                        this.network.generation
                    ) {
                        return;
                    }


                    console.error(
                        "[THE SEEKER] WebSocket error:",
                        error
                    );


                    this.state.serverConnected =
                        false;


                    this.state.socketState =
                        "ERROR";


                    this.updateAllServerIndicators();


                    /*
                     * Do not destroy the host/join
                     * screen because the user may still
                     * be waiting for the server.
                     */

                    if (
                        this.state.pendingRequestType ===
                        "create_lobby"
                    ) {

                        this.setStatus(
                            "hostStatus",
                            "SERVER CONNECTION ERROR"
                        );

                    }


                    if (
                        this.state.pendingRequestType ===
                        "join_lobby"
                    ) {

                        this.setStatus(
                            "joinStatus",
                            "SERVER CONNECTION ERROR"
                        );

                    }

                }
            );


            ws.addEventListener(
                "close",
                (
                    code,
                    reason
                ) => {

                    if (
                        generation !==
                        this.network.generation
                    ) {
                        return;
                    }


                    this.state.serverConnected =
                        false;


                    this.state.socketState =
                        "CLOSED";


                    this.stopNetworkHeartbeat();


                    this.updateAllServerIndicators();


                    if (
                        this.network.manualClose
                    ) {

                        return;

                    }


                    if (
                        this.state.lobby &&
                        this.state.gameStarted ===
                            false
                    ) {

                        this.setStatus(
                            "lobbyStatus",
                            "SERVER DISCONNECTED"
                        );

                    }


                    /*
                     * Preserve the pending request.
                     * It is safe to retry only when appropriate.
                     */

                    if (
                        this.state.pendingRequest
                    ) {

                        this.scheduleReconnect();

                        return;

                    }


                    /*
                     * During multiplayer gameplay,
                     * attempt reconnection.
                     */

                    if (
                        this.state.mode ===
                            "multiplayer" &&
                        (
                            this.state.lobby ||
                            this.state.gameStarted
                        )
                    ) {

                        this.scheduleReconnect();

                    }

                }
            );

        },


        /* ================================================================
           SOCKET FAILURE
           ================================================================ */

        handleSocketFailure(
            error
        ) {

            console.error(
                "[THE SEEKER] WebSocket creation failure:",
                error
            );


            this.state.serverConnected =
                false;


            this.state.socketState =
                "ERROR";


            this.updateAllServerIndicators();


            this.setStatus(
                "hostStatus",
                "SERVER OFFLINE"
            );


            this.setStatus(
                "joinStatus",
                "SERVER OFFLINE"
            );


            if (
                this.state.lobby ||
                this.state.pendingRequest
            ) {

                this.scheduleReconnect();

            }

        },


        /* ================================================================
           RECONNECT
           ================================================================ */

        scheduleReconnect() {

            clearTimeout(
                this.timers.reconnect
            );


            const attempt =
                Math.min(
                    this.state.reconnectAttempts,
                    6
                );


            const wait =
                Math.min(
                    10000,
                    750 *
                    Math.pow(
                        1.65,
                        attempt
                    )
                );


            this.state.reconnectAttempts++;


            this.state.reconnecting =
                true;


            this.timers.reconnect =
                setTimeout(
                    () => {

                        this.connectServer(
                            {
                                force:
                                    true
                            }
                        );

                    },
                    wait
                );

        },


        /* ================================================================
           CLOSE SOCKET
           ================================================================ */

        closeSocket(
            manual = false
        ) {

            this.network.manualClose =
                manual;


            this.stopNetworkHeartbeat();


            const socket =
                this.network.socket;


            if (!socket) {
                return;
            }


            try {

                socket.close(
                    1000,
                    "Client closing"
                );

            } catch (_) {}


            this.network.socket =
                null;


            this.state.socketState =
                "CLOSED";


            this.state.serverConnected =
                false;


            this.updateAllServerIndicators();

        },


        /* ================================================================
           HEARTBEAT
           ================================================================ */

        startNetworkHeartbeat() {

            this.stopNetworkHeartbeat();


            this.network.heartbeatTimer =
                setInterval(
                    () => {

                        const socket =
                            this.network.socket;


                        if (
                            !socket ||
                            socket.readyState !==
                                WebSocket.OPEN
                        ) {

                            return;

                        }


                        this.send({
                            type:
                                "ping"
                        });


                    },
                    12000
                );

        },


        stopNetworkHeartbeat() {

            clearInterval(
                this.network.heartbeatTimer
            );


            this.network.heartbeatTimer =
                null;

        },


        /* ================================================================
           SEND
           ================================================================ */

        send(
            payload
        ) {

            const socket =
                this.network.socket;


            if (
                !socket ||
                socket.readyState !==
                    WebSocket.OPEN
            ) {

                return false;

            }


            try {

                socket.send(
                    JSON.stringify(
                        payload
                    )
                );


                return true;

            } catch (
                error
            ) {

                console.error(
                    "[THE SEEKER] Network send failed:",
                    error
                );


                return false;

            }

        },


        /* ================================================================
           SERVER MESSAGE ROUTER
           ================================================================ */

        handleServerMessage(
            raw
        ) {

            const message =
                typeof raw ===
                "string"
                    ? parseJSON(
                        raw,
                        null
                    )
                    : raw;


            if (
                !message ||
                typeof message !==
                    "object"
            ) {

                return;

            }


            switch (
                message.type
            ) {

                case "connected":

                    this.handleConnected(
                        message
                    );

                    break;


                case "lobby_created":

                    this.handleLobbyCreated(
                        message
                    );

                    break;


                case "lobby_joined":

                    this.handleLobbyJoined(
                        message
                    );

                    break;


                case "lobby_updated":
                case "lobby_state":

                    this.handleLobbyUpdated(
                        message
                    );

                    break;


                case "game_started":

                    this.handleServerGameStarted(
                        message
                    );

                    break;


                case "player_joined":

                    this.handlePlayerJoined(
                        message
                    );

                    break;


                case "player_disconnected":

                    this.handlePlayerDisconnected(
                        message
                    );

                    break;


                case "player_left":

                    this.handlePlayerLeft(
                        message
                    );

                    break;


                case "host_changed":

                    this.handleHostChanged(
                        message
                    );

                    break;


                case "player_state":

                    this.handleRemotePlayerState(
                        message
                    );

                    break;


                case "game_event":

                    this.handleRemoteGameEvent(
                        message
                    );

                    break;


                case "voice_signal":

                    this.handleVoiceSignal(
                        message
                    );

                    break;


                case "lobby_closed":

                    this.handleLobbyClosed(
                        message
                    );

                    break;


                case "server_shutdown":

                    this.handleServerShutdown(
                        message
                    );

                    break;


                case "error":

                    this.handleServerError(
                        message
                    );

                    break;


                case "pong":

                    break;


                default:

                    console.debug(
                        "[THE SEEKER] Unhandled server message:",
                        message
                    );

                    break;

            }

        },


        /* ================================================================
           CONNECTED
           ================================================================ */

        handleConnected(
            message
        ) {

            this.state.serverConnected =
                true;


            this.state.socketState =
                "OPEN";


            if (
                message.playerId
            ) {

                this.state.localPlayerId =
                    message.playerId;

            }


            if (
                message.sessionToken
            ) {

                this.state.sessionToken =
                    message.sessionToken;

            }


            this.updateAllServerIndicators();


            /*
             * Connection identity is now available.
             *
             * Pending create/join requests are handled by
             * the socket's OPEN callback so they are not
             * duplicated here.
             */

            if (
                this.state.lobby
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "SERVER ONLINE"
                );

            }

        },


        /* ================================================================
           LOBBY CREATED
           ================================================================ */

        handleLobbyCreated(
            message
        ) {

            const incoming =
                message.lobby || {};


            const code =
                normalizeLobbyCode(
                    message.code ||
                    incoming.code ||
                    ""
                );


            this.state.lobbyCode =
                code;


            this.state.map =
                normalizeMap(
                    message.map ||
                    incoming.map ||
                    this.state.map
                );


            this.state.lobby =
                {
                    ...incoming,

                    code,

                    map:
                        this.state.map,

                    localPlayerId:
                        message.playerId ||
                        this.state.localPlayerId

                };


            this.state.localPlayerId =
                message.playerId ||
                this.state.localPlayerId;


            this.state.reconnecting =
                false;


            this.state.reconnectAttempts =
                0;


            this.state.mode =
                "multiplayer";


            this.state.gameStarted =
                false;


            this.closeModal(
                "hostModal"
            );


            this.closeModal(
                "joinModal"
            );


            this.openModal(
                "lobbyModal"
            );


            this.renderLobby();


            this.setStatus(
                "lobbyStatus",
                `LOBBY CREATED — ${code}`
            );


            this.playSuccess();


            dispatch(
                "seeker:lobby-created",
                {
                    code,
                    map:
                        this.state.map,
                    lobby:
                        this.state.lobby
                }
            );

        },


        /* ================================================================
           LOBBY JOINED
           ================================================================ */

        handleLobbyJoined(
            message
        ) {

            const incoming =
                message.lobby || {};


            const code =
                normalizeLobbyCode(
                    message.code ||
                    incoming.code ||
                    this.state.lobbyCode
                );


            this.state.lobbyCode =
                code;


            this.state.map =
                normalizeMap(
                    message.map ||
                    incoming.map ||
                    this.state.map
                );


            this.state.localPlayerId =
                message.playerId ||
                this.state.localPlayerId;


            this.state.lobby =
                {
                    ...incoming,

                    code,

                    map:
                        this.state.map,

                    localPlayerId:
                        this.state.localPlayerId

                };


            this.state.mode =
                "multiplayer";


            this.state.reconnecting =
                false;


            this.closeModal(
                "joinModal"
            );


            this.closeModal(
                "hostModal"
            );


            this.openModal(
                "lobbyModal"
            );


            this.renderLobby();


            this.setStatus(
                "lobbyStatus",
                message.reconnected
                    ? `RECONNECTED — ${code}`
                    : `JOINED — ${code}`
            );


            this.playSuccess();


            dispatch(
                "seeker:lobby-joined",
                {
                    code,
                    map:
                        this.state.map,
                    lobby:
                        this.state.lobby,
                    reconnected:
                        !!message.reconnected
                }
            );

        },


        /* ================================================================
           LOBBY UPDATED
           ================================================================ */

        handleLobbyUpdated(
            message
        ) {

            const incoming =
                message.lobby ||
                message;


            if (
                !incoming ||
                typeof incoming !==
                    "object"
            ) {

                return;

            }


            this.state.lobby =
                {
                    ...(this.state.lobby || {}),
                    ...incoming
                };


            if (
                message.code
            ) {

                this.state.lobbyCode =
                    normalizeLobbyCode(
                        message.code
                    );

            }


            if (
                incoming.code
            ) {

                this.state.lobbyCode =
                    normalizeLobbyCode(
                        incoming.code
                    );

            }


            if (
                incoming.map
            ) {

                this.state.map =
                    normalizeMap(
                        incoming.map
                    );

            }


            if (
                incoming.localPlayerId
            ) {

                this.state.localPlayerId =
                    incoming.localPlayerId;

            }


            /*
             * A lobby update does not itself launch the game.
             * The server's explicit game_started message does that.
             */

            this.renderLobby();


            dispatch(
                "seeker:lobby-updated",
                {
                    lobby:
                        this.state.lobby
                }
            );

        },


        /* ================================================================
           PLAYER JOINED
           ================================================================ */

        handlePlayerJoined(
            message
        ) {

            if (
                message.lobby
            ) {

                this.state.lobby =
                    {
                        ...(this.state.lobby || {}),
                        ...message.lobby
                    };


                this.state.lobbyCode =
                    normalizeLobbyCode(
                        message.lobby.code ||
                        this.state.lobbyCode
                    );

            }


            this.renderLobby();


            dispatch(
                "seeker:network-player-joined",
                {
                    ...message
                }
            );

        },


        /* ================================================================
           PLAYER DISCONNECTED
           ================================================================ */

        handlePlayerDisconnected(
            message
        ) {

            dispatch(
                "seeker:network-player-disconnected",
                {
                    ...message
                }
            );


            this.renderLobby();

        },


        /* ================================================================
           PLAYER LEFT
           ================================================================ */

        handlePlayerLeft(
            message
        ) {

            if (
                message.playerId
            ) {

                this.runtime.remotePlayers.delete(
                    message.playerId
                );

            }


            dispatch(
                "seeker:network-player-left",
                {
                    ...message
                }
            );


            this.renderLobby();

        },


        /* ================================================================
           HOST CHANGE
           ================================================================ */

        handleHostChanged(
            message
        ) {

            if (
                this.state.lobby
            ) {

                this.state.lobby.hostId =
                    message.hostId ||
                    this.state.lobby.hostId;

                this.state.lobby.host =
                    message.hostId ||
                    this.state.lobby.host;

            }


            this.renderLobby();


            const localId =
                this.state.localPlayerId;


            if (
                message.hostId ===
                localId
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "YOU ARE NOW THE HOST"
                );


                this.playSuccess();

            } else {

                this.setStatus(
                    "lobbyStatus",
                    "HOST CHANGED"
                );

            }


            dispatch(
                "seeker:host-changed",
                {
                    ...message
                }
            );

        },


        /* ================================================================
           SERVER GAME START
           ================================================================ */

        handleServerGameStarted(
            message
        ) {

            const map =
                normalizeMap(
                    message.map ||
                    this.state.lobby?.map ||
                    this.state.map
                );


            this.state.map =
                map;


            if (
                this.state.lobby
            ) {

                this.state.lobby.started =
                    true;

                this.state.lobby.map =
                    map;

            }


            this.closeModal(
                "lobbyModal"
            );


            this.hideAllModals();


            this.playClick();


            this.state.mode =
                "multiplayer";


            this.state.gameStarting =
                true;


            this.showLoading(
                "ENTERING THE FACILITY"
            );


            /*
             * Explicitly wait before creating the local game.
             * This gives all clients the same server start state.
             */

            clearTimeout(
                this.timers.gameLaunch
            );


            const launchToken =
                ++this.state.gameLaunchToken;


            this.timers.gameLaunch =
                setTimeout(
                    () => {

                        if (
                            launchToken !==
                            this.state.gameLaunchToken
                        ) {

                            return;

                        }


                        this.launchGame(
                            {
                                multiplayer:
                                    true,

                                platform:
                                    this.state.platform,

                                map,

                                lobby:
                                    this.state.lobby,

                                serverStartedAt:
                                    message.startedAt ||
                                    Date.now(),

                                players:
                                    Array.isArray(
                                        message.players
                                    )
                                        ? message.players
                                        : []

                            }
                        );

                    },
                    DEFAULTS.loadingTime
                );

        },


        /* ================================================================
           SERVER ERRORS
           ================================================================ */

        handleServerError(
            message
        ) {

            const code =
                cleanText(
                    message.code,
                    "SERVER_ERROR",
                    60
                );


            const text =
                cleanText(
                    message.message,
                    "The server rejected the request.",
                    300
                );


            this.state.lastError =
                text;


            console.error(
                `[THE SEEKER] Server error ${code}:`,
                text
            );


            switch (
                code
            ) {

                case "LOBBY_NOT_FOUND":

                    this.setStatus(
                        "joinStatus",
                        text.toUpperCase()
                    );

                    this.openModal(
                        "joinModal"
                    );

                    break;


                case "LOBBY_FULL":

                    this.setStatus(
                        "joinStatus",
                        text.toUpperCase()
                    );

                    this.openModal(
                        "joinModal"
                    );

                    break;


                case "GAME_ALREADY_STARTED":

                    this.setStatus(
                        "joinStatus",
                        text.toUpperCase()
                    );

                    this.openModal(
                        "joinModal"
                    );

                    break;


                case "NOT_HOST":

                    this.setStatus(
                        "lobbyStatus",
                        text.toUpperCase()
                    );

                    break;


                case "ALREADY_IN_LOBBY":

                    this.setStatus(
                        "lobbyStatus",
                        text.toUpperCase()
                    );

                    break;


                default:

                    this.setStatus(
                        "hostStatus",
                        text.toUpperCase()
                    );

                    this.setStatus(
                        "joinStatus",
                        text.toUpperCase()
                    );

                    this.setStatus(
                        "lobbyStatus",
                        text.toUpperCase()
                    );

                    break;

            }


            this.playWarning();


            dispatch(
                "seeker:server-error",
                {
                    code,
                    message:
                        text
                }
            );

        },


        /* ================================================================
           LOBBY CLOSED
           ================================================================ */

        handleLobbyClosed(
            message
        ) {

            const code =
                normalizeLobbyCode(
                    message.code ||
                    ""
                );


            this.runtime.remotePlayers.clear();


            this.state.lobby =
                null;


            this.state.lobbyCode =
                "";


            this.state.gameStarted =
                false;


            this.state.gameStarting =
                false;


            this.closeModal(
                "lobbyModal"
            );


            if (
                !this.state.gameVisible
            ) {

                this.openModal(
                    "multiplayerModal"
                );

            }


            this.setStatus(
                "networkStatus",
                "LOBBY CLOSED"
            );


            dispatch(
                "seeker:lobby-closed",
                {
                    code,

                    reason:
                        message.reason ||
                        "unknown"
                }
            );

        },


        /* ================================================================
           SERVER SHUTDOWN
           ================================================================ */

        handleServerShutdown(
            message
        ) {

            this.state.serverConnected =
                false;


            this.state.socketState =
                "CLOSED";


            this.updateAllServerIndicators();


            this.setStatus(
                "lobbyStatus",
                "SERVER SHUTTING DOWN"
            );


            dispatch(
                "seeker:server-shutdown",
                {
                    message:
                        message.message ||
                        ""
                }
            );

        },


        /* ================================================================
           CREATE REAL LOBBY
           ================================================================ */

        createLobby() {

            /*
             * IMPORTANT:
             * this function never creates a local lobby.
             * It sends exactly one create_lobby request to the server.
             */

            const name =
                this.savePlayerName(
                    this.el.hostPlayerName?.value ||
                    this.state.playerName
                );


            const lobbyName =
                cleanLobbyName(
                    this.el.hostLobbyName?.value ||
                    this.state.lobbyName
                );


            const map =
                normalizeMap(
                    this.el.hostMap?.value ||
                    this.state.map
                );


            this.state.lobbyName =
                lobbyName;


            this.state.map =
                map;


            writeStorage(
                STORAGE_KEYS.MAP,
                map
            );


            if (
                !name
            ) {

                this.setStatus(
                    "hostStatus",
                    "ENTER A PLAYER NAME"
                );

                this.el.hostPlayerName?.focus();

                return;

            }


            const request = {

                type:
                    "create_lobby",

                lobbyName:
                    lobbyName,

                playerName:
                    name,

                maxPlayers:
                    4,

                map:
                    map

            };


            this.state.mode =
                "multiplayer";


            if (
                !this.state.serverConnected
            ) {

                /*
                 * Save the exact request and open/connect to the
                 * real server. No fake lobby is generated.
                 */

                this.state.pendingRequest =
                    request;

                this.state.pendingRequestType =
                    "create_lobby";


                this.setStatus(
                    "hostStatus",
                    "CONNECTING TO REAL SERVER..."
                );


                this.connectServer();

                return;

            }


            this.setStatus(
                "hostStatus",
                "CREATING REAL LOBBY..."
            );


            const sent =
                this.send(
                    request
                );


            if (!sent) {

                this.state.pendingRequest =
                    request;

                this.state.pendingRequestType =
                    "create_lobby";


                this.setStatus(
                    "hostStatus",
                    "WAITING FOR SERVER..."
                );


                this.connectServer(
                    {
                        force:
                            true
                    }
                );

            }

        },


        /* ================================================================
           JOIN EXISTING REAL LOBBY
           ================================================================ */

        joinExistingLobby() {

            const name =
                this.savePlayerName(
                    this.el.joinPlayerName?.value ||
                    this.state.playerName
                );


            const code =
                normalizeLobbyCode(
                    this.el.joinCode?.value ||
                    ""
                );


            if (
                !name
            ) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A PLAYER NAME"
                );

                this.el.joinPlayerName?.focus();

                return;

            }


            if (
                !code
            ) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A LOBBY CODE"
                );

                this.el.joinCode?.focus();

                return;

            }


            if (
                code.length <
                4
            ) {

                this.setStatus(
                    "joinStatus",
                    "LOBBY CODE IS TOO SHORT"
                );

                this.el.joinCode?.focus();

                return;

            }


            const request = {

                type:
                    "join_lobby",

                code:

                    code,

                playerName:
                    name

            };


            this.state.mode =
                "multiplayer";


            this.state.lobbyCode =
                code;


            /*
             * JOIN ONLY.
             *
             * No create_lobby fallback exists here.
             */

            if (
                !this.state.serverConnected
            ) {

                this.state.pendingRequest =
                    request;

                this.state.pendingRequestType =
                    "join_lobby";


                this.setStatus(
                    "joinStatus",
                    "CONNECTING TO REAL SERVER..."
                );


                this.connectServer();

                return;

            }


            this.setStatus(
                "joinStatus",
                "JOINING EXISTING LOBBY..."
            );


            const sent =
                this.send(
                    request
                );


            if (!sent) {

                this.state.pendingRequest =
                    request;

                this.state.pendingRequestType =
                    "join_lobby";


                this.setStatus(
                    "joinStatus",
                    "WAITING FOR SERVER..."
                );


                this.connectServer(
                    {
                        force:
                            true
                    }
                );

            }

        },


        /* ================================================================
           RENDER LOBBY
           ================================================================ */

        renderLobby() {

            const lobby =
                this.state.lobby;


            if (!lobby) {
                return;
            }


            const players =
                Array.isArray(
                    lobby.players
                )
                    ? lobby.players
                    : [];


            const code =
                normalizeLobbyCode(
                    lobby.code ||
                    this.state.lobbyCode
                );


            if (
                this.el.lobbyCode
            ) {

                this.el.lobbyCode.textContent =
                    code ||
                    "------";

            }


            if (
                this.el.playerCount
            ) {

                this.el.playerCount.textContent =
                    `${players.length} / ${
                        lobby.maxPlayers ||
                        4
                    }`;

            }


            if (
                this.el.lobbyMap
            ) {

                this.el.lobbyMap.textContent =
                    this.mapDisplayName(
                        lobby.map ||
                        this.state.map
                    );

            }


            this.renderLobbyPlayers(
                players,
                lobby
            );


            this.updateHostButton(
                lobby
            );


            /*
             * A lobby that exists is a real lobby.
             * Never overwrite its code from local storage.
             */

            dispatch(
                "seeker:lobby-rendered",
                {
                    code,
                    players,
                    lobby
                }
            );

        },


        /* ================================================================
           RENDER PLAYERS
           ================================================================ */

        renderLobbyPlayers(
            players,
            lobby
        ) {

            const list =
                this.el.lobbyPlayers;


            if (!list) {
                return;
            }


            list.innerHTML =
                "";


            const hostId =
                lobby.hostId ||
                lobby.host ||
                "";


            const localId =
                lobby.localPlayerId ||
                this.state.localPlayerId ||
                "";


            players.forEach(
                player => {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "lobby-player";


                    if (
                        player.id ===
                        localId
                    ) {

                        row.classList.add(
                            "local-player"
                        );

                    }


                    const indicator =
                        document.createElement(
                            "span"
                        );


                    indicator.className =
                        "player-indicator";


                    const name =
                        document.createElement(
                            "span"
                        );


                    name.className =
                        "player-name";


                    name.textContent =
                        cleanPlayerName(
                            player.name ||
                            "Player"
                        );


                    const role =
                        document.createElement(
                            "span"
                        );


                    role.className =
                        "player-role";


                    role.textContent =
                        player.id ===
                        hostId
                            ? "HOST"
                            : "PLAYER";


                    row.appendChild(
                        indicator
                    );


                    row.appendChild(
                        name
                    );


                    row.appendChild(
                        role
                    );


                    list.appendChild(
                        row
                    );

                }
            );

        },


        /* ================================================================
           HOST BUTTON
           ================================================================ */

        updateHostButton(
            lobby
        ) {

            const button =
                this.el.startGameButton;


            if (!button) {
                return;
            }


            const hostId =
                lobby.hostId ||
                lobby.host ||
                "";


            const localId =
                lobby.localPlayerId ||
                this.state.localPlayerId ||
                "";


            const isHost =
                !!hostId &&
                !!localId &&
                hostId ===
                    localId;


            /*
             * A blank hostId is treated as disabled rather than
             * automatically granting host permission. This is safer
             * for real multiplayer.
             */

            button.disabled =
                !isHost ||
                lobby.started ===
                    true;


            if (
                lobby.started
            ) {

                button.textContent =
                    "STARTING...";

            } else if (
                isHost
            ) {

                button.textContent =
                    "START GAME";

            } else {

                button.textContent =
                    "WAITING FOR HOST";

            }

        },


        /* ================================================================
           HOST START
           ================================================================ */

        startHostedGame() {

            const lobby =
                this.state.lobby;


            if (!lobby) {

                this.setStatus(
                    "lobbyStatus",
                    "NO ACTIVE LOBBY"
                );

                return;

            }


            const hostId =
                lobby.hostId ||
                lobby.host;


            const localId =
                lobby.localPlayerId ||
                this.state.localPlayerId;


            if (
                !hostId ||
                !localId ||
                hostId !==
                    localId
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "ONLY THE HOST CAN START"
                );


                this.playWarning();


                return;

            }


            const code =
                normalizeLobbyCode(
                    lobby.code ||
                    this.state.lobbyCode
                );


            if (!code) {

                this.setStatus(
                    "lobbyStatus",
                    "LOBBY CODE MISSING"
                );

                return;

            }


            if (
                lobby.started
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "GAME IS ALREADY STARTING"
                );

                return;

            }


            this.state.gameStarting =
                true;


            this.playClick();


            this.setStatus(
                "lobbyStatus",
                "STARTING GAME..."
            );


            const sent =
                this.send({

                    type:
                        "start_game",

                    code,

                    map:
                        normalizeMap(
                            lobby.map ||
                            this.state.map
                        )

                });


            if (!sent) {

                this.state.gameStarting =
                    false;


                this.setStatus(
                    "lobbyStatus",
                    "SERVER CONNECTION LOST"
                );


                this.scheduleReconnect();

            }

        },


        /* ================================================================
           LEAVE LOBBY
           ================================================================ */

        leaveLobby() {

            const code =
                normalizeLobbyCode(
                    this.state.lobbyCode ||
                    this.state.lobby?.code ||
                    ""
                );


            if (
                code &&
                this.state.serverConnected
            ) {

                this.send({

                    type:
                        "leave_lobby",

                    code

                });

            }


            this.runtime.remotePlayers.clear();


            this.state.lobby =
                null;


            this.state.lobbyCode =
                "";


            this.state.pendingRequest =
                null;


            this.state.pendingRequestType =
                "";


            this.state.gameStarting =
                false;


            this.state.mode =
                "multiplayer";


            this.closeModal(
                "lobbyModal"
            );


            this.openModal(
                "multiplayerModal"
            );


            this.setStatus(
                "networkStatus",
                this.state.serverConnected
                    ? "ONLINE"
                    : "OFFLINE"
            );


            this.playClick();


            dispatch(
                "seeker:lobby-left"
            );

        },


        /* ================================================================
           COPY
           ================================================================ */

        async copyLobbyCode() {

            const code =
                normalizeLobbyCode(
                    this.state.lobbyCode
                );


            if (!code) {
                return;
            }


            try {

                if (
                    navigator.clipboard &&
                    typeof
                        navigator.clipboard.writeText ===
                    "function"
                ) {

                    await navigator.clipboard.writeText(
                        code
                    );

                } else {

                    const textarea =
                        document.createElement(
                            "textarea"
                        );


                    textarea.value =
                        code;


                    textarea.style.position =
                        "fixed";

                    textarea.style.left =
                        "-9999px";


                    document.body.appendChild(
                        textarea
                    );


                    textarea.select();


                    document.execCommand(
                        "copy"
                    );


                    textarea.remove();

                }


                this.setStatus(
                    "lobbyStatus",
                    "CODE COPIED"
                );


                this.playSuccess();


            } catch (
                error
            ) {

                console.error(
                    "[THE SEEKER] Copy failed:",
                    error
                );


                this.setStatus(
                    "lobbyStatus",
                    code
                );

            }

        },


        /* ================================================================
           GAME LAUNCH
           ================================================================ */

        async launchGame(
            options
        ) {

            if (
                this.state.gameStarted
            ) {

                return;

            }


            if (
                !this.state.gameStarting
            ) {

                this.state.gameStarting =
                    true;

            }


            const mode =
                options.multiplayer
                    ? "multiplayer"
                    : "singleplayer";


            const platform =
                normalizePlatform(
                    options.platform ||
                    this.state.platform
                );


            const map =
                normalizeMap(
                    options.map ||
                    this.state.map
                );


            this.state.mode =
                mode;


            this.state.platform =
                platform;


            this.state.map =
                map;


            writeStorage(
                STORAGE_KEYS.PLATFORM,
                platform
            );


            writeStorage(
                STORAGE_KEYS.MAP,
                map
            );


            this.hideMenu();

            this.hideAllModals();


            if (
                this.el.pauseOverlay
            ) {

                this.el.pauseOverlay.hidden =
                    true;

            }


            if (
                this.el.caughtOverlay
            ) {

                this.el.caughtOverlay.hidden =
                    true;

            }


            document.body.classList.remove(
                "game-paused"
            );


            document.body.dataset.mode =
                mode;


            document.body.dataset.platform =
                platform;


            this.state.gameVisible =
                true;


            this.state.gameStarted =
                false;


            this.state.gameReady =
                false;


            this.state.paused =
                false;


            this.state.caught =
                false;


            this.state.escaped =
                false;


            this.state.gameStarting =
                true;


            this.showGameScreen();


            this.showLoading(
                options.multiplayer
                    ? "ENTERING THE FACILITY"
                    : "LOADING THE FACILITY"
            );


            this.applyPlatformUI(
                platform
            );


            /*
             * Only ONE Game.start call happens here.
             *
             * System receives the seeker:start event too,
             * but System only updates system state/audio.
             */

            await delay(
                30
            );


            try {

                if (
                    window.Game &&
                    typeof
                        window.Game.start ===
                    "function"
                ) {

                    window.Game.start(
                        {
                            ...options,

                            multiplayer:
                                !!options.multiplayer,

                            platform,

                            map
                        }
                    );

                } else {

                    throw new Error(
                        "Game.start() is unavailable."
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[THE SEEKER] Game launch failed:",
                    error
                );


                this.handleGameLaunchError(
                    error
                );


                return;

            }


            /*
             * System gets one start event.
             * It does not itself call Game.start.
             */

            dispatch(
                "seeker:start",
                {
                    ...options,

                    multiplayer:
                        !!options.multiplayer,

                    platform,

                    map
                }
            );


            /*
             * game.js will dispatch seeker:game-ready when
             * its renderer / scene / camera are ready.
             *
             * This timeout is a safety net only.
             */

            clearTimeout(
                this.timers.gameLaunch
            );


            this.timers.gameLaunch =
                setTimeout(
                    () => {

                        if (
                            !this.state.gameReady &&
                            this.state.gameStarting
                        ) {

                            this.hideLoading();

                        }

                    },
                    5000
                );

        },


        /* ================================================================
           GAME LAUNCH ERROR
           ================================================================ */

        handleGameLaunchError(
            error
        ) {

            this.state.gameStarting =
                false;


            this.state.gameStarted =
                false;


            this.state.gameReady =
                false;


            this.state.lastError =
                error?.message ||
                "Game failed to start.";


            this.setStatus(
                "gameStatus",
                "GAME FAILED TO START"
            );


            this.hideLoading();


            alert(
                "THE SEEKER could not start the 3D game. Check the browser console for the exact error."
            );


            this.returnToMenu();

        },


        /* ================================================================
           GAME SCREEN
           ================================================================ */

        showGameScreen() {

            if (
                this.el.gameScreen
            ) {

                this.el.gameScreen.hidden =
                    false;

            }


            this.state.gameVisible =
                true;


            document.body.dataset.screen =
                "game";

        },


        hideGameScreen() {

            if (
                this.el.gameScreen
            ) {

                this.el.gameScreen.hidden =
                    true;

            }


            this.state.gameVisible =
                false;

        },


        /* ================================================================
           LOADING
           ================================================================ */

        showLoading(
            message
        ) {

            const loading =
                this.el.loadingScreen;


            if (!loading) {
                return;
            }


            loading.hidden =
                false;


            loading.setAttribute(
                "aria-hidden",
                "false"
            );


            if (
                this.el.loadingText
            ) {

                this.el.loadingText.textContent =
                    cleanText(
                        message,
                        "LOADING",
                        100
                    );

            }


            if (
                this.el.loadingProgress
            ) {

                this.el.loadingProgress.style.width =
                    "0%";


                requestAnimationFrame(
                    () => {

                        this.el.loadingProgress.style.width =
                            "100%";

                    }
                );

            }

        },


        hideLoading() {

            clearTimeout(
                this.timers.loading
            );


            this.timers.loading =
                null;


            if (
                this.el.loadingScreen
            ) {

                this.el.loadingScreen.hidden =
                    true;


                this.el.loadingScreen.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }


            this.state.gameStarting =
                false;


            this.state.gameReady =
                true;


            this.state.gameStarted =
                true;


            dispatch(
                "seeker:client-game-visible"
            );

        },


        /* ================================================================
           PLATFORM UI
           ================================================================ */

        applyPlatformUI(
            platform
        ) {

            const normalized =
                normalizePlatform(
                    platform
                );


            if (
                normalized ===
                "mobile"
            ) {

                document.body.classList.add(
                    "mobile-version"
                );


                document.body.classList.remove(
                    "pc-version"
                );


                if (
                    this.el.mobileControls
                ) {

                    this.el.mobileControls.hidden =
                        false;

                }


                this.el.mobileControls?.setAttribute(
                    "aria-hidden",
                    "false"
                );


            } else {

                document.body.classList.remove(
                    "mobile-version"
                );


                document.body.classList.add(
                    "pc-version"
                );


                if (
                    this.el.mobileControls
                ) {

                    this.el.mobileControls.hidden =
                        true;

                }


                this.el.mobileControls?.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }

        },


        /* ================================================================
           PAUSE
           ================================================================ */

        pauseGame() {

            if (
                !this.state.gameStarted ||
                this.state.caught ||
                this.state.escaped
            ) {

                return;

            }


            this.state.paused =
                true;


            document.body.classList.add(
                "game-paused"
            );


            if (
                this.el.pauseOverlay
            ) {

                this.el.pauseOverlay.hidden =
                    false;

            }


            dispatch(
                "seeker:pause"
            );


            safeCall(
                window.Game,
                "pause"
            );


            this.playClick();

        },


        resumeGame() {

            if (
                !this.state.gameStarted ||
                this.state.caught ||
                this.state.escaped
            ) {

                return;

            }


            this.state.paused =
                false;


            document.body.classList.remove(
                "game-paused"
            );


            if (
                this.el.pauseOverlay
            ) {

                this.el.pauseOverlay.hidden =
                    true;

            }


            dispatch(
                "seeker:resume"
            );


            safeCall(
                window.Game,
                "resume"
            );


            this.playClick();

        },


        /* ================================================================
           RESTART
           ================================================================ */

        restartGame() {

            this.playClick();


            if (
                this.el.caughtOverlay
            ) {

                this.el.caughtOverlay.hidden =
                    true;

            }


            if (
                this.el.pauseOverlay
            ) {

                this.el.pauseOverlay.hidden =
                    true;

            }


            document.body.classList.remove(
                "game-paused"
            );


            this.state.caught =
                false;


            this.state.escaped =
                false;


            this.state.paused =
                false;


            this.state.gameReady =
                false;


            this.state.gameStarted =
                false;


            this.state.gameStarting =
                true;


            dispatch(
                "seeker:restart"
            );


            if (
                window.Game &&
                typeof
                    window.Game.restart ===
                "function"
            ) {

                try {

                    window.Game.restart();

                    return;

                } catch (
                    error
                ) {

                    console.error(
                        "[THE SEEKER] Game.restart failed:",
                        error
                    );

                }

            }


            this.launchGame({

                multiplayer:
                    this.state.mode ===
                    "multiplayer",

                platform:
                    this.state.platform,

                map:
                    this.state.map,

                lobby:
                    this.state.lobby

            });

        },


        /* ================================================================
           CAUGHT
           ================================================================ */

        handlePlayerCaught(
            event
        ) {

            if (
                this.state.caught
            ) {
                return;
            }


            this.state.caught =
                true;


            this.state.gameStarted =
                false;


            this.state.gameStarting =
                false;


            this.state.paused =
                false;


            document.body.classList.remove(
                "game-paused"
            );


            if (
                this.el.caughtOverlay
            ) {

                this.el.caughtOverlay.hidden =
                    false;

            }


            this.playCaughtSound();


            if (
                this.state.mode ===
                "multiplayer"
            ) {

                this.sendGameEvent(
                    "player-caught",
                    {
                        reason:
                            event.detail?.reason ||
                            "seeker"
                    }
                );

            }


            dispatch(
                "seeker:caught-screen",
                {
                    reason:
                        event.detail?.reason ||
                        "seeker"
                }
            );

        },


        /* ================================================================
           ESCAPE
           ================================================================ */

        handlePlayerEscaped(
            event
        ) {

            if (
                this.state.escaped
            ) {
                return;
            }


            this.state.escaped =
                true;


            this.state.gameStarted =
                false;


            this.state.gameStarting =
                false;


            this.state.paused =
                false;


            if (
                this.state.mode ===
                "multiplayer"
            ) {

                this.sendGameEvent(
                    "player-escaped",
                    {}
                );

            }


            dispatch(
                "seeker:escaped-screen",
                {
                    ...(
                        event.detail ||
                        {}
                    )
                }
            );

        },


        playCaughtSound() {

            if (
                window.SeekerSystem
            ) {

                /*
                 * System uses the master sound path.
                 * Use its public sound API to avoid duplicates.
                 */

                safeCall(
                    window.SeekerSystem,
                    "playSound",
                    "caught",
                    1
                );

                return;

            }


            this.playFallbackSound(
                "caught"
            );

        },


        /* ================================================================
           THREAT UI
           ================================================================ */

        updateThreatUI(
            distance
        ) {

            const threat =
                this.el.threatDisplay;


            const text =
                this.el.threatText;


            const danger =
                this.el.dangerOverlay;


            if (
                !Number.isFinite(distance)
            ) {

                if (
                    text
                ) {

                    text.textContent =
                        "UNKNOWN";

                }

                return;

            }


            if (
                distance <=
                7
            ) {

                if (
                    text
                ) {

                    text.textContent =
                        "VERY CLOSE";

                }


                threat &&
                    (
                        threat.dataset.threat =
                            "high"
                    );


                danger?.classList.add(
                    "active"
                );


                return;

            }


            if (
                distance <=
                18
            ) {

                if (
                    text
                ) {

                    text.textContent =
                        "NEARBY";

                }


                threat &&
                    (
                        threat.dataset.threat =
                            "high"
                    );


                danger?.classList.remove(
                    "active"
                );


                return;

            }


            if (
                distance <=
                35
            ) {

                if (
                    text
                ) {

                    text.textContent =
                        "DETECTED";

                }


                threat &&
                    (
                        threat.dataset.threat =
                            "medium"
                    );


                danger?.classList.remove(
                    "active"
                );


                return;

            }


            if (
                text
            ) {

                text.textContent =
                    "HUNTING";

            }


            threat &&
                (
                    threat.dataset.threat =
                        "low"
                );


            danger?.classList.remove(
                "active"
            );

        },


        /* ================================================================
           REMOTE PLAYER STATE
           ================================================================ */

        handleRemotePlayerState(
            message
        ) {

            const id =
                cleanText(
                    message.playerId ||
                    message.id,
                    "",
                    100
                );


            if (!id) {
                return;
            }


            if (
                id ===
                this.state.localPlayerId
            ) {

                return;

            }


            const player = {

                id,

                name:
                    cleanPlayerName(
                        message.name ||
                        "Player"
                    ),

                x:
                    finiteNumber(
                        message.x,
                        0
                    ),

                y:
                    finiteNumber(
                        message.y,
                        1.65
                    ),

                z:
                    finiteNumber(
                        message.z,
                        0
                    ),

                yaw:
                    finiteNumber(
                        message.yaw,
                        0
                    ),

                pitch:
                    finiteNumber(
                        message.pitch,
                        0
                    ),

                timestamp:
                    finiteNumber(
                        message.timestamp,
                        Date.now()
                    )

            };


            this.runtime.remotePlayers.set(
                id,
                player
            );


            dispatch(
                "seeker:remote-player-update",
                {
                    ...player
                }
            );


            /*
             * Also provide the event to Game directly.
             */

            safeCall(
                window.Game,
                "updateRemotePlayer",
                player
            );

        },


        /* ================================================================
           SEND LOCAL PLAYER STATE
           ================================================================ */

        sendPlayerState(
            state
        ) {

            if (
                this.state.mode !==
                "multiplayer"
            ) {
                return;
            }


            if (
                !this.state.lobby
            ) {
                return;
            }


            if (
                !this.state.gameStarted
            ) {
                return;
            }


            const now =
                performance.now();


            if (
                now -
                    this.runtime.lastPlayerStateSentAt <
                50
            ) {

                return;

            }


            this.runtime.lastPlayerStateSentAt =
                now;


            const packet = {

                type:
                    "player_state",

                code:
                    this.state.lobbyCode,

                playerId:
                    this.state.localPlayerId,

                name:
                    this.state.playerName,

                x:
                    clamp(
                        state?.x,
                        -1000,
                        1000
                    ),

                y:
                    clamp(
                        state?.y,
                        -100,
                        100
                    ),

                z:
                    clamp(
                        state?.z,
                        -1000,
                        1000
                    ),

                yaw:
                    clamp(
                        state?.yaw,
                        -1000,
                        1000
                    ),

                pitch:
                    clamp(
                        state?.pitch,
                        -1000,
                        1000
                    )

            };


            this.runtime.lastPlayerState =
                packet;


            this.send(
                packet
            );

        },


        /* ================================================================
           REMOTE GAME EVENT
           ================================================================ */

        handleRemoteGameEvent(
            message
        ) {

            const event =
                cleanText(
                    message.event,
                    "",
                    60
                );


            if (
                !GAME_EVENT_NAMES.includes(
                    event
                )
            ) {

                return;

            }


            dispatch(
                "seeker:network-event",
                {
                    ...message
                }
            );


            /*
             * Let the game receive the network event.
             */

            dispatch(
                "seeker:network-game-event",
                {
                    ...message
                }
            );


            /*
             * Shared progression state.
             * These are safe to apply locally because they
             * describe already-authorized server events.
             */

            switch (
                event
            ) {

                case "button":
                case "button-found":

                    dispatch(
                        "seeker:remote-button",
                        {
                            id:
                                message.data?.id
                        }
                    );

                    break;


                case "key":
                case "key-collected":

                    dispatch(
                        "seeker:remote-key",
                        {
                            ...message.data
                        }
                    );

                    break;


                case "gate":
                case "gate-unlocked":

                    dispatch(
                        "seeker:remote-gate",
                        {
                            ...message.data
                        }
                    );

                    break;


                case "player-caught":

                    dispatch(
                        "seeker:remote-player-caught",
                        {
                            ...message
                        }
                    );

                    break;


                case "player-escaped":

                    dispatch(
                        "seeker:remote-player-escaped",
                        {
                            ...message
                        }
                    );

                    break;


                default:
                    break;

            }

        },


        /* ================================================================
           SEND GAME EVENT
           ================================================================ */

        sendGameEvent(
            event,
            data = {}
        ) {

            if (
                !GAME_EVENT_NAMES.includes(
                    event
                )
            ) {

                return false;

            }


            if (
                this.state.mode !==
                "multiplayer"
            ) {

                return false;

            }


            if (
                !this.state.lobby
            ) {

                return false;

            }


            this.runtime.gameEventSequence++;


            return this.send({

                type:
                    "game_event",

                code:
                    this.state.lobbyCode,

                playerId:
                    this.state.localPlayerId,

                event,

                data,

                localSequence:
                    this.runtime.gameEventSequence

            });

        },


        /* ================================================================
           VOICE
           ================================================================ */

        async toggleVoice() {

            if (
                !this.state.lobby
            ) {

                this.setStatus(
                    "networkStatus",
                    "VOICE REQUIRES A LOBBY"
                );

                return;

            }


            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.toggle ===
                "function"
            ) {

                try {

                    await window.SeekerVoice.toggle();


                    this.updateVoiceButton();


                    return;

                } catch (
                    error
                ) {

                    console.error(
                        "[THE SEEKER] Voice toggle failed:",
                        error
                    );

                }

            }


            dispatch(
                "seeker:voice-toggle"
            );


            this.updateVoiceButton();

        },


        updateVoiceButton() {

            const button =
                this.el.voiceButton;


            if (!button) {
                return;
            }


            let active =
                false;


            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.isActive ===
                "function"
            ) {

                try {

                    active =
                        !!window.SeekerVoice.isActive();

                } catch (_) {}

            }


            this.state.voiceEnabled =
                active;


            button.classList.toggle(
                "active",
                active
            );


            const labels =
                button.querySelectorAll(
                    "span"
                );


            if (
                labels.length
            ) {

                const last =
                    labels[
                        labels.length - 1
                    ];


                last.textContent =
                    active
                        ? "VOICE ON"
                        : "VOICE";

            }

        },


        handleVoiceSignal(
            message
        ) {

            dispatch(
                "seeker:voice-signal-received",
                {
                    ...message
                }
            );


            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.handleSignal ===
                "function"
            ) {

                try {

                    window.SeekerVoice.handleSignal(
                        message
                    );

                } catch (
                    error
                ) {

                    console.error(
                        "[THE SEEKER] Voice signal failed:",
                        error
                    );

                }

            }

        },


        sendVoiceSignal(
            target,
            signal
        ) {

            if (
                !this.state.lobby
            ) {
                return false;
            }


            if (
                !target
            ) {
                return false;
            }


            return this.send({

                type:
                    "voice_signal",

                code:
                    this.state.lobbyCode,

                target,

                playerId:
                    this.state.localPlayerId,

                signal

            });

        },


        /* ================================================================
           PAUSE / MENU / GAME CLEANUP
           ================================================================ */

        returnToMenu() {

            clearTimeout(
                this.timers.gameLaunch
            );


            this.timers.gameLaunch =
                null;


            this.state.gameLaunchToken++;


            this.state.gameStarting =
                false;


            this.state.gameStarted =
                false;


            this.state.gameReady =
                false;


            this.state.paused =
                false;


            this.state.caught =
                false;


            this.state.escaped =
                false;


            document.body.classList.remove(
                "game-paused"
            );


            dispatch(
                "seeker:stop"
            );


            safeCall(
                window.Game,
                "stop"
            );


            /*
             * Do not automatically leave the lobby just because
             * the user returns to the menu. The lobby remains a
             * real server-side session until the user leaves it.
             */

            this.hideGameScreen();

            this.hideLoading();

            this.hideAllModals();

            this.showMenu();


            dispatch(
                "seeker:return-menu"
            );

        },


        /* ================================================================
           NETWORK UI
           ================================================================ */

        updateAllServerIndicators() {

            let status =
                "offline";

            let label =
                "OFFLINE";


            if (
                this.state.socketState ===
                "CONNECTING"
            ) {

                status =
                    "connecting";

                label =
                    "CONNECTING";

            } else if (
                this.state.serverConnected
            ) {

                status =
                    "online";

                label =
                    "ONLINE";

            } else if (
                this.state.socketState ===
                    "ERROR"
            ) {

                status =
                    "error";

                label =
                    "ERROR";

            }


            const elements = [

                this.el.menuServerStatus,
                this.el.networkStatus

            ];


            elements.forEach(
                element => {

                    if (!element) {
                        return;
                    }


                    element.textContent =
                        label;


                    element.dataset.status =
                        status;

                }
            );

        },


        /* ================================================================
           STATUS
           ================================================================ */

        setStatus(
            id,
            message
        ) {

            const element =
                this.el[id] ||
                document.getElementById(
                    id
                );


            if (!element) {
                return;
            }


            element.textContent =
                cleanText(
                    message,
                    "",
                    300
                );


            element.classList.add(
                "status-updated"
            );


            clearTimeout(
                this.timers.statusClear
            );


            this.timers.statusClear =
                setTimeout(
                    () => {

                        element.classList.remove(
                            "status-updated"
                        );

                    },
                    500
                );

        },


        /* ================================================================
           UI HELPERS
           ================================================================ */

        playClick() {

            this.playSound(
                "click",
                0.75
            );

        },


        playSuccess() {

            this.playSound(
                "success",
                0.9
            );

        },


        playWarning() {

            this.playSound(
                "warning",
                0.9
            );

        },


        updateLobbyMapLabel() {

            if (
                this.el.lobbyMap
            ) {

                this.el.lobbyMap.textContent =
                    this.mapDisplayName(
                        this.state.map
                    );

            }

        },


        mapDisplayName(
            map
        ) {

            return (
                MAPS[
                    normalizeMap(
                        map
                    )
                ] ||
                MAPS.facility
            );

        },


        /* ================================================================
           SKIP INTRO
           ================================================================ */

        skipIntro() {

            if (
                this.state.introComplete
            ) {
                return;
            }


            clearTimeout(
                this.timers.introBoom
            );


            clearTimeout(
                this.timers.introFinish
            );


            this.playIntroBoom();


            clearTimeout(
                this.timers.introFade
            );


            this.timers.introFade =
                setTimeout(
                    () => {

                        this.finishIntro();

                    },
                    850
                );

        },


        /* ================================================================
           SOCKET STATE
           ================================================================ */

        getSocketState() {

            return {

                connected:
                    this.state.serverConnected,

                state:
                    this.state.socketState,

                generation:
                    this.state.socketGeneration,

                reconnecting:
                    this.state.reconnecting,

                attempts:
                    this.state.reconnectAttempts

            };

        },


        /* ================================================================
           RUNTIME SNAPSHOT
           ================================================================ */

        getRuntimeSnapshot() {

            return {

                app:
                    APP.NAME,

                studio:
                    APP.STUDIO,

                version:
                    APP.VERSION,

                mode:
                    this.state.mode,

                platform:
                    this.state.platform,

                map:
                    this.state.map,

                playerName:
                    this.state.playerName,

                lobbyCode:
                    this.state.lobbyCode,

                server:
                    this.getSocketState(),

                gameStarted:
                    this.state.gameStarted,

                gameReady:
                    this.state.gameReady,

                paused:
                    this.state.paused,

                caught:
                    this.state.caught,

                escaped:
                    this.state.escaped

            };

        },


        /* ================================================================
           PUBLIC DEBUG
           ================================================================ */

        debug() {

            console.table(
                this.getRuntimeSnapshot()
            );


            return this.getRuntimeSnapshot();

        }

    };


    /* ====================================================================
       GLOBAL GAME -> MAIN PLAYER STATE BRIDGE
       ==================================================================== */

    window.addEventListener(
        "seeker:player-state",
        event => {

            Main.sendPlayerState(
                event.detail ||
                {}
            );

        }
    );


    /* ====================================================================
       GLOBAL GAME -> MAIN NETWORK GAME EVENT BRIDGE
       ==================================================================== */

    window.addEventListener(
        "seeker:game-event",
        event => {

            const detail =
                event.detail ||
                {};


            const eventName =
                cleanText(
                    detail.event,
                    "",
                    60
                );


            if (
                eventName
            ) {

                Main.sendGameEvent(
                    eventName,
                    detail.data ||
                    {}
                );

            }

        }
    );


    /* ====================================================================
       GLOBAL FLASHLIGHT SLOT BRIDGE
       ==================================================================== */

    window.addEventListener(
        "seeker:flashlight-selected",
        () => {

            dispatch(
                "seeker:inventory-selected",
                {
                    slot:
                        1,

                    item:
                        "flashlight"
                }
            );

        }
    );


    /* ====================================================================
       GLOBAL MOBILE RESIZE
       ==================================================================== */

    window.addEventListener(
        "resize",
        () => {

            if (
                Main.state.platform ===
                "mobile"
            ) {

                Main.applyPlatformUI(
                    "mobile"
                );

            }

        }
    );


    /* ====================================================================
       GLOBAL ERROR REPORTING
       ==================================================================== */

    window.addEventListener(
        "error",
        event => {

            /*
             * Do not hide the actual error.
             * Record it so the application can recover gracefully.
             */

            Main.state.lastError =
                event.message ||
                "Unknown client error.";

        }
    );


    window.addEventListener(
        "unhandledrejection",
        event => {

            Main.state.lastError =
                event.reason?.message ||
                String(
                    event.reason ||
                    "Unhandled promise rejection."
                );

        }
    );


    /* ====================================================================
       BOOT
       ==================================================================== */

    function boot() {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                () => {

                    Main.init();

                },
                {
                    once:
                        true
                }
            );

        } else {

            Main.init();

        }

    }


    boot();


    /* ====================================================================
       EXPORT
       ==================================================================== */

    window.Main =
        Main;

    window.TheSeekerMain =
        Main;

})();