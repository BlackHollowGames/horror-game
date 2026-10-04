/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   main.js

   MENU + INTRO + LOBBY + MODE + AUDIO + UI
============================================================ */

(() => {
    "use strict";

    const Main = {

        introStarted: false,

        menuReady: false,

        gameStarted: false,

        selectedPlatform: "pc",

        selectedMap: "facility",

        modalStack: [],

        lobbyMode: null,

        lobby: null,

        network: null,

        serverURL:
            window.SEEKER_SERVER_URL ||
            "ws://localhost:8080",

        audioUnlocked: false,

        menuMusicStarted: false,

        settings: {

            masterVolume: 0.82,

            musicVolume: 0.68,

            effectsVolume: 0.9,

            voiceVolume: 0.85,

            screenEffects: true,

            reducedMotion: false
        }
    };

    /* ========================================================
       HELPERS
    ======================================================== */

    const $ = selector => {
        return document.querySelector(
            selector
        );
    };

    const $$ = selector => {
        return [
            ...document.querySelectorAll(
                selector
            )
        ];
    };

    const clamp = (
        value,
        min = 0,
        max = 1
    ) => {

        return Math.max(
            min,
            Math.min(
                max,
                Number(value) || 0
            )
        );
    };

    const random = (
        min,
        max
    ) => {

        return min +
            Math.random() *
            (max - min);
    };

    /* ========================================================
       AUDIO
    ======================================================== */

    Main.unlockAudio =
        async function() {

            if (
                Main.audioUnlocked
            ) {
                return true;
            }

            Main.audioUnlocked =
                true;

            try {

                if (
                    window.SeekerSystem
                ) {

                    await window.SeekerSystem
                        .unlockAudio?.();
                }

            } catch {}

            return true;
        };

    Main.playClick =
        function() {

            if (
                window.SeekerSystem &&
                typeof
                    window.SeekerSystem
                        .playAudio ===
                    "function"
            ) {

                window.SeekerSystem
                    .playAudio(
                        "ui-click",
                        "click.mp3",
                        {
                            volume:
                                0.3
                        }
                    );

                return;
            }

            /*
             * Procedural click fallback.
             */

            const AC =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AC) {
                return;
            }

            try {

                const context =
                    Main._fallbackAudio ||
                    (
                        Main._fallbackAudio =
                        new AC()
                    );

                if (
                    context.state ===
                    "suspended"
                ) {

                    context.resume()
                        .catch(
                            () => {}
                        );
                }

                const oscillator =
                    context.createOscillator();

                const gain =
                    context.createGain();

                oscillator.type =
                    "square";

                oscillator.frequency.value =
                    560;

                gain.gain.setValueAtTime(
                    .0001,
                    context.currentTime
                );

                gain.gain.exponentialRampToValueAtTime(
                    .045,
                    context.currentTime +
                    .005
                );

                gain.gain.exponentialRampToValueAtTime(
                    .0001,
                    context.currentTime +
                    .055
                );

                oscillator.connect(
                    gain
                );

                gain.connect(
                    context.destination
                );

                oscillator.start();

                oscillator.stop(
                    context.currentTime +
                    .07
                );

            } catch {}
        };

    Main.playHover =
        function() {

            const AC =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AC) {
                return;
            }

            try {

                const context =
                    Main._hoverAudio ||
                    (
                        Main._hoverAudio =
                        new AC()
                    );

                const oscillator =
                    context.createOscillator();

                const gain =
                    context.createGain();

                oscillator.type =
                    "sine";

                oscillator.frequency.value =
                    820;

                gain.gain.setValueAtTime(
                    .0001,
                    context.currentTime
                );

                gain.gain.exponentialRampToValueAtTime(
                    .025,
                    context.currentTime +
                    .005
                );

                gain.gain.exponentialRampToValueAtTime(
                    .0001,
                    context.currentTime +
                    .04
                );

                oscillator.connect(
                    gain
                );

                gain.connect(
                    context.destination
                );

                oscillator.start();

                oscillator.stop(
                    context.currentTime +
                    .05
                );

            } catch {}
        };

    /* ========================================================
       CINEMATIC INTRO
    ======================================================== */

    Main.playIntro =
        async function() {

            if (
                Main.introStarted
            ) {
                return;
            }

            Main.introStarted =
                true;

            const intro =
                $("#introScreen");

            if (!intro) {
                Main.showMenu();
                return;
            }

            /*
             * Try to unlock audio from the initial user gesture
             * when possible.
             */

            await Main.unlockAudio();

            /*
             * Intro boom.
             *
             * If boom.mp3 exists, it plays.
             * If not, a procedural cinematic boom is used.
             */

            setTimeout(
                () => {

                    Main.playBoom();

                },
                2680
            );

            /*
             * Screen impact.
             */

            setTimeout(
                () => {

                    document.body
                        .classList.add(
                            "intro-impact"
                        );

                },
                2750
            );

            setTimeout(
                () => {

                    Main.finishIntro();

                },
                4100
            );
        };

    Main.playBoom =
        function() {

            const audio =
                $("#introBoomAudio");

            if (
                audio &&
                audio.src
            ) {

                audio.currentTime =
                    0;

                audio.volume =
                    Main.settings
                        .effectsVolume *
                    Main.settings
                        .masterVolume;

                audio.play().catch(
                    () => {

                        Main.proceduralBoom();
                    }
                );

                return;
            }

            Main.proceduralBoom();
        };

    /* ========================================================
       BIG PROCEDURAL BOOM
    ======================================================== */

    Main.proceduralBoom =
        function() {

            const AC =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AC) {
                return;
            }

            try {

                const context =
                    Main._boomAudio ||
                    (
                        Main._boomAudio =
                        new AC()
                    );

                if (
                    context.state ===
                    "suspended"
                ) {

                    context.resume()
                        .catch(
                            () => {}
                        );
                }

                const oscillator =
                    context.createOscillator();

                const sub =
                    context.createOscillator();

                const gain =
                    context.createGain();

                const subGain =
                    context.createGain();

                const filter =
                    context.createBiquadFilter();

                oscillator.type =
                    "sawtooth";

                sub.type =
                    "sine";

                oscillator.frequency.setValueAtTime(
                    90,
                    context.currentTime
                );

                oscillator.frequency.exponentialRampToValueAtTime(
                    27,
                    context.currentTime +
                    .8
                );

                sub.frequency.setValueAtTime(
                    45,
                    context.currentTime
                );

                sub.frequency.exponentialRampToValueAtTime(
                    19,
                    context.currentTime +
                    1.05
                );

                filter.type =
                    "lowpass";

                filter.frequency.value =
                    260;

                gain.gain.setValueAtTime(
                    .0001,
                    context.currentTime
                );

                gain.gain.exponentialRampToValueAtTime(
                    .36,
                    context.currentTime +
                    .02
                );

                gain.gain.exponentialRampToValueAtTime(
                    .0001,
                    context.currentTime +
                    1.1
                );

                subGain.gain.setValueAtTime(
                    .0001,
                    context.currentTime
                );

                subGain.gain.exponentialRampToValueAtTime(
                    .22,
                    context.currentTime +
                    .02
                );

                subGain.gain.exponentialRampToValueAtTime(
                    .0001,
                    context.currentTime +
                    1.4
                );

                oscillator.connect(
                    filter
                );

                filter.connect(
                    gain
                );

                sub.connect(
                    subGain
                );

                gain.connect(
                    context.destination
                );

                subGain.connect(
                    context.destination
                );

                oscillator.start();

                sub.start();

                oscillator.stop(
                    context.currentTime +
                    1.2
                );

                sub.stop(
                    context.currentTime +
                    1.5
                );

            } catch {}
        };

    Main.finishIntro =
        function() {

            const intro =
                $("#introScreen");

            if (!intro) {
                Main.showMenu();
                return;
            }

            intro.classList.add(
                "is-done"
            );

            setTimeout(
                () => {

                    Main.showMenu();

                },
                650
            );

            Main.startMenuMusic();
        };

    /* ========================================================
       MENU MUSIC
    ======================================================== */

    Main.startMenuMusic =
        function() {

            if (
                Main.menuMusicStarted
            ) {
                return;
            }

            Main.menuMusicStarted =
                true;

            const audio =
                $("#menuMusicAudio");

            if (!audio) {
                return;
            }

            audio.volume =
                Main.settings
                    .musicVolume *
                Main.settings
                    .masterVolume *
                .45;

            audio.play().catch(
                () => {

                    /*
                     * Browser autoplay may reject
                     * until the player clicks.
                     */
                }
            );
        };

    Main.stopMenuMusic =
        function() {

            const audio =
                $("#menuMusicAudio");

            if (!audio) {
                return;
            }

            audio.pause();

            audio.currentTime =
                0;

            Main.menuMusicStarted =
                false;
        };

    /* ========================================================
       MENU
    ======================================================== */

    Main.showMenu =
        function() {

            const menu =
                $("#mainMenu");

            if (!menu) {
                return;
            }

            menu.classList.remove(
                "hidden"
            );

            document.body.classList.remove(
                "game-active"
            );

            document.body.classList.remove(
                "mobile-mode"
            );

            Main.closeAllModals();

            Main.updateMenuPlatform();

            Main.menuReady =
                true;
        };

    /* ========================================================
       MODALS
    ======================================================== */

    Main.openModal =
        function(id) {

            const modal =
                document.getElementById(
                    id
                );

            if (!modal) {
                return;
            }

            Main.playClick();

            modal.classList.add(
                "open"
            );

            modal.setAttribute(
                "aria-hidden",
                "false"
            );

            Main.modalStack.push(
                id
            );

            document.body.classList.add(
                "modal-open"
            );
        };

    Main.closeModal =
        function(id) {

            const modal =
                document.getElementById(
                    id
                );

            if (!modal) {
                return;
            }

            modal.classList.remove(
                "open"
            );

            modal.setAttribute(
                "aria-hidden",
                "true"
            );

            Main.modalStack =
                Main.modalStack.filter(
                    value =>
                        value !== id
                );

            if (
                Main.modalStack.length ===
                0
            ) {

                document.body.classList.remove(
                    "modal-open"
                );
            }
        };

    Main.closeAllModals =
        function() {

            $$(".modal-screen").forEach(
                modal => {

                    modal.classList.remove(
                        "open"
                    );

                    modal.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                }
            );

            Main.modalStack =
                [];

            document.body.classList.remove(
                "modal-open"
            );
        };

    /* ========================================================
       MODE SELECTION
    ======================================================== */

    Main.selectPlatform =
        function(platform) {

            Main.selectedPlatform =
                platform === "mobile"
                    ? "mobile"
                    : "pc";

            Main.closeModal(
                "modeModal"
            );

            Main.beginGameLoading(
                Main.selectedPlatform,
                "singleplayer"
            );
        };

    Main.updateMenuPlatform =
        function() {

            document.body.dataset.platform =
                Main.selectedPlatform;
        };

    /* ========================================================
       START SINGLEPLAYER
    ======================================================== */

    Main.startSingleplayer =
        function() {

            Main.openModal(
                "modeModal"
            );
        };

    /* ========================================================
       GAME LOADING
    ======================================================== */

    Main.beginGameLoading =
        function(
            platform,
            mode
        ) {

            Main.selectedPlatform =
                platform;

            Main.updateMenuPlatform();

            Main.closeAllModals();

            document.body.classList.add(
                "game-loading-active"
            );

            if (
                platform ===
                "mobile"
            ) {

                document.body.classList.add(
                    "mobile-mode"
                );

            } else {

                document.body.classList.remove(
                    "mobile-mode"
                );
            }

            const loading =
                $("#gameLoading");

            if (loading) {

                loading.classList.add(
                    "visible"
                );

                loading.classList.remove(
                    "done"
                );
            }

            Main.setLoadingStatus(
                "LOADING 3D WORLD"
            );

            Main.stopMenuMusic();

            /*
             * Start the actual game.
             */

            setTimeout(
                () => {

                    Main.setLoadingStatus(
                        "BUILDING FACILITY"
                    );

                },
                300
            );

            setTimeout(
                () => {

                    Main.setLoadingStatus(
                        "CONNECTING SYSTEMS"
                    );

                },
                650
            );

            setTimeout(
                () => {

                    Main.startActualGame(
                        platform,
                        mode
                    );

                },
                900
            );
        };

    Main.setLoadingStatus =
        function(text) {

            const status =
                $("#loadingStatus");

            if (status) {

                status.textContent =
                    text;
            }
        };

    Main.startActualGame =
        function(
            platform,
            mode
        ) {

            Main.gameStarted =
                true;

            if (
                window.SeekerGame
            ) {

                window.SeekerGame.mobile =
                    platform === "mobile";

                window.SeekerGame.start?.();
            }

            document.body.classList.add(
                "game-active"
            );

            const menu =
                $("#mainMenu");

            if (menu) {

                menu.classList.add(
                    "hidden"
                );
            }

            const loading =
                $("#gameLoading");

            if (loading) {

                loading.classList.add(
                    "done"
                );

                setTimeout(
                    () => {

                        loading.classList.remove(
                            "visible"
                        );

                    },
                    650
                );
            }

            Main.updateGameUI();

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .startGame?.({
                        map:
                            Main.selectedMap,
                        platform,
                        mode,
                        setupTime:
                            180
                    });
            }
        };

    /* ========================================================
       HOST LOBBY
    ======================================================== */

    Main.openHost =
        function() {

            Main.lobbyMode =
                "host";

            Main.openModal(
                "hostModal"
            );
        };

    Main.createHostLobby =
        async function() {

            await Main.unlockAudio();

            const playerName =
                (
                    $("#hostNameInput")
                        ?.value ||
                    "PLAYER"
                )
                    .trim()
                    .slice(
                        0,
                        20
                    );

            const lobbyName =
                (
                    $("#lobbyNameInput")
                        ?.value ||
                    "THE SEEKER LOBBY"
                )
                    .trim()
                    .slice(
                        0,
                        28
                    );

            const maxPlayers =
                Number(
                    $("#hostPlayerCount")
                        ?.value ||
                    4
                );

            const map =
                Main.selectedMap ||
                "facility";

            /*
             * IMPORTANT:
             * This does NOT create a fake second lobby.
             *
             * We create the host lobby once.
             * If a real server is connected, the server owns
             * the actual lobby code and player state.
             */

            Main.setLobbyStatus(
                "CREATING REAL LOBBY"
            );

            if (
                Main.network?.readyState ===
                WebSocket.OPEN
            ) {

                Main.sendNetwork({
                    type:
                        "create_lobby",
                    playerName,
                    lobbyName,
                    maxPlayers,
                    map
                });

                return;
            }

            /*
             * No server:
             * tell the user clearly instead of pretending.
             */

            Main.showLobbyNetworkError(
                "SERVER OFFLINE — START server.js TO HOST MULTIPLAYER"
            );
        };

    /* ========================================================
       MAP SELECT
    ======================================================== */

    Main.setupMapButtons =
        function() {

            $$(
                "[data-map]"
            ).forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            Main.selectedMap =
                                button.dataset.map;

                            $$(
                                "[data-map]"
                            ).forEach(
                                option => {

                                    option.classList.toggle(
                                        "active",
                                        option.dataset.map ===
                                        Main.selectedMap
                                    );
                                }
                            );

                            Main.playClick();
                        }
                    );
                }
            );
        };

    /* ========================================================
       NETWORK
    ======================================================== */

    Main.connectServer =
        function() {

            if (
                typeof WebSocket ===
                "undefined"
            ) {

                return false;
            }

            if (
                Main.network &&
                (
                    Main.network.readyState ===
                    WebSocket.OPEN ||
                    Main.network.readyState ===
                    WebSocket.CONNECTING
                )
            ) {

                return true;
            }

            try {

                Main.network =
                    new WebSocket(
                        Main.serverURL
                    );

                Main.network.addEventListener(
                    "open",
                    () => {

                        Main.setLobbyStatus(
                            "CONNECTED TO SERVER"
                        );

                        Main.networkReady =
                            true;

                        Main.updateLobbyControls();

                    }
                );

                Main.network.addEventListener(
                    "message",
                    event => {

                        Main.handleNetworkMessage(
                            event.data
                        );

                    }
                );

                Main.network.addEventListener(
                    "close",
                    () => {

                        Main.networkReady =
                            false;

                        if (
                            Main.lobbyMode
                        ) {

                            Main.setLobbyStatus(
                                "SERVER DISCONNECTED"
                            );
                        }
                    }
                );

                Main.network.addEventListener(
                    "error",
                    () => {

                        Main.networkReady =
                            false;
                    }
                );

                return true;

            } catch (error) {

                console.error(
                    "[THE SEEKER] WebSocket error",
                    error
                );

                return false;
            }
        };

    Main.sendNetwork =
        function(data) {

            if (
                !Main.network ||
                Main.network.readyState !==
                WebSocket.OPEN
            ) {

                Main.showLobbyNetworkError(
                    "NOT CONNECTED TO THE MULTIPLAYER SERVER"
                );

                return false;
            }

            try {

                Main.network.send(
                    JSON.stringify(
                        data
                    )
                );

                return true;

            } catch {

                return false;
            }
        };

    /* ========================================================
       NETWORK MESSAGE HANDLER
    ======================================================== */

    Main.handleNetworkMessage =
        function(raw) {

            let data;

            try {

                data =
                    JSON.parse(
                        raw
                    );

            } catch {

                return;
            }

            switch (
                data.type
            ) {

                case "lobby_created":

                    Main.receiveCreatedLobby(
                        data
                    );

                    break;

                case "lobby_joined":

                    Main.receiveJoinedLobby(
                        data
                    );

                    break;

                case "lobby_updated":

                    Main.updateLobbyFromServer(
                        data
                    );

                    break;

                case "game_started":

                    Main.receiveGameStarted(
                        data
                    );

                    break;

                case "lobby_error":

                    Main.showLobbyNetworkError(
                        data.message ||
                        "LOBBY ERROR"
                    );

                    break;

                case "player_joined":

                    Main.updateLobbyFromServer(
                        data
                    );

                    break;

                case "player_left":

                    Main.updateLobbyFromServer(
                        data
                    );

                    break;

                case "voice_signal":

                    Main.handleVoiceSignal(
                        data
                    );

                    break;

                default:

                    console.log(
                        "[THE SEEKER] Network message:",
                        data
                    );
            }
        };

    /* ========================================================
       CREATED LOBBY
    ======================================================== */

    Main.receiveCreatedLobby =
        function(data) {

            Main.lobby =
                data.lobby ||
                null;

            if (
                !Main.lobby
            ) {
                return;
            }

            Main.lobbyMode =
                "host";

            Main.closeModal(
                "hostModal"
            );

            Main.openModal(
                "hostedLobbyModal"
            );

            Main.renderHostedLobby();

            Main.setLobbyStatus(
                "CONNECTED — LOBBY READY"
            );

            Main.updateLobbyControls();

            Main.playClick();
        };

    /* ========================================================
       JOIN
    ======================================================== */

    Main.openJoin =
        function() {

            Main.lobbyMode =
                "join";

            const message =
                $("#joinLobbyMessage");

            if (message) {
                message.textContent =
                    "";
            }

            Main.openModal(
                "joinModal"
            );
        };

    Main.joinLobby =
        function() {

            const name =
                (
                    $("#joinNameInput")
                        ?.value ||
                    "PLAYER"
                )
                    .trim()
                    .slice(
                        0,
                        20
                    );

            const code =
                (
                    $("#joinCodeInput")
                        ?.value ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (
                code.length !==
                6
            ) {

                Main.setJoinMessage(
                    "ENTER A 6-CHARACTER LOBBY CODE"
                );

                return;
            }

            /*
             * IMPORTANT:
             * Joining NEVER creates a new lobby.
             *
             * We send join_lobby with the exact code.
             */

            if (
                !Main.network ||
                Main.network.readyState !==
                WebSocket.OPEN
            ) {

                Main.connectServer();

                setTimeout(
                    () => {

                        if (
                            Main.network?.readyState ===
                            WebSocket.OPEN
                        ) {

                            Main.sendNetwork({
                                type:
                                    "join_lobby",
                                code,
                                playerName:
                                    name
                            });

                        } else {

                            Main.setJoinMessage(
                                "SERVER OFFLINE — THIS CODE CANNOT BE JOINED YET"
                            );
                        }

                    },
                    250
                );

                return;
            }

            Main.sendNetwork({
                type:
                    "join_lobby",
                code,
                playerName:
                    name
            });
        };

    /* ========================================================
       JOINED LOBBY
    ======================================================== */

    Main.receiveJoinedLobby =
        function(data) {

            Main.lobby =
                data.lobby ||
                null;

            if (
                !Main.lobby
            ) {

                Main.setJoinMessage(
                    "LOBBY WAS NOT FOUND"
                );

                return;
            }

            Main.lobbyMode =
                "join";

            Main.closeModal(
                "joinModal"
            );

            Main.openModal(
                "joinedLobbyModal"
            );

            Main.renderJoinedLobby();

            Main.playClick();
        };

    /* ========================================================
       LOBBY UPDATE
    ======================================================== */

    Main.updateLobbyFromServer =
        function(data) {

            if (
                data.lobby
            ) {

                Main.lobby =
                    data.lobby;
            }

            if (
                !Main.lobby
            ) {
                return;
            }

            if (
                Main.lobbyMode ===
                "host"
            ) {

                Main.renderHostedLobby();

            } else if (
                Main.lobbyMode ===
                "join"
            ) {

                Main.renderJoinedLobby();
            }

            Main.updateLobbyControls();
        };

    /* ========================================================
       RENDER HOST LOBBY
    ======================================================== */

    Main.renderHostedLobby =
        function() {

            if (
                !Main.lobby
            ) {
                return;
            }

            Main.setText(
                "#hostedLobbyCode",
                Main.lobby.code ||
                Main.lobby.id ||
                "------"
            );

            Main.setText(
                "#hostedLobbyName",
                Main.lobby.name ||
                "THE SEEKER LOBBY"
            );

            Main.setText(
                "#hostedLobbyMap",
                Main.mapLabel(
                    Main.lobby.map
                )
            );

            const players =
                Main.lobby.players ||
                [];

            Main.setText(
                "#hostedPlayerCount",
                `${players.length} / ${
                    Main.lobby.maxPlayers ||
                    4
                }`
            );

            const list =
                $("#hostedPlayerList");

            if (!list) {
                return;
            }

            list.innerHTML =
                players.map(
                    player => {

                        return `
                            <div class="player-list-item">
                                <span>
                                    ${Main.escapeHTML(
                                        player.name ||
                                        "PLAYER"
                                    )}
                                </span>

                                ${
                                    player.host
                                    ? `
                                        <span class="player-host-label">
                                            HOST
                                        </span>
                                    `
                                    : ""
                                }
                            </div>
                        `;
                    }
                ).join("");
        };

    /* ========================================================
       RENDER JOINED LOBBY
    ======================================================== */

    Main.renderJoinedLobby =
        function() {

            if (
                !Main.lobby
            ) {
                return;
            }

            Main.setText(
                "#joinedLobbyCode",
                Main.lobby.code ||
                Main.lobby.id ||
                "------"
            );

            Main.setText(
                "#joinedLobbyName",
                Main.lobby.name ||
                "THE SEEKER LOBBY"
            );

            Main.setText(
                "#joinedLobbyMap",
                Main.mapLabel(
                    Main.lobby.map
                )
            );

            const players =
                Main.lobby.players ||
                [];

            Main.setText(
                "#joinedPlayerCount",
                `${players.length} / ${
                    Main.lobby.maxPlayers ||
                    4
                }`
            );

            const list =
                $("#joinedPlayerList");

            if (!list) {
                return;
            }

            list.innerHTML =
                players.map(
                    player => {

                        return `
                            <div class="player-list-item">
                                <span>
                                    ${Main.escapeHTML(
                                        player.name ||
                                        "PLAYER"
                                    )}
                                </span>

                                ${
                                    player.host
                                    ? `
                                        <span class="player-host-label">
                                            HOST
                                        </span>
                                    `
                                    : ""
                                }
                            </div>
                        `;
                    }
                ).join("");
        };

    /* ========================================================
       LOBBY CONTROLS
    ======================================================== */

    Main.updateLobbyControls =
        function() {

            const start =
                $("#hostStartGameButton");

            if (!start) {
                return;
            }

            const players =
                Main.lobby?.players ||
                [];

            const canStart =
                Main.lobbyMode ===
                    "host" &&
                Main.network?.readyState ===
                    WebSocket.OPEN &&
                players.length >= 1;

            start.disabled =
                !canStart;

            if (
                canStart
            ) {

                start.textContent =
                    "START GAME";

            } else {

                start.textContent =
                    Main.network?.readyState ===
                    WebSocket.OPEN
                        ? "WAITING FOR SERVER"
                        : "SERVER OFFLINE";
            }
        };

    Main.startHostedGame =
        function() {

            if (
                Main.lobbyMode !==
                "host"
            ) {

                return;
            }

            if (
                !Main.lobby
            ) {
                return;
            }

            /*
             * ACTUAL multiplayer flow:
             * host sends the start command to server.
             * The server broadcasts game_started to everyone.
             */

            Main.sendNetwork({
                type:
                    "start_game",
                code:
                    Main.lobby.code ||
                    Main.lobby.id,
                map:
                    Main.lobby.map ||
                    Main.selectedMap
            });
        };

    Main.receiveGameStarted =
        function(data) {

            Main.selectedMap =
                data.map ||
                Main.lobby?.map ||
                "facility";

            const mode =
                "multiplayer";

            Main.closeAllModals();

            Main.beginGameLoading(
                Main.selectedPlatform,
                mode
            );
        };

    /* ========================================================
       LEAVE LOBBY
    ======================================================== */

    Main.leaveLobby =
        function() {

            if (
                Main.network?.readyState ===
                WebSocket.OPEN &&
                Main.lobby
            ) {

                Main.sendNetwork({
                    type:
                        "leave_lobby",
                    code:
                        Main.lobby.code ||
                        Main.lobby.id
                });
            }

            Main.lobby =
                null;

            Main.lobbyMode =
                null;

            Main.closeModal(
                "hostedLobbyModal"
            );

            Main.closeModal(
                "joinedLobbyModal"
            );

            Main.showMenu();
        };

    /* ========================================================
       VOICE CHAT
    ======================================================== */

    Main.enableVoice =
        async function(button) {

            const success =
                await window.SeekerSystem
                    ?.startVoiceChat?.();

            if (
                success
            ) {

                button.classList.add(
                    "active"
                );

                button.textContent =
                    "MIC ACTIVE";

            } else {

                button.classList.remove(
                    "active"
                );

                button.textContent =
                    "ENABLE MIC";
            }
        };

    /* ========================================================
       WEBRTC VOICE SIGNAL
    ======================================================== */

    Main.handleVoiceSignal =
        async function(data) {

            /*
             * This is the signaling bridge.
             * Real media transfer remains WebRTC.
             */

            if (
                !window.SeekerSystem
            ) {
                return;
            }

            if (
                typeof
                    window.SeekerSystem
                        .handleVoiceSignal ===
                    "function"
            ) {

                await window.SeekerSystem
                    .handleVoiceSignal(
                        data
                    );
            }
        };

    /* ========================================================
       SETTINGS
    ======================================================== */

    Main.loadSettings =
        function() {

            try {

                const saved =
                    JSON.parse(
                        localStorage.getItem(
                            "the-seeker-main-settings"
                        ) ||
                        "null"
                    );

                if (
                    saved &&
                    typeof saved ===
                    "object"
                ) {

                    Object.assign(
                        Main.settings,
                        saved
                    );
                }

            } catch {}
        };

    Main.saveSettings =
        function() {

            try {

                localStorage.setItem(
                    "the-seeker-main-settings",
                    JSON.stringify(
                        Main.settings
                    )
                );

            } catch {}
        };

    Main.setupSettings =
        function() {

            const master =
                $("#masterVolume");

            const music =
                $("#musicVolume");

            const effects =
                $("#effectsVolume");

            const voice =
                $("#voiceVolume");

            const screenEffects =
                $("#screenEffectsToggle");

            const reducedMotion =
                $("#reducedMotionToggle");

            if (master) {

                master.value =
                    Main.settings
                        .masterVolume;

                master.addEventListener(
                    "input",
                    () => {

                        Main.settings
                            .masterVolume =
                            Number(
                                master.value
                            );

                        Main.applyVolumes();
                    }
                );
            }

            if (music) {

                music.value =
                    Main.settings
                        .musicVolume;

                music.addEventListener(
                    "input",
                    () => {

                        Main.settings
                            .musicVolume =
                            Number(
                                music.value
                            );

                        Main.applyVolumes();
                    }
                );
            }

            if (effects) {

                effects.value =
                    Main.settings
                        .effectsVolume;

                effects.addEventListener(
                    "input",
                    () => {

                        Main.settings
                            .effectsVolume =
                            Number(
                                effects.value
                            );

                        Main.applyVolumes();
                    }
                );
            }

            if (voice) {

                voice.value =
                    Main.settings
                        .voiceVolume;

                voice.addEventListener(
                    "input",
                    () => {

                        Main.settings
                            .voiceVolume =
                            Number(
                                voice.value
                            );

                        Main.applyVolumes();
                    }
                );
            }

            if (
                screenEffects
            ) {

                screenEffects.checked =
                    Main.settings
                        .screenEffects;

                screenEffects.addEventListener(
                    "change",
                    () => {

                        Main.settings
                            .screenEffects =
                            screenEffects.checked;

                        Main.saveSettings();
                    }
                );
            }

            if (
                reducedMotion
            ) {

                reducedMotion.checked =
                    Main.settings
                        .reducedMotion;

                reducedMotion.addEventListener(
                    "change",
                    () => {

                        Main.settings
                            .reducedMotion =
                            reducedMotion.checked;

                        document.documentElement
                            .style
                            .setProperty(
                                "scroll-behavior",
                                reducedMotion.checked
                                    ? "auto"
                                    : "smooth"
                            );

                        Main.saveSettings();
                    }
                );
            }

            Main.applyVolumes();
        };

    Main.applyVolumes =
        function() {

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .setVolume?.(
                        "master",
                        Main.settings
                            .masterVolume
                    );

                window.SeekerSystem
                    .setVolume?.(
                        "music",
                        Main.settings
                            .musicVolume
                    );

                window.SeekerSystem
                    .setVolume?.(
                        "effects",
                        Main.settings
                            .effectsVolume
                    );

                window.SeekerSystem
                    .setVolume?.(
                        "voice",
                        Main.settings
                            .voiceVolume
                    );
            }

            const music =
                $("#menuMusicAudio");

            if (music) {

                music.volume =
                    Main.settings
                        .musicVolume *
                    Main.settings
                        .masterVolume *
                    .45;
            }

            Main.saveSettings();
        };

    /* ========================================================
       UI
    ======================================================== */

    Main.setText =
        function(selector, value) {

            const element =
                $(selector);

            if (
                element
            ) {

                element.textContent =
                    String(
                        value ??
                        ""
                    );
            }
        };

    Main.mapLabel =
        function(map) {

            const labels = {

                facility:
                    "FACILITY",

                basement:
                    "BASEMENT",

                forest:
                    "FOREST"
            };

            return labels[
                map
            ] ||
                String(
                    map ||
                    "FACILITY"
                ).toUpperCase();
        };

    Main.setJoinMessage =
        function(message) {

            Main.setText(
                "#joinLobbyMessage",
                message
            );
        };

    Main.setLobbyStatus =
        function(message) {

            Main.setText(
                "#hostedLobbyStatus",
                message
            );

            Main.setText(
                "#joinedLobbyStatus",
                message
            );
        };

    Main.showLobbyNetworkError =
        function(message) {

            Main.setJoinMessage(
                message
            );

            Main.setLobbyStatus(
                message
            );

            Main.showNotification(
                message
            );
        };

    Main.escapeHTML =
        function(value) {

            return String(
                value
            ).replace(
                /[&<>"']/g,
                character => {

                    const map = {

                        "&":
                            "&amp;",

                        "<":
                            "&lt;",

                        ">":
                            "&gt;",

                        '"':
                            "&quot;",

                        "'":
                            "&#039;"
                    };

                    return map[
                        character
                    ];
                }
            );
        };

    Main.showNotification =
        function(message) {

            const notification =
                $("#gameNotification");

            if (!notification) {
                return;
            }

            notification.textContent =
                message;

            notification.classList.add(
                "visible"
            );

            clearTimeout(
                Main.notificationTimer
            );

            Main.notificationTimer =
                setTimeout(
                    () => {

                        notification.classList.remove(
                            "visible"
                        );

                    },
                    2500
                );
        };

    /* ========================================================
       GAME HUD
    ======================================================== */

    Main.updateGameUI =
        function() {

            const hud =
                $("#gameHUD");

            if (!hud) {
                return;
            }

            document.body.dataset.platform =
                Main.selectedPlatform;

            document.body.classList.toggle(
                "mobile-mode",
                Main.selectedPlatform ===
                "mobile"
            );

            const mapName =
                $(".hud-map-name");

            if (mapName) {

                mapName.textContent =
                    Main.mapLabel(
                        Main.selectedMap
                    );
            }
        };

    /* ========================================================
       FLASHLIGHT SLOT
    ======================================================== */

    Main.setupFlashlight =
        function() {

            const slot =
                $("#inventorySlot1");

            const mobile =
                $("#mobileFlashlightButton");

            if (slot) {

                slot.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        Main.playClick();

                        window.SeekerDetails
                            ?.selectFlashlightSlot?.();

                        slot.classList.add(
                            "active"
                        );
                    }
                );
            }

            if (mobile) {

                mobile.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        if (
                            !window.SeekerDetails
                        ) {
                            return;
                        }

                        const visible =
                            window.SeekerDetails
                                .isFlashlightVisible?.();

                        if (
                            !visible
                        ) {

                            window.SeekerDetails
                                .selectFlashlightSlot?.();

                        } else {

                            window.SeekerDetails
                                .toggleFlashlight?.();
                        }
                    }
                );
            }

            window.addEventListener(
                "seeker:flashlight-selected",
                () => {

                    Main.setText(
                        "#flashlightBattery",
                        "READY"
                    );
                }
            );
        };

    /* ========================================================
       BUTTON BINDINGS
    ======================================================== */

    Main.bindButtons =
        function() {

            const play =
                $("#playButton");

            const multiplayer =
                $("#multiplayerButton");

            const settings =
                $("#settingsButton");

            const credits =
                $("#creditsButton");

            if (play) {

                play.addEventListener(
                    "click",
                    async () => {

                        await Main.unlockAudio();

                        Main.playClick();

                        Main.startSingleplayer();
                    }
                );
            }

            if (multiplayer) {

                multiplayer.addEventListener(
                    "click",
                    async () => {

                        await Main.unlockAudio();

                        Main.playClick();

                        Main.connectServer();

                        Main.openModal(
                            "multiplayerModal"
                        );
                    }
                );
            }

            if (settings) {

                settings.addEventListener(
                    "click",
                    async () => {

                        await Main.unlockAudio();

                        Main.playClick();

                        Main.openModal(
                            "settingsModal"
                        );
                    }
                );
            }

            if (credits) {

                credits.addEventListener(
                    "click",
                    async () => {

                        await Main.unlockAudio();

                        Main.playClick();

                        Main.openModal(
                            "creditsModal"
                        );
                    }
                );
            }

            $("#pcModeButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.selectPlatform(
                            "pc"
                        );
                    }
                );

            $("#mobileModeButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.selectPlatform(
                            "mobile"
                        );
                    }
                );

            $("#hostLobbyButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.openHost();

                    }
                );

            $("#joinLobbyButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.openJoin();

                    }
                );

            $("#createLobbyButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.createHostLobby();

                    }
                );

            $("#joinConfirmButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.joinLobby();

                    }
                );

            $("#hostStartGameButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.startHostedGame();

                    }
                );

            $("#hostLeaveButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.leaveLobby();

                    }
                );

            $("#joinedLeaveButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.leaveLobby();

                    }
                );

            $("#hostVoiceButton")
                ?.addEventListener(
                    "click",
                    event => {

                        Main.enableVoice(
                            event.currentTarget
                        );
                    }
                );

            $("#joinedVoiceButton")
                ?.addEventListener(
                    "click",
                    event => {

                        Main.enableVoice(
                            event.currentTarget
                        );
                    }
                );

            $("#closeSettingsButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.closeModal(
                            "settingsModal"
                        );
                    }
                );

            $$(".modal-close")
                .forEach(
                    button => {

                        if (
                            button.id ===
                            "hostLeaveButton" ||
                            button.id ===
                            "joinedLeaveButton"
                        ) {
                            return;
                        }

                        button.addEventListener(
                            "click",
                            () => {

                                Main.playClick();

                                const id =
                                    button.dataset
                                        .closeModal;

                                if (id) {

                                    Main.closeModal(
                                        id
                                    );
                                }
                            }
                        );
                    }
                );
        };

    /* ========================================================
       HOVER AUDIO
    ======================================================== */

    Main.setupHoverAudio =
        function() {

            $$(".menu-button, .large-action-button, .mode-card, .map-option, .modal-primary-button")
                .forEach(
                    button => {

                        button.addEventListener(
                            "mouseenter",
                            () => {

                                if (
                                    !button.dataset
                                        .hoverPlayed
                                ) {

                                    Main.playHover();

                                    button.dataset
                                        .hoverPlayed =
                                        "1";
                                }

                                setTimeout(
                                    () => {

                                        delete button
                                            .dataset
                                            .hoverPlayed;

                                    },
                                    350
                                );
                            }
                        );
                    }
                );
        };

    /* ========================================================
       ESC KEY
    ======================================================== */

    Main.setupEscape =
        function() {

            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key !==
                        "Escape"
                    ) {
                        return;
                    }

                    if (
                        Main.modalStack.length
                    ) {

                        const last =
                            Main.modalStack[
                                Main.modalStack
                                    .length - 1
                            ];

                        Main.closeModal(
                            last
                        );

                        return;
                    }

                    if (
                        Main.gameStarted &&
                        window.SeekerSystem
                    ) {

                        window.SeekerSystem
                            .togglePause?.();
                    }
                }
            );
        };

    /* ========================================================
       ENTER KEY FOR JOIN CODE
    ======================================================== */

    Main.setupJoinEnter =
        function() {

            const input =
                $("#joinCodeInput");

            if (!input) {
                return;
            }

            input.addEventListener(
                "input",
                () => {

                    input.value =
                        input.value
                            .replace(
                                /[^a-z0-9]/gi,
                                ""
                            )
                            .toUpperCase()
                            .slice(
                                0,
                                6
                            );
                }
            );

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        Main.joinLobby();
                    }
                }
            );
        };

    /* ========================================================
       INPUT BRIDGE
    ======================================================== */

    Main.setupGameButtons =
        function() {

            $("#resumeButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        window.SeekerSystem
                            ?.resume?.();
                    }
                );

            $("#pauseMenuButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        window.SeekerSystem
                            ?.returnToMenu?.();

                        Main.leaveGame();
                    }
                );

            $("#retryButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.leaveGame();

                        setTimeout(
                            () => {

                                Main.startSingleplayer();

                            },
                            100
                        );
                    }
                );

            $("#caughtMenuButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        Main.leaveGame();
                    }
                );

            $("#mobileInteractButton")
                ?.addEventListener(
                    "click",
                    () => {

                        Main.playClick();

                        window.SeekerGame
                            ?.interact?.();
                    }
                );

            window.addEventListener(
                "seeker:state-changed",
                event => {

                    Main.handleStateChange(
                        event.detail
                    );
                }
            );

            window.addEventListener(
                "seeker:button-found",
                event => {

                    const count =
                        event.detail?.count ||
                        0;

                    Main.setText(
                        "#objectiveText",
                        count >= 3
                            ? "FIND THE KEY"
                            : `FIND THE THREE BUTTONS — ${count}/3`
                    );
                }
            );

            window.addEventListener(
                "seeker:key-collected",
                () => {

                    Main.setText(
                        "#objectiveText",
                        "FIND THE EXIT GATE"
                    );
                }
            );

            window.addEventListener(
                "seeker:gate-unlocked",
                () => {

                    Main.setText(
                        "#objectiveText",
                        "ESCAPE THE FACILITY"
                    );
                }
            );

            window.addEventListener(
                "seeker:hunting-started",
                () => {

                    Main.setText(
                        "#objectiveText",
                        "THE SEEKER IS HUNTING YOU"
                    );
                }
            );
        };

    /* ========================================================
       STATE HANDLING
    ======================================================== */

    Main.handleStateChange =
        function(data = {}) {

            const state =
                data.state;

            const pause =
                $("#pauseScreen");

            const caught =
                $("#caughtScreen");

            if (
                state ===
                "paused"
            ) {

                pause?.classList.add(
                    "open"
                );

            } else {

                pause?.classList.remove(
                    "open"
                );
            }

            if (
                state ===
                "caught"
            ) {

                caught?.classList.add(
                    "open"
                );

            } else if (
                state ===
                "escaped"
            ) {

                Main.showNotification(
                    "YOU ESCAPED"
                );
            }
        };

    /* ========================================================
       LEAVE GAME
    ======================================================== */

    Main.leaveGame =
        function() {

            Main.gameStarted =
                false;

            document.body.classList.remove(
                "game-active"
            );

            document.body.classList.remove(
                "mobile-mode"
            );

            Main.stopMenuMusic();

            Main.showMenu();

            const caught =
                $("#caughtScreen");

            const pause =
                $("#pauseScreen");

            caught?.classList.remove(
                "open"
            );

            pause?.classList.remove(
                "open"
            );

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .stopAllAudio?.();
            }

            if (
                window.SeekerGame
            ) {

                window.SeekerGame.gameOver =
                    false;
            }

            Main.startMenuMusic();
        };

    /* ========================================================
       FLASHLIGHT FIRST SLOT
    ======================================================== */

    Main.bindInventory =
        function() {

            const slot =
                $("#inventorySlot1");

            if (!slot) {
                return;
            }

            slot.addEventListener(
                "dblclick",
                () => {

                    window.SeekerDetails
                        ?.toggleFlashlight?.();
                }
            );
        };

    /* ========================================================
       INITIALIZATION
    ======================================================== */

    Main.init =
        async function() {

            Main.loadSettings();

            Main.bindButtons();

            Main.setupMapButtons();

            Main.setupSettings();

            Main.setupFlashlight();

            Main.setupGameButtons();

            Main.setupJoinEnter();

            Main.setupEscape();

            Main.bindInventory();

            Main.setupHoverAudio();

            Main.connectServer();

            Main.updateMenuPlatform();

            Main.playIntro();
        };

    window.SeekerMain =
        Main;

    window.Main =
        Main;

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
                once: true
            }
        );

    } else {

        Main.init();
    }

})();