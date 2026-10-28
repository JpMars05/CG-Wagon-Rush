import { CGFinterface, dat } from '../lib/CGF.js';

/**
 * MyInterface
 * Manages the DAT.gui panel and keyboard input.
 */
export class MyInterface extends CGFinterface {
    /**
     * Interface constructor.
     */
    constructor() {
        super();
    }

    /**
     * Initializes the interface and builds the DAT.gui panel.
     * @param {CGFapplication} application CGF application
     */
    init(application) {
        super.init(application);

        this.gui = new dat.GUI();
        this.initKeys();

        // Camera controls
        this.gui.add(this.scene, 'activeCameraId', ['Free', 'Wagon']).name('Active Camera').onChange(() => {
            this.scene.updateCamera();
        });

        const wagonCamera = this.gui.addFolder('Wagon Camera');
        wagonCamera.add(this.scene, 'wagonCameraDistance', 5, 100, 0.5).name('Distance');
        wagonCamera.add(this.scene, 'wagonCameraHeight', 2, 60, 0.5).name('Height');
        wagonCamera.add(this.scene, 'wagonCameraSideOffset', -40, 40, 0.5).name('Side Offset');
        wagonCamera.add(this.scene, 'wagonCameraTargetForward', -20, 40, 0.5).name('Target Forward');
        wagonCamera.add(this.scene, 'wagonCameraTargetHeight', 0, 30, 0.25).name('Target Height');
        wagonCamera.add(this.scene, 'wagonCameraTargetSideOffset', -30, 30, 0.5).name('Target Side');

        // Gameplay metric monitors
        const gameplay = this.gui.addFolder('Gameplay');
        this._addMonitor(gameplay, 'guiHealthPoints', 'Current HP', 0, this.scene.initialWagonHP, 1);
        this._addMonitor(gameplay, 'guiInstantDamage', 'Instant Damage HP', 0, 30, 1);
        this._addMonitor(gameplay, 'guiInstantHealthRestored', 'Instant Heal HP', 0, this.scene.initialWagonHP, 1);
        this._addMonitor(gameplay, 'guiDeliveredBales', 'Bales at Barn', 0, 100, 1);
        this._addMonitor(gameplay, 'guiScoreTime', 'Score Time s', 0, 9999, 1);
        gameplay.open();
    }

    /**
     * Adds a read-only DAT.gui numeric bar that listens to scene state.
     */
    _addMonitor(folder, property, label, min, max, step) {
        const controller = folder.add(this.scene, property, min, max, step).name(label).listen();

        if (controller.__input) {
            controller.__input.readOnly = true;
        }

        if (controller.domElement) {
            controller.domElement.style.pointerEvents = 'none';
        }

        return controller;
    }

    /**
     * Initializes keyboard mappings.
     */
    initKeys() {
        this.scene.gui = this;
        this.processKeyboard = function() {};
        this.activeKeys = {};
    }

    /**
     * Keydown callback.
     * @param {KeyboardEvent} event Keyboard event
     */
    processKeyDown(event) {
        this.activeKeys[event.code] = true;
    }

    /**
     * Keyup callback.
     * @param {KeyboardEvent} event Keyboard event
     */
    processKeyUp(event) {
        this.activeKeys[event.code] = false;
    }

    /**
     * Returns whether a key is currently pressed.
     * @param {string} keyCode Key code
     * @returns {boolean} True when pressed
     */
    isKeyPressed(keyCode) {
        return this.activeKeys[keyCode] || false;
    }
}
