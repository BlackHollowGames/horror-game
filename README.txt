THE SEEKER — BLACKHOLLOWGAMES MENU REBUILD

WHAT CHANGED
- New cinematic opening card: BLACKHOLLOWGAMES PRESENT / THE SEEKER.
- New full-screen main menu with PLAY GAME, CONTINUE / JOIN, SETTINGS, CREDITS and EXIT.
- Added surveillance-feed artwork, case-file panel, warning indicators, and cleaner typography.
- Player name and room code fields are built into the main menu.
- Credits button returns to the opening presentation; ENTER THE COMPLEX opens the main menu.
- Exit explains that browser games cannot close the browser tab automatically.
- Player name is saved locally in this browser.
- No new image or sound assets are required; the menu art is made with CSS.

PROJECT FILES
- index.html: opening presentation, menu, settings, HUD, pause and ending screens
- style.css: menu and game interface styling
- game.js: Three.js game, movement, rooms, keys, monster, and online room client
- server.js: optional Node.js WebSocket room relay for local multiplayer testing
- package.json: server dependency and start command

RUNNING THE GAME
The browser loads Three.js from a CDN, so an internet connection is needed. Serve the files from a local static server or deploy the browser files to GitHub Pages.

GITHUB PAGES LIMITATION
GitHub Pages can host the browser game but cannot run server.js. Online multiplayer needs a separately hosted Node.js server. The current multiplayer server is a prototype relay, not a finished secure public service.

CONTROLS
WASD / arrows: move
Mouse: look
Shift: sprint
E: interact
F: flashlight
Esc: pause
