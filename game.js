import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { buildExpansion } from "./rooms.js";

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
  remotes: new Map(), colliders: [], doors: [], interactable: null, quality: "medium", keysFound: new Set(), keyObjects: [], monsterAttackCooldown: 0, monsterGrace: 0, checkpoint: { x: 0, z: 14 }
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
  scene.fog = new THREE.FogExp2(0x030505, 0.018);

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
  renderer.toneMappingExposure = 1.08;
  $("game-root").appendChild(renderer.domElement);

  ambientLight = new THREE.HemisphereLight(0x68716c, 0x17130f, 0.52);
  scene.add(ambientLight);
  const moon = new THREE.DirectionalLight(0x9eaaa3, 0.48);
  moon.position.set(-5, 10, 3);
  moon.castShadow = true;
  moon.shadow.mapSize.set(512, 512);
  scene.add(moon);

  flashlight = new THREE.SpotLight(0xf0f3e9, 48, 27, Math.PI / 5.3, 0.42, 1.15);
  flashlight.position.set(0, 0, 0);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);
  flashlight.castShadow = false;

  buildWorld();
  buildExpansion(THREE, scene, state, addBox, mat);
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
  const concreteTex = makeConcreteTexture();
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, color: 0xb2b1a7, roughness: 1 });
  const darkConcrete = new THREE.MeshStandardMaterial({ map: concreteTex, color: 0x444842, roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTex, color: 0x656a62, roughness: 1 });
  const metal = mat(0x242b29, .58, .62), rusty = new THREE.MeshStandardMaterial({ map: makeRustTexture(), color: 0xb0a092, roughness: .98, metalness: .25 });
  const black = mat(0x080a09, 1), stain = mat(0x202722, 1);

  // Main passage plus six proper side rooms. The wall gaps are real walkable entrances.
  addBox("main floor", 0, -.18, -7, 10, .35, 54, floorMat);
  addBox("main ceiling", 0, 4.2, -7, 10, .3, 54, darkConcrete);
  const roomCenters = [5, -5, -15, -25];
  for (const side of [-1, 1]) {
    let cursor = 20;
    for (const cz of roomCenters) {
      const openingHalf = 1.25;
      const segLen = cursor - (cz + openingHalf);
      if (segLen > 0) addBox("corridor wall", side * 5, 2, (cursor + cz + openingHalf) / 2, .35, 4.3, segLen, concrete, true);
      cursor = cz - openingHalf;
    }
    const segLen = cursor - (-34);
    if (segLen > 0) addBox("corridor wall", side * 5, 2, (cursor - 34) / 2, .35, 4.3, segLen, concrete, true);
  }
  // Rooms are deep enough to explore and have doorways directly off the main corridor.
  const keyRooms = [
    { side: -1, z: -5, color: 0x54d9ff, name: "MAINTENANCE KEY" },
    { side: 1, z: -15, color: 0xffc34d, name: "SECURITY KEY" },
    { side: -1, z: -25, color: 0xff4949, name: "CELLAR KEY" }
  ];
  for (const side of [-1, 1]) {
    for (const cz of roomCenters) {
      const outerX = side * 12;
      const innerX = side * 5.15;
      const roomCenterX = side * 8.55;
      // Side room floor and ceiling.
      addBox("side room floor", roomCenterX, -.18, cz, 6.9, .35, 7.4, floorMat);
      addBox("side room ceiling", roomCenterX, 4.2, cz, 6.9, .3, 7.4, darkConcrete);
      // Split the outside wall around a wide doorway so the room connects to the new wings.
      addBox("outer room wall upper", outerX, 2, cz + 2.5, .35, 4.3, 2.4, concrete, true);
      addBox("outer room wall lower", outerX, 2, cz - 2.5, .35, 4.3, 2.4, concrete, true);
      addBox("outer doorway lintel", outerX, 3.02, cz, .42, .2, 2.75, metal);
      addBox("outer doorway jamb A", outerX, 1.45, cz + 1.35, .25, 2.9, .22, metal);
      addBox("outer doorway jamb B", outerX, 1.45, cz - 1.35, .25, 2.9, .22, metal);
      addBox("room end wall A", roomCenterX, 2, cz + 3.7, 6.9, 4.3, .35, concrete, true);
      addBox("room end wall B", roomCenterX, 2, cz - 3.7, 6.9, 4.3, concrete, true);
      // Torn, bent door panels are pushed aside so players can actually enter.
      const door = addBox("room door", side * 5.65, 1.35, cz + 1.65, .12, 2.7, 1.55, rusty, false);
      door.rotation.y = side * .92;
      door.userData = { isDoor: true, open: true, originalX: door.position.x, originalZ: door.position.z };
      state.doors.push(door);
      addBox("door lintel", side * 5.05, 2.85, cz, .3, .18, 2.55, metal);
      addBox("door jamb", side * 5.05, 1.4, cz + 1.2, .25, 2.8, .2, metal);
      addBox("door jamb", side * 5.05, 1.4, cz - 1.2, .25, 2.8, .2, metal);
      // Room-specific broken furniture and grime.
      addBox("rusted cabinet", side * 10.2, .8, cz + 1.6, 1.05, 1.6, .8, rusty, true);
      addBox("broken desk", side * 7.6, .65, cz - 2.4, 1.65, .12, .7, mat(0x29251f), true);
      for (let i = 0; i < 13; i++) {
        const shard = new THREE.Mesh(new THREE.DodecahedronGeometry(.16 + Math.random() * .18, 0), mat(Math.random() > .5 ? 0x343631 : 0x151917));
        shard.position.set(side * (6 + Math.random() * 5.2), .03 + Math.random() * .08, cz + (Math.random() - .5) * 6.4);
        shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); shard.scale.y = .3; scene.add(shard);
      }
      const lamp = new THREE.PointLight(0x796f58, .32, 6, 2); lamp.position.set(roomCenterX, 3.4, cz); scene.add(lamp);
    }
  }

  // Large concrete supports, rusty overhead pipes, leaks, broken cable trays and exposed rebar.
  for (let z = 17; z >= -31; z -= 5) {
    for (const x of [-4.25, 4.25]) {
      addBox("concrete support", x, 2, z, .45, 4, .5, darkConcrete, true);
      addBox("support collar", x, 2.75, z, .55, .12, .6, metal);
    }
    for (const x of [-2.8, -2.1, 2.1, 2.8]) addBox("ceiling pipe", x, 3.82, z, .09, .09, 4.5, rusty);
    const lamp = new THREE.PointLight(0x89958a, Math.random() > .5 ? .48 : .12, 7, 2); lamp.position.set(0, 3.8, z - 1); scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(.72, .05, .14), new THREE.MeshBasicMaterial({ color: 0x66766b })); bulb.position.copy(lamp.position); scene.add(bulb);
  }
  for (const [x,y,z,rot] of [[-4.7,3,-1,.4],[4.7,2.7,-11,-.5],[-4.7,3.2,-21,.55],[4.7,2.9,-30,-.3]]) {
    const broken = addBox("dangling broken pipe", x, y, z, .12, 1.5, .13, rusty); broken.rotation.z = rot;
    addBox("water leak streak", x + (x < 0 ? .1 : -.1), 1.85, z, .025, 1.5, .42, stain);
  }
  // Wall flakes, black mold patches, cracks, rubble and dangling cables.
  for (let i = 0; i < 130; i++) {
    const side = Math.random() > .5 ? -1 : 1, z = -33 + Math.random() * 52, y = .35 + Math.random() * 3.4;
    const w = .18 + Math.random() * .9, h = .06 + Math.random() * .48;
    const flake = new THREE.Mesh(new THREE.BoxGeometry(.028, h, w), mat(Math.random() > .5 ? 0x55574e : 0x222722));
    flake.position.set(side * 4.81, y, z); flake.rotation.z = (Math.random() - .5) * .2; scene.add(flake);
    if (Math.random() > .45) { const mold = new THREE.Mesh(new THREE.BoxGeometry(.03, h * .75, w * .7), stain); mold.position.set(side * 4.79, y - .02, z + .02); scene.add(mold); }
  }
  for (let i = 0; i < 35; i++) {
    const x = (Math.random() - .5) * 8, z = 18 - Math.random() * 51;
    const bar = addBox("exposed rebar", x, 3.98, z, .035, .035, 1 + Math.random() * 2, mat(0x3d3027, .8, .6)); bar.rotation.x = (Math.random() - .5) * .18;
  }
  for (let i = 0; i < 85; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.08 + Math.random() * .2, 0), mat(Math.random() > .5 ? 0x343631 : 0x171a18));
    rock.position.set((Math.random() - .5) * 9, .015 + Math.random() * .08, 18 - Math.random() * 51); rock.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3); rock.scale.y=.35; scene.add(rock);
  }
  for (const [x,z] of [[-4.7,9],[4.7,-8],[-4.7,-18],[4.7,-28]]) {
    addBox("junction box", x, 2.2, z, .16, .42, .38, metal);
    const cable = addBox("dangling cable", x + (x < 0 ? .08 : -.08), 1.55, z + .12, .025, 1.05, .025, black); cable.rotation.z = (Math.random()-.5)*.12;
  }

  // Three physical keys with rings, colored glow, and clear pickup positions.
  state.keysFound = new Set(); state.keyObjects = [];
  keyRooms.forEach((keyData, i) => {
    const x = keyData.side * 8.45, z = keyData.z;
    const group = new THREE.Group(); group.position.set(x, .95, z); group.userData = { keyId: i, keyName: keyData.name, collected: false };
    const glowMat = new THREE.MeshStandardMaterial({ color: keyData.color, emissive: keyData.color, emissiveIntensity: 1.7, metalness: .65, roughness: .28 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.48,10), glowMat); shaft.rotation.z = Math.PI/2; group.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.14,.035,8,18), glowMat); ring.position.x = -.2; group.add(ring);
    for (let n=0;n<2;n++){const tooth=new THREE.Mesh(new THREE.BoxGeometry(.08,.09,.07),glowMat);tooth.position.set(.17+n*.1,-.1,0);group.add(tooth);}
    const light = new THREE.PointLight(keyData.color, 1.7, 4); light.position.set(0,.15,0); group.add(light);
    scene.add(group); state.keyObjects.push(group);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(.8,.16,.55), mat(0x292d29)); plinth.position.set(x,.28,z); scene.add(plinth);
    const label = new THREE.Mesh(new THREE.BoxGeometry(.72,.08,.08), new THREE.MeshBasicMaterial({color:keyData.color})); label.position.set(x,.38,z-.2); scene.add(label);
  });

  // Locked exit. The three keys are required to escape.
  addBox("exit bulkhead", 0, 2, -34, 10, 4.3, .4, concrete, false);
  addBox("exit left block", -3.1, 1.6, -33.72, 3.8, 3.2, .18, darkConcrete, true);
  addBox("exit right block", 3.1, 1.6, -33.72, 3.8, 3.2, .18, darkConcrete, true);
  const exit = addBox("EXIT DOOR", 0, 1.5, -33.72, 1.8, 3, .2, rusty, false);
  exit.userData = { isExit: true };
  const exitLight = new THREE.PointLight(0xb21f18, 2.3, 10); exitLight.position.set(0, 3.25, -32.9); scene.add(exitLight);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.25,.28,.08), new THREE.MeshBasicMaterial({color:0x9b211c})); sign.position.set(0,3.2,-32.9); scene.add(sign);

  // THE SEEKER: taller, asymmetrical, long-limbed, with a split jaw and bright wet eyes.
  const monster = new THREE.Group();
  const flesh = new THREE.MeshStandardMaterial({color:0x030404, roughness:.92, metalness:.08});
  const wetDark = new THREE.MeshStandardMaterial({color:0x111514, roughness:.3, metalness:.18});
  const bone = mat(0x292b27,.8);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.42,6,12),flesh); torso.position.y=1.65; monster.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.42,16,12),flesh); chest.scale.set(.76,1.15,.72); chest.position.set(0,1.78,0); monster.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.09,.16,.5,9),flesh); neck.position.set(0,2.55,0); monster.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.3,18,14),wetDark); skull.scale.set(.8,1.2,.75); skull.position.set(0,2.88,0); monster.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(.27,.31,.23),flesh); jaw.position.set(0,2.57,-.06); monster.add(jaw);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.2,.035,.025),new THREE.MeshBasicMaterial({color:0x9d0907})); mouth.position.set(0,2.68,-.26); monster.add(mouth);
  const eyeMat = new THREE.MeshBasicMaterial({color:0xff1208});
  for (const x of [-.125,.125]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),eyeMat); eye.position.set(x,2.93,-.218); monster.add(eye); const glow = new THREE.PointLight(0xff0800,1.2,3); glow.position.set(x,2.93,-.28); monster.add(glow); }
  for (const side of [-1,1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),flesh); shoulder.position.set(side*.37,2.13,0); monster.add(shoulder);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.085,1.35,5,8),flesh); arm.position.set(side*.52,1.35,-.02); arm.rotation.z=side*-.16; monster.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.12,9,7),wetDark); hand.position.set(side*.57,.61,-.03); monster.add(hand);
    for(let c=0;c<3;c++){const claw=new THREE.Mesh(new THREE.ConeGeometry(.035,.25,5),bone);claw.position.set(side*(.55+(c-1)*.07),.43,-.08);claw.rotation.x=Math.PI;monster.add(claw);}
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.9,5,8),flesh);leg.position.set(side*.16,.54,.02);monster.add(leg);
  }
  // Ragged black tendrils trail behind its shoulders.
  for(let i=0;i<5;i++){const tendril=new THREE.Mesh(new THREE.CylinderGeometry(.012,.07,1.25+Math.random()*.8,5),black);tendril.position.set((Math.random()-.5)*.8,1.65,.28+Math.random()*.25);tendril.rotation.z=(Math.random()-.5)*1.3;monster.add(tendril);}
  monster.position.set(8,0,-28); monster.name="The Seeker"; scene.add(monster);
  state.monster=monster; state.monsterSeen=false; state.monsterNotice=0; state.monsterAttackCooldown=0; state.monsterGrace=15;
  const eyeAura=new THREE.PointLight(0x8b0805,1.25,4);eyeAura.position.set(0,2.8,-.3);monster.add(eyeAura);

  // Dust particles in the flashlight beam.
  const dustGeo=new THREE.BufferGeometry(), dust=[];
  for(let i=0;i<500;i++) dust.push((Math.random()-.5)*12,Math.random()*3.8,-34+Math.random()*54);
  dustGeo.setAttribute("position",new THREE.Float32BufferAttribute(dust,3));
  scene.add(new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x929b96,size:.025,transparent:true,opacity:.32})));
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
  try { localStorage.setItem("seeker_player_name", state.name); } catch {}
  state.room = (ui.room.value.trim().toUpperCase() || Math.random().toString(36).slice(2,8).toUpperCase()).slice(0,8);
  playerRig.position.set(state.checkpoint.x, 0, state.checkpoint.z);
  state.keysFound = new Set();
  for (const key of state.keyObjects || []) { key.visible = true; key.userData.collected = false; }
  if(state.monster){state.monster.position.set(8,0,-28);state.monster.rotation.set(0,0,0);state.monsterSeen=false;state.monsterNotice=0;state.monsterAttackCooldown=0;state.monsterGrace=15;}
  updateInventory();
  state.yaw = 0; state.pitch = 0; state.battery = 100; state.flashlightOn = true;
  flashlight.intensity = 48;
  state.active = true; state.paused = false;
  ui.hud.classList.remove("hidden");
  showOnly(null);
  ui.roomLabel.textContent = `ROOM: ${state.room}`;
  ui.prompt.textContent = "";
  connectToServer();
  showToast("Explore the side rooms and deep wings. Find 3 keys, inspect the rooms, then reach the marked exit. WASD move · SHIFT sprint · CTRL crouch · E interact · F flashlight.", 7000);
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
function updateInventory() {
  const inventory = $("inventoryLabel");
  if (inventory) inventory.textContent = `KEYS: ${state.keysFound.size}/3`;
  const objective = document.querySelector(".objective");
  if (objective) objective.innerHTML = `<span class="dot"></span> ${state.keysFound.size === 3 ? "RETURN TO THE EXIT — IT IS UNLOCKED" : `FIND THE 3 KEYS (${state.keysFound.size}/3)`}`;
}
function getInteractable() {
  const playerPos = camera.getWorldPosition(new THREE.Vector3());
  let closest = null, best = 2.8;
  for (const key of state.keyObjects || []) {
    if (!key.visible || key.userData.collected) continue;
    const d = key.position.distanceTo(playerPos);
    if (d < best) { best = d; closest = { type: "key", object: key, distance: d }; }
  }
  for (const door of state.doors) {
    const d = door.position.distanceTo(playerPos);
    if (d < best && !door.userData.open) { best = d; closest = { type: "door", object: door, distance: d }; }
  }
  const exit = scene.getObjectByName("EXIT DOOR");
  if (exit) {
    const d = exit.position.distanceTo(playerPos);
    if (d < best) { best = d; closest = { type: "exit", object: exit, distance: d }; }
  }
  return closest;
}
function interact() {
  const target = state.interactable || getInteractable();
  if (!target) { showToast("Search the rooms. Get closer to a key or door."); return; }
  if (target.type === "key") {
    const key = target.object;
    if (key.userData.collected) return;
    key.userData.collected = true; key.visible = false;
    state.keysFound.add(key.userData.keyId);
    updateInventory();
    showToast(`${key.userData.keyName} collected. ${3-state.keysFound.size} key${3-state.keysFound.size===1?"":"s"} left.`, 3200);
  } else if (target.type === "exit") {
    if (state.keysFound.size < 3) showToast(`THE EXIT IS LOCKED. You need all 3 keys. (${state.keysFound.size}/3)`, 3200);
    else {
      showToast("THE EXIT OPENS... YOU ESCAPED THE SEEKER.", 6000);
      state.active = false; state.paused = true; document.exitPointerLock?.();
      const win = $("winScreen"); if (win) win.classList.remove("hidden");
    }
  } else if (target.type === "door") {
    target.object.userData.open = true; target.object.rotation.y += Math.PI / 2;
    showToast("The door groans open.");
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
  $("winScreen")?.classList.add("hidden");
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
  const speed = (state.keys.has("ShiftLeft") || state.keys.has("ShiftRight")) ? 5.0 : (state.keys.has("ControlLeft") || state.keys.has("ControlRight")) ? 1.55 : 3.0;
  const forward = Number(state.keys.has("KeyW") || state.keys.has("ArrowUp")) - Number(state.keys.has("KeyS") || state.keys.has("ArrowDown"));
  const side = Number(state.keys.has("KeyD") || state.keys.has("ArrowRight")) - Number(state.keys.has("KeyA") || state.keys.has("ArrowLeft"));
  const move = new THREE.Vector3(side, 0, -forward);
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(speed * dt).applyAxisAngle(new THREE.Vector3(0,1,0), state.yaw);
    const nx = playerRig.position.x + move.x, nz = playerRig.position.z + move.z;
    if (!blocked(nx, playerRig.position.z)) playerRig.position.x = THREE.MathUtils.clamp(nx, -30.6, 30.6);
    if (!blocked(playerRig.position.x, nz)) playerRig.position.z = THREE.MathUtils.clamp(nz, -37, 20);
  }
  state.battery = Math.max(0, state.battery - (state.flashlightOn ? dt * 0.23 : 0));
  if (state.battery <= 0) { state.flashlightOn = false; flashlight.intensity = 0; }
  flashlight.intensity = state.flashlightOn ? (state.battery < 20 ? 34 + Math.sin(performance.now()*0.025)*4 : 48) : 0;
  ui.batteryFill.style.width = `${state.battery}%`;
  ui.batteryText.textContent = `${Math.ceil(state.battery)}%`;

  const monster = state.monster;
  if (monster) {
    const playerPos = playerRig.position;
    const delta = new THREE.Vector3(playerPos.x-monster.position.x,0,playerPos.z-monster.position.z);
    const distance = delta.length();
    state.monsterNotice += dt;
    state.monsterAttackCooldown = Math.max(0, state.monsterAttackCooldown - dt);
    state.monsterGrace = Math.max(0, state.monsterGrace - dt);
    // A fair start: The Seeker stays at the far end while the player gets oriented.
    // After the grace period it hunts, but sprinting can create real distance.
    if (distance > .001 && state.monsterGrace <= 0) {
      delta.normalize();
      const huntSpeed = distance > 18 ? 1.75 : distance > 8 ? 2.45 : 3.15;
      monster.position.addScaledVector(delta, huntSpeed * dt);
      monster.lookAt(playerPos.x, 1.5, playerPos.z);
      state.monsterSeen = true;
    }
    monster.position.y = Math.sin(performance.now()*.006)*.07;
    monster.children.forEach(o=>{if(o.isPointLight && o.distance<4)o.intensity=.55+Math.abs(Math.sin(performance.now()*.006))*1.1;});
    const danger = state.monsterGrace > 0 ? 0 : THREE.MathUtils.clamp((14-distance)/12,0,1);
    if(ui.danger) ui.danger.style.opacity=String(danger*.72);
    if(ui.monsterWarning) {
      ui.monsterWarning.classList.toggle("hidden",state.monsterGrace > 0 || distance>18);
      ui.monsterWarning.textContent = distance < 5 ? "RUN. IT IS RIGHT BEHIND YOU." : distance < 10 ? "THE SEEKER IS CLOSING IN" : "SOMETHING IS FOLLOWING YOU";
    }
    if (distance < 1.5 && state.monsterAttackCooldown <= 0 && state.monsterGrace <= 0) {
      state.monsterAttackCooldown = 2.5;
      showToast("THE SEEKER CAUGHT YOU. Returning to checkpoint. Your collected keys remain.", 4000);
      playerRig.position.set(state.checkpoint.x,0,state.checkpoint.z);
      // Never let it camp the respawn: move it to the far sector and grant a fresh escape window.
      monster.position.set(8,0,-28);
      state.monsterSeen=false;
      state.monsterNotice=0;
      state.monsterGrace=12;
      state.yaw=0; state.pitch=0; playerRig.rotation.y=0; camera.rotation.x=0;
    }
  }
  state.interactable = getInteractable();
  const actionButton = $("actionButton");
  if (state.interactable) {
    const t = state.interactable;
    let label = t.type === "key" ? `PICK UP ${t.object.userData.keyName} [E]` : t.type === "exit" ? "UNLOCK / ESCAPE [E]" : "OPEN DOOR [E]";
    ui.prompt.textContent = label;
    if (actionButton) { actionButton.textContent = t.type === "key" ? "PICK UP KEY" : t.type === "exit" ? "TRY EXIT" : "OPEN DOOR"; actionButton.classList.remove("hidden"); }
  } else {
    ui.prompt.textContent = "SEARCH THE SIDE ROOMS FOR 3 KEYS";
    if (actionButton) actionButton.classList.add("hidden");
  }
  sendState();
}
document.addEventListener("keydown", e => {
  state.keys.add(e.code);
  if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape" && state.active && !state.paused) pauseGame();
  if ((e.code === "ControlLeft" || e.code === "ControlRight") && state.active && !state.paused) {
    // Hold Ctrl while moving to crouch and reduce movement noise (noise AI comes later).
  }
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
$("menuCreditsButton")?.addEventListener("click", () => showOnly(ui.credits));
$("continueButton")?.addEventListener("click", () => {
  const savedName = localStorage.getItem("seeker_player_name");
  if (savedName) ui.name.value = savedName;
  startSession();
});
$("exitButton")?.addEventListener("click", () => {
  setStatus("To leave THE SEEKER, close this browser tab. Browser games cannot close tabs automatically.");
  showToast("SESSION TERMINATION REQUESTED — close this browser tab to exit.", 4200);
});
$("actionButton")?.addEventListener("click", () => { if (state.active && !state.paused) interact(); });
$("winReturnButton")?.addEventListener("click", () => { $("winScreen")?.classList.add("hidden"); leaveSession(); });
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
