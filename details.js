/* ============================================================
   THE SEEKER
   BlackHollow Games
   details.js
   ------------------------------------------------------------
   HIGH-DETAIL WORLD + 2D DETAIL + 3D DETAIL SYSTEM

   Main additions:
   - Tiny environmental details
   - Large environmental set pieces
   - Detailed walls/floors/ceilings
   - Pipes, wires, vents, shelves, furniture, signs
   - Dirt, cracks, scratches, stains, rubble
   - Fog, dust, sparks, floating particles
   - Dynamic lights
   - Detailed player hands
   - 3D flashlight model held in the player's hand
   - Flashlight beam and glow
   - Flashlight switching
   - 2D flashlight HUD support
   - Inventory-slot integration
   - Seeker proximity lighting effects
   - Camera shake helpers
   - Atmospheric effects
   - Reusable detail builders

   This file is designed to work with Three.js and can connect
   to game.js / main.js through window.SeekerDetails.
============================================================ */

(() => {
    "use strict";

    /* =========================================================
       GLOBAL SAFETY
    ========================================================= */

    const THREE =
        window.THREE ||
        globalThis.THREE;

    if (!THREE) {
        console.error(
            "[details.js] Three.js was not found. " +
            "Load Three.js before details.js."
        );
        return;
    }

    /* =========================================================
       ROOT OBJECT
    ========================================================= */

    const Details = {

        version: "100X-DETAIL",

        scene: null,
        camera: null,
        renderer: null,

        player: null,
        playerModel: null,
        playerHand: null,

        flashlight: null,
        flashlightGroup: null,
        flashlightBody: null,
        flashlightHead: null,
        flashlightLens: null,
        flashlightSwitch: null,
        flashlightBeam: null,
        flashlightGlow: null,

        worldGroup: null,
        environmentGroup: null,
        architectureGroup: null,
        propsGroup: null,
        tinyDetailGroup: null,
        atmosphereGroup: null,
        lightingGroup: null,
        particleGroup: null,

        hud: null,
        canvasOverlay: null,

        enabled: true,
        flashlightVisible: false,
        flashlightOn: true,

        elapsed: 0,

        settings: {
            highDetail: true,
            particles: true,
            fog: true,
            dynamicLights: true,
            flashlight: true,
            hands: true,
            shadows: true,
            atmosphere: true,
            tinyDetails: true,
            largeDetails: true,
            twoDDetails: true
        },

        colors: {
            wall: 0x282727,
            wallDark: 0x171717,
            concrete: 0x333333,
            concreteDark: 0x202020,
            metal: 0x2b2b2b,
            metalLight: 0x565656,
            rust: 0x733c24,
            wood: 0x3b2920,
            woodDark: 0x241914,
            dirtyWhite: 0xb6b1a3,
            paper: 0xbdb59e,
            bloodlessRed: 0x5e2020,
            warning: 0xc9a227,
            danger: 0xb33030,
            green: 0x5f765e,
            glass: 0x9ea9af,
            black: 0x060606,
            rubber: 0x111111,
            skin: 0x9b755d,
            skinDark: 0x684d3d,
            flashlight: 0xe4ddd0,
            flashlightDark: 0x4c4a46,
            flashlightLens: 0xd7e5e8,
            dust: 0xbcb6aa
        },

        refs: {
            floorMaterial: null,
            wallMaterial: null
        }
    };

    /* =========================================================
       BASIC HELPERS
    ========================================================= */

    function group(name) {
        const g = new THREE.Group();
        g.name = name;
        return g;
    }

    function mesh(
        geometry,
        material,
        name = "Detail"
    ) {
        const object = new THREE.Mesh(
            geometry,
            material
        );

        object.name = name;

        if (Details.settings.shadows) {
            object.castShadow = true;
            object.receiveShadow = true;
        }

        return object;
    }

    function mat(
        color,
        options = {}
    ) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness:
                options.roughness !== undefined
                    ? options.roughness
                    : 0.82,
            metalness:
                options.metalness !== undefined
                    ? options.metalness
                    : 0.02,
            transparent:
                options.transparent === true,
            opacity:
                options.opacity !== undefined
                    ? options.opacity
                    : 1,
            emissive:
                options.emissive !== undefined
                    ? options.emissive
                    : 0x000000,
            emissiveIntensity:
                options.emissiveIntensity !== undefined
                    ? options.emissiveIntensity
                    : 0,
            side:
                options.side !== undefined
                    ? options.side
                    : THREE.FrontSide
        });
    }

    function basicMat(
        color,
        options = {}
    ) {
        return new THREE.MeshBasicMaterial({
            color,
            transparent:
                options.transparent === true,
            opacity:
                options.opacity !== undefined
                    ? options.opacity
                    : 1,
            side:
                options.side !== undefined
                    ? options.side
                    : THREE.FrontSide,
            depthWrite:
                options.depthWrite !== undefined
                    ? options.depthWrite
                    : true
        });
    }

    function add(parent, object) {
        if (!parent || !object) {
            return object;
        }

        parent.add(object);
        return object;
    }

    function random(min, max) {
        return min +
            Math.random() *
            (max - min);
    }

    function randomInt(min, max) {
        return Math.floor(
            random(min, max + 1)
        );
    }

    function pick(array) {
        return array[
            Math.floor(
                Math.random() * array.length
            )
        ];
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function setPosition(object, x, y, z) {
        if (!object) return object;

        object.position.set(
            x || 0,
            y || 0,
            z || 0
        );

        return object;
    }

    function setRotation(
        object,
        x = 0,
        y = 0,
        z = 0
    ) {
        if (!object) return object;

        object.rotation.set(
            x,
            y,
            z
        );

        return object;
    }

    function randomizeRotation(
        object,
        amount = 0.2
    ) {
        if (!object) return object;

        object.rotation.x +=
            random(-amount, amount);

        object.rotation.y +=
            random(-amount, amount);

        object.rotation.z +=
            random(-amount, amount);

        return object;
    }

    function disposeObject(object) {
        if (!object) return;

        object.traverse(node => {
            if (node.geometry) {
                node.geometry.dispose();
            }

            if (node.material) {
                const materials =
                    Array.isArray(node.material)
                        ? node.material
                        : [node.material];

                materials.forEach(material => {
                    if (material && material.dispose) {
                        material.dispose();
                    }
                });
            }
        });
    }

    /* =========================================================
       INITIALIZATION
    ========================================================= */

    Details.init = function init(options = {}) {

        Details.scene =
            options.scene ||
            window.scene ||
            window.gameScene ||
            null;

        Details.camera =
            options.camera ||
            window.camera ||
            window.gameCamera ||
            null;

        Details.renderer =
            options.renderer ||
            window.renderer ||
            null;

        Details.player =
            options.player ||
            window.player ||
            window.playerObject ||
            null;

        Details.playerModel =
            options.playerModel ||
            null;

        Details.hud =
            options.hud ||
            document.querySelector(
                "#gameHUD"
            ) ||
            document.body;

        Details.createRoots();

        if (Details.scene) {
            Details.scene.add(
                Details.worldGroup
            );
        }

        Details.createGlobalMaterials();
        Details.createAtmosphere();
        Details.createPlayerHands();

        if (Details.camera) {
            Details.createFlashlight();
        }

        Details.create2DLayer();
        Details.attachInput();

        return Details;
    };

    Details.createRoots =
        function createRoots() {

            if (!Details.worldGroup) {
                Details.worldGroup =
                    group("THE_SEEKER_DETAILS");
            }

            if (!Details.environmentGroup) {
                Details.environmentGroup =
                    group("Environment");
            }

            if (!Details.architectureGroup) {
                Details.architectureGroup =
                    group("Architecture");
            }

            if (!Details.propsGroup) {
                Details.propsGroup =
                    group("Large_Props");
            }

            if (!Details.tinyDetailGroup) {
                Details.tinyDetailGroup =
                    group("Tiny_Details");
            }

            if (!Details.atmosphereGroup) {
                Details.atmosphereGroup =
                    group("Atmosphere");
            }

            if (!Details.lightingGroup) {
                Details.lightingGroup =
                    group("Dynamic_Lighting");
            }

            if (!Details.particleGroup) {
                Details.particleGroup =
                    group("Particles");
            }

            add(
                Details.worldGroup,
                Details.environmentGroup
            );

            add(
                Details.worldGroup,
                Details.architectureGroup
            );

            add(
                Details.worldGroup,
                Details.propsGroup
            );

            add(
                Details.worldGroup,
                Details.tinyDetailGroup
            );

            add(
                Details.worldGroup,
                Details.atmosphereGroup
            );

            add(
                Details.worldGroup,
                Details.lightingGroup
            );

            add(
                Details.worldGroup,
                Details.particleGroup
            );
        };

    /* =========================================================
       GLOBAL MATERIALS
    ========================================================= */

    Details.createGlobalMaterials =
        function createGlobalMaterials() {

            Details.refs.floorMaterial =
                mat(
                    Details.colors.concreteDark,
                    {
                        roughness: 0.96,
                        metalness: 0
                    }
                );

            Details.refs.wallMaterial =
                mat(
                    Details.colors.wall,
                    {
                        roughness: 0.92,
                        metalness: 0
                    }
                );
        };

    /* =========================================================
       ARCHITECTURE
    ========================================================= */

    Details.createWall =
        function createWall(
            width,
            height,
            depth,
            x,
            y,
            z,
            options = {}
        ) {

            const material =
                options.material ||
                Details.refs.wallMaterial;

            const wall = mesh(
                new THREE.BoxGeometry(
                    width,
                    height,
                    depth
                ),
                material,
                options.name ||
                "Detailed_Wall"
            );

            setPosition(
                wall,
                x,
                y,
                z
            );

            add(
                Details.architectureGroup,
                wall
            );

            if (
                options.cracks !== false &&
                Details.settings.tinyDetails
            ) {
                Details.addWallCracks(
                    wall,
                    width,
                    height,
                    depth
                );
            }

            return wall;
        };

    Details.createFloor =
        function createFloor(
            width,
            depth,
            x = 0,
            y = 0,
            z = 0
        ) {

            const floor =
                mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.3,
                        depth
                    ),
                    Details.refs.floorMaterial,
                    "Detailed_Floor"
                );

            setPosition(
                floor,
                x,
                y,
                z
            );

            add(
                Details.architectureGroup,
                floor
            );

            Details.addFloorDamage(
                width,
                depth,
                x,
                y + 0.17,
                z
            );

            return floor;
        };

    Details.createCeiling =
        function createCeiling(
            width,
            depth,
            x = 0,
            y = 10,
            z = 0
        ) {

            const ceiling =
                mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.25,
                        depth
                    ),
                    mat(
                        Details.colors.wallDark,
                        {
                            roughness: 1
                        }
                    ),
                    "Detailed_Ceiling"
                );

            setPosition(
                ceiling,
                x,
                y,
                z
            );

            add(
                Details.architectureGroup,
                ceiling
            );

            return ceiling;
        };

    Details.createPillar =
        function createPillar(
            height = 8,
            radius = 0.5,
            x = 0,
            y = 0,
            z = 0
        ) {

            const pillarGroup =
                group("Concrete_Pillar");

            const body =
                mesh(
                    new THREE.CylinderGeometry(
                        radius,
                        radius * 1.05,
                        height,
                        12
                    ),
                    mat(
                        Details.colors.concrete,
                        {
                            roughness: 0.94
                        }
                    ),
                    "Pillar_Body"
                );

            body.position.y =
                height / 2;

            pillarGroup.add(body);

            const ringMaterial =
                mat(
                    Details.colors.metal,
                    {
                        metalness: 0.5,
                        roughness: 0.6
                    }
                );

            for (
                let i = 0;
                i < 4;
                i++
            ) {

                const ring =
                    mesh(
                        new THREE.TorusGeometry(
                            radius * 1.02,
                            0.055,
                            6,
                            16
                        ),
                        ringMaterial,
                        "Pillar_Ring"
                    );

                ring.rotation.x =
                    Math.PI / 2;

                ring.position.y =
                    0.5 +
                    i * (
                        height / 4
                    );

                pillarGroup.add(
                    ring
                );
            }

            pillarGroup.position.set(
                x,
                y,
                z
            );

            add(
                Details.architectureGroup,
                pillarGroup
            );

            return pillarGroup;
        };

    /* =========================================================
       PIPES
    ========================================================= */

    Details.createPipe =
        function createPipe(
            points,
            radius = 0.08,
            color = Details.colors.metal
        ) {

            if (
                !Array.isArray(points) ||
                points.length < 2
            ) {
                return null;
            }

            const curve =
                new THREE.CatmullRomCurve3(
                    points.map(p =>
                        p.clone
                            ? p.clone()
                            : new THREE.Vector3(
                                p.x,
                                p.y,
                                p.z
                            )
                    )
                );

            const geometry =
                new THREE.TubeGeometry(
                    curve,
                    Math.max(
                        8,
                        points.length * 8
                    ),
                    radius,
                    8,
                    false
                );

            const pipe =
                mesh(
                    geometry,
                    mat(
                        color,
                        {
                            roughness: 0.65,
                            metalness: 0.75
                        }
                    ),
                    "Industrial_Pipe"
                );

            add(
                Details.architectureGroup,
                pipe
            );

            return pipe;
        };

    Details.createPipeNetwork =
        function createPipeNetwork(
            options = {}
        ) {

            const x =
                options.x || 0;

            const y =
                options.y || 7;

            const z =
                options.z || 0;

            const length =
                options.length || 15;

            const groupPipe =
                group("Pipe_Network");

            for (
                let i = 0;
                i < 5;
                i++
            ) {

                const py =
                    y +
                    i * 0.23;

                const points = [

                    new THREE.Vector3(
                        x - length / 2,
                        py,
                        z
                    ),

                    new THREE.Vector3(
                        x - length * 0.2,
                        py +
                            random(
                                -0.08,
                                0.08
                            ),
                        z
                    ),

                    new THREE.Vector3(
                        x,
                        py +
                            random(
                                -0.12,
                                0.12
                            ),
                        z
                    ),

                    new THREE.Vector3(
                        x + length * 0.3,
                        py,
                        z
                    ),

                    new THREE.Vector3(
                        x + length / 2,
                        py,
                        z +
                            random(
                                -0.15,
                                0.15
                            )
                    )
                ];

                const pipe =
                    Details.createPipe(
                        points,
                        0.07 +
                        i * 0.015,
                        i % 2 === 0
                            ? Details.colors.metal
                            : Details.colors.metalLight
                    );

                if (pipe) {
                    groupPipe.add(
                        pipe
                    );
                }
            }

            Details.addPipeValves(
                groupPipe,
                x,
                y + 1,
                z
            );

            add(
                Details.propsGroup,
                groupPipe
            );

            return groupPipe;
        };

    Details.addPipeValves =
        function addPipeValves(
            parent,
            x,
            y,
            z
        ) {

            for (
                let i = 0;
                i < 4;
                i++
            ) {

                const valve =
                    group("Valve");

                const disc =
                    mesh(
                        new THREE.CylinderGeometry(
                            0.28,
                            0.28,
                            0.12,
                            12
                        ),
                        mat(
                            Details.colors.rust,
                            {
                                roughness: 0.75,
                                metalness: 0.5
                            }
                        ),
                        "Valve_Disc"
                    );

                disc.rotation.z =
                    Math.PI / 2;

                disc.position.x =
                    x +
                    random(
                        -5,
                        5
                    );

                disc.position.y =
                    y +
                    random(
                        -0.8,
                        0.8
                    );

                disc.position.z =
                    z +
                    random(
                        -0.4,
                        0.4
                    );

                valve.add(disc);

                for (
                    let spoke = 0;
                    spoke < 6;
                    spoke++
                ) {

                    const bar =
                        mesh(
                            new THREE.BoxGeometry(
                                0.05,
                                0.62,
                                0.05
                            ),
                            mat(
                                Details.colors.metalLight,
                                {
                                    roughness: 0.6,
                                    metalness: 0.65
                                }
                            ),
                            "Valve_Spoke"
                        );

                    bar.position.copy(
                        disc.position
                    );

                    bar.rotation.z =
                        (
                            Math.PI * 2 *
                            spoke
                        ) / 6;

                    valve.add(bar);
                }

                parent.add(
                    valve
                );
            }
        };

    /* =========================================================
       WIRES / CABLES
    ========================================================= */

    Details.createCable =
        function createCable(
            start,
            end,
            sag = 0.5,
            radius = 0.025
        ) {

            const midpoint =
                new THREE.Vector3(
                    (
                        start.x +
                        end.x
                    ) / 2,
                    (
                        start.y +
                        end.y
                    ) / 2 -
                    sag,
                    (
                        start.z +
                        end.z
                    ) / 2
                );

            const curve =
                new THREE.QuadraticBezierCurve3(
                    start,
                    midpoint,
                    end
                );

            const geometry =
                new THREE.TubeGeometry(
                    curve,
                    18,
                    radius,
                    6,
                    false
                );

            const cable =
                mesh(
                    geometry,
                    mat(
                        Details.colors.rubber,
                        {
                            roughness: 1,
                            metalness: 0
                        }
                    ),
                    "Hanging_Cable"
                );

            add(
                Details.tinyDetailGroup,
                cable
            );

            return cable;
        };

    /* =========================================================
       VENTS
    ========================================================= */

    Details.createVent =
        function createVent(
            x,
            y,
            z,
            width = 1.5,
            height = 1
        ) {

            const vent =
                group("Vent");

            const outer =
                mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.1,
                        height
                    ),
                    mat(
                        Details.colors.metal,
                        {
                            roughness: 0.8,
                            metalness: 0.65
                        }
                    ),
                    "Vent_Frame"
                );

            vent.add(outer);

            for (
                let i = 0;
                i < 9;
                i++
            ) {

                const slat =
                    mesh(
                        new THREE.BoxGeometry(
                            width * 0.88,
                            0.045,
                            0.045
                        ),
                        mat(
                            Details.colors.black,
                            {
                                roughness: 0.9,
                                metalness: 0.15
                            }
                        ),
                        "Vent_Slat"
                    );

                slat.position.z =
                    (
                        -height / 2
                    ) +
                    0.15 +
                    (
                        i *
                        (
                            (
                                height -
                                0.3
                            ) / 8
                        )
                    );

                slat.rotation.x =
                    -0.2;

                vent.add(slat);
            }

            vent.position.set(
                x,
                y,
                z
            );

            add(
                Details.architectureGroup,
                vent
            );

            return vent;
        };

    /* =========================================================
       DOORS
    ========================================================= */

    Details.createDetailedDoor =
        function createDetailedDoor(
            x,
            y,
            z,
            options = {}
        ) {

            const width =
                options.width || 2;

            const height =
                options.height || 3.8;

            const door =
                group(
                    options.name ||
                    "Detailed_Door"
                );

            const body =
                mesh(
                    new THREE.BoxGeometry(
                        width,
                        height,
                        0.22
                    ),
                    mat(
                        options.color ||
                        Details.colors.woodDark,
                        {
                            roughness: 0.93,
                            metalness: 0.05
                        }
                    ),
                    "Door_Body"
                );

            body.position.y =
                height / 2;

            door.add(body);

            const frameMaterial =
                mat(
                    Details.colors.metal,
                    {
                        roughness: 0.7,
                        metalness: 0.75
                    }
                );

            const frameThickness =
                0.12;

            const leftFrame =
                mesh(
                    new THREE.BoxGeometry(
                        frameThickness,
                        height + 0.18,
                        0.34
                    ),
                    frameMaterial,
                    "Door_Frame_Left"
                );

            leftFrame.position.set(
                -width / 2 -
                    frameThickness / 2,
                height / 2,
                0
            );

            door.add(
                leftFrame
            );

            const rightFrame =
                leftFrame.clone();

            rightFrame.position.x =
                width / 2 +
                frameThickness / 2;

            door.add(
                rightFrame
            );

            const topFrame =
                mesh(
                    new THREE.BoxGeometry(
                        width +
                            frameThickness * 2,
                        frameThickness,
                        0.34
                    ),
                    frameMaterial,
                    "Door_Frame_Top"
                );

            topFrame.position.y =
                height +
                0.08;

            door.add(
                topFrame
            );

            const handleBase =
                mesh(
                    new THREE.CylinderGeometry(
                        0.11,
                        0.11,
                        0.12,
                        16
                    ),
                    frameMaterial,
                    "Handle_Base"
                );

            handleBase.rotation.z =
                Math.PI / 2;

            handleBase.position.set(
                width * 0.27,
                height * 0.48,
                -0.2
            );

            door.add(
                handleBase
            );

            const handle =
                mesh(
                    new THREE.CylinderGeometry(
                        0.045,
                        0.045,
                        0.28,
                        10
                    ),
                    mat(
                        Details.colors.metalLight,
                        {
                            roughness: 0.35,
                            metalness: 0.9
                        }
                    ),
                    "Handle"
                );

            handle.rotation.z =
                Math.PI / 2;

            handle.position.set(
                width * 0.27,
                height * 0.48,
                -0.31
            );

            door.add(
                handle
            );

            /* tiny scratches */
            for (
                let i = 0;
                i < 15;
                i++
            ) {

                const scratch =
                    mesh(
                        new THREE.BoxGeometry(
                            random(0.03, 0.12),
                            random(0.008, 0.025),
                            0.012
                        ),
                        mat(
                            Details.colors.metalLight,
                            {
                                roughness: 0.8,
                                metalness: 0.6
                            }
                        ),
                        "Door_Scratch"
                    );

                scratch.position.set(
                    random(
                        -width * 0.4,
                        width * 0.4
                    ),
                    random(
                        0.5,
                        height - 0.4
                    ),
                    -0.125
                );

                scratch.rotation.z =
                    random(
                        -1.2,
                        1.2
                    );

                door.add(
                    scratch
                );
            }

            door.position.set(
                x,
                y,
                z
            );

            add(
                Details.propsGroup,
                door
            );

            return door;
        };

    /* =========================================================
       SHELVES
    ========================================================= */

    Details.createShelf =
        function createShelf(
            x,
            y,
            z,
            width = 3
        ) {

            const shelf =
                group("Industrial_Shelf");

            const wood =
                mat(
                    Details.colors.wood,
                    {
                        roughness: 0.9
                    }
                );

            for (
                let level = 0;
                level < 4;
                level++
            ) {

                const board =
                    mesh(
                        new THREE.BoxGeometry(
                            width,
                            0.12,
                            0.7
                        ),
                        wood,
                        "Shelf_Board"
                    );

                board.position.y =
                    level * 0.95;

                shelf.add(board);
            }

            const posts =
                mat(
                    Details.colors.metal,
                    {
                        metalness: 0.7,
                        roughness: 0.7
                    }
                );

            for (
                const px of [
                    -width / 2 + 0.08,
                    width / 2 - 0.08
                ]
            ) {

                const post =
                    mesh(
                        new THREE.CylinderGeometry(
                            0.06,
                            0.06,
                            3.0,
                            8
                        ),
                        posts,
                        "Shelf_Post"
                    );

                post.position.set(
                    px,
                    1.4,
                    0
                );

                shelf.add(post);
            }

            /* objects on shelves */

            for (
                let level = 0;
                level < 4;
                level++
            ) {

                const amount =
                    randomInt(
                        2,
                        5
                    );

                for (
                    let i = 0;
                    i < amount;
                    i++
                ) {

                    const item =
                        Details.createRandomProp();

                    item.scale.setScalar(
                        random(
                            0.35,
                            0.75
                        )
                    );

                    item.position.set(
                        random(
                            -width * 0.38,
                            width * 0.38
                        ),
                        0.18 +
                            level * 0.95,
                        random(
                            -0.2,
                            0.2
                        )
                    );

                    shelf.add(item);
                }
            }

            shelf.position.set(
                x,
                y,
                z
            );

            add(
                Details.propsGroup,
                shelf
            );

            return shelf;
        };

    /* =========================================================
       RANDOM SMALL PROPS
    ========================================================= */

    Details.createRandomProp =
        function createRandomProp() {

            const type =
                randomInt(
                    0,
                    7
                );

            let object;

            if (type === 0) {

                object =
                    mesh(
                        new THREE.BoxGeometry(
                            0.28,
                            0.18,
                            0.22
                        ),
                        mat(
                            pick([
                                Details.colors.rust,
                                Details.colors.metal,
                                Details.colors.woodDark
                            ]),
                            {
                                roughness: 0.88,
                                metalness: 0.25
                            }
                        ),
                        "Small_Box"
                    );

            } else if (type === 1) {

                object =
                    mesh(
                        new THREE.CylinderGeometry(
                            0.1,
                            0.12,
                            0.38,
                            10
                        ),
                        mat(
                            Details.colors.metalLight,
                            {
                                roughness: 0.55,
                                metalness: 0.75
                            }
                        ),
                        "Small_Can"
                    );

            } else if (type === 2) {

                object =
                    mesh(
                        new THREE.BoxGeometry(
                            0.08,
                            0.4,
                            0.17
                        ),
                        mat(
                            Details.colors.dirtyWhite,
                            {
                                roughness: 0.85
                            }
                        ),
                        "Bottle"
                    );

            } else if (type === 3) {

                object =
                    mesh(
                        new THREE.SphereGeometry(
                            0.14,
                            8,
                            8
                        ),
                        mat(
                            Details.colors.rubber,
                            {
                                roughness: 0.98
                            }
                        ),
                        "Rubber_Object"
                    );

            } else if (type === 4) {

                object =
                    mesh(
                        new THREE.TorusGeometry(
                            0.09,
                            0.025,
                            6,
                            12
                        ),
                        mat(
                            Details.colors.metalLight,
                            {
                                metalness: 0.8,
                                roughness: 0.5
                            }
                        ),
                        "Metal_Ring"
                    );

            } else if (type === 5) {

                object =
                    mesh(
                        new THREE.BoxGeometry(
                            0.32,
                            0.04,
                            0.22
                        ),
                        mat(
                            Details.colors.paper,
                            {
                                roughness: 1
                            }
                        ),
                        "Paper"
                    );

                object.rotation.z =
                    random(
                        -0.5,
                        0.5
                    );

            } else if (type === 6) {

                object =
                    mesh(
                        new THREE.CylinderGeometry(
                            0.035,
                            0.035,
                            0.5,
                            6
                        ),
                        mat(
                            Details.colors.metalLight,
                            {
                                metalness: 0.8,
                                roughness: 0.45
                            }
                        ),
                        "Rod"
                    );

            } else {

                object =
                    mesh(
                        new THREE.DodecahedronGeometry(
                            0.11,
                            0
                        ),
                        mat(
                            Details.colors.concrete,
                            {
                                roughness: 1
                            }
                        ),
                        "Debris"
                    );
            }

            randomizeRotation(
                object,
                0.35
            );

            return object;
        };

    /* =========================================================
       TABLE
    ========================================================= */

    Details.createTable =
        function createTable(
            x,
            y,
            z,
            width = 2.6,
            depth = 1.4,
            height = 1.25
        ) {

            const table =
                group("Old_Table");

            const woodenMaterial =
                mat(
                    Details.colors.wood,
                    {
                        roughness: 0.95
                    }
                );

            const top =
                mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.14,
                        depth
                    ),
                    woodenMaterial,
                    "Table_Top"
                );

            top.position.y =
                height;

            table.add(top);

            for (
                const tx of [
                    -width / 2 + 0.14,
                    width / 2 - 0.14
                ]
            ) {

                for (
                    const tz of [
                        -depth / 2 + 0.14,
                        depth / 2 - 0.14
                    ]
                ) {

                    const leg =
                        mesh(
                            new THREE.BoxGeometry(
                                0.13,
                                height,
                                0.13
                            ),
                            woodenMaterial,
                            "Table_Leg"
                        );

                    leg.position.set(
                        tx,
                        height / 2,
                        tz
                    );

                    table.add(leg);
                }
            }

            for (
                let i = 0;
                i < 8;
                i++
            ) {

                const small =
                    Details.createRandomProp();

                small.position.set(
                    random(
                        -width * 0.35,
                        width * 0.35
                    ),
                    height +
                        0.1 +
                        small.scale.y * 0.15,
                    random(
                        -depth * 0.35,
                        depth * 0.35
                    )
                );

                table.add(
                    small
                );
            }

            table.position.set(
                x,
                y,
                z
            );

            add(
                Details.propsGroup,
                table
            );

            return table;
        };

    /* =========================================================
       CHAIR
    ========================================================= */

    Details.createChair =
        function createChair(
            x,
            y,
            z
        ) {

            const chair =
                group("Old_Chair");

            const material =
                mat(
                    Details.colors.woodDark,
                    {
                        roughness: 0.96
                    }
                );

            const seat =
                mesh(
                    new THREE.BoxGeometry(
                        0.9,
                        0.13,
                        0.9
                    ),
                    material,
                    "Chair_Seat"
                );

            seat.position.y =
                1;

            chair.add(seat);

            const back =
                mesh(
                    new THREE.BoxGeometry(
                        0.9,
                        1.5,
                        0.13
                    ),
                    material,
                    "Chair_Back"
                );

            back.position.set(
                0,
                1.65,
                0.35
            );

            chair.add(back);

            for (
                const cx of [-0.35, 0.35]
            ) {

                for (
                    const cz of [
                        -0.35,
                        0.35
                    ]
                ) {

                    const leg =
                        mesh(
                            new THREE.BoxGeometry(
                                0.11,
                                1,
                                0.11
                            ),
                            material,
                            "Chair_Leg"
                        );

                    leg.position.set(
                        cx,
                        0.5,
                        cz
                    );

                    chair.add(
                        leg
                    );
                }
            }

            chair.position.set(
                x,
                y,
                z
            );

            randomizeRotation(
                chair,
                0.1
            );

            add(
                Details.propsGroup,
                chair
            );

            return chair;
        };

    /* =========================================================
       BARRELS
    ========================================================= */

    Details.createBarrel =
        function createBarrel(
            x,
            y,
            z
        ) {

            const barrel =
                group("Metal_Barrel");

            const body =
                mesh(
                    new THREE.CylinderGeometry(
                        0.48,
                        0.5,
                        1.3,
                        16
                    ),
                    mat(
                        Details.colors.metal,
                        {
                            roughness: 0.85,
                            metalness: 0.45
                        }
                    ),
                    "Barrel_Body"
                );

            body.position.y =
                0.65;

            barrel.add(body);

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                const ring =
                    mesh(
                        new THREE.TorusGeometry(
                            0.49,
                            0.045,
                            6,
                            16
                        ),
                        mat(
                            Details.colors.rust,
                            {
                                roughness: 0.78,
                                metalness: 0.5
                            }
                        ),
                        "Barrel_Ring"
                    );

                ring.rotation.x =
                    Math.PI / 2;

                ring.position.y =
                    0.2 +
                    i * 0.45;

                barrel.add(ring);
            }

            barrel.position.set(
                x,
                y,
                z
            );

            add(
                Details.propsGroup,
                barrel
            );

            return barrel;
        };

    /* =========================================================
       FLOOR DAMAGE
    ========================================================= */

    Details.addFloorDamage =
        function addFloorDamage(
            width,
            depth,
            x,
            y,
            z
        ) {

            if (
                !Details.settings.tinyDetails
            ) {
                return;
            }

            const damageGroup =
                group("Floor_Damage");

            for (
                let i = 0;
                i < Math.ceil(
                    width * depth / 18
                );
                i++
            ) {

                const size =
                    random(
                        0.08,
                        0.55
                    );

                const crack =
                    mesh(
                        new THREE.BoxGeometry(
                            size,
                            0.01,
                            random(
                                0.018,
                                0.045
                            )
                        ),
                        basicMat(
                            pick([
                                0x111111,
                                0x161616,
                                0x202020
                            ])
                        ),
                        "Floor_Crack"
                    );

                crack.position.set(
                    x +
                        random(
                            -width / 2,
                            width / 2
                        ),
                    y +
                        random(
                            0,
                            0.01
                        ),
                    z +
                        random(
                            -depth / 2,
                            depth / 2
                        )
                );

                crack.rotation.y =
                    random(
                        0,
                        Math.PI
                    );

                damageGroup.add(
                    crack
                );
            }

            add(
                Details.tinyDetailGroup,
                damageGroup
            );
        };

    /* =========================================================
       WALL CRACKS
    ========================================================= */

    Details.addWallCracks =
        function addWallCracks(
            parent,
            width,
            height,
            depth
        ) {

            const cracks =
                group("Wall_Cracks");

            const amount =
                clamp(
                    Math.floor(
                        width * height / 3
                    ),
                    4,
                    35
                );

            for (
                let i = 0;
                i < amount;
                i++
            ) {

                const length =
                    random(
                        0.2,
                        1.1
                    );

                const crack =
                    mesh(
                        new THREE.BoxGeometry(
                            length,
                            0.018,
                            0.01
                        ),
                        basicMat(
                            0x0c0c0c
                        ),
                        "Wall_Crack"
                    );

                crack.position.set(
                    random(
                        -width / 2 +
                            0.12,
                        width / 2 -
                            0.12
                    ),
                    random(
                        0.2,
                        height -
                            0.2
                    ),
                    depth /
                        2 +
                        0.015
                );

                crack.rotation.z =
                    random(
                        -0.6,
                        0.6
                    );

                cracks.add(
                    crack
                );
            }

            parent.add(
                cracks
            );
        };

    /* =========================================================
       DEBRIS
    ========================================================= */

    Details.createDebrisPile =
        function createDebrisPile(
            x,
            y,
            z,
            radius = 2
        ) {

            const pile =
                group("Debris_Pile");

            const amount =
                randomInt(
                    18,
                    40
                );

            for (
                let i = 0;
                i < amount;
                i++
            ) {

                const item =
                    Details.createRandomProp();

                const angle =
                    random(
                        0,
                        Math.PI * 2
                    );

                const distance =
                    random(
                        0,
                        radius
                    );

                item.position.set(
                    Math.cos(angle) *
                        distance,
                    random(
                        0.04,
                        0.35
                    ),
                    Math.sin(angle) *
                        distance
                );

                item.scale.multiplyScalar(
                    random(
                        0.65,
                        1.8
                    )
                );

                randomizeRotation(
                    item,
                    1
                );

                pile.add(
                    item
                );
            }

            pile.position.set(
                x,
                y,
                z
            );

            add(
                Details.tinyDetailGroup,
                pile
            );

            return pile;
        };

    /* =========================================================
       BIG SET PIECES
    ========================================================= */

    Details.createLargeGenerator =
        function createLargeGenerator(
            x,
            y,
            z
        ) {

            const generator =
                group("Large_Generator");

            const body =
                mesh(
                    new THREE.BoxGeometry(
                        4.2,
                        2.5,
                        2.2
                    ),
                    mat(
                        Details.colors.metal,
                        {
                            roughness: 0.8,
                            metalness: 0.68
                        }
                    ),
                    "Generator_Body"
                );

            body.position.y =
                1.25;

            generator.add(
                body
            );

            const top =
                mesh(
                    new THREE.BoxGeometry(
                        3.5,
                        0.25,
                        1.4
                    ),
                    mat(
                        Details.colors.metalLight,
                        {
                            roughness: 0.72,
                            metalness: 0.78
                        }
                    ),
                    "Generator_Top"
                );

            top.position.y =
                2.65;

            generator.add(top);

            for (
                let i = 0;
                i < 3;
                i++
            ) {

                const panel =
                    mesh(
                        new THREE.BoxGeometry(
                            0.72,
                            1.1,
                            0.05
                        ),
                        mat(
                            Details.colors.metalLight,
                            {
                                roughness: 0.6,
                                metalness: 0.8
                            }
                        ),
                        "Generator_Panel"
                    );

                panel.position.set(
                    -1.35 +
                        i * 1.35,
                    1.35,
                    -1.14
                );

                generator.add(
                    panel
                );
            }

            for (
                let i = 0;
                i < 6;
                i++
            ) {

                const vent =
                    mesh(
                        new THREE.BoxGeometry(
                            1.2,
                            0.06,
                            0.06
                        ),
                        basicMat(
                            0x090909
                        ),
                        "Generator_Vent"
                    );

                vent.position.set(
                    0,
                    0.55 +
                        i * 0.25,
                    -1.17
                );

                generator.add(
                    vent
                );
            }

            Details.addHazardStripe(
                generator,
                2.9,
                0.08,
                2.4
            );

            generator.position.set(
                x,
                y,
                z
            );

            add(
                Details.propsGroup,
                generator
            );

            Details.createWarningLight(
                generator,
                0,
                2.9,
                0
            );

            return generator;
        };

    /* =========================================================
       HAZARD STRIPES
    ========================================================= */

    Details.addHazardStripe =
        function addHazardStripe(
            parent,
            width,
            height,
            z
        ) {

            const stripeGroup =
                group("Hazard_Stripes");

            const count =
                Math.max(
                    4,
                    Math.floor(
                        width / 0.35
                    )
                );

            for (
                let i = 0;
                i < count;
                i++
            ) {

                const stripe =
                    mesh(
                        new THREE.BoxGeometry(
                            0.18,
                            height,
                            0.02
                        ),
                        mat(
                            i % 2 === 0
                                ? 0x171717
                                : Details.colors.warning,
                            {
                                roughness: 0.7
                            }
                        ),
                        "Hazard_Strip"
                    );

                stripe.position.x =
                    -width / 2 +
                    i * 0.35;

                stripe.position.y =
                    0;

                stripe.position.z =
                    z;

                stripe.rotation.z =
                    -0.5;

                stripeGroup.add(
                    stripe
                );
            }

            parent.add(
                stripeGroup
            );

            return stripeGroup;
        };

    /* =========================================================
       WARNING LIGHT
    ========================================================= */

    Details.createWarningLight =
        function createWarningLight(
            parent,
            x,
            y,
            z
        ) {

            const bulb =
                mesh(
                    new THREE.SphereGeometry(
                        0.09,
                        10,
                        10
                    ),
                    mat(
                        Details.colors.danger,
                        {
                            emissive:
                                Details.colors.danger,
                            emissiveIntensity:
                                2
                        }
                    ),
                    "Warning_Bulb"
                );

            bulb.position.set(
                x,
                y,
                z
            );

            parent.add(
                bulb
            );

            const light =
                new THREE.PointLight(
                    Details.colors.danger,
                    1,
                    5
                );

            light.position.copy(
                bulb.position
            );

            parent.add(
                light
            );

            bulb.userData.warningLight =
                light;

            bulb.userData.warningTime =
                random(
                    0,
                    Math.PI * 2
                );

            return bulb;
        };

    /* =========================================================
       LIGHTING
    ========================================================= */

    Details.createRoomLight =
        function createRoomLight(
            x,
            y,
            z,
            options = {}
        ) {

            const color =
                options.color ||
                0xc4c0b3;

            const intensity =
                options.intensity !== undefined
                    ? options.intensity
                    : 1.5;

            const distance =
                options.distance || 12;

            const bulb =
                mesh(
                    new THREE.SphereGeometry(
                        options.size || 0.09,
                        8,
                        8
                    ),
                    mat(
                        color,
                        {
                            emissive:
                                color,
                            emissiveIntensity:
                                3
                        }
                    ),
                    "Ceiling_Bulb"
                );

            bulb.position.set(
                x,
                y,
                z
            );

            const light =
                new THREE.PointLight(
                    color,
                    intensity,
                    distance
                );

            light.position.copy(
                bulb.position
            );

            if (Details.settings.shadows) {
                light.castShadow = true;
            }

            add(
                Details.lightingGroup,
                bulb
            );

            add(
                Details.lightingGroup,
                light
            );

            bulb.userData.light =
                light;

            bulb.userData.baseIntensity =
                intensity;

            return {
                bulb,
                light
            };
        };

    /* =========================================================
       ATMOSPHERE / FOG
    ========================================================= */

    Details.createAtmosphere =
        function createAtmosphere() {

            if (
                !Details.scene
            ) {
                return;
            }

            if (
                Details.settings.fog
            ) {

                Details.scene.fog =
                    new THREE.FogExp2(
                        0x090909,
                        0.012
                    );
            }

            Details.createDustParticles();
            Details.createFloatingSpecks();
            Details.createAmbientMist();
        };

    /* =========================================================
       DUST PARTICLES
    ========================================================= */

    Details.createDustParticles =
        function createDustParticles() {

            if (
                !Details.settings.particles
            ) {
                return null;
            }

            const count = 600;

            const positions =
                new Float32Array(
                    count * 3
                );

            const velocities =
                new Float32Array(
                    count * 3
                );

            for (
                let i = 0;
                i < count;
                i++
            ) {

                positions[
                    i * 3
                ] =
                    random(
                        -80,
                        80
                    );

                positions[
                    i * 3 + 1
                ] =
                    random(
                        0.2,
                        12
                    );

                positions[
                    i * 3 + 2
                ] =
                    random(
                        -80,
                        80
                    );

                velocities[
                    i * 3
                ] =
                    random(
                        -0.003,
                        0.003
                    );

                velocities[
                    i * 3 + 1
                ] =
                    random(
                        0.002,
                        0.012
                    );

                velocities[
                    i * 3 + 2
                ] =
                    random(
                        -0.003,
                        0.003
                    );
            }

            const geometry =
                new THREE.BufferGeometry();

            geometry.setAttribute(
                "position",
                new THREE.BufferAttribute(
                    positions,
                    3
                )
            );

            const material =
                new THREE.PointsMaterial({
                    color:
                        Details.colors.dust,
                    size: 0.035,
                    transparent: true,
                    opacity: 0.28,
                    depthWrite: false,
                    sizeAttenuation: true
                });

            const particles =
                new THREE.Points(
                    geometry,
                    material
                );

            particles.name =
                "Dust_Particles";

            particles.userData.velocities =
                velocities;

            Details.particleGroup.add(
                particles
            );

            Details.dust =
                particles;

            return particles;
        };

    /* =========================================================
       FLOATING SPECKS
    ========================================================= */

    Details.createFloatingSpecks =
        function createFloatingSpecks() {

            const specks =
                group("Floating_Specks");

            for (
                let i = 0;
                i < 90;
                i++
            ) {

                const object =
                    mesh(
                        new THREE.SphereGeometry(
                            random(
                                0.008,
                                0.025
                            ),
                            5,
                            5
                        ),
                        basicMat(
                            0xc8c5ba,
                            {
                                transparent: true,
                                opacity:
                                    random(
                                        0.1,
                                        0.5
                                    ),
                                depthWrite: false
                            }
                        ),
                        "Floating_Speck"
                    );

                object.position.set(
                    random(-35, 35),
                    random(0.5, 10),
                    random(-35, 35)
                );

                object.userData.phase =
                    random(
                        0,
                        Math.PI * 2
                    );

                specks.add(
                    object
                );
            }

            add(
                Details.particleGroup,
                specks
            );

            Details.specks =
                specks;

            return specks;
        };

    /* =========================================================
       MIST
    ========================================================= */

    Details.createAmbientMist =
        function createAmbientMist() {

            const mist =
                group("Ambient_Mist");

            for (
                let i = 0;
                i < 18;
                i++
            ) {

                const cloud =
                    mesh(
                        new THREE.SphereGeometry(
                            random(
                                0.8,
                                2.5
                            ),
                            12,
                            8
                        ),
                        new THREE.MeshBasicMaterial({
                            color: 0x7e7e78,
                            transparent: true,
                            opacity: random(
                                0.015,
                                0.045
                            ),
                            depthWrite: false
                        }),
                        "Mist_Cloud"
                    );

                cloud.position.set(
                    random(-30, 30),
                    random(
                        0.4,
                        4
                    ),
                    random(-30, 30)
                );

                cloud.scale.y =
                    random(
                        0.15,
                        0.4
                    );

                cloud.userData.phase =
                    random(
                        0,
                        Math.PI * 2
                    );

                mist.add(cloud);
            }

            add(
                Details.atmosphereGroup,
                mist
            );

            Details.mist =
                mist;

            return mist;
        };

    /* =========================================================
       PLAYER HANDS
    ========================================================= */

    Details.createPlayerHands =
        function createPlayerHands() {

            if (
                !Details.settings.hands
            ) {
                return null;
            }

            const hands =
                group("Player_Hands");

            hands.visible =
                false;

            const skinMaterial =
                mat(
                    Details.colors.skin,
                    {
                        roughness: 0.9,
                        metalness: 0
                    }
                );

            const skinDarkMaterial =
                mat(
                    Details.colors.skinDark,
                    {
                        roughness: 0.92
                    }
                );

            /*
             * RIGHT ARM
             */

            const rightArm =
                group("Right_Arm");

            const rightForearm =
                mesh(
                    new THREE.CapsuleGeometry(
                        0.115,
                        0.6,
                        8,
                        12
                    ),
                    skinMaterial,
                    "Right_Forearm"
                );

            rightForearm.rotation.z =
                -0.35;

            rightForearm.position.set(
                0.43,
                -0.53,
                -0.7
            );

            rightArm.add(
                rightForearm
            );

            const rightWrist =
                mesh(
                    new THREE.SphereGeometry(
                        0.125,
                        12,
                        10
                    ),
                    skinMaterial,
                    "Right_Wrist"
                );

            rightWrist.position.set(
                0.54,
                -0.73,
                -0.94
            );

            rightArm.add(
                rightWrist
            );

            /*
             * RIGHT HAND PALM
             */

            const rightPalm =
                mesh(
                    new THREE.BoxGeometry(
                        0.23,
                        0.3,
                        0.19
                    ),
                    skinMaterial,
                    "Right_Palm"
                );

            rightPalm.position.set(
                0.56,
                -0.86,
                -1.04
            );

            rightPalm.rotation.set(
                -0.18,
                0,
                -0.2
            );

            rightArm.add(
                rightPalm
            );

            /*
             * RIGHT FINGERS
             */

            const fingersRight =
                [];

            for (
                let i = 0;
                i < 4;
                i++
            ) {

                const finger =
                    mesh(
                        new THREE.CapsuleGeometry(
                            0.036,
                            0.14,
                            5,
                            8
                        ),
                        skinMaterial,
                        "Right_Finger"
                    );

                finger.position.set(
                    0.48 +
                        i * 0.05,
                    -0.93 -
                        Math.abs(
                            i - 1.5
                        ) * 0.008,
                    -1.13
                );

                finger.rotation.x =
                    -0.35;

                rightArm.add(
                    finger
                );

                fingersRight.push(
                    finger
                );
            }

            /*
             * RIGHT THUMB
             */

            const rightThumb =
                mesh(
                    new THREE.CapsuleGeometry(
                        0.045,
                        0.18,
                        5,
                        8
                    ),
                    skinMaterial,
                    "Right_Thumb"
                );

            rightThumb.position.set(
                0.4,
                -0.86,
                -1.12
            );

            rightThumb.rotation.z =
                -0.65;

            rightArm.add(
                rightThumb
            );

            /*
             * LEFT ARM
             */

            const leftArm =
                group("Left_Arm");

            const leftForearm =
                mesh(
                    new THREE.CapsuleGeometry(
                        0.115,
                        0.58,
                        8,
                        12
                    ),
                    skinMaterial,
                    "Left_Forearm"
                );

            leftForearm.rotation.z =
                0.35;

            leftForearm.position.set(
                -0.38,
                -0.57,
                -0.72
            );

            leftArm.add(
                leftForearm
            );

            const leftPalm =
                mesh(
                    new THREE.BoxGeometry(
                        0.23,
                        0.3,
                        0.19
                    ),
                    skinMaterial,
                    "Left_Palm"
                );

            leftPalm.position.set(
                -0.5,
                -0.88,
                -1.05
            );

            leftPalm.rotation.set(
                -0.18,
                0,
                0.2
            );

            leftArm.add(
                leftPalm
            );

            for (
                let i = 0;
                i < 4;
                i++
            ) {

                const finger =
                    mesh(
                        new THREE.CapsuleGeometry(
                            0.036,
                            0.14,
                            5,
                            8
                        ),
                        skinMaterial,
                        "Left_Finger"
                    );

                finger.position.set(
                    -0.57 -
                        i * 0.05,
                    -0.94,
                    -1.13
                );

                finger.rotation.x =
                    -0.35;

                leftArm.add(
                    finger
                );
            }

            const leftThumb =
                mesh(
                    new THREE.CapsuleGeometry(
                        0.045,
                        0.18,
                        5,
                        8
                    ),
                    skinMaterial,
                    "Left_Thumb"
                );

            leftThumb.position.set(
                -0.42,
                -0.88,
                -1.1
            );

            leftThumb.rotation.z =
                0.65;

            leftArm.add(
                leftThumb
            );

            /*
             * Slight sleeve/cuff areas for visual separation.
             */

            const rightCuff =
                mesh(
                    new THREE.CylinderGeometry(
                        0.13,
                        0.12,
                        0.11,
                        12
                    ),
                    skinDarkMaterial,
                    "Right_Cuff"
                );

            rightCuff.rotation.z =
                Math.PI / 2;

            rightCuff.position.set(
                0.47,
                -0.78,
                -0.98
            );

            rightArm.add(
                rightCuff
            );

            const leftCuff =
                rightCuff.clone();

            leftCuff.position.x =
                -0.44;

            leftArm.add(
                leftCuff
            );

            hands.add(
                rightArm
            );

            hands.add(
                leftArm
            );

            /*
             * Put hands into the camera.
             */

            if (Details.camera) {
                Details.camera.add(
                    hands
                );
            }

            Details.playerHands =
                hands;

            Details.rightHand =
                rightArm;

            Details.leftHand =
                leftArm;

            Details.handRestPosition =
                new THREE.Vector3(
                    0,
                    0,
                    0
                );

            return hands;
        };

    /* =========================================================
       FLASHLIGHT
       ========================================================= */

    Details.createFlashlight =
        function createFlashlight() {

            if (
                !Details.settings.flashlight
            ) {
                return null;
            }

            const flashlightGroup =
                group(
                    "Held_Flashlight"
                );

            flashlightGroup.visible =
                false;

            /*
             * MAIN BODY
             */

            const bodyMaterial =
                mat(
                    Details.colors.flashlightDark,
                    {
                        roughness: 0.38,
                        metalness: 0.82
                    }
                );

            const body =
                mesh(
                    new THREE.CylinderGeometry(
                        0.085,
                        0.095,
                        0.52,
                        18
                    ),
                    bodyMaterial,
                    "Flashlight_Body"
                );

            body.rotation.z =
                Math.PI / 2;

            body.position.x =
                0.03;

            flashlightGroup.add(
                body
            );

            /*
             * GRIP RIDGES
             */

            for (
                let i = 0;
                i < 7;
                i++
            ) {

                const ridge =
                    mesh(
                        new THREE.TorusGeometry(
                            0.092,
                            0.012,
                            6,
                            18
                        ),
                        mat(
                            Details.colors.black,
                            {
                                roughness: 0.8,
                                metalness: 0.5
                            }
                        ),
                        "Flashlight_Grip_Ridge"
                    );

                ridge.rotation.y =
                    Math.PI / 2;

                ridge.position.x =
                    -0.15 +
                    i * 0.055;

                flashlightGroup.add(
                    ridge
                );
            }

            /*
             * HEAD
             */

            const head =
                mesh(
                    new THREE.CylinderGeometry(
                        0.145,
                        0.115,
                        0.17,
                        20
                    ),
                    bodyMaterial,
                    "Flashlight_Head"
                );

            head.rotation.z =
                Math.PI / 2;

            head.position.x =
                0.34;

            flashlightGroup.add(
                head
            );

            /*
             * HEAD RING
             */

            const ring =
                mesh(
                    new THREE.TorusGeometry(
                        0.144,
                        0.018,
                        8,
                        20
                    ),
                    mat(
                        0x777777,
                        {
                            roughness: 0.42,
                            metalness: 0.9
                        }
                    ),
                    "Flashlight_Head_Ring"
                );

            ring.rotation.y =
                Math.PI / 2;

            ring.position.x =
                0.425;

            flashlightGroup.add(
                ring
            );

            /*
             * LENS
             */

            const lensMaterial =
                new THREE.MeshStandardMaterial({
                    color:
                        Details.colors.flashlightLens,
                    emissive:
                        Details.colors.flashlightLens,
                    emissiveIntensity:
                        3.5,
                    roughness: 0.18,
                    metalness: 0,
                    transparent: true,
                    opacity: 0.95
                });

            const lens =
                mesh(
                    new THREE.CylinderGeometry(
                        0.1,
                        0.1,
                        0.035,
                        20
                    ),
                    lensMaterial,
                    "Flashlight_Lens"
                );

            lens.rotation.z =
                Math.PI / 2;

            lens.position.x =
                0.465;

            flashlightGroup.add(
                lens
            );

            /*
             * INNER REFLECTOR
             */

            const reflector =
                mesh(
                    new THREE.CylinderGeometry(
                        0.075,
                        0.02,
                        0.04,
                        20,
                        1,
                        false
                    ),
                    mat(
                        0xdddddd,
                        {
                            roughness: 0.25,
                            metalness: 0.35
                        }
                    ),
                    "Flashlight_Reflector"
                );

            reflector.rotation.z =
                Math.PI / 2;

            reflector.position.x =
                0.445;

            flashlightGroup.add(
                reflector
            );

            /*
             * LED
             */

            const led =
                mesh(
                    new THREE.SphereGeometry(
                        0.035,
                        10,
                        10
                    ),
                    mat(
                        0xf4f6ff,
                        {
                            emissive:
                                0xf4f6ff,
                            emissiveIntensity:
                                7
                        }
                    ),
                    "Flashlight_LED"
                );

            led.position.x =
                0.467;

            flashlightGroup.add(
                led
            );

            /*
             * TOP SWITCH
             */

            const button =
                mesh(
                    new THREE.BoxGeometry(
                        0.09,
                        0.045,
                        0.08
                    ),
                    mat(
                        0x161616,
                        {
                            roughness: 0.32,
                            metalness: 0.5
                        }
                    ),
                    "Flashlight_Switch"
                );

            button.position.set(
                0.02,
                0.1,
                0
            );

            flashlightGroup.add(
                button
            );

            /*
             * REAR CAP
             */

            const rear =
                mesh(
                    new THREE.CylinderGeometry(
                        0.083,
                        0.092,
                        0.08,
                        18
                    ),
                    bodyMaterial,
                    "Flashlight_Rear"
                );

            rear.rotation.z =
                Math.PI / 2;

            rear.position.x =
                -0.27;

            flashlightGroup.add(
                rear
            );

            /*
             * SMALL REAR RING
             */

            const rearRing =
                mesh(
                    new THREE.TorusGeometry(
                        0.087,
                        0.012,
                        6,
                        18
                    ),
                    mat(
                        0x666666,
                        {
                            roughness: 0.45,
                            metalness: 0.85
                        }
                    ),
                    "Flashlight_Rear_Ring"
                );

            rearRing.rotation.y =
                Math.PI / 2;

            rearRing.position.x =
                -0.31;

            flashlightGroup.add(
                rearRing
            );

            /*
             * BEAM
             */

            const target =
                new THREE.Object3D();

            target.position.set(
                0,
                -0.02,
                -14
            );

            flashlightGroup.add(
                target
            );

            const beam =
                new THREE.SpotLight(
                    0xf1f3ff,
                    7.5,
                    28,
                    Math.PI / 7,
                    0.48,
                    1.2
                );

            beam.position.set(
                0.47,
                0,
                0
            );

            beam.target =
                target;

            if (
                Details.settings.shadows
            ) {
                beam.castShadow =
                    true;

                beam.shadow.mapSize.width =
                    1024;

                beam.shadow.mapSize.height =
                    1024;

                beam.shadow.bias =
                    -0.0003;
            }

            flashlightGroup.add(
                beam
            );

            /*
             * EXTRA SOFT GLOW
             */

            const glow =
                new THREE.PointLight(
                    0xdce8ff,
                    0.9,
                    3.5
                );

            glow.position.set(
                0.45,
                0,
                0
            );

            flashlightGroup.add(
                glow
            );

            /*
             * LIGHT SHAFT MESH
             *
             * Very subtle translucent cone.
             */

            const shaft =
                new THREE.Mesh(
                    new THREE.ConeGeometry(
                        1.25,
                        8,
                        20,
                        1,
                        true
                    ),
                    new THREE.MeshBasicMaterial({
                        color: 0xdbe6ff,
                        transparent: true,
                        opacity: 0.015,
                        depthWrite: false,
                        side:
                            THREE.DoubleSide
                    })
                );

            shaft.rotation.x =
                -Math.PI / 2;

            shaft.position.set(
                0.47,
                0,
                -4
            );

            flashlightGroup.add(
                shaft
            );

            /*
             * SAVE REFERENCES
             */

            Details.flashlight =
                flashlightGroup;

            Details.flashlightGroup =
                flashlightGroup;

            Details.flashlightBody =
                body;

            Details.flashlightHead =
                head;

            Details.flashlightLens =
                lens;

            Details.flashlightSwitch =
                button;

            Details.flashlightBeam =
                beam;

            Details.flashlightGlow =
                glow;

            Details.flashlightShaft =
                shaft;

            Details.flashlightTarget =
                target;

            /*
             * Attach flashlight to RIGHT HAND.
             */

            if (
                Details.rightHand
            ) {

                Details.rightHand.add(
                    flashlightGroup
                );

            } else if (
                Details.camera
            ) {

                Details.camera.add(
                    flashlightGroup
                );
            }

            /*
             * Position inside hand.
             */

            flashlightGroup.position.set(
                0.15,
                -0.02,
                -0.02
            );

            flashlightGroup.rotation.set(
                -0.14,
                0.08,
                -0.18
            );

            Details.flashlightRest =
                flashlightGroup.position.clone();

            Details.flashlightRotation =
                flashlightGroup.rotation.clone();

            return flashlightGroup;
        };

    /* =========================================================
       SHOW FLASHLIGHT
       ========================================================= */

    Details.showFlashlight =
        function showFlashlight() {

            if (
                !Details.flashlightGroup
            ) {
                Details.createFlashlight();
            }

            if (
                !Details.flashlightGroup
            ) {
                return false;
            }

            Details.flashlightVisible =
                true;

            Details.flashlightGroup.visible =
                true;

            if (
                Details.playerHands
            ) {
                Details.playerHands.visible =
                    true;
            }

            Details.setFlashlightPower(
                Details.flashlightOn
            );

            return true;
        };

    /* =========================================================
       HIDE FLASHLIGHT
    ========================================================= */

    Details.hideFlashlight =
        function hideFlashlight() {

            if (
                Details.flashlightGroup
            ) {
                Details.flashlightGroup.visible =
                    false;
            }

            if (
                Details.playerHands
            ) {
                Details.playerHands.visible =
                    false;
            }

            Details.flashlightVisible =
                false;

            return true;
        };

    /* =========================================================
       FLASHLIGHT POWER
    ========================================================= */

    Details.toggleFlashlight =
        function toggleFlashlight() {

            Details.flashlightOn =
                !Details.flashlightOn;

            Details.setFlashlightPower(
                Details.flashlightOn
            );

            Details.updateFlashlightHUD();

            return Details.flashlightOn;
        };

    Details.setFlashlightPower =
        function setFlashlightPower(
            enabled
        ) {

            Details.flashlightOn =
                Boolean(enabled);

            const power =
                Details.flashlightOn
                    ? 7.5
                    : 0;

            if (
                Details.flashlightBeam
            ) {
                Details.flashlightBeam.intensity =
                    power;
            }

            if (
                Details.flashlightGlow
            ) {
                Details.flashlightGlow.intensity =
                    Details.flashlightOn
                        ? 0.9
                        : 0;
            }

            if (
                Details.flashlightLens
            ) {

                if (
                    Details.flashlightLens.material
                ) {

                    Details.flashlightLens.material.emissiveIntensity =
                        Details.flashlightOn
                            ? 3.5
                            : 0.12;
                }
            }

            if (
                Details.flashlightSwitch
            ) {

                Details.flashlightSwitch.position.y =
                    Details.flashlightOn
                        ? 0.1
                        : 0.085;
            }

            return Details.flashlightOn;
        };

    /* =========================================================
       FLASHLIGHT HAND ANIMATION
    ========================================================= */

    Details.animateFlashlightHands =
        function animateFlashlightHands(
            delta,
            elapsed
        ) {

            if (
                !Details.playerHands ||
                !Details.flashlightVisible
            ) {
                return;
            }

            /*
             * Small breathing / walking motion.
             */

            const walking =
                Details.player &&
                Details.player.userData
                    ? Details.player.userData
                        .moving === true
                    : false;

            const bob =
                walking
                    ? Math.sin(
                        elapsed * 8
                    ) * 0.018
                    : Math.sin(
                        elapsed * 2
                    ) * 0.004;

            Details.playerHands.position.y =
                bob;

            Details.playerHands.rotation.z =
                Math.sin(
                    elapsed * (
                        walking
                            ? 4
                            : 1.5
                    )
                ) * (
                    walking
                        ? 0.012
                        : 0.004
                );

            if (
                Details.flashlightGroup
            ) {

                Details.flashlightGroup.rotation.x =
                    Details.flashlightRotation.x +
                    Math.sin(
                        elapsed * 3
                    ) * 0.008;

                Details.flashlightGroup.position.y =
                    Details.flashlightRest.y +
                    bob;
            }

            if (
                Details.rightHand
            ) {

                Details.rightHand.rotation.x =
                    walking
                        ? Math.sin(
                            elapsed * 8
                        ) * 0.025
                        : 0;
            }
        };

    /* =========================================================
       FLASHLIGHT HUD
    ========================================================= */

    Details.create2DLayer =
        function create2DLayer() {

            if (
                !Details.settings.twoDDetails
            ) {
                return;
            }

            let hud =
                document.querySelector(
                    "#detailsHUD"
                );

            if (!hud) {

                hud =
                    document.createElement(
                        "div"
                    );

                hud.id =
                    "detailsHUD";

                hud.style.position =
                    "fixed";

                hud.style.inset =
                    "0";

                hud.style.pointerEvents =
                    "none";

                hud.style.zIndex =
                    "2000";

                document.body.appendChild(
                    hud
                );
            }

            Details.canvasOverlay =
                hud;

            Details.createFlashlightHUD();
        };

    Details.createFlashlightHUD =
        function createFlashlightHUD() {

            const old =
                document.querySelector(
                    "#detailsFlashlightSlot"
                );

            if (old) {
                old.remove();
            }

            const slot =
                document.createElement(
                    "div"
                );

            slot.id =
                "detailsFlashlightSlot";

            slot.setAttribute(
                "aria-label",
                "Flashlight"
            );

            slot.style.position =
                "absolute";

            slot.style.left =
                "24px";

            slot.style.bottom =
                "24px";

            slot.style.width =
                "74px";

            slot.style.height =
                "74px";

            slot.style.border =
                "1px solid rgba(255,255,255,.2)";

            slot.style.borderRadius =
                "12px";

            slot.style.background =
                "rgba(8,8,8,.78)";

            slot.style.boxShadow =
                "0 10px 30px rgba(0,0,0,.4)";

            slot.style.display =
                "flex";

            slot.style.alignItems =
                "center";

            slot.style.justifyContent =
                "center";

            slot.style.pointerEvents =
                "auto";

            slot.style.cursor =
                "pointer";

            slot.style.userSelect =
                "none";

            slot.style.transition =
                "transform .12s ease, border-color .12s ease, background .12s ease";

            const icon =
                document.createElement(
                    "div"
                );

            icon.textContent =
                "▣";

            icon.style.fontSize =
                "31px";

            icon.style.lineHeight =
                "1";

            icon.style.color =
                "#e5e5e5";

            icon.style.transform =
                "rotate(90deg)";

            icon.style.filter =
                "drop-shadow(0 0 8px rgba(255,255,255,.15))";

            slot.appendChild(
                icon
            );

            const number =
                document.createElement(
                    "span"
                );

            number.textContent =
                "1";

            number.style.position =
                "absolute";

            number.style.left =
                "7px";

            number.style.top =
                "5px";

            number.style.font =
                "700 12px system-ui";

            number.style.color =
                "#bdbdbd";

            slot.appendChild(
                number
            );

            const status =
                document.createElement(
                    "div"
                );

            status.id =
                "detailsFlashlightStatus";

            status.style.position =
                "absolute";

            status.style.right =
                "7px";

            status.style.bottom =
                "5px";

            status.style.width =
                "7px";

            status.style.height =
                "7px";

            status.style.borderRadius =
                "50%";

            status.style.background =
                "#e8e8e8";

            status.style.boxShadow =
                "0 0 8px rgba(255,255,255,.7)";

            slot.appendChild(
                status
            );

            slot.addEventListener(
                "mouseenter",
                () => {

                    slot.style.transform =
                        "translateY(-2px)";

                    slot.style.borderColor =
                        "rgba(255,255,255,.55)";
                }
            );

            slot.addEventListener(
                "mouseleave",
                () => {

                    slot.style.transform =
                        "translateY(0)";

                    Details.updateFlashlightHUD();
                }
            );

            slot.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    Details.selectFlashlightSlot();
                }
            );

            if (
                !document.querySelector(
                    "#detailsHUD"
                )
            ) {

                Details.create2DLayer();
                return;
            }

            Details.canvasOverlay.appendChild(
                slot
            );

            Details.flashlightSlot =
                slot;

            Details.flashlightIcon =
                icon;

            Details.updateFlashlightHUD();

            return slot;
        };

    /* =========================================================
       FIRST-SLOT INTERACTION
       ========================================================= */

    Details.selectFlashlightSlot =
        function selectFlashlightSlot() {

            /*
             * This is the main behavior the user requested:
             * clicking the flashlight icon/first inventory slot
             * makes the 3D flashlight appear in the hand.
             */

            Details.showFlashlight();

            /*
             * Tell game.js / main.js.
             */

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "seeker:flashlight-selected",
                        {
                            detail: {
                                slot: 1,
                                visible: true,
                                on:
                                    Details.flashlightOn
                            }
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "[details.js] Flashlight event failed.",
                    error
                );
            }

            Details.updateFlashlightHUD();

            return true;
        };

    Details.updateFlashlightHUD =
        function updateFlashlightHUD() {

            if (
                !Details.flashlightSlot
            ) {
                return;
            }

            if (
                Details.flashlightVisible
            ) {

                Details.flashlightSlot.style.borderColor =
                    Details.flashlightOn
                        ? "rgba(255,255,255,.75)"
                        : "rgba(255,255,255,.3)";

                Details.flashlightSlot.style.background =
                    Details.flashlightOn
                        ? "rgba(22,22,22,.92)"
                        : "rgba(8,8,8,.78)";

            } else {

                Details.flashlightSlot.style.borderColor =
                    "rgba(255,255,255,.2)";
            }

            if (
                Details.flashlightStatus
            ) {

                Details.flashlightStatus.style.opacity =
                    Details.flashlightOn
                        ? "1"
                        : "0.35";
            }
        };

    /* =========================================================
       KEYBOARD INPUT
    ========================================================= */

    Details.attachInput =
        function attachInput() {

            window.addEventListener(
                "keydown",
                event => {

                    /*
                     * Number 1 selects flashlight.
                     */

                    if (
                        event.code === "Digit1" ||
                        event.code === "Numpad1"
                    ) {

                        Details.selectFlashlightSlot();
                    }

                    /*
                     * F toggles flashlight.
                     */

                    if (
                        event.code === "KeyF"
                    ) {

                        if (
                            !Details.flashlightVisible
                        ) {
                            Details.selectFlashlightSlot();
                        } else {
                            Details.toggleFlashlight();
                        }
                    }
                },
                {
                    passive: true
                }
            );
        };

    /* =========================================================
       PLAYER CAMERA DETAILS
    ========================================================= */

    Details.updateCameraDetails =
        function updateCameraDetails(
            delta
        ) {

            if (
                !Details.camera
            ) {
                return;
            }

            const speed =
                Details.player &&
                Details.player.userData
                    ? Number(
                        Details.player.userData.speed ||
                        0
                    )
                    : 0;

            const moving =
                speed > 0.1;

            if (moving) {

                const bob =
                    Math.sin(
                        Details.elapsed *
                        8
                    ) *
                    0.004;

                Details.camera.position.y +=
                    bob * delta * 12;
            }
        };

    /* =========================================================
       SEEKER PROXIMITY LIGHTING
    ========================================================= */

    Details.setSeekerThreat =
        function setSeekerThreat(
            amount
        ) {

            amount =
                clamp(
                    amount,
                    0,
                    1
                );

            Details.threatAmount =
                amount;

            if (
                Details.scene &&
                Details.scene.fog
            ) {

                Details.scene.fog.density =
                    0.009 +
                    amount * 0.016;
            }

            if (
                Details.flashlightBeam
            ) {

                /*
                 * Flashlight becomes slightly unstable
                 * when danger is very high.
                 */

                const shake =
                    amount * 0.03;

                Details.flashlightBeam.angle =
                    Math.PI / 7 +
                    Math.sin(
                        Details.elapsed * 17
                    ) * shake;
            }

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "seeker:threat-level",
                        {
                            detail: {
                                amount
                            }
                        }
                    )
                );

            } catch (error) {
                /* ignored */
            }
        };

    /* =========================================================
       CAMERA SHAKE
    ========================================================= */

    Details.cameraShake =
        function cameraShake(
            strength = 0.08,
            duration = 0.25
        ) {

            Details.shake =
                {
                    strength,
                    duration,
                    time: duration
                };
        };

    Details.updateCameraShake =
        function updateCameraShake(
            delta
        ) {

            if (
                !Details.shake ||
                !Details.camera
            ) {
                return;
            }

            Details.shake.time -=
                delta;

            if (
                Details.shake.time <= 0
            ) {

                Details.shake =
                    null;

                return;
            }

            const ratio =
                Details.shake.time /
                Details.shake.duration;

            const amount =
                Details.shake.strength *
                ratio;

            Details.camera.rotation.x +=
                random(
                    -amount,
                    amount
                );

            Details.camera.rotation.y +=
                random(
                    -amount,
                    amount
                );
        };

    /* =========================================================
       LARGE ENVIRONMENT GENERATOR
    ========================================================= */

    Details.populateLargeEnvironment =
        function populateLargeEnvironment(
            options = {}
        ) {

            const width =
                options.width || 60;

            const depth =
                options.depth || 60;

            /*
             * Huge architecture.
             */

            Details.createFloor(
                width,
                depth
            );

            Details.createCeiling(
                width,
                depth
            );

            Details.createWall(
                width,
                10,
                0.5,
                0,
                5,
                -depth / 2,
                {
                    cracks: true,
                    name:
                        "North_Wall"
                }
            );

            Details.createWall(
                width,
                10,
                0.5,
                0,
                5,
                depth / 2,
                {
                    cracks: true,
                    name:
                        "South_Wall"
                }
            );

            Details.createWall(
                0.5,
                10,
                depth,
                -width / 2,
                5,
                0,
                {
                    cracks: true,
                    name:
                        "West_Wall"
                }
            );

            Details.createWall(
                0.5,
                10,
                depth,
                width / 2,
                5,
                0,
                {
                    cracks: true,
                    name:
                        "East_Wall"
                }
            );

            /*
             * Pillars.
             */

            for (
                let x = -width / 2 + 7;
                x <= width / 2 - 7;
                x += 14
            ) {

                for (
                    let z = -depth / 2 + 7;
                    z <= depth / 2 - 7;
                    z += 14
                ) {

                    Details.createPillar(
                        9,
                        0.45,
                        x,
                        0,
                        z
                    );
                }
            }

            /*
             * Pipe runs.
             */

            Details.createPipeNetwork({
                x: 0,
                y: 7.7,
                z:
                    -depth / 2 +
                    1.2,
                length:
                    width - 4
            });

            Details.createPipeNetwork({
                x: 0,
                y: 7.1,
                z:
                    depth / 2 -
                    1.2,
                length:
                    width - 4
            });

            /*
             * Ceiling lights.
             */

            for (
                let x = -width / 2 + 5;
                x <= width / 2 - 5;
                x += 10
            ) {

                for (
                    let z = -depth / 2 + 5;
                    z <= depth / 2 - 5;
                    z += 10
                ) {

                    Details.createRoomLight(
                        x,
                        9.35,
                        z,
                        {
                            intensity:
                                random(
                                    0.35,
                                    1.4
                                ),
                            distance: 11
                        }
                    );
                }
            }

            /*
             * Vents.
             */

            Details.createVent(
                -10,
                6,
                -depth / 2 +
                    0.27,
                2.2,
                1.3
            );

            Details.createVent(
                11,
                5.5,
                depth / 2 -
                    0.27,
                2,
                1.2
            );

            /*
             * Large machinery.
             */

            Details.createLargeGenerator(
                8,
                0,
                -9
            );

            Details.createLargeGenerator(
                -13,
                0,
                12
            );

            /*
             * Furniture.
             */

            for (
                let i = 0;
                i < 8;
                i++
            ) {

                Details.createTable(
                    random(
                        -width / 2 + 5,
                        width / 2 - 5
                    ),
                    0,
                    random(
                        -depth / 2 + 5,
                        depth / 2 - 5
                    )
                );
            }

            for (
                let i = 0;
                i < 14;
                i++
            ) {

                Details.createChair(
                    random(
                        -width / 2 + 3,
                        width / 2 - 3
                    ),
                    0,
                    random(
                        -depth / 2 + 3,
                        depth / 2 - 3
                    )
                );
            }

            /*
             * Barrels.
             */

            for (
                let i = 0;
                i < 18;
                i++
            ) {

                Details.createBarrel(
                    random(
                        -width / 2 + 3,
                        width / 2 - 3
                    ),
                    0,
                    random(
                        -depth / 2 + 3,
                        depth / 2 - 3
                    )
                );
            }

            /*
             * Shelves.
             */

            for (
                let i = 0;
                i < 10;
                i++
            ) {

                Details.createShelf(
                    random(
                        -width / 2 + 3,
                        width / 2 - 3
                    ),
                    0,
                    random(
                        -depth / 2 + 3,
                        depth / 2 - 3
                    ),
                    random(
                        2,
                        4
                    )
                );
            }

            /*
             * Debris.
             */

            for (
                let i = 0;
                i < 18;
                i++
            ) {

                Details.createDebrisPile(
                    random(
                        -width / 2,
                        width / 2
                    ),
                    0,
                    random(
                        -depth / 2,
                        depth / 2
                    ),
                    random(
                        0.5,
                        2.0
                    )
                );
            }

            return Details.worldGroup;
        };

    /* =========================================================
       SMALL DETAIL PASS
    ========================================================= */

    Details.populateTinyDetails =
        function populateTinyDetails(
            options = {}
        ) {

            const width =
                options.width || 60;

            const depth =
                options.depth || 60;

            /*
             * Tiny pieces of debris everywhere.
             */

            for (
                let i = 0;
                i < 450;
                i++
            ) {

                const prop =
                    Details.createRandomProp();

                prop.position.set(
                    random(
                        -width / 2,
                        width / 2
                    ),
                    random(
                        0.03,
                        0.12
                    ),
                    random(
                        -depth / 2,
                        depth / 2
                    )
                );

                prop.scale.multiplyScalar(
                    random(
                        0.25,
                        0.7
                    )
                );

                randomizeRotation(
                    prop,
                    1.8
                );

                Details.tinyDetailGroup.add(
                    prop
                );
            }

            /*
             * Hanging wires.
             */

            for (
                let i = 0;
                i < 80;
                i++
            ) {

                const x =
                    random(
                        -width / 2 + 1,
                        width / 2 - 1
                    );

                const z =
                    random(
                        -depth / 2 + 1,
                        depth / 2 - 1
                    );

                Details.createCable(
                    new THREE.Vector3(
                        x,
                        8.7,
                        z
                    ),
                    new THREE.Vector3(
                        x +
                            random(
                                -1.6,
                                1.6
                            ),
                        random(
                            6.5,
                            8.2
                        ),
                        z +
                            random(
                                -1.2,
                                1.2
                            )
                    ),
                    random(
                        0.15,
                        0.7
                    ),
                    random(
                        0.012,
                        0.035
                    )
                );
            }

            return true;
        };

    /* =========================================================
       2D VIGNETTE / HORROR OVERLAY
    ========================================================= */

    Details.createHorrorOverlay =
        function createHorrorOverlay() {

            if (
                !Details.canvasOverlay
            ) {
                return null;
            }

            let overlay =
                document.querySelector(
                    "#detailsHorrorOverlay"
                );

            if (overlay) {
                return overlay;
            }

            overlay =
                document.createElement(
                    "div"
                );

            overlay.id =
                "detailsHorrorOverlay";

            overlay.style.position =
                "absolute";

            overlay.style.inset =
                "0";

            overlay.style.pointerEvents =
                "none";

            overlay.style.background =
                "radial-gradient(circle, transparent 38%, rgba(0,0,0,.52) 100%)";

            overlay.style.opacity =
                "0.7";

            overlay.style.mixBlendMode =
                "multiply";

            Details.canvasOverlay.appendChild(
                overlay
            );

            Details.horrorOverlay =
                overlay;

            return overlay;
        };

    /* =========================================================
       LOW LIGHT EFFECT
    ========================================================= */

    Details.createScreenDarkness =
        function createScreenDarkness() {

            if (
                !Details.canvasOverlay
            ) {
                return null;
            }

            let darkness =
                document.querySelector(
                    "#detailsScreenDarkness"
                );

            if (darkness) {
                return darkness;
            }

            darkness =
                document.createElement(
                    "div"
                );

            darkness.id =
                "detailsScreenDarkness";

            darkness.style.position =
                "absolute";

            darkness.style.inset =
                "0";

            darkness.style.pointerEvents =
                "none";

            darkness.style.background =
                "rgba(0,0,0,0.25)";

            darkness.style.opacity =
                "0";

            darkness.style.transition =
                "opacity .12s linear";

            Details.canvasOverlay.appendChild(
                darkness
            );

            Details.screenDarkness =
                darkness;

            return darkness;
        };

    /* =========================================================
       BUILD EVERYTHING
    ========================================================= */

    Details.build =
        function build(options = {}) {

            if (
                options.scene ||
                options.camera ||
                options.renderer ||
                options.player
            ) {

                Details.scene =
                    options.scene ||
                    Details.scene;

                Details.camera =
                    options.camera ||
                    Details.camera;

                Details.renderer =
                    options.renderer ||
                    Details.renderer;

                Details.player =
                    options.player ||
                    Details.player;

                if (
                    !Details.worldGroup
                ) {
                    Details.init(
                        options
                    );
                }
            }

            if (
                !Details.worldGroup
            ) {
                Details.init(
                    options
                );
            }

            Details.createHorrorOverlay();
            Details.createScreenDarkness();

            if (
                options.populate !== false
            ) {

                Details.populateLargeEnvironment(
                    {
                        width:
                            options.width ||
                            60,
                        depth:
                            options.depth ||
                            60
                    }
                );

                if (
                    Details.settings.tinyDetails
                ) {

                    Details.populateTinyDetails(
                        {
                            width:
                                options.width ||
                                60,
                            depth:
                                options.depth ||
                                60
                        }
                    );
                }
            }

            /*
             * Do not automatically show flashlight here.
             * It appears when first slot is clicked.
             */

            return Details.worldGroup;
        };

    /* =========================================================
       UPDATE
    ========================================================= */

    Details.update =
        function update(
            delta = 0.016,
            elapsed = null
        ) {

            if (!Details.enabled) {
                return;
            }

            if (
                elapsed === null
            ) {

                Details.elapsed +=
                    delta;

            } else {

                Details.elapsed =
                    elapsed;
            }

            /*
             * Dust.
             */

            if (
                Details.dust
            ) {

                const position =
                    Details.dust.geometry
                        .attributes
                        .position;

                const velocities =
                    Details.dust.userData
                        .velocities;

                for (
                    let i = 0;
                    i < position.count;
                    i++
                ) {

                    let x =
                        position.getX(i);

                    let y =
                        position.getY(i);

                    let z =
                        position.getZ(i);

                    x +=
                        velocities[
                            i * 3
                        ] *
                        delta *
                        60;

                    y +=
                        velocities[
                            i * 3 + 1
                        ] *
                        delta *
                        60;

                    z +=
                        velocities[
                            i * 3 + 2
                        ] *
                        delta *
                        60;

                    if (y > 12) {
                        y = 0.2;
                    }

                    if (x > 80) {
                        x = -80;
                    }

                    if (x < -80) {
                        x = 80;
                    }

                    if (z > 80) {
                        z = -80;
                    }

                    if (z < -80) {
                        z = 80;
                    }

                    position.setXYZ(
                        i,
                        x,
                        y,
                        z
                    );
                }

                position.needsUpdate =
                    true;
            }

            /*
             * Floating specks.
             */

            if (
                Details.specks
            ) {

                Details.specks.children
                    .forEach(
                        speck => {

                            speck.position.y +=
                                Math.sin(
                                    Details.elapsed +
                                    speck.userData
                                        .phase
                                ) *
                                delta *
                                0.035;

                            speck.rotation.z +=
                                delta *
                                0.15;
                        }
                    );
            }

            /*
             * Mist animation.
             */

            if (
                Details.mist
            ) {

                Details.mist.children
                    .forEach(
                        cloud => {

                            cloud.position.x +=
                                Math.sin(
                                    Details.elapsed * 0.3 +
                                    cloud.userData.phase
                                ) *
                                delta *
                                0.05;

                            cloud.scale.x =
                                1 +
                                Math.sin(
                                    Details.elapsed * 0.4 +
                                    cloud.userData.phase
                                ) *
                                0.08;
                        }
                    );
            }

            /*
             * Warning lights.
             */

            if (
                Details.lightingGroup
            ) {

                Details.lightingGroup
                    .traverse(
                        object => {

                            if (
                                object.userData &&
                                object.userData
                                    .warningLight
                            ) {

                                const phase =
                                    object.userData
                                        .warningTime ||
                                    0;

                                const pulse =
                                    (
                                        Math.sin(
                                            Details.elapsed *
                                            8 +
                                            phase
                                        ) +
                                        1
                                    ) /
                                    2;

                                object.material
                                    .emissiveIntensity =
                                    0.5 +
                                    pulse *
                                    2.8;

                                object.userData
                                    .warningLight
                                    .intensity =
                                    0.15 +
                                    pulse *
                                    1.3;
                            }
                        }
                    );
            }

            /*
             * Held flashlight/hands.
             */

            Details.animateFlashlightHands(
                delta,
                Details.elapsed
            );

            /*
             * Camera.
             */

            Details.updateCameraDetails(
                delta
            );

            Details.updateCameraShake(
                delta
            );

            /*
             * Screen darkness.
             */

            if (
                Details.screenDarkness
            ) {

                const darkness =
                    Details.flashlightVisible &&
                    Details.flashlightOn
                        ? 0
                        : 0.12;

                Details.screenDarkness.style.opacity =
                    String(darkness);
            }
        };

    /* =========================================================
       CONNECT TO COMMON GAME LOOPS
    ========================================================= */

    Details.autoConnect =
        function autoConnect() {

            /*
             * Existing game loops can call:
             *
             * SeekerDetails.update(delta, elapsed);
             *
             * This fallback keeps particles moving even if
             * a project forgets to call update().
             */

            if (
                Details._autoLoop
            ) {
                return;
            }

            Details._autoLoop =
                true;

            let last =
                performance.now();

            function loop(now) {

                if (
                    !Details._autoLoop
                ) {
                    return;
                }

                const delta =
                    Math.min(
                        0.05,
                        (
                            now -
                            last
                        ) / 1000
                    );

                last =
                    now;

                Details.update(
                    delta
                );

                requestAnimationFrame(
                    loop
                );
            }

            requestAnimationFrame(
                loop
            );
        };

    Details.stopAutoConnect =
        function stopAutoConnect() {

            Details._autoLoop =
                false;
        };

    /* =========================================================
       EVENT BRIDGE
    ========================================================= */

    window.addEventListener(
        "seeker:player-ready",
        event => {

            const data =
                event.detail || {};

            if (
                data.camera
            ) {
                Details.camera =
                    data.camera;
            }

            if (
                data.player
            ) {
                Details.player =
                    data.player;
            }

            if (
                Details.camera &&
                !Details.playerHands
            ) {
                Details.createPlayerHands();
            }

            if (
                Details.camera &&
                !Details.flashlightGroup
            ) {
                Details.createFlashlight();
            }
        }
    );

    window.addEventListener(
        "seeker:scene-ready",
        event => {

            const data =
                event.detail || {};

            if (
                data.scene
            ) {
                Details.scene =
                    data.scene;
            }

            if (
                data.camera
            ) {
                Details.camera =
                    data.camera;
            }

            if (
                !Details.worldGroup
            ) {
                Details.init(
                    data
                );
            }
        }
    );

    window.addEventListener(
        "seeker:show-flashlight",
        () => {

            Details.showFlashlight();
        }
    );

    window.addEventListener(
        "seeker:hide-flashlight",
        () => {

            Details.hideFlashlight();
        }
    );

    window.addEventListener(
        "seeker:toggle-flashlight",
        () => {

            if (
                !Details.flashlightVisible
            ) {
                Details.showFlashlight();
            } else {
                Details.toggleFlashlight();
            }
        }
    );

    /* =========================================================
       PUBLIC METHODS FOR game.js
    ========================================================= */

    Details.getFlashlight =
        function getFlashlight() {
            return Details.flashlightGroup;
        };

    Details.getPlayerHands =
        function getPlayerHands() {
            return Details.playerHands;
        };

    Details.isFlashlightVisible =
        function isFlashlightVisible() {
            return Boolean(
                Details.flashlightVisible
            );
        };

    Details.isFlashlightOn =
        function isFlashlightOn() {
            return Boolean(
                Details.flashlightOn
            );
        };

    Details.setPlayer =
        function setPlayer(
            player,
            camera
        ) {

            Details.player =
                player ||
                Details.player;

            Details.camera =
                camera ||
                Details.camera;

            if (
                Details.camera &&
                !Details.playerHands
            ) {
                Details.createPlayerHands();
            }

            if (
                Details.camera &&
                !Details.flashlightGroup
            ) {
                Details.createFlashlight();
            }

            return true;
        };

    Details.clearWorld =
        function clearWorld() {

            if (
                Details.worldGroup
            ) {

                while (
                    Details.worldGroup.children
                        .length
                ) {

                    const child =
                        Details.worldGroup
                            .children[0];

                    Details.worldGroup
                        .remove(child);

                    disposeObject(
                        child
                    );
                }
            }

            return true;
        };

    /* =========================================================
       MOBILE TOUCH SUPPORT
    ========================================================= */

    Details.enableMobileFlashlight =
        function enableMobileFlashlight() {

            if (
                !Details.flashlightSlot
            ) {
                return;
            }

            Details.flashlightSlot
                .addEventListener(
                    "touchstart",
                    event => {

                        event.preventDefault();

                        if (
                            !Details.flashlightVisible
                        ) {

                            Details.selectFlashlightSlot();

                        } else {

                            Details.toggleFlashlight();
                        }
                    },
                    {
                        passive: false
                    }
                );
        };

    /* =========================================================
       STARTUP
    ========================================================= */

    window.SeekerDetails =
        Details;

    window.Details =
        Details;

    /*
     * If the game already created its scene/camera before this
     * file loaded, use them automatically.
     */

    const autoScene =
        window.scene ||
        window.gameScene ||
        null;

    const autoCamera =
        window.camera ||
        window.gameCamera ||
        null;

    const autoRenderer =
        window.renderer ||
        null;

    const autoPlayer =
        window.player ||
        window.playerObject ||
        null;

    if (
        autoScene ||
        autoCamera ||
        autoPlayer
    ) {

        Details.init({
            scene:
                autoScene,
            camera:
                autoCamera,
            renderer:
                autoRenderer,
            player:
                autoPlayer
        });

    } else {

        /*
         * Still create the 2D UI so the first slot exists.
         * The actual 3D flashlight waits until a camera/player
         * becomes available.
         */

        Details.init({
            scene: null,
            camera: null,
            renderer: null,
            player: null
        });
    }

    /*
     * The slot can be clicked immediately.
     * Once game.js provides a camera, the flashlight appears
     * in the player's hand.
     */

    Details.enableMobileFlashlight();

    console.log(
        "%cTHE SEEKER%c details.js loaded — 100X DETAIL SYSTEM READY",
        "font-weight:900;color:#c9a227;",
        "color:inherit;"
    );

})();