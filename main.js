/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   main.js
   ============================================================ */

(() => {
    "use strict";

    const Main = {

        /* ======================================================
           STATE
           ====================================================== */

        state: {
            started: false,
            introComplete: false,
            platform: "pc",
            mode: "singleplayer",
            map: "facility",

            lobbyCode: "",
            lobby: null,

            serverConnected: false,
            socket: null,

            pendingRequest: null,

            playerName:
                localStorage.getItem("seeker_player_name") ||
                "Player" +
                    Math.floor(
                        1000 +
                        Math.random() * 9000
                    ),

            musicEnabled:
                localStorage.getItem(
                    "seeker_music"
                ) !== "false",

            sfxEnabled:
                localStorage.getItem(
                    "seeker_sfx"
                ) !== "false",

            volume:
                Number(
                    localStorage.getItem(
                        "seeker_volume"
                    )
                ) || 0.75
        },


        /* ======================================================
           ELEMENTS
           ====================================================== */

        elements: {},


        /* ======================================================
           AUDIO
           ====================================================== */

        audio: {
            menu: null,
            boom: null,
            click: null,
            success: null,
            error: null,
            caught: null
        },


        /* ======================================================
           INIT
           ====================================================== */

        init() {

            this.cacheElements();

            this.createAudio();

            this.loadSettings();

            this.bindInterface();

            this.createIntroParticles();

            this.startIntro();

            window.Main = this;

        },


        /* ======================================================
           CACHE DOM
           ====================================================== */

        cacheElements() {

            const ids = [
                "introScreen",
                "introPresent",
                "introDivider",
                "introSub",
                "introParticles",
                "introFlash",
                "introShockwave",
                "introBoom",
                "introSkip",

                "mainMenu",
                "playButton",
                "multiplayerButton",
                "settingsButton",
                "creditsButton",

                "menuServerStatus",
                "networkStatus",

                "platformModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal",

                "hostPlayerName",
                "hostLobbyName",
                "hostMap",
                "hostStatus",
                "createLobbyButton",

                "joinPlayerName",
                "joinCode",
                "joinStatus",
                "joinLobbyButton",

                "lobbyCode",
                "copyLobbyCode",
                "playerCount",
                "lobbyMap",
                "lobbyPlayers",
                "lobbyStatus",
                "startGameButton",
                "leaveLobbyButton",

                "musicToggle",
                "sfxToggle",
                "volumeSlider",
                "volumeValue",

                "loadingScreen",
                "loadingProgress",
                "loadingText",

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

                "mobileControls",
                "movementJoystick",
                "lookJoystick",
                "movementKnob",
                "lookKnob",
                "mobileSprint",
                "mobileInteract"
            ];

            ids.forEach((id) => {
                this.elements[id] =
                    document.getElementById(id);
            });

        },


        /* ======================================================
           AUDIO SETUP
           ====================================================== */

        createAudio() {

            this.audio.menu =
                this.makeAudio(
                    "audio/menu.mp3",
                    true
                );

            this.audio.boom =
                this.makeAudio(
                    "audio/boom.mp3",
                    false
                );

            this.audio.click =
                this.makeAudio(
                    "audio/click.mp3",
                    false
                );

            this.audio.success =
                this.makeAudio(
                    "audio/success.mp3",
                    false
                );

            this.audio.error =
                this.makeAudio(
                    "audio/warning.mp3",
                    false
                );

            this.audio.caught =
                this.makeAudio(
                    "audio/caught.mp3",
                    false
                );

            this.setAudioVolumes();

        },


        makeAudio(src, loop) {

            const audio =
                new Audio(src);

            audio.preload = "auto";
            audio.loop = loop;

            return audio;
        },


        setAudioVolumes() {

            const master =
                this.state.volume;

            if (this.audio.menu) {
                this.audio.menu.volume =
                    Math.min(
                        1,
                        master * 0.4
                    );
            }

            if (this.audio.boom) {
                this.audio.boom.volume =
                    master;
            }

            if (this.audio.click) {
                this.audio.click.volume =
                    master;
            }

            if (this.audio.success) {
                this.audio.success.volume =
                    master;
            }

            if (this.audio.error) {
                this.audio.error.volume =
                    master;
            }

            if (this.audio.caught) {
                this.audio.caught.volume =
                    master;
            }

        },


        playAudio(audio) {

            if (!audio) {
                return;
            }

            try {
                audio.currentTime = 0;
                const promise =
                    audio.play();

                if (
                    promise &&
                    typeof promise.catch ===
                        "function"
                ) {
                    promise.catch(() => {});
                }
            } catch (_) {}

        },


        playClick() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.playAudio(
                this.audio.click
            );

        },


        playSuccess() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.playAudio(
                this.audio.success
            );

        },


        playError() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.playAudio(
                this.audio.error
            );

        },


        /* ======================================================
           INTRO
           ====================================================== */

        startIntro() {

            const intro =
                this.elements.introScreen;

            if (!intro) {
                this.showMenu();
                return;
            }

            intro.hidden = false;

            intro.classList.remove(
                "intro-visible",
                "intro-boom-active",
                "intro-complete"
            );

            /*
             * The phrase stays on screen for several seconds.
             * It does NOT instantly switch.
             */

            requestAnimationFrame(() => {

                intro.classList.add(
                    "intro-visible"
                );

            });


            /*
             * Large cinematic boom happens after
             * the production card has had time to
             * actually be read.
             */

            this.introBoomTimer =
                setTimeout(
                    () => {
                        this.playIntroBoom();
                    },
                    5400
                );


            /*
             * Menu transition happens well after
             * the boom instead of immediately.
             */

            this.introFinishTimer =
                setTimeout(
                    () => {
                        this.finishIntro();
                    },
                    8200
                );

        },


        /* ======================================================
           INTRO PARTICLES
           ====================================================== */

        createIntroParticles() {

            const container =
                this.elements.introParticles;

            if (!container) {
                return;
            }

            container.innerHTML = "";

            const count = 90;

            for (
                let i = 0;
                i < count;
                i++
            ) {

                const particle =
                    document.createElement(
                        "span"
                    );

                particle.className =
                    "intro-particle";

                const angle =
                    Math.floor(
                        Math.random() * 360
                    );

                const distance =
                    180 +
                    Math.random() * 480;

                const size =
                    1 +
                    Math.random() * 3.5;

                const scale =
                    0.55 +
                    Math.random() * 1.2;

                const delay =
                    Math.random() * 180;

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


        /* ======================================================
           INTRO BOOM
           ====================================================== */

        playIntroBoom() {

            const intro =
                this.elements.introScreen;

            if (!intro) {
                return;
            }

            if (
                intro.classList.contains(
                    "intro-boom-active"
                )
            ) {
                return;
            }

            intro.classList.add(
                "intro-boom-active"
            );

            this.playAudio(
                this.audio.boom
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:intro-boom"
                )
            );

        },


        /* ======================================================
           INTRO FINISH
           ====================================================== */

        finishIntro() {

            if (
                this.state.introComplete
            ) {
                return;
            }

            this.state.introComplete =
                true;

            const intro =
                this.elements.introScreen;

            if (!intro) {
                this.showMenu();
                return;
            }

            intro.classList.add(
                "intro-complete"
            );

            setTimeout(
                () => {

                    intro.hidden =
                        true;

                    this.showMenu();

                },
                1200
            );

        },


        /* ======================================================
           MENU
           ====================================================== */

        showMenu() {

            const menu =
                this.elements.mainMenu;

            if (!menu) {
                return;
            }

            menu.hidden =
                false;

            this.hideAllModals();

            this.playMenuMusic();

        },


        hideMenu() {

            const menu =
                this.elements.mainMenu;

            if (menu) {
                menu.hidden =
                    true;
            }

        },


        playMenuMusic() {

            if (
                !this.state.musicEnabled
            ) {
                return;
            }

            if (
                !this.audio.menu
            ) {
                return;
            }

            this.setAudioVolumes();

            try {

                this.audio.menu.loop =
                    true;

                const promise =
                    this.audio.menu.play();

                if (
                    promise &&
                    typeof promise.catch ===
                        "function"
                ) {
                    promise.catch(() => {});
                }

            } catch (_) {}

        },


        stopMenuMusic() {

            if (
                this.audio.menu
            ) {
                this.audio.menu.pause();

                try {
                    this.audio.menu.currentTime =
                        0;
                } catch (_) {}
            }

        },


        /* ======================================================
           INTERFACE BINDINGS
           ====================================================== */

        bindInterface() {

            this.bind(
                this.elements.playButton,
                () => {
                    this.playClick();
                    this.state.mode =
                        "singleplayer";
                    this.openModal(
                        "platformModal"
                    );
                }
            );


            this.bind(
                this.elements.multiplayerButton,
                () => {
                    this.playClick();
                    this.state.mode =
                        "multiplayer";
                    this.openModal(
                        "multiplayerModal"
                    );
                    this.connectServer();
                }
            );


            this.bind(
                this.elements.settingsButton,
                () => {
                    this.playClick();
                    this.openModal(
                        "settingsModal"
                    );
                }
            );


            this.bind(
                this.elements.creditsButton,
                () => {
                    this.playClick();
                    this.openModal(
                        "creditsModal"
                    );
                }
            );


            this.bind(
                this.elements.hostButton,
                () => {
                    this.playClick();
                    this.closeModal(
                        "multiplayerModal"
                    );
                    this.openModal(
                        "hostModal"
                    );
                    this.connectServer();
                }
            );


            this.bind(
                this.elements.joinButton,
                () => {
                    this.playClick();
                    this.closeModal(
                        "multiplayerModal"
                    );
                    this.openModal(
                        "joinModal"
                    );
                    this.connectServer();
                }
            );


            this.bind(
                this.elements.createLobbyButton,
                () => {
                    this.createLobby();
                }
            );


            this.bind(
                this.elements.joinLobbyButton,
                () => {
                    this.joinLobby();
                }
            );


            this.bind(
                this.elements.startGameButton,
                () => {
                    this.startHostedGame();
                }
            );


            this.bind(
                this.elements.leaveLobbyButton,
                () => {
                    this.leaveLobby();
                }
            );


            this.bind(
                this.elements.copyLobbyCode,
                () => {
                    this.copyLobbyCode();
                }
            );


            this.bind(
                this.elements.resumeButton,
                () => {
                    this.resumeGame();
                }
            );


            this.bind(
                this.elements.pauseMenuButton,
                () => {
                    this.returnToMenu();
                }
            );


            this.bind(
                this.elements.restartButton,
                () => {
                    this.restartGame();
                }
            );


            this.bind(
                this.elements.caughtMenuButton,
                () => {
                    this.returnToMenu();
                }
            );


            this.bind(
                this.elements.voiceButton,
                () => {
                    this.toggleVoice();
                }
            );


            this.bind(
                this.elements.mobileSprint,
                () => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:mobile-sprint"
                        )
                    );
                }
            );


            this.bind(
                this.elements.mobileInteract,
                () => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:mobile-interact"
                        )
                    );
                }
            );


            this.bindPlatformButtons();

            this.bindCloseButtons();

            this.bindSettings();

            this.bindKeyboard();

        },


        bind(
            element,
            callback
        ) {

            if (!element) {
                return;
            }

            element.addEventListener(
                "click",
                callback
            );

        },


        bindCloseButtons() {

            document
                .querySelectorAll(
                    "[data-close]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            () => {

                                this.playClick();

                                this.closeModal(
                                    button.dataset.close
                                );

                            }
                        );

                    }
                );

        },


        bindPlatformButtons() {

            document
                .querySelectorAll(
                    "[data-platform]"
                )
                .forEach(
                    (button) => {

                        button.addEventListener(
                            "click",
                            () => {

                                this.playClick();

                                this.state.platform =
                                    button.dataset.platform ===
                                    "mobile"
                                        ? "mobile"
                                        : "pc";

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
                                } else {
                                    this.startSingleplayer();
                                }

                            }
                        );

                    }
                );

        },


        bindSettings() {

            const music =
                this.elements.musicToggle;

            const sfx =
                this.elements.sfxToggle;

            const volume =
                this.elements.volumeSlider;

            if (music) {

                music.addEventListener(
                    "change",
                    () => {

                        this.state.musicEnabled =
                            music.checked;

                        localStorage.setItem(
                            "seeker_music",
                            String(
                                this.state.musicEnabled
                            )
                        );

                        if (
                            this.state.musicEnabled
                        ) {
                            this.playMenuMusic();
                        } else {
                            this.stopMenuMusic();
                        }

                    }
                );

            }


            if (sfx) {

                sfx.addEventListener(
                    "change",
                    () => {

                        this.state.sfxEnabled =
                            sfx.checked;

                        localStorage.setItem(
                            "seeker_sfx",
                            String(
                                this.state.sfxEnabled
                            )
                        );

                    }
                );

            }


            if (volume) {

                volume.addEventListener(
                    "input",
                    () => {

                        this.state.volume =
                            Number(
                                volume.value
                            );

                        localStorage.setItem(
                            "seeker_volume",
                            String(
                                this.state.volume
                            )
                        );

                        this.updateVolumeUI();

                        this.setAudioVolumes();

                    }
                );

            }

        },


        loadSettings() {

            const music =
                this.elements.musicToggle;

            const sfx =
                this.elements.sfxToggle;

            const volume =
                this.elements.volumeSlider;

            if (music) {
                music.checked =
                    this.state.musicEnabled;
            }

            if (sfx) {
                sfx.checked =
                    this.state.sfxEnabled;
            }

            if (volume) {
                volume.value =
                    this.state.volume;
            }

            this.updateVolumeUI();

        },


        updateVolumeUI() {

            const label =
                this.elements.volumeValue;

            if (label) {

                label.textContent =
                    `${Math.round(
                        this.state.volume * 100
                    )}%`;

            }

        },


        bindKeyboard() {

            document.addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.code ===
                        "Space"
                    ) {

                        if (
                            !this.state.introComplete
                        ) {

                            clearTimeout(
                                this.introBoomTimer
                            );

                            clearTimeout(
                                this.introFinishTimer
                            );

                            this.playIntroBoom();

                            setTimeout(
                                () => {
                                    this.finishIntro();
                                },
                                1000
                            );

                        }

                    }


                    if (
                        event.code ===
                        "Escape"
                    ) {

                        if (
                            this.isModalOpen()
                        ) {

                            this.closeTopModal();

                        } else if (
                            this.state.started
                        ) {

                            this.pauseGame();

                        }

                    }

                }
            );

        },


        /* ======================================================
           MODALS
           ====================================================== */

        openModal(id) {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            element.hidden =
                false;

        },


        closeModal(id) {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            element.hidden =
                true;

        },


        hideAllModals() {

            [
                "platformModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal"
            ].forEach(
                (id) => {
                    this.closeModal(id);
                }
            );

        },


        isModalOpen() {

            return [
                "platformModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal"
            ].some(
                (id) => {

                    const element =
                        document.getElementById(id);

                    return (
                        element &&
                        !element.hidden
                    );

                }
            );

        },


        closeTopModal() {

            const ids = [
                "creditsModal",
                "settingsModal",
                "lobbyModal",
                "joinModal",
                "hostModal",
                "multiplayerModal",
                "platformModal"
            ];

            for (
                const id of ids
            ) {

                const element =
                    document.getElementById(id);

                if (
                    element &&
                    !element.hidden
                ) {

                    this.closeModal(id);
                    return;

                }

            }

        },


        /* ======================================================
           SINGLEPLAYER
           ====================================================== */

        startSingleplayer() {

            this.showLoading(
                "INITIALIZING SINGLEPLAYER"
            );

            this.state.mode =
                "singleplayer";

            this.state.map =
                "facility";

            setTimeout(
                () => {

                    this.enterGame({
                        multiplayer: false,
                        platform:
                            this.state.platform,
                        map:
                            this.state.map
                    });

                },
                900
            );

        },


        /* ======================================================
           REAL SERVER
           ====================================================== */

        getServerURL() {

            return (
                window.SEEKER_SERVER_URL ||
                localStorage.getItem(
                    "seeker_server_url"
                ) ||
                "ws://localhost:8080"
            );

        },


        connectServer() {

            if (
                this.state.socket &&
                (
                    this.state.socket.readyState ===
                        WebSocket.OPEN ||
                    this.state.socket.readyState ===
                        WebSocket.CONNECTING
                )
            ) {
                return;
            }

            const url =
                this.getServerURL();

            this.updateNetworkStatus(
                "CONNECTING",
                "connecting"
            );

            try {

                const socket =
                    new WebSocket(url);

                this.state.socket =
                    socket;

                socket.addEventListener(
                    "open",
                    () => {

                        this.state.serverConnected =
                            true;

                        this.updateNetworkStatus(
                            "ONLINE",
                            "online"
                        );

                        if (
                            this.state.pendingRequest
                        ) {

                            const request =
                                this.state.pendingRequest;

                            this.state.pendingRequest =
                                null;

                            this.send(request);

                        }

                    }
                );


                socket.addEventListener(
                    "message",
                    (event) => {

                        this.handleServerMessage(
                            event.data
                        );

                    }
                );


                socket.addEventListener(
                    "close",
                    () => {

                        this.state.serverConnected =
                            false;

                        this.updateNetworkStatus(
                            "OFFLINE",
                            "offline"
                        );

                    }
                );


                socket.addEventListener(
                    "error",
                    () => {

                        this.state.serverConnected =
                            false;

                        this.updateNetworkStatus(
                            "ERROR",
                            "error"
                        );

                    }
                );

            } catch (error) {

                console.error(
                    "[THE SEEKER] Server connection failed:",
                    error
                );

                this.state.serverConnected =
                    false;

                this.updateNetworkStatus(
                    "ERROR",
                    "error"
                );

            }

        },


        send(payload) {

            const socket =
                this.state.socket;

            if (
                !socket ||
                socket.readyState !==
                    WebSocket.OPEN
            ) {

                return false;

            }

            try {

                socket.send(
                    JSON.stringify(payload)
                );

                return true;

            } catch (error) {

                console.error(
                    "[THE SEEKER] Send error:",
                    error
                );

                return false;

            }

        },


        /* ======================================================
           CREATE LOBBY
           ====================================================== */

        createLobby() {

            const playerName =
                (
                    this.elements
                        .hostPlayerName
                        ?.value
                    || this.state.playerName
                ).trim();

            const lobbyName =
                (
                    this.elements
                        .hostLobbyName
                        ?.value
                    || "The Seeker Lobby"
                ).trim();

            const map =
                this.elements.hostMap?.value ||
                "facility";

            if (!playerName) {

                this.setStatus(
                    "hostStatus",
                    "ENTER A PLAYER NAME"
                );

                return;
            }

            this.state.playerName =
                playerName;

            localStorage.setItem(
                "seeker_player_name",
                playerName
            );

            const request = {
                type: "create_lobby",
                lobbyName:
                    lobbyName ||
                    "The Seeker Lobby",
                playerName,
                maxPlayers: 4,
                map
            };

            this.state.pendingRequest =
                request;

            this.setStatus(
                "hostStatus",
                "CONNECTING TO REAL SERVER..."
            );

            this.connectServer();

            if (
                this.state.serverConnected
            ) {

                this.state.pendingRequest =
                    null;

                this.send(request);

                this.setStatus(
                    "hostStatus",
                    "CREATING LOBBY..."
                );

            }

        },


        /* ======================================================
           JOIN EXISTING LOBBY
           ====================================================== */

        joinLobby() {

            const playerName =
                (
                    this.elements
                        .joinPlayerName
                        ?.value
                    || this.state.playerName
                ).trim();

            const code =
                (
                    this.elements
                        .joinCode
                        ?.value
                    || ""
                )
                    .trim()
                    .toUpperCase();

            if (!playerName) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A PLAYER NAME"
                );

                return;
            }

            if (!code) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A LOBBY CODE"
                );

                return;
            }

            this.state.playerName =
                playerName;

            localStorage.setItem(
                "seeker_player_name",
                playerName
            );

            const request = {
                type: "join_lobby",
                code,
                playerName
            };

            this.state.pendingRequest =
                request;

            this.setStatus(
                "joinStatus",
                "CONNECTING TO REAL SERVER..."
            );

            this.connectServer();

            if (
                this.state.serverConnected
            ) {

                this.state.pendingRequest =
                    null;

                this.send(request);

                this.setStatus(
                    "joinStatus",
                    "JOINING LOBBY..."
                );

            }

        },


        /* ======================================================
           SERVER MESSAGES
           ====================================================== */

        handleServerMessage(raw) {

            let message;

            try {

                message =
                    typeof raw === "string"
                        ? JSON.parse(raw)
                        : raw;

            } catch (_) {

                return;

            }


            if (
                !message ||
                typeof message !== "object"
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

                case "lobby_state":
                case "lobby_updated":
                    this.handleLobbyState(
                        message
                    );
                    break;

                case "game_started":
                    this.handleGameStarted(
                        message
                    );
                    break;

                case "player_state":
                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:remote-player-state",
                            {
                                detail:
                                    message
                            }
                        )
                    );
                    break;

                case "game_event":
                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:network-game-event",
                            {
                                detail:
                                    message
                            }
                        )
                    );
                    break;

                case "voice_signal":
                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:voice-signal",
                            {
                                detail:
                                    message
                            }
                        )
                    );
                    break;

                case "error":
                    this.handleServerError(
                        message
                    );
                    break;

                default:
                    break;

            }

        },


        handleConnected(message) {

            this.state.serverConnected =
                true;

            this.state.localPlayerId =
                message.playerId ||
                null;

            this.updateNetworkStatus(
                "ONLINE",
                "online"
            );

        },


        handleLobbyCreated(message) {

            this.state.lobbyCode =
                message.code ||
                message.lobby?.code ||
                "";

            this.state.lobby =
                message.lobby || {
                    code:
                        this.state.lobbyCode,
                    players: []
                };

            this.state.lobby.localPlayerId =
                message.playerId ||
                this.state.localPlayerId;

            this.state.map =
                this.state.lobby.map ||
                message.map ||
                "facility";

            this.renderLobby();

            this.closeModal(
                "hostModal"
            );

            this.openModal(
                "lobbyModal"
            );

            this.setStatus(
                "lobbyStatus",
                `LOBBY CREATED — ${this.state.lobbyCode}`
            );

            this.playSuccess();

        },


        handleLobbyJoined(message) {

            this.state.lobbyCode =
                message.code ||
                message.lobby?.code ||
                this.state.lobbyCode;

            this.state.lobby =
                message.lobby || {
                    code:
                        this.state.lobbyCode,
                    players: []
                };

            this.state.lobby.localPlayerId =
                message.playerId ||
                this.state.localPlayerId;

            this.state.map =
                this.state.lobby.map ||
                message.map ||
                "facility";

            this.renderLobby();

            this.closeModal(
                "joinModal"
            );

            this.openModal(
                "lobbyModal"
            );

            this.setStatus(
                "lobbyStatus",
                `JOINED — ${this.state.lobbyCode}`
            );

            this.playSuccess();

        },


        handleLobbyState(message) {

            const lobby =
                message.lobby ||
                message;

            if (
                lobby &&
                typeof lobby ===
                    "object"
            ) {

                this.state.lobby =
                    {
                        ...(this.state.lobby || {}),
                        ...lobby
                    };

            }

            if (
                message.code
            ) {

                this.state.lobbyCode =
                    message.code;

            }

            this.state.map =
                this.state.lobby?.map ||
                this.state.map;

            this.renderLobby();

        },


        handleGameStarted(message) {

            this.state.map =
                message.map ||
                this.state.map ||
                "facility";

            if (
                this.state.lobby
            ) {

                this.state.lobby.started =
                    true;

                this.state.lobby.map =
                    this.state.map;

            }

            this.closeModal(
                "lobbyModal"
            );

            this.enterGame({
                multiplayer: true,
                platform:
                    this.state.platform,
                map:
                    this.state.map,
                lobby:
                    this.state.lobby
            });

        },


        handleServerError(message) {

            const text =
                String(
                    message.message ||
                    "SERVER ERROR"
                );

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

            this.playError();

        },


        /* ======================================================
           LOBBY UI
           ====================================================== */

        renderLobby() {

            const lobby =
                this.state.lobby || {};

            const players =
                Array.isArray(
                    lobby.players
                )
                    ? lobby.players
                    : [];

            if (
                this.elements.lobbyCode
            ) {

                this.elements.lobbyCode.textContent =
                    lobby.code ||
                    this.state.lobbyCode ||
                    "------";

            }

            if (
                this.elements.playerCount
            ) {

                this.elements.playerCount.textContent =
                    `${players.length} / ${
                        lobby.maxPlayers || 4
                    }`;

            }

            if (
                this.elements.lobbyMap
            ) {

                this.elements.lobbyMap.textContent =
                    this.mapDisplayName(
                        lobby.map ||
                        this.state.map
                    );

            }

            const list =
                this.elements.lobbyPlayers;

            if (!list) {
                return;
            }

            list.innerHTML = "";

            players.forEach(
                (player) => {

                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "lobby-player";

                    const dot =
                        document.createElement(
                            "span"
                        );

                    dot.className =
                        "player-indicator";

                    const name =
                        document.createElement(
                            "span"
                        );

                    name.className =
                        "player-name";

                    name.textContent =
                        player.name ||
                        "Player";

                    const role =
                        document.createElement(
                            "span"
                        );

                    role.className =
                        "player-role";

                    const hostId =
                        lobby.hostId ||
                        lobby.host;

                    role.textContent =
                        player.id === hostId
                            ? "HOST"
                            : "PLAYER";

                    row.appendChild(dot);
                    row.appendChild(name);
                    row.appendChild(role);

                    list.appendChild(row);

                }
            );


            const hostId =
                lobby.hostId ||
                lobby.host;

            const localId =
                lobby.localPlayerId ||
                this.state.localPlayerId;

            const isHost =
                !hostId ||
                !localId ||
                hostId === localId;

            if (
                this.elements.startGameButton
            ) {

                this.elements.startGameButton.disabled =
                    !isHost;

                this.elements.startGameButton.textContent =
                    isHost
                        ? "START GAME"
                        : "WAITING FOR HOST";

            }

        },


        mapDisplayName(map) {

            switch (map) {

                case "underground":
                    return "UNDERGROUND COMPLEX";

                case "blackwood":
                    return "BLACKWOOD FOREST";

                case "facility":
                default:
                    return "ABANDONED FACILITY";

            }

        },


        /* ======================================================
           START HOSTED GAME
           ====================================================== */

        startHostedGame() {

            if (
                !this.state.lobby
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "NO LOBBY"
                );

                return;

            }

            const lobby =
                this.state.lobby;

            const hostId =
                lobby.hostId ||
                lobby.host;

            const localId =
                lobby.localPlayerId ||
                this.state.localPlayerId;

            if (
                hostId &&
                localId &&
                hostId !== localId
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "ONLY THE HOST CAN START"
                );

                return;

            }

            this.playClick();

            const sent =
                this.send({
                    type: "start_game",
                    code:
                        lobby.code ||
                        this.state.lobbyCode,
                    map:
                        lobby.map ||
                        this.state.map ||
                        "facility"
                });

            if (!sent) {

                this.setStatus(
                    "lobbyStatus",
                    "SERVER CONNECTION LOST"
                );

            } else {

                this.setStatus(
                    "lobbyStatus",
                    "STARTING GAME..."
                );

            }

        },


        /* ======================================================
           LEAVE LOBBY
           ====================================================== */

        leaveLobby() {

            if (
                this.state.lobbyCode
            ) {

                this.send({
                    type:
                        "leave_lobby",
                    code:
                        this.state.lobbyCode
                });

            }

            this.state.lobby =
                null;

            this.state.lobbyCode =
                "";

            this.closeModal(
                "lobbyModal"
            );

            this.openModal(
                "multiplayerModal"
            );

            this.setStatus(
                "networkStatus",
                "LOBBY CLOSED"
            );

        },


        /* ======================================================
           COPY
           ====================================================== */

        async copyLobbyCode() {

            const code =
                this.state.lobbyCode;

            if (!code) {
                return;
            }

            try {

                if (
                    navigator.clipboard
                ) {

                    await navigator.clipboard.writeText(
                        code
                    );

                }

                this.setStatus(
                    "lobbyStatus",
                    "CODE COPIED"
                );

                this.playSuccess();

            } catch (_) {

                this.setStatus(
                    "lobbyStatus",
                    code
                );

            }

        },


        /* ======================================================
           NETWORK UI
           ====================================================== */

        updateNetworkStatus(
            label,
            status
        ) {

            const elements = [
                this.elements.networkStatus,
                this.elements.menuServerStatus
            ];

            elements.forEach(
                (element) => {

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


        /* ======================================================
           LOADING
           ====================================================== */

        showLoading(text) {

            const screen =
                this.elements.loadingScreen;

            const label =
                this.elements.loadingText;

            const progress =
                this.elements.loadingProgress;

            if (!screen) {
                return;
            }

            screen.hidden =
                false;

            if (label) {
                label.textContent =
                    text || "LOADING";
            }

            if (progress) {

                progress.style.width =
                    "0%";

                requestAnimationFrame(
                    () => {

                        progress.style.width =
                            "100%";

                    }
                );

            }

        },


        hideLoading() {

            if (
                this.elements.loadingScreen
            ) {

                this.elements.loadingScreen.hidden =
                    true;

            }

        },


        /* ======================================================
           ENTER GAME
           ====================================================== */

        enterGame(options) {

            this.hideMenu();

            this.hideAllModals();

            this.stopMenuMusic();

            this.showLoading(
                "ENTERING THE FACILITY"
            );

            setTimeout(
                () => {

                    this.hideLoading();

                    if (
                        this.elements.gameScreen
                    ) {

                        this.elements.gameScreen.hidden =
                            false;

                    }

                    this.state.started =
                        true;

                    document.body.dataset.platform =
                        options.platform;

                    document.body.dataset.mode =
                        options.multiplayer
                            ? "multiplayer"
                            : "singleplayer";

                    if (
                        options.platform ===
                        "mobile"
                    ) {

                        this.enableMobileUI();

                    } else {

                        this.disableMobileUI();

                    }

                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:start",
                            {
                                detail:
                                    options
                            }
                        )
                    );

                },
                850
            );

        },


        /* ======================================================
           MOBILE
           ====================================================== */

        enableMobileUI() {

            const controls =
                this.elements.mobileControls;

            if (controls) {
                controls.hidden =
                    false;
            }

            document.body.classList.add(
                "mobile-version"
            );

        },


        disableMobileUI() {

            const controls =
                this.elements.mobileControls;

            if (controls) {
                controls.hidden =
                    true;
            }

            document.body.classList.remove(
                "mobile-version"
            );

        },


        /* ======================================================
           GAME CONTROLS
           ====================================================== */

        pauseGame() {

            if (
                !this.state.started
            ) {
                return;
            }

            const overlay =
                this.elements.pauseOverlay;

            if (overlay) {
                overlay.hidden =
                    false;
            }

            document.body.classList.add(
                "game-paused"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:pause"
                )
            );

        },


        resumeGame() {

            const overlay =
                this.elements.pauseOverlay;

            if (overlay) {
                overlay.hidden =
                    true;
            }

            document.body.classList.remove(
                "game-paused"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:resume"
                )
            );

        },


        restartGame() {

            const caught =
                this.elements.caughtOverlay;

            if (caught) {
                caught.hidden =
                    true;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:restart"
                )
            );

            if (
                window.Game &&
                typeof window.Game.restart ===
                    "function"
            ) {

                window.Game.restart();

            } else {

                this.enterGame({
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

            }

        },


        /* ======================================================
           MAIN MENU
           ====================================================== */

        returnToMenu() {

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:stop"
                )
            );

            if (
                window.Game &&
                typeof window.Game.stop ===
                    "function"
            ) {

                try {
                    window.Game.stop();
                } catch (_) {}

            }

            this.state.started =
                false;

            if (
                this.elements.gameScreen
            ) {

                this.elements.gameScreen.hidden =
                    true;

            }

            if (
                this.elements.pauseOverlay
            ) {

                this.elements.pauseOverlay.hidden =
                    true;

            }

            if (
                this.elements.caughtOverlay
            ) {

                this.elements.caughtOverlay.hidden =
                    true;

            }

            this.showMenu();

        },


        /* ======================================================
           VOICE
           ====================================================== */

        async toggleVoice() {

            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.toggle ===
                    "function"
            ) {

                try {

                    await window.SeekerVoice.toggle();

                    this.updateVoiceState();

                    return;

                } catch (_) {}

            }

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:voice-toggle"
                )
            );

        },


        updateVoiceState() {

            const button =
                this.elements.voiceButton;

            if (!button) {
                return;
            }

            const active =
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.isActive ===
                    "function"
                    ? !!window.SeekerVoice.isActive()
                    : false;

            button.classList.toggle(
                "active",
                active
            );

            const label =
                button.querySelector(
                    "span:last-child"
                );

            if (label) {

                label.textContent =
                    active
                        ? "VOICE ON"
                        : "VOICE";

            }

        },


        /* ======================================================
           EXTERNAL GAME STATE
           ====================================================== */

        bindGameEvents() {

            window.addEventListener(
                "seeker:player-caught",
                () => {

                    const overlay =
                        this.elements.caughtOverlay;

                    if (overlay) {
                        overlay.hidden =
                            false;
                    }

                    this.playAudio(
                        this.audio.caught
                    );

                }
            );


            window.addEventListener(
                "seeker:seeker-distance",
                (event) => {

                    const distance =
                        Number(
                            event.detail?.distance
                        );

                    if (
                        !Number.isFinite(
                            distance
                        )
                    ) {
                        return;
                    }

                    this.updateThreat(
                        distance
                    );

                }
            );

        },


        updateThreat(distance) {

            const display =
                this.elements.threatDisplay;

            const text =
                this.elements.threatText;

            const danger =
                this.elements.dangerOverlay;

            if (!display) {
                return;
            }

            if (distance < 9) {

                display.dataset.threat =
                    "high";

                if (text) {
                    text.textContent =
                        "VERY CLOSE";
                }

                if (danger) {
                    danger.classList.add(
                        "active"
                    );
                }

            } else if (distance < 20) {

                display.dataset.threat =
                    "high";

                if (text) {
                    text.textContent =
                        "NEARBY";
                }

                if (danger) {
                    danger.classList.remove(
                        "active"
                    );
                }

            } else if (distance < 45) {

                display.dataset.threat =
                    "medium";

                if (text) {
                    text.textContent =
                        "DETECTED";
                }

                if (danger) {
                    danger.classList.remove(
                        "active"
                    );
                }

            } else {

                display.dataset.threat =
                    "low";

                if (text) {
                    text.textContent =
                        "UNKNOWN";
                }

                if (danger) {
                    danger.classList.remove(
                        "active"
                    );
                }

            }

        },


        /* ======================================================
           STATUS HELPER
           ====================================================== */

        setStatus(id, message) {

            const element =
                this.elements[id] ||
                document.getElementById(id);

            if (!element) {
                return;
            }

            element.textContent =
                message;

        }

    };


    /* ============================================================
       STARTUP EVENTS
       ============================================================ */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            Main.init();

            Main.bindGameEvents();

        },
        {
            once: true
        }
    );


    /* ============================================================
       GLOBAL GAME HOOKS
       ============================================================ */

    window.addEventListener(
        "seeker:player-caught",
        () => {

            if (
                Main.elements.caughtOverlay
            ) {

                Main.elements.caughtOverlay.hidden =
                    false;

            }

        }
    );


    window.addEventListener(
        "seeker:player-escaped",
        () => {

            Main.state.started =
                false;

        }
    );


    window.addEventListener(
        "seeker:game-ready",
        () => {

            Main.hideLoading();

        }
    );


    window.addEventListener(
        "seeker:game-objective",
        (event) => {

            if (
                Main.elements.objectiveText
            ) {

                Main.elements.objectiveText.textContent =
                    event.detail?.text ||
                    "FIND THE THREE BUTTONS.";

            }

        }
    );


    window.addEventListener(
        "seeker:button-progress",
        (event) => {

            const found =
                Number(
                    event.detail?.found
                ) || 0;

            if (
                Main.elements.buttonProgress
            ) {

                Main.elements.buttonProgress.textContent =
                    `${found} / 3`;

            }

        }
    );


    window.addEventListener(
        "seeker:setup-timer",
        (event) => {

            const seconds =
                Math.max(
                    0,
                    Math.ceil(
                        Number(
                            event.detail?.seconds
                        ) || 0
                    )
                );

            const minutes =
                Math.floor(
                    seconds / 60
                );

            const remainder =
                seconds % 60;

            if (
                Main.elements.setupTimer
            ) {

                Main.elements.setupTimer.textContent =
                    `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;

            }

        }
    );


    window.addEventListener(
        "seeker:intro-boom",
        () => {

            document.body.classList.add(
                "intro-boom-shake"
            );

            setTimeout(
                () => {

                    document.body.classList.remove(
                        "intro-boom-shake"
                    );

                },
                750
            );

        }
    );

})();