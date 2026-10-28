import { CGFscene, CGFcamera, CGFaxis, CGFappearance, CGFshader } from '../lib/CGF.js';
import { MyHemisphere } from './primitives/MyHemisphere.js';
import { MyTerrain } from './environment/MyTerrain.js';
import { MySun } from './environment/MySun.js';
import { MyClouds } from './environment/MyClouds.js';
import { MyGrass } from './environment/MyGrass.js';
import { MyFlower } from './environment/MyFlower.js';
import { MyRock } from './environment/MyRock.js';
import { MyWagonSimple } from './wagon/MyWagonSimple.js';
import { MyBarn } from './structures/MyBarn.js';
import { MyBaleZone } from './gameplay/MyBaleZone.js';
import { MyFence } from './structures/MyFence.js';
import { MyHayBaleManager } from './gameplay/MyHayBaleManager.js';
import { MyAssetManager } from './utils/MyAssetManager.js';

/**
 * MyScene
 * Controlador central do motor gráfico e da simulação do jogo.
 * Gere a câmara, o ciclo de iluminação dia/noite com movimento solar procedural,
 * inicialização da vegetação, terreno e física,
 * deteção de colisões de gameplay e atualizações do HUD HTML.
 */
export class MyScene extends CGFscene {
    /**
     * Construtor da cena principal.
     */
    constructor() {
        super();
    }

    // ── 1. INICIALIZAÇÃO PRINCIPAL E CARREGAMENTO DE ATIVOS ──────────────────

    /**
     * Inicializa a aplicação, os buffers WebGL, materiais, iluminação global e estruturas do jogo.
     * @param {CGFapplication} application Aplicação CGF que gere o ciclo de jogo
     */
    init(application) {
        super.init(application);

        this.initCameras();
        this.initLights();
        this.enableTextures(true);
        this.assets = new MyAssetManager(this);
        this.assets.preloadCriticalTerrain();

        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);

        // Ambient global baixo: o sol é a fonte de luz principal
        this.setGlobalAmbientLight(0.1, 0.1, 0.15, 1.0);

        // ── Variáveis da interface ──────────────────────────────────────────
        this.displayAxis = true;
        this.wireframe = false;
        this.stacks = 20;
        this.slices = 40;
        this.wagonCameraDistance = 42.5;
        this.wagonCameraHeight = 12.5;
        this.wagonCameraSideOffset = 0.0;
        this.wagonCameraTargetForward = -8.0;
        this.wagonCameraTargetHeight = 6.0;
        this.wagonCameraTargetSideOffset = 0.0;
        this.playAreaRadius = 250.0;
        this.skyRadius = 400.0;
        this.animateSun = true;
        this.sunCycleDuration = 180.0;
        this.sunriseAzimuth = 70.0;
        this.sunsetAzimuth = 290.0;
        this.sunMinElevation = -10.0;
        this.sunMaxElevation = 72.0;
        this.sunNightEnd = 0.16;
        this.sunriseEnd = 0.40;
        this.sunDayEnd = 0.58;
        this.sunsetEnd = 0.82;
        this.dayNightPhase = 0.14;
        this._sunCycleTime = this.dayNightPhase * this.sunCycleDuration;
        this.dayFactor = 1.0;
        this.nightFactor = 0.0;
        this.twilightFactor = 0.0;
        this.starVisibility = 0.0;
        this.sunDiskVisibility = 1.0;
        this.sunAzimuth = 180.0;
        this.sunElevation = this.sunMaxElevation;
        this._applySunCyclePhase(this.dayNightPhase);
        this.lanternBaseRadius = 18.0;
        this.lanternBaseIntensity = 1.3;
        this.fenceLanternLightStart = 4;
        this.fenceLanternLightCount = 4;

        // Parâmetros das nuvens
        this.cloudCover = 0.30;
        this.cloudSpeed = 0.5;

        // Parâmetros do vento
        this.windDirection = 45.0;
        this.windStrength = 0.6;
        this.windSpeed = 1.10;
        this.windFreq = 1.1;

        // Parâmetros da relva
        this.grassDensity = 5.0;
        this.grassFieldSpacing = 1.4;
        this.grassFieldJitter = 0.92;
        this.grassHeightScale = 1.65;
        this.grassBladesPerTuft = 10;
        this.grassBladeWidthScale = 0.064;
        this.grassBladeCurveScale = 0.29;
        this.grassMaxSlope = 0.9;
        this.grassEdgeMargin = this.playAreaRadius * 0.02;
        this.roadExclusionThreshold = 0.18;

        // Seed base da cena. A partir dela a relva, flores e rochas são separadas em sequencias diferentes.
        this.seed = 12345;
        this.grassSeed = this.seed + 101;
        this.flowerSeed = this.seed + 202;
        this.rockSeed = this.seed + 303;

        // Parâmetros das flores
        this.flowerProbability = 0.009;
        this.flowerScale = 0.7;
        this.flowerClearingRadius = 3.2;
        this.flowerClearingStrength = 0.62;
        this.floraReactionRadius = 8.5;
        this.floraReactionWake = 13.0;
        this.floraReactionStrength = 1.15;

        // Parâmetros das rochas
        this.rockCount = 70;
        this.rockScale = 1.2;
        this.rockMossAmount = 0.5;
        this.rockSlopeMin = 0.02;
        this.rockUseTextures = true;
        this.rockRideOverMaxScale = 2.05;
        this.rockRideOverMaxHeight = 1.35;
        this.rockRideOverHeightScale = 0.8;
        this.wagonSuspensionStiffness = 56.0;
        this.wagonSuspensionDamping = 8.4;

        // Parâmetros dos fardos de gameplay
        this.hayBaleSeed = this.seed + 404;
        this.hayBaleCount = 3;
        this.hayBaleMinCount = this.hayBaleCount;
        this.hayBaleMaxCount = this.hayBaleCount;
        this.hayBaleVisibleRadius = 50.0;
        this.hayBaleCaptureRadius = 30.0;

        // Gameplay
        this.gameStarted = false;
        this.gameOver = false;
        this.sceneReady = false;
        this.startCountdownActive = false;
        this.initialWagonHP = 100;
        this.wagonHP = this.initialWagonHP;
        this.hpLossPerSecond = 1;
        this.hayBaleValue = 20;
        this.maxCarriedBales = 2;
        this.carriedBales = 0;
        this.deliveredBales = 0;
        this.elapsedTime = 0;
        this.finalScore = 0;
        this.collisionCooldown = 0;
        this.collisionCooldownDuration = 1.5;
        this.collisionBaseDamage = 3;
        this.collisionBonusDamage = 17;
        this.lastCollisionDamage = 0;
        this.collisionFeedbackTime = 0;
        this.lastHealthRestored = 0;
        this.healthRestoreFeedbackTime = 0;
        this.guiHealthPoints = this.wagonHP;
        this.guiInstantDamage = 0;
        this.guiInstantHealthRestored = 0;
        this.guiDeliveredBales = 0;
        this.guiScoreTime = 0;
        this._wagonPlacedAtStart = false;
        this._hayBalesReady = false;
        this._lastInteractPressed = false;
        this._actionPrompt = null;

        // ── Objetos ─────────────────────────────────────────────────────────
        this.axis = new CGFaxis(this);
        this.hemisphere = new MyHemisphere(this, this.skyRadius, this.slices, this.stacks);
        this.sun = new MySun(this, this.skyRadius * 0.03);
        this.clouds = new MyClouds(this, this.skyRadius * 0.99, this.slices, this.stacks);
        this.terrain = new MyTerrain(this);
        this.grass = new MyGrass(this);
        this.flowers = new MyFlower(this);
        this.rocks = new MyRock(this);
        this.wagon = new MyWagonSimple(this);
        this.barn = new MyBarn(this);
        this.baleZone = new MyBaleZone(this, 18.0, 16);
        this.roadFence = new MyFence(this);
        this.hayBaleManager = new MyHayBaleManager(this);

        // Reconstruir vegetação quando a GUI muda
        this.rebuildGrass = () => {
            this.grass = new MyGrass(this);
            this._hayBalesReady = false;
            this.sceneReady = false;
            this.hayBaleManager = new MyHayBaleManager(this);
            this._rebuildFlowersWhenReady();
            this._rebuildRocksWhenReady();
            this._rebuildRoadFenceWhenReady();
            this._rebuildHayBalesWhenReady();
        };
        this.rebuildFlowers = () => { this._rebuildFlowersWhenReady(); };
        this.rebuildRocks = () => { this._rebuildRocksWhenReady(); };

        // Construir dependentes do height map
        this._rebuildFlowersWhenReady();
        this._rebuildRocksWhenReady();
        this._rebuildRoadFenceWhenReady();
        this._rebuildBarnWhenReady();
        this._rebuildHayBalesWhenReady();

        // Cache para deteção de alterações e otimização de buffers.
        this._lastStacks = this.stacks;
        this._lastSlices = this.slices;
        this._lastSkyRadius = this.skyRadius;
        this._lastWireframe = this.wireframe;

        // ── Material do skydome ─────────────────────────────────────────────
        // Shader procedural: azul de dia, brilho solar direcional e estrelas de noite.
        this.skyMaterial = new CGFappearance(this);
        this.skyMaterial.setAmbient(1.0, 1.0, 1.0, 1.0);
        this.skyMaterial.setDiffuse(1.0, 1.0, 1.0, 1.0);
        this.skyMaterial.setSpecular(0.0, 0.0, 0.0, 1.0);
        this.skyMaterial.setEmission(1.0, 1.0, 1.0, 1.0);
        this.skyMaterial.setShininess(1.0);
        this.skyShader = new CGFshader(this.gl, 'shaders/sky.vert', 'shaders/sky.frag');
        this.skyShader.setUniformsValues({
            uSunDir: this._sunDir(),
            uSunVisibility: this._sunVisibility(),
            uTwilightFactor: this.twilightFactor,
            uStarVisibility: this.starVisibility,
            uSunDiskVisibility: this.sunDiskVisibility,
        });

        // ── Material do terreno ─────────────────────────────────────────────
        this.terrainMaterial = new CGFappearance(this);
        this.terrainMaterial.setAmbient(0.3, 0.3, 0.3, 1.0);
        this.terrainMaterial.setDiffuse(0.7, 0.7, 0.7, 1.0);
        this.terrainMaterial.setSpecular(0.1, 0.1, 0.1, 1.0);
        this.terrainMaterial.setEmission(0.0, 0.0, 0.0, 1.0);
        this.terrainMaterial.setShininess(5.0);
        this.terrainTexture = this.assets.getTexture('textures/terrain_color.jpg');
        this.terrainMaterial.setTexture(this.terrainTexture);
        this.terrainMaterial.setTextureWrap('REPEAT', 'REPEAT');

        // Textura do Height Map
        this.heightMapTexture = this.assets.getTexture('textures/heigthmap.jpg');

        // ── Texturas da estrada ─────────────────────────────────────────────
        this.roadMapTexture = this.assets.getTexture('textures/road_mask.png');

        this.setUpdatePeriod(16);
        this._initGameplayHud();
    }

    /**
     * Define as luzes base da cena (Sol, luz de preenchimento, lampião da carroça, sinalizador e cercas).
     */
    initLights() {
        // Luz 0: sol direcional controlado por azimuth/elevation
        this.lights[0].setAmbient(0.05, 0.05, 0.05, 1.0);
        this.lights[0].setDiffuse(0.9, 0.8, 0.6, 1.0);
        this.lights[0].setSpecular(0.8, 0.8, 0.7, 1.0);
        this.lights[0].setConstantAttenuation(1.0);
        this.lights[0].enable();

        // Luz 1: Luz de preenchimento vinda de cima para suavizar o lado escuro
        this.lights[1].setPosition(0, 50, 0, 1.0);
        this.lights[1].setAmbient(0.2, 0.2, 0.25, 1.0);
        this.lights[1].setDiffuse(0.3, 0.3, 0.4, 1.0);
        this.lights[1].enable();

        // Luz 2: lampiao da carroca, quente e com alcance curto
        this.lights[2].setAmbient(0.02, 0.01, 0.0, 1.0);
        this.lights[2].setDiffuse(1.0, 0.78, 0.42, 1.0);
        this.lights[2].setSpecular(1.0, 0.85, 0.55, 1.0);
        this.lights[2].setConstantAttenuation(0.18);
        this.lights[2].setLinearAttenuation(0.035);
        this.lights[2].setQuadraticAttenuation(0.008);
        this.lights[2].enable();

        // Luz 3: beacon do bale zone — laranja quente, alcance médio-longo
        this.lights[3].setAmbient(0.08, 0.055, 0.015, 1.0);
        this.lights[3].setDiffuse(1.0, 0.65, 0.18, 1.0);
        this.lights[3].setSpecular(0.9, 0.6, 0.2, 1.0);
        this.lights[3].setConstantAttenuation(0.06);
        this.lights[3].setLinearAttenuation(0.0055);
        this.lights[3].setQuadraticAttenuation(0.0008);
        this.lights[3].enable();

        // Luzes 4-7: lanternas mais proximas das extremidades da cerca.
        for (let i = 4; i < 8; i++) {
            if (!this.lights[i]) continue;
            this.lights[i].setAmbient(0.0, 0.0, 0.0, 1.0);
            this.lights[i].setDiffuse(0.0, 0.0, 0.0, 1.0);
            this.lights[i].setSpecular(0.0, 0.0, 0.0, 1.0);
            this.lights[i].setConstantAttenuation(0.12);
            this.lights[i].setLinearAttenuation(0.014);
            this.lights[i].setQuadraticAttenuation(0.003);
            this.lights[i].setPosition(0, -1000, 0, 1.0);
            this.lights[i].enable();
        }
    }

    /**
     * Inicializa a câmara livre e a câmara física de acompanhamento da carroça.
     */
    initCameras() {
        this.cameras = {
            'Free': new CGFcamera(
                0.6,
                0.1,
                1000,
                vec3.fromValues(0, 12, 30),
                vec3.fromValues(0, 8, 0)
            ),
            'Wagon': new CGFcamera(
                0.6,
                0.1,
                1000,
                vec3.fromValues(-25, 10, 0),
                vec3.fromValues(0, 0, 0)
            )
        };
        this.activeCameraId = 'Free';
        this.camera = this.cameras[this.activeCameraId];
    }

    /**
     * Muda a câmara ativa da cena e atualiza a interface GUI do utilizador.
     */
    updateCamera() {
        this.camera = this.cameras[this.activeCameraId];
        if (this.gui) {
            this.gui.setActiveCamera(this.camera);
        }
    }

    // ── 2. MOVIMENTO PROCEDURAL DO SOL E CÁLCULOS CELESTES ─────────────────

    /**
     * Calcula o vetor de direção do Sol no espaço 3D a partir do Azimuth e Elevation.
     * @returns {Array<number>} Vetor unitário tridimensional [x, y, z]
     * @private
     */
    _sunDir() {
        const az = (this.sunAzimuth * Math.PI) / 180;
        const el = (this.sunElevation * Math.PI) / 180;
        const cosEl = Math.cos(el);
        return [cosEl * Math.sin(az), Math.sin(el), cosEl * Math.cos(az)];
    }

    /**
     * Calcula as coordenadas de translação global da esfera do Sol.
     * @returns {Array<number>} Posição [x, y, z] do Sol
     * @private
     */
    _sunWorldPos() {
        const d = this._sunDir();
        const r = this.skyRadius * 0.95;
        return [d[0] * r, d[1] * r, d[2] * r];
    }

    /**
     * Determina a intensidade do dia baseada na elevação solar.
     * @returns {number} Fator de claridade diurna [0.0, 1.0]
     * @private
     */
    _sunVisibility() {
        return this.dayFactor ?? this._smoothstep(-6.0, 24.0, this.sunElevation);
    }

    /**
     * Determina a intensidade da noite baseada na elevação solar.
     * @returns {number} Fator de escuridão noturna [0.0, 1.0]
     * @private
     */
    _nightFactor() {
        return this.nightFactor ?? (1.0 - this._sunVisibility());
    }

    /**
     * Limita um valor entre o mínimo e o máximo.
     * @private
     */
    _clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Interpolação suave hermítica
     * @private
     */
    _smoothstep(edge0, edge1, value) {
        const t = this._clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    }

    /**
     * Interpolação linear de dois valores.
     * @private
     */
    _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Normaliza um ângulo ao intervalo [0, 360[.
     * @private
     */
    _normalizeAngle(angle) {
        return ((angle % 360.0) + 360.0) % 360.0;
    }

    /**
     * Interpola e normaliza o Azimuth solar de forma a evitar descontinuidades angulares.
     * @private
     */
    _sunAzimuthBetween(start, end, t) {
        return this._normalizeAngle(this._lerp(start, end, t));
    }

    /**
     * Sincroniza as intensidades atmosféricas (dia, crepúsculo, noite, estrelas) a partir da elevação solar.
     * @private
     */
    _syncSunFactorsFromElevation() {
        const elevation = this.sunElevation;
        const day = this._smoothstep(-4.0, 26.0, elevation);
        const horizonGlow = this._smoothstep(-12.0, 8.0, elevation) * (1.0 - this._smoothstep(16.0, 42.0, elevation));

        this.dayFactor = day;
        this.nightFactor = 1.0 - day;
        this.twilightFactor = horizonGlow;
        this.starVisibility = 1.0 - this._smoothstep(-8.0, 10.0, elevation);
        this.sunDiskVisibility = this._smoothstep(-1.0, 5.0, elevation);
    }

    /**
     * Aplica a elevação e o azimuth com base numa fase linear de tempo do dia [0.0, 1.0].
     * @param {number} phase Progresso linear dia/noite
     * @private
     */
    _applySunCyclePhase(phase) {
        const p = this._clamp(phase, 0.0, 1.0);
        const nightEnd = this.sunNightEnd ?? 0.16;
        const sunriseEnd = this.sunriseEnd ?? 0.40;
        const dayEnd = this.sunDayEnd ?? 0.58;
        const sunsetEnd = this.sunsetEnd ?? 0.82;

        this.dayNightPhase = p;

        if (p < nightEnd) {
            const t = p / nightEnd;
            this.sunAzimuth = this._sunAzimuthBetween(this.sunsetAzimuth + 10.0, this.sunriseAzimuth + 360.0 - 14.0, t);
            this.sunElevation = this.sunMinElevation;
        } else if (p < sunriseEnd) {
            const t = this._smoothstep(0.0, 1.0, (p - nightEnd) / (sunriseEnd - nightEnd));
            this.sunAzimuth = this._sunAzimuthBetween(this.sunriseAzimuth - 14.0, this.sunriseAzimuth + 22.0, t);
            this.sunElevation = this._lerp(this.sunMinElevation, 22.0, t);
        } else if (p < dayEnd) {
            const t = this._smoothstep(0.0, 1.0, (p - sunriseEnd) / (dayEnd - sunriseEnd));
            this.sunAzimuth = this._sunAzimuthBetween(this.sunriseAzimuth + 22.0, this.sunsetAzimuth - 28.0, t);
            this.sunElevation = 22.0 + (this.sunMaxElevation - 22.0) * Math.sin(t * Math.PI);
        } else if (p < sunsetEnd) {
            const t = this._smoothstep(0.0, 1.0, (p - dayEnd) / (sunsetEnd - dayEnd));
            this.sunAzimuth = this._sunAzimuthBetween(this.sunsetAzimuth - 28.0, this.sunsetAzimuth + 10.0, t);
            this.sunElevation = this._lerp(22.0, this.sunMinElevation, t);
        } else {
            const t = (p - sunsetEnd) / (1.0 - sunsetEnd);
            this.sunAzimuth = this._sunAzimuthBetween(this.sunsetAzimuth + 10.0, this.sunriseAzimuth + 360.0 - 14.0, t);
            this.sunElevation = this.sunMinElevation;
        }

        this._syncSunFactorsFromElevation();
    }

    /**
     * Incrementa o relógio do ciclo dia/noite e atualiza a fase atual.
     * @param {number} dt Variação temporal
     * @private
     */
    _updateDayNightCycle(dt) {
        const duration = Math.max(1.0, this.sunCycleDuration || 1.0);
        this._sunCycleTime = (this._sunCycleTime + dt) % duration;
        this._applySunCyclePhase(this._sunCycleTime / duration);
    }

    // ── 3. ILUMINAÇÃO DINÂMICA DE SOL, LAMPIÕES E POSTES ────────────────────

    /**
     * Obtém a posição absoluta no mundo do lampião acoplado ao veículo.
     * @returns {Array<number>} Coordenadas globais [x, y, z]
     * @private
     */
    _lanternWorldPos() {
        if (this.wagon && typeof this.wagon.getLanternWorldPosition === 'function') {
            return this.wagon.getLanternWorldPosition();
        }
        return [0, 0, 0];
    }

    /**
     * Retorna a posição do lampião no espaço de vista para shaders
     * @returns {Array<number>} Coordenadas no espaço da câmara
     * @private
     */
    _lanternViewPos() {
        const lp = this._lanternWorldPos();
        const vm = this.camera.getViewMatrix();
        return [
            vm[0] * lp[0] + vm[4] * lp[1] + vm[8] * lp[2] + vm[12],
            vm[1] * lp[0] + vm[5] * lp[1] + vm[9] * lp[2] + vm[13],
            vm[2] * lp[0] + vm[6] * lp[1] + vm[10] * lp[2] + vm[14]
        ];
    }

    /**
     * Determina a intensidade do lampião do veículo, mais forte à noite.
     * @returns {number} Fator de intensidade luminosa
     * @private
     */
    _lanternIntensity() {
        return this.lanternBaseIntensity + this._nightFactor() * 1.7;
    }

    /**
     * Determina o raio do brilho do lampião, maior dispersão à noite
     * @returns {number} Raio geométrico do ponto de luz
     * @private
     */
    _lanternRadius() {
        return this.lanternBaseRadius + this._nightFactor() * 10.0;
    }

    /**
     * Calcula e atualiza a iluminação do Sol e do céu no mundo 3D conforme o ângulo solar.
     * @private
     */
    _applySunLighting() {
        const d = this._sunDir();
        const sunHeight = Math.max(0.0, d[1]);
        const day = this._sunVisibility();
        const night = this._nightFactor();
        const twilight = this.twilightFactor ?? 0.0;
        const sunDisk = this.sunDiskVisibility ?? 0.0;
        const sunEnergy = sunDisk * (0.22 + 0.78 * day);
        const warm = Math.max(twilight * 1.25, (1.0 - sunHeight) * day * 0.72);

        const diffuseR = this._lerp(1.0, 1.0, sunHeight);
        const diffuseG = this._lerp(0.48, 0.92, sunHeight);
        const diffuseB = this._lerp(0.22, 0.84, sunHeight);

        const specularR = (0.35 + 0.45 * day) * sunDisk;
        const specularG = (0.18 + 0.42 * sunHeight) * sunDisk;
        const specularB = (0.08 + 0.46 * sunHeight) * sunDisk;

        this.lights[0].setPosition(d[0], d[1], d[2], 0.0);
        this.lights[0].setAmbient(
            0.004 + 0.026 * sunEnergy + 0.020 * twilight,
            0.004 + 0.022 * sunEnergy + 0.012 * twilight,
            0.010 + 0.018 * sunEnergy + 0.004 * twilight,
            1.0
        );
        this.lights[0].setDiffuse(
            diffuseR * sunEnergy,
            diffuseG * sunEnergy,
            diffuseB * sunEnergy,
            1.0
        );
        this.lights[0].setSpecular(
            specularR,
            specularG,
            specularB,
            1.0
        );

        this.setGlobalAmbientLight(
            0.010 + 0.055 * day + 0.060 * twilight,
            0.014 + 0.048 * day + 0.030 * twilight,
            0.034 + 0.040 * day + 0.008 * twilight,
            1.0
        );
        this.lights[1].setAmbient(
            0.012 + 0.055 * day,
            0.014 + 0.052 * day,
            0.032 + 0.055 * day,
            1.0
        );
        this.lights[1].setDiffuse(
            0.018 + 0.075 * day + 0.080 * warm,
            0.022 + 0.075 * day + 0.038 * warm,
            0.050 + 0.105 * day + 0.010 * night,
            1.0
        );
    }

    /**
     * Atualiza as componentes cromáticas e atenuação da luz do lampião da carroça.
     * @private
     */
    _applyLanternLighting() {
        const night = this._nightFactor();
        const intensity = this._lanternIntensity();
        this.lights[2].setAmbient(0.015 + 0.025 * night, 0.008 + 0.015 * night, 0.0, 1.0);
        this.lights[2].setDiffuse(0.52 + 0.10 * intensity / 3.0, 0.38 + 0.10 * intensity / 3.0, 0.16 + 0.08 * intensity / 3.0, 1.0);
        this.lights[2].setSpecular(0.45 + 0.10 * night, 0.35 + 0.10 * night, 0.18 + 0.08 * night, 1.0);
        this.lights[2].setConstantAttenuation(0.28);
        this.lights[2].setLinearAttenuation(0.042 - 0.010 * Math.min(night, 1.0));
        this.lights[2].setQuadraticAttenuation(0.012 - 0.003 * Math.min(night, 1.0));
    }

    /**
     * Retorna a coordenada de referência no mundo para cálculo das lanternas das cercas mais próximas.
     * @returns {Object} Ponto de referência {x, z}
     * @private
     */
    _fenceLanternReference() {
        if (this.wagon) {
            return { x: this.wagon.wagonX ?? 0.0, z: this.wagon.wagonZ ?? 0.0 };
        }

        const p = this.camera && this.camera.position;
        return { x: p ? p[0] : 0.0, z: p ? p[2] : 0.0 };
    }

    /**
     * Recupera as posições no mundo 3D das cercas mais próximas da referência.
     * @param {number} maxCount Quantidade máxima de pontos de luz a processar
     * @returns {Array<Array<number>>} Vetor de posições [x, y, z]
     * @private
     */
    _fenceLanternWorldPositions(maxCount = this.fenceLanternLightCount) {
        if (!this.roadFence || typeof this.roadFence.getLanternWorldPositions !== 'function') {
            return [];
        }
        return this.roadFence.getLanternWorldPositions(this._fenceLanternReference(), maxCount);
    }

    /**
     * Aplica e posiciona as luzes dos postes de iluminação ao longo da estrada (lights 4-7).
     * @private
     */
    _applyFenceLanternLighting() {
        const start = this.fenceLanternLightStart ?? 4;
        const count = this.fenceLanternLightCount ?? 4;
        const positions = this._fenceLanternWorldPositions(count);
        const night = this._nightFactor();
        const power = 0.55 + night * 1.8;

        for (let i = 0; i < count; i++) {
            const light = this.lights[start + i];
            if (!light) continue;

            const p = positions[i];
            if (!p) {
                light.setPosition(0, -1000, 0, 1.0);
                light.setAmbient(0.0, 0.0, 0.0, 1.0);
                light.setDiffuse(0.0, 0.0, 0.0, 1.0);
                light.setSpecular(0.0, 0.0, 0.0, 1.0);
                light.update();
                continue;
            }

            light.setPosition(p[0], p[1], p[2], 1.0);
            light.setAmbient(0.04 * power, 0.022 * power, 0.004 * power, 1.0);
            light.setDiffuse(1.0 * power, 0.68 * power, 0.22 * power, 1.0);
            light.setSpecular(0.9 * power, 0.55 * power, 0.18 * power, 1.0);
            light.setConstantAttenuation(0.12);
            light.setLinearAttenuation(0.014 - 0.006 * night);
            light.setQuadraticAttenuation(0.003 - 0.001 * night);
            light.update();
        }
    }

    // ── 4. CONTROLADOR DA INTERFACE GRÁFICA HTML ──────────────

    /**
     * Mapeia os elementos DOM do menu e do HUD e regista os manipuladores de cliques.
     * @private
     */
    _initGameplayHud() {
        this.hud = {
            root: document.getElementById('game-hud'),
            status: document.getElementById('hud-status'),
            hpValue: document.getElementById('hud-hp-value'),
            hpFill: document.getElementById('hud-hp-fill'),
            time: document.getElementById('hud-time'),
            cargo: document.getElementById('hud-cargo'),
            speed: document.getElementById('hud-speed'),
            gameOver: document.getElementById('hud-game-over'),
            finalScore: document.getElementById('hud-final-score'),
            restartButton: document.getElementById('hud-restart-button'),
            startMenu: document.getElementById('start-menu'),
            startButton: document.getElementById('start-game-button'),
            startStatus: document.getElementById('start-status'),
            startStatusText: document.getElementById('start-status-text'),
            countdown: document.getElementById('start-countdown'),
            action: document.getElementById('hud-action'),
            actionKey: document.getElementById('hud-action-key'),
            actionText: document.getElementById('hud-action-text'),
            damageIndicator: document.getElementById('hud-damage-indicator'),
            healIndicator: document.getElementById('hud-heal-indicator'),
            delivered: document.getElementById('hud-delivered')
        };

        this._bindGameplayHudEvents();
        this._updateStartMenuState();
        this._updateGameplayHud();
    }

    /**
     * Vincula eventos de clique aos botões de arranque e recomeço.
     * @private
     */
    _bindGameplayHudEvents() {
        if (this._hudEventsBound) return;
        this._hudEventsBound = true;

        if (this.hud && this.hud.restartButton) {
            this.hud.restartButton.addEventListener('click', () => this.resetGame());
        }

        if (this.hud && this.hud.startButton) {
            this.hud.startButton.addEventListener('click', () => this.startGameFromMenu());
        }
    }

    /**
     * Atualiza o estado visual do menu de início
     * @private
     */
    _updateStartMenuState() {
        if (!this.hud) return;

        if (this.hud.startButton) {
            const show = this.sceneReady && !this.startCountdownActive && !this.gameStarted;
            this.hud.startButton.style.display = show ? 'inline-block' : 'none';
            this.hud.startButton.disabled = !this.sceneReady || this.startCountdownActive;
        }

        if (this.hud.startStatusText) {
            this.hud.startStatusText.textContent = this.sceneReady ? 'Ready' : 'Preparing trail';
        }

        if (this.hud.startStatus) {
            this.hud.startStatus.classList.toggle('ready', this.sceneReady);
            // Hide the status loader once the game starts or countdown is active
            this.hud.startStatus.style.display = (this.gameStarted || this.startCountdownActive) ? 'none' : 'flex';
        }
    }

    /**
     * Formata segundos decorridos em string de tempo MM:SS.
     * @param {number} seconds Tempo decorrido
     * @returns {string} Formato MM:SS
     * @private
     */
    _formatElapsedTime(seconds) {
        const totalSeconds = Math.floor(seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        if (minutes <= 0) return `${secs}s`;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Atualiza todas as métricas em tempo real no HUD de jogo (HP, velocidade, carga, alarmes).
     * @private
     */
    _updateGameplayHud() {
        if (!this.hud || !this.hud.root) return;

        const hp = Math.max(0, this.wagonHP);
        const hpPct = this.initialWagonHP > 0 ? Math.max(0, Math.min(1, hp / this.initialWagonHP)) : 0;
        const speed = this.wagon ? this.wagon.speed : 0;

        if (this.hud.hpValue) this.hud.hpValue.textContent = `${Math.ceil(hp)}`;
        if (this.hud.hpFill) this.hud.hpFill.style.width = `${hpPct * 100}%`;
        if (this.hud.time) this.hud.time.textContent = this._formatElapsedTime(this.elapsedTime);
        if (this.hud.cargo) this.hud.cargo.textContent = `${this.carriedBales}/${this.maxCarriedBales}`;
        if (this.hud.delivered) this.hud.delivered.textContent = `${this.deliveredBales}`;
        if (this.hud.speed) this.hud.speed.textContent = speed.toFixed(1);
        if (this.hud.status) {
            let status = 'At the ranch';
            if (this.gameOver) status = 'Game Over';
            else if (this.startCountdownActive) status = 'Get ready';
            else if (this.collisionFeedbackTime > 0) status = `-${this.lastCollisionDamage} HP`;
            else if (this.gameStarted) status = 'On route';
            this.hud.status.textContent = status;
        }

        if (this.hud.root) {
            this.hud.root.hidden = !this.gameStarted && !this.startCountdownActive && !this.gameOver;
        }

        this.hud.root.classList.toggle('hp-low', hpPct <= 0.5 && hpPct > 0.25);
        this.hud.root.classList.toggle('hp-critical', hpPct <= 0.25);
        this.hud.root.classList.toggle('impact', this.collisionFeedbackTime > 0);
        this.hud.root.classList.toggle('heal', this.healthRestoreFeedbackTime > 0);

        if (this.hud.gameOver) {
            this.hud.gameOver.hidden = !this.gameOver;
        }
        if (this.hud.finalScore) {
            this.hud.finalScore.textContent = `${this.finalScore} seconds`;
        }

        if (this.hud.action) {
            this.hud.action.hidden = !this._actionPrompt;
        }
        if (this.hud.actionText && this._actionPrompt) {
            this.hud.actionText.textContent = this._actionPrompt;
        }
        if (this.hud.actionKey && this._actionKeyHint) {
            this.hud.actionKey.textContent = this._actionKeyHint;
        }
    }

    /**
     * Updates the read-only numeric bars shown in DAT.gui.
     * @private
     */
    _updateGuiMetrics() {
        this.guiHealthPoints = Math.ceil(Math.max(0, this.wagonHP));
        this.guiInstantDamage = this.collisionFeedbackTime > 0 ? this.lastCollisionDamage : 0;
        this.guiInstantHealthRestored = this.healthRestoreFeedbackTime > 0 ? this.lastHealthRestored : 0;
        this.guiDeliveredBales = this.deliveredBales;
        this.guiScoreTime = Math.floor(this.elapsedTime);
    }

    /**
     * Aplica o desgaste passivo de HP e avança o temporizador de jogo.
     * @param {number} dt Delta de tempo
     * @private
     */
    _updateGameplay(dt) {
        if (!this.gameStarted || this.gameOver || this.startCountdownActive) return;

        this.elapsedTime += dt;
        this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
        this.collisionFeedbackTime = Math.max(0, this.collisionFeedbackTime - dt);
        this.healthRestoreFeedbackTime = Math.max(0, this.healthRestoreFeedbackTime - dt);
        this.wagonHP = Math.max(0, this.wagonHP - this.hpLossPerSecond * dt);

        if (this.wagonHP <= 0) {
            this._finishGame();
        }
    }

    // ── 5. DETEÇÃO DE COLISÕES, DANOS E FLUTUADORES HUD ────────────────────

    /**
     * Processa a colisão sofrida pela carroça aplicando dano escalado com a velocidade do impacto.
     * @param {Object} collision Informações do obstáculo colidido
     * @returns {boolean} True se o dano foi registado, false se ignorado
     */
    applyCollisionDamage(collision) {
        if (!this.gameStarted || this.gameOver || this.startCountdownActive) return false;
        if (!collision || !collision.damageable) return false;
        if (this.collisionCooldown > 0) return false;

        // Dano baseado na velocidade de impacto
        const impactSpeed = collision.impactSpeed ?? 0;
        const maxSpeed = (this.wagon && this.wagon.maxSpeed) ? this.wagon.maxSpeed : 8.0;
        const speedRatio = Math.min(Math.max(impactSpeed / maxSpeed, 0), 1);
        const damage = Math.ceil(this.collisionBaseDamage + speedRatio * this.collisionBonusDamage);

        this.lastCollisionDamage = damage;
        this.collisionFeedbackTime = 0.55;
        this.collisionCooldown = this.collisionCooldownDuration ?? 1.0;
        this.wagonHP = Math.max(0, this.wagonHP - damage);

        if (this.wagonHP <= 0) {
            this._finishGame();
        }

        console.log(`Colisao com ${collision.type} (v=${impactSpeed.toFixed(1)}): -${damage} HP`);
        this._showDamageIndicator(damage);
        return true;
    }

    /**
     * Força o ecrã a tremer e a piscar e projeta o indicador de dano flutuante no DOM.
     * @param {number} damage Valor numérico do dano sofrido
     * @private
     */
    _showDamageIndicator(damage) {
        // Forçar re-trigger da animação de impacto
        if (this.hud && this.hud.root) {
            this.hud.root.classList.remove('impact');
            void this.hud.root.offsetWidth; // reflow
            this.hud.root.classList.add('impact');
        }

        // Indicador flutuante de dano
        const el = this.hud && this.hud.damageIndicator;
        if (!el) return;

        el.textContent = `-${damage} HP`;
        el.classList.remove('active');
        void el.offsetWidth; // reflow
        el.classList.add('active');
    }

    /**
     * Triggers the green floating HP gain indicator after delivering hay bales.
     * @param {number} amount Amount of HP restored
     * @private
     */
    _showHealIndicator(amount) {
        if (amount <= 0) return;

        if (this.hud && this.hud.root) {
            this.hud.root.classList.remove('heal');
            void this.hud.root.offsetWidth; // reflow
            this.hud.root.classList.add('heal');
        }

        const el = this.hud && this.hud.healIndicator;
        if (!el) return;

        el.textContent = `+${amount} HP`;
        el.classList.remove('active');
        void el.offsetWidth; // reflow
        el.classList.add('active');
    }

    // ── 6. CONTROLOS DO TECLADO E INPUT DE INTERAÇÃO ────────────────────────

    /**
     * Verifica se uma tecla específica está premida no teclado físico.
     * @param {string} code Código identificador da tecla
     * @returns {boolean} True se a tecla estiver ativamente premida
     * @private
     */
    _isKeyPressed(code) {
        return !!(this.gui && this.gui.isKeyPressed && this.gui.isKeyPressed(code));
    }

    /**
     * Garante o consumo único de um evento de pressão de tecla
     * @param {string} code Código da tecla
     * @param {string} lastStateKey Nome da variável onde é mantido o estado anterior da tecla
     * @returns {boolean} True apenas no primeiro frame de pressão da tecla
     * @private
     */
    _consumeKeyPress(code, lastStateKey) {
        const pressed = this._isKeyPressed(code);
        const lastState = this[lastStateKey] || false;
        const justPressed = pressed && !lastState;
        this[lastStateKey] = pressed;
        return justPressed;
    }

    /**
     * Atualiza o prompt de instruções HUD exibido ao jogador com base na proximidade física a elementos acionáveis.
     * @private
     */
    _updateInteractionPrompt() {
        this._actionPrompt = null;
        this._actionKeyHint = null;

        if (!this.gameStarted || this.gameOver || this.startCountdownActive || !this.wagon) return;

        const canDeliver = this.baleZone && this.baleZone.wagonInside && this.carriedBales > 0;
        if (canDeliver) {
            this._actionPrompt = `Deliver ${this.carriedBales} bale${this.carriedBales > 1 ? 's' : ''}`;
            this._actionKeyHint = 'L';
            return;
        }

        const nearbyBale = this.hayBaleManager
            ? this.hayBaleManager.getNearestCollectibleBale(this.wagon.wagonX, this.wagon.wagonZ)
            : null;

        if (!nearbyBale) return;

        if (this.carriedBales >= this.maxCarriedBales) {
            this._actionPrompt = 'Cargo full';
            this._actionKeyHint = null;
        } else {
            this._actionPrompt = 'Collect bale';
            this._actionKeyHint = 'P';
        }
    }

    /**
     * Processa a pressão de teclas de ação para apanhar fardos de palha (KeyP) ou descarregar na zona (KeyL).
     * @private
     */
    _handleInteractionAction() {
        if (!this.gameStarted || this.gameOver || this.startCountdownActive || !this.wagon) return;

        // Pick up (P)
        if (this._consumeKeyPress('KeyP', '_lastPState')) {
            if (this.hayBaleManager) {
                this.hayBaleManager.tryCaptureNearest(this.wagon.wagonX, this.wagon.wagonZ);
            }
        }

        // Deliver (L)
        if (this._consumeKeyPress('KeyL', '_lastLState')) {
            if (this.baleZone && this.baleZone.wagonInside && this.carriedBales > 0) {
                const maxHP = Math.min(this.initialWagonHP, 100);
                const previousHP = this.wagonHP;
                this.wagonHP = Math.min(maxHP, this.wagonHP + this.carriedBales * this.hayBaleValue);
                this.lastHealthRestored = Math.ceil(Math.max(0, this.wagonHP - previousHP));
                if (this.lastHealthRestored > 0) {
                    this.healthRestoreFeedbackTime = 1.0;
                    this._showHealIndicator(this.lastHealthRestored);
                } else {
                    this.healthRestoreFeedbackTime = 0;
                }
                this.deliveredBales += this.carriedBales;
                this.carriedBales = 0;
                if (typeof this.baleZone.triggerDeliveryFeedback === 'function') {
                    this.baleZone.triggerDeliveryFeedback(this.deliveredBales);
                }
            }
        }

        this._updateInteractionPrompt();
    }

    // ── 7. CONTROLOS DE ESTADO DO JOGO (START, END, RESTART) ────────────────

    /**
     * Sinaliza o fim da corrida e bloqueia a cinemática da carroça.
     * @private
     */
    _finishGame() {
        if (this.gameOver) return;

        this.gameOver = true;
        this.finalScore = Math.floor(this.elapsedTime);
        this.wagonHP = 0;

        if (this.wagon) {
            this.wagon.speed = 0;
        }

        console.log(`Fim da viagem. Sobreviveu ${this.finalScore}s`);
    }

    /**
     * Repõe todos os parâmetros iniciais de gameplay para reiniciar a corrida.
     * @param {Object} options Parâmetros de arranque rápido
     */
    resetGame(options = {}) {
        const startImmediately = options.startImmediately !== false;

        this.gameStarted = startImmediately;
        this.gameOver = false;
        this.startCountdownActive = false;
        this.wagonHP = this.initialWagonHP;
        this.elapsedTime = 0;
        this.finalScore = 0;
        this.carriedBales = 0;
        this.deliveredBales = 0;
        if (this.baleZone) {
            this.baleZone.deliveredBales = 0;
        }
        this.collisionCooldown = 0;
        this.lastCollisionDamage = 0;
        this.collisionFeedbackTime = 0;
        this.lastHealthRestored = 0;
        this.healthRestoreFeedbackTime = 0;
        this._updateGuiMetrics();
        this._actionPrompt = null;
        this._lastInteractPressed = false;

        this._wagonPlacedAtStart = false;
        this.placeWagonAtStart();

        if (this.wagon) {
            this.wagon.speed = 0;
            this.wagon.steeringAngle = 0;
            this.wagon.wheelRotation = 0;
            this.wagon.knockbackTimer = 0;
            this.wagon.knockbackVelX = 0;
            this.wagon.knockbackVelZ = 0;
            this.wagon._terrainPoseInitialized = false;
            this.wagon._wheelSuspension = null;
        }

        if (this.hayBaleManager && typeof this.hayBaleManager.resetCaptures === 'function') {
            this.hayBaleManager.resetCaptures();
        }

        if (this.hud && this.hud.startMenu && startImmediately) {
            this.hud.startMenu.hidden = true;
            this.hud.startMenu.classList.remove('is-starting');
        }

        if (this.hud && this.hud.countdown) {
            this.hud.countdown.hidden = true;
        }

        this._markSceneReadyIfGameplayLoaded();
        this._updateStartMenuState();
        this._updateGameplayHud();
    }

    /**
     * Inicia a sequência de contagem decrescente antes do jogo começar.
     */
    startGameFromMenu() {
        if (!this.sceneReady || this.startCountdownActive) return;

        this.resetGame({ startImmediately: false });
        this.activeCameraId = 'Wagon';
        this.updateCamera();
        this.startCountdownActive = true;

        if (this.hud && this.hud.startMenu) {
            this.hud.startMenu.classList.add('is-starting');
        }

        const values = ['3', '2', '1', 'Go!'];
        let index = 0;

        if (this.hud && this.hud.countdown) {
            this.hud.countdown.textContent = values[index];
            this.hud.countdown.hidden = false;
        }

        this._updateStartMenuState();
        this._updateGameplayHud();

        const tick = () => {
            index++;

            if (index < values.length) {
                if (this.hud && this.hud.countdown) {
                    this.hud.countdown.textContent = values[index];
                }
                setTimeout(tick, 900);
                return;
            }

            this.startCountdownActive = false;
            this.gameStarted = true;

            if (this.hud && this.hud.startMenu) {
                this.hud.startMenu.hidden = true;
                this.hud.startMenu.classList.remove('is-starting');
            }
            if (this.hud && this.hud.countdown) {
                this.hud.countdown.hidden = true;
            }

            this._updateStartMenuState();
            this._updateGameplayHud();
        };

        setTimeout(tick, 900);
    }

    /**
     * Posiciona a carroça e o cavalo de forma alinhada na zona de entrega em frente ao celeiro
     */
    placeWagonAtStart() {
        if (!this.wagon || !this.barn || !this.barn.barn || !this.baleZone || !this.baleZone._placed) return;

        const b = this.barn.barn;
        const frontDirX = -Math.sin(b.yaw);
        const frontDirZ = -Math.cos(b.yaw);

        this.wagon.wagonX = this.baleZone.x;
        this.wagon.wagonZ = this.baleZone.z;
        this.wagon.wagonAngle = Math.atan2(-frontDirZ, frontDirX);
        this.wagon.speed = 0;
        this.wagon.steeringAngle = 0;
        this.wagon.wheelRotation = 0;
        this.wagon.wagonPitch = 0;
        this.wagon.wagonRoll = 0;
        this.wagon._terrainPoseInitialized = false;
        this.wagon._wheelSuspension = null;

        if (this.grass && typeof this.grass.sampleHeight === 'function') {
            this.wagon.wagonY = this.grass.sampleHeight(this.wagon.wagonX, this.wagon.wagonZ) + 3.375;
        } else {
            this.wagon.wagonY = b.y + 3.375;
        }

        this._wagonPlacedAtStart = true;
        this._markSceneReadyIfGameplayLoaded();
        console.log(`Wagon start at (${this.wagon.wagonX.toFixed(1)}, ${this.wagon.wagonY.toFixed(1)}, ${this.wagon.wagonZ.toFixed(1)})`);
    }

    /**
     * Sinaliza que o cenário e elementos de jogabilidade foram carregados e a simulação está pronta.
     * @private
     */
    _markSceneReadyIfGameplayLoaded() {
        this.sceneReady = this._wagonPlacedAtStart && this._hayBalesReady;
        this._updateStartMenuState();
    }

    // ── 8. RECONSTRUÇÃO PROCEDURAL DE FLORES, ROCHAS E CERCAS ────────────────

    /**
     * Método invocado a cada frame da simulação para calcular o delta de tempo,
     * atualizar cinemática das entidades, movimentar a câmara e recolher dados do teclado.
     * @param {number} t Carimbo de data/hora atual em milissegundos
     */
    update(t) {
        if (this._lastT === undefined) this._lastT = t;
        let dt = (t - this._lastT) / 1000.0;
        this._lastT = t;

        this._updateGameplay(dt);

        if (this.animateSun && this.gameStarted && !this.gameOver && !this.startCountdownActive) {
            this._updateDayNightCycle(dt);
        } else {
            this.sunAzimuth = this._normalizeAngle(this.sunAzimuth);
            this._syncSunFactorsFromElevation();
        }

        this.clouds.update(t / 1000.0);
        this.terrain.update(t);
        if (this.wagon && typeof this.wagon.update === 'function') this.wagon.update(dt);
        if (this.grass && typeof this.grass.update === 'function') this.grass.update(t);
        if (this.flowers && typeof this.flowers.update === 'function') this.flowers.update(t);
        if (this.rocks && typeof this.rocks.update === 'function') this.rocks.update(t);
        if (this.hayBaleManager && typeof this.hayBaleManager.update === 'function') this.hayBaleManager.update(t);

        // Atualizar a câmara de acompanhamento
        if (this.activeCameraId === 'Wagon' && this.wagon) {
            const offsetDist = this.wagonCameraDistance ?? 45.0;
            const heightOffset = this.wagonCameraHeight ?? 18.0;
            const sideOffset = this.wagonCameraSideOffset ?? 0.0;
            const targetForward = this.wagonCameraTargetForward ?? 5.0;
            const targetHeight = this.wagonCameraTargetHeight ?? 3.5;
            const targetSideOffset = this.wagonCameraTargetSideOffset ?? 0.0;
            const forwardX = Math.cos(this.wagon.wagonAngle);
            const forwardZ = -Math.sin(this.wagon.wagonAngle);
            const rightX = Math.sin(this.wagon.wagonAngle);
            const rightZ = Math.cos(this.wagon.wagonAngle);

            // A carroça aponta para a frente no seu X+. Atrás é X-.
            let cx = this.wagon.wagonX - forwardX * offsetDist + rightX * sideOffset;
            let cz = this.wagon.wagonZ - forwardZ * offsetDist + rightZ * sideOffset;
            let cy = this.wagon.wagonY + heightOffset;

            // O alvo será ligeiramente à frente do centro da carroça
            let tx = this.wagon.wagonX + forwardX * targetForward + rightX * targetSideOffset;
            let tz = this.wagon.wagonZ + forwardZ * targetForward + rightZ * targetSideOffset;
            let ty = this.wagon.wagonY + targetHeight; // Alvo um pouco mais elevado para centrar melhor

            this.camera.setPosition(vec3.fromValues(cx, cy, cz));
            this.camera.setTarget(vec3.fromValues(tx, ty, tz));
        }
        if (this.baleZone && this.wagon) {
            this.baleZone.update(this.wagon.wagonX, this.wagon.wagonZ, t);
        }

        this._updateInteractionPrompt();
        this._handleInteractionAction();
        this._updateGameplayHud();
        this._updateGuiMetrics();
    }

    /**
     * Tenta instanciar e posicionar o celeiro no relevo assim que o mapa de alturas e estradas esteja pronto.
     * @private
     */
    _rebuildBarnWhenReady() {
        if (!this.grass || !this.grass.heightImageData || !this.grass.roadMaskReady) {
            setTimeout(() => this._rebuildBarnWhenReady(), 200);
            return;
        }
        this.barn.buildFromHeightmap(this.grass);

        const b = this.barn.barn;
        const doorDist = 42.0;
        const localZ = -12.0 - doorDist;

        const cosY = Math.cos(b.yaw);
        const sinY = Math.sin(b.yaw);
        this.baleZone.x = b.x + localZ * (-sinY);
        this.baleZone.z = b.z + localZ * cosY;
        this.baleZone.y = b.y;
        this.baleZone._placed = true;

        if (!this._wagonPlacedAtStart) {
            this.placeWagonAtStart();
        }

        console.log(`BaleZone at (${this.baleZone.x.toFixed(1)}, ${this.baleZone.y.toFixed(1)}, ${this.baleZone.z.toFixed(1)})`);

        this._rebuildRoadFenceWhenReady();
    }

    /**
     * Tenta construir as flores a partir dos clusters da relva.
     * Espera que os clusters E o height map estejam prontos.
     * @private
     */
    _rebuildFlowersWhenReady() {
        const clusters = this.grass.getClusters();
        // Esperar que os clusters existam E que o height map tenha carregado
        if (clusters.length === 0 || !this.grass.heightImageData || !this.grass.roadMaskReady) {
            setTimeout(() => this._rebuildFlowersWhenReady(), 200);
            return;
        }
        const flowers = new MyFlower(this);
        flowers.buildFromClusters(clusters, this.grass);

        const patches = flowers.getFlowerPatches();
        const clearingChanged =
            this._lastFlowerClearingRadius !== this.flowerClearingRadius ||
            this._lastFlowerClearingStrength !== this.flowerClearingStrength;

        this.grass.flowerClearingRadius = this.flowerClearingRadius;
        this.grass.flowerClearingStrength = this.flowerClearingStrength;

        if (clearingChanged || !this._sameFlowerPatches(this.grass.getFlowerPatches(), patches)) {
            this._lastFlowerClearingRadius = this.flowerClearingRadius;
            this._lastFlowerClearingStrength = this.flowerClearingStrength;
            this.grass.setFlowerPatches(patches);
            this.flowers = new MyFlower(this);
            this.flowers.buildFromClusters(this.grass.getClusters(), this.grass);
            this._rebuildRocksWhenReady();
            return;
        }

        this.flowers = flowers;
    }

    /**
     * Compara se duas listas de flores são geometricamente iguais.
     * @private
     */
    _sameFlowerPatches(a = [], b = []) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (Math.abs(a[i].x - b[i].x) > 0.001) return false;
            if (Math.abs(a[i].z - b[i].z) > 0.001) return false;
            if (Math.abs(a[i].radius - b[i].radius) > 0.001) return false;
        }
        return true;
    }

    /**
     * Gera os fardos de palha no mapa com base no heightmap.
     * @private
     */
    _rebuildHayBalesWhenReady() {
        if (
            !this.grass ||
            !this.grass.heightImageData ||
            !this.grass.roadMaskReady ||
            !this.baleZone ||
            !this.baleZone._placed ||
            !this._wagonPlacedAtStart
        ) {
            setTimeout(() => this._rebuildHayBalesWhenReady(), 200);
            return;
        }

        this.hayBaleManager = new MyHayBaleManager(this);
        this.hayBaleManager.buildFromHeightmap(this.grass);
        this._hayBalesReady = true;
        this._markSceneReadyIfGameplayLoaded();
    }

    /**
     * Cria e estende as cercas e postes de madeira ao longo das margens da estrada.
     * @private
     */
    _rebuildRoadFenceWhenReady() {
        if (!this.grass || !this.grass.heightImageData || !this.grass.roadMaskReady) {
            setTimeout(() => this._rebuildRoadFenceWhenReady(), 200);
            return;
        }

        this.roadFence = new MyFence(this);
        const clearings = [];
        if (this.barn && this.barn.barn) {
            clearings.push({ x: this.barn.barn.x, z: this.barn.barn.z, radius: 30.0 });
        }
        if (this.baleZone && this.baleZone._placed) {
            clearings.push({ x: this.baleZone.x, z: this.baleZone.z, radius: this.baleZone.radius + 14.0 });
        }
        if (this.wagon && this._wagonPlacedAtStart) {
            clearings.push({ x: this.wagon.wagonX, z: this.wagon.wagonZ, radius: 22.0 });
        }
        this.roadFence.buildAlongRoad(this.grass, {
            threshold: 0.62,
            offset: 8.0,
            postSpacing: 10.0,
            gateEvery: 14,
            gateWidth: 30.0,
            minContourLength: 140.0,
            maxContours: 2,
            maxInnerContours: 1,
            minSecondaryContourLength: 180.0,
            minSecondaryContourArea: 1400.0,
            simplifyEpsilon: 5.0,
            smoothingPasses: 3,
            clearings,
        });
    }

    /**
     * Tenta construir as rochas a partir do height map da relva.
     * @private
     */
    _rebuildRocksWhenReady() {
        if (!this.grass || !this.grass.heightImageData || !this.grass.roadMaskReady) {
            setTimeout(() => this._rebuildRocksWhenReady(), 200);
            return;
        }
        this.rocks = new MyRock(this);
        this.rocks.buildFromHeightmap(this.grass);
        const rockPatches = this.rocks.getRockPatches();
        if (!this._sameFlowerPatches(this.grass.getRockPatches(), rockPatches)) {
            this.grass.setRockPatches(rockPatches);
        }
    }

    // ── 9. FUNÇÃO DE RENDERIZAÇÃO DA CEN ────────────────────

    /**
     * Desenha a cena 3D inteira. Aplica matrizes de câmara e luzes, atualiza o skydome,
     * nuvens, Sol, terreno e todos os objetos (relva, flores, rochas, carroça, celeiro e cercas).
     */
    display() {
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.updateProjectionMatrix();
        this.loadIdentity();
        this.applyViewMatrix();

        // Verificação de alterações na geometria.
        if (
            this.stacks !== this._lastStacks ||
            this.slices !== this._lastSlices ||
            this.skyRadius !== this._lastSkyRadius
        ) {
            this.hemisphere.updateBuffers(this.skyRadius, this.slices, this.stacks);
            this.clouds.updateBuffers(this.skyRadius * 0.99, this.slices, this.stacks);
            this._lastStacks = this.stacks;
            this._lastSlices = this.slices;
            this._lastSkyRadius = this.skyRadius;
        }

        if (this.wireframe !== this._lastWireframe) {
            this.wireframe ? this.hemisphere.setLineMode() : this.hemisphere.setFillMode();
            this._lastWireframe = this.wireframe;
        }

        // 1. Desenhar o Céu rimeiro.
        // Atualizar luz solar
        const sp = this._sunWorldPos();
        this._applySunLighting();
        this._applyLanternLighting();
        this.lights[0].update();
        this.lights[1].update();
        const lp = this._lanternWorldPos();
        this.lights[2].setPosition(lp[0], lp[1], lp[2], 1.0);
        this.lights[2].update();

        // Luz do beacon do bale zone
        if (this.baleZone && this.baleZone._placed) {
            const bp = this.baleZone.getLanternWorldPos();
            const bc = typeof this.baleZone.getLightColor === 'function'
                ? this.baleZone.getLightColor()
                : [1.0, 0.65, 0.18];
            const bi = typeof this.baleZone.getLightIntensity === 'function'
                ? this.baleZone.getLightIntensity()
                : 1.0;
            this.lights[3].setPosition(bp[0], bp[1], bp[2], 1.0);
            this.lights[3].setDiffuse(bc[0] * bi, bc[1] * bi, bc[2] * bi, 1.0);
            this.lights[3].setSpecular(bc[0] * 0.8, bc[1] * 0.8, bc[2] * 0.8, 1.0);
        }
        this.lights[3].update();
        this._applyFenceLanternLighting();

        this.gl.depthMask(false);

        // 1. Skydome procedural, reativo ao sol.
        this.skyShader.setUniformsValues({
            uSunDir: this._sunDir(),
            uSunVisibility: this._sunVisibility(),
            uTwilightFactor: this.twilightFactor,
            uStarVisibility: this.starVisibility,
            uSunDiskVisibility: this.sunDiskVisibility,
        });
        this.setActiveShader(this.skyShader);
        this.skyMaterial.apply();
        this.hemisphere.display();
        this.setActiveShader(this.defaultShader);

        // 2. Nuvens — blending alpha por cima do dome
        this.clouds.display(this.cloudCover, this.cloudSpeed);

        if (this.sunElevation > 0.0 && this.sunDiskVisibility > 0.01) {
            this.pushMatrix();
            this.translate(sp[0], sp[1], sp[2]);
            this.sun.display(this.sunDiskVisibility);
            this.popMatrix();
        }

        this.gl.depthMask(true);

        // 4. Resto da cena
        if (this.displayAxis) this.axis.display();

        // 3. Desenhar o Terreno
        this.terrainMaterial.apply(); // Aplica a textura do chão 
        this.terrain.display();       // Chama a rotina de desenho do terreno

        // Vegetação e rochas
        this.grass.display();
        if (this.flowers) this.flowers.display();
        if (this.rocks) this.rocks.display();
        if (this.hayBaleManager) this.hayBaleManager.display();

        // Carroça
        if (this.wagon) this.wagon.display();
        if (this.barn) this.barn.display();
        if (this.roadFence) this.roadFence.display();
        if (this.baleZone) this.baleZone.display();
    }
}
