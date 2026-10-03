/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   game.js

   REAL 3D EXPLORATION SYSTEM
   ------------------------------------------------------------
   - Large explorable world
   - Multiple rooms
   - Open courtyard
   - Storage room
   - Control room
   - Generator room
   - Security room
   - Main hall
   - Side corridors
   - Free WASD movement
   - Mouse look
   - Sprint
   - Mobile touch controls
   - Collision system
   - Gravity
   - Stairs / raised areas
   - Doors
   - Props
   - Furniture
   - Lights
   - Seeker enemy
   - Button objectives
   - Key
   - Exit gate
   - Minimap
   - Flashlight integration
   - Details.js integration
   - System.js integration
============================================================ */

(() => {
    "use strict";

    /* ========================================================
       THREE CHECK
    ======================================================== */

    const THREE = window.THREE;

    if (!THREE) {
        console.error(
            "[THE SEEKER] THREE.js is missing."
        );
        return;
    }

    /* ========================================================
       GAME OBJECT
    ======================================================== */

    const Game = {

        scene: null,
        camera: null,
        renderer: null,

        world: null,
        architecture: null,
        props: null,
        lights: null,
        interactables: null,
        enemyGroup: null,

        player: null,
        playerBody: null,

        seeker: null,
        seekerBody: null,

        raycaster: new THREE.Raycaster(),

        clock: new THREE.Clock(),

        started: false,

        width: 140,
        depth: 110,

        playerHeight: 1.72,

        playerRadius: 0.38,

        gravity: 22,

        jumpVelocity: 7,

        moveSpeed: 4.2,

        sprintSpeed: 7.2,

        mouseSensitivity: 0.0022,

        velocity: new THREE.Vector3(),

        direction: new THREE.Vector3(),

        verticalVelocity: 0,

        grounded: true,

        yaw: 0,

        pitch: 0,

        keys: {},

        pointerLocked: false,

        mobile: false,

        mobileLookActive: false,

        mobileMoveActive: false,

        mobileMoveOrigin: {
            x: 0,
            y: 0
        },

        mobileMove: {
            x: 0,
            y: 0
        },

        doors: [],

        colliders: [],

        buttons: [],

        buttonMeshes: [],

        keyObject: null,

        gate: null,

        gateOpened: false,

        collectedButtons: 0,

        totalButtons: 3,

        gameOver: false,

        startTime: 0,

        seekerSpeed: 2.8,

        seekerAcceleration: 0.45,

        seekerAwake: false,

        seekerPosition: new THREE.Vector3(
            34,
            1.2,
            30
        ),

        seekerTarget: new THREE.Vector3(),

        lastStep: 0,

        stepTimer: 0,

        minimap: null,

        minimapCanvas: null,

        minimapContext: null,

        minimapPlayer: null,

        minimapSeeker: null,

        fogNear: 4,

        fogFar: 150,

        materials: {},

        geometry: {},

        audioStarted: false
    };

    /* ========================================================
       BASIC HELPERS
    ======================================================== */

    const clamp = (
        value,
        min,
        max
    ) => {
        return Math.max(
            min,
            Math.min(
                max,
                value
            )
        );
    };

    const random = (
        min,
        max
    ) => {
        return min +
            Math.random() *
            (max - min);
    };

    const randomInt = (
        min,
        max
    ) => {
        return Math.floor(
            random(
                min,
                max + 1
            )
        );
    };

    const distance2D = (
        a,
        b
    ) => {
        const dx =
            a.x - b.x;

        const dz =
            a.z - b.z;

        return Math.sqrt(
            dx * dx +
            dz * dz
        );
    };

    const makeMesh = (
        geometry,
        material,
        name = "Object"
    ) => {

        const object =
            new THREE.Mesh(
                geometry,
                material
            );

        object.name =
            name;

        object.castShadow = true;
        object.receiveShadow = true;

        return object;
    };

    /* ========================================================
       INITIALIZATION
    ======================================================== */

    Game.init = function() {

        Game.mobile =
            window.matchMedia(
                "(pointer: coarse)"
            ).matches ||
            window.innerWidth < 900;

        Game.createRenderer();

        Game.createScene();

        Game.createMaterials();

        Game.createWorld();

        Game.createPlayer();

        Game.createSeeker();

        Game.createObjectives();

        Game.createMinimap();

        Game.createControls();

        Game.connectSystems();

        Game.resize();

        window.addEventListener(
            "resize",
            () => Game.resize()
        );

        Game.hideLoading();

        console.log(
            "[THE SEEKER] 3D exploration world ready."
        );
    };

    /* ========================================================
       RENDERER
    ======================================================== */

    Game.createRenderer =
        function() {

            let canvas =
                document.getElementById(
                    "gameCanvas"
                );

            if (!canvas) {

                canvas =
                    document.createElement(
                        "canvas"
                    );

                canvas.id =
                    "gameCanvas";

                document.body.appendChild(
                    canvas
                );
            }

            Game.renderer =
                new THREE.WebGLRenderer({
                    canvas,
                    antialias: true,
                    powerPreference:
                        "high-performance"
                });

            Game.renderer.setPixelRatio(
                Math.min(
                    window.devicePixelRatio,
                    2
                )
            );

            Game.renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );

            Game.renderer.shadowMap.enabled =
                true;

            Game.renderer.shadowMap.type =
                THREE.PCFSoftShadowMap;

            Game.renderer.outputColorSpace =
                THREE.SRGBColorSpace;

            Game.renderer.toneMapping =
                THREE.ACESFilmicToneMapping;

            Game.renderer.toneMappingExposure =
                0.85;
        };

    /* ========================================================
       SCENE
    ======================================================== */

    Game.createScene =
        function() {

            Game.scene =
                new THREE.Scene();

            Game.scene.background =
                new THREE.Color(
                    0x080808
                );

            Game.scene.fog =
                new THREE.Fog(
                    0x080808,
                    Game.fogNear,
                    Game.fogFar
                );

            Game.camera =
                new THREE.PerspectiveCamera(
                    75,
                    window.innerWidth /
                    window.innerHeight,
                    0.05,
                    220
                );

            Game.camera.position.set(
                0,
                Game.playerHeight,
                0
            );

            Game.world =
                new THREE.Group();

            Game.world.name =
                "SEEKER_WORLD";

            Game.architecture =
                new THREE.Group();

            Game.architecture.name =
                "ARCHITECTURE";

            Game.props =
                new THREE.Group();

            Game.props.name =
                "PROPS";

            Game.lights =
                new THREE.Group();

            Game.lights.name =
                "LIGHTS";

            Game.interactables =
                new THREE.Group();

            Game.interactables.name =
                "INTERACTABLES";

            Game.enemyGroup =
                new THREE.Group();

            Game.enemyGroup.name =
                "ENEMIES";

            Game.world.add(
                Game.architecture
            );

            Game.world.add(
                Game.props
            );

            Game.world.add(
                Game.lights
            );

            Game.world.add(
                Game.interactables
            );

            Game.world.add(
                Game.enemyGroup
            );

            Game.scene.add(
                Game.world
            );
        };

    /* ========================================================
       MATERIALS
    ======================================================== */

    Game.createMaterials =
        function() {

            Game.materials.floor =
                new THREE.MeshStandardMaterial({
                    color: 0x242424,
                    roughness: 0.95
                });

            Game.materials.floorDark =
                new THREE.MeshStandardMaterial({
                    color: 0x151515,
                    roughness: 1
                });

            Game.materials.wall =
                new THREE.MeshStandardMaterial({
                    color: 0x303030,
                    roughness: 0.93
                });

            Game.materials.wallDark =
                new THREE.MeshStandardMaterial({
                    color: 0x191919,
                    roughness: 1
                });

            Game.materials.concrete =
                new THREE.MeshStandardMaterial({
                    color: 0x454545,
                    roughness: 0.98
                });

            Game.materials.metal =
                new THREE.MeshStandardMaterial({
                    color: 0x2d2d2d,
                    roughness: 0.6,
                    metalness: 0.7
                });

            Game.materials.metalDark =
                new THREE.MeshStandardMaterial({
                    color: 0x121212,
                    roughness: 0.5,
                    metalness: 0.6
                });

            Game.materials.wood =
                new THREE.MeshStandardMaterial({
                    color: 0x34251e,
                    roughness: 0.92
                });

            Game.materials.door =
                new THREE.MeshStandardMaterial({
                    color: 0x272727,
                    roughness: 0.82
                });

            Game.materials.glass =
                new THREE.MeshStandardMaterial({
                    color: 0x87969c,
                    roughness: 0.15,
                    metalness: 0.15,
                    transparent: true,
                    opacity: 0.42
                });

            Game.materials.warning =
                new THREE.MeshStandardMaterial({
                    color: 0xc9a227,
                    emissive: 0x3e2f00,
                    emissiveIntensity: 0.8
                });

            Game.materials.red =
                new THREE.MeshStandardMaterial({
                    color: 0x741f1f,
                    emissive: 0x250000,
                    emissiveIntensity: 0.6
                });

            Game.materials.green =
                new THREE.MeshStandardMaterial({
                    color: 0x476c4e,
                    emissive: 0x0d1e10,
                    emissiveIntensity: 0.4
                });

            Game.materials.white =
                new THREE.MeshStandardMaterial({
                    color: 0xd4d0c7,
                    roughness: 0.65
                });

            Game.materials.black =
                new THREE.MeshStandardMaterial({
                    color: 0x050505,
                    roughness: 1
                });

            Game.materials.seeker =
                new THREE.MeshStandardMaterial({
                    color: 0x080808,
                    roughness: 0.8
                });

            Game.materials.seekerEye =
                new THREE.MeshStandardMaterial({
                    color: 0xa00000,
                    emissive: 0x720000,
                    emissiveIntensity: 3
                });
        };

    /* ========================================================
       WORLD
    ======================================================== */

    Game.createWorld =
        function() {

            Game.createGround();

            Game.createOuterWalls();

            Game.createMainBuilding();

            Game.createCourtyard();

            Game.createStorageRoom();

            Game.createControlRoom();

            Game.createGeneratorRoom();

            Game.createSecurityRoom();

            Game.createSideBuilding();

            Game.createRoofStructures();

            Game.populateLargeProps();

            Game.populateSmallProps();

            Game.createExteriorDetails();

            Game.createRoomLighting();

            Game.createAtmosphere();

            if (
                window.SeekerDetails
            ) {

                try {

                    window.SeekerDetails
                        .init({
                            scene:
                                Game.scene,
                            camera:
                                Game.camera,
                            renderer:
                                Game.renderer,
                            player:
                                Game.player
                        });

                } catch (
                    error
                ) {

                    console.warn(
                        "[THE SEEKER] Details connection failed.",
                        error
                    );
                }
            }
        };

    /* ========================================================
       GROUND
    ======================================================== */

    Game.createGround =
        function() {

            const ground =
                makeMesh(
                    new THREE.BoxGeometry(
                        Game.width,
                        0.4,
                        Game.depth
                    ),
                    Game.materials.floor,
                    "WORLD_GROUND"
                );

            ground.position.y =
                -0.2;

            Game.architecture.add(
                ground
            );

            Game.addCollider(
                new THREE.Box3().setFromObject(
                    ground
                )
            );

            /* Floor grid sections */

            for (
                let x = -60;
                x <= 60;
                x += 10
            ) {

                const seam =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.025,
                            0.012,
                            Game.depth
                        ),
                        Game.materials.wallDark,
                        "FLOOR_SEAM"
                    );

                seam.position.set(
                    x,
                    0.01,
                    0
                );

                Game.architecture.add(
                    seam
                );
            }

            for (
                let z = -50;
                z <= 50;
                z += 10
            ) {

                const seam =
                    makeMesh(
                        new THREE.BoxGeometry(
                            Game.width,
                            0.012,
                            0.025
                        ),
                        Game.materials.wallDark,
                        "FLOOR_SEAM"
                    );

                seam.position.set(
                    0,
                    0.012,
                    z
                );

                Game.architecture.add(
                    seam
                );
            }
        };

    /* ========================================================
       WALL HELPER
    ======================================================== */

    Game.createWall =
        function(
            x,
            y,
            z,
            width,
            height,
            depth,
            options = {}
        ) {

            const material =
                options.material ||
                Game.materials.wall;

            const wall =
                makeMesh(
                    new THREE.BoxGeometry(
                        width,
                        height,
                        depth
                    ),
                    material,
                    options.name ||
                    "WALL"
                );

            wall.position.set(
                x,
                y + height / 2,
                z
            );

            Game.architecture.add(
                wall
            );

            if (
                options.collision !== false
            ) {

                Game.addCollider(
                    new THREE.Box3().setFromObject(
                        wall
                    )
                );
            }

            return wall;
        };

    /* ========================================================
       OUTER WALLS
    ======================================================== */

    Game.createOuterWalls =
        function() {

            const wallHeight = 8;

            Game.createWall(
                0,
                0,
                -Game.depth / 2,
                Game.width,
                wallHeight,
                0.7,
                {
                    name:
                        "OUTER_NORTH"
                }
            );

            Game.createWall(
                0,
                0,
                Game.depth / 2,
                Game.width,
                wallHeight,
                0.7,
                {
                    name:
                        "OUTER_SOUTH"
                }
            );

            Game.createWall(
                -Game.width / 2,
                0,
                0,
                0.7,
                wallHeight,
                Game.depth,
                {
                    name:
                        "OUTER_WEST"
                }
            );

            Game.createWall(
                Game.width / 2,
                0,
                0,
                0.7,
                wallHeight,
                Game.depth,
                {
                    name:
                        "OUTER_EAST"
                }
            );
        };

    /* ========================================================
       MAIN BUILDING
    ======================================================== */

    Game.createMainBuilding =
        function() {

            /*
             * Large central structure:
             *
             * +---------------------------+
             * | SECURITY | MAIN | CONTROL |
             * |----------+------+----------|
             * | STORAGE  | HALL | GENERATOR|
             * +---------------------------+
             */

            const floorY = 0;

            this.createRoomBox(
                -34,
                -23,
                28,
                24,
                7,
                "STORAGE_WING"
            );

            this.createRoomBox(
                0,
                -20,
                38,
                18,
                13,
                "MAIN_HALL"
            );

            this.createRoomBox(
                34,
                -22,
                28,
                24,
                7,
                "CONTROL_WING"
            );

            this.createRoomBox(
                0,
                22,
                38,
                18,
                14,
                "GENERATOR_WING"
            );

            /*
             * Horizontal connectors.
             */

            this.createWall(
                -17,
                floorY,
                -20,
                14,
                7,
                0.45
            );

            this.createWall(
                17,
                floorY,
                -20,
                14,
                7,
                0.45
            );

            /*
             * Doors between major sections.
             */

            this.createDoor(
                -17,
                0,
                -20,
                2.6,
                4.2,
                "storage-main"
            );

            this.createDoor(
                17,
                0,
                -20,
                2.6,
                4.2,
                "main-control"
            );

            this.createDoor(
                0,
                0,
                -2,
                3.0,
                4.5,
                "main-south"
            );

            this.createDoor(
                0,
                0,
                29,
                3.0,
                4.5,
                "main-generator"
            );

            /*
             * Central open area.
             */

            const centerFloor =
                makeMesh(
                    new THREE.BoxGeometry(
                        34,
                        0.15,
                        30
                    ),
                    Game.materials.floorDark,
                    "CENTRAL_OPEN_FLOOR"
                );

            centerFloor.position.set(
                0,
                0.02,
                -17
            );

            Game.architecture.add(
                centerFloor
            );

            /*
             * Structural beams.
             */

            for (
                let x = -15;
                x <= 15;
                x += 5
            ) {

                this.createBeam(
                    x,
                    6.8,
                    -17,
                    0.28,
                    0.28,
                    34
                );
            }

            /*
             * Main hall pillars.
             */

            for (
                let x = -14;
                x <= 14;
                x += 7
            ) {

                this.createPillar(
                    x,
                    -23,
                    6.2
                );
            }
        };

    /* ========================================================
       ROOM BOX
    ======================================================== */

    Game.createRoomBox =
        function(
            centerX,
            centerZ,
            width,
            depth,
            height,
            name
        ) {

            const halfW =
                width / 2;

            const halfD =
                depth / 2;

            /*
             * North wall.
             */

            this.createWall(
                centerX,
                0,
                centerZ - halfD,
                width,
                height,
                0.5,
                {
                    name:
                        `${name}_NORTH`
                }
            );

            /*
             * South wall.
             */

            this.createWall(
                centerX,
                0,
                centerZ + halfD,
                width,
                height,
                0.5,
                {
                    name:
                        `${name}_SOUTH`
                }
            );

            /*
             * West wall.
             */

            this.createWall(
                centerX - halfW,
                0,
                centerZ,
                0.5,
                height,
                depth,
                {
                    name:
                        `${name}_WEST`
                }
            );

            /*
             * East wall.
             */

            this.createWall(
                centerX + halfW,
                0,
                centerZ,
                0.5,
                height,
                depth,
                {
                    name:
                        `${name}_EAST`
                }
            );

            /*
             * Floor.
             */

            const floor =
                makeMesh(
                    new THREE.BoxGeometry(
                        width - 0.4,
                        0.14,
                        depth - 0.4
                    ),
                    Game.materials.floor,
                    `${name}_FLOOR`
                );

            floor.position.set(
                centerX,
                0.02,
                centerZ
            );

            Game.architecture.add(
                floor
            );

            /*
             * Ceiling.
             */

            const ceiling =
                makeMesh(
                    new THREE.BoxGeometry(
                        width,
                        0.25,
                        depth
                    ),
                    Game.materials.wallDark,
                    `${name}_CEILING`
                );

            ceiling.position.set(
                centerX,
                height,
                centerZ
            );

            Game.architecture.add(
                ceiling
            );

            /*
             * Ceiling beams.
             */

            for (
                let x =
                    centerX -
                    halfW +
                    3;
                x <=
                    centerX +
                    halfW -
                    3;
                x += 4
            ) {

                this.createBeam(
                    x,
                    height - 0.22,
                    centerZ,
                    0.22,
                    0.22,
                    depth - 2
                );
            }

            /*
             * Warning stripes around the room.
             */

            this.createRoomStripe(
                centerX,
                centerZ -
                halfD +
                0.34,
                width - 1
            );

            this.createRoomStripe(
                centerX,
                centerZ +
                halfD -
                0.34,
                width - 1
            );
        };

    /* ========================================================
       BEAM
    ======================================================== */

    Game.createBeam =
        function(
            x,
            y,
            z,
            thickness,
            height,
            length
        ) {

            const beam =
                makeMesh(
                    new THREE.BoxGeometry(
                        length,
                        height,
                        thickness
                    ),
                    Game.materials.metalDark,
                    "STRUCTURAL_BEAM"
                );

            beam.position.set(
                x,
                y,
                z
            );

            Game.architecture.add(
                beam
            );

            return beam;
        };

    /* ========================================================
       PILLAR
    ======================================================== */

    Game.createPillar =
        function(
            x,
            z,
            height = 6
        ) {

            const pillar =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.65,
                        height,
                        0.65
                    ),
                    Game.materials.concrete,
                    "STRUCTURAL_PILLAR"
                );

            pillar.position.set(
                x,
                height / 2,
                z
            );

            Game.architecture.add(
                pillar
            );

            Game.addCollider(
                new THREE.Box3().setFromObject(
                    pillar
                )
            );

            const ring =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.82,
                        0.12,
                        0.82
                    ),
                    Game.materials.metal,
                    "PILLAR_RING"
                );

            ring.position.set(
                x,
                1,
                z
            );

            Game.architecture.add(
                ring
            );

            return pillar;
        };

    /* ========================================================
       ROOM STRIPE
    ======================================================== */

    Game.createRoomStripe =
        function(
            x,
            z,
            width
        ) {

            const stripe =
                makeMesh(
                    new THREE.BoxGeometry(
                        width,
                        0.08,
                        0.18
                    ),
                    Game.materials.warning,
                    "WARNING_STRIPE"
                );

            stripe.position.set(
                x,
                0.075,
                z
            );

            Game.architecture.add(
                stripe
            );

            return stripe;
        };

    /* ========================================================
       DOOR
    ======================================================== */

    Game.createDoor =
        function(
            x,
            y,
            z,
            width,
            height,
            id
        ) {

            const group =
                new THREE.Group();

            group.name =
                `DOOR_${id}`;

            const body =
                makeMesh(
                    new THREE.BoxGeometry(
                        width,
                        height,
                        0.22
                    ),
                    Game.materials.door,
                    "DOOR_BODY"
                );

            body.position.y =
                height / 2;

            group.add(
                body
            );

            const frameLeft =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.16,
                        height + 0.2,
                        0.38
                    ),
                    Game.materials.metal,
                    "DOOR_FRAME"
                );

            frameLeft.position.set(
                -width / 2 -
                0.08,
                height / 2,
                0
            );

            group.add(
                frameLeft
            );

            const frameRight =
                frameLeft.clone();

            frameRight.position.x =
                width / 2 +
                0.08;

            group.add(
                frameRight
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        width + 0.32,
                        0.16,
                        0.38
                    ),
                    Game.materials.metal,
                    "DOOR_FRAME_TOP"
                );

            top.position.y =
                height;

            group.add(
                top
            );

            const handle =
                makeMesh(
                    new THREE.CylinderGeometry(
                        0.045,
                        0.045,
                        0.26,
                        12
                    ),
                    Game.materials.warning,
                    "DOOR_HANDLE"
                );

            handle.rotation.z =
                Math.PI / 2;

            handle.position.set(
                width * 0.25,
                height * 0.48,
                -0.18
            );

            group.add(
                handle
            );

            group.position.set(
                x,
                y,
                z
            );

            Game.architecture.add(
                group
            );

            const collider =
                new THREE.Box3().setFromObject(
                    group
                );

            Game.colliders.push(
                collider
            );

            Game.doors.push({
                id,
                group,
                collider,
                open: false,
                width,
                height,
                closedZ: z,
                closedX: x
            });

            return group;
        };

    /* ========================================================
       STORAGE ROOM
    ======================================================== */

    Game.createStorageRoom =
        function() {

            const x =
                -34;

            const z =
                -23;

            /*
             * Shelves.
             */

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createShelf(
                    x + i * 6,
                    0,
                    z - 5,
                    4.5
                );
            }

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createShelf(
                    x + i * 6,
                    0,
                    z + 5,
                    4.5
                );
            }

            /*
             * Boxes.
             */

            for (
                let i = 0;
                i < 14;
                i++
            ) {

                this.createBox(
                    x +
                    random(
                        -9,
                        9
                    ),
                    random(
                        0.3,
                        1.5
                    ),
                    z +
                    random(
                        -7,
                        7
                    ),
                    random(
                        0.45,
                        1.2
                    )
                );
            }

            /*
             * Workbench.
             */

            this.createWorkbench(
                x,
                1.2,
                z
            );

            /*
             * Storage light.
             */

            this.createCeilingLight(
                x,
                6,
                z
            );
        };

    /* ========================================================
       CONTROL ROOM
    ======================================================== */

    Game.createControlRoom =
        function() {

            const x =
                34;

            const z =
                -22;

            /*
             * Control desks.
             */

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createDesk(
                    x,
                    z + i * 5,
                    4
                );
            }

            /*
             * Screens.
             */

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createMonitor(
                    x + 5.2,
                    2.2,
                    z + i * 5
                );
            }

            /*
             * Main console.
             */

            this.createConsole(
                x - 4,
                1,
                z
            );

            /*
             * Control room light.
             */

            this.createCeilingLight(
                x,
                6,
                z,
                0xcfcab9,
                1.8
            );
        };

    /* ========================================================
       GENERATOR ROOM
    ======================================================== */

    Game.createGeneratorRoom =
        function() {

            const x =
                0;

            const z =
                22;

            /*
             * Main generators.
             */

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createGenerator(
                    x + i * 5,
                    z
                );
            }

            /*
             * Thick cables.
             */

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                this.createCable(
                    x + i * 2.2,
                    5.3,
                    z + 5,
                    x + i * 2.2,
                    1.5,
                    z
                );
            }

            /*
             * Generator control panel.
             */

            this.createConsole(
                x,
                1,
                z - 5
            );

            this.createCeilingLight(
                x,
                6,
                z,
                0xffc86b,
                1.7
            );
        };

    /* ========================================================
       SECURITY ROOM
    ======================================================== */

    Game.createSecurityRoom =
        function() {

            const x =
                0;

            const z =
                -38;

            /*
             * Reception desk.
             */

            this.createDesk(
                x,
                z,
                7
            );

            /*
             * Camera monitors.
             */

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                this.createMonitor(
                    x + i * 2.5,
                    2.6,
                    z - 3
                );
            }

            /*
             * Filing cabinets.
             */

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                this.createCabinet(
                    x + i * 4,
                    0,
                    z + 4
                );
            }

            this.createCeilingLight(
                x,
                6,
                z,
                0xc2d2d6,
                1.5
            );
        };

    /* ========================================================
       SIDE BUILDING
    ======================================================== */

    Game.createSideBuilding =
        function() {

            const x =
                -48;

            const z =
                25;

            const width =
                18;

            const depth =
                22;

            const height =
                7;

            this.createRoomBox(
                x,
                z,
                width,
                depth,
                height,
                "SIDE_BUILDING"
            );

            this.createDesk(
                x,
                0,
                z,
                5
            );

            this.createShelf(
                x - 5,
                0,
                z,
                3
            );

            this.createBox(
                x + 5,
                0.7,
                z + 5,
                1.2
            );

            this.createCeilingLight(
                x,
                5.8,
                z
            );
        };

    /* ========================================================
       COURTYARD
    ======================================================== */

    Game.createCourtyard =
        function() {

            /*
             * The south-central section is open.
             */

            const courtyard =
                makeMesh(
                    new THREE.BoxGeometry(
                        44,
                        0.12,
                        22
                    ),
                    Game.materials.floorDark,
                    "COURTYARD"
                );

            courtyard.position.set(
                0,
                0.03,
                39
            );

            Game.architecture.add(
                courtyard
            );

            /*
             * Concrete blocks.
             */

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                const block =
                    makeMesh(
                        new THREE.BoxGeometry(
                            3,
                            1,
                            2
                        ),
                        Game.materials.concrete,
                        "COURTYARD_BLOCK"
                    );

                block.position.set(
                    i * 7,
                    0.5,
                    39
                );

                Game.props.add(
                    block
                );

                Game.addCollider(
                    new THREE.Box3()
                        .setFromObject(
                            block
                        )
                );
            }

            /*
             * Exterior lamp posts.
             */

            for (
                let x = -18;
                x <= 18;
                x += 9
            ) {

                this.createLampPost(
                    x,
                    39
                );
            }

            /*
             * Exit gate.
             */

            this.createExitGate(
                0,
                0,
                50
            );
        };

    /* ========================================================
       ROOF STRUCTURES
    ======================================================== */

    Game.createRoofStructures =
        function() {

            /*
             * Large rooftop vents visible from courtyard and
             * open areas.
             */

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                const vent =
                    makeMesh(
                        new THREE.BoxGeometry(
                            2.5,
                            1.8,
                            2.5
                        ),
                        Game.materials.metalDark,
                        "ROOFTOP_VENT"
                    );

                vent.position.set(
                    i * 7,
                    6.8,
                    -5
                );

                Game.props.add(
                    vent
                );

                const cap =
                    makeMesh(
                        new THREE.BoxGeometry(
                            2.8,
                            0.18,
                            2.8
                        ),
                        Game.materials.metal,
                        "ROOFTOP_VENT_CAP"
                    );

                cap.position.set(
                    i * 7,
                    7.75,
                    -5
                );

                Game.props.add(
                    cap
                );
            }
        };

    /* ========================================================
       SHELF
    ======================================================== */

    Game.createShelf =
        function(
            x,
            y,
            z,
            width
        ) {

            const shelf =
                new THREE.Group();

            shelf.position.set(
                x,
                y,
                z
            );

            const boards = 4;

            for (
                let i = 0;
                i < boards;
                i++
            ) {

                const board =
                    makeMesh(
                        new THREE.BoxGeometry(
                            width,
                            0.16,
                            0.85
                        ),
                        Game.materials.wood,
                        "SHELF_BOARD"
                    );

                board.position.y =
                    i * 1.35 +
                    0.6;

                shelf.add(
                    board
                );
            }

            for (
                const px of [
                    -width / 2 +
                    0.1,
                    width / 2 -
                    0.1
                ]
            ) {

                const post =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.13,
                            5.2,
                            0.13
                        ),
                        Game.materials.metal,
                        "SHELF_POST"
                    );

                post.position.set(
                    px,
                    2.7,
                    0
                );

                shelf.add(
                    post
                );
            }

            /*
             * Items.
             */

            for (
                let level = 0;
                level < boards;
                level++
            ) {

                for (
                    let item = 0;
                    item < randomInt(2, 5);
                    item++
                ) {

                    const box =
                        makeMesh(
                            new THREE.BoxGeometry(
                                random(
                                    0.25,
                                    0.55
                                ),
                                random(
                                    0.22,
                                    0.5
                                ),
                                random(
                                    0.2,
                                    0.45
                                )
                            ),
                            Math.random() >
                            0.5
                                ? Game.materials.metal
                                : Game.materials.wood,
                            "SHELF_ITEM"
                        );

                    box.position.set(
                        random(
                            -width *
                            0.35,
                            width *
                            0.35
                        ),
                        0.8 +
                        level * 1.35,
                        random(
                            -0.22,
                            0.22
                        )
                    );

                    box.rotation.y =
                        random(
                            -0.4,
                            0.4
                        );

                    shelf.add(
                        box
                    );
                }
            }

            Game.props.add(
                shelf
            );

            return shelf;
        };

    /* ========================================================
       BOX
    ======================================================== */

    Game.createBox =
        function(
            x,
            y,
            z,
            size
        ) {

            const box =
                makeMesh(
                    new THREE.BoxGeometry(
                        size,
                        size,
                        size
                    ),
                    Math.random() > 0.5
                        ? Game.materials.wood
                        : Game.materials.concrete,
                    "CRATE"
                );

            box.position.set(
                x,
                y,
                z
            );

            box.rotation.y =
                random(
                    -0.8,
                    0.8
                );

            Game.props.add(
                box
            );

            Game.addCollider(
                new THREE.Box3()
                    .setFromObject(
                        box
                    )
            );

            return box;
        };

    /* ========================================================
       WORKBENCH
    ======================================================== */

    Game.createWorkbench =
        function(
            x,
            y,
            z
        ) {

            const group =
                new THREE.Group();

            group.position.set(
                x,
                y,
                z
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        3.5,
                        0.16,
                        1.1
                    ),
                    Game.materials.wood,
                    "WORKBENCH_TOP"
                );

            top.position.y =
                1.1;

            group.add(
                top
            );

            for (
                const px of [
                    -1.5,
                    1.5
                ]
            ) {

                const leg =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.15,
                            1.1,
                            0.15
                        ),
                        Game.materials.metal,
                        "WORKBENCH_LEG"
                    );

                leg.position.set(
                    px,
                    0.55,
                    0
                );

                group.add(
                    leg
                );
            }

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                const tool =
                    makeMesh(
                        new THREE.BoxGeometry(
                            random(
                                0.1,
                                0.3
                            ),
                            random(
                                0.06,
                                0.12
                            ),
                            random(
                                0.08,
                                0.18
                            )
                        ),
                        Game.materials.metal,
                        "WORKBENCH_TOOL"
                    );

                tool.position.set(
                    random(
                        -1.35,
                        1.35
                    ),
                    1.22,
                    random(
                        -0.35,
                        0.35
                    )
                );

                group.add(
                    tool
                );
            }

            Game.props.add(
                group
            );

            return group;
        };

    /* ========================================================
       DESK
    ======================================================== */

    Game.createDesk =
        function(
            x,
            z,
            width = 4
        ) {

            const desk =
                new THREE.Group();

            desk.position.set(
                x,
                0,
                z
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        width,
                        0.16,
                        1.25
                    ),
                    Game.materials.wood,
                    "DESK_TOP"
                );

            top.position.y =
                1.1;

            desk.add(
                top
            );

            for (
                const px of [
                    -width / 2 + 0.15,
                    width / 2 - 0.15
                ]
            ) {

                for (
                    const pz of [
                        -0.45,
                        0.45
                    ]
                ) {

                    const leg =
                        makeMesh(
                            new THREE.BoxGeometry(
                                0.14,
                                1.1,
                                0.14
                            ),
                            Game.materials.metal,
                            "DESK_LEG"
                        );

                    leg.position.set(
                        px,
                        0.55,
                        pz
                    );

                    desk.add(
                        leg
                    );
                }
            }

            const monitor =
                this.createMonitor(
                    0,
                    1.9,
                    0
                );

            desk.add(
                monitor.clone()
            );

            Game.props.add(
                desk
            );

            return desk;
        };

    /* ========================================================
       MONITOR
    ======================================================== */

    Game.createMonitor =
        function(
            x,
            y,
            z
        ) {

            const group =
                new THREE.Group();

            group.position.set(
                x,
                y,
                z
            );

            const screen =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.9,
                        0.56,
                        0.1
                    ),
                    Game.materials.black,
                    "MONITOR"
                );

            group.add(
                screen
            );

            const glow =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.75,
                        0.42,
                        0.012
                    ),
                    new THREE.MeshBasicMaterial({
                        color:
                            0x8a9f91,
                        transparent:
                            true,
                        opacity:
                            0.65
                    }),
                    "MONITOR_SCREEN"
                );

            glow.position.z =
                -0.055;

            group.add(
                glow
            );

            const stand =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.12,
                        0.38,
                        0.12
                    ),
                    Game.materials.metal,
                    "MONITOR_STAND"
                );

            stand.position.y =
                -0.36;

            group.add(
                stand
            );

            const base =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.35,
                        0.06,
                        0.25
                    ),
                    Game.materials.metal,
                    "MONITOR_BASE"
                );

            base.position.y =
                -0.55;

            group.add(
                base
            );

            Game.props.add(
                group
            );

            return group;
        };

    /* ========================================================
       CONSOLE
    ======================================================== */

    Game.createConsole =
        function(
            x,
            y,
            z
        ) {

            const consoleGroup =
                new THREE.Group();

            consoleGroup.position.set(
                x,
                y,
                z
            );

            const body =
                makeMesh(
                    new THREE.BoxGeometry(
                        3,
                        1.25,
                        1
                    ),
                    Game.materials.metalDark,
                    "CONTROL_CONSOLE"
                );

            body.position.y =
                0.65;

            consoleGroup.add(
                body
            );

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                const button =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.22,
                            0.08,
                            0.16
                        ),
                        i %
                        2 ===
                        0
                            ? Game.materials.warning
                            : Game.materials.red,
                        "CONSOLE_BUTTON"
                    );

                button.position.set(
                    -0.8 +
                    i * 0.4,
                    1.3,
                    -0.28
                );

                consoleGroup.add(
                    button
                );
            }

            Game.props.add(
                consoleGroup
            );

            return consoleGroup;
        };

    /* ========================================================
       CABINET
    ======================================================== */

    Game.createCabinet =
        function(
            x,
            y,
            z
        ) {

            const cabinet =
                makeMesh(
                    new THREE.BoxGeometry(
                        1.1,
                        2.3,
                        0.65
                    ),
                    Game.materials.metal,
                    "FILING_CABINET"
                );

            cabinet.position.set(
                x,
                y + 1.15,
                z
            );

            Game.props.add(
                cabinet
            );

            Game.addCollider(
                new THREE.Box3()
                    .setFromObject(
                        cabinet
                    )
            );

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                const handle =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.3,
                            0.04,
                            0.05
                        ),
                        Game.materials.warning,
                        "CABINET_HANDLE"
                    );

                handle.position.set(
                    x,
                    0.7 +
                    i * 0.7,
                    z -
                    0.36
                );

                Game.props.add(
                    handle
                );
            }

            return cabinet;
        };

    /* ========================================================
       GENERATOR
    ======================================================== */

    Game.createGenerator =
        function(
            x,
            z
        ) {

            const generator =
                new THREE.Group();

            generator.position.set(
                x,
                0,
                z
            );

            const body =
                makeMesh(
                    new THREE.BoxGeometry(
                        3.4,
                        2.4,
                        2
                    ),
                    Game.materials.metal,
                    "GENERATOR_BODY"
                );

            body.position.y =
                1.2;

            generator.add(
                body
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        2.5,
                        0.2,
                        1.3
                    ),
                    Game.materials.metalDark,
                    "GENERATOR_TOP"
                );

            top.position.y =
                2.45;

            generator.add(
                top
            );

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                const vent =
                    makeMesh(
                        new THREE.BoxGeometry(
                            1.4,
                            0.06,
                            0.06
                        ),
                        Game.materials.black,
                        "GENERATOR_VENT"
                    );

                vent.position.set(
                    0,
                    0.55 +
                    i * 0.23,
                    -1.03
                );

                generator.add(
                    vent
                );
            }

            const warning =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.7,
                        0.45,
                        0.04
                    ),
                    Game.materials.warning,
                    "GENERATOR_WARNING"
                );

            warning.position.set(
                0,
                1.55,
                -1.06
            );

            generator.add(
                warning
            );

            Game.props.add(
                generator
            );

            Game.addCollider(
                new THREE.Box3()
                    .setFromObject(
                        body
                    )
            );

            return generator;
        };

    /* ========================================================
       CABLE
    ======================================================== */

    Game.createCable =
        function(
            x1,
            y1,
            z1,
            x2,
            y2,
            z2
        ) {

            const start =
                new THREE.Vector3(
                    x1,
                    y1,
                    z1
                );

            const end =
                new THREE.Vector3(
                    x2,
                    y2,
                    z2
                );

            const middle =
                new THREE.Vector3(
                    (
                        x1 +
                        x2
                    ) / 2,
                    Math.min(
                        y1,
                        y2
                    ) - 0.7,
                    (
                        z1 +
                        z2
                    ) / 2
                );

            const curve =
                new THREE.QuadraticBezierCurve3(
                    start,
                    middle,
                    end
                );

            const cable =
                makeMesh(
                    new THREE.TubeGeometry(
                        curve,
                        16,
                        0.045,
                        6,
                        false
                    ),
                    Game.materials.black,
                    "CABLE"
                );

            Game.props.add(
                cable
            );

            return cable;
        };

    /* ========================================================
       LAMP POST
    ======================================================== */

    Game.createLampPost =
        function(
            x,
            z
        ) {

            const post =
                makeMesh(
                    new THREE.CylinderGeometry(
                        0.09,
                        0.12,
                        3.5,
                        8
                    ),
                    Game.materials.metal,
                    "LAMP_POST"
                );

            post.position.set(
                x,
                1.75,
                z
            );

            Game.props.add(
                post
            );

            const bulb =
                makeMesh(
                    new THREE.SphereGeometry(
                        0.16,
                        10,
                        10
                    ),
                    new THREE.MeshStandardMaterial({
                        color:
                            0xdedbd1,
                        emissive:
                            0xdedbd1,
                        emissiveIntensity:
                            2
                    }),
                    "LAMP_BULB"
                );

            bulb.position.set(
                x,
                3.65,
                z
            );

            Game.lights.add(
                bulb
            );

            const light =
                new THREE.PointLight(
                    0xdedbd1,
                    1.4,
                    10
                );

            light.position.copy(
                bulb.position
            );

            light.castShadow =
                true;

            Game.lights.add(
                light
            );

            return post;
        };

    /* ========================================================
       CEILING LIGHT
    ======================================================== */

    Game.createCeilingLight =
        function(
            x,
            y,
            z,
            color =
                0xc8c4b8,
            intensity =
                1.25
        ) {

            const housing =
                makeMesh(
                    new THREE.BoxGeometry(
                        1.2,
                        0.1,
                        0.32
                    ),
                    Game.materials.metalDark,
                    "CEILING_LIGHT"
                );

            housing.position.set(
                x,
                y,
                z
            );

            Game.lights.add(
                housing
            );

            const bulb =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.85,
                        0.04,
                        0.18
                    ),
                    new THREE.MeshStandardMaterial({
                        color,
                        emissive:
                            color,
                        emissiveIntensity:
                            2.5
                    }),
                    "LIGHT_BULB"
                );

            bulb.position.set(
                x,
                y - 0.08,
                z
            );

            Game.lights.add(
                bulb
            );

            const light =
                new THREE.PointLight(
                    color,
                    intensity,
                    13
                );

            light.position.set(
                x,
                y - 0.1,
                z
            );

            light.castShadow =
                true;

            light.shadow.mapSize.width =
                512;

            light.shadow.mapSize.height =
                512;

            Game.lights.add(
                light
            );

            return light;
        };

    /* ========================================================
       ROOM LIGHTING
    ======================================================== */

    Game.createRoomLighting =
        function() {

            const rooms = [

                [
                    -34,
                    -23,
                    0xc8c2ad
                ],

                [
                    0,
                    -20,
                    0xd4d1c6
                ],

                [
                    34,
                    -22,
                    0xb9c8c4
                ],

                [
                    0,
                    22,
                    0xd0b37f
                ],

                [
                    0,
                    -38,
                    0xcdd6d8
                ]
            ];

            rooms.forEach(
                room => {

                    const [
                        x,
                        z,
                        color
                    ] =
                        room;

                    for (
                        let dx = -8;
                        dx <= 8;
                        dx += 8
                    ) {

                        for (
                            let dz = -4;
                            dz <= 4;
                            dz += 8
                        ) {

                            this.createCeilingLight(
                                x + dx,
                                6,
                                z + dz,
                                color,
                                random(
                                    0.7,
                                    1.5
                                )
                            );
                        }
                    }
                }
            );

            /*
             * Main central lighting.
             */

            for (
                let x = -12;
                x <= 12;
                x += 6
            ) {

                this.createCeilingLight(
                    x,
                    6.3,
                    -17,
                    0xc3c0b7,
                    1.1
                );
            }
        };

    /* ========================================================
       LARGE PROPS
    ======================================================== */

    Game.populateLargeProps =
        function() {

            /*
             * Pallets.
             */

            for (
                let i = 0;
                i < 8;
                i++
            ) {

                this.createPallet(
                    random(
                        -55,
                        55
                    ),
                    0,
                    random(
                        -48,
                        42
                    )
                );
            }

            /*
             * Barrels.
             */

            for (
                let i = 0;
                i < 20;
                i++
            ) {

                this.createBarrel(
                    random(
                        -55,
                        55
                    ),
                    0,
                    random(
                        -45,
                        45
                    )
                );
            }

            /*
             * Tables in unused areas.
             */

            this.createTable(
                -48,
                0,
                -3
            );

            this.createTable(
                48,
                0,
                5
            );

            /*
             * Carts.
             */

            this.createCart(
                -52,
                0,
                10
            );

            this.createCart(
                50,
                0,
                32
            );
        };

    /* ========================================================
       SMALL PROPS
    ======================================================== */

    Game.populateSmallProps =
        function() {

            for (
                let i = 0;
                i < 180;
                i++
            ) {

                const x =
                    random(
                        -60,
                        60
                    );

                const z =
                    random(
                        -48,
                        47
                    );

                const size =
                    random(
                        0.04,
                        0.18
                    );

                const debris =
                    makeMesh(
                        new THREE.BoxGeometry(
                            size,
                            size,
                            size
                        ),
                        Math.random() >
                        0.5
                            ? Game.materials.concrete
                            : Game.materials.metalDark,
                        "TINY_DEBRIS"
                    );

                debris.position.set(
                    x,
                    size / 2,
                    z
                );

                debris.rotation.set(
                    random(
                        0,
                        Math.PI
                    ),
                    random(
                        0,
                        Math.PI
                    ),
                    random(
                        0,
                        Math.PI
                    )
                );

                Game.props.add(
                    debris
                );
            }
        };

    /* ========================================================
       PALLET
    ======================================================== */

    Game.createPallet =
        function(
            x,
            y,
            z
        ) {

            const pallet =
                new THREE.Group();

            pallet.position.set(
                x,
                y,
                z
            );

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                const plank =
                    makeMesh(
                        new THREE.BoxGeometry(
                            2.1,
                            0.12,
                            0.3
                        ),
                        Game.materials.wood,
                        "PALLET_PLANK"
                    );

                plank.position.set(
                    0,
                    0.12,
                    -0.65 +
                    i * 0.32
                );

                pallet.add(
                    plank
                );
            }

            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                const support =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.2,
                            0.25,
                            1.8
                        ),
                        Game.materials.woodDark,
                        "PALLET_SUPPORT"
                    );

                support.position.set(
                    i * 0.8,
                    0.0,
                    0
                );

                pallet.add(
                    support
                );
            }

            Game.props.add(
                pallet
            );

            return pallet;
        };

    /* ========================================================
       BARREL
    ======================================================== */

    Game.createBarrel =
        function(
            x,
            y,
            z
        ) {

            const barrel =
                new THREE.Group();

            barrel.position.set(
                x,
                y,
                z
            );

            const body =
                makeMesh(
                    new THREE.CylinderGeometry(
                        0.42,
                        0.45,
                        1.25,
                        14
                    ),
                    Game.materials.metal,
                    "BARREL"
                );

            body.position.y =
                0.63;

            barrel.add(
                body
            );

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                const ring =
                    makeMesh(
                        new THREE.TorusGeometry(
                            0.45,
                            0.035,
                            6,
                            16
                        ),
                        Game.materials.metalDark,
                        "BARREL_RING"
                    );

                ring.rotation.x =
                    Math.PI / 2;

                ring.position.y =
                    0.22 +
                    i * 0.4;

                barrel.add(
                    ring
                );
            }

            Game.props.add(
                barrel
            );

            Game.addCollider(
                new THREE.Box3()
                    .setFromObject(
                        body
                    )
            );

            return barrel;
        };

    /* ========================================================
       TABLE
    ======================================================== */

    Game.createTable =
        function(
            x,
            y,
            z
        ) {

            const table =
                new THREE.Group();

            table.position.set(
                x,
                y,
                z
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        3.2,
                        0.14,
                        1.5
                    ),
                    Game.materials.wood,
                    "TABLE_TOP"
                );

            top.position.y =
                1.2;

            table.add(
                top
            );

            for (
                const px of [
                    -1.35,
                    1.35
                ]
            ) {

                for (
                    const pz of [
                        -0.55,
                        0.55
                    ]
                ) {

                    const leg =
                        makeMesh(
                            new THREE.BoxGeometry(
                                0.12,
                                1.2,
                                0.12
                            ),
                            Game.materials.metal,
                            "TABLE_LEG"
                        );

                    leg.position.set(
                        px,
                        0.6,
                        pz
                    );

                    table.add(
                        leg
                    );
                }
            }

            Game.props.add(
                table
            );

            return table;
        };

    /* ========================================================
       CART
    ======================================================== */

    Game.createCart =
        function(
            x,
            y,
            z
        ) {

            const cart =
                new THREE.Group();

            cart.position.set(
                x,
                y,
                z
            );

            const base =
                makeMesh(
                    new THREE.BoxGeometry(
                        1.8,
                        0.12,
                        1.0
                    ),
                    Game.materials.metal,
                    "CART_BASE"
                );

            base.position.y =
                0.55;

            cart.add(
                base
            );

            for (
                const px of [
                    -0.75,
                    0.75
                ]
            ) {

                const wheel =
                    makeMesh(
                        new THREE.CylinderGeometry(
                            0.16,
                            0.16,
                            0.08,
                            10
                        ),
                        Game.materials.black,
                        "CART_WHEEL"
                    );

                wheel.rotation.z =
                    Math.PI / 2;

                wheel.position.set(
                    px,
                    0.18,
                    0
                );

                cart.add(
                    wheel
                );
            }

            const handle =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.1,
                        0.8,
                        0.1
                    ),
                    Game.materials.metal,
                    "CART_HANDLE"
                );

            handle.position.set(
                0.7,
                0.95,
                0
            );

            cart.add(
                handle
            );

            Game.props.add(
                cart
            );

            return cart;
        };

    /* ========================================================
       EXTERIOR DETAILS
    ======================================================== */

    Game.createExteriorDetails =
        function() {

            /*
             * Poles.
             */

            for (
                let i = -5;
                i <= 5;
                i++
            ) {

                this.createPole(
                    i * 10,
                    47
                );
            }

            /*
             * Large concrete barriers.
             */

            for (
                let i = -4;
                i <= 4;
                i++
            ) {

                const barrier =
                    makeMesh(
                        new THREE.BoxGeometry(
                            3,
                            0.8,
                            0.75
                        ),
                        Game.materials.concrete,
                        "OUTSIDE_BARRIER"
                    );

                barrier.position.set(
                    i * 7,
                    0.4,
                    44
                );

                Game.props.add(
                    barrier
                );

                Game.addCollider(
                    new THREE.Box3()
                        .setFromObject(
                            barrier
                        )
                );
            }
        };

    /* ========================================================
       POLE
    ======================================================== */

    Game.createPole =
        function(
            x,
            z
        ) {

            const pole =
                makeMesh(
                    new THREE.CylinderGeometry(
                        0.06,
                        0.08,
                        4.5,
                        8
                    ),
                    Game.materials.metal,
                    "POLE"
                );

            pole.position.set(
                x,
                2.25,
                z
            );

            Game.props.add(
                pole
            );
        };

    /* ========================================================
       ATMOSPHERE
    ======================================================== */

    Game.createAtmosphere =
        function() {

            /*
             * Ambient light.
             */

            const ambient =
                new THREE.HemisphereLight(
                    0x62605a,
                    0x0b0b0b,
                    0.33
                );

            Game.lights.add(
                ambient
            );

            /*
             * Moon / exterior directional light.
             */

            const moon =
                new THREE.DirectionalLight(
                    0x777f8c,
                    0.45
                );

            moon.position.set(
                -30,
                40,
                20
            );

            moon.castShadow =
                true;

            moon.shadow.mapSize.width =
                1024;

            moon.shadow.mapSize.height =
                1024;

            Game.lights.add(
                moon
            );

            /*
             * Fog.
             */

            Game.scene.fog =
                new THREE.Fog(
                    0x070707,
                    6,
                    135
                );
        };

    /* ========================================================
       PLAYER
    ======================================================== */

    Game.createPlayer =
        function() {

            Game.player =
                new THREE.Object3D();

            Game.player.name =
                "PLAYER";

            Game.player.position.set(
                0,
                0,
                -8
            );

            Game.player.add(
                Game.camera
            );

            Game.camera.position.set(
                0,
                Game.playerHeight,
                0
            );

            Game.world.add(
                Game.player
            );

            Game.player.userData = {
                moving: false,
                speed: 0
            };

            Game.createPlayerShadow();

            /*
             * Tell other systems that the player is ready.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-ready",
                    {
                        detail: {
                            player:
                                Game.player,
                            camera:
                                Game.camera
                        }
                    }
                )
            );
        };

    /* ========================================================
       PLAYER SHADOW
    ======================================================== */

    Game.createPlayerShadow =
        function() {

            const shadow =
                makeMesh(
                    new THREE.CircleGeometry(
                        0.45,
                        24
                    ),
                    new THREE.MeshBasicMaterial({
                        color:
                            0x000000,
                        transparent:
                            true,
                        opacity:
                            0.3
                    }),
                    "PLAYER_SHADOW"
                );

            shadow.rotation.x =
                -Math.PI / 2;

            shadow.position.set(
                0,
                0.03,
                0
            );

            Game.player.add(
                shadow
            );
        };

    /* ========================================================
       SEEKER
    ======================================================== */

    Game.createSeeker =
        function() {

            Game.seeker =
                new THREE.Group();

            Game.seeker.name =
                "THE_SEEKER";

            Game.seeker.position.copy(
                Game.seekerPosition
            );

            const body =
                makeMesh(
                    new THREE.CapsuleGeometry(
                        0.55,
                        1.25,
                        8,
                        12
                    ),
                    Game.materials.seeker,
                    "SEEKER_BODY"
                );

            body.position.y =
                1.2;

            Game.seeker.add(
                body
            );

            const head =
                makeMesh(
                    new THREE.SphereGeometry(
                        0.58,
                        16,
                        16
                    ),
                    Game.materials.seeker,
                    "SEEKER_HEAD"
                );

            head.position.y =
                2.3;

            Game.seeker.add(
                head
            );

            /*
             * Eyes.
             */

            const leftEye =
                makeMesh(
                    new THREE.SphereGeometry(
                        0.055,
                        8,
                        8
                    ),
                    Game.materials.seekerEye,
                    "SEEKER_EYE"
                );

            leftEye.position.set(
                -0.18,
                2.34,
                -0.51
            );

            Game.seeker.add(
                leftEye
            );

            const rightEye =
                leftEye.clone();

            rightEye.position.x =
                0.18;

            Game.seeker.add(
                rightEye
            );

            /*
             * Long arms.
             */

            const leftArm =
                makeMesh(
                    new THREE.CapsuleGeometry(
                        0.12,
                        1.05,
                        6,
                        8
                    ),
                    Game.materials.seeker,
                    "SEEKER_ARM"
                );

            leftArm.position.set(
                -0.7,
                1.25,
                0
            );

            leftArm.rotation.z =
                -0.16;

            Game.seeker.add(
                leftArm
            );

            const rightArm =
                leftArm.clone();

            rightArm.position.x =
                0.7;

            rightArm.rotation.z =
                0.16;

            Game.seeker.add(
                rightArm
            );

            Game.enemyGroup.add(
                Game.seeker
            );

            Game.seekerBody =
                body;

            Game.seekerAwake =
                false;
        };

    /* ========================================================
       OBJECTIVES
    ======================================================== */

    Game.createObjectives =
        function() {

            const positions = [

                {
                    x: -49,
                    y: 0,
                    z: -19
                },

                {
                    x: 34,
                    y: 0,
                    z: -31
                },

                {
                    x: 0,
                    y: 0,
                    z: 26
                }
            ];

            positions.forEach(
                (
                    position,
                    index
                ) => {

                    Game.createButton(
                        position.x,
                        position.y,
                        position.z,
                        index
                    );
                }
            );

            Game.createKey(
                30,
                1,
                20
            );
        };

    /* ========================================================
       BUTTON
    ======================================================== */

    Game.createButton =
        function(
            x,
            y,
            z,
            index
        ) {

            const group =
                new THREE.Group();

            group.position.set(
                x,
                y,
                z
            );

            const plate =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.42,
                        0.08,
                        0.42
                    ),
                    Game.materials.metalDark,
                    `BUTTON_${index + 1}_PLATE`
                );

            plate.position.y =
                1.15;

            group.add(
                plate
            );

            const button =
                makeMesh(
                    new THREE.CylinderGeometry(
                        0.105,
                        0.105,
                        0.09,
                        16
                    ),
                    Game.materials.red,
                    `BUTTON_${index + 1}`
                );

            button.rotation.x =
                Math.PI / 2;

            button.position.set(
                0,
                1.22,
                -0.02
            );

            group.add(
                button
            );

            const glow =
                new THREE.PointLight(
                    0xb33030,
                    0.35,
                    2.5
                );

            glow.position.set(
                0,
                1.25,
                0
            );

            group.add(
                glow
            );

            group.userData = {
                id:
                    index + 1,
                pressed:
                    false
            };

            Game.interactables.add(
                group
            );

            Game.buttons.push(
                group
            );

            Game.buttonMeshes.push(
                button
            );

            return group;
        };

    /* ========================================================
       KEY
    ======================================================== */

    Game.createKey =
        function(
            x,
            y,
            z
        ) {

            const group =
                new THREE.Group();

            group.position.set(
                x,
                y,
                z
            );

            const ring =
                makeMesh(
                    new THREE.TorusGeometry(
                        0.14,
                        0.04,
                        8,
                        16
                    ),
                    Game.materials.warning,
                    "KEY_RING"
                );

            ring.rotation.x =
                Math.PI / 2;

            ring.position.y =
                1.2;

            group.add(
                ring
            );

            const shaft =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.42,
                        0.05,
                        0.07
                    ),
                    Game.materials.warning,
                    "KEY_SHAFT"
                );

            shaft.position.set(
                0.22,
                1.2,
                0
            );

            group.add(
                shaft
            );

            const teeth =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.05,
                        0.11,
                        0.08
                    ),
                    Game.materials.warning,
                    "KEY_TEETH"
                );

            teeth.position.set(
                0.4,
                1.14,
                0
            );

            group.add(
                teeth
            );

            group.userData = {
                collectible: true
            };

            Game.interactables.add(
                group
            );

            Game.keyObject =
                group;

            return group;
        };

    /* ========================================================
       EXIT GATE
    ======================================================== */

    Game.createExitGate =
        function(
            x,
            y,
            z
        ) {

            const gate =
                new THREE.Group();

            gate.position.set(
                x,
                y,
                z
            );

            const frameLeft =
                makeMesh(
                    new THREE.BoxGeometry(
                        0.5,
                        5.5,
                        0.5
                    ),
                    Game.materials.metal,
                    "GATE_LEFT"
                );

            frameLeft.position.set(
                -3,
                2.75,
                0
            );

            gate.add(
                frameLeft
            );

            const frameRight =
                frameLeft.clone();

            frameRight.position.x =
                3;

            gate.add(
                frameRight
            );

            const top =
                makeMesh(
                    new THREE.BoxGeometry(
                        6.5,
                        0.5,
                        0.5
                    ),
                    Game.materials.metal,
                    "GATE_TOP"
                );

            top.position.y =
                5.25;

            gate.add(
                top
            );

            for (
                let i = -2;
                i <= 2;
                i++
            ) {

                const bar =
                    makeMesh(
                        new THREE.BoxGeometry(
                            0.18,
                            4.5,
                            0.18
                        ),
                        Game.materials.metal,
                        "GATE_BAR"
                    );

                bar.position.set(
                    i * 1.05,
                    2.25,
                    0
                );

                gate.add(
                    bar
                );
            }

            Game.interactables.add(
                gate
            );

            Game.gate =
                gate;

            Game.addCollider(
                new THREE.Box3()
                    .setFromObject(
                        gate
                    )
            );

            return gate;
        };

    /* ========================================================
       COLLISION
    ======================================================== */

    Game.addCollider =
        function(
            box
        ) {

            Game.colliders.push(
                box
            );
        };

    Game.checkCollision =
        function(
            nextPosition
        ) {

            const playerBox =
                new THREE.Box3(
                    new THREE.Vector3(
                        nextPosition.x -
                        Game.playerRadius,
                        0.05,
                        nextPosition.z -
                        Game.playerRadius
                    ),
                    new THREE.Vector3(
                        nextPosition.x +
                        Game.playerRadius,
                        Game.playerHeight,
                        nextPosition.z +
                        Game.playerRadius
                    )
                );

            for (
                const collider
                of Game.colliders
            ) {

                if (
                    playerBox.intersectsBox(
                        collider
                    )
                ) {

                    return true;
                }
            }

            return false;
        };

    /* ========================================================
       PLAYER MOVEMENT
    ======================================================== */

    Game.updatePlayer =
        function(
            delta
        ) {

            if (
                Game.gameOver
            ) {
                return;
            }

            const forward =
                new THREE.Vector3(
                    0,
                    0,
                    -1
                );

            forward.applyAxisAngle(
                new THREE.Vector3(
                    0,
                    1,
                    0
                ),
                Game.yaw
            );

            const right =
                new THREE.Vector3(
                    1,
                    0,
                    0
                );

            right.applyAxisAngle(
                new THREE.Vector3(
                    0,
                    1,
                    0
                ),
                Game.yaw
            );

            const movement =
                new THREE.Vector3();

            if (
                Game.keys.KeyW ||
                Game.keys.ArrowUp
            ) {

                movement.add(
                    forward
                );
            }

            if (
                Game.keys.KeyS ||
                Game.keys.ArrowDown
            ) {

                movement.sub(
                    forward
                );
            }

            if (
                Game.keys.KeyD ||
                Game.keys.ArrowRight
            ) {

                movement.add(
                    right
                );
            }

            if (
                Game.keys.KeyA ||
                Game.keys.ArrowLeft
            ) {

                movement.sub(
                    right
                );
            }

            if (
                Game.mobile
            ) {

                movement.add(
                    right.clone()
                        .multiplyScalar(
                            Game.mobileMove.x
                        )
                );

                movement.add(
                    forward.clone()
                        .multiplyScalar(
                            Game.mobileMove.y
                        )
                );
            }

            let speed =
                Game.moveSpeed;

            const sprint =
                Game.keys.ShiftLeft ||
                Game.keys.ShiftRight;

            if (
                sprint
            ) {

                speed =
                    Game.sprintSpeed;
            }

            if (
                movement.lengthSq() >
                0
            ) {

                movement.normalize();

                const displacement =
                    movement.multiplyScalar(
                        speed *
                        delta
                    );

                const nextX =
                    Game.player.position.clone();

                nextX.x +=
                    displacement.x;

                if (
                    !Game.checkCollision(
                        nextX
                    )
                ) {

                    Game.player.position.x =
                        nextX.x;
                }

                const nextZ =
                    Game.player.position.clone();

                nextZ.z +=
                    displacement.z;

                if (
                    !Game.checkCollision(
                        nextZ
                    )
                ) {

                    Game.player.position.z =
                        nextZ.z;
                }

                Game.player.userData.moving =
                    true;

                Game.player.userData.speed =
                    speed;

                Game.handleFootsteps(
                    delta,
                    speed
                );

            } else {

                Game.player.userData.moving =
                    false;

                Game.player.userData.speed =
                    0;
            }

            /*
             * Gravity.
             */

            if (
                !Game.grounded
            ) {

                Game.verticalVelocity -=
                    Game.gravity *
                    delta;

                Game.camera.position.y +=
                    Game.verticalVelocity *
                    delta;

                if (
                    Game.camera.position.y <=
                    Game.playerHeight
                ) {

                    Game.camera.position.y =
                        Game.playerHeight;

                    Game.verticalVelocity =
                        0;

                    Game.grounded =
                        true;
                }
            }
        };

    /* ========================================================
       FOOTSTEPS
    ======================================================== */

    Game.handleFootsteps =
        function(
            delta,
            speed
        ) {

            Game.stepTimer -=
                delta;

            if (
                Game.stepTimer > 0
            ) {
                return;
            }

            Game.stepTimer =
                speed >
                Game.moveSpeed
                    ? 0.29
                    : 0.43;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:player-moving",
                    {
                        detail: {
                            moving:
                                true,
                            speed
                        }
                    }
                )
            );

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .playFootstep?.(
                        speed >
                        Game.moveSpeed
                            ? 1.15
                            : 0.85
                    );
            }
        };

    /* ========================================================
       LOOK
    ======================================================== */

    Game.look =
        function(
            movementX,
            movementY
        ) {

            Game.yaw -=
                movementX *
                Game.mouseSensitivity;

            Game.pitch -=
                movementY *
                Game.mouseSensitivity;

            const limit =
                Math.PI / 2 -
                0.04;

            Game.pitch =
                clamp(
                    Game.pitch,
                    -limit,
                    limit
                );

            Game.player.rotation.y =
                Game.yaw;

            Game.camera.rotation.x =
                Game.pitch;

            Game.camera.rotation.z =
                0;
        };

    /* ========================================================
       JUMP
    ======================================================== */

    Game.jump =
        function() {

            if (
                !Game.grounded
            ) {
                return;
            }

            Game.grounded =
                false;

            Game.verticalVelocity =
                Game.jumpVelocity;
        };

    /* ========================================================
       OBJECTIVE UPDATE
    ======================================================== */

    Game.updateObjectives =
        function() {

            /*
             * Buttons.
             */

            Game.buttons.forEach(
                button => {

                    if (
                        button.userData
                            .pressed
                    ) {

                        return;
                    }

                    button.rotation.y +=
                        0.003;
                }
            );

            /*
             * Key floating animation.
             */

            if (
                Game.keyObject
            ) {

                Game.keyObject.rotation.y +=
                    0.015;

                Game.keyObject.position.y =
                    Math.sin(
                        performance.now() *
                        0.003
                    ) *
                    0.08;
            }
        };

    /* ========================================================
       INTERACTION
    ======================================================== */

    Game.interact =
        function() {

            Game.raycaster.setFromCamera(
                new THREE.Vector2(
                    0,
                    0
                ),
                Game.camera
            );

            const targets = [];

            Game.buttons.forEach(
                button => {

                    if (
                        !button.userData
                            .pressed
                    ) {

                        targets.push(
                            ...button.children
                        );
                    }
                }
            );

            if (
                Game.keyObject
            ) {

                targets.push(
                    ...Game.keyObject
                        .children
                );
            }

            const hits =
                Game.raycaster
                    .intersectObjects(
                        targets,
                        true
                    );

            if (
                hits.length === 0
            ) {
                return;
            }

            const hit =
                hits[0]
                    .object;

            let parent =
                hit.parent;

            while (
                parent &&
                parent !==
                    Game.interactables
            ) {

                if (
                    Game.buttons.includes(
                        parent
                    )
                ) {

                    Game.pressButton(
                        parent
                    );

                    return;
                }

                if (
                    parent ===
                    Game.keyObject
                ) {

                    Game.collectKey();

                    return;
                }

                parent =
                    parent.parent;
            }
        };

    /* ========================================================
       PRESS BUTTON
    ======================================================== */

    Game.pressButton =
        function(
            button
        ) {

            if (
                button.userData.pressed
            ) {
                return;
            }

            button.userData.pressed =
                true;

            Game.collectedButtons++;

            button.children.forEach(
                child => {

                    if (
                        child.name.startsWith(
                            "BUTTON_"
                        )
                    ) {

                        child.position.z =
                            0.04;
                    }
                }
            );

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

            if (
                Game.collectedButtons >=
                Game.totalButtons
            ) {

                if (
                    window.SeekerSystem
                ) {

                    window.SeekerSystem
                        .buttonsFound =
                        Game.totalButtons;
                }

                Game.enableKey();
            }
        };

    /* ========================================================
       KEY
    ======================================================== */

    Game.enableKey =
        function() {

            if (
                Game.keyObject
            ) {

                Game.keyObject.visible =
                    true;
            }
        };

    Game.collectKey =
        function() {

            if (
                !Game.keyObject ||
                !Game.keyObject.visible
            ) {
                return;
            }

            const distance =
                Game.player.position
                    .distanceTo(
                        Game.keyObject
                            .position
                    );

            if (
                distance > 3.2
            ) {

                return;
            }

            Game.keyObject.visible =
                false;

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:key",
                    {}
                )
            );

            Game.showObjectiveMessage(
                "KEY ACQUIRED — FIND THE EXIT GATE"
            );
        };

    /* ========================================================
       GATE CHECK
    ======================================================== */

    Game.checkGate =
        function() {

            if (
                Game.gateOpened
            ) {
                return;
            }

            if (
                !Game.gate
            ) {
                return;
            }

            const distance =
                Game.player.position
                    .distanceTo(
                        Game.gate
                            .position
                    );

            if (
                distance > 4.5
            ) {
                return;
            }

            if (
                !Game.keyObject ||
                Game.keyObject.visible
            ) {
                return;
            }

            Game.openGate();
        };

    /* ========================================================
       OPEN GATE
    ======================================================== */

    Game.openGate =
        function() {

            Game.gateOpened =
                true;

            Game.gate.children.forEach(
                child => {

                    child.position.y +=
                        5;
                }
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:gate",
                    {}
                )
            );

            Game.showObjectiveMessage(
                "GATE OPEN — ESCAPE"
            );
        };

    /* ========================================================
       SEEKER WAKE-UP
    ======================================================== */

    Game.wakeSeeker =
        function() {

            if (
                Game.seekerAwake
            ) {
                return;
            }

            Game.seekerAwake =
                true;

            Game.showObjectiveMessage(
                "THE SEEKER IS HUNTING YOU"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:hunting-started",
                    {}
                )
            );
        };

    /* ========================================================
       SEEKER UPDATE
    ======================================================== */

    Game.updateSeeker =
        function(
            delta
        ) {

            if (
                !Game.seekerAwake ||
                Game.gameOver
            ) {
                return;
            }

            const direction =
                new THREE.Vector3()
                    .subVectors(
                        Game.player.position,
                        Game.seeker.position
                    );

            const distance =
                direction.length();

            if (
                distance >
                0.001
            ) {

                direction.normalize();

                Game.seekerSpeed =
                    Math.min(
                        5.8,
                        Game.seekerSpeed +
                        Game.seekerAcceleration *
                        delta
                    );

                const step =
                    Game.seekerSpeed *
                    delta;

                const next =
                    Game.seeker.position
                        .clone()
                        .add(
                            direction.multiplyScalar(
                                step
                            )
                        );

                /*
                 * Seeker uses simpler collision checking.
                 */

                if (
                    !Game.checkEnemyCollision(
                        next
                    )
                ) {

                    Game.seeker.position.copy(
                        next
                    );
                }

                Game.seeker.rotation.y =
                    Math.atan2(
                        direction.x,
                        direction.z
                    );
            }

            Game.updateThreat(
                distance
            );

            /*
             * Caught.
             */

            if (
                distance < 1.25
            ) {

                Game.playerCaught();
            }
        };

    /* ========================================================
       ENEMY COLLISION
    ======================================================== */

    Game.checkEnemyCollision =
        function(
            position
        ) {

            const testBox =
                new THREE.Box3(
                    new THREE.Vector3(
                        position.x -
                        0.42,
                        0,
                        position.z -
                        0.42
                    ),
                    new THREE.Vector3(
                        position.x +
                        0.42,
                        3,
                        position.z +
                        0.42
                    )
                );

            for (
                const collider
                of Game.colliders
            ) {

                if (
                    testBox.intersectsBox(
                        collider
                    )
                ) {

                    return true;
                }
            }

            return false;
        };

    /* ========================================================
       THREAT
    ======================================================== */

    Game.updateThreat =
        function(
            distance
        ) {

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
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .setSeekerDistance?.(
                        distance
                    );
            }

            /*
             * Seeker becomes visually stronger when close.
             */

            if (
                Game.seeker
            ) {

                const threat =
                    clamp(
                        1 -
                        (
                            distance -
                            2
                        ) /
                        25,
                        0,
                        1
                    );

                const scale =
                    1 +
                    threat *
                    0.08;

                Game.seeker.scale.set(
                    scale,
                    scale,
                    scale
                );
            }
        };

    /* ========================================================
       PLAYER CAUGHT
    ======================================================== */

    Game.playerCaught =
        function() {

            if (
                Game.gameOver
            ) {
                return;
            }

            Game.gameOver =
                true;

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .playerCaught(
                        "seeker"
                    );
            }

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
        };

    /* ========================================================
       ESCAPE
    ======================================================== */

    Game.checkEscape =
        function() {

            if (
                !Game.gateOpened ||
                Game.gameOver
            ) {
                return;
            }

            if (
                Game.player.position.z >
                46
            ) {

                Game.gameOver =
                    true;

                window.dispatchEvent(
                    new CustomEvent(
                        "seeker:player-escaped",
                        {}
                    )
                );

                if (
                    window.SeekerSystem
                ) {

                    window.SeekerSystem
                        .playerEscaped?.();
                }
            }
        };

    /* ========================================================
       LOADING
    ======================================================== */

    Game.hideLoading =
        function() {

            const loading =
                document.getElementById(
                    "gameLoading"
                );

            if (!loading) {
                return;
            }

            loading.style.opacity =
                "0";

            loading.style.pointerEvents =
                "none";

            setTimeout(
                () => {

                    loading.style.display =
                        "none";

                },
                450
            );
        };

    /* ========================================================
       OBJECTIVE MESSAGE
    ======================================================== */

    Game.showObjectiveMessage =
        function(
            text
        ) {

            let message =
                document.getElementById(
                    "gameObjectiveMessage"
                );

            if (!message) {

                message =
                    document.createElement(
                        "div"
                    );

                message.id =
                    "gameObjectiveMessage";

                Object.assign(
                    message.style,
                    {
                        position:
                            "fixed",
                        left:
                            "50%",
                        top:
                            "11%",
                        transform:
                            "translateX(-50%)",
                        padding:
                            "12px 20px",
                        background:
                            "rgba(5,5,5,.86)",
                        border:
                            "1px solid rgba(255,255,255,.14)",
                        color:
                            "#eee",
                        font:
                            "700 11px system-ui",
                        letterSpacing:
                            "2px",
                        zIndex:
                            "5000",
                        pointerEvents:
                            "none",
                        opacity:
                            "0",
                        transition:
                            "opacity .2s ease"
                    }
                );

                document.body.appendChild(
                    message
                );
            }

            message.textContent =
                text;

            message.style.opacity =
                "1";

            clearTimeout(
                Game.objectiveTimeout
            );

            Game.objectiveTimeout =
                setTimeout(
                    () => {

                        message.style.opacity =
                            "0";

                    },
                    2800
                );
        };

    /* ========================================================
       MINIMAP
    ======================================================== */

    Game.createMinimap =
        function() {

            const container =
                document.createElement(
                    "div"
                );

            container.id =
                "seekerMinimap";

            Object.assign(
                container.style,
                {
                    position:
                        "fixed",
                    top:
                        "18px",
                    left:
                        "18px",
                    width:
                        "170px",
                    height:
                        "170px",
                    border:
                        "1px solid rgba(255,255,255,.22)",
                    borderRadius:
                        "12px",
                    overflow:
                        "hidden",
                    background:
                        "rgba(5,5,5,.72)",
                    backdropFilter:
                        "blur(6px)",
                    zIndex:
                        "4000",
                    pointerEvents:
                        "none"
                }
            );

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                340;

            canvas.height =
                340;

            canvas.style.width =
                "170px";

            canvas.style.height =
                "170px";

            container.appendChild(
                canvas
            );

            const label =
                document.createElement(
                    "div"
                );

            label.textContent =
                "MAP";

            Object.assign(
                label.style,
                {
                    position:
                        "absolute",
                    top:
                        "7px",
                    left:
                        "8px",
                    font:
                        "800 8px system-ui",
                    letterSpacing:
                        "2px",
                    color:
                        "rgba(255,255,255,.5)"
                }
            );

            container.appendChild(
                label
            );

            document.body.appendChild(
                container
            );

            Game.minimap =
                container;

            Game.minimapCanvas =
                canvas;

            Game.minimapContext =
                canvas.getContext(
                    "2d"
                );
        };

    /* ========================================================
       DRAW MINIMAP
    ======================================================== */

    Game.drawMinimap =
        function() {

            if (
                !Game.minimapContext
            ) {
                return;
            }

            const ctx =
                Game.minimapContext;

            const w =
                Game.minimapCanvas
                    .width;

            const h =
                Game.minimapCanvas
                    .height;

            ctx.clearRect(
                0,
                0,
                w,
                h
            );

            /*
             * Map background.
             */

            ctx.fillStyle =
                "rgba(9,9,9,.92)";

            ctx.fillRect(
                0,
                0,
                w,
                h
            );

            const scale =
                2.1;

            const originX =
                w / 2;

            const originY =
                h / 2;

            /*
             * Outer boundary.
             */

            ctx.strokeStyle =
                "rgba(255,255,255,.17)";

            ctx.lineWidth =
                2;

            ctx.strokeRect(
                originX -
                Game.width *
                scale /
                2,
                originY -
                Game.depth *
                scale /
                2,
                Game.width *
                scale,
                Game.depth *
                scale
            );

            /*
             * Buildings as simple map shapes.
             */

            const rooms = [

                [-34, -23, 24, 20],

                [0, -20, 34, 26],

                [34, -22, 24, 20],

                [0, 22, 34, 22],

                [-48, 25, 18, 22]

            ];

            ctx.fillStyle =
                "rgba(185,185,175,.12)";

            ctx.strokeStyle =
                "rgba(220,220,210,.18)";

            rooms.forEach(
                room => {

                    const [
                        x,
                        z,
                        rw,
                        rz
                    ] = room;

                    const px =
                        originX +
                        x *
                        scale;

                    const pz =
                        originY +
                        z *
                        scale;

                    ctx.fillRect(
                        px -
                        rw *
                        scale /
                        2,
                        pz -
                        rz *
                        scale /
                        2,
                        rw *
                        scale,
                        rz *
                        scale
                    );

                    ctx.strokeRect(
                        px -
                        rw *
                        scale /
                        2,
                        pz -
                        rz *
                        scale /
                        2,
                        rw *
                        scale,
                        rz *
                        scale
                    );
                }
            );

            /*
             * Buttons.
             */

            Game.buttons.forEach(
                button => {

                    if (
                        button.userData
                            .pressed
                    ) {
                        return;
                    }

                    const px =
                        originX +
                        button.position.x *
                        scale;

                    const pz =
                        originY +
                        button.position.z *
                        scale;

                    ctx.fillStyle =
                        "#c9a227";

                    ctx.beginPath();

                    ctx.arc(
                        px,
                        pz,
                        5,
                        0,
                        Math.PI * 2
                    );

                    ctx.fill();
                }
            );

            /*
             * Key.
             */

            if (
                Game.keyObject &&
                Game.keyObject.visible
            ) {

                const px =
                    originX +
                    Game.keyObject
                        .position.x *
                    scale;

                const pz =
                    originY +
                    Game.keyObject
                        .position.z *
                    scale;

                ctx.fillStyle =
                    "#e6ddca";

                ctx.beginPath();

                ctx.arc(
                    px,
                    pz,
                    5,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }

            /*
             * Seeker red marker.
             */

            if (
                Game.seeker
            ) {

                const sx =
                    originX +
                    Game.seeker.position.x *
                    scale;

                const sz =
                    originY +
                    Game.seeker.position.z *
                    scale;

                ctx.fillStyle =
                    "#b33030";

                ctx.beginPath();

                ctx.arc(
                    sx,
                    sz,
                    7,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }

            /*
             * Player white arrow.
             */

            if (
                Game.player
            ) {

                const px =
                    originX +
                    Game.player.position.x *
                    scale;

                const pz =
                    originY +
                    Game.player.position.z *
                    scale;

                ctx.save();

                ctx.translate(
                    px,
                    pz
                );

                ctx.rotate(
                    -Game.yaw
                );

                ctx.fillStyle =
                    "#ffffff";

                ctx.beginPath();

                ctx.moveTo(
                    0,
                    -11
                );

                ctx.lineTo(
                    7,
                    8
                );

                ctx.lineTo(
                    0,
                    4
                );

                ctx.lineTo(
                    -7,
                    8
                );

                ctx.closePath();

                ctx.fill();

                ctx.restore();
            }
        };

    /* ========================================================
       CONTROLS
    ======================================================== */

    Game.createControls =
        function() {

            window.addEventListener(
                "keydown",
                event => {

                    Game.keys[
                        event.code
                    ] =
                        true;

                    if (
                        event.code ===
                        "Space"
                    ) {

                        event.preventDefault();

                        Game.jump();
                    }

                    if (
                        event.code ===
                        "KeyE"
                    ) {

                        Game.interact();
                    }
                }
            );

            window.addEventListener(
                "keyup",
                event => {

                    Game.keys[
                        event.code
                    ] =
                        false;
                }
            );

            document.addEventListener(
                "mousemove",
                event => {

                    if (
                        Game.pointerLocked
                    ) {

                        Game.look(
                            event.movementX,
                            event.movementY
                        );
                    }
                }
            );

            document.addEventListener(
                "pointerlockchange",
                () => {

                    Game.pointerLocked =
                        document.pointerLockElement ===
                        Game.renderer.domElement;
                }
            );

            Game.renderer.domElement
                .addEventListener(
                    "click",
                    () => {

                        if (
                            !Game.mobile &&
                            !Game.pointerLocked
                        ) {

                            Game.renderer.domElement
                                .requestPointerLock?.();
                        }
                    }
                );

            /*
             * Mobile controls.
             */

            if (
                Game.mobile
            ) {

                Game.createMobileControls();
            }

            /*
             * Flashlight slot integration.
             */

            window.addEventListener(
                "seeker:flashlight-selected",
                () => {

                    if (
                        window.SeekerDetails
                    ) {

                        window.SeekerDetails
                            .showFlashlight?.();
                    }
                }
            );
        };

    /* ========================================================
       MOBILE CONTROLS
    ======================================================== */

    Game.createMobileControls =
        function() {

            const root =
                document.createElement(
                    "div"
                );

            root.id =
                "mobileControls";

            Object.assign(
                root.style,
                {
                    position:
                        "fixed",
                    inset:
                        "0",
                    pointerEvents:
                        "none",
                    zIndex:
                        "5000"
                }
            );

            const joystick =
                document.createElement(
                    "div"
                );

            Object.assign(
                joystick.style,
                {
                    position:
                        "absolute",
                    left:
                        "22px",
                    bottom:
                        "28px",
                    width:
                        "130px",
                    height:
                        "130px",
                    border:
                        "1px solid rgba(255,255,255,.18)",
                    borderRadius:
                        "50%",
                    background:
                        "rgba(10,10,10,.38)",
                    pointerEvents:
                        "auto",
                    touchAction:
                        "none"
                }
            );

            const stick =
                document.createElement(
                    "div"
                );

            Object.assign(
                stick.style,
                {
                    position:
                        "absolute",
                    left:
                        "42px",
                    top:
                        "42px",
                    width:
                        "46px",
                    height:
                        "46px",
                    borderRadius:
                        "50%",
                    background:
                        "rgba(255,255,255,.18)",
                    border:
                        "1px solid rgba(255,255,255,.25)"
                }
            );

            joystick.appendChild(
                stick
            );

            root.appendChild(
                joystick
            );

            const action =
                document.createElement(
                    "button"
                );

            action.textContent =
                "INTERACT";

            Object.assign(
                action.style,
                {
                    position:
                        "absolute",
                    right:
                        "25px",
                    bottom:
                        "42px",
                    width:
                        "90px",
                    height:
                        "90px",
                    borderRadius:
                        "50%",
                    border:
                        "1px solid rgba(255,255,255,.18)",
                    background:
                        "rgba(10,10,10,.58)",
                    color:
                        "#eee",
                    font:
                        "800 9px system-ui",
                    letterSpacing:
                        "1px",
                    pointerEvents:
                        "auto",
                    touchAction:
                        "none"
                }
            );

            root.appendChild(
                action
            );

            const flashlight =
                document.createElement(
                    "button"
                );

            flashlight.textContent =
                "FLASHLIGHT";

            Object.assign(
                flashlight.style,
                {
                    position:
                        "absolute",
                    right:
                        "32px",
                    bottom:
                        "145px",
                    width:
                        "100px",
                    height:
                        "48px",
                    borderRadius:
                        "12px",
                    border:
                        "1px solid rgba(255,255,255,.18)",
                    background:
                        "rgba(10,10,10,.58)",
                    color:
                        "#eee",
                    font:
                        "800 9px system-ui",
                    letterSpacing:
                        "1px",
                    pointerEvents:
                        "auto",
                    touchAction:
                        "none"
                }
            );

            root.appendChild(
                flashlight
            );

            document.body.appendChild(
                root
            );

            /*
             * Joystick.
             */

            const updateJoystick =
                event => {

                    const rect =
                        joystick.getBoundingClientRect();

                    const centerX =
                        rect.left +
                        rect.width /
                        2;

                    const centerY =
                        rect.top +
                        rect.height /
                        2;

                    let dx =
                        event.clientX -
                        centerX;

                    let dy =
                        event.clientY -
                        centerY;

                    const radius =
                        rect.width /
                        2;

                    const length =
                        Math.sqrt(
                            dx * dx +
                            dy * dy
                        );

                    if (
                        length >
                        radius
                    ) {

                        dx =
                            dx /
                            length *
                            radius;

                        dy =
                            dy /
                            length *
                            radius;
                    }

                    stick.style.transform =
                        `translate(${dx}px,${dy}px)`;

                    Game.mobileMove.x =
                        dx /
                        radius;

                    Game.mobileMove.y =
                        -dy /
                        radius;
                };

            const resetJoystick =
                () => {

                    stick.style.transform =
                        "translate(0,0)";

                    Game.mobileMove.x =
                        0;

                    Game.mobileMove.y =
                        0;
                };

            joystick.addEventListener(
                "pointerdown",
                event => {

                    joystick.setPointerCapture?.(
                        event.pointerId
                    );

                    updateJoystick(
                        event
                    );
                }
            );

            joystick.addEventListener(
                "pointermove",
                event => {

                    if (
                        joystick.hasPointerCapture?.(
                            event.pointerId
                        )
                    ) {

                        updateJoystick(
                            event
                        );
                    }
                }
            );

            joystick.addEventListener(
                "pointerup",
                resetJoystick
            );

            joystick.addEventListener(
                "pointercancel",
                resetJoystick
            );

            action.addEventListener(
                "click",
                () => {

                    Game.interact();
                }
            );

            flashlight.addEventListener(
                "click",
                () => {

                    if (
                        window.SeekerDetails
                    ) {

                        if (
                            !window.SeekerDetails
                                .isFlashlightVisible?.()
                        ) {

                            window.SeekerDetails
                                .selectFlashlightSlot?.();

                        } else {

                            window.SeekerDetails
                                .toggleFlashlight?.();
                        }
                    }
                }
            );

            /*
             * Right half of screen = look.
             */

            let lastX = 0;
            let lastY = 0;
            let looking = false;

            window.addEventListener(
                "pointerdown",
                event => {

                    if (
                        !Game.mobile
                    ) {
                        return;
                    }

                    if (
                        event.clientX <
                        window.innerWidth *
                        0.45
                    ) {
                        return;
                    }

                    if (
                        event.target ===
                        action ||
                        event.target ===
                        flashlight
                    ) {
                        return;
                    }

                    looking =
                        true;

                    lastX =
                        event.clientX;

                    lastY =
                        event.clientY;
                }
            );

            window.addEventListener(
                "pointermove",
                event => {

                    if (
                        !looking
                    ) {
                        return;
                    }

                    const dx =
                        event.clientX -
                        lastX;

                    const dy =
                        event.clientY -
                        lastY;

                    lastX =
                        event.clientX;

                    lastY =
                        event.clientY;

                    Game.look(
                        dx,
                        dy
                    );
                }
            );

            window.addEventListener(
                "pointerup",
                () => {

                    looking =
                        false;
                }
            );
        };

    /* ========================================================
       SYSTEM CONNECTION
    ======================================================== */

    Game.connectSystems =
        function() {

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .connectWorld?.({
                        scene:
                            Game.scene,
                        camera:
                            Game.camera,
                        player:
                            Game.player,
                        seeker:
                            Game.seeker
                    });

                window.SeekerSystem
                    .startGame?.({
                        map:
                            "main",
                        platform:
                            Game.mobile
                                ? "mobile"
                                : "pc",
                        setupTime:
                            180
                    });
            }

            /*
             * Details system.
             */

            if (
                window.SeekerDetails
            ) {

                window.SeekerDetails
                    .setPlayer?.(
                        Game.player,
                        Game.camera
                    );
            }
        };

    /* ========================================================
       START
    ======================================================== */

    Game.start =
        function() {

            if (
                Game.started
            ) {
                return;
            }

            Game.started =
                true;

            Game.startTime =
                performance.now();

            Game.clock.start();

            /*
             * First slot flashlight stays hidden until clicked.
             */

            window.SeekerDetails
                ?.hideFlashlight?.();

            /*
             * Start render loop.
             */

            Game.animate();

            /*
             * The player gets 180 seconds before the Seeker.
             */

            setTimeout(
                () => {

                    if (
                        !Game.gameOver
                    ) {

                        Game.wakeSeeker();
                    }

                },
                180000
            );
        };

    /* ========================================================
       UPDATE
    ======================================================== */

    Game.update =
        function(
            delta
        ) {

            if (
                !Game.started ||
                Game.gameOver
            ) {
                return;
            }

            Game.updatePlayer(
                delta
            );

            Game.updateObjectives();

            Game.updateSeeker(
                delta
            );

            Game.checkGate();

            Game.checkEscape();

            Game.drawMinimap();

            /*
             * Connect movement state.
             */

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .setPlayerMoving?.(
                        Game.player
                            .userData
                            .moving,
                        Game.player
                            .userData
                            .speed
                    );
            }
        };

    /* ========================================================
       RENDER LOOP
    ======================================================== */

    Game.animate =
        function() {

            requestAnimationFrame(
                () => Game.animate()
            );

            const delta =
                Math.min(
                    0.05,
                    Game.clock.getDelta()
                );

            Game.update(
                delta
            );

            Game.renderer.render(
                Game.scene,
                Game.camera
            );

            if (
                window.SeekerSystem
            ) {

                window.SeekerSystem
                    .update?.(
                        delta
                    );
            }
        };

    /* ========================================================
       RESIZE
    ======================================================== */

    Game.resize =
        function() {

            if (
                !Game.camera ||
                !Game.renderer
            ) {
                return;
            }

            Game.camera.aspect =
                window.innerWidth /
                window.innerHeight;

            Game.camera.updateProjectionMatrix();

            Game.renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );
        };

    /* ========================================================
       GLOBAL ACCESS
    ======================================================== */

    window.SeekerGame =
        Game;

    window.Game =
        Game;

    /* ========================================================
       AUTO START AFTER DOM
    ======================================================== */

    function boot() {

        Game.init();

        /*
         * Start immediately if there isn't a menu controller.
         */

        const menu =
            document.getElementById(
                "mainMenu"
            );

        const playButton =
            document.querySelector(
                "[data-play-game]"
            ) ||
            document.getElementById(
                "playButton"
            ) ||
            document.getElementById(
                "play"
            );

        if (
            playButton
        ) {

            playButton.addEventListener(
                "click",
                () => {

                    Game.start();

                },
                {
                    once: true
                }
            );

        } else if (
            !menu
        ) {

            Game.start();

        } else {

            /*
             * The menu can start the world later.
             * The scene is still created immediately, so there
             * is a real 3D world behind the gameplay interface.
             */

            window.addEventListener(
                "seeker:play-requested",
                () => {

                    Game.start();
                },
                {
                    once: true
                }
            );
        }
    }

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );

    } else {

        boot();
    }

})();