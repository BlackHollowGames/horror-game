THE SEEKER — BLACKHOLLOW GAMES
ChromeOS / browser prototype

FILES
- index.html: game menus and HUD
- style.css: user interface
- game.js: generated Three.js world and gameplay
- server.js: room and player-state relay server
- package.json: Node.js dependency list

IMPORTANT
A browser-only static page cannot host true online multiplayer by itself.
server.js is included for the real room connection. The server relays player
positions, but this is an early prototype, not a production game server.
Three.js is loaded from a CDN, so first launch needs internet access.

EASIEST LOCAL RUN
1. Put all files in one folder.
2. Open a terminal in an environment with Node.js installed.
3. Run: npm install
4. Run: npm start
5. Open: http://localhost:8080
6. Use CREATE / JOIN on one tab. Open another tab/browser/device pointed to
   the same server and enter the same room code to test another player.
   For another device on the same Wi-Fi, use the host computer's LAN IP:
   http://YOUR-LAN-IP:8080 (firewall must allow port 8080).
7. For players on different networks, deploy server.js to an internet host that
   supports persistent Node.js/WebSocket servers, then configure the client URL
   for that hosted server. HTTPS deployments require WSS.

CHROMEOS
VS Code for the Web is an editor, not a Node.js runtime. If your Chromebook
doesn't have a terminal with Node.js, use a cloud development environment that
supports Node.js, or ask me to adapt this project to your chosen host. Do not
expect localhost to work from a plain static preview.

CONTROLS
WASD / arrow keys: move
Mouse: look (click the game view first)
Shift: sprint
E: interact with doors
F: flashlight
Esc: pause

CURRENT PROTOTYPE SCOPE
- Credits screen shown before the main menu
- Procedural concrete textures with cracks, peeling plaster, water stains, rusted pipes, rebar and rubble
- Taller Seeker creature with glowing eyes, immediate stalking AI, close-range warning and red danger vignette
- Code-generated 3D abandoned facility
- First-person movement and flashlight battery
- Interactable doors and locked exit
- A simple pursuing monster
- Room-code-based multiplayer player-position relay (up to 8 per room)

NOT YET IMPLEMENTED
- Final sound effects and music (the project currently has no audio files; add them when ready)
- Dedicated server-authoritative monster AI / shared monster position
- Shared door state and synchronized objectives
- Voice chat, accounts, matchmaking, save system, final map and polished models
- Secure public server validation, anti-cheat, rate limits, moderation, deployment

The project uses generated primitive geometry; no asset folder is needed.
