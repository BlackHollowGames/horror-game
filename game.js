/* ============================================================
   THE SEEKER
   BlackHollow Games
   game.js
   ============================================================ */

(() => {
    "use strict";

    /*
     * ----------------------------------------------------------
     * GAME.JS
     * ----------------------------------------------------------
     * Main gameplay/world module.
     *
     * Responsibilities:
     * - Build the 3D horror world
     * - Create the player
     * - Create the Seeker
     * - Create the three required buttons
     * - Create the key
     * - Create the locked gate
     * - Handle collisions
     * - Handle player movement
     * - Handle Seeker movement
     * - Handle the three-minute preparation period
     * - Handle the minimap state
     * - Handle PC/mobile movement
     * - Handle doors and interactable objects
     * - Expose game state to main.js/system.js/details.js
     *
     * This file intentionally does not own the complete UI.
     * main.js can control menus and screens.
     * system.js can control global systems such as audio,
     * multiplayer, saving, settings, and voice systems.
     * details.js can add additional visual detail.
     * ----------------------------------------------------------
     */

    const THREE = window.THREE;

    if (!THREE) {
        console.error(
            "[THE SEEKER] Three.js was not found. " +
            "Make sure the Three.js library is loaded before game.js."
        );
        return;
    }

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const GAME = {
        NAME: "THE SEEKER",
        DEVELOPER: "BlackHollow Games",

        WORLD_SIZE: 1000,

        PLAYER_HEIGHT: 1.8,
        PLAYER_RADIUS: 0.42,

        PLAYER_WALK_SPEED: 5.2,
        PLAYER_RUN_SPEED: 8.4,

        SEEKER_SPEED: 3.7,
        SEEKER_CHASE_SPEED: 6.2,
        SEEKER_HEARING_DISTANCE: 42,
        SEEKER_DETECTION_DISTANCE: 85,

        SETUP_TIME: 180,

        INTERACTION_DISTANCE: 3.2,

        REQUIRED_BUTTONS: 3,

        MAP_NAMES: [
            "THE OLD HOUSE",
            "THE WOODS",
            "THE FACILITY"
        ],

        COLORS: {
            VOID: 0x050607,
            FLOOR: 0x161719,
            WALL: 0x222326,
            METAL: 0x393b3e,
            DARK_METAL: 0x17191b,
            WOOD: 0x30251c,
            WOOD_DARK: 0x19130f,
            CONCRETE: 0x393a39,
            RED: 0x9e2222,
            YELLOW: 0xc9a227,
            WHITE: 0xd8d8d2,
            GREEN: 0x2a8a4a,
            BLACK: 0x020202
        }
    };

    /* =========================================================
       GAME STATE
       ========================================================= */

    const state = {
        initialized: false,
        running: false,
        paused: false,

        device: "pc",

        elapsed: 0,
        delta: 0,

        setupRemaining: GAME.SETUP_TIME,
        seekerActive: false,

        buttonsFound: 0,
        hasKey: false,
        gateUnlocked: false,

        playerCaught: false,
        gameWon: false,

        currentMap: GAME.MAP_NAMES[0],

        player: {
            position: new THREE.Vector3(0, GAME.PLAYER_HEIGHT, 0),
            velocity: new THREE.Vector3(),
            rotationY: 0,
            running: false,
            crouching: false,
            moving: false,
            sprinting: false
        },

        seeker: {
            position: new THREE.Vector3(0, GAME.PLAYER_HEIGHT, -95),
            velocity: new THREE.Vector3(),
            rotationY: 0,
            state: "sleeping",
            target: null,
            lastKnownPlayerPosition: new THREE.Vector3(),
            investigationTimer: 0,
            hearingTimer: 0,
            attackCooldown: 0
        },

        buttons: {
            button1: false,
            button2: false,
            button3: false
        },

        minimap: {
            playerX: 0,
            playerZ: 0,
            seekerX: 0,
            seekerZ: 0,
            playerRotation: 0,
            seekerRotation: 0
        }
    };

    /* =========================================================
       GLOBAL GAME REFERENCES
       ========================================================= */

    const world = {
        scene: null,
        camera: null,
        renderer: null,

        playerObject: null,
        playerCollider: null,

        seekerObject: null,
        seekerCollider: null,

        gateObject: null,
        keyObject: null,

        buttons: [],

        walls: [],
        floors: [],
        obstacles: [],
        doors: [],
        interactables: [],

        lights: [],
        effects: [],

        spawnPoints: [],
        seekerWaypoints: [],

        clock: new THREE.Clock()
    };

    /* =========================================================
       INPUT
       ========================================================= */

    const input = {
        keys: Object.create(null),

        mouseX: 0,
        mouseY: 0,

        mouseDown: false,

        joystick: {
            active: false,
            x: 0,
            y: 0
        },

        cameraJoystick: {
            active: false,
            x: 0,
            y: 0
        }
    };

    /* =========================================================
       UTILITY
       ========================================================= */

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function distance2D(a, b) {
        const dx = a.x - b.x;
        const dz = a.z - b.z;

        return Math.sqrt(
            dx * dx +
            dz * dz
        );
    }

    function angleToTarget(from, target) {
        return Math.atan2(
            target.x - from.x,
            target.z - from.z
        );
    }

    function normalizeAngle(angle) {
        while (angle > Math.PI) {
            angle -= Math.PI * 2;
        }

        while (angle < -Math.PI) {
            angle += Math.PI * 2;
        }

        return angle;
    }

    function approachAngle(current, target, amount) {
        const difference =
            normalizeAngle(target - current);

        if (Math.abs(difference) <= amount) {
            return target;
        }

        return current +
            Math.sign(difference) *
            amount;
    }

    function randomRange(min, max) {
        return min +
            Math.random() *
            (max - min);
    }

    function randomInt(min, max) {
        return Math.floor(
            randomRange(min, max + 1)
        );
    }

    function createBox(
        width,
        height,
        depth,
        material
    ) {
        const geometry =
            new THREE.BoxGeometry(
                width,
                height,
                depth
            );

        const mesh =
            new THREE.Mesh(
                geometry,
                material
            );

        return mesh;
    }

    function createCylinder(
        radius,
        height,
        material,
        segments = 16
    ) {
        const geometry =
            new THREE.CylinderGeometry(
                radius,
                radius,
                height,
                segments
            );

        return new THREE.Mesh(
            geometry,
            material
        );
    }

    function material(color, options = {}) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness:
                options.roughness ?? 0.8,
            metalness:
                options.metalness ?? 0,
            transparent:
                options.transparent ?? false,
            opacity:
                options.opacity ?? 1
        });
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    function initialize(options = {}) {
        if (state.initialized) {
            return world;
        }

        state.device =
            options.device ||
            detectDevice();

        world.scene =
            options.scene ||
            createScene();

        world.camera =
            options.camera ||
            createCamera();

        world.renderer =
            options.renderer ||
            createRenderer();

        createWorld();
        createPlayer();
        createSeeker();
        createObjectives();
        createGate();
        createLighting();
        createSpawnPoints();
        createWaypoints();

        setupInput();

        state.initialized = true;

        exposeAPI();

        console.log(
            "[THE SEEKER] Game initialized."
        );

        return world;
    }

    function detectDevice() {
        const touch =
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0;

        const width =
            window.innerWidth || 1920;

        if (touch && width < 1000) {
            return "mobile";
        }

        return "pc";
    }

    /* =========================================================
       SCENE
       ========================================================= */

    function createScene() {
        const scene =
            new THREE.Scene();

        scene.background =
            new THREE.Color(
                GAME.COLORS.VOID
            );

        scene.fog =
            new THREE.FogExp2(
                0x080909,
                0.007
            );

        return scene;
    }

    function createCamera() {
        const camera =
            new THREE.PerspectiveCamera(
                70,
                window.innerWidth /
                Math.max(1, window.innerHeight),
                0.05,
                1600
            );

        camera.position.set(
            0,
            GAME.PLAYER_HEIGHT,
            0
        );

        return camera;
    }

    function createRenderer() {
        const renderer =
            new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance"
            });

        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                2
            )
        );

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        renderer.shadowMap.enabled = true;

        renderer.shadowMap.type =
            THREE.PCFSoftShadowMap;

        renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        if (document.body) {
            const existing =
                document.querySelector(
                    "#gameCanvas"
                );

            if (existing) {
                existing.replaceWith(
                    renderer.domElement
                );
            } else {
                renderer.domElement.id =
                    "gameCanvas";

                document.body.appendChild(
                    renderer.domElement
                );
            }
        }

        window.addEventListener(
            "resize",
            resizeRenderer
        );

        return renderer;
    }

    function resizeRenderer() {
        if (!world.camera ||
            !world.renderer) {
            return;
        }

        const width =
            Math.max(
                1,
                window.innerWidth
            );

        const height =
            Math.max(
                1,
                window.innerHeight
            );

        world.camera.aspect =
            width / height;

        world.camera.updateProjectionMatrix();

        world.renderer.setSize(
            width,
            height
        );
    }

    /* =========================================================
       WORLD CREATION
       ========================================================= */

    function createWorld() {
        createGround();
        createOuterWalls();

        createMainHouse();
        createBasement();
        createHallways();

        createSideRooms();
        createStorageAreas();

        createWoods();

        createScatteredObjects();
        createDecorativeStructures();
    }

    function createGround() {
        const geometry =
            new THREE.PlaneGeometry(
                GAME.WORLD_SIZE,
                GAME.WORLD_SIZE
            );

        const ground =
            new THREE.Mesh(
                geometry,
                material(
                    GAME.COLORS.FLOOR,
                    {
                        roughness: 0.96
                    }
                )
            );

        ground.rotation.x =
            -Math.PI / 2;

        ground.position.y = 0;

        ground.receiveShadow = true;

        world.scene.add(ground);

        world.floors.push(ground);
    }

    function createOuterWalls() {
        const wallMaterial =
            material(
                GAME.COLORS.WALL,
                {
                    roughness: 0.9
                }
            );

        const size =
            GAME.WORLD_SIZE;

        const thickness = 3;
        const height = 16;

        addWall(
            0,
            height / 2,
            -size / 2,
            size,
            height,
            thickness,
            wallMaterial
        );

        addWall(
            0,
            height / 2,
            size / 2,
            size,
            height,
            thickness,
            wallMaterial
        );

        addWall(
            -size / 2,
            height / 2,
            0,
            thickness,
            height,
            size,
            wallMaterial
        );

        addWall(
            size / 2,
            height / 2,
            0,
            thickness,
            height,
            size,
            wallMaterial
        );
    }

    function addWall(
        x,
        y,
        z,
        width,
        height,
        depth,
        mat,
        options = {}
    ) {
        const wall =
            createBox(
                width,
                height,
                depth,
                mat
            );

        wall.position.set(
            x,
            y,
            z
        );

        wall.castShadow = true;
        wall.receiveShadow = true;

        world.scene.add(wall);

        if (options.collision !== false) {
            world.walls.push(wall);
        }

        return wall;
    }

    /* =========================================================
       MAIN HOUSE
       ========================================================= */

    function createMainHouse() {
        const wallMaterial =
            material(
                GAME.COLORS.CONCRETE
            );

        const woodMaterial =
            material(
                GAME.COLORS.WOOD,
                {
                    roughness: 0.95
                }
            );

        /*
         * Main structure is intentionally large.
         * The player is not placed inside a tiny room.
         */

        addWall(
            -145,
            7,
            -30,
            4,
            14,
            230,
            wallMaterial
        );

        addWall(
            145,
            7,
            -30,
            4,
            14,
            230,
            wallMaterial
        );

        addWall(
            0,
            7,
            -145,
            290,
            14,
            4,
            wallMaterial
        );

        addWall(
            0,
            7,
            85,
            290,
            14,
            4,
            wallMaterial
        );

        createMainInteriorWalls(
            wallMaterial
        );

        createWoodFloorSections(
            woodMaterial
        );

        createRoomLabels();
    }

    function createMainInteriorWalls(mat) {
        addWall(
            0,
            6,
            -80,
            4,
            12,
            120,
            mat
        );

        addWall(
            -70,
            6,
            -30,
            100,
            12,
            4,
            mat
        );

        addWall(
            70,
            6,
            -30,
            100,
            12,
            4,
            mat
        );

        addWall(
            -70,
            6,
            35,
            100,
            12,
            4,
            mat
        );

        addWall(
            70,
            6,
            35,
            100,
            12,
            4,
            mat
        );

        addWall(
            -100,
            6,
            10,
            4,
            12,
            45,
            mat
        );

        addWall(
            100,
            6,
            10,
            4,
            12,
            45,
            mat
        );

        addWall(
            -45,
            6,
            -110,
            4,
            12,
            50,
            mat
        );

        addWall(
            45,
            6,
            -110,
            4,
            12,
            50,
            mat
        );
    }

    function createWoodFloorSections(mat) {
        const sections = [
            [-105, 0, 65, 70],
            [105, 0, 65, 70],
            [0, -115, 70, 45],
            [-105, 60, 60, 35],
            [105, 60, 60, 35]
        ];

        for (const section of sections) {
            const [
                x,
                z,
                width,
                depth
            ] = section;

            const floor =
                createBox(
                    width,
                    0.25,
                    depth,
                    mat
                );

            floor.position.set(
                x,
                0.12,
                z
            );

            floor.receiveShadow = true;

            world.scene.add(floor);
            world.floors.push(floor);
        }
    }

    function createRoomLabels() {
        createSign(
            "BASEMENT",
            -105,
            8,
            72,
            0
        );

        createSign(
            "STORAGE",
            105,
            8,
            72,
            Math.PI
        );

        createSign(
            "EXIT",
            0,
            8,
            -142,
            0
        );
    }

    function createSign(
        text,
        x,
        y,
        z,
        rotation
    ) {
        /*
         * Text geometry is intentionally optional.
         * If FontLoader/TextGeometry is not present,
         * the game still works.
         */

        const canvas =
            document.createElement("canvas");

        canvas.width = 512;
        canvas.height = 128;

        const ctx =
            canvas.getContext("2d");

        if (!ctx) {
            return;
        }

        ctx.fillStyle =
            "rgba(0,0,0,0.8)";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle =
            "#c9a227";

        ctx.font =
            "bold 46px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.fillText(
            text,
            canvas.width / 2,
            canvas.height / 2
        );

        const texture =
            new THREE.CanvasTexture(
                canvas
            );

        const mat =
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true
            });

        const sign =
            createBox(
                7,
                1.7,
                0.08,
                mat
            );

        sign.position.set(
            x,
            y,
            z
        );

        sign.rotation.y =
            rotation;

        world.scene.add(sign);
    }

    /* =========================================================
       BASEMENT
       ========================================================= */

    function createBasement() {
        const basementMat =
            material(
                GAME.COLORS.DARK_METAL,
                {
                    roughness: 0.95,
                    metalness: 0.1
                }
            );

        const concreteMat =
            material(
                0x2c2d2d,
                {
                    roughness: 1
                }
            );

        /*
         * Large underground-style area.
         * It is represented in the same scene for simplicity.
         */

        addWall(
            -120,
            5,
            -225,
            170,
            10,
            3,
            basementMat
        );

        addWall(
            -120,
            5,
            -310,
            170,
            10,
            3,
            basementMat
        );

        addWall(
            -205,
            5,
            -267,
            3,
            10,
            90,
            basementMat
        );

        addWall(
            -35,
            5,
            -267,
            3,
            10,
            90,
            basementMat
        );

        const floor =
            createBox(
                165,
                0.3,
                82,
                concreteMat
            );

        floor.position.set(
            -120,
            0.15,
            -267
        );

        world.scene.add(floor);
        world.floors.push(floor);

        createBasementPillars(
            -120,
            -267
        );

        createPipeNetwork();
    }

    function createBasementPillars(
        centerX,
        centerZ
    ) {
        const mat =
            material(
                GAME.COLORS.METAL,
                {
                    metalness: 0.65,
                    roughness: 0.6
                }
            );

        for (let x = -185; x <= -55; x += 32) {
            for (
                let z = -295;
                z <= -235;
                z += 30
            ) {
                const pillar =
                    createBox(
                        2.5,
                        10,
                        2.5,
                        mat
                    );

                pillar.position.set(
                    x,
                    5,
                    z
                );

                pillar.castShadow = true;

                world.scene.add(pillar);
                world.obstacles.push(pillar);
            }
        }
    }

    function createPipeNetwork() {
        const pipeMat =
            material(
                0x46484a,
                {
                    metalness: 0.8,
                    roughness: 0.45
                }
            );

        const positions = [
            [-155, 7, -270, 55],
            [-95, 8, -285, 80],
            [-65, 6, -250, 45],
            [-180, 8, -245, 50]
        ];

        for (const item of positions) {
            const [
                x,
                y,
                z,
                length
            ] = item;

            const pipe =
                createCylinder(
                    0.65,
                    length,
                    pipeMat,
                    12
                );

            pipe.position.set(
                x,
                y,
                z
            );

            pipe.rotation.z =
                Math.PI / 2;

            pipe.castShadow = true;

            world.scene.add(pipe);
        }
    }

    /* =========================================================
       HALLWAYS
       ========================================================= */

    function createHallways() {
        const mat =
            material(
                GAME.COLORS.WALL,
                {
                    roughness: 0.92
                }
            );

        createHallway(
            0,
            -5,
            18,
            120,
            mat
        );

        createHallway(
            -55,
            42,
            90,
            14,
            mat
        );

        createHallway(
            55,
            42,
            90,
            14,
            mat
        );

        createHallway(
            0,
            68,
            130,
            14,
            mat
        );
    }

    function createHallway(
        x,
        z,
        length,
        width,
        mat
    ) {
        const wallThickness = 2.5;
        const height = 11;

        addWall(
            x - width / 2,
            height / 2,
            z,
            wallThickness,
            height,
            length,
            mat
        );

        addWall(
            x + width / 2,
            height / 2,
            z,
            wallThickness,
            height,
            length,
            mat
        );
    }

    /* =========================================================
       SIDE ROOMS
       ========================================================= */

    function createSideRooms() {
        const roomMaterial =
            material(
                0x303132,
                {
                    roughness: 0.98
                }
            );

        createRoom(
            -245,
            -80,
            90,
            70,
            roomMaterial
        );

        createRoom(
            245,
            -80,
            90,
            70,
            roomMaterial
        );

        createRoom(
            -245,
            80,
            90,
            70,
            roomMaterial
        );

        createRoom(
            245,
            80,
            90,
            70,
            roomMaterial
        );
    }

    function createRoom(
        centerX,
        centerZ,
        width,
        depth,
        mat
    ) {
        const height = 12;
        const thickness = 3;

        addWall(
            centerX - width / 2,
            height / 2,
            centerZ,
            thickness,
            height,
            depth,
            mat
        );

        addWall(
            centerX + width / 2,
            height / 2,
            centerZ,
            thickness,
            height,
            depth,
            mat
        );

        addWall(
            centerX,
            height / 2,
            centerZ - depth / 2,
            width,
            height,
            thickness,
            mat
        );

        addWall(
            centerX,
            height / 2,
            centerZ + depth / 2,
            width,
            height,
            thickness,
            mat
        );

        const floor =
            createBox(
                width - 4,
                0.2,
                depth - 4,
                material(
                    GAME.COLORS.FLOOR
                )
            );

        floor.position.set(
            centerX,
            0.1,
            centerZ
        );

        floor.receiveShadow = true;

        world.scene.add(floor);
        world.floors.push(floor);
    }

    /* =========================================================
       STORAGE
       ========================================================= */

    function createStorageAreas() {
        const storageMat =
            material(
                0x252627,
                {
                    roughness: 0.94
                }
            );

        for (
            let i = 0;
            i < 12;
            i++
        ) {
            const x =
                55 +
                (i % 4) * 18;

            const z =
                5 +
                Math.floor(i / 4) * 20;

            const shelf =
                createBox(
                    12,
                    5,
                    2,
                    storageMat
                );

            shelf.position.set(
                x,
                2.5,
                z
            );

            shelf.castShadow = true;

            world.scene.add(shelf);

            world.obstacles.push(shelf);

            for (
                let j = 0;
                j < 3;
                j++
            ) {
                const crate =
                    createBox(
                        2.8,
                        2.2,
                        2.8,
                        material(
                            GAME.COLORS.WOOD
                        )
                    );

                crate.position.set(
                    x - 3 +
                    j * 3,
                    1.2,
                    z + 2
                );

                crate.rotation.y =
                    randomRange(
                        -0.1,
                        0.1
                    );

                crate.castShadow = true;

                world.scene.add(crate);

                world.obstacles.push(crate);
            }
        }
    }

    /* =========================================================
       WOODS
       ========================================================= */

    function createWoods() {
        const treeMaterial =
            material(
                0x171c17,
                {
                    roughness: 1
                }
            );

        const trunkMaterial =
            material(
                0x241b13,
                {
                    roughness: 1
                }
            );

        /*
         * Procedural forest around the primary structure.
         */

        for (
            let i = 0;
            i < 150;
            i++
        ) {
            let x =
                randomRange(
                    -450,
                    450
                );

            let z =
                randomRange(
                    -450,
                    450
                );

            /*
             * Keep a central clear zone.
             */

            if (
                Math.abs(x) < 180 &&
                Math.abs(z) < 170
            ) {
                continue;
            }

            /*
             * Avoid the far basement entrance area.
             */

            if (
                x < -40 &&
                x > -220 &&
                z < -210 &&
                z > -330
            ) {
                continue;
            }

            const height =
                randomRange(
                    8,
                    18
                );

            const trunk =
                createCylinder(
                    randomRange(
                        0.35,
                        0.75
                    ),
                    height,
                    trunkMaterial,
                    8
                );

            trunk.position.set(
                x,
                height / 2,
                z
            );

            trunk.castShadow = true;

            world.scene.add(trunk);

            const canopy =
                createCylinder(
                    randomRange(
                        2.5,
                        5
                    ),
                    randomRange(
                        5,
                        10
                    ),
                    treeMaterial,
                    8
                );

            canopy.position.set(
                x,
                height +
                randomRange(
                    1,
                    4
                ),
                z
            );

            canopy.rotation.y =
                randomRange(
                    0,
                    Math.PI
                );

            canopy.castShadow = true;

            world.scene.add(canopy);

            world.obstacles.push(trunk);
        }
    }

    /* =========================================================
       DECORATIVE OBJECTS
       ========================================================= */

    function createScatteredObjects() {
        for (
            let i = 0;
            i < 75;
            i++
        ) {
            const x =
                randomRange(
                    -130,
                    130
                );

            const z =
                randomRange(
                    -130,
                    80
                );

            if (
                Math.abs(x) < 8 &&
                Math.abs(z) < 8
            ) {
                continue;
            }

            const type =
                i % 4;

            if (type === 0) {
                createCrate(
                    x,
                    z
                );
            }

            if (type === 1) {
                createBarrel(
                    x,
                    z
                );
            }

            if (type === 2) {
                createTable(
                    x,
                    z
                );
            }

            if (type === 3) {
                createDebris(
                    x,
                    z
                );
            }
        }
    }

    function createCrate(
        x,
        z
    ) {
        const crate =
            createBox(
                randomRange(
                    1.5,
                    3.2
                ),
                randomRange(
                    1.5,
                    3
                ),
                randomRange(
                    1.5,
                    3.2
                ),
                material(
                    GAME.COLORS.WOOD
                )
            );

        crate.position.set(
            x,
            crate.geometry.parameters.height / 2,
            z
        );

        crate.rotation.y =
            randomRange(
                0,
                Math.PI
            );

        crate.castShadow = true;

        world.scene.add(crate);

        world.obstacles.push(crate);
    }

    function createBarrel(
        x,
        z
    ) {
        const barrel =
            createCylinder(
                0.8,
                2.1,
                material(
                    GAME.COLORS.DARK_METAL,
                    {
                        metalness: 0.7,
                        roughness: 0.6
                    }
                ),
                16
            );

        barrel.position.set(
            x,
            1.05,
            z
        );

        barrel.castShadow = true;

        world.scene.add(barrel);

        world.obstacles.push(barrel);
    }

    function createTable(
        x,
        z
    ) {
        const table =
            createBox(
                4,
                0.4,
                2,
                material(
                    GAME.COLORS.WOOD
                )
            );

        table.position.set(
            x,
            2,
            z
        );

        table.castShadow = true;

        world.scene.add(table);

        const legMaterial =
            material(
                GAME.COLORS.WOOD_DARK
            );

        const positions = [
            [-1.5, -0.7],
            [1.5, -0.7],
            [-1.5, 0.7],
            [1.5, 0.7]
        ];

        for (const p of positions) {
            const leg =
                createBox(
                    0.3,
                    2,
                    0.3,
                    legMaterial
                );

            leg.position.set(
                x + p[0],
                1,
                z + p[1]
            );

            world.scene.add(leg);

            world.obstacles.push(leg);
        }

        world.obstacles.push(table);
    }

    function createDebris(
        x,
        z
    ) {
        for (
            let i = 0;
            i < 3;
            i++
        ) {
            const piece =
                createBox(
                    randomRange(
                        0.3,
                        1.2
                    ),
                    randomRange(
                        0.15,
                        0.5
                    ),
                    randomRange(
                        0.3,
                        1.2
                    ),
                    material(
                        GAME.COLORS.METAL
                    )
                );

            piece.position.set(
                x +
                randomRange(
                    -1,
                    1
                ),
                randomRange(
                    0.1,
                    0.35
                ),
                z +
                randomRange(
                    -1,
                    1
                )
            );

            piece.rotation.set(
                randomRange(
                    -0.5,
                    0.5
                ),
                randomRange(
                    0,
                    Math.PI
                ),
                randomRange(
                    -0.5,
                    0.5
                )
            );

            world.scene.add(piece);
        }
    }

    function createDecorativeStructures() {
        createWaterTower();
        createWatchTower();
        createGeneratorBuilding();
        createFence();
    }

    function createWaterTower() {
        const metal =
            material(
                0x414345,
                {
                    metalness: 0.8,
                    roughness: 0.55
                }
            );

        const tank =
            createCylinder(
                5,
                8,
                metal,
                20
            );

        tank.position.set(
            280,
            12,
            240
        );

        tank.castShadow = true;

        world.scene.add(tank);

        for (
            let i = 0;
            i < 4;
            i++
        ) {
            const angle =
                i *
                Math.PI /
                2;

            const leg =
                createBox(
                    0.7,
                    12,
                    0.7,
                    metal
                );

            leg.position.set(
                280 +
                Math.cos(angle) * 3.5,
                6,
                240 +
                Math.sin(angle) * 3.5
            );

            leg.castShadow = true;

            world.scene.add(leg);

            world.obstacles.push(leg);
        }
    }

    function createWatchTower() {
        const metal =
            material(
                0x292b2d,
                {
                    metalness: 0.6
                }
            );

        const tower =
            createBox(
                7,
                18,
                7,
                metal
            );

        tower.position.set(
            -320,
            9,
            260
        );

        tower.castShadow = true;

        world.scene.add(tower);

        const roof =
            createBox(
                10,
                1,
                10,
                material(
                    GAME.COLORS.DARK_METAL
                )
            );

        roof.position.set(
            -320,
            18.5,
            260
        );

        world.scene.add(roof);
    }

    function createGeneratorBuilding() {
        const mat =
            material(
                0x28292a,
                {
                    roughness: 0.9
                }
            );

        const building =
            createBox(
                45,
                12,
                35,
                mat
            );

        building.position.set(
            300,
            6,
            -260
        );

        building.castShadow = true;

        world.scene.add(building);

        world.obstacles.push(building);
    }

    function createFence() {
        const metal =
            material(
                0x353638,
                {
                    metalness: 0.7,
                    roughness: 0.6
                }
            );

        for (
            let x = -400;
            x <= 400;
            x += 12
        ) {
            if (
                x > -180 &&
                x < 180
            ) {
                continue;
            }

            const post =
                createBox(
                    0.25,
                    3,
                    0.25,
                    metal
                );

            post.position.set(
                x,
                1.5,
                390
            );

            world.scene.add(post);
        }
    }

    /* =========================================================
       PLAYER
       ========================================================= */

    function createPlayer() {
        const group =
            new THREE.Group();

        group.name =
            "Player";

        const bodyMaterial =
            material(
                0x202225,
                {
                    roughness: 0.7
                }
            );

        const body =
            createBox(
                0.7,
                1.1,
                0.45,
                bodyMaterial
            );

        body.position.y =
            -0.25;

        body.castShadow = true;

        group.add(body);

        const head =
            createCylinder(
                0.3,
                0.45,
                bodyMaterial,
                16
            );

        head.rotation.z =
            Math.PI / 2;

        head.position.y =
            0.65;

        head.castShadow = true;

        group.add(head);

        group.position.copy(
            state.player.position
        );

        world.scene.add(group);

        world.playerObject =
            group;

        world.playerCollider =
            new THREE.Sphere(
                new THREE.Vector3(
                    group.position.x,
                    GAME.PLAYER_HEIGHT / 2,
                    group.position.z
                ),
                GAME.PLAYER_RADIUS
            );

        /*
         * Camera starts at player eye level.
         */

        world.camera.position.set(
            group.position.x,
            GAME.PLAYER_HEIGHT,
            group.position.z
        );
    }

    /* =========================================================
       SEEKER
       ========================================================= */

    function createSeeker() {
        const group =
            new THREE.Group();

        group.name =
            "Seeker";

        const darkMaterial =
            material(
                0x0c0d0e,
                {
                    roughness: 0.75,
                    metalness: 0.05
                }
            );

        const body =
            createCylinder(
                0.7,
                2.4,
                darkMaterial,
                18
            );

        body.position.y =
            1.8;

        body.castShadow = true;

        group.add(body);

        const head =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.85,
                    24,
                    24
                ),
                darkMaterial
            );

        head.position.y =
            3.45;

        head.castShadow = true;

        group.add(head);

        const eyeMaterial =
            new THREE.MeshBasicMaterial({
                color: GAME.COLORS.RED
            });

        const leftEye =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.08,
                    8,
                    8
                ),
                eyeMaterial
            );

        const rightEye =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.08,
                    8,
                    8
                ),
                eyeMaterial
            );

        leftEye.position.set(
            -0.25,
            3.48,
            0.76
        );

        rightEye.position.set(
            0.25,
            3.48,
            0.76
        );

        group.add(
            leftEye,
            rightEye
        );

        group.position.copy(
            state.seeker.position
        );

        group.visible = false;

        world.scene.add(group);

        world.seekerObject =
            group;

        world.seekerCollider =
            new THREE.Sphere(
                new THREE.Vector3(
                    group.position.x,
                    1.5,
                    group.position.z
                ),
                1.2
            );
    }

    /* =========================================================
       OBJECTIVES
       ========================================================= */

    function createObjectives() {
        const locations = [
            {
                id: "button1",
                x: -105,
                z: 55
            },
            {
                id: "button2",
                x: 105,
                z: -45
            },
            {
                id: "button3",
                x: -80,
                z: -115
            }
        ];

        for (const data of locations) {
            createButton(
                data.id,
                data.x,
                data.z
            );
        }

        createKey();
    }

    function createButton(
        id,
        x,
        z
    ) {
        const group =
            new THREE.Group();

        group.name =
            id;

        const baseMaterial =
            material(
                GAME.COLORS.DARK_METAL,
                {
                    metalness: 0.7
                }
            );

        const base =
            createBox(
                1.5,
                0.25,
                1.5,
                baseMaterial
            );

        base.position.y =
            0.125;

        group.add(base);

        const buttonMaterial =
            material(
                GAME.COLORS.RED,
                {
                    roughness: 0.35,
                    metalness: 0.1
                }
            );

        const button =
            createCylinder(
                0.38,
                0.25,
                buttonMaterial,
                20
            );

        button.position.y =
            0.38;

        group.add(button);

        const indicator =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.08,
                    8,
                    8
                ),
                new THREE.MeshBasicMaterial({
                    color: GAME.COLORS.RED
                })
            );

        indicator.position.set(
            0,
            0.65,
            0
        );

        group.add(indicator);

        group.position.set(
            x,
            0,
            z
        );

        group.userData = {
            id,
            pressed: false,
            indicator
        };

        world.scene.add(group);

        world.buttons.push(group);

        world.interactables.push(
            group
        );
    }

    function createKey() {
        const group =
            new THREE.Group();

        group.name =
            "ExitKey";

        const keyMaterial =
            material(
                GAME.COLORS.YELLOW,
                {
                    metalness: 0.85,
                    roughness: 0.25
                }
            );

        const shaft =
            createCylinder(
                0.12,
                1.6,
                keyMaterial,
                12
            );

        shaft.rotation.z =
            Math.PI / 2;

        group.add(shaft);

        const ring =
            new THREE.Mesh(
                new THREE.TorusGeometry(
                    0.35,
                    0.1,
                    10,
                    20
                ),
                keyMaterial
            );

        ring.rotation.y =
            Math.PI / 2;

        ring.position.x =
            -0.7;

        group.add(ring);

        const tooth1 =
            createBox(
                0.3,
                0.25,
                0.15,
                keyMaterial
            );

        tooth1.position.set(
            0.55,
            -0.15,
            0
        );

        group.add(tooth1);

        const tooth2 =
            createBox(
                0.25,
                0.25,
                0.15,
                keyMaterial
            );

        tooth2.position.set(
            0.25,
            -0.15,
            0
        );

        group.add(tooth2);

        group.position.set(
            0,
            1.2,
            -15
        );

        group.visible = false;

        group.userData = {
            collected: false
        };

        world.scene.add(group);

        world.keyObject =
            group;

        world.interactables.push(
            group
        );
    }

    /* =========================================================
       GATE
       ========================================================= */

    function createGate() {
        const gateGroup =
            new THREE.Group();

        gateGroup.name =
            "ExitGate";

        const metal =
            material(
                0x303235,
                {
                    metalness: 0.75,
                    roughness: 0.5
                }
            );

        const frameLeft =
            createBox(
                1,
                10,
                1,
                metal
            );

        frameLeft.position.set(
            -5,
            5,
            0
        );

        const frameRight =
            createBox(
                1,
                10,
                1,
                metal
            );

        frameRight.position.set(
            5,
            5,
            0
        );

        const top =
            createBox(
                11,
                1,
                1,
                metal
            );

        top.position.set(
            0,
            9.5,
            0
        );

        gateGroup.add(
            frameLeft,
            frameRight,
            top
        );

        const bars =
            new THREE.Group();

        for (
            let i = -4;
            i <= 4;
            i += 1
        ) {
            const bar =
                createBox(
                    0.45,
                    9,
                    0.45,
                    metal
                );

            bar.position.set(
                i,
                4.5,
                0
            );

            bars.add(bar);
        }

        gateGroup.add(bars);

        gateGroup.position.set(
            0,
            0,
            -140
        );

        gateGroup.userData = {
            bars,
            unlocked: false,
            openAmount: 0
        };

        world.scene.add(
            gateGroup
        );

        world.gateObject =
            gateGroup;

        world.walls.push(
            gateGroup
        );
    }

    /* =========================================================
       LIGHTING
       ========================================================= */

    function createLighting() {
        const ambient =
            new THREE.HemisphereLight(
                0x293038,
                0x050505,
                0.28
            );

        world.scene.add(
            ambient
        );

        world.lights.push(
            ambient
        );

        const moon =
            new THREE.DirectionalLight(
                0x8996a4,
                0.55
            );

        moon.position.set(
            -200,
            350,
            -200
        );

        moon.castShadow = true;

        moon.shadow.mapSize.width =
            2048;

        moon.shadow.mapSize.height =
            2048;

        moon.shadow.camera.left =
            -400;

        moon.shadow.camera.right =
            400;

        moon.shadow.camera.top =
            400;

        moon.shadow.camera.bottom =
            -400;

        world.scene.add(
            moon
        );

        world.lights.push(
            moon
        );

        createLight(
            -105,
            7,
            55,
            0xffd9a0,
            4,
            15
        );

        createLight(
            105,
            7,
            -45,
            0xffd9a0,
            4,
            15
        );

        createLight(
            -80,
            7,
            -115,
            0xffd9a0,
            4,
            15
        );

        createLight(
            0,
            6,
            -80,
            0x554f43,
            2,
            20
        );

        createLight(
            0,
            6,
            50,
            0x45484a,
            2,
            20
        );

        createLight(
            -120,
            8,
            -267,
            0x5c7180,
            3,
            22
        );
    }

    function createLight(
        x,
        y,
        z,
        color,
        intensity,
        distance
    ) {
        const light =
            new THREE.PointLight(
                color,
                intensity,
                distance
            );

        light.position.set(
            x,
            y,
            z
        );

        light.castShadow = true;

        light.shadow.mapSize.width =
            512;

        light.shadow.mapSize.height =
            512;

        world.scene.add(
            light
        );

        world.lights.push(
            light
        );

        return light;
    }

    /* =========================================================
       SPAWN POINTS
       ========================================================= */

    function createSpawnPoints() {
        world.spawnPoints = [
            new THREE.Vector3(
                0,
                GAME.PLAYER_HEIGHT,
                35
            ),

            new THREE.Vector3(
                -100,
                GAME.PLAYER_HEIGHT,
                55
            ),

            new THREE.Vector3(
                100,
                GAME.PLAYER_HEIGHT,
                -45
            ),

            new THREE.Vector3(
                -80,
                GAME.PLAYER_HEIGHT,
                -115
            )
        ];
    }

    function createWaypoints() {
        world.seekerWaypoints = [
            new THREE.Vector3(
                0,
                0,
                -110
            ),

            new THREE.Vector3(
                -100,
                0,
                -100
            ),

            new THREE.Vector3(
                -105,
                0,
                50
            ),

            new THREE.Vector3(
                -100,
                0,
                90
            ),

            new THREE.Vector3(
                0,
                0,
                65
            ),

            new THREE.Vector3(
                100,
                0,
                70
            ),

            new THREE.Vector3(
                105,
                0,
                -45
            ),

            new THREE.Vector3(
                80,
                0,
                -100
            ),

            new THREE.Vector3(
                0,
                0,
                -130
            )
        ];
    }

    /* =========================================================
       INPUT SETUP
       ========================================================= */

    function setupInput() {
        window.addEventListener(
            "keydown",
            event => {
                input.keys[
                    event.code
                ] = true;

                if (
                    event.code === "ShiftLeft" ||
                    event.code === "ShiftRight"
                ) {
                    state.player.sprinting =
                        true;
                }
            }
        );

        window.addEventListener(
            "keyup",
            event => {
                input.keys[
                    event.code
                ] = false;

                if (
                    event.code === "ShiftLeft" ||
                    event.code === "ShiftRight"
                ) {
                    state.player.sprinting =
                        false;
                }
            }
        );

        window.addEventListener(
            "mousemove",
            event => {
                if (
                    document.pointerLockElement ===
                    world.renderer?.domElement
                ) {
                    state.player.rotationY -=
                        event.movementX *
                        0.0023;
                }
            }
        );

        if (
            world.renderer &&
            world.renderer.domElement
        ) {
            world.renderer.domElement.addEventListener(
                "click",
                () => {
                    if (
                        state.device === "pc" &&
                        !state.paused
                    ) {
                        try {
                            world.renderer.domElement
                                .requestPointerLock();
                        } catch (_) {
                            /*
                             * Pointer lock may be unavailable.
                             */
                        }
                    }
                }
            );
        }

        setupMobileInput();
    }

    function setupMobileInput() {
        if (!document) {
            return;
        }

        const moveStick =
            document.querySelector(
                "#moveStick"
            );

        const cameraStick =
            document.querySelector(
                "#cameraStick"
            );

        if (moveStick) {
            attachJoystick(
                moveStick,
                input.joystick
            );
        }

        if (cameraStick) {
            attachJoystick(
                cameraStick,
                input.cameraJoystick
            );
        }
    }

    function attachJoystick(
        element,
        target
    ) {
        let pointerId = null;

        const update =
            event => {
                if (
                    pointerId === null ||
                    event.pointerId !== pointerId
                ) {
                    return;
                }

                const rect =
                    element.getBoundingClientRect();

                const centerX =
                    rect.left +
                    rect.width / 2;

                const centerY =
                    rect.top +
                    rect.height / 2;

                const radius =
                    rect.width / 2;

                let x =
                    (event.clientX -
                        centerX) /
                    radius;

                let y =
                    (event.clientY -
                        centerY) /
                    radius;

                const length =
                    Math.sqrt(
                        x * x +
                        y * y
                    );

                if (length > 1) {
                    x /= length;
                    y /= length;
                }

                target.x = x;
                target.y = y;
                target.active = true;
            };

        element.addEventListener(
            "pointerdown",
            event => {
                pointerId =
                    event.pointerId;

                try {
                    element.setPointerCapture(
                        pointerId
                    );
                } catch (_) {}

                update(event);
            }
        );

        element.addEventListener(
            "pointermove",
            update
        );

        const end =
            event => {
                if (
                    event.pointerId !== pointerId
                ) {
                    return;
                }

                pointerId = null;

                target.x = 0;
                target.y = 0;
                target.active = false;
            };

        element.addEventListener(
            "pointerup",
            end
        );

        element.addEventListener(
            "pointercancel",
            end
        );
    }

    /* =========================================================
       GAME LOOP
       ========================================================= */

    function start() {
        if (!state.initialized) {
            initialize();
        }

        state.running = true;
        state.paused = false;

        world.clock.start();

        requestAnimationFrame(
            gameLoop
        );
    }

    function stop() {
        state.running = false;
    }

    function pause() {
        state.paused = true;
    }

    function resume() {
        state.paused = false;
        world.clock.getDelta();
    }

    function gameLoop() {
        if (!state.running) {
            return;
        }

        requestAnimationFrame(
            gameLoop
        );

        state.delta =
            Math.min(
                world.clock.getDelta(),
                0.05
            );

        if (state.paused) {
            render();
            return;
        }

        update(
            state.delta
        );

        render();
    }

    function update(delta) {
        if (
            state.playerCaught ||
            state.gameWon
        ) {
            updateCamera(delta);
            updateEffects(delta);
            render();
            return;
        }

        state.elapsed += delta;

        updateSetupTimer(
            delta
        );

        updatePlayer(
            delta
        );

        updateObjectives(
            delta
        );

        updateGate(
            delta
        );

        updateSeeker(
            delta
        );

        updateCamera(
            delta
        );

        updateMinimap();

        updateEffects(
            delta
        );
    }

    function render() {
        if (
            world.renderer &&
            world.scene &&
            world.camera
        ) {
            world.renderer.render(
                world.scene,
                world.camera
            );
        }
    }

    /* =========================================================
       SETUP TIMER
       ========================================================= */

    function updateSetupTimer(delta) {
        if (state.seekerActive) {
            return;
        }

        state.setupRemaining =
            Math.max(
                0,
                state.setupRemaining -
                delta
            );

        if (
            state.setupRemaining <= 0
        ) {
            activateSeeker();
        }

        emitState();
    }

    function activateSeeker() {
        if (state.seekerActive) {
            return;
        }

        state.seekerActive = true;

        state.seeker.state =
            "patrolling";

        world.seekerObject.visible =
            true;

        const spawn =
            world.seekerWaypoints[0];

        state.seeker.position.copy(
            spawn
        );

        syncSeekerObject();

        emitEvent(
            "seekerActivated",
            {
                remaining: 0
            }
        );
    }

    /* =========================================================
       PLAYER UPDATE
       ========================================================= */

    function updatePlayer(delta) {
        if (
            !world.playerObject
        ) {
            return;
        }

        const move =
            getMovementInput();

        const magnitude =
            Math.min(
                1,
                Math.sqrt(
                    move.x * move.x +
                    move.z * move.z
                )
            );

        state.player.moving =
            magnitude > 0.05;

        const sprint =
            state.player.sprinting &&
            !state.player.crouching &&
            magnitude > 0.05;

        state.player.running =
            sprint;

        let speed =
            sprint
                ? GAME.PLAYER_RUN_SPEED
                : GAME.PLAYER_WALK_SPEED;

        if (
            state.player.crouching
        ) {
            speed *= 0.55;
        }

        const forward =
            new THREE.Vector3(
                Math.sin(
                    state.player.rotationY
                ),
                0,
                Math.cos(
                    state.player.rotationY
                )
            );

        const right =
            new THREE.Vector3(
                Math.cos(
                    state.player.rotationY
                ),
                0,
                -Math.sin(
                    state.player.rotationY
                )
            );

        const desired =
            new THREE.Vector3();

        desired.addScaledVector(
            forward,
            move.z
        );

        desired.addScaledVector(
            right,
            move.x
        );

        if (
            desired.lengthSq() > 0
        ) {
            desired.normalize();
        }

        const targetVelocity =
            desired.multiplyScalar(
                speed
            );

        state.player.velocity.x =
            lerp(
                state.player.velocity.x,
                targetVelocity.x,
                Math.min(
                    1,
                    delta * 12
                )
            );

        state.player.velocity.z =
            lerp(
                state.player.velocity.z,
                targetVelocity.z,
                Math.min(
                    1,
                    delta * 12
                )
            );

        const next =
            world.playerObject.position
                .clone();

        next.x +=
            state.player.velocity.x *
            delta;

        next.z +=
            state.player.velocity.z *
            delta;

        const resolved =
            resolvePlayerCollision(
                next
            );

        world.playerObject.position.copy(
            resolved
        );

        state.player.position.copy(
            world.playerObject.position
        );

        world.playerObject.rotation.y =
            state.player.rotationY;

        updatePlayerCollider();

        if (
            state.player.moving
        ) {
            emitFootstepEvent();
        }
    }

    function getMovementInput() {
        let x = 0;
        let z = 0;

        if (
            input.keys.KeyA ||
            input.keys.ArrowLeft
        ) {
            x -= 1;
        }

        if (
            input.keys.KeyD ||
            input.keys.ArrowRight
        ) {
            x += 1;
        }

        if (
            input.keys.KeyW ||
            input.keys.ArrowUp
        ) {
            z += 1;
        }

        if (
            input.keys.KeyS ||
            input.keys.ArrowDown
        ) {
            z -= 1;
        }

        if (
            state.device === "mobile" &&
            input.joystick.active
        ) {
            x =
                input.joystick.x;

            z =
                -input.joystick.y;
        }

        return {
            x,
            z
        };
    }

    function emitFootstepEvent() {
        /*
         * System.js can listen for this.
         * This file does not directly own audio.
         */

        if (
            typeof window.dispatchEvent !==
            "function"
        ) {
            return;
        }

        const event =
            new CustomEvent(
                "seeker:footstep",
                {
                    detail: {
                        running:
                            state.player.running,
                        position:
                            state.player.position.clone()
                    }
                }
            );

        window.dispatchEvent(
            event
        );
    }

    /* =========================================================
       PLAYER COLLISION
       ========================================================= */

    function resolvePlayerCollision(
        position
    ) {
        const result =
            position.clone();

        result.x =
            clamp(
                result.x,
                -GAME.WORLD_SIZE / 2 + 5,
                GAME.WORLD_SIZE / 2 - 5
            );

        result.z =
            clamp(
                result.z,
                -GAME.WORLD_SIZE / 2 + 5,
                GAME.WORLD_SIZE / 2 - 5
            );

        const radius =
            GAME.PLAYER_RADIUS;

        for (const wall of world.walls) {
            if (
                !wall ||
                !wall.geometry
            ) {
                continue;
            }

            const box =
                new THREE.Box3()
                    .setFromObject(
                        wall
                    );

            const closest =
                new THREE.Vector3(
                    clamp(
                        result.x,
                        box.min.x,
                        box.max.x
                    ),
                    result.y,
                    clamp(
                        result.z,
                        box.min.z,
                        box.max.z
                    )
                );

            const dx =
                result.x -
                closest.x;

            const dz =
                result.z -
                closest.z;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );

            if (
                distance < radius
            ) {
                if (
                    distance > 0.0001
                ) {
                    const push =
                        radius -
                        distance;

                    result.x +=
                        (dx / distance) *
                        push;

                    result.z +=
                        (dz / distance) *
                        push;
                } else {
                    const left =
                        Math.abs(
                            result.x -
                            box.min.x
                        );

                    const right =
                        Math.abs(
                            box.max.x -
                            result.x
                        );

                    const top =
                        Math.abs(
                            result.z -
                            box.min.z
                        );

                    const bottom =
                        Math.abs(
                            box.max.z -
                            result.z
                        );

                    const smallest =
                        Math.min(
                            left,
                            right,
                            top,
                            bottom
                        );

                    if (
                        smallest === left
                    ) {
                        result.x =
                            box.min.x -
                            radius;
                    } else if (
                        smallest === right
                    ) {
                        result.x =
                            box.max.x +
                            radius;
                    } else if (
                        smallest === top
                    ) {
                        result.z =
                            box.min.z -
                            radius;
                    } else {
                        result.z =
                            box.max.z +
                            radius;
                    }
                }
            }
        }

        for (const obstacle of world.obstacles) {
            if (
                !obstacle ||
                !obstacle.geometry
            ) {
                continue;
            }

            const box =
                new THREE.Box3()
                    .setFromObject(
                        obstacle
                    );

            const closest =
                new THREE.Vector3(
                    clamp(
                        result.x,
                        box.min.x,
                        box.max.x
                    ),
                    result.y,
                    clamp(
                        result.z,
                        box.min.z,
                        box.max.z
                    )
                );

            const dx =
                result.x -
                closest.x;

            const dz =
                result.z -
                closest.z;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );

            if (
                distance < radius
            ) {
                if (
                    distance > 0.0001
                ) {
                    const push =
                        radius -
                        distance;

                    result.x +=
                        dx / distance *
                        push;

                    result.z +=
                        dz / distance *
                        push;
                }
            }
        }

        return result;
    }

    function updatePlayerCollider() {
        if (
            !world.playerCollider ||
            !world.playerObject
        ) {
            return;
        }

        world.playerCollider.center.set(
            world.playerObject.position.x,
            GAME.PLAYER_HEIGHT / 2,
            world.playerObject.position.z
        );
    }

    /* =========================================================
       OBJECTIVE UPDATE
       ========================================================= */

    function updateObjectives(delta) {
        for (const button of world.buttons) {
            if (
                !button ||
                button.userData.pressed
            ) {
                continue;
            }

            button.rotation.y +=
                delta * 0.25;

            const distance =
                distance2D(
                    world.playerObject.position,
                    button.position
                );

            if (
                distance <=
                GAME.INTERACTION_DISTANCE &&
                input.keys.KeyE
            ) {
                input.keys.KeyE = false;

                pressButton(
                    button.userData.id
                );
            }
        }

        if (
            world.keyObject &&
            !state.hasKey
        ) {
            world.keyObject.rotation.y +=
                delta * 1.8;

            world.keyObject.position.y =
                1.2 +
                Math.sin(
                    state.elapsed * 2
                ) *
                0.15;

            const distance =
                distance2D(
                    world.playerObject.position,
                    world.keyObject.position
                );

            if (
                world.keyObject.visible &&
                distance <=
                GAME.INTERACTION_DISTANCE &&
                input.keys.KeyE
            ) {
                input.keys.KeyE = false;

                collectKey();
            }
        }
    }

    function pressButton(id) {
        const button =
            world.buttons.find(
                item =>
                    item.userData.id === id
            );

        if (
            !button ||
            button.userData.pressed
        ) {
            return;
        }

        button.userData.pressed =
            true;

        state.buttons[id] =
            true;

        state.buttonsFound =
            Object.values(
                state.buttons
            ).filter(Boolean).length;

        const indicator =
            button.userData.indicator;

        if (indicator) {
            indicator.material =
                new THREE.MeshBasicMaterial({
                    color:
                        GAME.COLORS.GREEN
                });
        }

        const buttonMesh =
            button.children[1];

        if (buttonMesh) {
            buttonMesh.position.y =
                0.28;
        }

        emitEvent(
            "buttonPressed",
            {
                id,
                count:
                    state.buttonsFound,
                required:
                    GAME.REQUIRED_BUTTONS
            }
        );

        if (
            state.buttonsFound >=
            GAME.REQUIRED_BUTTONS
        ) {
            unlockKeySpawn();
        }

        emitState();
    }

    function unlockKeySpawn() {
        if (
            !world.keyObject
        ) {
            return;
        }

        world.keyObject.visible =
            true;

        emitEvent(
            "keyAvailable"
        );
    }

    function collectKey() {
        if (
            state.hasKey
        ) {
            return;
        }

        state.hasKey = true;

        if (
            world.keyObject
        ) {
            world.keyObject.visible =
                false;
        }

        emitEvent(
            "keyCollected"
        );

        emitState();
    }

    /* =========================================================
       GATE UPDATE
       ========================================================= */

    function updateGate(delta) {
        if (
            !world.gateObject
        ) {
            return;
        }

        const gate =
            world.gateObject;

        const distance =
            distance2D(
                world.playerObject.position,
                gate.position
            );

        if (
            state.hasKey &&
            !state.gateUnlocked &&
            distance <=
            GAME.INTERACTION_DISTANCE &&
            input.keys.KeyE
        ) {
            input.keys.KeyE = false;

            unlockGate();
        }

        if (
            gate.userData.unlocked
        ) {
            gate.userData.openAmount =
                Math.min(
                    1,
                    gate.userData.openAmount +
                    delta * 0.7
                );

            gate.userData.bars.position.y =
                gate.userData.openAmount *
                11;
        }
    }

    function unlockGate() {
        if (
            state.gateUnlocked
        ) {
            return;
        }

        state.gateUnlocked = true;

        world.gateObject.userData.unlocked =
            true;

        /*
         * Remove the gate from collision.
         */

        const index =
            world.walls.indexOf(
                world.gateObject
            );

        if (
            index !== -1
        ) {
            world.walls.splice(
                index,
                1
            );
        }

        emitEvent(
            "gateUnlocked"
        );

        setTimeout(
            () => {
                winGame();
            },
            900
        );

        emitState();
    }

    function winGame() {
        if (
            state.gameWon ||
            state.playerCaught
        ) {
            return;
        }

        state.gameWon = true;
        state.running = false;

        emitEvent(
            "gameWon"
        );
    }

    /* =========================================================
       SEEKER AI
       ========================================================= */

    function updateSeeker(delta) {
        if (
            !state.seekerActive ||
            !world.seekerObject
        ) {
            return;
        }

        if (
            state.playerCaught ||
            state.gameWon
        ) {
            return;
        }

        state.seeker.attackCooldown =
            Math.max(
                0,
                state.seeker.attackCooldown -
                delta
            );

        const playerPosition =
            world.playerObject.position;

        const distance =
            distance2D(
                world.seekerObject.position,
                playerPosition
            );

        if (
            distance <= 2.15
        ) {
            catchPlayer();
            return;
        }

        const canSee =
            canSeekerSeePlayer(
                distance
            );

        const canHear =
            canSeekerHearPlayer(
                distance
            );

        if (
            canSee
        ) {
            state.seeker.state =
                "chasing";

            state.seeker.target =
                playerPosition.clone();

            state.seeker.lastKnownPlayerPosition =
                playerPosition.clone();

            state.seeker.investigationTimer =
                5;
        } else if (
            canHear
        ) {
            state.seeker.state =
                "investigating";

            state.seeker.target =
                playerPosition.clone();

            state.seeker.lastKnownPlayerPosition =
                playerPosition.clone();

            state.seeker.investigationTimer =
                7;
        } else {
            updateSeekerMemory(
                delta
            );
        }

        moveSeeker(
            delta
        );

        syncSeekerObject();

        updateSeekerCollider();
    }

    function canSeekerSeePlayer(
        distance
    ) {
        if (
            distance >
            GAME.SEEKER_DETECTION_DISTANCE
        ) {
            return false;
        }

        /*
         * A simple visibility check.
         * System can later replace this with
         * a raycast-based visibility system.
         */

        return distance <
            GAME.SEEKER_DETECTION_DISTANCE;
    }

    function canSeekerHearPlayer(
        distance
    ) {
        if (
            !state.player.moving
        ) {
            return false;
        }

        let range =
            GAME.SEEKER_HEARING_DISTANCE;

        if (
            state.player.running
        ) {
            range *= 1.55;
        }

        if (
            state.player.crouching
        ) {
            range *= 0.45;
        }

        return distance <= range;
    }

    function updateSeekerMemory(
        delta
    ) {
        if (
            state.seeker.state ===
            "investigating"
        ) {
            state.seeker.investigationTimer -=
                delta;

            if (
                state.seeker.investigationTimer <=
                0
            ) {
                state.seeker.state =
                    "patrolling";

                state.seeker.target =
                    null;
            }

            return;
        }

        if (
            state.seeker.state ===
            "chasing"
        ) {
            state.seeker.state =
                "investigating";

            state.seeker.target =
                state.seeker.lastKnownPlayerPosition
                    .clone();

            state.seeker.investigationTimer =
                6;

            return;
        }

        state.seeker.state =
            "patrolling";

        if (
            !state.seeker.target ||
            distance2D(
                state.seeker.position,
                state.seeker.target
            ) < 4
        ) {
            const waypoint =
                world.seekerWaypoints[
                    randomInt(
                        0,
                        world.seekerWaypoints.length - 1
                    )
                ];

            state.seeker.target =
                waypoint.clone();
        }
    }

    function moveSeeker(delta) {
        const seeker =
            state.seeker;

        if (
            !seeker.target
        ) {
            return;
        }

        let speed =
            GAME.SEEKER_SPEED;

        if (
            seeker.state ===
            "chasing"
        ) {
            speed =
                GAME.SEEKER_CHASE_SPEED;
        }

        const dx =
            seeker.target.x -
            seeker.position.x;

        const dz =
            seeker.target.z -
            seeker.position.z;

        const length =
            Math.sqrt(
                dx * dx +
                dz * dz
            );

        if (
            length < 0.5
        ) {
            return;
        }

        const dirX =
            dx / length;

        const dirZ =
            dz / length;

        seeker.rotationY =
            approachAngle(
                seeker.rotationY,
                Math.atan2(
                    dirX,
                    dirZ
                ),
                delta * 4
            );

        const next =
            seeker.position.clone();

        next.x +=
            dirX *
            speed *
            delta;

        next.z +=
            dirZ *
            speed *
            delta;

        seeker.position =
            resolveSeekerCollision(
                next
            );
    }

    function resolveSeekerCollision(
        position
    ) {
        const result =
            position.clone();

        const radius =
            1.0;

        for (const wall of world.walls) {
            if (
                !wall ||
                !wall.geometry
            ) {
                continue;
            }

            const box =
                new THREE.Box3()
                    .setFromObject(
                        wall
                    );

            const closest =
                new THREE.Vector3(
                    clamp(
                        result.x,
                        box.min.x,
                        box.max.x
                    ),
                    result.y,
                    clamp(
                        result.z,
                        box.min.z,
                        box.max.z
                    )
                );

            const dx =
                result.x -
                closest.x;

            const dz =
                result.z -
                closest.z;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );

            if (
                distance < radius
            ) {
                if (
                    distance > 0.001
                ) {
                    const push =
                        radius -
                        distance;

                    result.x +=
                        dx /
                        distance *
                        push;

                    result.z +=
                        dz /
                        distance *
                        push;
                }
            }
        }

        return result;
    }

    function syncSeekerObject() {
        if (
            !world.seekerObject
        ) {
            return;
        }

        world.seekerObject.position.copy(
            state.seeker.position
        );

        world.seekerObject.rotation.y =
            state.seeker.rotationY;
    }

    function updateSeekerCollider() {
        if (
            !world.seekerCollider
        ) {
            return;
        }

        world.seekerCollider.center.set(
            state.seeker.position.x,
            1.5,
            state.seeker.position.z
        );
    }

    function catchPlayer() {
        if (
            state.playerCaught ||
            state.gameWon
        ) {
            return;
        }

        state.playerCaught =
            true;

        state.running = false;

        emitEvent(
            "playerCaught"
        );
    }

    /* =========================================================
       CAMERA
       ========================================================= */

    function updateCamera(delta) {
        if (
            !world.camera ||
            !world.playerObject
        ) {
            return;
        }

        const targetY =
            state.player.crouching
                ? 1.2
                : GAME.PLAYER_HEIGHT;

        world.camera.position.x =
            world.playerObject.position.x;

        world.camera.position.z =
            world.playerObject.position.z;

        world.camera.position.y =
            lerp(
                world.camera.position.y,
                targetY,
                Math.min(
                    1,
                    delta * 10
                )
            );

        const forward =
            new THREE.Vector3(
                Math.sin(
                    state.player.rotationY
                ),
                0,
                Math.cos(
                    state.player.rotationY
                )
            );

        const target =
            world.camera.position
                .clone()
                .add(
                    forward.multiplyScalar(
                        10
                    )
                );

        target.y =
            world.camera.position.y;

        world.camera.lookAt(
            target
        );

        if (
            state.device === "mobile" &&
            input.cameraJoystick.active
        ) {
            state.player.rotationY -=
                input.cameraJoystick.x *
                delta *
                3;

            world.camera.lookAt(
                target
            );
        }
    }

    /* =========================================================
       MINIMAP
       ========================================================= */

    function updateMinimap() {
        state.minimap.playerX =
            state.player.position.x;

        state.minimap.playerZ =
            state.player.position.z;

        state.minimap.seekerX =
            state.seeker.position.x;

        state.minimap.seekerZ =
            state.seeker.position.z;

        state.minimap.playerRotation =
            state.player.rotationY;

        state.minimap.seekerRotation =
            state.seeker.rotationY;

        emitEvent(
            "minimapUpdate",
            state.minimap
        );
    }

    /* =========================================================
       EFFECTS
       ========================================================= */

    function updateEffects(delta) {
        /*
         * Keep this lightweight.
         * details.js can attach advanced particles,
         * fog, post-processing, and environment animation.
         */

        for (const effect of world.effects) {
            if (
                effect &&
                typeof effect.update ===
                "function"
            ) {
                effect.update(
                    delta,
                    state
                );
            }
        }

        if (
            state.seekerActive &&
            world.seekerObject
        ) {
            const distance =
                distance2D(
                    world.seekerObject.position,
                    world.playerObject.position
                );

            const danger =
                clamp(
                    1 -
                    distance /
                    70,
                    0,
                    1
                );

            world.seekerObject.scale.setScalar(
                1 +
                danger *
                0.035
            );
        }
    }

    /* =========================================================
       INTERACTION API
       ========================================================= */

    function interact() {
        if (
            state.playerCaught ||
            state.gameWon
        ) {
            return false;
        }

        const player =
            world.playerObject;

        if (
            !player
        ) {
            return false;
        }

        let nearest = null;
        let nearestDistance =
            Infinity;

        for (
            const object of
            world.interactables
        ) {
            if (
                !object ||
                !object.visible
            ) {
                continue;
            }

            if (
                object.userData &&
                object.userData.pressed
            ) {
                continue;
            }

            if (
                object.userData &&
                object.userData.collected
            ) {
                continue;
            }

            const distance =
                distance2D(
                    player.position,
                    object.position
                );

            if (
                distance <
                nearestDistance
            ) {
                nearestDistance =
                    distance;

                nearest =
                    object;
            }
        }

        if (
            !nearest ||
            nearestDistance >
            GAME.INTERACTION_DISTANCE
        ) {
            return false;
        }

        if (
            nearest.name ===
            "ExitKey"
        ) {
            collectKey();
            return true;
        }

        if (
            nearest.userData &&
            nearest.userData.id
        ) {
            pressButton(
                nearest.userData.id
            );

            return true;
        }

        return false;
    }

    /* =========================================================
       PLAYER ACTIONS
       ========================================================= */

    function setCrouching(value) {
        state.player.crouching =
            Boolean(value);
    }

    function setSprinting(value) {
        state.player.sprinting =
            Boolean(value);
    }

    function setDevice(device) {
        if (
            device !== "pc" &&
            device !== "mobile"
        ) {
            return;
        }

        state.device =
            device;

        emitEvent(
            "deviceChanged",
            {
                device
            }
        );
    }

    /* =========================================================
       MAP RESET
       ========================================================= */

    function resetGame(options = {}) {
        const map =
            options.map ||
            GAME.MAP_NAMES[0];

        state.currentMap =
            map;

        state.running = false;
        state.paused = false;

        state.elapsed = 0;

        state.setupRemaining =
            GAME.SETUP_TIME;

        state.seekerActive =
            false;

        state.buttonsFound =
            0;

        state.hasKey =
            false;

        state.gateUnlocked =
            false;

        state.playerCaught =
            false;

        state.gameWon =
            false;

        state.buttons = {
            button1: false,
            button2: false,
            button3: false
        };

        state.player.position.set(
            0,
            GAME.PLAYER_HEIGHT,
            35
        );

        state.player.velocity.set(
            0,
            0,
            0
        );

        state.player.rotationY =
            0;

        state.player.running =
            false;

        state.player.crouching =
            false;

        state.player.moving =
            false;

        state.player.sprinting =
            false;

        state.seeker.position.set(
            0,
            0,
            -110
        );

        state.seeker.velocity.set(
            0,
            0,
            0
        );

        state.seeker.rotationY =
            0;

        state.seeker.state =
            "sleeping";

        state.seeker.target =
            null;

        state.seeker.investigationTimer =
            0;

        state.seeker.attackCooldown =
            0;

        if (
            world.playerObject
        ) {
            world.playerObject.position.copy(
                state.player.position
            );

            world.playerObject.rotation.y =
                0;
        }

        if (
            world.seekerObject
        ) {
            world.seekerObject.position.copy(
                state.seeker.position
            );

            world.seekerObject.visible =
                false;
        }

        if (
            world.keyObject
        ) {
            world.keyObject.visible =
                false;
            world.keyObject.userData.collected =
                false;
        }

        for (const button of world.buttons) {
            button.userData.pressed =
                false;

            const indicator =
                button.userData.indicator;

            if (indicator) {
                indicator.material =
                    new THREE.MeshBasicMaterial({
                        color:
                            GAME.COLORS.RED
                    });
            }

            const buttonMesh =
                button.children[1];

            if (buttonMesh) {
                buttonMesh.position.y =
                    0.38;
            }
        }

        if (
            world.gateObject
        ) {
            world.gateObject.userData.unlocked =
                false;

            world.gateObject.userData.openAmount =
                0;

            world.gateObject.userData.bars
                .position.y = 0;

            if (
                !world.walls.includes(
                    world.gateObject
                )
            ) {
                world.walls.push(
                    world.gateObject
                );
            }
        }

        updatePlayerCollider();
        updateSeekerCollider();

        emitEvent(
            "gameReset",
            {
                map
            }
        );

        emitState();
    }

    /* =========================================================
       STATE / EVENTS
       ========================================================= */

    function getState() {
        return {
            initialized:
                state.initialized,

            running:
                state.running,

            paused:
                state.paused,

            device:
                state.device,

            elapsed:
                state.elapsed,

            setupRemaining:
                state.setupRemaining,

            seekerActive:
                state.seekerActive,

            buttonsFound:
                state.buttonsFound,

            requiredButtons:
                GAME.REQUIRED_BUTTONS,

            hasKey:
                state.hasKey,

            gateUnlocked:
                state.gateUnlocked,

            playerCaught:
                state.playerCaught,

            gameWon:
                state.gameWon,

            currentMap:
                state.currentMap,

            player: {
                x:
                    state.player.position.x,
                y:
                    state.player.position.y,
                z:
                    state.player.position.z,
                rotation:
                    state.player.rotationY,
                moving:
                    state.player.moving,
                running:
                    state.player.running,
                crouching:
                    state.player.crouching
            },

            seeker: {
                x:
                    state.seeker.position.x,
                z:
                    state.seeker.position.z,
                rotation:
                    state.seeker.rotationY,
                active:
                    state.seekerActive,
                state:
                    state.seeker.state
            },

            minimap:
                {
                    ...state.minimap
                }
        };
    }

    function emitState() {
        emitEvent(
            "state",
            getState()
        );
    }

    function emitEvent(
        name,
        detail = {}
    ) {
        if (
            typeof window.dispatchEvent !==
            "function"
        ) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                `seeker:${name}`,
                {
                    detail
                }
            )
        );
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    function exposeAPI() {
        window.TheSeeker =
            window.TheSeeker || {};

        Object.assign(
            window.TheSeeker,
            {
                GAME,
                state,
                world,

                initialize,
                start,
                stop,
                pause,
                resume,
                resetGame,

                update,
                render,

                interact,

                pressButton,
                collectKey,
                unlockGate,

                setCrouching,
                setSprinting,
                setDevice,

                activateSeeker,

                getState,

                getPlayerPosition() {
                    return state.player.position.clone();
                },

                getSeekerPosition() {
                    return state.seeker.position.clone();
                },

                getMinimapState() {
                    return {
                        ...state.minimap
                    };
                }
            }
        );
    }

    /* =========================================================
       AUTO INITIALIZATION
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            () => {
                /*
                 * main.js may initialize the game itself.
                 * Only create the game automatically when
                 * the page indicates that a game canvas is wanted.
                 */

                const shouldAutoInit =
                    document.body &&
                    (
                        document.body.dataset
                            .autoGame === "true" ||
                        document.querySelector(
                            "#gameRoot"
                        )
                    );

                if (
                    shouldAutoInit
                ) {
                    initialize();
                }
            }
        );
    } else {
        const shouldAutoInit =
            document.body &&
            (
                document.body.dataset
                    .autoGame === "true" ||
                document.querySelector(
                    "#gameRoot"
                )
            );

        if (
            shouldAutoInit
        ) {
            initialize();
        }
    }

})();