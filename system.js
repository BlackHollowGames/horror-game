/* ============================================================
   THE SEEKER
   BLACKHOLLOW GAMES
   system.js
   MASTER SYSTEM
   ============================================================ */

(() => {
    "use strict";

    const System = {

        initialized: false,

        state: "menu",

        gameStarted: false,

        playerAlive: true,

        playerMoving: false,

        playerSpeed: 0,

        seekerActive: false,

        seekerDistance:
            Infinity,

        threat:
            0,

        buttonsFound:
            0,

        keyCollected:
            false,

        gateUnlocked:
            false,

        setupRemaining:
            180,

        setupDuration:
            180,

        flashlightSelected:
            true,

        flashlightOn:
            true,

        audioUnlocked:
            false,

        sounds: {},

        music:
            null,

        menuMusicPlaying:
            false,

        gameMusicPlaying:
            false,

        settings: {
            music:
                localStorage.getItem(
                    "seeker_music"
                ) !== "false",

            sfx:
                localStorage.getItem(
                    "seeker_sfx"
                ) !== "false",

            volume:
                Number(
                    localStorage.getItem(
                        "seeker_volume"
                    )
                ) || 0.75
        },

        playerName:
            localStorage.getItem(
                "seeker_player_name"
            ) ||
            "Player",

        /* ======================================================
           INIT
           ====================================================== */

        init() {

            if (
                this.initialized
            ) {
                return;
            }

            this.initialized =
                true;

            this.cacheAudio();

            this.createAudioUnlock();

            this.bindEvents();

            this.loadSettings();

            window.SeekerSystem =
                this;

            window.GameSystem =
                this;

        },

        /* ======================================================
           AUDIO
           ====================================================== */

        cacheAudio() {

            this.sounds = {

                click:
                    this.createAudio(
                        "audio/click.mp3"
                    ),

                boom:
                    this.createAudio(
                        "audio/boom.mp3"
                    ),

                success:
                    this.createAudio(
                        "audio/success.mp3"
                    ),

                warning:
                    this.createAudio(
                        "audio/warning.mp3"
                    ),

                caught:
                    this.createAudio(
                        "audio/caught.mp3"
                    ),

                button:
                    this.createAudio(
                        "audio/button.mp3"
                    ),

                key:
                    this.createAudio(
                        "audio/key.mp3"
                    ),

                gate:
                    this.createAudio(
                        "audio/gate.mp3"
                    ),

                footstep:
                    this.createAudio(
                        "audio/footstep.mp3"
                    ),

                heartbeat:
                    this.createAudio(
                        "audio/heartbeat.mp3"
                    ),

                flashlightOn:
                    this.createAudio(
                        "audio/flashlight-on.mp3"
                    ),

                flashlightOff:
                    this.createAudio(
                        "audio/flashlight-off.mp3"
                    )

            };

            this.music =
                this.createAudio(
                    "audio/menu.mp3"
                );

            this.music.loop =
                true;

            this.threatMusic =
                this.createAudio(
                    "audio/seeker-1980.mp3"
                );

            this.threatMusic.loop =
                true;

            this.ambience =
                this.createAudio(
                    "audio/ambience.mp3"
                );

            this.ambience.loop =
                true;

        },

        createAudio(src) {

            const audio =
                new Audio();

            audio.src =
                src;

            audio.preload =
                "auto";

            return audio;

        },

        createAudioUnlock() {

            const unlock =
                () => {

                    if (
                        this.audioUnlocked
                    ) {
                        return;
                    }

                    this.audioUnlocked =
                        true;

                    this.playMenuMusic();

                    document.removeEventListener(
                        "pointerdown",
                        unlock
                    );

                    document.removeEventListener(
                        "keydown",
                        unlock
                    );

                };

            document.addEventListener(
                "pointerdown",
                unlock,
                {
                    once:
                        false
                }
            );

            document.addEventListener(
                "keydown",
                unlock,
                {
                    once:
                        false
                }
            );

        },

        playSound(
            name,
            volumeMultiplier = 1
        ) {

            if (
                !this.settings.sfx
            ) {
                return;
            }

            const source =
                this.sounds[name];

            if (!source) {
                return;
            }

            const sound =
                source.cloneNode(
                    true
                );

            sound.volume =
                Math.min(
                    1,
                    this.settings.volume *
                    volumeMultiplier
                );

            const promise =
                sound.play();

            promise?.catch?.(
                () => {}
            );

        },

        /* ======================================================
           MENU MUSIC
           ====================================================== */

        playMenuMusic() {

            if (
                !this.settings.music
            ) {
                return;
            }

            if (
                !this.music
            ) {
                return;
            }

            this.stopGameMusic();

            this.music.volume =
                this.settings.volume *
                0.34;

            this.music.loop =
                true;

            const promise =
                this.music.play();

            promise?.catch?.(
                () => {}
            );

            this.menuMusicPlaying =
                true;

        },

        stopMenuMusic() {

            if (
                !this.music
            ) {
                return;
            }

            this.music.pause();

            try {
                this.music.currentTime =
                    0;
            } catch (_) {}

            this.menuMusicPlaying =
                false;

        },

        playGameMusic() {

            if (
                !this.settings.music
            ) {
                return;
            }

            this.stopMenuMusic();

            if (
                !this.ambience
            ) {
                return;
            }

            this.ambience.volume =
                this.settings.volume *
                0.27;

            const promise =
                this.ambience.play();

            promise?.catch?.(
                () => {}
            );

            this.gameMusicPlaying =
                true;

        },

        stopGameMusic() {

            if (
                this.ambience
            ) {

                this.ambience.pause();

                try {
                    this.ambience.currentTime =
                        0;
                } catch (_) {}

            }

            if (
                this.threatMusic
            ) {

                this.threatMusic.pause();

                try {
                    this.threatMusic.currentTime =
                        0;
                } catch (_) {}

            }

            this.gameMusicPlaying =
                false;

        },

        /* ======================================================
           INTRO BOOM
           ====================================================== */

        playIntroBoom() {

            this.playSound(
                "boom",
                1
            );

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:intro-audio-boom"
                )
            );

        },

        /* ======================================================
           GAME START
           ====================================================== */

        startGame(
            options = {}
        ) {

            this.state =
                "playing";

            this.gameStarted =
                true;

            this.playerAlive =
                true;

            this.buttonsFound =
                0;

            this.keyCollected =
                false;

            this.gateUnlocked =
                false;

            this.seekerActive =
                false;

            this.seekerDistance =
                Infinity;

            this.threat =
                0;

            this.setupRemaining =
                180;

            this.playGameMusic();

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:system-start",
                    {
                        detail:
                            options
                    }
                )
            );

        },

        stopGame() {

            this.state =
                "menu";

            this.gameStarted =
                false;

            this.stopGameMusic();

            this.stopThreatMusic();

        },

        /* ======================================================
           EVENT BRIDGE
           ====================================================== */

        bindEvents() {

            window.addEventListener(
                "seeker:start",
                (event) => {

                    this.startGame(
                        event.detail ||
                        {}
                    );

                }
            );


            window.addEventListener(
                "seeker:stop",
                () => {

                    this.stopGame();

                }
            );


            window.addEventListener(
                "seeker:pause",
                () => {

                    this.state =
                        "paused";

                }
            );


            window.addEventListener(
                "seeker:resume",
                () => {

                    if (
                        this.gameStarted
                    ) {
                        this.state =
                            "playing";
                    }

                }
            );


            window.addEventListener(
                "seeker:intro-boom",
                () => {

                    this.playIntroBoom();

                }
            );


            window.addEventListener(
                "seeker:player-moving",
                (event) => {

                    this.playerMoving =
                        !!event.detail
                            ?.moving;

                    this.playerSpeed =
                        Number(
                            event.detail
                                ?.speed
                        ) || 0;

                }
            );


            window.addEventListener(
                "seeker:footstep",
                (event) => {

                    if (
                        !this.seekerActive
                    ) {
                        return;
                    }

                    const sprinting =
                        !!event.detail
                            ?.sprinting;

                    this.playSound(
                        "footstep",
                        sprinting
                            ? 0.9
                            : 0.55
                    );

                }
            );


            window.addEventListener(
                "seeker:seeker-distance",
                (event) => {

                    this.setSeekerDistance(
                        event.detail
                            ?.distance
                    );

                }
            );


            window.addEventListener(
                "seeker:activated",
                () => {

                    this.activateSeeker();

                }
            );


            window.addEventListener(
                "seeker:button",
                (event) => {

                    this.registerButton(
                        event.detail
                            ?.id
                    );

                }
            );


            window.addEventListener(
                "seeker:key",
                () => {

                    this.collectKey();

                }
            );


            window.addEventListener(
                "seeker:gate",
                () => {

                    this.unlockGate();

                }
            );


            window.addEventListener(
                "seeker:player-caught",
                () => {

                    this.caught();

                }
            );


            window.addEventListener(
                "seeker:player-escaped",
                () => {

                    this.escape();

                }
            );


            window.addEventListener(
                "seeker:flashlight-on",
                () => {

                    this.flashlightOn =
                        true;

                    this.playSound(
                        "flashlightOn",
                        0.65
                    );

                }
            );


            window.addEventListener(
                "seeker:flashlight-off",
                () => {

                    this.flashlightOn =
                        false;

                    this.playSound(
                        "flashlightOff",
                        0.5
                    );

                }
            );

        },

        /* ======================================================
           BUTTONS
           ====================================================== */

        registerButton() {

            this.buttonsFound =
                Math.min(
                    3,
                    this.buttonsFound +
                    1
                );

            this.playSound(
                "button",
                0.8
            );

        },

        /* ======================================================
           KEY
           ====================================================== */

        collectKey() {

            if (
                this.keyCollected
            ) {
                return;
            }

            this.keyCollected =
                true;

            this.playSound(
                "key",
                0.8
            );

        },

        /* ======================================================
           GATE
           ====================================================== */

        unlockGate() {

            if (
                this.gateUnlocked
            ) {
                return;
            }

            this.gateUnlocked =
                true;

            this.playSound(
                "gate",
                1
            );

        },

        /* ======================================================
           SEEKER
           ====================================================== */

        activateSeeker() {

            if (
                this.seekerActive
            ) {
                return;
            }

            this.seekerActive =
                true;

            this.threat =
                0;

            this.dispatchThreat();

        },

        setSeekerDistance(
            distance
        ) {

            if (
                !Number.isFinite(
                    Number(distance)
                )
            ) {
                return;
            }

            this.seekerDistance =
                Number(distance);

            const distanceValue =
                this.seekerDistance;

            let targetThreat =
                0;

            if (
                distanceValue <=
                4
            ) {
                targetThreat =
                    1;
            } else if (
                distanceValue <=
                10
            ) {
                targetThreat =
                    0.85;
            } else if (
                distanceValue <=
                18
            ) {
                targetThreat =
                    0.6;
            } else if (
                distanceValue <=
                30
            ) {
                targetThreat =
                    0.3;
            } else if (
                distanceValue <=
                45
            ) {
                targetThreat =
                    0.12;
            }

            this.threat +=
                (
                    targetThreat -
                    this.threat
                ) *
                0.12;

            this.updateThreatUI();

            this.updateThreatMusic();

        },

        dispatchThreat() {

            window.dispatchEvent(
                new CustomEvent(
                    "seeker:threat",
                    {
                        detail: {
                            amount:
                                this.threat,
                            distance:
                                this.seekerDistance
                        }
                    }
                )
            );

        },

        updateThreatUI() {

            const display =
                document.getElementById(
                    "threatDisplay"
                );

            const text =
                document.getElementById(
                    "threatText"
                );

            const danger =
                document.getElementById(
                    "dangerOverlay"
                );

            if (
                text
            ) {

                if (
                    !this.seekerActive
                ) {
                    text.textContent =
                        "DORMANT";

                } else if (
                    this.seekerDistance <
                    8
                ) {
                    text.textContent =
                        "VERY CLOSE";

                } else if (
                    this.seekerDistance <
                    18
                ) {
                    text.textContent =
                        "NEARBY";

                } else if (
                    this.seekerDistance <
                    35
                ) {
                    text.textContent =
                        "DETECTED";

                } else {
                    text.textContent =
                        "HUNTING";
                }

            }

            if (
                display
            ) {

                display.dataset.threat =
                    this.threat >
                    0.65
                        ? "high"
                        : this.threat >
                          0.25
                        ? "medium"
                        : "low";

            }

            if (
                danger
            ) {

                danger.style.opacity =
                    String(
                        Math.max(
                            0,
                            this.threat *
                            0.7
                        )
                    );

            }

            this.dispatchThreat();

        },

        /* ======================================================
           1980s THREAT MUSIC
           ====================================================== */

        updateThreatMusic() {

            if (
                !this.settings.music ||
                !this.threatMusic
            ) {
                return;
            }

            if (
                !this.seekerActive ||
                this.seekerDistance >
                    45
            ) {

                this.stopThreatMusic();

                return;

            }

            if (
                this.threatMusic.paused
            ) {

                this.threatMusic.loop =
                    true;

                const promise =
                    this.threatMusic.play();

                promise?.catch?.(
                    () => {}
                );

            }

            /*
             * The closer the Seeker gets,
             * the louder the 1980s chase music.
             */

            const closeness =
                THREE.MathUtils.clamp(
                    1 -
                    (
                        this.seekerDistance /
                        45
                    ),
                    0,
                    1
                );

            const volume =
                this.settings.volume *
                (
                    0.04 +
                    closeness *
                    0.9
                );

            this.threatMusic.volume =
                Math.min(
                    1,
                    volume
                );

        },

        stopThreatMusic() {

            if (
                !this.threatMusic
            ) {
                return;
            }

            this.threatMusic.pause();

            try {
                this.threatMusic.currentTime =
                    0;
            } catch (_) {}

        },

        /* ======================================================
           CAUGHT / ESCAPE
           ====================================================== */

        caught() {

            if (
                !this.playerAlive
            ) {
                return;
            }

            this.playerAlive =
                false;

            this.gameStarted =
                false;

            this.state =
                "caught";

            this.stopThreatMusic();

            this.playSound(
                "caught",
                1
            );

        },

        escape() {

            this.gameStarted =
                false;

            this.state =
                "escaped";

            this.stopThreatMusic();

            this.playSound(
                "success",
                1
            );

        },

        /* ======================================================
           SETTINGS
           ====================================================== */

        loadSettings() {

            const music =
                document.getElementById(
                    "musicToggle"
                );

            const sfx =
                document.getElementById(
                    "sfxToggle"
                );

            const volume =
                document.getElementById(
                    "volumeSlider"
                );

            if (
                music
            ) {
                music.checked =
                    this.settings.music;
            }

            if (
                sfx
            ) {
                sfx.checked =
                    this.settings.sfx;
            }

            if (
                volume
            ) {
                volume.value =
                    this.settings.volume;
            }

        },

        /* ======================================================
           PUBLIC SETTINGS
           ====================================================== */

        setMusicEnabled(
            enabled
        ) {

            this.settings.music =
                !!enabled;

            localStorage.setItem(
                "seeker_music",
                String(
                    this.settings.music
                )
            );

            if (
                this.settings.music
            ) {

                if (
                    this.gameStarted
                ) {
                    this.playGameMusic();
                } else {
                    this.playMenuMusic();
                }

            } else {

                this.stopMenuMusic();
                this.stopGameMusic();

            }

        },

        setSfxEnabled(
            enabled
        ) {

            this.settings.sfx =
                !!enabled;

            localStorage.setItem(
                "seeker_sfx",
                String(
                    this.settings.sfx
                )
            );

        },

        setVolume(
            value
        ) {

            const volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(value)
                    )
                );

            this.settings.volume =
                Number.isFinite(
                    volume
                )
                    ? volume
                    : 0.75;

            localStorage.setItem(
                "seeker_volume",
                String(
                    this.settings.volume
                )
            );

            this.updateAudioVolumes();

        },

        updateAudioVolumes() {

            if (
                this.music
            ) {

                this.music.volume =
                    this.settings.volume *
                    0.34;

            }

            if (
                this.ambience
            ) {

                this.ambience.volume =
                    this.settings.volume *
                    0.27;

            }

            if (
                this.threatMusic
            ) {

                const current =
                    this.threatMusic.volume;

                this.threatMusic.volume =
                    Math.min(
                        1,
                        current ||
                        (
                            this.settings.volume *
                            0.5
                        )
                    );

            }

        }

    };

    System.init();

})();