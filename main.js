/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   main.js
   ------------------------------------------------------------
   REBUILT FOR:
   - Working menu buttons
   - Working HOST LOBBY
   - Working JOIN LOBBY
   - Working platform selection
   - Real WebSocket lobby connection
   - Host creation queue while server connects
   - Host-only START GAME
   - Join never creates a new lobby
   - Stable intro -> menu transition
   - Working settings
   - Working pause / caught / restart
   - PC / MOBILE switching
   ============================================================ */

(() => {
    "use strict";

    const Main = {

        /* ======================================================
           STATE
           ====================================================== */

        state: {
            initialized: false,

            introComplete: false,

            mode: "singleplayer",

            platform: "pc",

            map: "facility",

            started: false,

            serverConnected: false,

            socket: null,

            localPlayerId: null,

            sessionToken: null,

            lobbyCode: "",

            lobby: null,

            pendingRequest: null,

            pendingRequestType: null,

            connecting: false,

            playerName:
                localStorage.getItem(
                    "seeker_player_name"
                ) ||
                `Player${Math.floor(
                    1000 +
                    Math.random() *
                    9000
                )}`,

            musicEnabled:
                localStorage.getItem(
                    "seeker_music"
                ) !== "false",

            sfxEnabled:
                localStorage.getItem(
                    "seeker_sfx"
                ) !== "false",

            volume:
                MainNumber(
                    localStorage.getItem(
                        "seeker_volume"
                    ),
                    0.75
                )
        },


        /* ======================================================
           DOM
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
            warning: null,
            caught: null
        },


        /* ======================================================
           INTRO TIMERS
           ====================================================== */

        introTimers: {
            boom: null,
            finish: null,
            menuReveal: null
        },


        /* ======================================================
           INIT
           ====================================================== */

        init() {

            if (
                this.state.initialized
            ) {
                return;
            }

            this.cacheElements();

            this.createAudio();

            this.loadSettings();

            this.bindMenuButtons();

            this.bindModalButtons();

            this.bindPlatformButtons();

            this.bindSettings();

            this.bindGameButtons();

            this.bindKeyboard();

            this.createIntroParticles();

            this.state.initialized =
                true;

            window.Main =
                this;

            this.startIntro();

        },


        /* ======================================================
           DOM CACHE
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
                "mobileSprint",
                "mobileInteract"

            ];

            ids.forEach(
                (id) => {

                    this.elements[id] =
                        document.getElementById(
                            id
                        );

                }
            );

        },


        /* ======================================================
           AUDIO
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

            this.audio.warning =
                this.makeAudio(
                    "audio/warning.mp3",
                    false
                );

            this.audio.caught =
                this.makeAudio(
                    "audio/caught.mp3",
                    false
                );

            this.updateAudioVolumes();

        },


        makeAudio(
            src,
            loop
        ) {

            const audio =
                new Audio();

            audio.src =
                src;

            audio.loop =
                !!loop;

            audio.preload =
                "auto";

            return audio;

        },


        updateAudioVolumes() {

            const volume =
                Number.isFinite(
                    this.state.volume
                )
                    ? this.state.volume
                    : 0.75;


            if (
                this.audio.menu
            ) {
                this.audio.menu.volume =
                    volume *
                    0.36;
            }


            if (
                this.audio.boom
            ) {
                this.audio.boom.volume =
                    volume;
            }


            if (
                this.audio.click
            ) {
                this.audio.click.volume =
                    volume *
                    0.8;
            }


            if (
                this.audio.success
            ) {
                this.audio.success.volume =
                    volume *
                    0.9;
            }


            if (
                this.audio.warning
            ) {
                this.audio.warning.volume =
                    volume;
            }


            if (
                this.audio.caught
            ) {
                this.audio.caught.volume =
                    volume;
            }

        },


        play(
            audio
        ) {

            if (!audio) {
                return;
            }

            try {

                audio.currentTime =
                    0;

                const promise =
                    audio.play();

                if (
                    promise &&
                    typeof
                        promise.catch ===
                    "function"
                ) {

                    promise.catch(
                        () => {}
                    );

                }

            } catch (_) {}

        },


        playClick() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.play(
                this.audio.click
            );

        },


        playSuccess() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.play(
                this.audio.success
            );

        },


        playWarning() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.play(
                this.audio.warning
            );

        },


        playCaughtSound() {

            if (
                !this.state.sfxEnabled
            ) {
                return;
            }

            this.play(
                this.audio.caught
            );

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

            this.audio.menu.volume =
                this.state.volume *
                0.36;

            try {

                const promise =
                    this.audio.menu.play();

                promise?.catch?.(
                    () => {}
                );

            } catch (_) {}

        },


        stopMenuMusic() {

            if (
                !this.audio.menu
            ) {
                return;
            }

            this.audio.menu.pause();

            try {
                this.audio.menu.currentTime =
                    0;
            } catch (_) {}

        },


        /* ======================================================
           MENU BUTTONS
           ====================================================== */

        bindMenuButtons() {

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

        },


        /* ======================================================
           MULTIPLAYER / HOST / JOIN
           ====================================================== */

        bindModalButtons() {

            /*
             * THIS IS THE IMPORTANT PART:
             *
             * HOST LOBBY opens the host window immediately.
             * It does NOT wait for the server before opening it.
             */

            this.bind(
                this.elements.hostButton,
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
                        "CONNECTING TO SERVER..."
                    );

                    this.connectServer();

                }
            );


            this.bind(
                this.elements.joinButton,
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
                        "CONNECTING TO SERVER..."
                    );

                    this.connectServer();

                    setTimeout(
                        () => {

                            this.elements
                                .joinCode
                                ?.focus();

                        },
                        100
                    );

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

        },


        /* ======================================================
           PLATFORM BUTTONS
           ====================================================== */

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

                                const platform =
                                    button.dataset
                                        .platform;

                                this.state.platform =
                                    platform ===
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


        /* ======================================================
           SETTINGS
           ====================================================== */

        bindSettings() {

            const music =
                this.elements.musicToggle;

            const sfx =
                this.elements.sfxToggle;

            const slider =
                this.elements.volumeSlider;


            if (music) {

                music.addEventListener(
                    "change",
                    () => {

                        this.state.musicEnabled =
                            !!music.checked;

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
                            !!sfx.checked;

                        localStorage.setItem(
                            "seeker_sfx",
                            String(
                                this.state.sfxEnabled
                            )
                        );

                    }
                );

            }


            if (slider) {

                slider.addEventListener(
                    "input",
                    () => {

                        const value =
                            Math.max(
                                0,
                                Math.min(
                                    1,
                                    Number(
                                        slider.value
                                    )
                                )
                            );

                        this.state.volume =
                            value;

                        localStorage.setItem(
                            "seeker_volume",
                            String(value)
                        );

                        this.updateVolumeLabel();

                        this.updateAudioVolumes();

                    }
                );

            }

        },


        loadSettings() {

            const music =
                this.elements.musicToggle;

            const sfx =
                this.elements.sfxToggle;

            const slider =
                this.elements.volumeSlider;


            if (
                music
            ) {
                music.checked =
                    this.state.musicEnabled;
            }


            if (
                sfx
            ) {
                sfx.checked =
                    this.state.sfxEnabled;
            }


            if (
                slider
            ) {
                slider.value =
                    String(
                        this.state.volume
                    );
            }


            this.updateVolumeLabel();

            this.updateAudioVolumes();

        },


        updateVolumeLabel() {

            if (
                this.elements.volumeValue
            ) {

                this.elements.volumeValue.textContent =
                    `${Math.round(
                        this.state.volume *
                        100
                    )}%`;

            }

        },


        /* ======================================================
           GAME BUTTONS
           ====================================================== */

        bindGameButtons() {

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
                this.elements.mobileInteract,
                () => {

                    window.dispatchEvent(
                        new CustomEvent(
                            "seeker:mobile-interact"
                        )
                    );

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

        },


        /* ======================================================
           INTRO
           ====================================================== */

        createIntroParticles() {

            const container =
                this.elements.introParticles;

            if (!container) {
                return;
            }

            container.innerHTML =
                "";

            const particleCount =
                100;


            for (
                let i = 0;
                i <
                particleCount;
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
                    170 +
                    Math.random() *
                    520;

                const size =
                    1 +
                    Math.random() *
                    3.5;

                const scale =
                    0.5 +
                    Math.random() *
                    1.3;

                const delay =
                    Math.random() *
                    180;


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


        startIntro() {

            const intro =
                this.elements.introScreen;


            if (!intro) {

                this.showMenu();

                return;

            }


            intro.hidden =
                false;


            intro.classList.remove(
                "intro-visible",
                "intro-boom-active",
                "intro-complete"
            );


            this.introTimers.boom =
                setTimeout(
                    () => {

                        this.playIntroBoom();

                    },
                    5400
                );


            this.introTimers.finish =
                setTimeout(
                    () => {

                        this.finishIntro();

                    },
                    8200
                );


            requestAnimationFrame(
                () => {

                    intro.classList.add(
                        "intro-visible"
                    );

                }
            );

        },


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


            if (
                this.state.sfxEnabled
            ) {

                this.play(
                    this.audio.boom
                );

            }


            window.dispatchEvent(
                new CustomEvent(
                    "seeker:intro-boom"
                )
            );

        },


        finishIntro() {

            if (
                this.state.introComplete
            ) {
                return;
            }


            this.state.introComplete =
                true;


            clearTimeout(
                this.introTimers.boom
            );

            clearTimeout(
                this.introTimers.finish
            );


            const intro =
                this.elements.introScreen;


            if (!intro) {

                this.showMenu();

                return;

            }


            intro.classList.add(
                "intro-complete"
            );


            this.introTimers.menuReveal =
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


            this.state.started =
                false;


            document.body.classList.remove(
                "game-paused"
            );


            this.playMenuMusic();


            this.updateMenuServerStatus();

        },


        hideMenu() {

            if (
                this.elements.mainMenu
            ) {

                this.elements.mainMenu.hidden =
                    true;

            }

        },


        prefillPlayerFields() {

            if (
                this.elements.hostPlayerName
            ) {

                if (
                    !this.elements
                        .hostPlayerName
                        .value
                ) {

                    this.elements
                        .hostPlayerName
                        .value =
                        this.state.playerName;

                }

            }


            if (
                this.elements.joinPlayerName
            ) {

                if (
                    !this.elements
                        .joinPlayerName
                        .value
                ) {

                    this.elements
                        .joinPlayerName
                        .value =
                        this.state.playerName;

                }

            }

        },


        /* ======================================================
           SERVER CONNECTION
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


            if (
                this.state.connecting
            ) {
                return;
            }


            this.state.connecting =
                true;


            this.updateNetworkStatus(
                "CONNECTING",
                "connecting"
            );


            const url =
                this.getServerURL();


            let socket;


            try {

                socket =
                    new WebSocket(
                        url
                    );

            } catch (error) {

                console.error(
                    "[THE SEEKER] WebSocket creation failed:",
                    error
                );

                this.state.connecting =
                    false;

                this.state.serverConnected =
                    false;

                this.updateNetworkStatus(
                    "ERROR",
                    "error"
                );

                this.showConnectionProblem(
                    "Could not connect to the game server."
                );

                return;

            }


            this.state.socket =
                socket;


            socket.addEventListener(
                "open",
                () => {

                    this.state.connecting =
                        false;

                    this.state.serverConnected =
                        true;

                    this.updateNetworkStatus(
                        "ONLINE",
                        "online"
                    );


                    /*
                     * This fixes the previous host bug:
                     * if the user clicked CREATE before the
                     * WebSocket finished connecting, the request
                     * waits here and is sent automatically.
                     */

                    if (
                        this.state.pendingRequest
                    ) {

                        const request =
                            this.state
                                .pendingRequest;

                        this.state.pendingRequest =
                            null;

                        this.state.pendingRequestType =
                            null;

                        this.send(
                            request
                        );

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

                    this.state.connecting =
                        false;

                    this.state.serverConnected =
                        false;

                    this.updateNetworkStatus(
                        "OFFLINE",
                        "offline"
                    );


                    if (
                        this.state.lobby
                    ) {

                        this.setStatus(
                            "lobbyStatus",
                            "SERVER DISCONNECTED"
                        );

                    }

                }
            );


            socket.addEventListener(
                "error",
                (error) => {

                    console.error(
                        "[THE SEEKER] WebSocket error:",
                        error
                    );

                    this.state.connecting =
                        false;

                    this.state.serverConnected =
                        false;

                    this.updateNetworkStatus(
                        "ERROR",
                        "error"
                    );

                    /*
                     * Keep the host/join screen open.
                     * Do not silently close the interface.
                     */

                    this.setStatus(
                        "hostStatus",
                        "SERVER OFFLINE"
                    );

                    this.setStatus(
                        "joinStatus",
                        "SERVER OFFLINE"
                    );

                }
            );

        },


        send(payload) {

            const socket =
                this.state.socket;


            if (
                !socket ||
                socket.readyState !==
                    WebSocket.OPEN
            ) {

                this.state.pendingRequest =
                    payload;

                return false;

            }


            try {

                socket.send(
                    JSON.stringify(
                        payload
                    )
                );

                return true;

            } catch (error) {

                console.error(
                    "[THE SEEKER] Send failed:",
                    error
                );

                return false;

            }

        },


        /* ======================================================
           CREATE LOBBY
           ====================================================== */

        createLobby() {

            const name =
                (
                    this.elements
                        .hostPlayerName
                        ?.value ||
                    this.state.playerName
                ).trim();


            const lobbyName =
                (
                    this.elements
                        .hostLobbyName
                        ?.value ||
                    "The Seeker Lobby"
                ).trim();


            const map =
                this.elements.hostMap
                    ?.value ||
                "facility";


            if (!name) {

                this.setStatus(
                    "hostStatus",
                    "ENTER A PLAYER NAME"
                );

                this.elements
                    .hostPlayerName
                    ?.focus();

                return;

            }


            this.state.playerName =
                name;


            localStorage.setItem(
                "seeker_player_name",
                name
            );


            this.state.map =
                this.validMap(
                    map
                )
                    ? map
                    : "facility";


            const request = {

                type:
                    "create_lobby",

                lobbyName:
                    lobbyName ||
                    "The Seeker Lobby",

                playerName:
                    name,

                maxPlayers:
                    4,

                map:
                    this.state.map

            };


            /*
             * Important:
             * opening HOST LOBBY and creating the lobby
             * are separate steps.
             *
             * The host window already opened.
             * Now the real server request is sent.
             */

            if (
                !this.state.serverConnected
            ) {

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


            this.send(
                request
            );

        },


        /* ======================================================
           JOIN LOBBY
           ====================================================== */

        joinLobby() {

            const name =
                (
                    this.elements
                        .joinPlayerName
                        ?.value ||
                    this.state.playerName
                ).trim();


            const code =
                (
                    this.elements
                        .joinCode
                        ?.value ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            if (!name) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A PLAYER NAME"
                );

                this.elements
                    .joinPlayerName
                    ?.focus();

                return;

            }


            if (!code) {

                this.setStatus(
                    "joinStatus",
                    "ENTER A LOBBY CODE"
                );

                this.elements
                    .joinCode
                    ?.focus();

                return;

            }


            if (
                code.length <
                4
            ) {

                this.setStatus(
                    "joinStatus",
                    "INVALID LOBBY CODE"
                );

                return;

            }


            this.state.playerName =
                name;


            localStorage.setItem(
                "seeker_player_name",
                name
            );


            const request = {

                type:
                    "join_lobby",

                code,

                playerName:
                    name

            };


            /*
             * JOIN ONLY SENDS join_lobby.
             *
             * It NEVER sends create_lobby.
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


            this.send(
                request
            );

        },


        /* ======================================================
           SERVER MESSAGE ROUTER
           ====================================================== */

        handleServerMessage(
            raw
        ) {

            let message;


            try {

                message =
                    typeof raw ===
                    "string"
                        ? JSON.parse(raw)
                        : raw;

            } catch (
                error
            ) {

                console.error(
                    "[THE SEEKER] Bad server message:",
                    raw
                );

                return;

            }


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

                    this.onServerConnected(
                        message
                    );

                    break;


                case "lobby_created":

                    this.onLobbyCreated(
                        message
                    );

                    break;


                case "lobby_joined":

                    this.onLobbyJoined(
                        message
                    );

                    break;


                case "lobby_state":
                case "lobby_updated":

                    this.onLobbyUpdated(
                        message
                    );

                    break;


                case "game_started":

                    this.onGameStarted(
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


                case "host_changed":

                    this.onHostChanged(
                        message
                    );

                    break;


                case "player_disconnected":

                    this.renderLobby();

                    break;


                case "player_left":

                    this.renderLobby();

                    break;


                case "lobby_closed":

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

                    break;


                case "server_shutdown":

                    this.setStatus(
                        "lobbyStatus",
                        "SERVER SHUTTING DOWN"
                    );

                    break;


                case "error":

                    this.handleServerError(
                        message
                    );

                    break;


                default:

                    console.debug(
                        "[THE SEEKER] Unknown message:",
                        message
                    );

                    break;

            }

        },


        /* ======================================================
           CONNECTED
           ====================================================== */

        onServerConnected(
            message
        ) {

            this.state.serverConnected =
                true;


            this.state.localPlayerId =
                message.playerId ||
                this.state.localPlayerId ||
                null;


            this.state.sessionToken =
                message.sessionToken ||
                this.state.sessionToken ||
                null;


            this.updateNetworkStatus(
                "ONLINE",
                "online"
            );


            /*
             * Pending host/join request is handled in
             * the socket open event. This message only
             * updates identity/session data.
             */

        },


        /* ======================================================
           LOBBY CREATED
           ====================================================== */

        onLobbyCreated(
            message
        ) {

            const lobby =
                message.lobby ||
                {};


            this.state.lobby =
                {
                    ...lobby,

                    code:
                        message.code ||
                        lobby.code ||
                        this.state.lobbyCode,

                    localPlayerId:
                        message.playerId ||
                        this.state.localPlayerId

                };


            this.state.lobbyCode =
                this.state.lobby.code ||
                "";


            this.state.map =
                this.state.lobby.map ||
                message.map ||
                this.state.map;


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
                `LOBBY CREATED — ${this.state.lobbyCode}`
            );


            this.playSuccess();

        },


        /* ======================================================
           LOBBY JOINED
           ====================================================== */

        onLobbyJoined(
            message
        ) {

            const lobby =
                message.lobby ||
                {};


            this.state.lobby =
                {
                    ...lobby,

                    code:
                        message.code ||
                        lobby.code ||
                        this.state.lobbyCode,

                    localPlayerId:
                        message.playerId ||
                        this.state.localPlayerId

                };


            this.state.lobbyCode =
                this.state.lobby.code ||
                "";


            this.state.map =
                this.state.lobby.map ||
                message.map ||
                this.state.map;


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
                `JOINED — ${this.state.lobbyCode}`
            );


            this.playSuccess();

        },


        /* ======================================================
           LOBBY UPDATED
           ====================================================== */

        onLobbyUpdated(
            message
        ) {

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


            if (
                message.playerId
            ) {

                this.state.localPlayerId =
                    message.playerId;

            }


            this.state.map =
                this.state.lobby?.map ||
                this.state.map;


            this.renderLobby();

        },


        /* ======================================================
           HOST CHANGED
           ====================================================== */

        onHostChanged(
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
                localId &&
                message.hostId ===
                    localId
            ) {

                this.setStatus(
                    "lobbyStatus",
                    "YOU ARE NOW THE HOST"
                );

            }

        },


        /* ======================================================
           START GAME
           ====================================================== */

        startHostedGame() {

            const lobby =
                this.state.lobby;


            if (!lobby) {

                this.setStatus(
                    "lobbyStatus",
                    "NO LOBBY"
                );

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


            if (
                hostId &&
                localId &&
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
                lobby.code ||
                this.state.lobbyCode;


            if (!code) {

                this.setStatus(
                    "lobbyStatus",
                    "LOBBY CODE MISSING"
                );

                return;

            }


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
                        lobby.map ||
                        this.state.map ||
                        "facility"

                });


            if (!sent) {

                this.setStatus(
                    "lobbyStatus",
                    "SERVER CONNECTION LOST"
                );

            }

        },


        /* ======================================================
           GAME STARTED
           ====================================================== */

        onGameStarted(
            message
        ) {

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

                multiplayer:
                    true,

                platform:
                    this.state.platform,

                map:
                    this.state.map,

                lobby:
                    this.state.lobby

            });

        },


        /* ======================================================
           SERVER ERROR
           ====================================================== */

        handleServerError(
            message
        ) {

            const error =
                String(
                    message.message ||
                    "SERVER ERROR"
                );


            this.setStatus(
                "hostStatus",
                error.toUpperCase()
            );


            this.setStatus(
                "joinStatus",
                error.toUpperCase()
            );


            this.setStatus(
                "lobbyStatus",
                error.toUpperCase()
            );


            this.playWarning();

        },


        /* ======================================================
           LOBBY RENDER
           ====================================================== */

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
                        lobby.maxPlayers ||
                        4
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
                (player) => {

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
                        player.name ||
                        "Player";


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


            if (
                this.elements.startGameButton
            ) {

                const isHost =
                    !hostId ||
                    !localId ||
                    hostId ===
                        localId;


                this.elements
                    .startGameButton
                    .disabled =
                    !isHost ||
                    lobby.started ===
                        true;


                this.elements
                    .startGameButton
                    .textContent =
                    lobby.started
                        ? "STARTING..."
                        : isHost
                        ? "START GAME"
                        : "WAITING FOR HOST";

            }

        },


        /* ======================================================
           LEAVE LOBBY
           ====================================================== */

        leaveLobby() {

            const code =
                this.state.lobbyCode ||
                this.state.lobby?.code;


            if (
                code
            ) {

                this.send({

                    type:
                        "leave_lobby",

                    code

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
                "READY"
            );

        },


        /* ======================================================
           COPY LOBBY CODE
           ====================================================== */

        async copyLobbyCode() {

            const code =
                this.state.lobbyCode;


            if (!code) {
                return;
            }


            try {

                await navigator
                    .clipboard
                    .writeText(
                        code
                    );


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
           START SINGLEPLAYER
           ====================================================== */

        startSingleplayer() {

            this.state.mode =
                "singleplayer";


            this.showLoading(
                "INITIALIZING SINGLEPLAYER"
            );


            setTimeout(
                () => {

                    this.enterGame({

                        multiplayer:
                            false,

                        platform:
                            this.state.platform,

                        map:
                            "facility"

                    });

                },
                850
            );

        },


        /* ======================================================
           ENTER GAME
           ====================================================== */

        enterGame(
            options
        ) {

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
                        this.elements
                            .gameScreen
                    ) {

                        this.elements
                            .gameScreen
                            .hidden =
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

                        this.enableMobile();

                    } else {

                        this.disableMobile();

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


                    /*
                     * Important:
                     * Explicitly ask the game engine to start
                     * if it exposes the method.
                     */

                    if (
                        window.Game &&
                        typeof
                            window.Game.start ===
                        "function"
                    ) {

                        try {

                            window.Game.start(
                                options
                            );

                        } catch (
                            error
                        ) {

                            console.error(
                                "[THE SEEKER] Game.start failed:",
                                error
                            );

                        }

                    }

                },
                850
            );

        },


        /* ======================================================
           LOADING
           ====================================================== */

        showLoading(
            message
        ) {

            const screen =
                this.elements.loadingScreen;


            if (!screen) {
                return;
            }


            screen.hidden =
                false;


            if (
                this.elements.loadingText
            ) {

                this.elements.loadingText.textContent =
                    message ||
                    "LOADING";

            }


            const progress =
                this.elements.loadingProgress;


            if (
                progress
            ) {

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
           MOBILE
           ====================================================== */

        enableMobile() {

            if (
                this.elements.mobileControls
            ) {

                this.elements.mobileControls.hidden =
                    false;

            }


            document.body.classList.add(
                "mobile-version"
            );

            document.body.classList.remove(
                "pc-version"
            );

        },


        disableMobile() {

            if (
                this.elements.mobileControls
            ) {

                this.elements.mobileControls.hidden =
                    true;

            }


            document.body.classList.remove(
                "mobile-version"
            );

            document.body.classList.add(
                "pc-version"
            );

        },


        /* ======================================================
           PAUSE
           ====================================================== */

        pauseGame() {

            if (
                !this.state.started
            ) {
                return;
            }


            if (
                this.elements.pauseOverlay
            ) {

                this.elements.pauseOverlay.hidden =
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


            if (
                window.Game &&
                typeof
                    window.Game.pause ===
                "function"
            ) {

                try {
                    window.Game.pause();
                } catch (_) {}

            }

        },


        resumeGame() {

            if (
                this.elements.pauseOverlay
            ) {

                this.elements.pauseOverlay.hidden =
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


            if (
                window.Game &&
                typeof
                    window.Game.resume ===
                "function"
            ) {

                try {
                    window.Game.resume();
                } catch (_) {}

            }

        },


        /* ======================================================
           RESTART
           ====================================================== */

        restartGame() {

            if (
                this.elements.caughtOverlay
            ) {

                this.elements.caughtOverlay.hidden =
                    true;

            }


            if (
                this.elements.pauseOverlay
            ) {

                this.elements.pauseOverlay.hidden =
                    true;

            }


            document.body.classList.remove(
                "game-paused"
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
                        "[THE SEEKER] Restart failed:",
                        error
                    );

                }

            }


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

        },


        /* ======================================================
           RETURN TO MENU
           ====================================================== */

        returnToMenu() {

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:stop"
                )
            );


            if (
                window.Game &&
                typeof
                    window.Game.stop ===
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


            document.body.classList.remove(
                "game-paused"
            );


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

                    this.updateVoiceUI();

                    return;

                } catch (
                    error
                ) {

                    console.error(
                        "[THE SEEKER] Voice failed:",
                        error
                    );

                }

            }


            window.dispatchEvent(
                new CustomEvent(
                    "seeker:voice-toggle"
                )
            );

        },


        updateVoiceUI() {

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


            const labels =
                button.querySelectorAll(
                    "span"
                );


            if (
                labels.length
            ) {

                labels[
                    labels.length - 1
                ].textContent =
                    active
                        ? "VOICE ON"
                        : "VOICE";

            }

        },


        /* ======================================================
           SETTINGS / MODAL HELPERS
           ====================================================== */

        openModal(
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (!element) {

                console.warn(
                    `[THE SEEKER] Modal not found: ${id}`
                );

                return;

            }


            element.hidden =
                false;


            element.removeAttribute(
                "aria-hidden"
            );

        },


        closeModal(
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (!element) {
                return;
            }


            element.hidden =
                true;


            element.setAttribute(
                "aria-hidden",
                "true"
            );

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

                    this.closeModal(
                        id
                    );

                }
            );

        },


        bindCloseButtons() {
            /* Reserved for additional modal controls. */
        },


        /* ======================================================
           KEYBOARD
           ====================================================== */

        bindKeyboard() {

            document.addEventListener(
                "keydown",
                (event) => {

                    if (
                        event.code ===
                        "Escape"
                    ) {

                        if (
                            this.anyModalOpen()
                        ) {

                            this.closeTopModal();

                            return;

                        }


                        if (
                            this.state.started
                        ) {

                            this.pauseGame();

                        }

                    }


                    if (
                        event.code ===
                        "Space"
                    ) {

                        if (
                            !this.state.introComplete
                        ) {

                            clearTimeout(
                                this.introTimers.boom
                            );

                            clearTimeout(
                                this.introTimers.finish
                            );

                            this.playIntroBoom();


                            this.introTimers.finish =
                                setTimeout(
                                    () => {

                                        this.finishIntro();

                                    },
                                    850
                                );

                        }

                    }

                }
            );

        },


        anyModalOpen() {

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
                        document.getElementById(
                            id
                        );

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
                    document.getElementById(
                        id
                    );


                if (
                    element &&
                    !element.hidden
                ) {

                    this.playClick();

                    this.closeModal(
                        id
                    );

                    return;

                }

            }

        },


        /* ======================================================
           STATUS
           ====================================================== */

        setStatus(
            id,
            message
        ) {

            const element =
                this.elements[id] ||
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                element.textContent =
                    message;

            }

        },


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


        updateMenuServerStatus() {

            if (
                this.state.serverConnected
            ) {

                this.updateNetworkStatus(
                    "ONLINE",
                    "online"
                );

            } else {

                this.updateNetworkStatus(
                    "OFFLINE",
                    "offline"
                );

            }

        },


        showConnectionProblem(
            message
        ) {

            this.setStatus(
                "hostStatus",
                message.toUpperCase()
            );

            this.setStatus(
                "joinStatus",
                message.toUpperCase()
            );

        },


        /* ======================================================
           MAP
           ====================================================== */

        validMap(
            map
        ) {

            return [
                "facility",
                "underground",
                "blackwood"
            ].includes(
                map
            );

        },


        mapDisplayName(
            map
        ) {

            switch (
                map
            ) {

                case "underground":
                    return "UNDERGROUND COMPLEX";

                case "blackwood":
                    return "BLACKWOOD FOREST";

                case "facility":
                default:
                    return "ABANDONED FACILITY";

            }

        }

    };


    /* ============================================================
       GLOBAL EVENT HOOKS
       ============================================================ */

    window.addEventListener(
        "seeker:player-caught",
        () => {

            Main.playCaughtSound();

            if (
                Main.elements.caughtOverlay
            ) {

                Main.elements.caughtOverlay.hidden =
                    false;

            }

            Main.state.started =
                false;

        }
    );


    window.addEventListener(
        "seeker:caught",
        () => {

            Main.playCaughtSound();

            if (
                Main.elements.caughtOverlay
            ) {

                Main.elements.caughtOverlay.hidden =
                    false;

            }

            Main.state.started =
                false;

        }
    );


    window.addEventListener(
        "seeker:button-progress",
        (event) => {

            const found =
                Math.max(
                    0,
                    Math.min(
                        3,
                        Number(
                            event.detail?.found
                        ) || 0
                    )
                );


            if (
                Main.elements.buttonProgress
            ) {

                Main.elements.buttonProgress.textContent =
                    `${found} / 3`;

            }

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
                    `${String(
                        minutes
                    ).padStart(
                        2,
                        "0"
                    )}:${String(
                        remainder
                    ).padStart(
                        2,
                        "0"
                    )}`;

            }

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


            const text =
                Main.elements.threatText;


            const display =
                Main.elements.threatDisplay;


            const danger =
                Main.elements.dangerOverlay;


            if (
                distance <=
                7
            ) {

                if (text) {
                    text.textContent =
                        "VERY CLOSE";
                }

                display &&
                    (
                        display.dataset.threat =
                            "high"
                    );

                danger &&
                    danger.classList.add(
                        "active"
                    );

            } else if (
                distance <=
                18
            ) {

                if (text) {
                    text.textContent =
                        "NEARBY";
                }

                display &&
                    (
                        display.dataset.threat =
                            "high"
                    );

                danger &&
                    danger.classList.remove(
                        "active"
                    );

            } else if (
                distance <=
                35
            ) {

                if (text) {
                    text.textContent =
                        "DETECTED";
                }

                display &&
                    (
                        display.dataset.threat =
                            "medium"
                    );

                danger &&
                    danger.classList.remove(
                        "active"
                    );

            } else {

                if (text) {
                    text.textContent =
                        "HUNTING";
                }

                display &&
                    (
                        display.dataset.threat =
                            "low"
                    );

                danger &&
                    danger.classList.remove(
                        "active"
                    );

            }

        }
    );


    /* ============================================================
       AUTO INIT
       ============================================================ */

    function boot() {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                () => Main.init(),
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


    /* ============================================================
       GLOBAL EXPORT
       ============================================================ */

    window.Main =
        Main;


    /* ============================================================
       NUMBER HELPER
       ============================================================ */

    function MainNumber(
        value,
        fallback
    ) {

        const number =
            Number(value);


        return Number.isFinite(
            number
        )
            ? number
            : fallback;

    }

})();