/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   details.js
   Player details / hands / flashlight / environment effects
   ============================================================ */

(() => {
    "use strict";

    const Details = {

        initialized: false,

        player: null,
        camera: null,

        hands: null,
        flashlight: null,
        flashlightLight: null,

        flashlightOn: true,
        flashlightSelected: true,

        bobTime: 0,

        /* ======================================================
           INIT
           ====================================================== */

        init(
            player = null,
            camera = null
        ) {
            this.player =
                player;

            this.camera =
                camera;

            this.initialized =
                true;

            this.createHands();
            this.createFlashlight();

            this.bindEvents();

            window.SeekerDetails =
                this;
        },

        attachPlayer(
            player,
            camera
        ) {
            this.player =
                player;

            this.camera =
                camera;

            if (
                !this.initialized
            ) {
                this.init(
                    player,
                    camera
                );

                return;
            }

            this.attachHands();
            this.attachFlashlight();
        },

        /* ======================================================
           HANDS
           ====================================================== */

        createHands() {

            if (
                this.hands
            ) {
                return;
            }

            this.hands =
                new THREE.Group();

            this.hands.name =
                "PLAYER_HANDS";

            this.createHand(
                -0.31,
                -0.28,
                -0.6,
                -0.08
            );

            this.createHand(
                0.31,
                -0.28,
                -0.62,
                0.08
            );

            this.attachHands();

        },

        createHand(
            x,
            y,
            z,
            rotation
        ) {
            const skin =
                new THREE.MeshStandardMaterial({
                    color:
                        0xc6b9a4,
                    roughness:
                        0.95
                });

            const arm =
                new THREE.Mesh(
                    new THREE.CapsuleGeometry(
                        0.075,
                        0.48,
                        6,
                        10
                    ),
                    skin
                );

            arm.position.set(
                x,
                y,
                z
            );

            arm.rotation.z =
                rotation;

            arm.castShadow =
                true;

            this.hands.add(
                arm
            );

            const hand =
                new THREE.Mesh(
                    new THREE.SphereGeometry(
                        0.105,
                        12,
                        12
                    ),
                    skin
                );

            hand.position.set(
                x,
                y + 0.28,
                z - 0.04
            );

            hand.scale.set(
                0.85,
                1.15,
                0.75
            );

            hand.castShadow =
                true;

            this.hands.add(
                hand
            );
        },

        attachHands() {

            if (
                !this.camera ||
                !this.hands
            ) {
                return;
            }

            if (
                this.hands.parent !==
                this.camera
            ) {
                this.camera.add(
                    this.hands
                );
            }

        },

        /* ======================================================
           FLASHLIGHT
           ====================================================== */

        createFlashlight() {

            if (
                this.flashlight
            ) {
                return;
            }

            this.flashlight =
                new THREE.Group();

            this.flashlight.name =
                "HELD_FLASHLIGHT";

            const darkMetal =
                new THREE.MeshStandardMaterial({
                    color:
                        0x1b1d1f,
                    metalness:
                        0.65,
                    roughness:
                        0.32
                });

            const body =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.09,
                        0.095,
                        0.46,
                        14
                    ),
                    darkMetal
                );

            body.rotation.z =
                -Math.PI / 2;

            this.flashlight.add(
                body
            );

            const head =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.14,
                        0.11,
                        0.18,
                        14
                    ),
                    darkMetal
                );

            head.rotation.z =
                -Math.PI / 2;

            head.position.x =
                -0.28;

            this.flashlight.add(
                head
            );

            const lens =
                new THREE.Mesh(
                    new THREE.CircleGeometry(
                        0.1,
                        20
                    ),
                    new THREE.MeshStandardMaterial({
                        color:
                            0xf2ead0,
                        emissive:
                            0xffffcc,
                        emissiveIntensity:
                            5,
                        roughness:
                            0.15
                    })
                );

            lens.rotation.y =
                -Math.PI / 2;

            lens.position.x =
                -0.372;

            this.flashlight.add(
                lens
            );

            const grip =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.12,
                        0.18,
                        0.28
                    ),
                    darkMetal
                );

            grip.position.set(
                0.02,
                -0.14,
                0
            );

            this.flashlight.add(
                grip
            );

            this.flashlightLight =
                new THREE.SpotLight(
                    0xfff3cf,
                    7,
                    28,
                    Math.PI / 7,
                    0.5,
                    1.1
                );

            this.flashlightLight.position.set(
                -0.46,
                0,
                0
            );

            this.flashlightLight.target.position.set(
                -8,
                0,
                0
            );

            this.flashlight.add(
                this.flashlightLight
            );

            this.flashlight.add(
                this.flashlightLight.target
            );

            this.flashlight.position.set(
                0.3,
                -0.33,
                -0.72
            );

            this.flashlight.rotation.set(
                0.08,
                -0.2,
                -0.07
            );

            this.attachFlashlight();

        },

        attachFlashlight() {

            if (
                !this.camera ||
                !this.flashlight
            ) {
                return;
            }

            if (
                this.flashlight.parent !==
                this.camera
            ) {
                this.camera.add(
                    this.flashlight
                );
            }

            this.flashlight.visible =
                this.flashlightSelected;

            this.updateFlashlight();

        },

        selectFlashlight(
            selected = true
        ) {
            this.flashlightSelected =
                !!selected;

            if (
                this.flashlight
            ) {
                this.flashlight.visible =
                    this.flashlightSelected;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:flashlight-selected"
                )
            );
        },

        toggleFlashlight() {

            if (
                !this.flashlightSelected
            ) {
                this.selectFlashlight(
                    true
                );
            }

            this.flashlightOn =
                !this.flashlightOn;

            this.updateFlashlight();

            window.dispatchEvent(
                new CustomEvent(
                    this.flashlightOn
                        ? "seeker:flashlight-on"
                        : "seeker:flashlight-off"
                )
            );

        },

        updateFlashlight() {

            if (
                !this.flashlight
            ) {
                return;
            }

            this.flashlight.visible =
                this.flashlightSelected;

            if (
                this.flashlightLight
            ) {
                this.flashlightLight.visible =
                    this.flashlightOn &&
                    this.flashlightSelected;

                this.flashlightLight.intensity =
                    this.flashlightOn
                        ? 7
                        : 0;
            }

        },

        /* ======================================================
           UI / INPUT
           ====================================================== */

        bindEvents() {

            const slot =
                document.getElementById(
                    "inventorySlot1"
                );

            if (slot) {

                slot.addEventListener(
                    "click",
                    () => {

                        this.selectFlashlight(
                            true
                        );

                    }
                );

            }


            window.addEventListener(
                "seeker:flashlight-on",
                () => {

                    this.flashlightOn =
                        true;

                    this.updateFlashlight();

                }
            );


            window.addEventListener(
                "seeker:flashlight-off",
                () => {

                    this.flashlightOn =
                        false;

                    this.updateFlashlight();

                }
            );

        },

        /* ======================================================
           PLAYER BOB
           ====================================================== */

        update(
            delta,
            sprinting = false
        ) {

            if (
                !this.camera ||
                !this.initialized
            ) {
                return;
            }

            let moving =
                false;

            if (
                window.SeekerSystem
            ) {
                moving =
                    !!window.SeekerSystem
                        .playerMoving;
            }

            const controls =
                window.Game;

            if (
                controls &&
                controls.joystick
            ) {

                moving =
                    moving ||
                    Math.abs(
                        controls.joystick
                            .moveX
                    ) >
                        0.04 ||
                    Math.abs(
                        controls.joystick
                            .moveY
                    ) >
                        0.04;

            }

            if (
                moving
            ) {

                this.bobTime +=
                    delta *
                    (
                        sprinting
                            ? 11
                            : 7
                    );

                const amplitude =
                    sprinting
                        ? 0.018
                        : 0.011;

                this.hands.position.y =
                    Math.sin(
                        this.bobTime
                    ) *
                    amplitude;

                this.flashlight.rotation.z =
                    Math.sin(
                        this.bobTime *
                        0.7
                    ) *
                    0.014;

            } else {

                this.hands.position.y =
                    THREE.MathUtils.lerp(
                        this.hands.position.y,
                        0,
                        Math.min(
                            1,
                            delta * 8
                        )
                    );

                this.flashlight.rotation.z =
                    THREE.MathUtils.lerp(
                        this.flashlight.rotation.z,
                        -0.07,
                        Math.min(
                            1,
                            delta * 5
                        )
                    );

            }

        }

    };

    window.SeekerDetails =
        Details;

    window.addEventListener(
        "seeker:player-created",
        (event) => {

            Details.attachPlayer(
                event.detail?.player,
                window.Game?.camera
            );

        }
    );

})();