/* ============================================================
   THE SEEKER
   BlackHollow Games
   main.js
   ============================================================ */

(() => {
    "use strict";

    const Main = {
        ws: null,
        wsState: "CLOSED",

        pendingCreateLobby: null,
        pendingJoinLobby: null,

        localPlayerId: null,
        lobbyCode: "",
        lobby: null,

        currentMap: "abandoned",
        selectedMode: "singleplayer",
        selectedPlatform: "pc",

        playerName:
            localStorage.getItem("seeker_player_name") ||
            `Player${Math.floor(1000 + Math.random() * 9000)}`,

        musicEnabled:
            localStorage.getItem("seeker_music") !== "false",

        sfxEnabled:
            localStorage.getItem("seeker_sfx") !== "false",

        volume:
            Number(localStorage.getItem("seeker_volume")) || 0.75,

        introFinished: false,
        menuReady: false,
        gameStarted: false,

        remotePlayers: new Map(),

        dom: {},

        audio: {
            menu: null,
            game: null,
            boom: null,
            click: null,
            success: null,
            error: null,
            catch: null,
            voice: null
        },

        /* ======================================================
           INITIALIZATION
           ====================================================== */

        init() {
            this.cacheDOM();
            this.bindButtons();
            this.setupPlatformButtons();
            this.setupMapButtons();
            this.setupSettings();
            this.setupKeyboard();
            this.setupAudio();

            this.updatePlayerNameDisplays();
            this.updateSettingsUI();

            window.Main = this;

            this.showMenu();
        },

        cacheDOM() {
            const ids = [
                "intro",
                "introTitle",
                "introFlash",

                "menu",
                "menuOverlay",

                "game",
                "gameCanvas",

                "singlePlayerModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "platformModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal",

                "hostLobby",
                "joinLobby",

                "lobbyCode",
                "joinCode",
                "lobbyName",
                "playerName",
                "playerCount",
                "mapSelect",
                "lobbyPlayers",
                "lobbyStatus",

                "networkStatus",
                "serverStatus",
                "gameStatus",

                "settingsVolume",
                "volumeValue",
                "settingMusic",
                "settingSfx",

                "pauseMenu",
                "caughtScreen",
                "loadingScreen",
                "loadingText",
                "loadingProgress",

                "inventorySlot1",
                "voiceButton",
                "micButton",

                "backToMenu",
                "resumeButton",
                "restartButton"
            ];

            for (const id of ids) {
                this.dom[id] = document.getElementById(id);
            }
        },

        q(selector) {
            return document.querySelector(selector);
        },

        qa(selector) {
            return Array.from(
                document.querySelectorAll(selector)
            );
        },

        /* ======================================================
           MENU BUTTONS
           ====================================================== */

        bindButtons() {
            this.bindMany(
                [
                    "#playButton",
                    "#playBtn",
                    "[data-action='play']",
                    ".play-button"
                ],
                () => this.openPlatformChooser("singleplayer")
            );

            this.bindMany(
                [
                    "#singlePlayerButton",
                    "#singlePlayerBtn",
                    "[data-action='singleplayer']"
                ],
                () => this.openPlatformChooser("singleplayer")
            );

            this.bindMany(
                [
                    "#multiplayerButton",
                    "#multiplayerBtn",
                    "[data-action='multiplayer']"
                ],
                () => this.openMultiplayer()
            );

            this.bindMany(
                [
                    "#settingsButton",
                    "#settingsBtn",
                    "[data-action='settings']"
                ],
                () => this.openModal("settingsModal")
            );

            this.bindMany(
                [
                    "#creditsButton",
                    "#creditsBtn",
                    "[data-action='credits']"
                ],
                () => this.openModal("creditsModal")
            );

            this.bindMany(
                [
                    "#closeSettings",
                    "#settingsClose"
                ],
                () => this.closeModal("settingsModal")
            );

            this.bindMany(
                [
                    "#closeCredits",
                    "#creditsClose"
                ],
                () => this.closeModal("creditsModal")
            );

            this.bindMany(
                [
                    "#closePlatform",
                    "#platformClose"
                ],
                () => this.closeModal("platformModal")
            );

            this.bindMany(
                [
                    "#closeMultiplayer",
                    "#multiplayerClose"
                ],
                () => this.closeModal("multiplayerModal")
            );

            this.bindMany(
                [
                    "#closeHost",
                    "#hostClose"
                ],
                () => this.closeModal("hostModal")
            );

            this.bindMany(
                [
                    "#closeJoin",
                    "#joinClose"
                ],
                () => this.closeModal("joinModal")
            );

            this.bindMany(
                [
                    "#closeLobby",
                    "#lobbyClose"
                ],
                () => this.closeModal("lobbyModal")
            );

            this.bindMany(
                [
                    "#hostButton",
                    "#hostBtn",
                    "[data-action='host']"
                ],
                () => this.openHost()
            );

            this.bindMany(
                [
                    "#joinButton",
                    "#joinBtn",
                    "[data-action='join']"
                ],
                () => this.openJoin()
            );

            this.bindMany(
                [
                    "#createLobbyButton",
                    "#createLobbyBtn",
                    "[data-action='create-lobby']"
                ],
                () => this.createHostLobby()
            );

            this.bindMany(
                [
                    "#joinLobbyButton",
                    "#joinLobbyBtn",
                    "[data-action='join-lobby']"
                ],
                () => this.joinExistingLobby()
            );

            this.bindMany(
                [
                    "#startGameButton",
                    "#startGameBtn",
                    "[data-action='start-game']"
                ],
                () => this.startHostedGame()
            );

            this.bindMany(
                [
                    "#leaveLobbyButton",
                    "#leaveLobbyBtn",
                    "[data-action='leave-lobby']"
                ],
                () => this.leaveLobby()
            );

            this.bindMany(
                [
                    "#copyLobbyCode",
                    "#copyCodeButton"
                ],
                () => this.copyLobbyCode()
            );

            this.bindMany(
                [
                    "#backToMenu",
                    "#menuButton",
                    "[data-action='menu']"
                ],
                () => this.returnToMenu()
            );

            this.bindMany(
                [
                    "#resumeButton",
                    "#resumeBtn"
                ],
                () => this.resumeGame()
            );

            this.bindMany(
                [
                    "#restartButton",
                    "#restartBtn"
                ],
                () => this.restartGame()
            );

            this.bindMany(
                [
                    "#voiceButton",
                    "#micButton"
                ],
                () => this.toggleVoice()
            );
        },

        bindMany(selectors, handler) {
            for (const selector of selectors) {
                this.qa(selector).forEach((element) => {
                    if (
                        element.dataset.mainBound ===
                        "true"
                    ) {
                        return;
                    }

                    element.dataset.mainBound = "true";

                    element.addEventListener(
                        "click",
                        (event) => {
                            event.preventDefault();
                            handler(event);
                        }
                    );
                });
            }
        },

        /* ======================================================
           INTRO
           ====================================================== */

        showMenu() {
            this.gameStarted = false;

            this.hideElement(this.dom.game);
            this.hideAllModals();

            if (!this.dom.intro) {
                this.finishIntro();
                return;
            }

            this.showElement(this.dom.intro);
            this.hideElement(this.dom.menu);

            this.playMenuMusic();

            if (this.introFinished) {
                this.finishIntro();
                return;
            }

            this.runIntroSequence();
        },

        runIntroSequence() {
            const intro = this.dom.intro;
            const title = this.dom.introTitle;
            const flash = this.dom.introFlash;

            if (!intro) {
                this.finishIntro();
                return;
            }

            intro.classList.remove(
                "intro-active",
                "intro-finished",
                "intro-boom"
            );

            if (title) {
                title.classList.remove(
                    "intro-text-visible"
                );
            }

            if (flash) {
                flash.classList.remove(
                    "flash-active"
                );
            }

            void intro.offsetWidth;

            intro.classList.add("intro-active");

            setTimeout(() => {
                if (title) {
                    title.classList.add(
                        "intro-text-visible"
                    );
                }
            }, 450);

            setTimeout(() => {
                intro.classList.add("intro-boom");

                if (flash) {
                    flash.classList.add(
                        "flash-active"
                    );
                }

                this.playSound("boom");

                setTimeout(() => {
                    if (flash) {
                        flash.classList.remove(
                            "flash-active"
                        );
                    }
                }, 450);
            }, 1450);

            setTimeout(() => {
                this.finishIntro();
            }, 2850);
        },

        finishIntro() {
            this.introFinished = true;

            if (this.dom.intro) {
                this.dom.intro.classList.remove(
                    "intro-active",
                    "intro-boom"
                );

                this.dom.intro.classList.add(
                    "intro-finished"
                );
            }

            setTimeout(() => {
                this.hideElement(this.dom.intro);
                this.showElement(this.dom.menu);
                this.menuReady = true;
            }, 450);
        },

        /* ======================================================
           PLATFORM SELECTOR
           ====================================================== */

        openPlatformChooser(mode = "singleplayer") {
            this.selectedMode = mode;

            if (!this.dom.platformModal) {
                this.startSelectedPlatform("pc");
                return;
            }

            this.showElement(this.dom.platformModal);
            this.playClick();
        },

        setupPlatformButtons() {
            const buttons = this.qa(
                "[data-platform], .platform-choice, .platform-button"
            );

            buttons.forEach((button) => {
                if (
                    button.dataset.platformBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.platformBound =
                    "true";

                button.addEventListener("click", () => {
                    const platform =
                        button.dataset.platform ||
                        button.getAttribute(
                            "data-mode"
                        ) ||
                        button.textContent
                            .trim()
                            .toLowerCase();

                    this.startSelectedPlatform(
                        platform.includes("mobile")
                            ? "mobile"
                            : "pc"
                    );
                });
            });
        },

        startSelectedPlatform(platform) {
            this.selectedPlatform =
                platform === "mobile"
                    ? "mobile"
                    : "pc";

            this.closeModal("platformModal");

            if (
                this.selectedMode ===
                "multiplayer"
            ) {
                this.openMultiplayer();
                return;
            }

            this.startSingleplayer();
        },

        /* ======================================================
           SINGLEPLAYER
           ====================================================== */

        startSingleplayer() {
            this.playClick();

            this.showLoading(
                "Loading singleplayer..."
            );

            setTimeout(() => {
                this.hideElement(this.dom.menu);
                this.hideAllModals();
                this.showElement(this.dom.game);

                this.startGameEngine({
                    multiplayer: false,
                    platform:
                        this.selectedPlatform,
                    map: "abandoned"
                });
            }, 350);
        },

        /* ======================================================
           MULTIPLAYER MENU
           ====================================================== */

        openMultiplayer() {
            this.selectedMode = "multiplayer";

            this.playClick();

            this.showElement(
                this.dom.multiplayerModal
            );

            this.connectServer();
        },

        openHost() {
            this.playClick();

            this.closeModal(
                "multiplayerModal"
            );

            this.showElement(
                this.dom.hostModal
            );

            this.setLobbyStatus(
                "CONNECTING TO SERVER"
            );

            this.connectServer();

            if (this.wsState === "OPEN") {
                this.setLobbyStatus("READY");
            }
        },

        openJoin() {
            this.playClick();

            this.closeModal(
                "multiplayerModal"
            );

            this.showElement(
                this.dom.joinModal
            );

            this.setLobbyStatus(
                "CONNECTING TO SERVER"
            );

            this.connectServer();

            setTimeout(() => {
                if (this.dom.joinCode) {
                    this.dom.joinCode.focus();
                }
            }, 100);
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
                this.ws &&
                (
                    this.ws.readyState ===
                    WebSocket.OPEN ||
                    this.ws.readyState ===
                    WebSocket.CONNECTING
                )
            ) {
                return;
            }

            const url =
                this.getServerURL();

            this.setNetworkStatus(
                "CONNECTING"
            );

            try {
                this.ws =
                    new WebSocket(url);

                this.wsState =
                    "CONNECTING";

                this.ws.addEventListener(
                    "open",
                    () => {
                        this.wsState =
                            "OPEN";

                        this.setNetworkStatus(
                            "ONLINE"
                        );

                        if (
                            this.pendingCreateLobby
                        ) {
                            const request =
                                this.pendingCreateLobby;

                            this.pendingCreateLobby =
                                null;

                            this.send(request);
                        }

                        if (
                            this.pendingJoinLobby
                        ) {
                            const request =
                                this.pendingJoinLobby;

                            this.pendingJoinLobby =
                                null;

                            this.send(request);
                        }
                    }
                );

                this.ws.addEventListener(
                    "message",
                    (event) => {
                        this.handleServerMessage(
                            event.data
                        );
                    }
                );

                this.ws.addEventListener(
                    "close",
                    () => {
                        this.wsState =
                            "CLOSED";

                        this.setNetworkStatus(
                            "OFFLINE"
                        );

                        if (this.lobby) {
                            this.setLobbyStatus(
                                "SERVER DISCONNECTED"
                            );
                        }
                    }
                );

                this.ws.addEventListener(
                    "error",
                    (error) => {
                        console.error(
                            "[THE SEEKER] WebSocket error",
                            error
                        );

                        this.wsState =
                            "ERROR";

                        this.setNetworkStatus(
                            "ERROR"
                        );

                        if (
                            this.lobby
                        ) {
                            this.setLobbyStatus(
                                "SERVER CONNECTION ERROR"
                            );
                        }
                    }
                );
            } catch (error) {
                console.error(
                    "[THE SEEKER] Could not connect",
                    error
                );

                this.ws = null;
                this.wsState = "ERROR";

                this.setNetworkStatus(
                    "ERROR"
                );
            }
        },

        send(payload) {
            if (
                !this.ws ||
                this.ws.readyState !==
                    WebSocket.OPEN
            ) {
                return false;
            }

            try {
                this.ws.send(
                    JSON.stringify(payload)
                );

                return true;
            } catch (error) {
                console.error(
                    "[THE SEEKER] Send failed",
                    error
                );

                return false;
            }
        },

        disconnectServer() {
            if (!this.ws) {
                return;
            }

            try {
                this.ws.close();
            } catch (_) {}

            this.ws = null;
            this.wsState = "CLOSED";
        },

        /* ======================================================
           CREATE REAL LOBBY
           ====================================================== */

        createHostLobby() {
            const lobbyName =
                this.readValue(
                    this.dom.lobbyName,
                    "The Seeker Lobby"
                ).trim();

            const playerName =
                this.readValue(
                    this.dom.playerName,
                    this.playerName
                ).trim();

            const map =
                this.getSelectedMap();

            this.playerName =
                playerName ||
                this.playerName;

            localStorage.setItem(
                "seeker_player_name",
                this.playerName
            );

            const request = {
                type: "create_lobby",
                lobbyName:
                    lobbyName ||
                    "The Seeker Lobby",
                playerName:
                    this.playerName,
                maxPlayers: 4,
                map
            };

            if (
                this.wsState !==
                "OPEN"
            ) {
                this.pendingCreateLobby =
                    request;

                this.setLobbyStatus(
                    "WAITING FOR SERVER..."
                );

                this.connectServer();
                return;
            }

            this.setLobbyStatus(
                "CREATING REAL LOBBY..."
            );

            this.send(request);
        },

        /* ======================================================
           JOIN EXISTING REAL LOBBY
           ====================================================== */

        joinExistingLobby() {
            const code =
                this.readValue(
                    this.dom.joinCode,
                    ""
                )
                    .trim()
                    .toUpperCase();

            const playerName =
                this.readValue(
                    this.dom.playerName,
                    this.playerName
                ).trim();

            if (!code) {
                this.setLobbyStatus(
                    "ENTER A LOBBY CODE"
                );

                this.shakeElement(
                    this.dom.joinCode
                );

                return;
            }

            if (code.length < 4) {
                this.setLobbyStatus(
                    "INVALID LOBBY CODE"
                );

                this.shakeElement(
                    this.dom.joinCode
                );

                return;
            }

            this.playerName =
                playerName ||
                this.playerName;

            localStorage.setItem(
                "seeker_player_name",
                this.playerName
            );

            const request = {
                type: "join_lobby",
                code,
                playerName:
                    this.playerName
            };

            if (
                this.wsState !==
                "OPEN"
            ) {
                this.pendingJoinLobby =
                    request;

                this.setLobbyStatus(
                    "WAITING FOR SERVER..."
                );

                this.connectServer();
                return;
            }

            this.setLobbyStatus(
                "JOINING LOBBY..."
            );

            this.send(request);
        },

        /* ======================================================
           HOST START
           ====================================================== */

        startHostedGame() {
            if (!this.lobby) {
                this.setLobbyStatus(
                    "NO LOBBY CONNECTED"
                );
                return;
            }

            const hostId =
                this.lobby.hostId ||
                this.lobby.host;

            if (
                hostId &&
                this.localPlayerId &&
                hostId !==
                    this.localPlayerId
            ) {
                this.setLobbyStatus(
                    "ONLY THE HOST CAN START"
                );
                return;
            }

            const code =
                this.lobby.code ||
                this.lobbyCode;

            if (!code) {
                this.setLobbyStatus(
                    "LOBBY CODE MISSING"
                );
                return;
            }

            const map =
                this.lobby.map ||
                this.currentMap ||
                "abandoned";

            this.setLobbyStatus(
                "STARTING GAME..."
            );

            this.playClick();

            const sent =
                this.send({
                    type: "start_game",
                    code,
                    map
                });

            if (!sent) {
                this.setLobbyStatus(
                    "SERVER CONNECTION LOST"
                );
            }
        },

        /* ======================================================
           LEAVE LOBBY
           ====================================================== */

        leaveLobby() {
            const code =
                this.lobby?.code ||
                this.lobbyCode;

            if (code) {
                this.send({
                    type: "leave_lobby",
                    code
                });
            }

            this.lobby = null;
            this.lobbyCode = "";
            this.remotePlayers.clear();

            this.closeModal(
                "lobbyModal"
            );

            this.showElement(
                this.dom.multiplayerModal
            );

            this.setLobbyStatus(
                "LEFT LOBBY"
            );

            this.playClick();
        },

        /* ======================================================
           SERVER MESSAGE ROUTER
           ====================================================== */

        handleServerMessage(raw) {
            let message;

            try {
                message =
                    typeof raw === "string"
                        ? JSON.parse(raw)
                        : raw;
            } catch (error) {
                console.error(
                    "[THE SEEKER] Invalid server message",
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

            switch (message.type) {
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
                    this.handleRemotePlayerState(
                        message
                    );
                    break;

                case "game_event":
                    this.handleGameEvent(
                        message
                    );
                    break;

                case "voice_signal":
                    this.handleVoiceSignal(
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
                        "[THE SEEKER] Unknown server message",
                        message
                    );
            }
        },

        /* ======================================================
           SERVER CONNECTED
           ====================================================== */

        handleConnected(message) {
            if (message.playerId) {
                this.localPlayerId =
                    message.playerId;
            }

            this.setNetworkStatus(
                "ONLINE"
            );
        },

        /* ======================================================
           LOBBY CREATED
           ====================================================== */

        handleLobbyCreated(message) {
            this.lobbyCode =
                message.code ||
                message.lobby?.code ||
                "";

            this.lobby =
                message.lobby ||
                {
                    code:
                        this.lobbyCode,
                    lobbyName:
                        message.lobbyName ||
                        "The Seeker Lobby",
                    players: []
                };

            this.lobby.localPlayerId =
                message.playerId ||
                this.localPlayerId;

            this.currentMap =
                message.map ||
                this.lobby.map ||
                "abandoned";

            this.renderLobby();

            this.closeModal(
                "hostModal"
            );

            this.closeModal(
                "joinModal"
            );

            this.showElement(
                this.dom.lobbyModal
            );

            this.setLobbyStatus(
                `LOBBY CREATED — ${this.lobbyCode}`
            );

            this.playSuccess();
        },

        /* ======================================================
           LOBBY JOINED
           ====================================================== */

        handleLobbyJoined(message) {
            this.lobbyCode =
                message.code ||
                message.lobby?.code ||
                this.readValue(
                    this.dom.joinCode,
                    ""
                ).toUpperCase();

            this.lobby =
                message.lobby ||
                {
                    code:
                        this.lobbyCode,
                    players: []
                };

            this.lobby.localPlayerId =
                message.playerId ||
                this.localPlayerId;

            this.currentMap =
                message.map ||
                this.lobby.map ||
                "abandoned";

            this.renderLobby();

            this.closeModal(
                "hostModal"
            );

            this.closeModal(
                "joinModal"
            );

            this.showElement(
                this.dom.lobbyModal
            );

            this.setLobbyStatus(
                `CONNECTED TO ${this.lobbyCode}`
            );

            this.playSuccess();
        },

        /* ======================================================
           LOBBY STATE
           ====================================================== */

        handleLobbyState(message) {
            const incoming =
                message.lobby ||
                message;

            if (
                incoming &&
                typeof incoming ===
                    "object"
            ) {
                this.lobby = {
                    ...(this.lobby || {}),
                    ...incoming
                };
            }

            if (
                message.code &&
                !this.lobbyCode
            ) {
                this.lobbyCode =
                    message.code;
            }

            if (
                message.playerId
            ) {
                this.localPlayerId =
                    message.playerId;
            }

            this.currentMap =
                this.lobby?.map ||
                this.currentMap;

            this.renderLobby();

            if (
                this.lobby &&
                this.lobby.started ===
                    true
            ) {
                this.handleGameStarted({
                    type:
                        "game_started",
                    code:
                        this.lobby.code ||
                        this.lobbyCode,
                    map:
                        this.lobby.map ||
                        this.currentMap
                });
            }
        },

        /* ======================================================
           GAME STARTED
           ====================================================== */

        handleGameStarted(message) {
            const map =
                message.map ||
                this.lobby?.map ||
                this.currentMap ||
                "abandoned";

            this.currentMap = map;

            if (this.lobby) {
                this.lobby.started =
                    true;

                this.lobby.map = map;
            }

            this.closeModal(
                "lobbyModal"
            );

            this.closeModal(
                "multiplayerModal"
            );

            this.hideAllModals();

            this.hideElement(
                this.dom.menu
            );

            this.showLoading(
                "Entering the facility..."
            );

            setTimeout(() => {
                this.hideElement(
                    this.dom.loadingScreen
                );

                this.showElement(
                    this.dom.game
                );

                this.gameStarted =
                    true;

                this.startGameEngine({
                    multiplayer: true,
                    platform:
                        this.selectedPlatform,
                    map,
                    lobby:
                        this.lobby
                });

                this.playGameMusic();
            }, 450);
        },

        /* ======================================================
           LOBBY RENDERING
           ====================================================== */

        renderLobby() {
            const lobby =
                this.lobby || {};

            const players =
                Array.isArray(
                    lobby.players
                )
                    ? lobby.players
                    : [];

            const code =
                lobby.code ||
                this.lobbyCode ||
                "------";

            this.lobbyCode =
                code;

            if (
                this.dom.lobbyCode
            ) {
                this.dom.lobbyCode.textContent =
                    code;
            }

            this.qa(
                "[data-lobby-code]"
            ).forEach(
                (element) => {
                    if (
                        element.tagName ===
                        "INPUT"
                    ) {
                        element.value =
                            code;
                    } else {
                        element.textContent =
                            code;
                    }
                }
            );

            if (
                this.dom.playerCount
            ) {
                const max =
                    lobby.maxPlayers ||
                    4;

                this.dom.playerCount.textContent =
                    `${players.length}/${max}`;
            }

            this.renderLobbyPlayers(
                players,
                lobby
            );

            this.updateHostStartButton(
                lobby,
                players
            );
        },

        renderLobbyPlayers(
            players,
            lobby
        ) {
            if (
                !this.dom.lobbyPlayers
            ) {
                return;
            }

            this.dom.lobbyPlayers.innerHTML =
                "";

            players.forEach(
                (player) => {
                    const row =
                        document.createElement(
                            "div"
                        );

                    row.className =
                        "lobby-player";

                    const localId =
                        lobby.localPlayerId ||
                        this.localPlayerId;

                    if (
                        player.id &&
                        localId &&
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

                    const hostId =
                        lobby.hostId ||
                        lobby.host;

                    role.textContent =
                        player.id &&
                        hostId &&
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

                    this.dom.lobbyPlayers.appendChild(
                        row
                    );
                }
            );
        },

        updateHostStartButton(
            lobby,
            players
        ) {
            const button =
                this.q(
                    "#startGameButton, #startGameBtn, [data-action='start-game']"
                );

            if (!button) {
                return;
            }

            const hostId =
                lobby.hostId ||
                lobby.host;

            const localId =
                lobby.localPlayerId ||
                this.localPlayerId;

            const isHost =
                !hostId ||
                !localId ||
                hostId === localId;

            button.disabled =
                !isHost ||
                players.length < 1 ||
                lobby.started === true;

            button.textContent =
                lobby.started === true
                    ? "GAME STARTING"
                    : isHost
                    ? "START GAME"
                    : "WAITING FOR HOST";
        },

        /* ======================================================
           NETWORK PLAYER STATE
           ====================================================== */

        handleRemotePlayerState(
            message
        ) {
            const playerId =
                message.playerId ||
                message.id;

            if (
                !playerId ||
                playerId ===
                    this.localPlayerId
            ) {
                return;
            }

            this.remotePlayers.set(
                playerId,
                {
                    id: playerId,
                    name:
                        message.name ||
                        "Player",
                    x:
                        Number(
                            message.x
                        ) || 0,
                    y:
                        Number(
                            message.y
                        ) || 0,
                    z:
                        Number(
                            message.z
                        ) || 0,
                    yaw:
                        Number(
                            message.yaw
                        ) || 0,
                    pitch:
                        Number(
                            message.pitch
                        ) || 0,
                    timestamp:
                        Date.now()
                }
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:remote-player-state",
                    {
                        detail:
                            message
                    }
                )
            );
        },

        sendPlayerState(state) {
            if (
                !this.lobby ||
                !this.gameStarted
            ) {
                return;
            }

            this.send({
                type: "player_state",
                code:
                    this.lobby.code ||
                    this.lobbyCode,
                playerId:
                    this.localPlayerId,
                name:
                    this.playerName,
                ...state
            });
        },

        /* ======================================================
           GAME EVENTS
           ====================================================== */

        handleGameEvent(message) {
            window.dispatchEvent(
                new CustomEvent(
                    "seeker:network-game-event",
                    {
                        detail:
                            message
                    }
                )
            );
        },

        sendGameEvent(eventName, data = {}) {
            if (
                !this.lobby ||
                !this.gameStarted
            ) {
                return;
            }

            this.send({
                type: "game_event",
                code:
                    this.lobby.code ||
                    this.lobbyCode,
                playerId:
                    this.localPlayerId,
                event:
                    eventName,
                data
            });
        },

        /* ======================================================
           WEBRTC VOICE SIGNALING
           ====================================================== */

        handleVoiceSignal(message) {
            window.dispatchEvent(
                new CustomEvent(
                    "seeker:voice-signal",
                    {
                        detail:
                            message
                    }
                )
            );

            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.handleSignal ===
                    "function"
            ) {
                window.SeekerVoice.handleSignal(
                    message
                );
            }
        },

        sendVoiceSignal(
            targetPlayerId,
            signal
        ) {
            this.send({
                type: "voice_signal",
                code:
                    this.lobby?.code ||
                    this.lobbyCode,
                target:
                    targetPlayerId,
                playerId:
                    this.localPlayerId,
                signal
            });
        },

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
                } catch (error) {
                    console.error(
                        "[THE SEEKER] Voice error",
                        error
                    );
                }
            }

            this.setVoiceButtonState(
                false,
                "VOICE UNAVAILABLE"
            );
        },

        updateVoiceUI() {
            let active = false;

            if (
                window.SeekerVoice &&
                typeof
                    window.SeekerVoice.isActive ===
                    "function"
            ) {
                active =
                    !!window.SeekerVoice.isActive();
            }

            this.setVoiceButtonState(
                active,
                active
                    ? "MIC ON"
                    : "MIC OFF"
            );
        },

        setVoiceButtonState(
            active,
            text
        ) {
            const buttons = this.qa(
                "#voiceButton, #micButton, [data-action='voice']"
            );

            buttons.forEach(
                (button) => {
                    button.classList.toggle(
                        "active",
                        active
                    );

                    if (
                        button.dataset.defaultText ===
                        undefined
                    ) {
                        button.dataset.defaultText =
                            button.textContent.trim();
                    }

                    if (
                        text &&
                        button.querySelector(
                            ".voice-label"
                        )
                    ) {
                        button.querySelector(
                            ".voice-label"
                        ).textContent =
                            text;
                    } else if (
                        text &&
                        button.childElementCount === 0
                    ) {
                        button.textContent =
                            text;
                    }
                }
            );
        },

        /* ======================================================
           SERVER ERRORS
           ====================================================== */

        handleServerError(message) {
            const error =
                message.message ||
                "SERVER ERROR";

            this.setLobbyStatus(
                String(error).toUpperCase()
            );

            this.showNetworkError(
                error
            );

            this.playError();
        },

        /* ======================================================
           MAP SELECTION
           ====================================================== */

        setupMapButtons() {
            const buttons = this.qa(
                "[data-map]"
            );

            buttons.forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            this.currentMap =
                                button.dataset.map;

                            buttons.forEach(
                                (item) => {
                                    item.classList.toggle(
                                        "selected",
                                        item ===
                                            button
                                    );
                                }
                            );
                        }
                    );
                }
            );
        },

        getSelectedMap() {
            if (
                this.dom.mapSelect
            ) {
                if (
                    this.dom.mapSelect
                        .value
                ) {
                    return this.dom.mapSelect.value;
                }

                const selected =
                    this.dom.mapSelect.querySelector(
                        "option:checked"
                    );

                if (
                    selected &&
                    selected.value
                ) {
                    return selected.value;
                }
            }

            const selectedButton =
                this.q(
                    "[data-map].selected"
                );

            if (
                selectedButton
            ) {
                return selectedButton.dataset.map;
            }

            return (
                this.currentMap ||
                "abandoned"
            );
        },

        /* ======================================================
           GAME ENGINE
           ====================================================== */

        startGameEngine(options) {
            this.gameStarted =
                true;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:start",
                    {
                        detail:
                            options
                    }
                )
            );

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
                } catch (error) {
                    console.error(
                        "[THE SEEKER] Game.start failed",
                        error
                    );
                }
            }

            if (
                window.SeekerGame &&
                typeof
                    window.SeekerGame.start ===
                    "function"
            ) {
                try {
                    window.SeekerGame.start(
                        options
                    );
                } catch (error) {
                    console.error(
                        "[THE SEEKER] SeekerGame.start failed",
                        error
                    );
                }
            }

            if (
                this.selectedPlatform ===
                "mobile"
            ) {
                document.body.classList.add(
                    "mobile-version"
                );

                document.body.classList.remove(
                    "pc-version"
                );
            } else {
                document.body.classList.add(
                    "pc-version"
                );

                document.body.classList.remove(
                    "mobile-version"
                );
            }

            if (
                options.multiplayer
            ) {
                this.setupMultiplayerGame(
                    options
                );
            }

            this.hideElement(
                this.dom.loadingScreen
            );

            this.showElement(
                this.dom.game
            );

            this.playGameMusic();
        },

        setupMultiplayerGame(options) {
            window.dispatchEvent(
                new CustomEvent(
                    "seeker:multiplayer-start",
                    {
                        detail:
                            options
                    }
                )
            );

            this.setupStateRelay();
        },

        setupStateRelay() {
            if (
                this.stateRelayBound
            ) {
                return;
            }

            this.stateRelayBound =
                true;

            window.addEventListener(
                "seeker:player-state",
                (event) => {
                    if (
                        !this.gameStarted ||
                        !this.lobby
                    ) {
                        return;
                    }

                    const state =
                        event.detail ||
                        {};

                    this.sendPlayerState(
                        state
                    );
                }
            );

            window.addEventListener(
                "seeker:game-event",
                (event) => {
                    if (
                        !this.gameStarted ||
                        !this.lobby
                    ) {
                        return;
                    }

                    const detail =
                        event.detail ||
                        {};

                    this.sendGameEvent(
                        detail.event ||
                            "unknown",
                        detail.data ||
                            {}
                    );
                }
            );
        },

        /* ======================================================
           LOADING SCREEN
           ====================================================== */

        showLoading(message) {
            if (
                !this.dom.loadingScreen
            ) {
                return;
            }

            this.showElement(
                this.dom.loadingScreen
            );

            if (
                this.dom.loadingText
            ) {
                this.dom.loadingText.textContent =
                    message ||
                    "Loading...";
            }

            if (
                this.dom.loadingProgress
            ) {
                this.dom.loadingProgress.style.width =
                    "0%";

                requestAnimationFrame(
                    () => {
                        this.dom.loadingProgress.style.width =
                            "100%";
                    }
                );
            }
        },

        /* ======================================================
           PAUSE
           ====================================================== */

        pauseGame() {
            if (
                !this.gameStarted
            ) {
                return;
            }

            this.showElement(
                this.dom.pauseMenu
            );

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
                window.Game.pause();
            }
        },

        resumeGame() {
            this.hideElement(
                this.dom.pauseMenu
            );

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
                window.Game.resume();
            }
        },

        restartGame() {
            this.hideElement(
                this.dom.caughtScreen
            );

            this.hideElement(
                this.dom.pauseMenu
            );

            document.body.classList.remove(
                "game-paused"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:restart"
                )
            );

            if (
                window.Game &&
                typeof
                    window.Game.restart ===
                    "function"
            ) {
                window.Game.restart();
                return;
            }

            this.startGameEngine({
                multiplayer:
                    !!this.lobby,
                platform:
                    this.selectedPlatform,
                map:
                    this.currentMap,
                lobby:
                    this.lobby
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

            this.gameStarted =
                false;

            this.hideElement(
                this.dom.game
            );

            this.hideElement(
                this.dom.pauseMenu
            );

            this.hideElement(
                this.dom.caughtScreen
            );

            this.hideElement(
                this.dom.loadingScreen
            );

            this.hideAllModals();

            document.body.classList.remove(
                "game-paused"
            );

            this.showElement(
                this.dom.menu
            );

            this.playMenuMusic();
        },

        /* ======================================================
           SETTINGS
           ====================================================== */

        setupSettings() {
            if (
                this.dom.settingsVolume
            ) {
                this.dom.settingsVolume.value =
                    this.volume;

                this.dom.settingsVolume.addEventListener(
                    "input",
                    () => {
                        this.volume =
                            Number(
                                this.dom.settingsVolume.value
                            );

                        localStorage.setItem(
                            "seeker_volume",
                            String(
                                this.volume
                            )
                        );

                        this.updateSettingsUI();
                        this.updateAudioVolume();
                    }
                );
            }

            if (
                this.dom.settingMusic
            ) {
                this.dom.settingMusic.checked =
                    this.musicEnabled;

                this.dom.settingMusic.addEventListener(
                    "change",
                    () => {
                        this.musicEnabled =
                            !!this.dom
                                .settingMusic
                                .checked;

                        localStorage.setItem(
                            "seeker_music",
                            String(
                                this.musicEnabled
                            )
                        );

                        if (
                            this.musicEnabled
                        ) {
                            if (
                                this.gameStarted
                            ) {
                                this.playGameMusic();
                            } else {
                                this.playMenuMusic();
                            }
                        } else {
                            this.stopAllMusic();
                        }
                    }
                );
            }

            if (
                this.dom.settingSfx
            ) {
                this.dom.settingSfx.checked =
                    this.sfxEnabled;

                this.dom.settingSfx.addEventListener(
                    "change",
                    () => {
                        this.sfxEnabled =
                            !!this.dom
                                .settingSfx
                                .checked;

                        localStorage.setItem(
                            "seeker_sfx",
                            String(
                                this.sfxEnabled
                            )
                        );
                    }
                );
            }
        },

        updateSettingsUI() {
            if (
                this.dom.settingsVolume
            ) {
                this.dom.settingsVolume.value =
                    this.volume;
            }

            if (
                this.dom.volumeValue
            ) {
                this.dom.volumeValue.textContent =
                    `${Math.round(
                        this.volume *
                            100
                    )}%`;
            }

            if (
                this.dom.settingMusic
            ) {
                this.dom.settingMusic.checked =
                    this.musicEnabled;
            }

            if (
                this.dom.settingSfx
            ) {
                this.dom.settingSfx.checked =
                    this.sfxEnabled;
            }
        },

        /* ======================================================
           KEYBOARD
           ====================================================== */

        setupKeyboard() {
            document.addEventListener(
                "keydown",
                (event) => {
                    if (
                        event.code ===
                        "Escape"
                    ) {
                        if (
                            this.gameStarted
                        ) {
                            if (
                                this.isPaused()
                            ) {
                                this.resumeGame();
                            } else {
                                this.pauseGame();
                            }

                            return;
                        }

                        this.closeTopModal();
                    }
                }
            );
        },

        isPaused() {
            return (
                document.body.classList.contains(
                    "game-paused"
                )
            );
        },

        /* ======================================================
           AUDIO
           ====================================================== */

        setupAudio() {
            this.audio.menu =
                this.createAudio(
                    "audio/menu.mp3"
                );

            this.audio.game =
                this.createAudio(
                    "audio/ambience.mp3"
                );

            this.audio.boom =
                this.createAudio(
                    "audio/boom.mp3"
                );

            this.audio.click =
                this.createAudio(
                    "audio/click.mp3"
                );

            this.audio.success =
                this.createAudio(
                    "audio/success.mp3"
                );

            this.audio.error =
                this.createAudio(
                    "audio/warning.mp3"
                );

            this.audio.catch =
                this.createAudio(
                    "audio/caught.mp3"
                );

            this.updateAudioVolume();
        },

        createAudio(src) {
            const audio =
                new Audio();

            audio.src = src;
            audio.preload = "auto";

            return audio;
        },

        setupAudioEvents() {
            window.addEventListener(
                "seeker:menu-click",
                () => {
                    this.playClick();
                }
            );

            window.addEventListener(
                "seeker:caught",
                () => {
                    this.playCaught();
                }
            );
        },

        playMenuMusic() {
            if (
                !this.musicEnabled
            ) {
                return;
            }

            this.stopGameMusic();

            if (
                !this.audio.menu
            ) {
                return;
            }

            this.audio.menu.loop =
                true;

            this.audio.menu.volume =
                Math.min(
                    1,
                    this.volume *
                        0.45
                );

            this.safePlay(
                this.audio.menu
            );
        },

        playGameMusic() {
            if (
                !this.musicEnabled
            ) {
                return;
            }

            this.stopMenuMusic();

            if (
                !this.audio.game
            ) {
                return;
            }

            this.audio.game.loop =
                true;

            this.audio.game.volume =
                Math.min(
                    1,
                    this.volume *
                        0.35
                );

            this.safePlay(
                this.audio.game
            );
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

        stopGameMusic() {
            if (
                this.audio.game
            ) {
                this.audio.game.pause();

                try {
                    this.audio.game.currentTime =
                        0;
                } catch (_) {}
            }
        },

        stopAllMusic() {
            this.stopMenuMusic();
            this.stopGameMusic();
        },

        playSound(name) {
            if (
                !this.sfxEnabled
            ) {
                return;
            }

            const original =
                this.audio[name];

            if (!original) {
                return;
            }

            let sound;

            try {
                sound =
                    original.cloneNode(
                        true
                    );
            } catch (_) {
                sound =
                    original;
            }

            sound.volume =
                Math.min(
                    1,
                    this.volume
                );

            this.safePlay(
                sound
            );
        },

        playClick() {
            this.playSound("click");
        },

        playSuccess() {
            this.playSound("success");
        },

        playError() {
            this.playSound("error");
        },

        playCaught() {
            this.stopAllMusic();

            this.playSound("catch");

            this.showElement(
                this.dom.caughtScreen
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:caught-screen"
                )
            );
        },

        safePlay(audio) {
            if (!audio) {
                return;
            }

            const promise =
                audio.play();

            if (
                promise &&
                typeof promise.catch ===
                    "function"
            ) {
                promise.catch(() => {
                    /*
                     Browser autoplay protection.
                     Playback will begin after the
                     user's next interaction.
                    */
                });
            }
        },

        updateAudioVolume() {
            const musicVolume =
                Math.min(
                    1,
                    this.volume *
                        0.45
                );

            const gameVolume =
                Math.min(
                    1,
                    this.volume *
                        0.35
                );

            if (
                this.audio.menu
            ) {
                this.audio.menu.volume =
                    musicVolume;
            }

            if (
                this.audio.game
            ) {
                this.audio.game.volume =
                    gameVolume;
            }

            if (
                this.audio.boom
            ) {
                this.audio.boom.volume =
                    this.volume;
            }

            if (
                this.audio.click
            ) {
                this.audio.click.volume =
                    this.volume;
            }

            if (
                this.audio.success
            ) {
                this.audio.success.volume =
                    this.volume;
            }

            if (
                this.audio.error
            ) {
                this.audio.error.volume =
                    this.volume;
            }

            if (
                this.audio.catch
            ) {
                this.audio.catch.volume =
                    this.volume;
            }
        },

        /* ======================================================
           PLAYER NAME
           ====================================================== */

        updatePlayerNameDisplays() {
            this.qa(
                "[data-player-name]"
            ).forEach(
                (element) => {
                    element.textContent =
                        this.playerName;
                }
            );

            const inputs =
                this.qa(
                    "#playerName"
                );

            inputs.forEach(
                (input) => {
                    if (
                        !input.value
                    ) {
                        input.value =
                            this.playerName;
                    }
                }
            );
        },

        /* ======================================================
           UI STATUS
           ====================================================== */

        setNetworkStatus(status) {
            const value =
                String(
                    status
                ).toUpperCase();

            [
                this.dom.networkStatus,
                this.dom.serverStatus
            ].forEach(
                (element) => {
                    if (!element) {
                        return;
                    }

                    element.textContent =
                        value;

                    element.dataset.status =
                        value.toLowerCase();
                }
            );
        },

        setLobbyStatus(status) {
            const value =
                String(
                    status
                );

            if (
                this.dom.lobbyStatus
            ) {
                this.dom.lobbyStatus.textContent =
                    value;
            }

            if (
                this.dom.gameStatus
            ) {
                this.dom.gameStatus.textContent =
                    value;
            }
        },

        showNetworkError(message) {
            const box =
                this.q(
                    "#networkError, #serverError"
                );

            if (!box) {
                return;
            }

            box.textContent =
                message;

            this.showElement(
                box
            );

            setTimeout(() => {
                this.hideElement(
                    box
                );
            }, 5000);
        },

        /* ======================================================
           MODALS
           ====================================================== */

        openModal(id) {
            const element =
                this.dom[id] ||
                document.getElementById(
                    id
                );

            if (!element) {
                return;
            }

            this.showElement(
                element
            );

            this.playClick();
        },

        closeModal(id) {
            const element =
                this.dom[id] ||
                document.getElementById(
                    id
                );

            if (!element) {
                return;
            }

            this.hideElement(
                element
            );
        },

        hideAllModals() {
            [
                "singlePlayerModal",
                "multiplayerModal",
                "hostModal",
                "joinModal",
                "platformModal",
                "lobbyModal",
                "settingsModal",
                "creditsModal"
            ].forEach(
                (id) => {
                    this.hideElement(
                        this.dom[id]
                    );
                }
            );
        },

        hideAllModalsExceptGame() {
            this.hideAllModals();
        },

        closeTopModal() {
            const modalIds = [
                "creditsModal",
                "settingsModal",
                "lobbyModal",
                "joinModal",
                "hostModal",
                "platformModal",
                "multiplayerModal",
                "singlePlayerModal"
            ];

            for (const id of modalIds) {
                const element =
                    this.dom[id];

                if (
                    element &&
                    this.isVisible(
                        element
                    )
                ) {
                    this.hideElement(
                        element
                    );
                    return;
                }
            }
        },

        /* ======================================================
           CLIPBOARD
           ====================================================== */

        async copyLobbyCode() {
            const code =
                this.lobbyCode;

            if (!code) {
                return;
            }

            try {
                if (
                    navigator.clipboard &&
                    navigator.clipboard.writeText
                ) {
                    await navigator.clipboard.writeText(
                        code
                    );
                } else {
                    const temp =
                        document.createElement(
                            "textarea"
                        );

                    temp.value =
                        code;

                    temp.style.position =
                        "fixed";

                    temp.style.opacity =
                        "0";

                    document.body.appendChild(
                        temp
                    );

                    temp.select();

                    document.execCommand(
                        "copy"
                    );

                    temp.remove();
                }

                this.setLobbyStatus(
                    "LOBBY CODE COPIED"
                );

                this.playSuccess();
            } catch (error) {
                console.error(
                    "[THE SEEKER] Clipboard error",
                    error
                );

                this.setLobbyStatus(
                    "COPY FAILED"
                );
            }
        },

        /* ======================================================
           DOM HELPERS
           ====================================================== */

        showElement(element) {
            if (!element) {
                return;
            }

            element.hidden = false;
            element.classList.remove(
                "hidden"
            );

            if (
                element.dataset &&
                element.dataset.previousDisplay
            ) {
                element.style.display =
                    element.dataset.previousDisplay;

                return;
            }

            if (
                element.style.display ===
                "none"
            ) {
                element.style.display =
                    "";
            }
        },

        hideElement(element) {
            if (!element) {
                return;
            }

            if (
                element.style.display !==
                "none"
            ) {
                element.dataset.previousDisplay =
                    element.style.display ||
                    "";
            }

            element.hidden = true;
            element.classList.add(
                "hidden"
            );

            element.style.display =
                "none";
        },

        isVisible(element) {
            if (!element) {
                return false;
            }

            return (
                !element.hidden &&
                element.style.display !==
                    "none" &&
                !element.classList.contains(
                    "hidden"
                )
            );
        },

        readValue(
            element,
            fallback = ""
        ) {
            if (!element) {
                return fallback;
            }

            if (
                typeof element.value ===
                "string"
            ) {
                return element.value;
            }

            return (
                element.textContent ||
                fallback
            );
        },

        shakeElement(element) {
            if (!element) {
                return;
            }

            element.classList.remove(
                "input-shake"
            );

            void element.offsetWidth;

            element.classList.add(
                "input-shake"
            );

            setTimeout(() => {
                element.classList.remove(
                    "input-shake"
                );
            }, 450);
        }
    };

    /* ============================================================
       GLOBAL EVENTS
       ============================================================ */

    window.addEventListener(
        "seeker:seeker-caught-player",
        () => {
            Main.playCaught();
        }
    );

    window.addEventListener(
        "seeker:player-caught",
        () => {
            Main.playCaught();
        }
    );

    window.addEventListener(
        "seeker:return-menu",
        () => {
            Main.returnToMenu();
        }
    );

    window.addEventListener(
        "seeker:voice-state",
        () => {
            Main.updateVoiceUI();
        }
    );

    /* ============================================================
       DOM READY
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => Main.init(),
            { once: true }
        );
    } else {
        Main.init();
    }
})();