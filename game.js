/* ========================================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   game.js - ULTIMATE MASSIVE EDITION
   ======================================================================== */

(() => {
    "use strict";

    /* ====================================================================
       CLASSES & COMPONENT MODULES
       ==================================================================== */

    /**
       FIRST-PERSON VIEWMODEL & PROCEDURAL ANIMATION CONTROLLER
       Manages drawing, idling, swaying, head-bobbing, and shooting/using items
       completely attached to the main projection camera matrix.
     */
    class AdvancedViewmodelController {
        constructor(game) {
            this.game = game;
            this.currentSlot = 1;
            
            this.equippedGroup = null;
            this.flashlightBeam = null;
            this.lensMesh = null;
            
            // Spatial anchoring vectors matching top-tier FPS parameters
            this.baseOffset = new THREE.Vector3(0.20, -0.24, -0.38);
            this.currentPosition = new THREE.Vector3().copy(this.baseOffset);
            this.currentRotation = new THREE.Vector3();
            
            this.swayTarget = new THREE.Vector2(0, 0);
            this.swayLag = new THREE.Vector2(0, 0);
            
            this.bobCycle = 0;
            this.drawProgress = 0.0; 
            this.recoilForce = 0;
            this.batteryPercentage = 100.0;
        }

        init() {
            this.instantiateItemModel(1);
        }

        instantiateItemModel(slotId) {
            this.clearCurrentMesh();

            if (slotId === 1) {
                // --- 3D MILITARY FLASHLIGHT MODEL ASSET ASSEMBLY ---
                const group = new THREE.Group();

                // Ribbed main chassis handle body
                const bodyGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.18, 16);
                bodyGeo.rotateX(Math.PI / 2);
                const bodyMat = new THREE.MeshStandardMaterial({ 
                    color: 0x141619, 
                    roughness: 0.7, 
                    metalness: 0.5,
                    bumpScale: 0.05
                });
                const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
                bodyMesh.castShadow = true;
                bodyMesh.receiveShadow = true;
                group.add(bodyMesh);

                // Heavy duty reinforced steel bezel ring caps
                const headGeo = new THREE.CylinderGeometry(0.026, 0.013, 0.05, 16);
                headGeo.rotateX(Math.PI / 2);
                headGeo.translate(0, 0, -0.09);
                const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.8, roughness: 0.25 });
                const headMesh = new THREE.Mesh(headGeo, headMat);
                headMesh.castShadow = true;
                group.add(headMesh);

                // Emissive focal glass layer boundary
                const lensGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.002, 16);
                lensGeo.rotateX(Math.PI / 2);
                lensGeo.translate(0, 0, -0.116);
                this.lensMat = new THREE.MeshBasicMaterial({ color: 0xfffdf0, transparent: true, opacity: 0.9 });
                this.lensMesh = new THREE.Mesh(lensGeo, this.lensMat);
                group.add(this.lensMesh);

                // Physically-grounded three-tier spotlight volumetric simulator
                this.flashlightBeam = new THREE.SpotLight(0xfffae6, 16.0, 32.0, Math.PI / 5.0, 0.35, 1.15);
                this.flashlightBeam.position.set(0, 0, -0.11);
                this.flashlightBeam.castShadow = true;
                this.flashlightBeam.shadow.mapSize.width = 2048;
                this.flashlightBeam.shadow.mapSize.height = 2048;
                this.flashlightBeam.shadow.camera.near = 0.1;
                this.flashlightBeam.shadow.camera.far = 35;
                this.flashlightBeam.shadow.bias = -0.0005;

                const lightTarget = new THREE.Object3D();
                lightTarget.position.set(0, 0, -10);
                group.add(lightTarget);
                this.flashlightBeam.target = lightTarget;
                
                group.add(this.flashlightBeam);
                this.equippedGroup = group;
                this.flashlightBeam.visible = this.game.flashlightOn;

            } else if (slotId === 2 && this.game.hasKey) {
                // --- 3D DECRYPTED SECURITY KEYCARD ASSEMBLY ---
                const group = new THREE.Group();
                const plateGeo = new THREE.BoxGeometry(0.005, 0.065, 0.10);
                plateGeo.rotateX(Math.PI / 3.5);
                plateGeo.rotateY(-Math.PI / 5);
                const plateMat = new THREE.MeshStandardMaterial({ color: 0x9e1b1b, metalness: 0.1, roughness: 0.3 });
                const plateMesh = new THREE.Mesh(plateGeo, plateMat);
                plateMesh.castShadow = true;
                group.add(plateMesh);

                // Emissive neon notification registration strip
                const stripGeo = new THREE.BoxGeometry(0.006, 0.01, 0.08);
                stripGeo.rotateX(Math.PI / 3.5);
                stripGeo.rotateY(-Math.PI / 5);
                stripGeo.translate(0, 0.015, 0.001);
                const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
                const stripMesh = new THREE.Mesh(stripGeo, stripMat);
                group.add(stripMesh);

                this.equippedGroup = group;
            } else {
                this.equippedGroup = null;
                return;
            }

            if (this.equippedGroup && this.game.camera) {
                this.game.camera.add(this.equippedGroup);
                this.drawProgress = 0.0; // Restarts drawing sequence matrix
                this.currentPosition.copy(this.baseOffset).y -= 0.4; // Positions asset beneath view boundary
            }
        }

        clearCurrentMesh() {
            if (this.equippedGroup && this.game.camera) {
                this.game.camera.remove(this.equippedGroup);
                this.equippedGroup.traverse((node) => {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
                        else node.material.dispose();
                    }
                });
                this.equippedGroup = null;
                this.flashlightBeam = null;
                this.lensMesh = null;
            }
        }

        switchSlot(slotId) {
            if (this.currentSlot === slotId) return;
            this.currentSlot = slotId;
            this.instantiateItemModel(slotId);
            this.game.audio.playSynthBeep(330, 0.04, "triangle");
        }

        triggerActionRecoil() {
            if (!this.equippedGroup) return;
            this.recoilForce = 0.07;
            this.currentRotation.x -= 0.15;
        }

        update(dt, velocity, mouseDx, mouseDy) {
            if (!this.equippedGroup) return;

            // 1. Flashlight Battery Depletion Logic & Light Flickering Engine
            if (this.currentSlot === 1 && this.game.flashlightOn && this.flashlightBeam) {
                this.batteryPercentage = Math.max(0, this.batteryPercentage - dt * 0.15); // Burn drain scalar
                
                // Triggers flickering mechanics if energy reserves fall below safety limits
                if (this.batteryPercentage < 30.0) {
                    const flickerChance = Math.random();
                    if (this.batteryPercentage < 10.0 && flickerChance > 0.6) {
                        this.flashlightBeam.intensity = 0;
                        if (this.lensMat) this.lensMat.color.setHex(0x222211);
                    } else if (flickerChance > 0.88) {
                        this.flashlightBeam.intensity = Math.random() * 4.0;
                        if (this.lensMat) this.lensMat.color.setHex(0x888844);
                    } else {
                        this.flashlightBeam.intensity = 6.0 * (this.batteryPercentage / 30.0);
                        if (this.lensMat) this.lensMat.color.setHex(0xfffdf0);
                    }
                } else {
                    this.flashlightBeam.intensity = 14.0;
                }

                // Update UI numerical element
                const batCounter = document.getElementById("battery-ui-readout");
                if (batCounter) {
                    batCounter.textContent = `BATTERY: ${Math.ceil(this.batteryPercentage)}%`;
                    batCounter.style.color = this.batteryPercentage < 20 ? "#ff3333" : "#d4af37";
                }
            }

            // 2. Linear Equipping Handoff Draw Interpolations
            this.drawProgress = THREE.MathUtils.lerp(this.drawProgress, 1.0, 8.5 * dt);
            const currentDrawY = THREE.MathUtils.lerp(-0.4, 0, this.drawProgress);

            // 3. Dual-Axis Mouse Sway Mechanics
            this.swayTarget.x = THREE.MathUtils.lerp(this.swayTarget.x, -mouseDx * 0.00065, 5.0 * dt);
            this.swayTarget.y = THREE.MathUtils.lerp(this.swayTarget.y, mouseDy * 0.00065, 5.0 * dt);
            this.swayTarget.x = THREE.MathUtils.clamp(this.swayTarget.x, -0.07, 0.07);
            this.swayTarget.y = THREE.MathUtils.clamp(this.swayTarget.y, -0.05, 0.05);

            this.swayLag.x = THREE.MathUtils.lerp(this.swayLag.x, this.swayTarget.x, 10.0 * dt);
            this.swayLag.y = THREE.MathUtils.lerp(this.swayLag.y, this.swayTarget.y, 10.0 * dt);

            // 4. Kinetic Velocity Weapon Bob Cycles
            const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
            if (horizontalSpeed > 0.05) {
                const multiplier = this.game.sprinting ? 1.8 : 1.2;
                this.bobCycle += dt * horizontalSpeed * 3.4 * multiplier;
this.baseOffset.y = -0.24 + Math.sin(this.bobCycle) * 0.0055;
this.baseOffset.x = 0.20 + Math.cos(this.bobCycle * 0.5) * 0.0035;
} else {
this.bobCycle += dt * 1.2; // Rhythmic breathing oscillation cycles
this.baseOffset.y = -0.24 + Math.sin(this.bobCycle) * 0.0008;
}
// 5. Recoil Mechanical Recovery
this.recoilForce = THREE.MathUtils.lerp(this.recoilForce, 0, 14.0 * dt);
// 6. Synthesis Transform Vector Compilation Maps
const finalX = this.baseOffset.x + this.swayLag.x;
const finalY = this.baseOffset.y + currentDrawY + this.swayLag.y;
const finalZ = this.baseOffset.z + this.recoilForce;
this.equippedGroup.position.set(finalX, finalY, finalZ);
this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, 0, 10.0 * dt);
this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.swayLag.x * 0.45, 10.0 * dt);
this.currentRotation.z = THREE.MathUtils.lerp(this.currentRotation.z, this.swayLag.x * 0.2, 10.0 * dt);
this.equippedGroup.rotation.set(this.currentRotation.x, this.currentRotation.y, this.currentRotation.z);
}
}
/**
INTERNAL SUB-SYNTH WEB-AUDIO EFFECTS PROCESSOR
Generates procedural spatialized cues, alerts, and atmospheric pads entirely through code pipelines.
*/
class InternalAudioDirector {
constructor() {
this.ctx = null;
this.out = null;
}
init() {
try {
const HostCtx = window.AudioContext || window.webkitAudioContext;
if (!HostCtx) return;
this.ctx = new HostCtx();
this.out = this.ctx.createGain();
this.out.gain.setValueAtTime(0.6, this.ctx.currentTime);
this.out.connect(this.ctx.destination);
} catch (_) {}
}
resume() {
if (this.ctx && this.ctx.state === "suspended") {
this.ctx.resume().catch(() => {});
}
}
playSynthBeep(freq, length, shape = "sine") {
this.resume();
if (!this.ctx) this.init();
if (!this.ctx) return;
try {
const now = this.ctx.currentTime;
const osc = this.ctx.createOscillator();
const gain = this.ctx.createGain();
osc.type = shape;
osc.frequency.setValueAtTime(freq, now);
gain.gain.setValueAtTime(0.06, now);
gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
osc.connect(gain);
gain.connect(this.out);
osc.start(now);
osc.stop(now + length + 0.01);
} catch (_) {}
}
playHeavyStomp(panValue = 0) {
this.resume();
if (!this.ctx) return;
try {
const now = this.ctx.currentTime;
const osc = this.ctx.createOscillator();
const gain = this.ctx.createGain();
const panner = this.ctx.createStereoPanner();
osc.type = "triangle";
osc.frequency.setValueAtTime(65, now);
osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
gain.gain.setValueAtTime(0.3, now);
gain.gain.linearRampToValueAtTime(0.0, now + 0.28);
panner.pan.setValueAtTime(THREE.MathUtils.clamp(panValue, -1, 1), now);
osc.connect(gain);
gain.connect(panner);
panner.connect(this.out);
osc.start(now);
osc.stop(now + 0.3);
} catch (_) {}
}
}
/**
STALKER AI EXTERMINATOR SIMULATION MATRIX
Governs finite state transitions, sensory checking loops, and pathway targets.
*/
class HunterEntityBrain {
constructor(game, mesh) {
this.game = game;
this.mesh = mesh;
this.states = Object.freeze({ IDLE: 0, WANDER: 1, STALK: 2, HUNT: 3 });
this.currentState = this.states.IDLE;
this.position = new THREE.Vector3(0, 0, -15);
this.targetDestination = new THREE.Vector3();
this.patrolWaypoints = [];
this.stateTimer = 0;
this.stompInterval = 0.85;
this.stompTimer = 0;
this.alertness = 0.0; // Scaling detection meter
this.sensoryRadius = 14.0;
}
init() {
if (this.mesh) {
this.mesh.position.copy(this.position);
}
// Populate procedural facility patrol zones
this.patrolWaypoints.push(new THREE.Vector3(12, 0, -12));
this.patrolWaypoints.push(new THREE.Vector3(-15, 0, -8));
this.patrolWaypoints.push(new THREE.Vector3(4, 0, 16));
this.patrolWaypoints.push(new THREE.Vector3(-6, 0, -18));
this.pickRandomWanderPoint();
this.currentState = this.states.WANDER;
}
pickRandomWanderPoint() {
const index = Math.floor(Math.random() * this.patrolWaypoints.length);
this.targetDestination.copy(this.patrolWaypoints[index]);
}
evaluateSensoryInput(dt, playerPos) {
const distance = this.position.distanceTo(playerPos);
this.game.seekerTargetDistance = distance; // Core diagnostics integration bridge
let detectionMultiplier = 1.0;
if (this.game.flashlightOn && distance < 20.0) {
// If light beams collide inside proximity paths, detection chances spike exponentially
detectionMultiplier += 2.5;
}
if (this.game.sprinting && distance < this.sensoryRadius * 1.5) {
detectionMultiplier += 2.0;
}
// Sensory processing equations
if (distance < this.sensoryRadius) {
this.alertness = Math.min(100.0, this.alertness + dt * (18.0 / distance) * detectionMultiplier);
} else {
this.alertness = Math.max(0.0, this.alertness - dt * 4.5);
}
// State Transition Processing Logic Matrices
if (this.alertness >= 85.0 && this.currentState !== this.states.HUNT) {
this.currentState = this.states.HUNT;
this.game.audio.playSynthBeep(110, 0.6, "sawtooth"); // Audio alarm dispatch trigger
} else if (this.alertness >= 35.0 && this.alertness < 85.0 && this.currentState !== this.states.STALK) {
this.currentState = this.states.STALK;
} else if (this.alertness < 15.0 && this.currentState === this.states.STALK) {
this.currentState = this.states.WANDER;
this.pickRandomWanderPoint();
}
}
update(dt, playerPos) {
if (!this.mesh || !this.game.seekerActive) return;
this.position.copy(this.mesh.position);
this.evaluateSensoryInput(dt, playerPos);
let currentSpeed = this.game.seekerSpeed;
// Adjust execution dynamics matching FSM parameters
switch (this.currentState) {
case this.states.WANDER:
currentSpeed = 2.4;
if (this.position.distanceTo(this.targetDestination) < 1.0) {
this.pickRandomWanderPoint();
}
break;
case this.states.STALK:
currentSpeed = 3.6;
this.targetDestination.copy(playerPos); // Tracks down current positioning indices
break;
case this.states.HUNT:
currentSpeed = 5.2; // Exceeds standard walking speeds
this.targetDestination.copy(playerPos);
break;
}
// Perform position mutations across coordinate tracks
const movementDirection = new THREE.Vector3().subVectors(this.targetDestination, this.position);
movementDirection.y = 0; // Locks height modifications
if (movementDirection.lengthSq() > 0.01) {
movementDirection.normalize();
this.mesh.position.addScaledVector(movementDirection, currentSpeed * dt);
// Rotates mesh forward along velocity path trajectories
const targetRotation = Math.atan2(movementDirection.x, movementDirection.z);
this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetRotation, 6.0 * dt);
}
// Footstep frequency mapping models
this.stompInterval = this.currentState === this.states.HUNT ? 0.42 : 0.85;
this.stompTimer += dt;
if (this.stompTimer >= this.stompInterval) {
this.stompTimer = 0;
// Compute pan metrics relative to camera forward alignment vectors
const cameraDirection = new THREE.Vector3();
this.game.camera.getWorldDirection(cameraDirection);
const relativePlayerVector = new THREE.Vector3().subVectors(this.position, playerPos).normalize();
const panMetric = relativePlayerVector.cross(cameraDirection).y;
this.game.audio.playHeavyStomp(panMetric);
}
}
}
/* ====================================================================
THE SEEKER RE-ARCHITECTED SYSTEM LAYOUT INTEGRATION
==================================================================== */
const Game = {
started: false,
paused: false,
multiplayer: false,
platform: "pc",
map: "facility",
scene: null,
camera: null,
renderer: null,
clock: null,
worldGroup: null,
player: null,
seeker: null,
colliders: [],
interactables: [],
decorations: [],
buttons: [],
buttonsFound: new Set(),
key: null,
hasKey: false,
gate: null,
gateUnlocked: false,
velocity: new THREE.Vector3(),
moveVector: new THREE.Vector3(),
keys: new Set(),
yaw: 0,
pitch: 0,
mouseLocked: false,
sprinting: false,
playerSpeed: 4.2,
sprintSpeed: 6.8,
staminaLevel: 100.0,
setupDuration: 180,
setupRemaining: 180,
seekerActive: false,
seekerSpeed: 2.8,
seekerTargetDistance: Infinity,
seekerTimer: null,
flashlightOn: true,
viewmodel: null,
audio: null,
ai: null,
groundItems: [],
activeLookItem: null,
currentMouseDeltaX: 0,
currentMouseDeltaY: 0,
joystick: {
moveX: 0,
moveY: 0,
lookX: 0,
lookY: 0,
sprint: false
},
remotePlayers: new Map(),
lastNetworkSend: 0,
minimap: {
world: null,
player: null,
seeker: null
},
/* ======================================================
START GAME GRAPHICS & COMPONENT INIT PIPELINES
====================================================== */
start(options = {}) {
if (this.started) {
this.stop();
}
this.started = true;
this.paused = false;
this.multiplayer = !!options.multiplayer;
this.platform = options.platform === "mobile" ? "mobile" : "pc";
this.map = options.map || "facility";
this.setupDuration = 180;
this.setupRemaining = 180;
this.staminaLevel = 100.0;
this.buttonsFound.clear();
this.hasKey = false;
this.gateUnlocked = false;
this.seekerActive = false;
this.keys.clear();
this.clock = new THREE.Clock();
// Run central rendering allocations
this.createRenderer();
this.createScene();
this.createCamera();
this.createLights();
// Assemble environment architecture meshes
this.createWorld();
this.createPlayer();
this.createSeeker();
this.createObjectives();
this.createMinimap();
// Instantiation of engine modules
this.audio = new InternalAudioDirector();
this.audio.init();
this.viewmodel = new AdvancedViewmodelController(this);
this.viewmodel.init();
this.ai = new HunterEntityBrain(this, this.seeker);
this.ai.init();
this.bindControls();
this.bindGameEvents();
this.resize();
window.addEventListener("resize", this.resizeBound);
this.startSetupTimer();
this.lastNetworkSend = performance.now();
this.animate();
window.dispatchEvent(new CustomEvent("seeker:game-ready"));
},
/* ======================================================
STOP ROUTINE DISPOSAL PIPELINES
====================================================== */
stop() {
this.started = false;
this.paused = false;
clearInterval(this.seekerTimer);
this.seekerTimer = null;
if (this.viewmodel) {
this.viewmodel.clearCurrentMesh();
this.viewmodel = null;
}
if (this.renderer) {
this.renderer.domElement.removeEventListener("click", this.requestPointerLockBound);
}
document.removeEventListener("keydown", this.keyDownBound);
document.removeEventListener("keyup", this.keyUpBound);
if (this.platform === "pc") {
document.removeEventListener("mousemove", this.mouseMoveBound);
document.removeEventListener("mousedown", this.mouseDownBound);
document.removeEventListener("pointerlockchange", this.pointerLockBound);
}
window.removeEventListener("resize", this.resizeBound);
this.remotePlayers.forEach((entry) => {
if (entry.mesh) this.scene?.remove(entry.mesh);
});
this.remotePlayers.clear();
// Iterative memory garbage management
if (this.scene) {
this.scene.traverse((node) => {
if (node.geometry) node.geometry.dispose();
if (node.material) {
if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
else node.material.dispose();
}
});
}
if (this.renderer) this.renderer.dispose();
this.scene = null;
this.camera = null;
this.renderer = null;
this.player = null;
this.seeker = null;
this.colliders = [];
this.interactables = [];
this.decorations = [];
this.groundItems = [];
this.ai = null;
},
restart() {
const config = {
multiplayer: this.multiplayer,
platform: this.platform,
map: this.map
};
this.stop();
setTimeout(() => this.start(config), 100);
},
pause() { this.paused = true; },
resume() {
this.paused = false;
if (this.clock) this.clock.getDelta();
},
/* ======================================================
GRAPHICS DEVICE TARGET BUFFER CREATION
====================================================== */
createRenderer() {
const canvas = document.getElementById("gameCanvas");
this.renderer = new THREE.WebGLRenderer({
canvas,
antialias: true,
powerPreference: "high-performance"
});
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
this.renderer.setSize(window.innerWidth, window.innerHeight, false);
this.renderer.shadowMap.enabled = true;
this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
this.renderer.outputColorSpace = THREE.SRGBColorSpace;
this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
this.renderer.toneMappingExposure = 1.0;
},
createScene() {
this.scene = new THREE.Scene();
this.scene.background = new THREE.Color(0x020304);
this.scene.fog = new THREE.FogExp2(0x020304, 0.016);
this.worldGroup = new THREE.Group();
this.scene.add(this.worldGroup);
},
createCamera() {
this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.02, 1000);
this.camera.position.set(0, 1.7, 0);
this.scene.add(this.camera);
},
createLights() {
const lowAmbient = new THREE.AmbientLight(0x05070a, 0.18);
this.scene.add(lowAmbient);
},
/* ======================================================
MAP GEOMETRY ARCHITECTURE SANDBOX ASSEMBLER
====================================================== */
createWorld() {
// Main Industrial Floor Plane
const floorGeo = new THREE.PlaneGeometry(120, 120);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x111314, roughness: 0.85, metalness: 0.2 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
this.worldGroup.add(floor);
this.colliders.push(floor);
// Sub-routine function generator to cleanly build solid bounding architecture walls
const createWallBlock = (w, h, d, x, y, z, colorHex = 0x1c1e21) => {
const geo = new THREE.BoxGeometry(w, h, d);
const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 });
const mesh = new THREE.Mesh(geo, mat);
mesh.position.set(x, y, z);
mesh.castShadow = true;
mesh.receiveShadow = true;
this.worldGroup.add(mesh);
this.colliders.push(mesh);
};
// Facility Perimeter Structural Enclosures
createWallBlock(120, 8, 2, 0, 4, -60);
createWallBlock(120, 8, 2, 0, 4, 60);
createWallBlock(2, 8, 120, -60, 4, 0);
createWallBlock(2, 8, 120, 60, 4, 0);
// Internal Maze Corridors Partition Layout
createWallBlock(20, 8, 3, -10, 4, -20);
createWallBlock(3, 8, 35, 15, 4, 5);
createWallBlock(25, 8, 3, -25, 4, 15);
createWallBlock(30, 8, 3, 20, 4, -30);
// Facility Main Output Gate Frame
const gateFrameGeo = new THREE.BoxGeometry(8, 6, 0.4);
const gateFrameMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.6 });
this.gate = new THREE.Mesh(gateFrameGeo, gateFrameMat);
this.gate.position.set(0, 3, 58.5);
this.gate.castShadow = true;
this.worldGroup.add(this.gate);
this.colliders.push(this.gate);
},
createPlayer() {
this.player = new THREE.Object3D();
this.player.position.set(0, 0, 10); // Start coordinates safely detached from walls
this.scene.add(this.player);
},
createSeeker() {
// Generates an intimidating multi-tiered monolithic red tower silhouette mesh to act as monster asset
const hunterGroup = new THREE.Group();
const coreGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.2, 8);
const coreMat = new THREE.MeshStandardMaterial({ color: 0x471010, roughness: 0.9, metalness: 0.1 });
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
coreMesh.position.y = 1.1;
coreMesh.castShadow = true;
hunterGroup.add(coreMesh);
const eyeGeo = new THREE.BoxGeometry(0.4, 0.08, 0.1);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
eyeMesh.position.set(0, 1.8, -0.32);
hunterGroup.add(eyeMesh);
this.seeker = hunterGroup;
this.scene.add(this.seeker);
this.seekerActive = true;
},
/* ======================================================
3D PROXIMITY PROCEDURAL OBJECTIVE ITEMS SPAWNER
====================================================== */
createObjectives() {
this.groundItems = [];
const cardGroup = new THREE.Group();
const cardGeo = new THREE.BoxGeometry(0.012, 0.07, 0.11);
const cardMat = new THREE.MeshStandardMaterial({ color: 0x9e1b1b, roughness: 0.3 });
const cardMesh = new THREE.Mesh(cardGeo, cardMat);
cardMesh.castShadow = true;
cardGroup.add(cardMesh);
cardGroup.position.set(-15, 0.03, -12); // Hidden behind division partition blocks
cardGroup.rotation.x = Math.PI / 2;
this.scene.add(cardGroup);
// Renders fully custom 3D canvas textures directly mapping interactive instructions text tags
const canvas = document.createElement("canvas");
canvas.width = 256; canvas.height = 64;
const ctx = canvas.getContext("2d");
ctx.fillStyle = "rgba(8, 9, 10, 0.9)"; ctx.fillRect(0, 0, 256, 64);
ctx.strokeStyle = "rgba(212, 175, 55, 0.7)"; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 252, 60);
ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
ctx.fillText("PRESS [E] TO COLLECT KEYCARD", 128, 32);
const texture = new THREE.CanvasTexture(canvas);
const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
const textGeo = new THREE.PlaneGeometry(0.6, 0.15);
const textMesh = new THREE.Mesh(textGeo, textMat);
textMesh.position.set(-15, 0.4, -12);
textMesh.visible = false;
this.scene.add(textMesh);
this.groundItems.push({
mesh: cardGroup,
textMesh: textMesh,
type: "keycard",
targetSlot: 2,
displayName: "KEYCARD",
radius: 1.8
});
},
createMinimap() {},
startSetupTimer() {
this.seekerTimer = setInterval(() => {
if (this.started && !this.paused) {
this.setupRemaining = Math.max(0, this.setupRemaining - 1);
const timeUi = document.getElementById("timer-ui-display");
if (timeUi) {
const mins = Math.floor(this.setupRemaining / 60);
const secs = this.setupRemaining % 60;
timeUi.textContent = ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')};
}
}
}, 1000);
},
/* ======================================================
INPUT CAPTURE HANDLER NETWORKS
====================================================== */
bindControls() {
this.keyDownBound = this.handleKeyDown.bind(this);
this.keyUpBound = this.handleKeyUp.bind(this);
this.mouseMoveBound = this.handleMouseMove.bind(this);
this.mouseDownBound = this.handleMouseDown.bind(this);
this.pointerLockBound = this.handlePointerLockChange.bind(this);
this.requestPointerLockBound = this.requestPointerLock.bind(this);
this.resizeBound = this.resize.bind(this);
document.addEventListener("keydown", this.keyDownBound);
document.addEventListener("keyup", this.keyUpBound);
if (this.platform === "pc") {
document.addEventListener("mousemove", this.mouseMoveBound);
document.addEventListener("mousedown", this.mouseDownBound);
this.renderer.domElement.addEventListener("click", this.requestPointerLockBound);
document.addEventListener("pointerlockchange", this.pointerLockBound);
}
},
requestPointerLock() {
if (!this.mouseLocked && this.platform === "pc" && this.started) {
this.renderer.domElement.requestPointerLock();
}
},
handlePointerLockChange() {
this.mouseLocked = document.pointerLockElement === this.renderer.domElement;
},
handleKeyDown(typeEvent) {
this.keys.add(typeEvent.code);
// Sprint constraints check
if (typeEvent.code === "ShiftLeft" && this.staminaLevel > 5.0) {
this.sprinting = true;
}
// Keyboard direct numerical slot switches matching your layout specification code patterns exactly
if (typeEvent.key === "1" || typeEvent.key === "2" || typeEvent.key === "3" || typeEvent.key === "4") {
const parsedId = parseInt(typeEvent.key);
document.querySelectorAll(".inventory-slot").forEach(node => node.classList.remove("active"));
const targetedDomNode = document.getElementById(inventorySlot${parsedId});
if (targetedDomNode) targetedDomNode.classList.add("active");
if (this.viewmodel) {
this.viewmodel.switchSlot(parsedId);
}
}
// [E] Collect Proximate Object Action Trigger
if (typeEvent.code === "KeyE" && this.activeLookItem) {
const targetedItem = this.activeLookItem;
this.scene.remove(targetedItem.mesh);
if (targetedItem.textMesh) this.scene.remove(targetedItem.textMesh);
this.groundItems = this.groundItems.filter(entry => entry !== targetedItem);
if (targetedItem.type === "keycard") {
this.hasKey = true;
}
// Mutates identical elements layout contents cleanly to reflect structural updates
const cellButton = document.getElementById(inventorySlot${targetedItem.targetSlot});
if (cellButton) {
const textLabel = cellButton.querySelector(".slot-name");
if (textLabel) textLabel.textContent = targetedItem.displayName;
const symbolSpan = cellButton.querySelector(".slot-icon");
if (symbolSpan) symbolSpan.className = slot-icon ${targetedItem.type}-symbol;
}
this.audio.playSynthBeep(440, 0.15, "sine");
this.activeLookItem = null;
}
// [E] Facility Gate Open Verification Sequence
if (typeEvent.code === "KeyE" && !this.activeLookItem && this.player && this.gate) {
const distanceToGate = this.player.position.distanceTo(this.gate.position);
if (distanceToGate < 3.5) {
if (this.hasKey) {
this.gateUnlocked = true;
this.scene.remove(this.gate); // Deletes block obstacle to let player exit
this.audio.playSynthBeep(520, 0.4, "triangle");
alert("THE FACILITY GATE HAS OPENED. ESCAPE!");
} else {
this.audio.playSynthBeep(120, 0.25, "sawtooth");
alert("GATE ACQUISITION FORBIDDEN. LEVEL SECURITY KEYCARD REQUIRED.");
}
}
}
},
handleKeyUp(typeEvent) {
this.keys.delete(typeEvent.code);
if (typeEvent.code === "ShiftLeft") {
this.sprinting = false;
}
},
handleMouseMove(typeEvent) {
if (!this.mouseLocked) return;
const scaleSensitivity = 0.0020;
this.yaw -= typeEvent.movementX * scaleSensitivity;
this.pitch -= typeEvent.movementY * scaleSensitivity;
this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
this.currentMouseDeltaX += typeEvent.movementX;
this.currentMouseDeltaY += typeEvent.movementY;
},
handleMouseDown(typeEvent) {
if (!this.mouseLocked && this.platform === "pc") return;
if (typeEvent.button === 0 && this.viewmodel) {
this.viewmodel.triggerActionRecoil();
this.audio.playSynthBeep(680, 0.03, "sine");
// Toggle logic branch for flashlight beam assets
if (this.viewmodel.currentSlot === 1 && this.viewmodel.flashlightBeam) {
this.flashlightOn = !this.flashlightOn;
this.viewmodel.flashlightBeam.visible = this.flashlightOn;
}
}
},
/* ======================================================
CENTRAL TICK RENDER ANIMATION TIMELINE MATRICES
====================================================== */
animate() {
if (!this.started) return;
requestAnimationFrame(() => this.animate());
if (this.paused) return;
const dt = Math.min(this.clock.getDelta(), 0.1);
// 1. Perspective Look Allocations
if (this.platform === "pc" && this.mouseLocked) {
if (this.player) this.player.rotation.y = this.yaw;
if (this.camera) this.camera.rotation.x = this.pitch;
}
// 2. Stamina Meter Burning & Recovery Calculations
if (this.sprinting && (this.keys.has("KeyW") || this.keys.has("KeyS"))) {
this.staminaLevel = Math.max(0.0, this.staminaLevel - dt * 22.0); // Burn velocity
if (this.staminaLevel <= 0.0) this.sprinting = false;
} else {
this.staminaLevel = Math.min(100.0, this.staminaLevel + dt * 14.0); // Recovery scalar
}
// Update flat UI bar tracking if available
const barUi = document.getElementById("stamina-ui-bar");
if (barUi) barUi.style.width = ${this.staminaLevel}%;
// 3. Movement Translation Computations & Basic Wall Sliding
this.moveVector.set(0, 0, 0);
if (this.keys.has("KeyW")) this.moveVector.z -= 1;
if (this.keys.has("KeyS")) this.moveVector.z += 1;
if (this.keys.has("KeyA")) this.moveVector.x -= 1;
if (this.keys.has("KeyD")) this.moveVector.x += 1;
this.moveVector.normalize();
const currentVelocitySpeed = this.sprinting ? this.sprintSpeed : this.playerSpeed;
this.velocity.copy(this.moveVector).applyQuaternion(this.player ? this.player.quaternion : new THREE.Quaternion()).multiplyScalar(currentVelocitySpeed);
if (this.player) {
// Primitive bounding box layout containment calculations (keeps player inside 120x120 perimeter)
const nextX = this.player.position.x + this.velocity.x * dt;
const nextZ = this.player.position.z + this.velocity.z * dt;
if (Math.abs(nextX) < 58.5) this.player.position.x = nextX;
if (Math.abs(nextZ) < 58.5) this.player.position.z = nextZ;
if (this.camera) {
this.camera.position.copy(this.player.position);
this.camera.position.y += 1.7; // Sync viewport with head position matrix offsets
}
}
// 4. Update AI Brain State Machine
if (this.ai && this.player) {
this.ai.update(dt, this.player.position);
// Jumpscare/Caught trigger condition checks
if (this.seekerTargetDistance < 1.4) {
this.stop();
alert("YOU WERE CAUGHT BY THE SEEKER. GAME OVER.");
window.dispatchEvent(new CustomEvent("seeker:player-caught"));
return;
}
}
// 5. 3D Billboard Proximity Tracking Conversions
let focalTargetItem = null;
if (this.player && this.groundItems) {
for (let item of this.groundItems) {
const scalarRange = this.player.position.distanceTo(item.mesh.position);
if (scalarRange < item.radius) {
focalTargetItem = item;
if (item.textMesh) {
item.textMesh.visible = true;
item.textMesh.lookAt(this.camera.position); // Billboard lock tracking loop
}
} else {
if (item.textMesh) item.textMesh.visible = false;
}
}
}
this.activeLookItem = focalTargetItem;
// 6. Refresh Viewmodel Position Frame Positions
if (this.viewmodel) {
this.viewmodel.update(dt, this.velocity, this.currentMouseDeltaX, this.currentMouseDeltaY);
}
// Reset look axis metrics right at framebuffer swap entry lines
this.currentMouseDeltaX = 0;
this.currentMouseDeltaY = 0;
// 7. Push Pixel Matrix Buffers to WebGL Device Context
if (this.renderer && this.scene && this.camera) {
this.renderer.render(this.scene, this.camera);
}
},
resize() {
if (!this.renderer || !this.camera) return;
this.camera.aspect = window.innerWidth / window.innerHeight;
this.camera.updateProjectionMatrix();
this.renderer.setSize(window.innerWidth, window.innerHeight, false);
}
};
window.Game = Game;
})();