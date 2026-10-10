THE SEEKER — BLACKHOLLOWGAMES
ROOM EXPANSION UPDATE

This build expands the playable area beyond the original central corridor.

FILES
- index.html          Opening credits, main menu, HUD and screens
- style.css           Horror UI styling
- game.js             Player controls, interactions, keys, monster and rendering loop
- rooms.js            Extra connected room wings and sector geometry
- room-details.js     Additional mansion/laboratory furniture, props, pipes and room dressing
- server.js           Optional Node.js WebSocket relay for multiplayer testing
- package.json        Server dependency and start command
- README.txt          This file

MAP CHANGES
- The original side-room outer walls now have open doorways.
- Each side room connects to a large secondary wing and a deeper chamber.
- The west side has mansion-style furniture, wardrobes, shelves and old books.
- The east side has laboratory benches, containment pods, gurneys, carts and monitors.
- The player movement bounds have been widened so the extra rooms can be explored.
- The central exit remains in place and is not blocked by a new cross-corridor.

CONTROLS
WASD / Arrow keys: move
Mouse: look around (click the game to lock the pointer)
Shift: sprint
Ctrl: crouch-walk speed
E: interact / collect key / use exit
F: flashlight
Esc: pause

GITHUB PAGES
Upload the contents of this folder into the repository root, including both new JavaScript files.
Three.js is loaded from a CDN, so the game needs internet access.
GitHub Pages can host the browser game, but it cannot run server.js. Real online multiplayer requires a separately hosted WebSocket server.

NOTE
This is still a procedural prototype. The added wardrobes are scenery landmarks, not yet functioning hide interactions, and the monster does not yet use full navigation/pathfinding through every room.

15 NEW SYSTEM FILES
These new JavaScript modules split future gameplay systems into manageable files:
- audio-system.js       Procedural tones, pickup chimes and scare stings (no sound assets)
- save-system.js        Local save data, checkpoints, settings and unique collected items
- evidence-system.js    Facility reports, photograph and audio-log evidence entries
- journal-system.js     Journal collection and readable evidence formatting
- objective-system.js   Objective definitions and completion checks
- achievement-system.js Achievement list and progress helpers
- sanity-system.js      Sanity level, states and effect calculations
- stealth-system.js     Noise calculations and hearing-range helpers
- monster-memory.js     Persistent player-route memory for future adaptive hunting
- map-data.js           Named sectors and nearest-sector lookup
- difficulty-system.js  Story, Standard and Nightmare tuning presets
- subtitles-system.js   Caption text and timed subtitle queue
- accessibility-system.js Reduced-motion, high-contrast, large-text and subtitle preferences
- inventory-system.js   Item catalog and inventory helpers
- story-data.js         Discoverable story logs

These modules are included as separate, reusable systems. The current playable prototype does not yet connect every system to a visible in-game menu or event; modules such as evidence, sanity, achievements and subtitles are foundations for the next integration pass.
