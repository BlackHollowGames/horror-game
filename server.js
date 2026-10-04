/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   server.js

   REAL MULTIPLAYER SERVER
   ------------------------------------------------------------
   Run:
       npm install ws
       node server.js

   Default:
       ws://localhost:8080

   This is NOT a fake localStorage lobby.

   Features:
   - Real WebSocket server
   - Real lobby creation
   - Real lobby join codes
   - Real player lists
   - Host authority
   - Start-game broadcast
   - Lobby cleanup
   - Player disconnect handling
   - Map selection
   - Voice-chat signaling relay
   - Position/state relay
   - Game state relay
   - Basic server validation
   - Heartbeat / stale connection cleanup
============================================================ */

"use strict";

const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");

/* ============================================================
   CONFIG
============================================================ */

const HOST =
    process.env.HOST ||
    "0.0.0.0";

const PORT =
    Number(
        process.env.PORT ||
        8080
    );

const MAX_LOBBIES = 500;

const MAX_PLAYERS_PER_LOBBY = 8;

const CODE_LENGTH = 6;

const HEARTBEAT_INTERVAL = 15000;

const CLIENT_TIMEOUT = 35000;

/* ============================================================
   MAPS
============================================================ */

const MAPS = new Set([
    "facility",
    "basement",
    "forest"
]);

/* ============================================================
   LOBBIES
============================================================ */

const lobbies =
    new Map();

/* ============================================================
   PLAYER ID
============================================================ */

function createId() {
    return crypto.randomBytes(12).toString("hex");
}

/* ============================================================
   LOBBY CODE
============================================================ */

function createLobbyCode() {

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (
            let i = 0;
            i < CODE_LENGTH;
            i++
        ) {

            code +=
                alphabet[
                    crypto.randomInt(
                        0,
                        alphabet.length
                    )
                ];
        }

    } while (
        lobbies.has(code)
    );

    return code;
}

/* ============================================================
   CLEAN TEXT
============================================================ */

function cleanText(
    value,
    maxLength,
    fallback
) {

    if (
        typeof value !==
        "string"
    ) {

        return fallback;
    }

    const text =
        value
            .replace(
                /[\u0000-\u001F\u007F]/g,
                ""
            )
            .trim();

    if (!text) {
        return fallback;
    }

    return text.slice(
        0,
        maxLength
    );
}

/* ============================================================
   SAFE MAP
============================================================ */

function safeMap(
    value
) {

    return MAPS.has(value)
        ? value
        : "facility";
}

/* ============================================================
   SAFE PLAYER NAME
============================================================ */

function safePlayerName(
    value
) {

    return cleanText(
        value,
        20,
        "PLAYER"
    );
}

/* ============================================================
   LOBBY OBJECT
============================================================ */

function createLobby(
    ws,
    data
) {

    if (
        lobbies.size >=
        MAX_LOBBIES
    ) {

        return {
            error:
                "SERVER LOBBY LIMIT REACHED"
        };
    }

    const code =
        createLobbyCode();

    const playerId =
        createId();

    const player = {

        id:
            playerId,

        name:
            safePlayerName(
                data.playerName
            ),

        host:
            true,

        x:
            0,

        y:
            0,

        z:
            -8,

        yaw:
            0,

        pitch:
            0,

        alive:
            true,

        ready:
            true,

        joinedAt:
            Date.now()
    };

    const lobby = {

        code,

        name:
            cleanText(
                data.lobbyName,
                28,
                "THE SEEKER LOBBY"
            ),

        maxPlayers:
            Math.max(
                1,
                Math.min(
                    MAX_PLAYERS_PER_LOBBY,
                    Number(
                        data.maxPlayers
                    ) || 4
                )
            ),

        map:
            safeMap(
                data.map
            ),

        state:
            "waiting",

        createdAt:
            Date.now(),

        startedAt:
            0,

        hostId:
            playerId,

        players:
            new Map(),

        game:
            {
                buttonsFound: 0,
                keyCollected: false,
                gateUnlocked: false,
                seekerAwake: false,
                elapsed: 0
            },

        playerSockets:
            new Map()
    };

    lobby.players.set(
        playerId,
        player
    );

    lobby.playerSockets.set(
        playerId,
        ws
    );

    ws.seekerPlayerId =
        playerId;

    ws.seekerLobbyCode =
        code;

    ws.isAlive =
        true;

    lobbies.set(
        code,
        lobby
    );

    return {
        lobby,
        player
    };
}

/* ============================================================
   SERIALIZE PLAYER
============================================================ */

function serializePlayer(
    player
) {

    return {

        id:
            player.id,

        name:
            player.name,

        host:
            player.host,

        x:
            player.x,

        y:
            player.y,

        z:
            player.z,

        yaw:
            player.yaw,

        pitch:
            player.pitch,

        alive:
            player.alive,

        ready:
            player.ready
    };
}

/* ============================================================
   SERIALIZE LOBBY
============================================================ */

function serializeLobby(
    lobby
) {

    return {

        code:
            lobby.code,

        name:
            lobby.name,

        maxPlayers:
            lobby.maxPlayers,

        map:
            lobby.map,

        state:
            lobby.state,

        createdAt:
            lobby.createdAt,

        startedAt:
            lobby.startedAt,

        hostId:
            lobby.hostId,

        players:
            [
                ...lobby.players.values()
            ]
                .map(
                    serializePlayer
                ),

        game:
            {
                buttonsFound:
                    lobby.game.buttonsFound,

                keyCollected:
                    lobby.game.keyCollected,

                gateUnlocked:
                    lobby.game.gateUnlocked,

                seekerAwake:
                    lobby.game.seekerAwake,

                elapsed:
                    lobby.game.elapsed
            }
    };
}

/* ============================================================
   SEND
============================================================ */

function send(
    ws,
    packet
) {

    if (
        !ws ||
        ws.readyState !==
            WebSocket.OPEN
    ) {

        return false;
    }

    try {

        ws.send(
            JSON.stringify(
                packet
            )
        );

        return true;

    } catch {

        return false;
    }
}

/* ============================================================
   BROADCAST
============================================================ */

function broadcast(
    lobby,
    packet,
    exceptId = null
) {

    if (!lobby) {
        return;
    }

    for (
        const player
        of lobby.players.values()
    ) {

        if (
            player.id ===
            exceptId
        ) {
            continue;
        }

        const socket =
            lobby.playerSockets.get(
                player.id
            );

        send(
            socket,
            packet
        );
    }
}

/* ============================================================
   BROADCAST LOBBY
============================================================ */

function broadcastLobby(
    lobby
) {

    if (!lobby) {
        return;
    }

    broadcast(
        lobby,
        {
            type:
                "lobby_updated",

            lobby:
                serializeLobby(
                    lobby
                )
        }
    );
}

/* ============================================================
   ERROR
============================================================ */

function sendError(
    ws,
    message
) {

    send(
        ws,
        {
            type:
                "lobby_error",

            message:
                cleanText(
                    message,
                    160,
                    "SERVER ERROR"
                )
        }
    );
}

/* ============================================================
   FIND LOBBY
============================================================ */

function getLobbyForSocket(
    ws
) {

    if (
        !ws.seekerLobbyCode
    ) {

        return null;
    }

    return lobbies.get(
        ws.seekerLobbyCode
    ) ||
        null;
}

/* ============================================================
   FIND PLAYER
============================================================ */

function getPlayerForSocket(
    ws,
    lobby
) {

    if (
        !lobby ||
        !ws.seekerPlayerId
    ) {

        return null;
    }

    return lobby.players.get(
        ws.seekerPlayerId
    ) ||
        null;
}

/* ============================================================
   CREATE LOBBY MESSAGE
============================================================ */

function handleCreateLobby(
    ws,
    data
) {

    /*
     * A socket cannot create another lobby while already
     * inside a lobby.
     */

    const existing =
        getLobbyForSocket(
            ws
        );

    if (existing) {

        sendError(
            ws,
            "YOU ARE ALREADY IN A LOBBY"
        );

        return;
    }

    const result =
        createLobby(
            ws,
            data
        );

    if (
        result.error
    ) {

        sendError(
            ws,
            result.error
        );

        return;
    }

    send(
        ws,
        {
            type:
                "lobby_created",

            lobby:
                serializeLobby(
                    result.lobby
                ),

            playerId:
                result.player.id
        }
    );

    console.log(
        `[LOBBY] Created ${result.lobby.code} by ${result.player.name}`
    );
}

/* ============================================================
   JOIN LOBBY MESSAGE
============================================================ */

function handleJoinLobby(
    ws,
    data
) {

    /*
     * IMPORTANT:
     *
     * This NEVER creates a lobby.
     *
     * It only looks up the exact code in the server's lobby map.
     */

    const code =
        cleanText(
            data.code,
            CODE_LENGTH,
            ""
        )
            .toUpperCase();

    if (
        code.length !==
        CODE_LENGTH
    ) {

        sendError(
            ws,
            "INVALID LOBBY CODE"
        );

        return;
    }

    const lobby =
        lobbies.get(
            code
        );

    if (!lobby) {

        sendError(
            ws,
            "LOBBY NOT FOUND"
        );

        return;
    }

    if (
        lobby.state !==
        "waiting"
    ) {

        sendError(
            ws,
            "GAME ALREADY STARTED"
        );

        return;
    }

    if (
        lobby.players.size >=
        lobby.maxPlayers
    ) {

        sendError(
            ws,
            "LOBBY IS FULL"
        );

        return;
    }

    const existingLobby =
        getLobbyForSocket(
            ws
        );

    if (existingLobby) {

        sendError(
            ws,
            "LEAVE YOUR CURRENT LOBBY FIRST"
        );

        return;
    }

    const playerId =
        createId();

    const player = {

        id:
            playerId,

        name:
            safePlayerName(
                data.playerName
            ),

        host:
            false,

        x:
            0,

        y:
            0,

        z:
            -8,

        yaw:
            0,

        pitch:
            0,

        alive:
            true,

        ready:
            true,

        joinedAt:
            Date.now()
    };

    lobby.players.set(
        playerId,
        player
    );

    lobby.playerSockets.set(
        playerId,
        ws
    );

    ws.seekerPlayerId =
        playerId;

    ws.seekerLobbyCode =
        code;

    ws.isAlive =
        true;

    send(
        ws,
        {
            type:
                "lobby_joined",

            lobby:
                serializeLobby(
                    lobby
                ),

            playerId
        }
    );

    broadcast(
        lobby,
        {
            type:
                "player_joined",

            lobby:
                serializeLobby(
                    lobby
                ),

            player:
                serializePlayer(
                    player
                )
        },
        playerId
    );

    broadcastLobby(
        lobby
    );

    console.log(
        `[LOBBY] ${player.name} joined ${code}`
    );
}

/* ============================================================
   START GAME
============================================================ */

function handleStartGame(
    ws,
    data
) {

    const lobby =
        getLobbyForSocket(
            ws
        );

    if (!lobby) {

        sendError(
            ws,
            "YOU ARE NOT IN A LOBBY"
        );

        return;
    }

    const player =
        getPlayerForSocket(
            ws,
            lobby
        );

    if (!player) {

        sendError(
            ws,
            "PLAYER SESSION NOT FOUND"
        );

        return;
    }

    if (
        lobby.hostId !==
        player.id
    ) {

        sendError(
            ws,
            "ONLY THE HOST CAN START THE GAME"
        );

        return;
    }

    if (
        lobby.state ===
        "playing"
    ) {

        sendError(
            ws,
            "GAME ALREADY STARTED"
        );

        return;
    }

    const requestedMap =
        safeMap(
            data.map ||
            lobby.map
        );

    lobby.map =
        requestedMap;

    lobby.state =
        "playing";

    lobby.startedAt =
        Date.now();

    lobby.game.buttonsFound =
        0;

    lobby.game.keyCollected =
        false;

    lobby.game.gateUnlocked =
        false;

    lobby.game.seekerAwake =
        false;

    lobby.game.elapsed =
        0;

    broadcast(
        lobby,
        {
            type:
                "game_started",

            map:
                lobby.map,

            lobby:
                serializeLobby(
                    lobby
                )
        }
    );

    console.log(
        `[GAME] ${lobby.code} started on ${lobby.map}`
    );
}

/* ============================================================
   LEAVE LOBBY
============================================================ */

function removePlayerFromLobby(
    ws,
    reason = "disconnect"
) {

    const lobby =
        getLobbyForSocket(
            ws
        );

    if (!lobby) {
        return;
    }

    const playerId =
        ws.seekerPlayerId;

    const player =
        lobby.players.get(
            playerId
        );

    if (!player) {
        return;
    }

    lobby.players.delete(
        playerId
    );

    lobby.playerSockets.delete(
        playerId
    );

    ws.seekerPlayerId =
        null;

    ws.seekerLobbyCode =
        null;

    /*
     * Host leaves.
     *
     * Transfer host to another player if possible.
     */

    if (
        lobby.hostId ===
        playerId
    ) {

        const next =
            lobby.players.values()
                .next();

        if (
            !next.done
        ) {

            const newHost =
                next.value;

            lobby.hostId =
                newHost.id;

            newHost.host =
                true;

        } else {

            lobbies.delete(
                lobby.code
            );

            console.log(
                `[LOBBY] Deleted empty lobby ${lobby.code}`
            );

            return;
        }
    }

    broadcast(
        lobby,
        {
            type:
                "player_left",

            playerId,

            reason,

            lobby:
                serializeLobby(
                    lobby
                )
        }
    );

    broadcastLobby(
        lobby
    );

    console.log(
        `[LOBBY] ${player?.name || playerId} left ${lobby.code}`
    );
}

/* ============================================================
   PLAYER STATE
============================================================ */

function handlePlayerState(
    ws,
    data
) {

    const lobby =
        getLobbyForSocket(
            ws
        );

    if (!lobby) {
        return;
    }

    const player =
        getPlayerForSocket(
            ws,
            lobby
        );

    if (!player) {
        return;
    }

    /*
     * Prevent clients from sending ridiculous coordinates.
     */

    player.x =
        Math.max(
            -1000,
            Math.min(
                1000,
                Number(data.x) || 0
            )
        );

    player.y =
        Math.max(
            -50,
            Math.min(
                100,
                Number(data.y) || 0
            )
        );

    player.z =
        Math.max(
            -1000,
            Math.min(
                1000,
                Number(data.z) || 0
            )
        );

    player.yaw =
        Number(data.yaw) || 0;

    player.pitch =
        Math.max(
            -Math.PI / 2,
            Math.min(
                Math.PI / 2,
                Number(data.pitch) || 0
            )
        );

    if (
        typeof data.alive ===
        "boolean"
    ) {

        player.alive =
            data.alive;
    }

    broadcast(
        lobby,
        {
            type:
                "remote_player_state",

            player:
                serializePlayer(
                    player
                )
        },
        player.id
    );
}

/* ============================================================
   GAME EVENT
============================================================ */

function handleGameEvent(
    ws,
    data
) {

    const lobby =
        getLobbyForSocket(
            ws
        );

    if (!lobby) {
        return;
    }

    const player =
        getPlayerForSocket(
            ws,
            lobby
        );

    if (!player) {
        return;
    }

    switch (
        data.event
    ) {

        case "button-found":

            if (
                lobby.game.buttonsFound <
                3
            ) {

                lobby.game.buttonsFound++;
            }

            broadcast(
                lobby,
                {
                    type:
                        "game_state",
                    game:
                        lobby.game
                }
            );

            break;

        case "key-collected":

            if (
                lobby.game.buttonsFound >=
                3
            ) {

                lobby.game.keyCollected =
                    true;
            }

            broadcast(
                lobby,
                {
                    type:
                        "game_state",
                    game:
                        lobby.game
                }
            );

            break;

        case "gate-unlocked":

            if (
                lobby.game.keyCollected
            ) {

                lobby.game.gateUnlocked =
                    true;
            }

            broadcast(
                lobby,
                {
                    type:
                        "game_state",
                    game:
                        lobby.game
                }
            );

            break;

        case "seeker-awake":

            lobby.game.seekerAwake =
                true;

            broadcast(
                lobby,
                {
                    type:
                        "game_state",
                    game:
                        lobby.game
                }
            );

            break;

        case "escaped":

            player.alive =
                false;

            broadcast(
                lobby,
                {
                    type:
                        "player_escaped",

                    playerId:
                        player.id
                }
            );

            break;

        case "caught":

            player.alive =
                false;

            broadcast(
                lobby,
                {
                    type:
                        "player_caught",

                    playerId:
                        player.id
                }
            );

            break;

        default:

            break;
    }
}

/* ============================================================
   VOICE SIGNAL RELAY
============================================================ */

function handleVoiceSignal(
    ws,
    data
) {

    const lobby =
        getLobbyForSocket(
            ws
        );

    if (!lobby) {
        return;
    }

    const sender =
        getPlayerForSocket(
            ws,
            lobby
        );

    if (!sender) {
        return;
    }

    const targetId =
        cleanText(
            data.targetId,
            100,
            ""
        );

    if (!targetId) {
        return;
    }

    const targetSocket =
        lobby.playerSockets.get(
            targetId
        );

    if (!targetSocket) {
        return;
    }

    /*
     * This server forwards WebRTC signaling.
     * It does not carry the actual microphone audio.
     */

    send(
        targetSocket,
        {
            type:
                "voice_signal",

            fromId:
                sender.id,

            signal:
                data.signal || null
        }
    );
}

/* ============================================================
   PING / PONG
============================================================ */

function heartbeat() {

    for (
        const lobby
        of lobbies.values()
    ) {

        for (
            const player
            of lobby.players.values()
        ) {

            const ws =
                lobby.playerSockets.get(
                    player.id
                );

            if (!ws) {
                continue;
            }

            if (
                ws.isAlive ===
                false
            ) {

                try {
                    ws.terminate();
                } catch {}

                continue;
            }

            ws.isAlive =
                false;

            try {

                ws.ping();

            } catch {}
        }
    }
}

/* ============================================================
   HTTP SERVER
============================================================ */

const httpServer =
    http.createServer(
        (
            request,
            response
        ) => {

            response.writeHead(
                200,
                {
                    "Content-Type":
                        "text/plain; charset=utf-8",
                    "Cache-Control":
                        "no-store"
                }
            );

            response.end(
                "THE SEEKER multiplayer server is running.\n"
            );
        }
    );

/* ============================================================
   WEBSOCKET SERVER
============================================================ */

const wss =
    new WebSocket.Server({
        server:
            httpServer,

        maxPayload:
            256 * 1024
    });

/* ============================================================
   CONNECTION
============================================================ */

wss.on(
    "connection",
    ws => {

        ws.isAlive =
            true;

        ws.connectedAt =
            Date.now();

        ws.seekerPlayerId =
            null;

        ws.seekerLobbyCode =
            null;

        send(
            ws,
            {
                type:
                    "server_ready",

                server:
                    "THE SEEKER",

                version:
                    "1.0.0",

                maps:
                    [
                        "facility",
                        "basement",
                        "forest"
                    ]
            }
        );

        ws.on(
            "pong",
            () => {

                ws.isAlive =
                    true;
            }
        );

        ws.on(
            "message",
            raw => {

                if (
                    raw.length >
                    256 * 1024
                ) {

                    sendError(
                        ws,
                        "PACKET TOO LARGE"
                    );

                    return;
                }

                let data;

                try {

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                } catch {

                    sendError(
                        ws,
                        "INVALID JSON"
                    );

                    return;
                }

                if (
                    !data ||
                    typeof data.type !==
                    "string"
                ) {

                    sendError(
                        ws,
                        "INVALID PACKET"
                    );

                    return;
                }

                switch (
                    data.type
                ) {

                    case "create_lobby":

                        handleCreateLobby(
                            ws,
                            data
                        );

                        break;

                    case "join_lobby":

                        handleJoinLobby(
                            ws,
                            data
                        );

                        break;

                    case "start_game":

                        handleStartGame(
                            ws,
                            data
                        );

                        break;

                    case "leave_lobby":

                        removePlayerFromLobby(
                            ws,
                            "leave"
                        );

                        break;

                    case "player_state":

                        handlePlayerState(
                            ws,
                            data
                        );

                        break;

                    case "game_event":

                        handleGameEvent(
                            ws,
                            data
                        );

                        break;

                    case "voice_signal":

                        handleVoiceSignal(
                            ws,
                            data
                        );

                        break;

                    case "ping":

                        send(
                            ws,
                            {
                                type:
                                    "pong"
                            }
                        );

                        break;

                    case "lobby_state":

                        {

                            const lobby =
                                getLobbyForSocket(
                                    ws
                                );

                            if (lobby) {

                                send(
                                    ws,
                                    {
                                        type:
                                            "lobby_updated",

                                        lobby:
                                            serializeLobby(
                                                lobby
                                            )
                                    }
                                );
                            }
                        }

                        break;

                    default:

                        sendError(
                            ws,
                            `UNKNOWN MESSAGE TYPE: ${data.type}`
                        );

                        break;
                }
            }
        );

        ws.on(
            "close",
            () => {

                removePlayerFromLobby(
                    ws,
                    "disconnect"
                );
            }
        );

        ws.on(
            "error",
            () => {

                removePlayerFromLobby(
                    ws,
                    "socket-error"
                );
            }
        );
    }
);

/* ============================================================
   SERVER HEARTBEAT
============================================================ */

const heartbeatTimer =
    setInterval(
        heartbeat,
        HEARTBEAT_INTERVAL
    );

/* ============================================================
   REMOVE STALE LOBBIES
============================================================ */

const cleanupTimer =
    setInterval(
        () => {

            const current =
                Date.now();

            for (
                const [
                    code,
                    lobby
                ]
                of lobbies
            ) {

                if (
                    lobby.players.size ===
                    0
                ) {

                    lobbies.delete(
                        code
                    );

                    continue;
                }

                /*
                 * Waiting lobbies that sit unused for 30 minutes
                 * are automatically removed.
                 */

                if (
                    lobby.state ===
                    "waiting" &&
                    current -
                    lobby.createdAt >
                    30 *
                    60 *
                    1000
                ) {

                    broadcast(
                        lobby,
                        {
                            type:
                                "lobby_error",

                            message:
                                "LOBBY EXPIRED"
                        }
                    );

                    lobbies.delete(
                        code
                    );

                    continue;
                }

                /*
                 * Running games are retained until every player
                 * disconnects.
                 */
            }

        },
        60000
    );

/* ============================================================
   SERVER STATS
============================================================ */

function printStats() {

    let playerCount =
        0;

    for (
        const lobby
        of lobbies.values()
    ) {

        playerCount +=
            lobby.players.size;
    }

    console.log(
        `[SERVER] Lobbies: ${lobbies.size} | Players: ${playerCount}`
    );
}

const statsTimer =
    setInterval(
        printStats,
        60000
    );

/* ============================================================
   START
============================================================ */

httpServer.listen(
    PORT,
    HOST,
    () => {

        console.log(
            ""
        );

        console.log(
            "=============================================="
        );

        console.log(
            "        THE SEEKER MULTIPLAYER SERVER"
        );

        console.log(
            "        BLACKHOLLOW GAMES"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `HTTP : http://localhost:${PORT}`
        );

        console.log(
            `WS   : ws://localhost:${PORT}`
        );

        console.log(
            "Status: ONLINE"
        );

        console.log(
            "=============================================="
        );

        console.log(
            ""
        );
    }
);

/* ============================================================
   SHUTDOWN
============================================================ */

function shutdown(
    signal
) {

    console.log(
        `[SERVER] ${signal} received. Shutting down...`
    );

    clearInterval(
        heartbeatTimer
    );

    clearInterval(
        cleanupTimer
    );

    clearInterval(
        statsTimer
    );

    for (
        const lobby
        of lobbies.values()
    ) {

        broadcast(
            lobby,
            {
                type:
                    "server_shutdown",

                message:
                    "SERVER SHUTTING DOWN"
            }
        );
    }

    for (
        const client
        of wss.clients
    ) {

        try {

            client.close(
                1001,
                "Server shutdown"
            );

        } catch {}
    }

    wss.close(
        () => {

            httpServer.close(
                () => {

                    process.exit(
                        0
                    );
                }
            );
        }
    );
}

process.on(
    "SIGINT",
    () => {

        shutdown(
            "SIGINT"
        );
    }
);

process.on(
    "SIGTERM",
    () => {

        shutdown(
            "SIGTERM"
        );
    }
);

/* ============================================================
   UNHANDLED ERRORS
============================================================ */

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[SERVER] Uncaught exception:",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[SERVER] Unhandled rejection:",
            error
        );
    }
);