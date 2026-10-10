import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const $ = (id) => document.getElementById(id);
const ui = {
  credits: $("credits"), menu: $("menu"), settings: $("settings"), hud: $("hud"), pause: $("pause"),
  status: $("menuStatus"), name: $("playerName"), room: $("roomCode"),
  quality: $("quality"), sensitivity: $("sensitivity"), sensitivityValue: $("sensitivityValue"),
  connection: $("connectionLabel"), roomLabel: $("roomLabel"), players: $("playerList"),
  prompt: $("prompt"), batteryFill: $("batteryFill"), batteryText: $("batteryText"),
  toast: $("toast"), danger: $("dangerOverlay"), monsterWarning: $("monsterWarning")
};

const state = {
  active: false, paused: false, pointerLocked: false, name: "Player",
  room: "", playerId: crypto.randomUUID?.() ?? String(Math.random()).slice(2),
  keys: new Set(), yaw: 0, pitch: 0, sensitivity: Number(ui.sensitivity.value),
  battery: 100, flashlightOn: true, lastNetSend: 0, socket: null,
  remotes: new Map(), colliders: [], doors: [], interactable: null, quality: "medium"
};

let scene, camera, renderer, clock, playerRig, flashlight, flashlightTarget, ambientLight;
let toastTimer;

function showToast(message, duration = 2600) {
  ui.toast.textContent = message;
  ui.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), duration);
}
function showOnly(screen) {
  [ui.credits, ui.menu, ui.settings, ui.pause].forEach(s => s.classList.add("hidden"));
  if (screen) screen.classList.remove("hidden");
}
function setStatus(message) { ui.status.textContent = message; }

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030505);
  scene.fog = new THREE.FogExp2(0x030505, 0.045);

  camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.08, 100);
  camera.position.set(0, 1.68, 4);
  playerRig = new THREE.Group();
  playerRig.position.set(0, 0, 4);
  scene.add(playerRig);
  playerRig.add(camera);
  camera.position.set(0, 1.68, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  $("game-root").appendChild(renderer.domElement);

  ambientLight = new THREE.HemisphereLight(0x303b3b, 0x090807, 0.23);
  scene.add(ambientLight);
  const moon = new THREE.DirectionalLight(0x81949b, 0.32);
  moon.position.set(-5, 10, 3);
  moon.castShadow = true;
  moon.shadow.mapSize.set(512, 512);
  scene.add(moon);

  flashlight = new THREE.SpotLight(0xe0e7e5, 32, 18, Math.PI / 7, 0.5, 1.4);
  flashlight.position.set(0, 0, 0);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);
  flashlight.castShadow = false;

  buildWorld();
  clock = new THREE.Clock();
  window.addEventListener("resize", onResize);
  renderer.setAnimationLoop(animate);
}

function mat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function makeConcreteTexture() {
  // Procedural grime, chipped plaster, hairline cracks and water stains: no image assets.
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#454641"; ctx.fillRect(0,0,512,512);
  for (let i=0;i<18000;i++) {
    const shade = 35 + Math.random()*65;
    ctx.fillStyle = `rgba(${shade},${shade},${shade-3},${Math.random()*.16})`;
    ctx.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*4,1+Math.random()*3);
  }
  // Vertical damp streaks
  for(let i=0;i<34;i++) { const x=Math.random()*512; const y=Math.random()*250; ctx.strokeStyle=`rgba(8,12,11,${.08+Math.random()*.16})`; ctx.lineWidth=2+Math.random()*8; ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x-8,y+70,x+12,y+130,x+Math.random()*8,y+220+Math.random()*100); ctx.stroke(); }
  // Peeling paint/plaster patches with dark edges
  for(let i=0;i<70;i++) {
    const x=Math.random()*512,y=Math.random()*512,r=8+Math.random()*32;
    ctx.beginPath(); ctx.moveTo(x-r,y-r*.3); ctx.lineTo(x-r*.35,y-r); ctx.lineTo(x+r*.7,y-r*.65); ctx.lineTo(x+r,y+r*.15); ctx.lineTo(x+r*.35,y+r*.75); ctx.lineTo(x-r*.7,y+r*.55); ctx.closePath();
    ctx.fillStyle=`rgba(${15+Math.random()*25},${17+Math.random()*22},${16+Math.random()*20},${.6+Math.random()*.3})`;ctx.fill();
    ctx.strokeStyle="rgba(120,116,101,.32)";ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-r*.6,y);ctx.lineTo(x-r*.2,y-r*.35);ctx.lineTo(x+r*.15,y-r*.12);ctx.strokeStyle="rgba(12,13,12,.85)";ctx.lineWidth=1.5;ctx.stroke();
  }
  // Branching cracks
  for(let i=0;i<34;i++) {
    let x=Math.random()*512,y=Math.random()*512;ctx.beginPath();ctx.moveTo(x,y);
    for(let j=0;j<4+Math.random()*7;j++){x+=(Math.random()-.5)*28;y+=5+Math.random()*22;ctx.lineTo(x,y);if(Math.random()>.55){ctx.moveTo(x,y);ctx.lineTo(x+(Math.random()-.5)*25,y+10+Math.random()*18);ctx.moveTo(x,y);}}
    ctx.strokeStyle=`rgba(5,6,5,${.45+Math.random()*.4})`;ctx.lineWidth=.7+Math.random()*1.5;ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.wrapS=texture.wrapT=THREE.RepeatWrapping; texture.repeat.set(3,2); return texture;
}
function makeRustTexture() {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const c=canvas.getContext("2d");
  c.fillStyle="#382c25";c.fillRect(0,0,256,256);
  for(let i=0;i<3500;i++){c.fillStyle=Math.random()>.45?`rgba(135,57,28,${Math.random()*.5})`:`rgba(8,12,12,${Math.random()*.55})`;c.beginPath();c.arc(Math.random()*256,Math.random()*256,Math.random()*7,0,Math.PI*2);c.fill();}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,4);return t;
}
function addRubble(x,z,amount=8) {
  for(let i=0;i<amount;i++){
    const sx=.08+Math.random()*.38, sy=.04+Math.random()*.16, sz=.08+Math.random()*.34;
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),mat(Math.random()>.5?0x343531:0x171a18));
    rock.scale.set(sx,sy,sz);rock.position.set(x+(Math.random()-.5)*2,.02+Math.random()*.08,z+(Math.random()-.5)*2);rock.rotation.set(Math.random()*2,Math.random()*3,Math.random()*2);rock.castShadow=true;scene.add(rock);
  }
}
function addBox(name, x, y, z, sx, sy, sz, material, collision = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  if (collision) state.colliders.push({ minX: x - sx/2, maxX: x + sx/2, minZ: z - sz/2, maxZ: z + sz/2 });
  return mesh;
}
function buildWorld() {
  const concrete = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), color: 0xb2b1a7, roughness: 1 });
  const darkConcrete = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), color: 0x51544f, roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), color: 0x777970, roughness: 1 });
  const metal = mat(0x333a38, 0.55, 0.65), rusty = new THREE.MeshStandardMaterial({ map: makeRustTexture(), color: 0xb0a092, roughness: .98, metalness: .25 });
  // Long abandoned facility: generated geometry, no external models.
  addBox("floor", 0, -0.18, -7, 16, 0.35, 40, floorMat);
  addBox("ceiling", 0, 4.2, -7, 16, 0.3, 40, darkConcrete);
  addBox("left wall", -8, 2, -7, 0.35, 4.3, 40, concrete, true);
  addBox("right wall", 8, 2, -7, 0.35, 4.3, 40, concrete, true);
  // Repeating support columns, wall panels and overhead pipes.
  for (let z = 10; z >= -25; z -= 5) {
    for (const x of [-5.5, 5.5]) {
      addBox("support", x, 2, z, 0.55, 4, 0.55, darkConcrete, true);
      addBox("column band", x, 2.7, z, 0.62, 0.12, 0.62, metal);
    }
    addBox("overhead pipe", 0, 3.75, z, 0.13, 0.13, 15, rusty);
    // Flickering ceiling lamps.
    const lamp = new THREE.PointLight(0x9aa9a1, 0.6, 6, 2);
    lamp.position.set(0, 3.8, z - 1.8);
    scene.add(lamp);
    if (Math.random() > 0.45) {
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.16), new THREE.MeshBasicMaterial({ color: 0x9caaa0 }));
      bulb.position.copy(lamp.position); scene.add(bulb);
    }
  }
  // More industrial decay: parallel corroded pipes, broken hanging sections and wall-mounted conduit.
  for (const x of [-2.7,-1.9,2.3,3.1]) {
    addBox("rusted ceiling pipe",x,3.82,-7,.09,.09,38, rusty);
    for(const z of [-20,-10,0,8]) addBox("pipe clamp",x,3.8,z,.2,.16,.18,metal);
  }
  for(const [x,y,z,rot] of [[-7.65,3.1,-3,.25],[7.65,2.7,-12,-.4],[-7.65,3.4,-20,.5],[7.65,3.3,4,-.2]]) {
    const broken=addBox("broken hanging pipe",x,y,z,.12,1.35,.13, rusty);broken.rotation.z=rot;
    addBox("pipe leak stain",x+(x<0?.12:-.12),1.9,z,.025,1.2,.5,mat(0x242b26));
  }
  // Flaking plaster slabs and exposed dark masonry on the wall faces.
  for(let i=0;i<68;i++) {
    const side=Math.random()>.5?-1:1, z=-25+Math.random()*35, y=.45+Math.random()*3.15;
    const w=.18+Math.random()*.8,h=.08+Math.random()*.42;
    const flake=new THREE.Mesh(new THREE.BoxGeometry(.025,h,w),mat(Math.random()>.5?0x55564f:0x242824));
    flake.position.set(side*7.81,y,z);flake.rotation.z=(Math.random()-.5)*.18;scene.add(flake);
    if(Math.random()>.45){const dark=new THREE.Mesh(new THREE.BoxGeometry(.028,h*.7,w*.65),mat(0x171a18));dark.position.set(side*7.79,y-.015,z+.03);scene.add(dark);}
  }
  // Rebar, broken ceiling panels, floor rubble and damp patches.
  for(let i=0;i<18;i++){
    const z=8-Math.random()*32, x=(Math.random()>.5?1:-1)*(4.7+Math.random()*2.5);
    const bar=addBox("exposed rebar",x,3.95,z,.035,.035,1.1+Math.random()*1.8,mat(0x3d3027,.8,.6));bar.rotation.x=(Math.random()-.5)*.12;
  }
  for(const [x,z] of [[-5,1],[4,-4],[-3,-9],[5,-15],[-5,-21],[2,-24],[6,6]]) addRubble(x,z,7);
  // Broken wall conduit and junction boxes.
  for(const [x,z] of [[-7.72,5],[7.72,-7],[-7.72,-16],[7.72,-22]]){
    addBox("electrical junction box",x,2.2,z,.16,.42,.38,metal);
    addBox("dangling cable",x+(x<0?.08:-.08),1.55,z+.12,.025,1.05,.025,mat(0x101211));
  }
  // Side rooms and door frames.
  for (const z of [4, -5, -14, -23]) {
    for (const side of [-1, 1]) {
      const x = side * 6.3;
      addBox("side room wall", x, 1.8, z, 3.4, 3.7, 0.25, concrete, true);
      addBox("side room end", side * 6.3, 1.8, z - 3.5, 3.4, 3.7, 0.25, darkConcrete, true);
      const door = addBox("door", side * 6.3, 1.35, z + 1.8, 1.7, 2.7, 0.16, rusty, true);
      door.userData = { isDoor: true, open: false, originalX: door.position.x, originalZ: door.position.z };
      state.doors.push(door);
      addBox("door frame", side * 6.3, 2.75, z + 1.8, 1.95, 0.16, 0.28, metal);
    }
  }
  // Debris crates.
  for (const [x,y,z,s] of [[-2,0,-3,1.1],[2.5,0,-10,1.3],[-3.2,0,-18,0.9],[3.5,0,3,1.0]]) {
    addBox("crate", x, 0.45, z, s, 0.9, s, mat(0x29231e), true);
    const stripe = addBox("crate band", x, 0.48, z, s+0.015, 0.08, s+0.015, rusty);
  }
  // Exit light and locked exit.
  addBox("exit wall", 0, 2, -27, 7, 4, 0.5, concrete, true);
  const exit = addBox("EXIT DOOR", 0, 1.4, -26.68, 1.8, 2.8, 0.18, metal, true);
  exit.userData = { isExit: true };
  const exitLight = new THREE.PointLight(0x9c2520, 1.4, 8);
  exitLight.position.set(0, 3.3, -26.3); scene.add(exitLight);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.08), new THREE.MeshBasicMaterial({ color: 0x7c211d }));
  sign.position.set(0, 3.1, -26.3); scene.add(sign);

  // THE SEEKER: a tall, unnaturally thin silhouette with long arms and unmistakable glowing eyes.
  const monster = new THREE.Group();
  const flesh = mat(0x080909, .98), wetDark = mat(0x111413, .5, .15);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.31,1.35,5,10),flesh);torso.position.y=1.38;monster.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),flesh);chest.scale.set(.72,1.05,.68);chest.position.set(0,1.55,0);monster.add(chest);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.25,16,12),wetDark);skull.scale.set(.83,1.25,.72);skull.position.set(0,2.45,0);monster.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(.19,.25,.2),flesh);jaw.position.set(0,2.19,-.035);monster.add(jaw);
  const eyeMat = new THREE.MeshBasicMaterial({color:0xff201a});
  for(const x of [-.105,.105]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,12,10),eyeMat);eye.position.set(x,2.48,-.19);monster.add(eye);
    const glow=new THREE.PointLight(0xff160d, .55, 2.5);glow.position.set(x,2.48,-.25);monster.add(glow);
  }
  for(const side of [-1,1]){
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.95,4,7),flesh);arm.position.set(side*.38,1.35,-.015);arm.rotation.z=side*-.13;monster.add(arm);
    const claw=new THREE.Mesh(new THREE.ConeGeometry(.055,.34,6),wetDark);claw.position.set(side*.4,.72,-.04);claw.rotation.x=Math.PI;monster.add(claw);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.72,4,7),flesh);leg.position.set(side*.14,.48,.02);monster.add(leg);
  }
  monster.position.set(0,0,-15.5);monster.name="The Seeker";scene.add(monster);
  state.monster=monster;state.monsterBaseZ=-15.5;state.monsterSeen=true;state.monsterNotice=0;
  const eyeAura=new THREE.PointLight(0x8b0805,1.2,5);eyeAura.position.set(0,2.45,-.3);monster.add(eyeAura);

  // Dust specks floating in the flashlight.
  const dustGeo = new THREE.BufferGeometry();
  const dust = [];
  for (let i = 0; i < 350; i++) dust.push((Math.random()-0.5)*15, Math.random()*3.8, -25 + Math.random()*36);
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dust, 3));
  const dustPoints = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x929b96, size: 0.025, transparent: true, opacity: 0.28 }));
  scene.add(dustPoints);
}
function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, state.quality === "high" ? 1.75 : state.quality === "low" ? 1 : 1.35));
}
function blocked(x, z) {
  const radius = 0.35;
  return state.colliders.some(c => x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ);
}
function enterPointerLock() {
  if (renderer?.domElement?.requestPointerLock) renderer.domElement.requestPointerLock();
}
function startSession() {
  if (!renderer) init3D();
  state.name = (ui.name.value.trim() || "Player").slice(0,18);
  state.room = (ui.room.value.trim().toUpperCase() || Math.random().toString(36).slice(2,8).toUpperCase()).slice(0,8);
  playerRig.position.set(0, 0, 4);
  if(state.monster){state.monster.position.set(0,0,-15.5);state.monster.rotation.set(0,0,0);state.monsterSeen=true;state.monsterNotice=0;}
  state.yaw = 0; state.pitch = 0; state.battery = 100; state.flashlightOn = true;
  flashlight.intensity = 32;
  state.active = true; state.paused = false;
  ui.hud.classList.remove("hidden");
  showOnly(null);
  ui.roomLabel.textContent = `ROOM: ${state.room}`;
  ui.prompt.textContent = "";
  connectToServer();
  showToast("Click the game to capture the mouse and begin.", 4000);
  renderer.domElement.addEventListener("click", enterPointerLock);
}
function connectToServer() {
  if (state.socket) { try { state.socket.close(); } catch {} }
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${scheme}//${location.hostname || "localhost"}:8080`;
  let socket;
  try { socket = new WebSocket(url); state.socket = socket; }
  catch { connectionStatus(false, "Could not open server connection."); return; }
  connectionStatus(false, "CONNECTING");
  socket.addEventListener("open", () => {
    connectionStatus(true, "CONNECTED");
    socket.send(JSON.stringify({ type: "join", room: state.room, name: state.name, id: state.playerId }));
    setStatus("Connected to multiplayer server.");
    showToast("Connected to multiplayer server.");
  });
  socket.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    handleNetworkMessage(message);
  });
  socket.addEventListener("close", () => {
    connectionStatus(false, "SERVER OFFLINE");
    showToast("Multiplayer server disconnected. You can still explore locally.", 3500);
  });
  socket.addEventListener("error", () => {
    connectionStatus(false, "SERVER OFFLINE");
    setStatus("Server not found. Start server.js and open the game through http://localhost:8080.");
  });
}
function connectionStatus(ok, text) {
  ui.connection.textContent = text;
  ui.connection.classList.toggle("bad", !ok);
}
function handleNetworkMessage(msg) {
  if (msg.type === "joined") {
    state.room = msg.room;
    ui.roomLabel.textContent = `ROOM: ${state.room}`;
    updatePlayerList(msg.players || []);
    showToast(`Joined room ${state.room}`);
  } else if (msg.type === "players") {
    updatePlayerList(msg.players || []);
  } else if (msg.type === "state") {
    if (msg.id === state.playerId) return;
    updateRemote(msg.id, msg.state);
  } else if (msg.type === "notice") {
    showToast(msg.message || "Room update");
  } else if (msg.type === "error") {
    showToast(msg.message || "Multiplayer error");
  } else if (msg.type === "player-left") {
    removeRemote(msg.id);
  }
}
function updatePlayerList(players) {
  ui.players.textContent = `${players.length} PLAYER${players.length === 1 ? "" : "S"} IN ROOM`;
  const alive = new Set(players.map(p => p.id));
  for (const [id] of state.remotes) if (!alive.has(id)) removeRemote(id);
}
function updateRemote(id, data) {
  if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.z)) return;
  let remote = state.remotes.get(id);
  if (!remote) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.8, 3, 6), mat(0x414947));
    body.position.y = 0.8; group.add(body);
    const lamp = new THREE.PointLight(0x6f827a, 0.3, 2); lamp.position.set(0,1.5,0); group.add(lamp);
    scene.add(group);
    remote = { group, target: new THREE.Vector3(data.x,0,data.z), yaw: data.yaw || 0 };
    state.remotes.set(id, remote);
  }
  remote.target.set(data.x, 0, data.z);
  remote.yaw = data.yaw || 0;
}
function removeRemote(id) {
  const remote = state.remotes.get(id);
  if (remote) { scene.remove(remote.group); state.remotes.delete(id); }
}
function sendState() {
  const s = state.socket;
  if (!s || s.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - state.lastNetSend < 70) return;
  state.lastNetSend = now;
  s.send(JSON.stringify({ type: "state", room: state.room, id: state.playerId, state: {
    x: playerRig.position.x, z: playerRig.position.z, yaw: state.yaw
  }}));
}
function interact() {
  let closest = null, dist = 2.4;
  for (const door of state.doors) {
    const d = door.position.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
    if (d < dist) { closest = door; dist = d; }
  }
  const exit = scene.getObjectByName("EXIT DOOR");
  if (exit && exit.position.distanceTo(camera.getWorldPosition(new THREE.Vector3())) < dist) {
    closest = exit; dist = exit.position.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
  }
  if (!closest) { showToast("Nothing close enough to interact with."); return; }
  if (closest.userData.isExit) {
    showToast("The exit is sealed. Find another way out.");
  } else if (closest.userData.isDoor) {
    const open = !closest.userData.open;
    closest.userData.open = open;
    closest.rotation.y = open ? (closest.position.x < 0 ? -Math.PI/2 : Math.PI/2) : 0;
    // Keep this simple prototype collision forgiving around doors.
    showToast(open ? "Door opened." : "Door closed.");
  }
}
function pauseGame() {
  if (!state.active) return;
  state.paused = true;
  document.exitPointerLock?.();
  showOnly(ui.pause);
}
function resumeGame() {
  state.paused = false;
  showOnly(null);
  enterPointerLock();
}
function leaveSession() {
  state.active = false; state.paused = false;
  document.exitPointerLock?.();
  ui.hud.classList.add("hidden");
  if (state.socket) { try { state.socket.close(); } catch {} state.socket = null; }
  for (const id of state.remotes.keys()) removeRemote(id);
  showOnly(ui.menu);
}
function animate() {
  if (!renderer || !scene || !camera) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.active && !state.paused) updateGame(dt);
  for (const remote of state.remotes.values()) {
    remote.group.position.lerp(remote.target, Math.min(1, dt * 8));
    remote.group.rotation.y = remote.yaw;
  }
  renderer.render(scene, camera);
}
function updateGame(dt) {
  const speed = (state.keys.has("ShiftLeft") || state.keys.has("ShiftRight")) ? 4.7 : 2.8;
  const forward = Number(state.keys.has("KeyW") || state.keys.has("ArrowUp")) - Number(state.keys.has("KeyS") || state.keys.has("ArrowDown"));
  const side = Number(state.keys.has("KeyD") || state.keys.has("ArrowRight")) - Number(state.keys.has("KeyA") || state.keys.has("ArrowLeft"));
  const move = new THREE.Vector3(side, 0, -forward);
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(speed * dt).applyAxisAngle(new THREE.Vector3(0,1,0), state.yaw);
    const nx = playerRig.position.x + move.x, nz = playerRig.position.z + move.z;
    if (!blocked(nx, playerRig.position.z)) playerRig.position.x = THREE.MathUtils.clamp(nx, -7.2, 7.2);
    if (!blocked(playerRig.position.x, nz)) playerRig.position.z = THREE.MathUtils.clamp(nz, -26, 13);
  }
  state.battery = Math.max(0, state.battery - (state.flashlightOn ? dt * 0.23 : 0));
  if (state.battery <= 0) { state.flashlightOn = false; flashlight.intensity = 0; }
  flashlight.intensity = state.flashlightOn ? (state.battery < 20 ? 24 + Math.sin(performance.now()*0.025)*5 : 32) : 0;
  ui.batteryFill.style.width = `${state.battery}%`;
  ui.batteryText.textContent = `${Math.ceil(state.battery)}%`;

  const monster = state.monster;
  if (monster) {
    const distance = monster.position.distanceTo(playerRig.position);
    state.monsterNotice += dt;
    // It starts stalking immediately. It pauses and watches at medium range, then closes in.
    const direction = new THREE.Vector3(playerRig.position.x-monster.position.x,0,playerRig.position.z-monster.position.z);
    if(direction.lengthSq()>0.001) direction.normalize();
    if(distance>5.8 && state.monsterNotice>.9) monster.position.addScaledVector(direction,dt*(distance>11?.72:.38));
    monster.position.y=Math.sin(performance.now()*.002)*.035;
    monster.traverse(o=>{if(o.isPointLight && o.distance<3)o.intensity=.35+Math.abs(Math.sin(performance.now()*.004))*1.1;});
    monster.lookAt(playerRig.position.x,1.2,playerRig.position.z);
    // Its eyes pulse; the screen edges redden and a warning appears when it is close.
    const danger=THREE.MathUtils.clamp((13-distance)/11,0,1);
    if(ui.danger) ui.danger.style.opacity=String(danger*.82);
    if(ui.monsterWarning) ui.monsterWarning.classList.toggle("hidden",distance>13);
    if(distance<2.1){
      showToast("THE SEEKER FOUND YOU. It has learned your scent. Returning to the entrance…",4500);
      playerRig.position.set(0,0,4);monster.position.set((Math.random()-.5)*3,0,-15.5);state.monsterNotice=0;
    }
  }
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  let nearest = Infinity;
  for (const door of state.doors) nearest = Math.min(nearest, door.position.distanceTo(camPos));
  ui.prompt.textContent = nearest < 2.4 ? "PRESS E TO INTERACT" : "";
  sendState();
}
document.addEventListener("keydown", e => {
  state.keys.add(e.code);
  if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape" && state.active && !state.paused) pauseGame();
  if (e.code === "KeyF" && state.active && !state.paused) {
    state.flashlightOn = !state.flashlightOn && state.battery > 0;
    showToast(state.flashlightOn ? "Flashlight on." : "Flashlight off.");
  }
  if (e.code === "KeyE" && state.active && !state.paused) interact();
});
document.addEventListener("keyup", e => state.keys.delete(e.code));
document.addEventListener("mousemove", e => {
  if (!state.pointerLocked || !state.active || state.paused) return;
  state.yaw -= e.movementX * state.sensitivity;
  state.pitch -= e.movementY * state.sensitivity;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.45, 1.45);
  playerRig.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
});
document.addEventListener("pointerlockchange", () => {
  state.pointerLocked = document.pointerLockElement === renderer?.domElement;
  if (state.active && !state.paused && !state.pointerLocked) showToast("Click the game to resume mouse look.", 3000);
});
$("creditsContinue").addEventListener("click", () => showOnly(ui.menu));
$("playButton").addEventListener("click", startSession);
$("settingsButton").addEventListener("click", () => showOnly(ui.settings));
$("backButton").addEventListener("click", () => showOnly(ui.menu));
$("resumeButton").addEventListener("click", resumeGame);
$("leaveButton").addEventListener("click", leaveSession);
ui.sensitivity.addEventListener("input", () => {
  state.sensitivity = Number(ui.sensitivity.value);
  ui.sensitivityValue.textContent = state.sensitivity.toFixed(4);
});
ui.quality.addEventListener("change", () => {
  state.quality = ui.quality.value;
  if (renderer) {
    renderer.shadowMap.enabled = state.quality !== "low";
    renderer.setPixelRatio(Math.min(devicePixelRatio, state.quality === "high" ? 1.75 : state.quality === "low" ? 1 : 1.35));
  }
});
setStatus("Create a room or enter a room code. Start the server before online play.");
// Render the 3D environment behind the opening credits and main menu.
init3D();
// The credits screen is deliberately the first screen shown before the main menu.
showOnly(ui.credits);
