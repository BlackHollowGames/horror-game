/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   server.js
   ============================================================

   REAL MULTIPLAYER SERVER
   ------------------------------------------------------------
   Includes:

   • Real WebSocket networking
   • Real lobby creation
   • Real lobby joining
   • Host ownership
   • Host-only game start
   • Server-generated lobby codes
   • Player synchronization
   • Game-event synchronization
   • WebRTC voice signaling relay
   • Heartbeat / dead-connection cleanup
   • Rate limiting
   • Message validation
   • Lobby capacity protection
   • Map validation
   • Player-name sanitization
   • Host transfer when host leaves
   • Lobby cleanup
   • Reconnection/session support
   • HTTP server
   • Static game-file hosting
   • /health endpoint
   • /status endpoint
   • Graceful shutdown
   • Detailed server logging
   • No localStorage fake lobbies
   • No fake matchmaking
   • No fake "Start Game"
   • No duplicate lobby generation on JOIN
   • Works with the client protocol used by main.js

   REQUIREMENTS:

   Node.js
   npm install ws

   RUN:

   node server.js

   DEFAULT:

   http://localhost:8080
   ws://localhost:8080

   CUSTOM:

   PORT=8080 node server.js

   ============================================================ */

"use strict";


/* ============================================================
   IMPORTS
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");


/* ============================================================
   CONFIGURATION
   ============================================================ */

const CONFIG = {

    host:
        process.env.HOST ||
        "0.0.0.0",

    port:
        Number(
            process.env.PORT ||
            8080
        ),

    gameDirectory:
        path.resolve(
            process.env.GAME_DIR ||
            process.cwd()
        ),

    maxLobbyPlayers:
        4,

    lobbyCodeLength:
        6,

    maxLobbyNameLength:
        32,

    maxPlayerNameLength:
        20,

    maxMessageBytes:
        256 * 1024,

    playerStateInterval:
        50,

    gameEventInterval:
        40,

    voiceSignalInterval:
        30,

    lobbyIdleTimeout:
        1000 * 60 * 30,

    disconnectedPlayerTimeout:
        1000 * 45,

    heartbeatInterval:
        1000 * 15000,

    rateWindow:
        1000,

    rateLimit:
        80,

    connectionLimit:
        100,

    allowedMaps:
        new Set([
            "facility",
            "underground",
            "blackwood"
        ]),

    allowedGameEvents:
        new Set([
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
        ])

};


/* ============================================================
   SERVER STATE
   ============================================================ */

const state = {

    startedAt:
        Date.now(),

    totalConnections:
        0,

    activeConnections:
        0,

    totalLobbiesCreated:
        0,

    totalGamesStarted:
        0,

    messagesReceived:
        0,

    messagesSent:
        0,

    lobbies:
        new Map(),

    clients:
        new Set(),

    sessions:
        new Map()

};


/* ============================================================
   UTILITY HELPERS
   ============================================================ */

function now() {
    return Date.now();
}


function makeId(prefix = "id") {
    return (
        prefix +
        "-" +
        crypto
            .randomBytes(8)
            .toString("hex")
    );
}


function makeSessionToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}


function clamp(
    value,
    min,
    max
) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return min;
    }

    return Math.max(
        min,
        Math.min(
            max,
            number
        )
    );
}


function cleanString(
    value,
    fallback,
    maximum
) {

    if (
        typeof value !==
        "string"
    ) {
        return fallback;
    }

    const cleaned =
        value
            .replace(
                /[\u0000-\u001F\u007F]/g,
                ""
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    if (!cleaned) {
        return fallback;
    }

    return cleaned.slice(
        0,
        maximum
    );
}


function cleanLobbyName(
    value
) {

    return cleanString(
        value,
        "The Seeker Lobby",
        CONFIG.maxLobbyNameLength
    );

}


function cleanPlayerName(
    value
) {

    return cleanString(
        value,
        "Player",
        CONFIG.maxPlayerNameLength
    );

}


function normalizeCode(
    value
) {

    if (
        typeof value !==
        "string"
    ) {
        return "";
    }

    return value
        .replace(
            /[^A-Za-z0-9]/g,
            ""
        )
        .toUpperCase()
        .slice(
            0,
            12
        );

}


function validMap(
    value
) {

    return CONFIG.allowedMaps.has(
        value
    );

}


function validEvent(
    value
) {

    return (
        typeof value ===
            "string" &&
        CONFIG.allowedGameEvents.has(
            value
        )
    );

}


function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


function randomLobbyCode() {

    /*
     * Ambiguous characters are removed so codes are
     * easier to read over voice chat.
     */

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (
        let attempt = 0;
        attempt < 200;
        attempt++
    ) {

        let code = "";

        for (
            let i = 0;
            i <
            CONFIG.lobbyCodeLength;
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

        if (
            !state.lobbies.has(
                code
            )
        ) {
            return code;
        }

    }

    throw new Error(
        "Could not generate a unique lobby code."
    );
}


/* ============================================================
   RATE LIMITER
   ============================================================ */

class RateLimiter {

    constructor() {

        this.records =
            new WeakMap();

    }


    allowed(
        client
    ) {

        const timestamp =
            now();

        let record =
            this.records.get(
                client
            );

        if (!record) {

            record = {
                started:
                    timestamp,

                count:
                    0
            };

            this.records.set(
                client,
                record
            );

        }


        if (
            timestamp -
                record.started >=
            CONFIG.rateWindow
        ) {

            record.started =
                timestamp;

            record.count =
                0;

        }


        record.count++;

        return (
            record.count <=
            CONFIG.rateLimit
        );

    }


    clear(
        client
    ) {

        this.records.delete(
            client
        );

    }

}


const rateLimiter =
    new RateLimiter();


/* ============================================================
   LOBBY CLASS
   ============================================================ */

class Lobby {

    constructor({
        name,
        map,
        maxPlayers,
        hostClient
    }) {

        this.code =
            randomLobbyCode();

        this.name =
            cleanLobbyName(
                name
            );

        this.map =
            validMap(map)
                ? map
                : "facility";

        this.maxPlayers =
            clamp(
                maxPlayers,
                1,
                CONFIG.maxLobbyPlayers
            );

        this.hostId =
            hostClient.id;

        this.createdAt =
            now();

        this.lastActivityAt =
            now();

        this.started =
            false;

        this.startedAt =
            null;

        this.players =
            new Map();

        this.gameState = {

            started:
                false,

            map:
                this.map,

            startedAt:
                null,

            eventSequence:
                0,

            buttonsFound:
                new Set(),

            keyCollected:
                false,

            gateUnlocked:
                false

        };

        this.addPlayer(
            hostClient
        );

        state.lobbies.set(
            this.code,
            this
        );

        state.totalLobbiesCreated++;

    }


    addPlayer(
        client
    ) {

        this.players.set(
            client.id,
            {
                id:
                    client.id,

                name:
                    client.playerName ||
                    "Player",

                client,

                connected:
                    true,

                joinedAt:
                    now(),

                lastStateAt:
                    0,

                state:
                    {
                        x: 0,
                        y: 1.65,
                        z: 0,
                        yaw: 0,
                        pitch: 0
                    }
            }
        );

        client.lobbyCode =
            this.code;

        client.inLobby =
            true;

        this.touch();

    }


    removePlayer(
        clientId
    ) {

        const player =
            this.players.get(
                clientId
            );

        if (!player) {
            return null;
        }

        this.players.delete(
            clientId
        );

        this.touch();

        return player;

    }


    getPlayer(
        clientId
    ) {

        return this.players.get(
            clientId
        );

    }


    getHost() {

        return this.players.get(
            this.hostId
        );

    }


    chooseNewHost() {

        const players =
            Array.from(
                this.players.values()
            );

        if (
            players.length ===
            0
        ) {

            this.hostId =
                null;

            return null;

        }

        players.sort(
            (
                a,
                b
            ) =>
                a.joinedAt -
                b.joinedAt
        );

        this.hostId =
            players[0].id;

        return players[0];

    }


    touch() {

        this.lastActivityAt =
            now();

    }


    shouldExpire() {

        if (
            this.players.size ===
            0
        ) {
            return true;
        }

        if (
            this.started
        ) {

            return (
                this.players.size ===
                    0
            );

        }

        return (
            now() -
                this.lastActivityAt >
            CONFIG.lobbyIdleTimeout
        );

    }


    publicPlayers() {

        return Array.from(
            this.players.values()
        ).map(
            (
                player
            ) => ({

                id:
                    player.id,

                name:
                    player.name

            })
        );

    }


    serialize(
        localPlayerId = null
    ) {

        return {

            code:
                this.code,

            lobbyName:
                this.name,

            name:
                this.name,

            map:
                this.map,

            maxPlayers:
                this.maxPlayers,

            hostId:
                this.hostId,

            host:
                this.hostId,

            started:
                this.started,

            startedAt:
                this.startedAt,

            localPlayerId,

            players:
                this.publicPlayers()

        };

    }

}


/* ============================================================
   CLIENT CLASS
   ============================================================ */

class Client {

    constructor(
        socket,
        request
    ) {

        this.socket =
            socket;

        this.id =
            makeId(
                "player"
            );

        this.playerName =
            "Player";

        this.lobbyCode =
            null;

        this.inLobby =
            false;

        this.isAlive =
            true;

        this.connectedAt =
            now();

        this.lastSeen =
            now();

        this.lastPlayerStateAt =
            0;

        this.lastGameEventAt =
            0;

        this.lastVoiceSignalAt =
            0;

        this.pendingClose =
            false;

        this.ip =
            getRemoteAddress(
                request
            );

        this.sessionToken =
            makeSessionToken();

        this.messageCount =
            0;

        this.messageWindowStart =
            now();

    }


    send(
        payload
    ) {

        if (
            !this.socket ||
            this.socket.readyState !==
                WebSocket.OPEN
        ) {
            return false;
        }

        try {

            const serialized =
                JSON.stringify(
                    payload
                );

            this.socket.send(
                serialized
            );

            state.messagesSent++;

            return true;

        } catch (error) {

            console.error(
                "[WS SEND ERROR]",
                error
            );

            return false;

        }

    }


    close(
        code = 1000,
        reason = "Closed"
    ) {

        if (
            this.pendingClose
        ) {
            return;
        }

        this.pendingClose =
            true;

        try {

            this.socket.close(
                code,
                String(reason)
                    .slice(
                        0,
                        123
                    )
            );

        } catch (_) {}

    }

}


/* ============================================================
   HTTP SERVER
   ============================================================ */

const httpServer =
    http.createServer(
        handleHttpRequest
    );


/* ============================================================
   WEBSOCKET SERVER
   ============================================================ */

const websocketServer =
    new WebSocket.Server({
        server:
            httpServer,

        maxPayload:
            CONFIG.maxMessageBytes,

        clientTracking:
            false,

        perMessageDeflate:
            true
    });


/* ============================================================
   HTTP
   ============================================================ */

function getRemoteAddress(
    request
) {

    if (
        !request
    ) {
        return "unknown";
    }

    const forwarded =
        request.headers[
            "x-forwarded-for"
        ];

    if (
        typeof forwarded ===
        "string"
    ) {

        return forwarded
            .split(",")[0]
            .trim();

    }

    return (
        request.socket?.remoteAddress ||
        "unknown"
    );

}


function mimeType(
    filePath
) {

    const extension =
        path.extname(
            filePath
        ).toLowerCase();

    const map = {

        ".html":
            "text/html; charset=utf-8",

        ".css":
            "text/css; charset=utf-8",

        ".js":
            "text/javascript; charset=utf-8",

        ".json":
            "application/json; charset=utf-8",

        ".svg":
            "image/svg+xml",

        ".png":
            "image/png",

        ".jpg":
            "image/jpeg",

        ".jpeg":
            "image/jpeg",

        ".webp":
            "image/webp",

        ".ico":
            "image/x-icon",

        ".mp3":
            "audio/mpeg",

        ".wav":
            "audio/wav",

        ".ogg":
            "audio/ogg",

        ".mp4":
            "video/mp4",

        ".webm":
            "video/webm"

    };

    return (
        map[extension] ||
        "application/octet-stream"
    );

}


function safeStaticPath(
    urlPath
) {

    let pathname;

    try {

        pathname =
            decodeURIComponent(
                urlPath
            );

    } catch (_) {

        return null;

    }


    pathname =
        pathname.split("?")[0];


    pathname =
        pathname.split("#")[0];


    if (
        pathname ===
        "/"
    ) {
        pathname =
            "/index.html";
    }


    pathname =
        pathname.replace(
            /^\/+/,
            ""
        );


    const target =
        path.resolve(
            CONFIG.gameDirectory,
            pathname
        );


    if (
        !target.startsWith(
            CONFIG.gameDirectory +
            path.sep
        ) &&
        target !==
            CONFIG.gameDirectory
    ) {

        return null;

    }


    return target;

}


function sendJson(
    response,
    status,
    data
) {

    const body =
        JSON.stringify(
            data,
            null,
            2
        );

    response.writeHead(
        status,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Content-Length":
                Buffer.byteLength(
                    body
                ),

            "Cache-Control":
                "no-store",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Headers":
                "Content-Type",

            "Access-Control-Allow-Methods":
                "GET,HEAD,OPTIONS"
        }
    );

    response.end(
        body
    );

}


function handleHttpRequest(
    request,
    response
) {

    const pathname =
        request.url || "/";

    if (
        request.method ===
        "OPTIONS"
    ) {

        response.writeHead(
            204,
            {
                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Headers":
                    "Content-Type",

                "Access-Control-Allow-Methods":
                    "GET,HEAD,OPTIONS"
            }
        );

        response.end();

        return;

    }


    if (
        pathname ===
        "/health"
    ) {

        sendJson(
            response,
            200,
            buildHealthStatus()
        );

        return;

    }


    if (
        pathname ===
        "/status"
    ) {

        sendJson(
            response,
            200,
            buildServerStatus()
        );

        return;

    }


    if (
        pathname ===
        "/api/lobbies"
    ) {

        sendJson(
            response,
            200,
            {
                lobbies:
                    Array.from(
                        state.lobbies.values()
                    )
                        .filter(
                            lobby =>
                                !lobby.started
                        )
                        .map(
                            lobby => ({
                                code:
                                    lobby.code,

                                name:
                                    lobby.name,

                                map:
                                    lobby.map,

                                players:
                                    lobby.players.size,

                                maxPlayers:
                                    lobby.maxPlayers
                            })
                        )
            }
        );

        return;

    }


    if (
        request.method !==
            "GET" &&
        request.method !==
            "HEAD"
    ) {

        sendJson(
            response,
            405,
            {
                error:
                    "Method not allowed."
            }
        );

        return;

    }


    const filePath =
        safeStaticPath(
            pathname
        );

    if (!filePath) {

        sendJson(
            response,
            400,
            {
                error:
                    "Invalid path."
            }
        );

        return;

    }


    fs.stat(
        filePath,
        (
            error,
            stats
        ) => {

            if (
                error ||
                !stats.isFile()
            ) {

                response.writeHead(
                    404,
                    {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                );

                response.end(
                    "THE SEEKER file not found."
                );

                return;

            }


            const headers = {

                "Content-Type":
                    mimeType(
                        filePath
                    ),

                "Cache-Control":
                    "no-cache",

                "X-Content-Type-Options":
                    "nosniff",

                "Cross-Origin-Resource-Policy":
                    "cross-origin",

                "Access-Control-Allow-Origin":
                    "*"

            };


            if (
                request.method ===
                "HEAD"
            ) {

                response.writeHead(
                    200,
                    headers
                );

                response.end();

                return;

            }


            const stream =
                fs.createReadStream(
                    filePath
                );

            stream.on(
                "error",
                () => {

                    if (
                        !response.headersSent
                    ) {

                        response.writeHead(
                            500
                        );

                    }

                    response.end();

                }
            );

            response.writeHead(
                200,
                headers
            );

            stream.pipe(
                response
            );

        }
    );

}


/* ============================================================
   WEBSOCKET CONNECTION
   ============================================================ */

websocketServer.on(
    "connection",
    (
        socket,
        request
    ) => {

        if (
            state.activeConnections >=
            CONFIG.connectionLimit
        ) {

            socket.close(
                1013,
                "Server busy."
            );

            return;

        }


        const client =
            new Client(
                socket,
                request
            );


        state.clients.add(
            client
        );

        state.totalConnections++;

        state.activeConnections++;


        console.log(
            `[CONNECT] ${client.id} ${client.ip}`
        );


        socket.isAlive =
            true;


        socket.on(
            "pong",
            () => {

                socket.isAlive =
                    true;

                client.isAlive =
                    true;

                client.lastSeen =
                    now();

            }
        );


        socket.on(
            "message",
            (data) => {

                handleClientMessage(
                    client,
                    data
                );

            }
        );


        socket.on(
            "close",
            (
                code,
                reason
            ) => {

                handleClientDisconnect(
                    client,
                    code,
                    reason
                );

            }
        );


        socket.on(
            "error",
            (error) => {

                console.error(
                    `[SOCKET ERROR] ${client.id}`,
                    error.message
                );

            }
        );


        client.send({

            type:
                "connected",

            playerId:
                client.id,

            sessionToken:
                client.sessionToken,

            serverTime:
                now(),

            protocol:
                "the-seeker-v2",

            maxLobbyPlayers:
                CONFIG.maxLobbyPlayers,

            maps:
                Array.from(
                    CONFIG.allowedMaps
                )

        });

    }
);


/* ============================================================
   MESSAGE HANDLING
   ============================================================ */

function handleClientMessage(
    client,
    raw
) {

    state.messagesReceived++;

    client.lastSeen =
        now();

    if (
        !rateLimiter.allowed(
            client
        )
    ) {

        client.send({

            type:
                "error",

            code:
                "RATE_LIMITED",

            message:
                "Too many requests."

        });

        return;

    }


    let message;


    try {

        const text =
            Buffer
                .from(raw)
                .toString(
                    "utf8"
                );

        if (
            text.length >
            CONFIG.maxMessageBytes
        ) {

            throw new Error(
                "Message too large."
            );

        }

        message =
            JSON.parse(
                text
            );

    } catch (error) {

        client.send({

            type:
                "error",

            code:
                "INVALID_JSON",

            message:
                "Invalid message."

        });

        return;

    }


    if (
        !message ||
        typeof message !==
            "object" ||
        Array.isArray(message)
    ) {

        sendError(
            client,
            "INVALID_MESSAGE",
            "Invalid message object."
        );

        return;

    }


    client.messageCount++;


    const type =
        typeof message.type ===
            "string"
            ? message.type
            : "";


    switch (
        type
    ) {

        case "create_lobby":
            handleCreateLobby(
                client,
                message
            );
            break;

        case "join_lobby":
            handleJoinLobby(
                client,
                message
            );
            break;

        case "leave_lobby":
            handleLeaveLobby(
                client,
                message
            );
            break;

        case "start_game":
            handleStartGame(
                client,
                message
            );
            break;

        case "player_state":
            handlePlayerState(
                client,
                message
            );
            break;

        case "game_event":
            handleGameEvent(
                client,
                message
            );
            break;

        case "voice_signal":
            handleVoiceSignal(
                client,
                message
            );
            break;

        case "ping":
            client.send({
                type:
                    "pong",
                serverTime:
                    now()
            });
            break;

        case "reconnect":
            handleReconnect(
                client,
                message
            );
            break;

        default:
            sendError(
                client,
                "UNKNOWN_MESSAGE",
                "Unknown message type."
            );

    }

}


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function handleCreateLobby(
    client,
    message
) {

    if (
        client.inLobby
    ) {

        sendError(
            client,
            "ALREADY_IN_LOBBY",
            "You are already in a lobby."
        );

        return;

    }


    if (
        state.lobbies.size >=
        1000
    ) {

        sendError(
            client,
            "LOBBY_CAPACITY",
            "The lobby server is full."
        );

        return;

    }


    const lobbyName =
        cleanLobbyName(
            message.lobbyName
        );

    const playerName =
        cleanPlayerName(
            message.playerName
        );

    const map =
        validMap(
            message.map
        )
            ? message.map
            : "facility";

    let requestedMax =
        Number(
            message.maxPlayers
        );

    if (
        !Number.isFinite(
            requestedMax
        )
    ) {
        requestedMax =
            4;
    }


    requestedMax =
        clamp(
            requestedMax,
            1,
            CONFIG.maxLobbyPlayers
        );


    client.playerName =
        playerName;


    let lobby;

    try {

        lobby =
            new Lobby({
                name:
                    lobbyName,

                map:
                    map,

                maxPlayers:
                    requestedMax,

                hostClient:
                    client
            });

    } catch (error) {

        console.error(
            "[LOBBY CREATE ERROR]",
            error
        );

        sendError(
            client,
            "LOBBY_CREATE_FAILED",
            "Could not create lobby."
        );

        return;

    }


    state.sessions.set(
        client.sessionToken,
        {
            clientId:
                client.id,

            playerName:
                client.playerName,

            lobbyCode:
                lobby.code,

            createdAt:
                now()
        }
    );


    console.log(
        `[LOBBY CREATE] ${lobby.code} by ${client.id}`
    );


    client.send({

        type:
            "lobby_created",

        code:
            lobby.code,

        playerId:
            client.id,

        lobby:
            lobby.serialize(
                client.id
            ),

        map:
            lobby.map

    });


    broadcastLobby(
        lobby
    );

}


/* ============================================================
   JOIN LOBBY
   ============================================================ */

function handleJoinLobby(
    client,
    message
) {

    if (
        client.inLobby
    ) {

        sendError(
            client,
            "ALREADY_IN_LOBBY",
            "You are already in a lobby."
        );

        return;

    }


    const code =
        normalizeCode(
            message.code
        );

    const lobby =
        state.lobbies.get(
            code
        );


    /*
     * IMPORTANT:
     *
     * JOIN NEVER CREATES A LOBBY.
     *
     * If the supplied code does not exist,
     * the server returns an error instead.
     */

    if (!lobby) {

        sendError(
            client,
            "LOBBY_NOT_FOUND",
            "Lobby not found. Check the code and try again."
        );

        return;

    }


    if (
        lobby.started
    ) {

        sendError(
            client,
            "GAME_ALREADY_STARTED",
            "That lobby has already started."
        );

        return;

    }


    if (
        lobby.players.size >=
        lobby.maxPlayers
    ) {

        sendError(
            client,
            "LOBBY_FULL",
            "That lobby is full."
        );

        return;

    }


    const playerName =
        cleanPlayerName(
            message.playerName
        );


    client.playerName =
        playerName;


    lobby.addPlayer(
        client
    );


    state.sessions.set(
        client.sessionToken,
        {
            clientId:
                client.id,

            playerName:
                client.playerName,

            lobbyCode:
                lobby.code,

            createdAt:
                now()
        }
    );


    console.log(
        `[LOBBY JOIN] ${client.id} -> ${lobby.code}`
    );


    client.send({

        type:
            "lobby_joined",

        code:
            lobby.code,

        playerId:
            client.id,

        lobby:
            lobby.serialize(
                client.id
            ),

        map:
            lobby.map

    });


    broadcast(
        lobby,
        {
            type:
                "player_joined",

            player: {
                id:
                    client.id,

                name:
                    client.playerName
            },

            playerId:
                client.id,

            lobby:
                lobby.serialize()

        },
        client
    );


    broadcastLobby(
        lobby
    );

}


/* ============================================================
   LEAVE
   ============================================================ */

function handleLeaveLobby(
    client,
    message
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {

        sendError(
            client,
            "NOT_IN_LOBBY",
            "You are not in a lobby."
        );

        return;

    }


    const suppliedCode =
        normalizeCode(
            message.code
        );


    if (
        suppliedCode &&
        suppliedCode !==
            lobby.code
    ) {

        sendError(
            client,
            "INVALID_LOBBY",
            "Lobby code does not match."
        );

        return;

    }


    removeClientFromLobby(
        client,
        {
            explicit:
                true
        }
    );

}


/* ============================================================
   START GAME
   ============================================================ */

function handleStartGame(
    client,
    message
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {

        sendError(
            client,
            "NOT_IN_LOBBY",
            "You are not in a lobby."
        );

        return;

    }


    if (
        client.id !==
        lobby.hostId
    ) {

        sendError(
            client,
            "NOT_HOST",
            "Only the host can start the game."
        );

        return;

    }


    if (
        lobby.started
    ) {

        sendError(
            client,
            "ALREADY_STARTED",
            "The game has already started."
        );

        return;

    }


    const requestedMap =
        validMap(
            message.map
        )
            ? message.map
            : lobby.map;


    lobby.map =
        requestedMap;


    lobby.started =
        true;

    lobby.startedAt =
        now();

    lobby.touch();


    lobby.gameState =
        {

            started:
                true,

            map:
                lobby.map,

            startedAt:
                lobby.startedAt,

            eventSequence:
                0,

            buttonsFound:
                new Set(),

            keyCollected:
                false,

            gateUnlocked:
                false

        };


    state.totalGamesStarted++;


    console.log(
        `[GAME START] ${lobby.code} map=${lobby.map}`
    );


    /*
     * Everyone receives the SAME authoritative
     * game-start command from the server.
     */

    broadcast(
        lobby,
        {

            type:
                "game_started",

            code:
                lobby.code,

            map:
                lobby.map,

            startedAt:
                lobby.startedAt,

            players:
                lobby.publicPlayers()

        }
    );


    broadcastLobby(
        lobby
    );

}


/* ============================================================
   PLAYER STATE
   ============================================================ */

function handlePlayerState(
    client,
    message
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {
        return;
    }


    const player =
        lobby.getPlayer(
            client.id
        );

    if (!player) {
        return;
    }


    const timestamp =
        now();


    if (
        timestamp -
            client.lastPlayerStateAt <
        CONFIG.playerStateInterval
    ) {
        return;
    }


    client.lastPlayerStateAt =
        timestamp;


    /*
     * Keep coordinates bounded so one bad client cannot
     * send absurd values into every other client.
     */

    const x =
        clamp(
            message.x,
            -1000,
            1000
        );

    const y =
        clamp(
            message.y,
            -100,
            100
        );

    const z =
        clamp(
            message.z,
            -1000,
            1000
        );

    const yaw =
        clamp(
            message.yaw,
            -Math.PI * 100,
            Math.PI * 100
        );

    const pitch =
        clamp(
            message.pitch,
            -Math.PI,
            Math.PI
        );


    player.state =
        {
            x,
            y,
            z,
            yaw,
            pitch
        };

    player.lastStateAt =
        timestamp;


    lobby.touch();


    /*
     * Send the state to every OTHER client.
     *
     * The sender already knows their own state,
     * so echoing it back wastes bandwidth.
     */

    broadcast(
        lobby,
        {

            type:
                "player_state",

            playerId:
                client.id,

            name:
                player.name,

            x,
            y,
            z,
            yaw,
            pitch,

            timestamp:
                timestamp

        },
        client
    );

}


/* ============================================================
   GAME EVENTS
   ============================================================ */

function handleGameEvent(
    client,
    message
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {
        return;
    }


    if (
        !lobby.started
    ) {
        return;
    }


    const timestamp =
        now();


    if (
        timestamp -
            client.lastGameEventAt <
        CONFIG.gameEventInterval
    ) {
        return;
    }


    const eventName =
        typeof message.event ===
        "string"
            ? message.event
            : "";


    /*
     * Custom events are allowed only through the
     * explicit "custom" event name.
     */

    if (
        !validEvent(
            eventName
        )
    ) {

        sendError(
            client,
            "INVALID_GAME_EVENT",
            "Unsupported game event."
        );

        return;

    }


    client.lastGameEventAt =
        timestamp;


    const data =
        sanitizeGameEventData(
            message.data
        );


    /*
     * Update lightweight authoritative progression state.
     * The actual 3D simulation still happens on the clients,
     * while important shared progression is recorded here.
     */

    applyAuthoritativeGameEvent(
        lobby,
        eventName,
        data
    );


    lobby.gameState.eventSequence++;


    const eventPacket = {

        type:
            "game_event",

        code:
            lobby.code,

        playerId:
            client.id,

        playerName:
            client.playerName,

        event:
            eventName,

        data,

        sequence:
            lobby.gameState.eventSequence,

        timestamp:
            timestamp

    };


    broadcast(
        lobby,
        eventPacket,
        client
    );


    lobby.touch();

}


/* ============================================================
   AUTHORITATIVE EVENT TRACKING
   ============================================================ */

function applyAuthoritativeGameEvent(
    lobby,
    eventName,
    data
) {

    if (
        !lobby ||
        !lobby.gameState
    ) {
        return;
    }


    switch (
        eventName
    ) {

        case "button":
        case "button-found": {

            const id =
                String(
                    data?.id ??
                    ""
                );

            if (id) {

                lobby
                    .gameState
                    .buttonsFound
                    .add(
                        id
                    );

            }

            break;
        }


        case "key":
        case "key-collected":

            lobby
                .gameState
                .keyCollected =
                true;

            break;


        case "gate":
        case "gate-unlocked":

            lobby
                .gameState
                .gateUnlocked =
                true;

            break;


        default:
            break;

    }

}


/* ============================================================
   GAME EVENT DATA SANITIZER
   ============================================================ */

function sanitizeGameEventData(
    input
) {

    if (
        input === null ||
        input === undefined
    ) {
        return {};
    }


    if (
        typeof input !==
        "object"
    ) {

        return {
            value:
                String(
                    input
                ).slice(
                    0,
                    256
                )
        };

    }


    if (
        Array.isArray(
            input
        )
    ) {

        return input
            .slice(
                0,
                20
            )
            .map(
                value =>
                    sanitizeValue(
                        value
                    )
            );

    }


    const output = {};


    for (
        const [
            key,
            value
        ]
        of Object.entries(
            input
        ).slice(
            0,
            30
        )
    ) {

        const safeKey =
            String(
                key
            )
                .replace(
                    /[^A-Za-z0-9_.-]/g,
                    ""
                )
                .slice(
                    0,
                    50
                );

        if (!safeKey) {
            continue;
        }

        output[safeKey] =
            sanitizeValue(
                value
            );

    }


    return output;

}


function sanitizeValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }


    if (
        typeof value ===
        "number"
    ) {

        return Number.isFinite(
            value
        )
            ? clamp(
                value,
                -1000000,
                1000000
            )
            : 0;

    }


    if (
        typeof value ===
        "boolean"
    ) {
        return value;
    }


    if (
        typeof value ===
        "string"
    ) {

        return value
            .replace(
                /[\u0000-\u001F\u007F]/g,
                ""
            )
            .slice(
                0,
                512
            );

    }


    if (
        Array.isArray(
            value
        )
    ) {

        return value
            .slice(
                0,
                20
            )
            .map(
                item =>
                    sanitizeValue(
                        item
                    )
            );

    }


    if (
        typeof value ===
        "object"
    ) {

        return sanitizeGameEventData(
            value
        );

    }


    return String(
        value
    ).slice(
        0,
        512
    );

}


/* ============================================================
   VOICE SIGNALING
   ============================================================ */

function handleVoiceSignal(
    client,
    message
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {
        return;
    }


    if (
        !lobby.players.has(
            client.id
        )
    ) {
        return;
    }


    const timestamp =
        now();


    if (
        timestamp -
            client.lastVoiceSignalAt <
        CONFIG.voiceSignalInterval
    ) {
        return;
    }


    client.lastVoiceSignalAt =
        timestamp;


    const target =
        typeof message.target ===
        "string"
            ? message.target
            : "";


    if (
        !target
    ) {

        sendError(
            client,
            "VOICE_TARGET_REQUIRED",
            "Voice signaling requires a target player."
        );

        return;

    }


    if (
        target ===
        client.id
    ) {

        return;

    }


    const targetPlayer =
        lobby.getPlayer(
            target
        );


    if (
        !targetPlayer ||
        !targetPlayer.client
    ) {

        sendError(
            client,
            "VOICE_TARGET_NOT_FOUND",
            "Voice target is not in the lobby."
        );

        return;

    }


    const signal =
        sanitizeSignal(
            message.signal
        );


    targetPlayer.client.send({

        type:
            "voice_signal",

        code:
            lobby.code,

        playerId:
            client.id,

        target:
            target,

        signal

    });

}


/* ============================================================
   WEBRTC SIGNAL SANITIZER
   ============================================================ */

function sanitizeSignal(
    signal
) {

    if (
        signal === null ||
        signal === undefined
    ) {
        return null;
    }


    if (
        typeof signal !==
        "object"
    ) {

        return String(
            signal
        ).slice(
            0,
            10000
        );

    }


    const result =
        Array.isArray(
            signal
        )
            ? []
            : {};


    const entries =
        Object.entries(
            signal
        ).slice(
            0,
            50
        );


    for (
        const [
            key,
            value
        ]
        of entries
    ) {

        const safeKey =
            String(
                key
            )
                .replace(
                    /[^A-Za-z0-9_.-]/g,
                    ""
                )
                .slice(
                    0,
                    80
                );

        if (!safeKey) {
            continue;
        }


        if (
            typeof value ===
            "string"
        ) {

            result[safeKey] =
                value.slice(
                    0,
                    16000
                );

        } else if (
            typeof value ===
            "number"
        ) {

            result[safeKey] =
                Number.isFinite(
                    value
                )
                    ? value
                    : 0;

        } else if (
            typeof value ===
            "boolean"
        ) {

            result[safeKey] =
                value;

        } else if (
            value &&
            typeof value ===
            "object"
        ) {

            result[safeKey] =
                sanitizeSignal(
                    value
                );

        }

    }


    return result;

}


/* ============================================================
   RECONNECTION
   ============================================================ */

function handleReconnect(
    client,
    message
) {

    const token =
        typeof message.sessionToken ===
        "string"
            ? message.sessionToken
            : "";


    if (!token) {

        sendError(
            client,
            "SESSION_REQUIRED",
            "A session token is required."
        );

        return;

    }


    const session =
        state.sessions.get(
            token
        );


    if (!session) {

        sendError(
            client,
            "SESSION_NOT_FOUND",
            "Session expired or was not found."
        );

        return;

    }


    const lobby =
        state.lobbies.get(
            session.lobbyCode
        );


    if (!lobby) {

        sendError(
            client,
            "LOBBY_NOT_FOUND",
            "The previous lobby no longer exists."
        );

        state.sessions.delete(
            token
        );

        return;

    }


    const oldPlayer =
        lobby.getPlayer(
            session.clientId
        );


    if (!oldPlayer) {

        sendError(
            client,
            "PLAYER_NOT_FOUND",
            "Your previous player session no longer exists."
        );

        return;

    }


    /*
     * Replace the old socket while preserving the
     * original player ID and lobby ownership.
     */

    const oldClient =
        oldPlayer.client;


    client.id =
        oldPlayer.id;

    client.playerName =
        oldPlayer.name;

    client.lobbyCode =
        lobby.code;

    client.inLobby =
        true;

    client.sessionToken =
        token;


    oldPlayer.client =
        client;

    oldPlayer.connected =
        true;

    oldPlayer.lastStateAt =
        now();


    if (
        oldClient &&
        oldClient !== client &&
        oldClient.socket
    ) {

        try {

            oldClient.socket.close(
                4000,
                "Reconnected"
            );

        } catch (_) {}

    }


    state.sessions.set(
        token,
        {
            clientId:
                client.id,

            playerName:
                client.playerName,

            lobbyCode:
                lobby.code,

            createdAt:
                session.createdAt,

            reconnectedAt:
                now()
        }
    );


    client.send({

        type:
            "lobby_joined",

        code:
            lobby.code,

        playerId:
            client.id,

        lobby:
            lobby.serialize(
                client.id
            ),

        map:
            lobby.map,

        reconnected:
            true

    });


    broadcastLobby(
        lobby
    );


    console.log(
        `[RECONNECT] ${client.id} -> ${lobby.code}`
    );

}


/* ============================================================
   DISCONNECT
   ============================================================ */

function handleClientDisconnect(
    client,
    code,
    reason
) {

    if (
        !state.clients.has(
            client
        )
    ) {
        return;
    }


    state.clients.delete(
        client
    );

    rateLimiter.clear(
        client
    );

    state.activeConnections =
        Math.max(
            0,
            state.activeConnections -
                1
        );


    client.isAlive =
        false;


    const lobby =
        getClientLobby(
            client
        );


    if (lobby) {

        const player =
            lobby.getPlayer(
                client.id
            );


        if (player) {

            /*
             * Keep the session for a short period so
             * temporary connection drops can reconnect.
             */

            player.connected =
                false;

            player.disconnectedAt =
                now();

            player.client =
                null;

            state.sessions.set(
                client.sessionToken,
                {
                    clientId:
                        client.id,

                    playerName:
                        player.name,

                    lobbyCode:
                        lobby.code,

                    createdAt:
                        now(),

                    disconnectedAt:
                        now()
                }
            );


            /*
             * Do NOT immediately delete the player from
             * the lobby. This allows reconnecting.
             */

            broadcast(
                lobby,
                {

                    type:
                        "player_disconnected",

                    playerId:
                        client.id,

                    name:
                        player.name,

                    lobby:
                        lobby.serialize()

                }
            );


            /*
             * If the host disconnects, move host ownership
             * to the oldest connected player immediately.
             */

            if (
                lobby.hostId ===
                    client.id
            ) {

                const newHost =
                    lobby.chooseNewHost();

                if (
                    newHost
                ) {

                    broadcast(
                        lobby,
                        {

                            type:
                                "host_changed",

                            hostId:
                                lobby.hostId,

                            player:
                                {
                                    id:
                                        newHost.id,

                                    name:
                                        newHost.name
                                }

                        }
                    );

                }

            }


            broadcastLobby(
                lobby
            );

        }

    }


    console.log(
        `[DISCONNECT] ${client.id} code=${code} reason=${String(reason || "")}`
    );

}


/* ============================================================
   REMOVE CLIENT FROM LOBBY
   ============================================================ */

function removeClientFromLobby(
    client,
    {
        explicit = false
    } = {}
) {

    const lobby =
        getClientLobby(
            client
        );

    if (!lobby) {
        return;
    }


    const player =
        lobby.removePlayer(
            client.id
        );


    client.inLobby =
        false;

    client.lobbyCode =
        null;


    if (!player) {
        return;
    }


    state.sessions.forEach(
        (
            session,
            token
        ) => {

            if (
                session.clientId ===
                    client.id &&
                session.lobbyCode ===
                    lobby.code
            ) {

                state.sessions.delete(
                    token
                );

            }

        }
    );


    broadcast(
        lobby,
        {

            type:
                "player_left",

            playerId:
                client.id,

            name:
                player.name,

            explicit,

            lobby:
                lobby.serialize()

        }
    );


    if (
        lobby.hostId ===
        client.id
    ) {

        const newHost =
            lobby.chooseNewHost();

        if (
            newHost
        ) {

            broadcast(
                lobby,
                {

                    type:
                        "host_changed",

                    hostId:
                        lobby.hostId,

                    player:
                        {
                            id:
                                newHost.id,

                            name:
                                newHost.name
                        }

                }
            );

        }

    }


    if (
        lobby.players.size ===
        0
    ) {

        destroyLobby(
            lobby,
            "empty"
        );

        return;

    }


    broadcastLobby(
        lobby
    );

}


/* ============================================================
   LOBBY HELPERS
   ============================================================ */

function getClientLobby(
    client
) {

    if (
        !client ||
        !client.lobbyCode
    ) {
        return null;
    }

    return (
        state.lobbies.get(
            client.lobbyCode
        ) ||
        null
    );

}


function broadcast(
    lobby,
    payload,
    excludedClient = null
) {

    if (!lobby) {
        return;
    }


    lobby.players.forEach(
        (
            player
        ) => {

            const target =
                player.client;

            if (
                !target ||
                target ===
                    excludedClient
            ) {
                return;
            }

            target.send(
                payload
            );

        }
    );

}


function broadcastLobby(
    lobby
) {

    if (!lobby) {
        return;
    }


    lobby.players.forEach(
        (
            player
        ) => {

            if (
                !player.client
            ) {
                return;
            }

            player.client.send({

                type:
                    "lobby_updated",

                code:
                    lobby.code,

                lobby:
                    lobby.serialize(
                        player.id
                    )

            });

        }
    );

}


function destroyLobby(
    lobby,
    reason
) {

    if (!lobby) {
        return;
    }


    if (
        !state.lobbies.has(
            lobby.code
        )
    ) {
        return;
    }


    console.log(
        `[LOBBY DESTROY] ${lobby.code} reason=${reason}`
    );


    lobby.players.forEach(
        (
            player
        ) => {

            if (
                player.client
            ) {

                player.client.inLobby =
                    false;

                player.client.lobbyCode =
                    null;

                player.client.send({

                    type:
                        "lobby_closed",

                    code:
                        lobby.code,

                    reason:
                        reason

                });

            }

        }
    );


    state.sessions.forEach(
        (
            session,
            token
        ) => {

            if (
                session.lobbyCode ===
                lobby.code
            ) {

                state.sessions.delete(
                    token
                );

            }

        }
    );


    state.lobbies.delete(
        lobby.code
    );

}


/* ============================================================
   ERRORS
   ============================================================ */

function sendError(
    client,
    code,
    message
) {

    client.send({

        type:
            "error",

        code:
            String(code),

        message:
            String(message)

    });

}


/* ============================================================
   HEARTBEAT
   ============================================================ */

const heartbeatTimer =
    setInterval(
        () => {

            const current =
                now();


            websocketServer.clients.forEach(
                (socket) => {

                    if (
                        socket.isAlive ===
                        false
                    ) {

                        try {
                            socket.terminate();
                        } catch (_) {}

                        return;

                    }


                    socket.isAlive =
                        false;

                    try {

                        socket.ping();

                    } catch (_) {}

                }
            );


            /*
             * Clean disconnected lobby players after
             * the reconnection window expires.
             */

            state.lobbies.forEach(
                (
                    lobby
                ) => {

                    lobby.players.forEach(
                        (
                            player
                        ) => {

                            if (
                                player.connected
                            ) {
                                return;
                            }

                            if (
                                !player.disconnectedAt
                            ) {
                                return;
                            }

                            if (
                                current -
                                    player.disconnectedAt >
                                CONFIG.disconnectedPlayerTimeout
                            ) {

                                const fakeClient = {
                                    id:
                                        player.id,

                                    inLobby:
                                        true,

                                    lobbyCode:
                                        lobby.code,

                                    playerName:
                                        player.name
                                };

                                removeDisconnectedPlayer(
                                    lobby,
                                    fakeClient
                                );

                            }

                        }
                    );


                    if (
                        lobby.shouldExpire()
                    ) {

                        destroyLobby(
                            lobby,
                            "timeout"
                        );

                    }

                }
            );


            /*
             * Remove very old unused session tokens.
             */

            state.sessions.forEach(
                (
                    session,
                    token
                ) => {

                    const created =
                        session.createdAt ||
                        current;

                    if (
                        current -
                            created >
                        1000 *
                            60 *
                            60
                    ) {

                        state.sessions.delete(
                            token
                        );

                    }

                }
            );

        },
        CONFIG.heartbeatInterval
    );


/* ============================================================
   REMOVE DISCONNECTED PLAYER
   ============================================================ */

function removeDisconnectedPlayer(
    lobby,
    fakeClient
) {

    const player =
        lobby.getPlayer(
            fakeClient.id
        );

    if (!player) {
        return;
    }


    lobby.removePlayer(
        fakeClient.id
    );


    state.sessions.forEach(
        (
            session,
            token
        ) => {

            if (
                session.clientId ===
                    fakeClient.id &&
                session.lobbyCode ===
                    lobby.code
            ) {

                state.sessions.delete(
                    token
                );

            }

        }
    );


    broadcast(
        lobby,
        {

            type:
                "player_left",

            playerId:
                fakeClient.id,

            name:
                player.name,

            explicit:
                false,

            lobby:
                lobby.serialize()

        }
    );


    if (
        lobby.hostId ===
        fakeClient.id
    ) {

        const newHost =
            lobby.chooseNewHost();

        if (
            newHost
        ) {

            broadcast(
                lobby,
                {

                    type:
                        "host_changed",

                    hostId:
                        lobby.hostId,

                    player:
                        {
                            id:
                                newHost.id,

                            name:
                                newHost.name
                        }

                }
            );

        }

    }


    if (
        lobby.players.size ===
        0
    ) {

        destroyLobby(
            lobby,
            "empty"
        );

    } else {

        broadcastLobby(
            lobby
        );

    }

}


/* ============================================================
   SERVER STATUS
   ============================================================ */

function buildHealthStatus() {

    return {

        ok:
            true,

        service:
            "THE SEEKER SERVER",

        studio:
            "BLACKHOLLOW GAMES",

        uptime:
            Math.floor(
                (
                    now() -
                    state.startedAt
                ) / 1000
            ),

        timestamp:
            new Date().toISOString()

    };

}


function buildServerStatus() {

    let players =
        0;


    state.lobbies.forEach(
        (
            lobby
        ) => {

            players +=
                lobby.players.size;

        }
    );


    return {

        ok:
            true,

        server:
            "THE SEEKER",

        studio:
            "BLACKHOLLOW GAMES",

        protocol:
            "the-seeker-v2",

        uptime:
            Math.floor(
                (
                    now() -
                    state.startedAt
                ) / 1000
            ),

        connections:
            state.activeConnections,

        totalConnections:
            state.totalConnections,

        lobbies:
            state.lobbies.size,

        players:

            players,

        gamesStarted:
            state.totalGamesStarted,

        lobbiesCreated:
            state.totalLobbiesCreated,

        messagesReceived:
            state.messagesReceived,

        messagesSent:
            state.messagesSent,

        maps:
            Array.from(
                CONFIG.allowedMaps
            ),

        maxLobbyPlayers:
            CONFIG.maxLobbyPlayers,

        timestamp:
            new Date().toISOString()

    };

}


/* ============================================================
   SERVER LOGGING
   ============================================================ */

function printStartupBanner() {

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "                 THE SEEKER SERVER"
    );
    console.log(
        "                   BLACKHOLLOW GAMES"
    );
    console.log(
        "============================================================"
    );
    console.log(
        `HTTP  : http://localhost:${CONFIG.port}`
    );
    console.log(
        `WS    : ws://localhost:${CONFIG.port}`
    );
    console.log(
        `HOST  : ${CONFIG.host}`
    );
    console.log(
        `GAME  : ${CONFIG.gameDirectory}`
    );
    console.log(
        `MAPS  : ${Array.from(CONFIG.allowedMaps).join(", ")}`
    );
    console.log(
        `SLOTS : ${CONFIG.maxLobbyPlayers} players per lobby`
    );
    console.log(
        "============================================================"
    );
    console.log(
        ""
    );

}


/* ============================================================
   START SERVER
   ============================================================ */

httpServer.listen(
    CONFIG.port,
    CONFIG.host,
    () => {

        printStartupBanner();

    }
);


/* ============================================================
   SERVER ERRORS
   ============================================================ */

httpServer.on(
    "error",
    (error) => {

        if (
            error.code ===
            "EADDRINUSE"
        ) {

            console.error(
                `[SERVER ERROR] Port ${CONFIG.port} is already in use.`
            );

        } else {

            console.error(
                "[HTTP SERVER ERROR]",
                error
            );

        }

        process.exit(
            1
        );

    }
);


websocketServer.on(
    "error",
    (error) => {

        console.error(
            "[WEBSOCKET SERVER ERROR]",
            error
        );

    }
);


/* ============================================================
   PERIODIC STATUS LOG
   ============================================================ */

const statusTimer =
    setInterval(
        () => {

            if (
                state.activeConnections ===
                    0 &&
                state.lobbies.size ===
                    0
            ) {
                return;
            }

            console.log(
                `[STATUS] connections=${state.activeConnections} lobbies=${state.lobbies.size} messages=${state.messagesReceived}/${state.messagesSent}`
            );

        },
        60000
    );


/* ============================================================
   GRACEFUL SHUTDOWN
   ============================================================ */

let shuttingDown =
    false;


async function shutdown(
    signal
) {

    if (
        shuttingDown
    ) {
        return;
    }

    shuttingDown =
        true;


    console.log(
        `\n[SHUTDOWN] ${signal}`
    );


    clearInterval(
        heartbeatTimer
    );

    clearInterval(
        statusTimer
    );


    /*
     * Tell connected players the server is stopping.
     */

    state.clients.forEach(
        (
            client
        ) => {

            client.send({

                type:
                    "server_shutdown",

                message:
                    "The server is shutting down."

            });

        }
    );


    /*
     * Close WebSocket clients.
     */

    state.clients.forEach(
        (
            client
        ) => {

            try {

                client.socket.close(
                    1001,
                    "Server shutting down"
                );

            } catch (_) {}

        }
    );


    await new Promise(
        (
            resolve
        ) => {

            websocketServer.close(
                () => resolve()
            );

        }
    );


    await new Promise(
        (
            resolve
        ) => {

            httpServer.close(
                () => resolve()
            );

        }
    );


    console.log(
        "[SHUTDOWN] Complete."
    );


    process.exit(
        0
    );

}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


/* ============================================================
   UNCAUGHT ERROR PROTECTION
   ============================================================ */

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "[UNCAUGHT EXCEPTION]",
            error
        );

    }
);


process.on(
    "unhandledRejection",
    (reason) => {

        console.error(
            "[UNHANDLED REJECTION]",
            reason
        );

    }
);


/* ============================================================
   SERVER API
   ============================================================ */

module.exports = {

    CONFIG,

    state,

    createLobby:
        ({
            name,
            map = "facility",
            maxPlayers = 4,
            client
        }) =>
            new Lobby({
                name,
                map,
                maxPlayers,
                hostClient:
                    client
            }),

    getLobby:
        code =>
            state.lobbies.get(
                normalizeCode(code)
            ) || null,

    getStatus:
        buildServerStatus

};