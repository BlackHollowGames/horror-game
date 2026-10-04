/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   game.js
   ============================================================ */

(() => {
    "use strict";

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

        playerSpeed: 4.4,
        sprintSpeed: 7.2,

        setupDuration: 180,
        setupRemaining: 180,

        seekerActive: false,
        seekerSpeed: 2.8,
        seekerTargetDistance: Infinity,
        seekerTimer: null,

        flashlightOn: true,

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
           START
           ====================================================== */

        start(options = {}) {
            if (this.started) {
                this.stop();
            }

            this.started = true;
            this.paused = false;

            this.multiplayer =
                !!options.multiplayer;

            this.platform =
                options.platform === "mobile"
                    ? "mobile"
                    : "pc";

            this.map =
                options.map ||
                "facility";

            this.setupDuration = 180;
            this.setupRemaining = 180;

            this.buttonsFound.clear();

            this.hasKey = false;
            this.gateUnlocked = false;

            this.seekerActive = false;

            this.keys.clear();

            this.clock =
                new THREE.Clock();

            this.createRenderer();
            this.createScene();
            this.createCamera();
            this.createLights();

            this.createWorld();
            this.createPlayer();
            this.createSeeker();
            this.createObjectives();
            this.createMinimap();

            this.bindControls();
            this.bindGameEvents();

            this.resize();

            window.addEventListener(
                "resize",
                this.resizeBound
            );

            this.startSetupTimer();

            this.lastNetworkSend =
                performance.now();

            this.animate();

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:game-ready"
                )
            );
        },

        /* ======================================================
           STOP
           ====================================================== */

        stop() {
            this.started = false;
            this.paused = false;

            clearInterval(
                this.seekerTimer
            );

            this.seekerTimer = null;

            if (this.renderer) {
                this.renderer
                    .domElement
                    .removeEventListener(
                        "click",
                        this.requestPointerLockBound
                    );
            }

            document.removeEventListener(
                "keydown",
                this.keyDownBound
            );

            document.removeEventListener(
                "keyup",
                this.keyUpBound
            );

            document.removeEventListener(
                "mousemove",
                this.mouseMoveBound
            );

            document.removeEventListener(
                "pointerlockchange",
                this.pointerLockBound
            );

            window.removeEventListener(
                "resize",
                this.resizeBound
            );

            this.stopAudio();

            this.remotePlayers.forEach(
                (entry) => {
                    if (entry.mesh) {
                        this.scene?.remove(
                            entry.mesh
                        );
                    }
                }
            );

            this.remotePlayers.clear();

            if (this.renderer) {
                this.renderer.dispose();
            }

            const canvas =
                document.getElementById(
                    "gameCanvas"
                );

            if (
                canvas &&
                canvas.parentNode &&
                this.renderer?.domElement !== canvas
            ) {
                canvas
                    .getContext("2d")
                    ?.clearRect(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
            }

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.player = null;
            this.seeker = null;
            this.colliders = [];
            this.interactables = [];
            this.decorations = [];
        },

        restart() {
            const config = {
                multiplayer:
                    this.multiplayer,
                platform:
                    this.platform,
                map:
                    this.map,
                lobby:
                    window.Main?.state?.lobby ||
                    null
            };

            this.stop();

            setTimeout(
                () => this.start(config),
                80
            );
        },

        pause() {
            this.paused = true;
        },

        resume() {
            this.paused = false;

            if (this.clock) {
                this.clock.getDelta();
            }
        },

        /* ======================================================
           RENDERER
           ====================================================== */

        createRenderer() {
            const canvas =
                document.getElementById(
                    "gameCanvas"
                );

            this.renderer =
                new THREE.WebGLRenderer({
                    canvas,
                    antialias: true,
                    powerPreference:
                        "high-performance"
                });

            this.renderer.setPixelRatio(
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );

            this.renderer.setSize(
                window.innerWidth,
                window.innerHeight,
                false
            );

            this.renderer.shadowMap.enabled =
                true;

            this.renderer.shadowMap.type =
                THREE.PCFSoftShadowMap;

            this.renderer.outputColorSpace =
                THREE.SRGBColorSpace;

            this.renderer.toneMapping =
                THREE.ACESFilmicToneMapping;

            this.renderer.toneMappingExposure =
                1.05;
        },

        /* ======================================================
           SCENE
           ====================================================== */

        createScene() {
            this.scene =
                new THREE.Scene();

            this.scene.background =
                new THREE.Color(
                    0x030405
                );

            this.scene.fog =
                new THREE.FogExp2(
                    0x050608,
                    0.014
                );

            this.worldGroup =
                new THREE.Group();

            this.worldGroup.name =
                "SEEKER_WORLD";

            this.scene.add(
                this.worldGroup
            );
        },

        /* ======================================================
           CAMERA
           ====================================================== */

        createCamera() {
            this.camera =
                new THREE.PerspectiveCamera(
                    72,
                    window.innerWidth /
                        window.innerHeight,
                    0.05,
                    500
                );

            this.camera.rotation.order =
                "YXZ";

            this.yaw = 0;
            this.pitch = -0.03;

            this.camera.rotation.y =
                this.yaw;

            this.camera.rotation.x =
                this.pitch;
        },

        /* ======================================================
           LIGHTING
           ====================================================== */

        createLights() {
            const ambient =
                new THREE.HemisphereLight(
                    0x8c96a3,
                    0x11100e,
                    0.6
                );

            this.scene.add(
                ambient
            );

            const moon =
                new THREE.DirectionalLight(
                    0x8ba0bf,
                    0.6
                );

            moon.position.set(
                -30,
                40,
                10
            );

            moon.castShadow =
                true;

            moon.shadow.mapSize.width =
                2048;

            moon.shadow.mapSize.height =
                2048;

            moon.shadow.camera.near =
                1;

            moon.shadow.camera.far =
                160;

            moon.shadow.camera.left =
                -80;

            moon.shadow.camera.right =
                80;

            moon.shadow.camera.top =
                80;

            moon.shadow.camera.bottom =
                -80;

            this.scene.add(
                moon
            );
        },

        /* ======================================================
           MATERIALS
           ====================================================== */

        material(
            color,
            roughness = 0.8,
            metalness = 0
        ) {
            return new THREE.MeshStandardMaterial({
                color,
                roughness,
                metalness
            });
        },

        /* ======================================================
           WORLD
           ====================================================== */

        createWorld() {
            this.createGround();
            this.createOuterWalls();

            if (
                this.map === "underground"
            ) {
                this.createUndergroundMap();
            } else if (
                this.map === "blackwood"
            ) {
                this.createForestMap();
            } else {
                this.createFacilityMap();
            }
        },

        createGround() {
            const geometry =
                new THREE.PlaneGeometry(
                    150,
                    120
                );

            const material =
                this.material(
                    0x17191a,
                    0.95
                );

            const ground =
                new THREE.Mesh(
                    geometry,
                    material
                );

            ground.rotation.x =
                -Math.PI / 2;

            ground.receiveShadow =
                true;

            ground.position.y =
                0;

            this.worldGroup.add(
                ground
            );
        },

        createOuterWalls() {
            const thickness = 2;
            const height = 7;

            this.createWall(
                0,
                height / 2,
                -60,
                150,
                height,
                thickness
            );

            this.createWall(
                0,
                height / 2,
                60,
                150,
                height,
                thickness
            );

            this.createWall(
                -75,
                height / 2,
                0,
                thickness,
                height,
                120
            );

            this.createWall(
                75,
                height / 2,
                0,
                thickness,
                height,
                120
            );
        },

        createFacilityMap() {
            this.createBuilding(
                0,
                4,
                10,
                62,
                8,
                42,
                "MAIN FACILITY"
            );

            this.createBuilding(
                -47,
                3,
                4,
                24,
                6,
                30,
                "STORAGE"
            );

            this.createBuilding(
                45,
                3,
                -12,
                28,
                6,
                25,
                "CONTROL"
            );

            this.createBuilding(
                0,
                3,
                48,
                38,
                6,
                14,
                "SECURITY"
            );

            this.createRoomDividers();
            this.createFacilityDetails();

            this.createExitGate(
                0,
                1.2,
                58.5
            );
        },

        createUndergroundMap() {
            this.createBuilding(
                0,
                4,
                0,
                70,
                8,
                70,
                "UNDERGROUND"
            );

            this.createBuilding(
                -53,
                3,
                0,
                18,
                6,
                28,
                "GENERATOR"
            );

            this.createBuilding(
                53,
                3,
                0,
                18,
                6,
                28,
                "PUMP ROOM"
            );

            this.createUndergroundDetails();

            this.createExitGate(
                0,
                1.2,
                58.5
            );
        },

        createForestMap() {
            this.createForestDetails();

            this.createSmallBuilding(
                0,
                3,
                15,
                25,
                18,
                6
            );

            this.createSmallBuilding(
                -42,
                2.8,
                -22,
                18,
                12,
                5
            );

            this.createSmallBuilding(
                42,
                2.8,
                8,
                18,
                12,
                5
            );

            this.createExitGate(
                0,
                1.2,
                58.5
            );
        },

        /* ======================================================
           BUILDINGS
           ====================================================== */

        createBuilding(
            x,
            y,
            z,
            width,
            height,
            depth,
            name
        ) {
            const group =
                new THREE.Group();

            group.name = name;

            this.addRoomShell(
                group,
                width,
                height,
                depth
            );

            group.position.set(
                x,
                y,
                z
            );

            this.worldGroup.add(
                group
            );
        },

        createSmallBuilding(
            x,
            y,
            z,
            width,
            depth,
            height
        ) {
            this.createBuilding(
                x,
                y,
                z,
                width,
                height,
                depth,
                "STRUCTURE"
            );
        },

        addRoomShell(
            group,
            width,
            height,
            depth
        ) {
            const wallMaterial =
                this.material(
                    0x242628,
                    0.86
                );

            const floorMaterial =
                this.material(
                    0x131516,
                    0.97
                );

            const floor =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.35,
                        depth
                    ),
                    floorMaterial
                );

            floor.position.y =
                -0.16;

            floor.receiveShadow =
                true;

            group.add(
                floor
            );

            this.addBuildingWall(
                group,
                0,
                height / 2,
                -depth / 2,
                width,
                height,
                0.6,
                wallMaterial
            );

            this.addBuildingWall(
                group,
                0,
                height / 2,
                depth / 2,
                width,
                height,
                0.6,
                wallMaterial
            );

            this.addBuildingWall(
                group,
                -width / 2,
                height / 2,
                0,
                0.6,
                height,
                depth,
                wallMaterial
            );

            this.addBuildingWall(
                group,
                width / 2,
                height / 2,
                0,
                0.6,
                height,
                depth,
                wallMaterial
            );
        },

        addBuildingWall(
            group,
            x,
            y,
            z,
            width,
            height,
            depth,
            material
        ) {
            const wall =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        width,
                        height,
                        depth
                    ),
                    material
                );

            wall.position.set(
                x,
                y,
                z
            );

            wall.castShadow =
                true;

            wall.receiveShadow =
                true;

            group.add(
                wall
            );

            if (
                group.parent ||
                group === this.worldGroup
            ) {
                const worldPosition =
                    new THREE.Vector3();

                wall.getWorldPosition(
                    worldPosition
                );

                this.addCollider(
                    worldPosition.x,
                    worldPosition.z,
                    width,
                    depth
                );
            }
        },

        createWall(
            x,
            y,
            z,
            width,
            height,
            depth
        ) {
            const wall =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        width,
                        height,
                        depth
                    ),
                    this.material(
                        0x17191b,
                        0.9
                    )
                );

            wall.position.set(
                x,
                y,
                z
            );

            wall.castShadow =
                true;

            wall.receiveShadow =
                true;

            this.worldGroup.add(
                wall
            );

            this.addCollider(
                x,
                z,
                width,
                depth
            );
        },

        /* ======================================================
           COLLIDERS
           ====================================================== */

        addCollider(
            x,
            z,
            width,
            depth
        ) {
            this.colliders.push({
                minX:
                    x - Math.abs(width) / 2,
                maxX:
                    x + Math.abs(width) / 2,
                minZ:
                    z - Math.abs(depth) / 2,
                maxZ:
                    z + Math.abs(depth) / 2
            });
        },

        canMove(
            x,
            z,
            radius = 0.45
        ) {
            for (
                const collider
                of this.colliders
            ) {
                if (
                    x + radius >
                        collider.minX &&
                    x - radius <
                        collider.maxX &&
                    z + radius >
                        collider.minZ &&
                    z - radius <
                        collider.maxZ
                ) {
                    return false;
                }
            }

            return true;
        },

        /* ======================================================
           FACILITY DETAILS
           ====================================================== */

        createRoomDividers() {
            const dividerMaterial =
                this.material(
                    0x202224,
                    0.88
                );

            const walls = [
                {
                    x: -31,
                    z: 10,
                    w: 0.6,
                    d: 20
                },
                {
                    x: 31,
                    z: 10,
                    w: 0.6,
                    d: 20
                },
                {
                    x: 0,
                    z: -11,
                    w: 52,
                    d: 0.6
                },
                {
                    x: 0,
                    z: 31,
                    w: 52,
                    d: 0.6
                }
            ];

            walls.forEach(
                (data) => {

                    const wall =
                        new THREE.Mesh(
                            new THREE.BoxGeometry(
                                data.w,
                                7,
                                data.d
                            ),
                            dividerMaterial
                        );

                    wall.position.set(
                        data.x,
                        3.5,
                        data.z
                    );

                    wall.castShadow =
                        true;

                    wall.receiveShadow =
                        true;

                    this.worldGroup.add(
                        wall
                    );

                    this.addCollider(
                        data.x,
                        data.z,
                        data.w,
                        data.d
                    );
                }
            );
        },

        createFacilityDetails() {
            for (
                let x = -55;
                x <= 55;
                x += 9
            ) {
                this.createCrate(
                    x,
                    -43
                );
            }

            for (
                let x = -22;
                x <= 22;
                x += 11
            ) {
                this.createLightFixture(
                    x,
                    -5
                );

                this.createLightFixture(
                    x,
                    21
                );
            }

            this.createCrate(
                -50,
                -8
            );

            this.createCrate(
                -43,
                -8
            );

            this.createCrate(
                51,
                -2
            );

            this.createMetalCabinet(
                42,
                -10
            );

            this.createMetalCabinet(
                49,
                -10
            );

            this.createDesk(
                -16,
                17
            );

            this.createDesk(
                17,
                17
            );

            this.createTerminal(
                45,
                -18
            );
        },

        createUndergroundDetails() {
            for (
                let x = -28;
                x <= 28;
                x += 7
            ) {
                this.createPipe(
                    x,
                    -30,
                    0x46484a
                );

                this.createPipe(
                    x,
                    30,
                    0x383b3e
                );
            }

            for (
                let z = -27;
                z <= 27;
                z += 9
            ) {
                this.createGenerator(
                    -52,
                    z
                );

                this.createPump(
                    52,
                    z
                );
            }
        },

        createForestDetails() {
            const positions = [
                [-55,-45],
                [-43,-38],
                [-30,-48],
                [-15,-39],
                [15,-44],
                [31,-49],
                [48,-40],
                [59,-28],
                [-61,-12],
                [-54,4],
                [-40,20],
                [-29,35],
                [-12,47],
                [15,40],
                [31,34],
                [45,45],
                [59,29],
                [-62,28],
                [60,0],
                [37,-20],
                [-32,-17]
            ];

            positions.forEach(
                ([x, z]) => {
                    this.createTree(
                        x,
                        z
                    );
                }
            );

            for (
                let i = 0;
                i < 32;
                i++
            ) {
                const x =
                    -65 +
                    Math.random() * 130;

                const z =
                    -52 +
                    Math.random() * 104;

                if (
                    Math.abs(x) < 22 &&
                    Math.abs(z - 15) < 18
                ) {
                    continue;
                }

                this.createRock(
                    x,
                    z
                );
            }
        },

        /* ======================================================
           PROPS
           ====================================================== */

        createCrate(
            x,
            z
        ) {
            const crate =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        2.4,
                        2.2,
                        2.4
                    ),
                    this.material(
                        0x4a3925,
                        0.92
                    )
                );

            crate.position.set(
                x,
                1.1,
                z
            );

            crate.rotation.y =
                Math.random() *
                Math.PI;

            crate.castShadow =
                true;

            crate.receiveShadow =
                true;

            this.worldGroup.add(
                crate
            );
        },

        createMetalCabinet(
            x,
            z
        ) {
            const cabinet =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        2,
                        5,
                        1.1
                    ),
                    this.material(
                        0x383c3f,
                        0.65,
                        0.1
                    )
                );

            cabinet.position.set(
                x,
                2.5,
                z
            );

            cabinet.castShadow =
                true;

            this.worldGroup.add(
                cabinet
            );
        },

        createDesk(
            x,
            z
        ) {
            const group =
                new THREE.Group();

            const wood =
                this.material(
                    0x30251d,
                    0.82
                );

            const top =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        4.5,
                        0.35,
                        2
                    ),
                    wood
                );

            top.position.y =
                2;

            group.add(
                top
            );

            const legGeometry =
                new THREE.BoxGeometry(
                    0.25,
                    2,
                    0.25
                );

            [
                [-1.8,-0.7],
                [1.8,-0.7],
                [-1.8,0.7],
                [1.8,0.7]
            ].forEach(
                ([lx, lz]) => {

                    const leg =
                        new THREE.Mesh(
                            legGeometry,
                            wood
                        );

                    leg.position.set(
                        lx,
                        1,
                        lz
                    );

                    group.add(
                        leg
                    );

                }
            );

            group.position.set(
                x,
                0,
                z
            );

            this.worldGroup.add(
                group
            );
        },

        createTerminal(
            x,
            z
        ) {
            const group =
                new THREE.Group();

            const body =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        1.8,
                        1.2,
                        1.1
                    ),
                    this.material(
                        0x25282a,
                        0.55,
                        0.1
                    )
                );

            body.position.y =
                0.8;

            group.add(
                body
            );

            const screen =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        1.25,
                        0.72,
                        0.05
                    ),
                    new THREE.MeshStandardMaterial({
                        color:
                            0x31453d,
                        emissive:
                            0x182c23,
                        emissiveIntensity:
                            1.2
                    })
                );

            screen.position.set(
                0,
                1.15,
                -0.56
            );

            group.add(
                screen
            );

            group.position.set(
                x,
                0,
                z
            );

            this.worldGroup.add(
                group
            );
        },

        createLightFixture(
            x,
            z
        ) {
            const fixture =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        2.8,
                        0.12,
                        0.32
                    ),
                    this.material(
                        0x55585a,
                        0.5
                    )
                );

            fixture.position.set(
                x,
                6.75,
                z
            );

            this.worldGroup.add(
                fixture
            );

            const light =
                new THREE.PointLight(
                    0xcfd9dd,
                    1.8,
                    18
                );

            light.position.set(
                x,
                6.2,
                z
            );

            light.castShadow =
                true;

            light.shadow.mapSize.width =
                512;

            light.shadow.mapSize.height =
                512;

            this.worldGroup.add(
                light
            );

            this.flickeringLights =
                this.flickeringLights ||
                [];

            this.flickeringLights.push(
                light
            );
        },

        createPipe(
            x,
            z,
            color
        ) {
            const pipe =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.22,
                        0.22,
                        14,
                        12
                    ),
                    this.material(
                        color,
                        0.7
                    )
                );

            pipe.rotation.z =
                Math.PI / 2;

            pipe.position.set(
                x,
                5.4,
                z
            );

            this.worldGroup.add(
                pipe
            );
        },

        createGenerator(
            x,
            z
        ) {
            const body =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        5,
                        5,
                        4
                    ),
                    this.material(
                        0x292d30,
                        0.72,
                        0.15
                    )
                );

            body.position.set(
                x,
                2.5,
                z
            );

            body.castShadow =
                true;

            this.worldGroup.add(
                body
            );
        },

        createPump(
            x,
            z
        ) {
            const pump =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        1.5,
                        1.5,
                        3,
                        18
                    ),
                    this.material(
                        0x303438,
                        0.68,
                        0.1
                    )
                );

            pump.position.set(
                x,
                1.5,
                z
            );

            pump.castShadow =
                true;

            this.worldGroup.add(
                pump
            );
        },

        createTree(
            x,
            z
        ) {
            const group =
                new THREE.Group();

            const trunk =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.5,
                        0.75,
                        5,
                        9
                    ),
                    this.material(
                        0x29231f,
                        1
                    )
                );

            trunk.position.y =
                2.5;

            group.add(
                trunk
            );

            const foliage =
                new THREE.Mesh(
                    new THREE.DodecahedronGeometry(
                        3.2,
                        1
                    ),
                    this.material(
                        0x17221d,
                        1
                    )
                );

            foliage.position.y =
                6;

            foliage.scale.y =
                1.15;

            group.add(
                foliage
            );

            group.position.set(
                x,
                0,
                z
            );

            this.worldGroup.add(
                group
            );

            this.addCollider(
                x,
                z,
                1.4,
                1.4
            );
        },

        createRock(
            x,
            z
        ) {
            const rock =
                new THREE.Mesh(
                    new THREE.DodecahedronGeometry(
                        0.8 +
                            Math.random() *
                            1.1,
                        0
                    ),
                    this.material(
                        0x343638,
                        1
                    )
                );

            rock.position.set(
                x,
                0.65,
                z
            );

            rock.scale.y =
                0.65;

            rock.rotation.set(
                Math.random(),
                Math.random(),
                Math.random()
            );

            rock.castShadow =
                true;

            this.worldGroup.add(
                rock
            );
        },

        /* ======================================================
           PLAYER
           ====================================================== */

        createPlayer() {
            this.player =
                new THREE.Object3D();

            this.player.name =
                "PLAYER";

            this.player.position.set(
                0,
                1.65,
                -46
            );

            this.worldGroup.add(
                this.player
            );

            this.camera.position.set(
                0,
                0,
                0
            );

            this.player.add(
                this.camera
            );

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails.attachPlayer ===
                    "function"
            ) {
                window.SeekerDetails.attachPlayer(
                    this.player,
                    this.camera
                );
            }

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-created",
                    {
                        detail: {
                            player:
                                this.player
                        }
                    }
                )
            );
        },

        /* ======================================================
           SEEKER
           ====================================================== */

        createSeeker() {
            const group =
                new THREE.Group();

            group.name =
                "SEEKER";

            const dark =
                new THREE.MeshStandardMaterial({
                    color:
                        0x111214,
                    roughness:
                        0.76,
                    metalness:
                        0.05
                });

            const body =
                new THREE.Mesh(
                    new THREE.CapsuleGeometry(
                        0.7,
                        2.2,
                        8,
                        16
                    ),
                    dark
                );

            body.position.y =
                1.8;

            body.castShadow =
                true;

            group.add(
                body
            );

            const head =
                new THREE.Mesh(
                    new THREE.SphereGeometry(
                        0.72,
                        20,
                        20
                    ),
                    dark
                );

            head.position.y =
                3.55;

            head.scale.set(
                0.92,
                1.08,
                0.92
            );

            head.castShadow =
                true;

            group.add(
                head
            );

            const eyeMaterial =
                new THREE.MeshStandardMaterial({
                    color:
                        0x650c0c,
                    emissive:
                        0xb51f1f,
                    emissiveIntensity:
                        3
                });

            const eyeGeometry =
                new THREE.SphereGeometry(
                    0.08,
                    12,
                    12
                );

            const eye1 =
                new THREE.Mesh(
                    eyeGeometry,
                    eyeMaterial
                );

            eye1.position.set(
                -0.23,
                3.6,
                -0.64
            );

            const eye2 =
                new THREE.Mesh(
                    eyeGeometry,
                    eyeMaterial
                );

            eye2.position.set(
                0.23,
                3.6,
                -0.64
            );

            group.add(
                eye1,
                eye2
            );

            const armGeometry =
                new THREE.CapsuleGeometry(
                    0.22,
                    2,
                    6,
                    10
                );

            const leftArm =
                new THREE.Mesh(
                    armGeometry,
                    dark
                );

            leftArm.position.set(
                -1,
                1.9,
                0
            );

            leftArm.rotation.z =
                -0.18;

            const rightArm =
                new THREE.Mesh(
                    armGeometry,
                    dark
                );

            rightArm.position.set(
                1,
                1.9,
                0
            );

            rightArm.rotation.z =
                0.18;

            group.add(
                leftArm,
                rightArm
            );

            group.position.set(
                42,
                0,
                42
            );

            this.worldGroup.add(
                group
            );

            this.seeker =
                group;
        },

        wakeSeeker() {
            if (
                this.seekerActive
            ) {
                return;
            }

            this.seekerActive =
                true;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:activated"
                )
            );
        },

        /* ======================================================
           OBJECTIVES
           ====================================================== */

        createObjectives() {
            const positions = [
                [-49, -18],
                [48, 12],
                [-8, 35]
            ];

            positions.forEach(
                (position, index) => {

                    const button =
                        this.createButton(
                            position[0],
                            position[1],
                            index + 1
                        );

                    this.buttons.push(
                        button
                    );

                }
            );

            this.createKey(
                24,
                22
            );
        },

        createButton(
            x,
            z,
            id
        ) {
            const group =
                new THREE.Group();

            group.position.set(
                x,
                1.4,
                z
            );

            const base =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        1.1,
                        0.4,
                        0.8
                    ),
                    this.material(
                        0x252525,
                        0.7
                    )
                );

            group.add(
                base
            );

            const buttonMaterial =
                new THREE.MeshStandardMaterial({
                    color:
                        0x7d1111,
                    emissive:
                        0x330000,
                    emissiveIntensity:
                        1.4
                });

            const top =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.3,
                        0.3,
                        0.25,
                        16
                    ),
                    buttonMaterial
                );

            top.rotation.x =
                Math.PI / 2;

            top.position.z =
                -0.22;

            group.add(
                top
            );

            const light =
                new THREE.PointLight(
                    0xc82121,
                    1.1,
                    5
                );

            light.position.set(
                0,
                0.2,
                -0.45
            );

            group.add(
                light
            );

            group.userData = {
                type:
                    "button",
                id,
                pressed:
                    false,
                light,
                top
            };

            this.worldGroup.add(
                group
            );

            this.interactables.push(
                group
            );

            return group;
        },

        createKey(
            x,
            z
        ) {
            const group =
                new THREE.Group();

            group.position.set(
                x,
                1.5,
                z
            );

            const gold =
                new THREE.MeshStandardMaterial({
                    color:
                        0xc9a227,
                    metalness:
                        0.75,
                    roughness:
                        0.22,
                    emissive:
                        0x352400,
                    emissiveIntensity:
                        0.45
                });

            const ring =
                new THREE.Mesh(
                    new THREE.TorusGeometry(
                        0.23,
                        0.07,
                        8,
                        18
                    ),
                    gold
                );

            ring.rotation.x =
                Math.PI / 2;

            group.add(
                ring
            );

            const shaft =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.07,
                        0.55,
                        0.07
                    ),
                    gold
                );

            shaft.position.y =
                -0.25;

            group.add(
                shaft
            );

            const tooth =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.2,
                        0.08,
                        0.08
                    ),
                    gold
                );

            tooth.position.set(
                0.07,
                -0.43,
                0
            );

            group.add(
                tooth
            );

            const light =
                new THREE.PointLight(
                    0xd5ac3a,
                    1.7,
                    5
                );

            group.add(
                light
            );

            group.userData = {
                type:
                    "key"
            };

            this.worldGroup.add(
                group
            );

            this.key =
                group;
        },

        createExitGate(
            x,
            y,
            z
        ) {
            const group =
                new THREE.Group();

            group.position.set(
                x,
                0,
                z
            );

            const postMaterial =
                this.material(
                    0x202224,
                    0.65,
                    0.2
                );

            const leftPost =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.75,
                        6,
                        0.75
                    ),
                    postMaterial
                );

            leftPost.position.x =
                -4.5;

            const rightPost =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.75,
                        6,
                        0.75
                    ),
                    postMaterial
                );

            rightPost.position.x =
                4.5;

            group.add(
                leftPost,
                rightPost
            );

            for (
                let xPos = -3.7;
                xPos <= 3.7;
                xPos += 1.05
            ) {

                const bar =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            0.32,
                            5.3,
                            0.32
                        ),
                        postMaterial
                    );

                bar.position.set(
                    xPos,
                    2.65,
                    0
                );

                group.add(
                    bar
                );
            }

            const sign =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        3,
                        0.9,
                        0.12
                    ),
                    new THREE.MeshStandardMaterial({
                        color:
                            0x3b1111,
                        emissive:
                            0x180000,
                        emissiveIntensity:
                            1
                    })
                );

            sign.position.set(
                0,
                5.2,
                -0.45
            );

            group.add(
                sign
            );

            group.userData = {
                type:
                    "gate",
                closed:
                    true,
                opened:
                    false
            };

            this.worldGroup.add(
                group
            );

            this.gate =
                group;

            this.addCollider(
                x,
                z,
                10,
                1.4
            );
        },

        /* ======================================================
           INTERACTION
           ====================================================== */

        interact() {
            if (
                !this.player ||
                !this.started
            ) {
                return;
            }

            const origin =
                this.camera.getWorldPosition(
                    new THREE.Vector3()
                );

            const direction =
                new THREE.Vector3(0,0,-1)
                    .applyQuaternion(
                        this.camera.quaternion
                    )
                    .normalize();

            const ray =
                new THREE.Raycaster(
                    origin,
                    direction,
                    0,
                    4
                );

            const objects = [];

            this.buttons.forEach(
                (button) => {
                    objects.push(
                        ...button.children
                    );
                }
            );

            if (this.key) {
                objects.push(
                    ...this.key.children
                );
            }

            if (this.gate) {
                objects.push(
                    ...this.gate.children
                );
            }

            const hits =
                ray.intersectObjects(
                    objects,
                    true
                );

            if (!hits.length) {
                return;
            }

            let object =
                hits[0].object;

            while (
                object.parent &&
                object.parent !==
                    this.worldGroup
            ) {
                if (
                    object.userData?.type
                ) {
                    break;
                }

                object =
                    object.parent;
            }

            const type =
                object.userData?.type;

            if (
                type === "button"
            ) {
                this.pressButton(
                    object
                );
                return;
            }

            if (
                type === "key"
            ) {
                this.collectKey();
                return;
            }

            if (
                type === "gate"
            ) {
                this.useGate();
            }
        },

        pressButton(button) {
            if (
                button.userData.pressed
            ) {
                return;
            }

            button.userData.pressed =
                true;

            this.buttonsFound.add(
                button.userData.id
            );

            if (
                button.userData.top
            ) {
                button.userData.top.position.z =
                    -0.12;
            }

            if (
                button.userData.light
            ) {
                button.userData.light.color.set(
                    0x4da86d
                );

                button.userData.light.intensity =
                    1.5;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:button",
                    {
                        detail: {
                            id:
                                button.userData.id
                        }
                    }
                )
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:button-progress",
                    {
                        detail: {
                            found:
                                this.buttonsFound.size
                        }
                    }
                )
            );

            if (
                window.SeekerSystem
            ) {
                window.SeekerSystem.registerButton(
                    button.userData.id
                );
            }

            if (
                this.buttonsFound.size >= 3
            ) {
                this.spawnKeyNearSecurity();
            }
        },

        spawnKeyNearSecurity() {
            if (!this.key) {
                return;
            }

            this.key.position.set(
                24,
                1.5,
                22
            );

            this.key.visible =
                true;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:all-buttons-found"
                )
            );
        },

        collectKey() {
            if (
                this.hasKey ||
                !this.key
            ) {
                return;
            }

            if (
                this.buttonsFound.size <
                3
            ) {
                return;
            }

            const distance =
                this.player.position.distanceTo(
                    this.key.position
                );

            if (distance > 3.5) {
                return;
            }

            this.hasKey =
                true;

            this.key.visible =
                false;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:key",
                    {
                        detail: {
                            collected:
                                true
                        }
                    }
                )
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:key-collected"
                )
            );
        },

        useGate() {
            if (
                !this.gate
            ) {
                return;
            }

            const distance =
                this.player.position.distanceTo(
                    this.gate.position
                );

            if (
                distance > 8
            ) {
                return;
            }

            if (
                !this.hasKey
            ) {
                return;
            }

            this.unlockGate();
        },

        unlockGate() {
            if (
                this.gateUnlocked ||
                !this.gate
            ) {
                return;
            }

            this.gateUnlocked =
                true;

            this.gate.userData.opened =
                true;

            this.gate.children.forEach(
                (child) => {
                    child.userData.gatePart =
                        true;
                }
            );

            this.gate.children.forEach(
                (child) => {
                    const startY =
                        child.position.y;

                    const startTime =
                        performance.now();

                    const animateGate =
                        () => {

                            if (
                                !this.started
                            ) {
                                return;
                            }

                            const elapsed =
                                performance.now() -
                                startTime;

                            const progress =
                                Math.min(
                                    1,
                                    elapsed / 1600
                                );

                            const ease =
                                1 -
                                Math.pow(
                                    1 - progress,
                                    3
                                );

                            child.position.y =
                                startY +
                                ease * 7;

                            if (
                                progress < 1
                            ) {
                                requestAnimationFrame(
                                    animateGate
                                );
                            }

                        };

                    requestAnimationFrame(
                        animateGate
                    );
                }
            );

            this.removeGateCollider();

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:gate",
                    {
                        detail: {
                            unlocked:
                                true
                        }
                    }
                )
            );
        },

        removeGateCollider() {
            if (!this.gate) {
                return;
            }

            const x =
                this.gate.position.x;

            const z =
                this.gate.position.z;

            this.colliders =
                this.colliders.filter(
                    (collider) => {
                        const centerX =
                            (collider.minX +
                                collider.maxX) /
                            2;

                        const centerZ =
                            (collider.minZ +
                                collider.maxZ) /
                            2;

                        return !(
                            Math.abs(
                                centerX - x
                            ) < 6 &&
                            Math.abs(
                                centerZ - z
                            ) < 2
                        );
                    }
                );
        },

        /* ======================================================
           CONTROLS
           ====================================================== */

        bindControls() {
            this.resizeBound =
                () => this.resize();

            this.keyDownBound =
                (event) =>
                    this.onKeyDown(
                        event
                    );

            this.keyUpBound =
                (event) =>
                    this.onKeyUp(
                        event
                    );

            this.mouseMoveBound =
                (event) =>
                    this.onMouseMove(
                        event
                    );

            this.pointerLockBound =
                () =>
                    this.onPointerLockChange();

            this.requestPointerLockBound =
                () =>
                    this.requestPointerLock();

            document.addEventListener(
                "keydown",
                this.keyDownBound
            );

            document.addEventListener(
                "keyup",
                this.keyUpBound
            );

            document.addEventListener(
                "mousemove",
                this.mouseMoveBound
            );

            document.addEventListener(
                "pointerlockchange",
                this.pointerLockBound
            );

            if (
                this.renderer
            ) {
                this.renderer
                    .domElement
                    .addEventListener(
                        "click",
                        this.requestPointerLockBound
                    );
            }

            this.bindMobileControls();
        },

        onKeyDown(event) {
            if (
                event.code === "Escape"
            ) {
                return;
            }

            this.keys.add(
                event.code
            );

            if (
                event.code === "KeyE"
            ) {
                this.interact();
            }

            if (
                event.code === "KeyF" ||
                event.code === "Digit1"
            ) {
                this.flashlightOn =
                    !this.flashlightOn;

                window.dispatchEvent(
                    new CustomEvent(
                        this.flashlightOn
                            ? "seeker:flashlight-on"
                            : "seeker:flashlight-off"
                    )
                );
            }

            if (
                event.code === "ShiftLeft" ||
                event.code === "ShiftRight"
            ) {
                this.sprinting =
                    true;
            }
        },

        onKeyUp(event) {
            this.keys.delete(
                event.code
            );

            if (
                event.code === "ShiftLeft" ||
                event.code === "ShiftRight"
            ) {
                this.sprinting =
                    false;
            }
        },

        onMouseMove(event) {
            if (
                this.platform ===
                "mobile"
            ) {
                return;
            }

            if (
                !this.mouseLocked
            ) {
                return;
            }

            const sensitivity =
                0.002;

            this.yaw -=
                event.movementX *
                sensitivity;

            this.pitch -=
                event.movementY *
                sensitivity;

            this.pitch =
                THREE.MathUtils.clamp(
                    this.pitch,
                    -1.45,
                    1.45
                );
        },

        requestPointerLock() {
            if (
                this.platform ===
                "mobile"
            ) {
                return;
            }

            if (
                this.paused
            ) {
                return;
            }

            this.renderer
                ?.domElement
                ?.requestPointerLock?.();
        },

        onPointerLockChange() {
            this.mouseLocked =
                document.pointerLockElement ===
                this.renderer?.domElement;
        },

        bindMobileControls() {
            const move =
                document.getElementById(
                    "movementJoystick"
                );

            const look =
                document.getElementById(
                    "lookJoystick"
                );

            if (move) {
                this.bindJoystick(
                    move,
                    "move"
                );
            }

            if (look) {
                this.bindJoystick(
                    look,
                    "look"
                );
            }

            const sprint =
                document.getElementById(
                    "mobileSprint"
                );

            if (sprint) {
                sprint.addEventListener(
                    "touchstart",
                    (event) => {
                        event.preventDefault();
                        this.joystick.sprint =
                            true;
                    },
                    { passive: false }
                );

                sprint.addEventListener(
                    "touchend",
                    (event) => {
                        event.preventDefault();
                        this.joystick.sprint =
                            false;
                    },
                    { passive: false }
                );
            }

            const interact =
                document.getElementById(
                    "mobileInteract"
                );

            if (interact) {
                interact.addEventListener(
                    "touchstart",
                    (event) => {
                        event.preventDefault();
                        this.interact();
                    },
                    { passive: false }
                );
            }
        },

        bindJoystick(
            element,
            type
        ) {
            let active =
                false;

            let pointerId =
                null;

            const update =
                (clientX, clientY) => {

                    const rect =
                        element.getBoundingClientRect();

                    const centerX =
                        rect.left +
                        rect.width /
                            2;

                    const centerY =
                        rect.top +
                        rect.height /
                            2;

                    let dx =
                        clientX -
                        centerX;

                    let dy =
                        clientY -
                        centerY;

                    const radius =
                        rect.width *
                        0.38;

                    const length =
                        Math.hypot(
                            dx,
                            dy
                        );

                    if (
                        length >
                        radius
                    ) {
                        const scale =
                            radius /
                            length;

                        dx *= scale;
                        dy *= scale;
                    }

                    const x =
                        dx /
                        radius;

                    const y =
                        dy /
                        radius;

                    if (
                        type === "move"
                    ) {
                        this.joystick.moveX =
                            x;

                        this.joystick.moveY =
                            y;
                    } else {
                        this.joystick.lookX =
                            x;

                        this.joystick.lookY =
                            y;
                    }

                    const knob =
                        document.getElementById(
                            type === "move"
                                ? "movementKnob"
                                : "lookKnob"
                        );

                    if (knob) {
                        knob.style.transform =
                            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    }
                };

            const reset =
                () => {

                    active =
                        false;

                    pointerId =
                        null;

                    if (
                        type === "move"
                    ) {
                        this.joystick.moveX =
                            0;

                        this.joystick.moveY =
                            0;
                    } else {
                        this.joystick.lookX =
                            0;

                        this.joystick.lookY =
                            0;
                    }

                    const knob =
                        document.getElementById(
                            type === "move"
                                ? "movementKnob"
                                : "lookKnob"
                        );

                    if (knob) {
                        knob.style.transform =
                            "translate(-50%, -50%)";
                    }
                };

            element.addEventListener(
                "pointerdown",
                (event) => {

                    active =
                        true;

                    pointerId =
                        event.pointerId;

                    element.setPointerCapture(
                        pointerId
                    );

                    update(
                        event.clientX,
                        event.clientY
                    );

                }
            );

            element.addEventListener(
                "pointermove",
                (event) => {

                    if (
                        !active ||
                        event.pointerId !==
                            pointerId
                    ) {
                        return;
                    }

                    update(
                        event.clientX,
                        event.clientY
                    );

                }
            );

            element.addEventListener(
                "pointerup",
                reset
            );

            element.addEventListener(
                "pointercancel",
                reset
            );
        },

        /* ======================================================
           MOVEMENT
           ====================================================== */

        updatePlayer(delta) {
            if (
                !this.player
            ) {
                return;
            }

            let forward =
                0;

            let sideways =
                0;

            if (
                this.keys.has("KeyW") ||
                this.keys.has("ArrowUp")
            ) {
                forward += 1;
            }

            if (
                this.keys.has("KeyS") ||
                this.keys.has("ArrowDown")
            ) {
                forward -= 1;
            }

            if (
                this.keys.has("KeyA") ||
                this.keys.has("ArrowLeft")
            ) {
                sideways -= 1;
            }

            if (
                this.keys.has("KeyD") ||
                this.keys.has("ArrowRight")
            ) {
                sideways += 1;
            }

            if (
                this.platform ===
                "mobile"
            ) {
                forward +=
                    -this.joystick.moveY;

                sideways +=
                    this.joystick.moveX;
            }

            const length =
                Math.hypot(
                    sideways,
                    forward
                );

            if (
                length > 1
            ) {
                sideways /=
                    length;

                forward /=
                    length;
            }

            const isMoving =
                Math.abs(sideways) >
                    0.01 ||
                Math.abs(forward) >
                    0.01;

            this.sprinting =
                this.sprinting ||
                this.joystick.sprint;

            const speed =
                this.sprinting &&
                isMoving
                    ? this.sprintSpeed
                    : this.playerSpeed;

            const move =
                this.moveVector;

            move.set(
                0,
                0,
                0
            );

            const forwardDirection =
                new THREE.Vector3(
                    0,
                    0,
                    -1
                );

            forwardDirection.applyAxisAngle(
                new THREE.Vector3(
                    0,
                    1,
                    0
                ),
                this.yaw
            );

            const rightDirection =
                new THREE.Vector3(
                    1,
                    0,
                    0
                );

            rightDirection.applyAxisAngle(
                new THREE.Vector3(
                    0,
                    1,
                    0
                ),
                this.yaw
            );

            move
                .addScaledVector(
                    forwardDirection,
                    forward
                )
                .addScaledVector(
                    rightDirection,
                    sideways
                );

            if (
                move.lengthSq() >
                0
            ) {
                move.normalize();
                move.multiplyScalar(
                    speed *
                    delta
                );
            }

            const nextX =
                this.player.position.x +
                move.x;

            const nextZ =
                this.player.position.z +
                move.z;

            const canX =
                this.canMove(
                    nextX,
                    this.player.position.z
                );

            const canZ =
                this.canMove(
                    this.player.position.x,
                    nextZ
                );

            if (canX) {
                this.player.position.x =
                    nextX;
            }

            if (canZ) {
                this.player.position.z =
                    nextZ;
            }

            this.camera.rotation.y =
                this.yaw;

            this.camera.rotation.x =
                this.pitch;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-moving",
                    {
                        detail: {
                            moving:
                                isMoving,
                            speed:
                                isMoving
                                    ? speed
                                    : 0
                        }
                    }
                )
            );

            if (
                isMoving &&
                this.seekerActive
            ) {
                window.dispatchEvent(
                    new CustomEvent(
                        "seeker:footstep",
                        {
                            detail: {
                                sprinting:
                                    this.sprinting
                            }
                        }
                    )
                );
            }
        },

        updateMobileLook(
            delta
        ) {
            if (
                this.platform !==
                "mobile"
            ) {
                return;
            }

            const x =
                this.joystick.lookX;

            const y =
                this.joystick.lookY;

            if (
                Math.abs(x) <
                    0.04 &&
                Math.abs(y) <
                    0.04
            ) {
                return;
            }

            this.yaw -=
                x *
                delta *
                3.1;

            this.pitch -=
                y *
                delta *
                2.5;

            this.pitch =
                THREE.MathUtils.clamp(
                    this.pitch,
                    -1.45,
                    1.45
                );
        },

        /* ======================================================
           SEEKER AI
           ====================================================== */

        updateSeeker(delta) {
            if (
                !this.seeker ||
                !this.player
            ) {
                return;
            }

            const distance =
                this.seeker.position.distanceTo(
                    this.player.position
                );

            this.seekerTargetDistance =
                distance;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:seeker-distance",
                    {
                        detail: {
                            distance
                        }
                    }
                )
            );

            if (
                !this.seekerActive
            ) {
                this.seeker.lookAt(
                    this.player.position.x,
                    this.seeker.position.y +
                        1.6,
                    this.player.position.z
                );

                return;
            }

            const target =
                this.player.position;

            const dx =
                target.x -
                this.seeker.position.x;

            const dz =
                target.z -
                this.seeker.position.z;

            const length =
                Math.hypot(
                    dx,
                    dz
                );

            if (
                length > 0.01
            ) {

                const directionX =
                    dx / length;

                const directionZ =
                    dz / length;

                const speed =
                    this.seekerSpeed *
                    delta;

                const nextX =
                    this.seeker.position.x +
                    directionX *
                    speed;

                const nextZ =
                    this.seeker.position.z +
                    directionZ *
                    speed;

                if (
                    this.canMove(
                        nextX,
                        this.seeker.position.z,
                        0.65
                    )
                ) {
                    this.seeker.position.x =
                        nextX;
                }

                if (
                    this.canMove(
                        this.seeker.position.x,
                        nextZ,
                        0.65
                    )
                ) {
                    this.seeker.position.z =
                        nextZ;
                }

                this.seeker.rotation.y =
                    Math.atan2(
                        directionX,
                        directionZ
                    );
            }

            if (
                distance <
                2.2
            ) {
                this.playerCaught();
            }
        },

        playerCaught() {
            if (
                !this.started
            ) {
                return;
            }

            this.started =
                false;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-caught",
                    {
                        detail: {
                            reason:
                                "seeker"
                        }
                    }
                )
            );
        },

        /* ======================================================
           TIMER
           ====================================================== */

        startSetupTimer() {
            this.setupRemaining =
                this.setupDuration;

            clearInterval(
                this.seekerTimer
            );

            this.seekerTimer =
                setInterval(
                    () => {

                        if (
                            !this.started ||
                            this.paused
                        ) {
                            return;
                        }

                        this.setupRemaining--;

                        window.dispatchEvent(
                            new CustomEvent(
                                "seeker:setup-timer",
                                {
                                    detail: {
                                        seconds:
                                            this.setupRemaining
                                    }
                                }
                            )
                        );

                        if (
                            this.setupRemaining <=
                            0
                        ) {
                            clearInterval(
                                this.seekerTimer
                            );

                            this.wakeSeeker();
                        }

                    },
                    1000
                );
        },

        /* ======================================================
           MINIMAP
           ====================================================== */

        createMinimap() {
            this.minimap.world =
                document.getElementById(
                    "minimapWorld"
                );

            this.minimap.player =
                document.getElementById(
                    "playerMarker"
                );

            this.minimap.seeker =
                document.getElementById(
                    "seekerMarker"
                );
        },

        updateMinimap() {
            if (
                !this.player ||
                !this.seeker
            ) {
                return;
            }

            const convert =
                (
                    value,
                    min,
                    max,
                    size
                ) => {

                    return (
                        (value - min) /
                        (max - min)
                    ) *
                    size;

                };

            const width =
                190;

            const height =
                150;

            const playerX =
                convert(
                    this.player.position.x,
                    -75,
                    75,
                    width
                );

            const playerY =
                convert(
                    this.player.position.z,
                    -60,
                    60,
                    height
                );

            const seekerX =
                convert(
                    this.seeker.position.x,
                    -75,
                    75,
                    width
                );

            const seekerY =
                convert(
                    this.seeker.position.z,
                    -60,
                    60,
                    height
                );

            if (
                this.minimap.player
            ) {

                this.minimap.player.style.left =
                    `${playerX}px`;

                this.minimap.player.style.top =
                    `${playerY}px`;

                this.minimap.player.style.transform =
                    `translate(-50%, -50%) rotate(${-this.yaw}rad)`;

            }

            if (
                this.minimap.seeker
            ) {

                this.minimap.seeker.style.left =
                    `${seekerX}px`;

                this.minimap.seeker.style.top =
                    `${seekerY}px`;

                this.minimap.seeker.style.transform =
                    `translate(-50%, -50%) rotate(0rad)`;

            }
        },

        /* ======================================================
           NETWORK
           ====================================================== */

        sendNetworkState() {
            if (
                !this.multiplayer ||
                !this.player ||
                !window.Main
            ) {
                return;
            }

            const now =
                performance.now();

            if (
                now -
                    this.lastNetworkSend <
                70
            ) {
                return;
            }

            this.lastNetworkSend =
                now;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-state",
                    {
                        detail: {
                            x:
                                this.player.position.x,
                            y:
                                this.player.position.y,
                            z:
                                this.player.position.z,
                            yaw:
                                this.yaw,
                            pitch:
                                this.pitch
                        }
                    }
                )
            );
        },

        /* ======================================================
           REMOTE PLAYERS
           ====================================================== */

        updateRemotePlayer(
            data
        ) {
            const id =
                data.playerId ||
                data.id;

            if (
                !id ||
                id ===
                    window.Main?.state
                        ?.localPlayerId
            ) {
                return;
            }

            let remote =
                this.remotePlayers.get(
                    id
                );

            if (!remote) {

                const group =
                    new THREE.Group();

                const body =
                    new THREE.Mesh(
                        new THREE.CapsuleGeometry(
                            0.38,
                            1.2,
                            6,
                            10
                        ),
                        this.material(
                            0x7e8b92,
                            0.8
                        )
                    );

                body.position.y =
                    1.1;

                const head =
                    new THREE.Mesh(
                        new THREE.SphereGeometry(
                            0.43,
                            16,
                            16
                        ),
                        this.material(
                            0x98a1a5,
                            0.8
                        )
                    );

                head.position.y =
                    2.1;

                group.add(
                    body,
                    head
                );

                this.worldGroup.add(
                    group
                );

                remote = {
                    id,
                    mesh:
                        group
                };

                this.remotePlayers.set(
                    id,
                    remote
                );
            }

            remote.target =
                new THREE.Vector3(
                    Number(
                        data.x
                    ) || 0,
                    Number(
                        data.y
                    ) || 1.65,
                    Number(
                        data.z
                    ) || 0
                );

            remote.targetYaw =
                Number(
                    data.yaw
                ) || 0;

            remote.name =
                data.name ||
                "Player";
        },

        updateRemotePlayers(
            delta
        ) {
            this.remotePlayers.forEach(
                (remote) => {

                    if (
                        !remote.target
                    ) {
                        return;
                    }

                    remote.mesh.position.lerp(
                        remote.target,
                        Math.min(
                            1,
                            delta * 12
                        )
                    );

                    if (
                        Number.isFinite(
                            remote.targetYaw
                        )
                    ) {
                        remote.mesh.rotation.y =
                            THREE.MathUtils.lerp(
                                remote.mesh.rotation.y,
                                remote.targetYaw,
                                Math.min(
                                    1,
                                    delta * 10
                                )
                            );
                    }
                }
            );
        },

        /* ======================================================
           LIGHT FLICKER
           ====================================================== */

        updateLights() {
            if (
                !this.flickeringLights
            ) {
                return;
            }

            this.flickeringLights.forEach(
                (light) => {

                    if (
                        Math.random() <
                        0.015
                    ) {

                        light.intensity =
                            0.35 +
                            Math.random() *
                                1.8;

                    }

                }
            );
        },

        /* ======================================================
           EVENTS
           ====================================================== */

        bindGameEvents() {
            window.addEventListener(
                "seeker:pause",
                this.pauseFromEventBound =
                    () => {
                        this.paused =
                            true;
                    }
            );

            window.addEventListener(
                "seeker:resume",
                this.resumeFromEventBound =
                    () => {
                        this.paused =
                            false;
                    }
            );

            window.addEventListener(
                "seeker:mobile-interact",
                this.mobileInteractBound =
                    () => {
                        this.interact();
                    }
            );

            window.addEventListener(
                "seeker:remote-player-state",
                this.remoteStateBound =
                    (event) => {
                        this.updateRemotePlayer(
                            event.detail || {}
                        );
                    }
            );
        },

        /* ======================================================
           RESIZE
           ====================================================== */

        resize() {
            if (
                !this.renderer ||
                !this.camera
            ) {
                return;
            }

            const width =
                window.innerWidth;

            const height =
                window.innerHeight;

            this.camera.aspect =
                width / height;

            this.camera.updateProjectionMatrix();

            this.renderer.setSize(
                width,
                height,
                false
            );
        },

        /* ======================================================
           LOOP
           ====================================================== */

        animate() {
            if (
                !this.started
            ) {
                return;
            }

            requestAnimationFrame(
                () => this.animate()
            );

            const delta =
                Math.min(
                    0.05,
                    this.clock.getDelta()
                );

            if (
                this.paused
            ) {
                return;
            }

            this.updateMobileLook(
                delta
            );

            this.updatePlayer(
                delta
            );

            this.updateSeeker(
                delta
            );

            this.updateRemotePlayers(
                delta
            );

            this.updateMinimap();

            this.updateLights();

            this.sendNetworkState();

            if (
                window.SeekerDetails &&
                typeof
                    window.SeekerDetails.update ===
                    "function"
            ) {
                window.SeekerDetails.update(
                    delta,
                    this.sprinting
                );
            }

            this.renderer.render(
                this.scene,
                this.camera
            );
        },

        stopAudio() {}
    };

    window.Game =
        Game;

    window.SeekerGame =
        Game;

    window.addEventListener(
        "seeker:remote-player-state",
        (event) => {

            if (
                event.detail
            ) {
                Game.updateRemotePlayer(
                    event.detail
                );
            }

        }
    );

})();