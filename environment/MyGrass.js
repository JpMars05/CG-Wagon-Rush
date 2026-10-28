import { CGFobject, CGFappearance, CGFshader } from '../../lib/CGF.js';
import { MyRandom } from '../utils/MyRandom.js';

/**
 * GrassBatch
 * Representa um lote individual de geometria WebGL para a relva.
 * Agrupa múltiplos tufos num único buffer para minimizar draw calls e maximizar a taxa de frames
 */
class GrassBatch extends CGFobject {
    constructor(scene, vertices, normals, texCoords, indices) {
        super(scene);
        this.vertices = vertices;
        this.normals = normals;
        this.texCoords = texCoords;
        this.indices = indices;
        this.primitiveType = scene.gl.TRIANGLES;
        // Se houver vértices definidos, envia imediatamente os arrays para a VRAM
        if (vertices.length > 0) this.initGLBuffers();
    }
}

/**
 * MyGrass
 * Sistema de relva geométrica e procedural
 * Distribui tufos de relva num padrão de grelha tremida sobre o terreno
 * Evita caminhos de estrada e declives muito acentuados
 * Integra-se com o movimento da carroça para criar um efeito físico de deformação no shader
 */
export class MyGrass extends CGFobject {
    constructor(scene, numTufts = 120) {
        super(scene);
        this.numTufts = numTufts;
        this.worldScale = (this.scene.playAreaRadius ?? 250.0) * 2.0;

        // Gerador de aleatoriedade próprio para a relva
        this.rng = new MyRandom(this.scene.grassSeed ?? 1);

        // ── Parâmetros de Distribuição e Geometria da GUI ────────────────────
        this.fieldSpacing = this.scene.grassFieldSpacing ?? 1.4;
        this.fieldJitter = this.scene.grassFieldJitter ?? 0.92;
        this.bladesPerTuft = this.scene.grassBladesPerTuft ?? 7;
        this.maxSlope = this.scene.grassMaxSlope ?? 0.42;
        this.edgeMargin = this.scene.grassEdgeMargin ?? (this.worldScale * 0.02);
        this.heightScale = 15.0;
        this.heightEpsilon = this.worldScale / 256.0;
        this.grassDensity = this.scene.grassDensity ?? 5.0;
        this.grassHeightScale = this.scene.grassHeightScale ?? 1.6;
        this.bladeWidthScale = this.scene.grassBladeWidthScale ?? 0.064;
        this.bladeCurveScale = this.scene.grassBladeCurveScale ?? 0.29;
        
        // Zonas de limpeza para flores e rochas
        this.flowerClearingRadius = this.scene.flowerClearingRadius ?? 6.0;
        this.flowerClearingStrength = this.scene.flowerClearingStrength ?? 0.72;
        this.flowerPatches = [];
        this.rockPatches = [];

        this._startTime = null;

        // ── Material do Lote de Relva ────────────────────────────────────────
        this.material = new CGFappearance(this.scene);
        this.material.setAmbient(0.10, 0.18, 0.08, 1.0);
        this.material.setDiffuse(0.38, 0.68, 0.24, 1.0);
        this.material.setSpecular(0.02, 0.02, 0.02, 1.0);
        this.material.setEmission(0.0, 0.0, 0.0, 1.0);
        this.material.setShininess(4.0);

        this.heightImageData = null;
        this.roadMaskImageData = null;
        this.roadMaskReady = false;
        this.batches = [];
        this._clusters = [];
        this.roadExclusionThreshold = this.scene.roadExclusionThreshold ?? 0.18;

        // Amostrar texturas de configuração em CPU
        this._loadHeightMap();
        this._loadRoadMask();

        // Shader dedicado para a relva: vento, iluminação direcional e reação à carroça
        this.grassShader = new CGFshader(this.scene.gl, 'shaders/grass.vert', 'shaders/grass.frag');
        this.grassShader.setUniformsValues({
            uHeightMap: 1,
            uWorldScale: this.worldScale,
            uWindStrength: 1.6,
            uWindFreq: 1.1,
            uWindSpeed: 1.25,
            uWindDir: [1.0, 0.0],
            uTime: 0.0,
            uLightDir: this.scene._sunDir(),
            uSunVisibility: 1.0,
            uLanternPos: [0, 0, 0],
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: 18.0,
            uLanternIntensity: 0.0,
            uProceduralGrassColor: 1.0,
            uWagonPosition: [0.0, 0.0],
            uWagonForward: [1.0, 0.0],
            uWagonSpeed: 0.0,
            uWagonInfluenceRadius: this.scene.floraReactionRadius ?? 8.5,
            uWagonWakeLength: this.scene.floraReactionWake ?? 13.0,
            uWagonPushStrength: this.scene.floraReactionStrength ?? 1.15,
        });
    }

    /**
     * Verifica se uma dada coordenada (x, z) se encontra dentro da zona limite de jogo.
     */
    isInPlayArea(x, z, margin = 0.0) {
        const playRadius = (this.scene.playAreaRadius ?? 250.0) - margin;
        return Math.abs(x) <= playRadius && Math.abs(z) <= playRadius;
    }

    /**
     * Carrega o height map para ler e interpolar em CPU no lado do cliente.
     */
    _loadHeightMap() {
        this.scene.assets.getImageData('textures/heigthmap.jpg')
            .then((imageData) => {
                this.heightImageData = imageData;
                // Uma vez que temos os pixéis do terreno, inicializamos os buffers de geometria da relva
                this.initBuffers();
            })
            .catch((error) => {
                console.error(error);
            });
    }

    /**
     * Carrega a máscara da estrada para identificar onde não colocar relva.
     */
    _loadRoadMask() {
        this.scene.assets.getImageData('textures/road_mask.png', { optional: true })
            .then((imageData) => {
                this.roadMaskImageData = imageData;
                this.roadMaskReady = true;
                this.initBuffers();
            })
            .catch((error) => {
                console.warn(error);
                this.roadMaskReady = true;
                this.initBuffers();
            });
    }

    _terrainDataReady() {
        return !!this.heightImageData && this.roadMaskReady;
    }

    _resetEmptyBuffers() {
        this.batches = [];
        this._clusters = [];
    }

    /**
     * Lê e calcula a altura exata do terreno em (x, z).
     * Mapeia as coordenadas mundiais para a textura [0, 1] e combina com as montanhas
     * procedurais calculadas externamente à área de jogo (assegura continuidade geométrica com o shader).
     */
    sampleHeight(x, z) {
        if (!this.heightImageData) return 0;
        const playAreaScale = (this.scene.playAreaRadius ?? 250.0) * 2.0;
        
        // Limitar coordenadas de textura para evitar estouros de índice
        const u = Math.min(1.0, Math.max(0.0, (x / playAreaScale) + 0.5));
        const v = Math.min(1.0, Math.max(0.0, (z / playAreaScale) + 0.5));
        
        const w = this.heightImageData.width;
        const h = this.heightImageData.height;
        const iu = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
        const iv = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
        const idx = (iv * w + iu) * 4; 
        
        return (this.heightImageData.data[idx] / 255.0) * this.heightScale;
    }

    /**
     * Amostra a intensidade da estrada em (x, z).
     * Retorna um valor entre 0 (terreno normal) e 1 (estrada completa).
     */
    sampleRoadMask(x, z) {
        if (!this.roadMaskImageData) return 0;
        const playAreaScale = (this.scene.playAreaRadius ?? 250.0) * 2.0;
        const u = (x / playAreaScale) + 0.5;
        const v = (z / playAreaScale) + 0.5;
        if (u < 0 || u > 1 || v < 0 || v > 1) return 0; // Estrada não existe fora dos limites de jogo
        
        const w = this.roadMaskImageData.width;
        const h = this.roadMaskImageData.height;
        const iu = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
        const iv = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
        const idx = (iv * w + iu) * 4;
        return this.roadMaskImageData.data[idx] / 255.0;
    }

    /**
     * Reconstrói as geometrias de relva agrupadas por lotes.
     * Limpa os lotes antigos e acumula vértices nos arrays antes de instanciar novos batches.
     */
    initBuffers() {
        if (!this._terrainDataReady()) {
            this._resetEmptyBuffers();
            return;
        }

        // Reinicia o gerador determinístico para garantir colocação consistente a cada frame/recriação
        this.rng = new MyRandom(this.scene.grassSeed ?? 1);

        this.batches = [];
        this._beginGrassBatch();

        // Gerar clusters da vegetação através da grelha
        const clusters = this._buildClusters();
        this._clusters = clusters;

        for (const anchor of clusters) {
            const centerY = this.sampleHeight(anchor.x, anchor.z);
            const baseYaw = this.rng.range(0, Math.PI * 2);
            // Calcula o fator de desbaste perto de flores e pedras
            const clearing = this._grassClearingAt(anchor.x, anchor.z);
            const tuftHeight = anchor.heightScale * this.grassHeightScale * (1.0 - clearing);
            // Se o tufo for demasiado pequeno devido a desbaste, salta a sua criação
            if (tuftHeight < 0.12) continue;

            // Insere os tufos correspondentes no lote acumulado
            this._pushBladeTuft(anchor.x, centerY, anchor.z, tuftHeight, baseYaw, clearing);
        }

        this._finishGrassBatch();
        const vertexCount = this.batches.reduce((sum, batch) => sum + batch.vertices.length / 3, 0);
        console.log('MyGrass: anchors=', clusters.length, 'batches=', this.batches.length, 'vertices=', vertexCount);
    }

    getClusters() {
        return this._clusters || [];
    }

    getFlowerPatches() {
        return this.flowerPatches || [];
    }

    getRockPatches() {
        return this.rockPatches || [];
    }

    setFlowerPatches(flowerPatches) {
        this.flowerPatches = flowerPatches || [];
        this.initBuffers();
    }

    setRockPatches(rockPatches) {
        this.rockPatches = rockPatches || [];
        this.initBuffers();
    }

    _beginGrassBatch() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];
    }

    /**
     * Finaliza o lote de relva atual enviando os dados acumulados para a GPU.
     */
    _finishGrassBatch() {
        if (!this.vertices || this.vertices.length === 0) return;
        this.batches.push(new GrassBatch(
            this.scene,
            this.vertices,
            this.normals,
            this.texCoords,
            this.indices
        ));
        this._beginGrassBatch();
    }

    /**
     * Garante que não ultrapassamos os limites de buffers indexados de 16 bits
     * cortando o lote prematuramente e iniciando um novo se necessário.
     */
    _ensureBatchCapacity(extraVertices) {
        const maxVerticesPerBatch = 60000;
        if ((this.vertices.length / 3) + extraVertices > maxVerticesPerBatch) {
            this._finishGrassBatch();
        }
    }

    /**
     * Atualiza os uniformes de vento e carroça do shader.
     */
    update(t) {
        if (!this.grassShader) return;

        // Tempo relativo para evitar a acumulação de erros float32 no shader de vento do GLSL
        if (this._startTime === null) this._startTime = t;
        const time = (t - this._startTime) / 1000.0;

        const angle = (this.scene.windDirection || 0) * Math.PI / 180.0;

        // Atualizar uniformes de deslocamento e física da carroça no shader de vértices
        this.grassShader.setUniformsValues({
            uTime: time,
            uWindStrength: this.scene.windStrength ?? 1.3,
            uWindFreq: this.scene.windFreq ?? 1.1,
            uWindSpeed: this.scene.windSpeed ?? 1.25,
            uWindDir: [Math.cos(angle), Math.sin(angle)],
            uLightDir: this.scene._sunDir(),
            uCameraPos: this.scene.camera.position,
            uSunVisibility: this.scene._sunVisibility(),
            uLanternPos: this.scene._lanternWorldPos(),
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: this.scene._lanternRadius(),
            uLanternIntensity: this.scene._lanternIntensity(),
        });
    }

    /**
     * Distribui as âncoras na área útil, evitando declives ou estradas.
     * Utiliza espaçamento constante ajustado pela densidade mais uma variação (jitter) aleatória.
     */
    _buildClusters() {
        const clusters = [];
        const half = this.worldScale * 0.5 - this.edgeMargin;
        const density = this.grassDensity;
        const spacing = Math.max(1.35, this.fieldSpacing / Math.sqrt(Math.max(0.35, density)));
        const gridSize = Math.max(1, Math.floor((half * 2.0) / spacing));
        const cellSize = (half * 2.0) / gridSize;

        for (let gz = 0; gz < gridSize; gz++) {
            for (let gx = 0; gx < gridSize; gx++) {
                // Calcula coordenadas na grelha aplicando jitter para desorganizar o padrão rígido e parecer natural
                const x = -half + (gx + 0.5 + this.rng.range(-0.5, 0.5) * this.fieldJitter) * cellSize;
                const z = -half + (gz + 0.5 + this.rng.range(-0.5, 0.5) * this.fieldJitter) * cellSize;

                if (!this.isInPlayArea(x, z, this.edgeMargin)) continue;
                // Exclui tufos se estiverem demasiado próximos do meio da estrada
                if (this._isRoadBlocked(x, z, cellSize * 0.35)) continue;
                // Exclui tufos em encostas íngremes
                if (this._slopeAt(x, z) > this.maxSlope) continue;
                
                clusters.push({
                    x,
                    z,
                    radius: cellSize * 0.78,
                    coreRadius: cellSize * 0.32,
                    heightScale: this.rng.range(0.55, 1.28),
                });
            }
        }

        return clusters;
    }

    /**
     * Gera e distribui lâminas individuais dentro do raio de um tufo.
     */
    _pushBladeTuft(cx, cy, cz, heightBase, yaw, clearing) {
        const bladeCount = Math.max(2, Math.round(this.bladesPerTuft * this.rng.range(0.75, 1.25)));
        const tuftRadius = heightBase * 0.18;

        for (let i = 0; i < bladeCount; i++) {
            const angle = yaw + this.rng.range(-Math.PI, Math.PI);
            // Distribuição quadrática para concentrar mais lâminas de relva no núcleo central do tufo
            const dist = Math.sqrt(this.rng.next()) * tuftRadius * (1.0 - clearing * 0.45);
            const bx = cx + Math.cos(angle) * dist;
            const bz = cz + Math.sin(angle) * dist;
            const bladeHeight = heightBase * this.rng.range(0.82, 1.38);
            const bladeWidth = Math.min(0.11, Math.max(0.022, bladeHeight * this.bladeWidthScale * this.rng.range(0.75, 1.25)));
            const lean = this.rng.range(-0.28, 0.28);
            const curve = bladeHeight * this.bladeCurveScale * this.rng.range(0.55, 1.25);
            const seed = this.rng.next(); // Valor aleatório individual da folha de relva

            this._pushBlade(bx, cy, bz, bladeWidth, bladeHeight, angle + lean, curve, seed);
        }
    }

    /**
     * Constrói laços de triângulos da geometria detalhada de uma única lâmina de relva.
     * Gera nervuras centrais (perfil em V), torção dinâmica por altura, e ponta afilada.
     */
    _pushBlade(cx, cy, cz, width, height, yaw, curve, seed) {
        // Alturas de corte verticais (frações) de 0.0 (base) a 1.0 (ponta)
        const rows = [0.0, 0.14, 0.32, 0.52, 0.72, 0.88, 1.0];
        this._ensureBatchCapacity(rows.length * 3);
        const baseSideX = Math.cos(yaw);
        const baseSideZ = Math.sin(yaw);
        const forwardX = -Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const baseIndex = this.vertices.length / 3;
        const twistAmount = (seed - 0.5) * 0.55;

        for (const f of rows) {
            // Aplica torção (twist) helicoidal ao longo da altura
            const twist = twistAmount * f;
            const cosT = Math.cos(twist);
            const sinT = Math.sin(twist);
            const sideX = baseSideX * cosT + forwardX * sinT;
            const sideZ = baseSideZ * cosT + forwardZ * sinT;
            
            // Perfil de largura diminui em direção à ponta usando função seno
            const widthProfile = Math.sin((1.0 - f) * Math.PI * 0.5);
            const baseFlare = 0.78 + 0.22 * Math.sin(f * Math.PI);
            const halfWidth = width * 0.5 * widthProfile * baseFlare;
            
            // Curvatura arqueada (lean/bend) ao longo do vetor frontal
            const forwardOffset = curve * (f * f * (1.12 - 0.18 * f));
            const sideBend = Math.sin(f * Math.PI) * width * 0.18 * (seed - 0.5);
            // Elevação da nervura central para formar um perfil em V real
            const ridge = width * 0.16 * (1.0 - f) * Math.sin(f * Math.PI);
            
            const y = cy + height * f;
            const centerX = cx + forwardX * forwardOffset + sideX * sideBend;
            const centerZ = cz + forwardZ * forwardOffset + sideZ * sideBend;
            const leftX = centerX - sideX * halfWidth;
            const leftZ = centerZ - sideZ * halfWidth;
            const rightX = centerX + sideX * halfWidth;
            const rightZ = centerZ + sideZ * halfWidth;

            // Calcular normais para o sombreado suave de perfil em V de três pontos
            const leftNormal = this._normalize([-sideX * 0.24 - forwardX * 0.18, 1.0, -sideZ * 0.24 - forwardZ * 0.18]);
            const centerNormal = this._normalize([-forwardX * 0.22, 1.0, -forwardZ * 0.22]);
            const rightNormal = this._normalize([sideX * 0.24 - forwardX * 0.18, 1.0, sideZ * 0.24 - forwardZ * 0.18]);

            // Três vértices por secção horizontal
            this.vertices.push(
                leftX, y, leftZ,
                centerX, y + ridge, centerZ,
                rightX, y, rightZ
            );
            this.normals.push(
                leftNormal[0], leftNormal[1], leftNormal[2],
                centerNormal[0], centerNormal[1], centerNormal[2],
                rightNormal[0], rightNormal[1], rightNormal[2]
            );
            // uv.x armazena o fator aleatório da lâmina
            // uv.y armazena o peso da oscilação do vento 
            this.texCoords.push(seed, 1.0 - f, seed, 1.0 - f, seed, 1.0 - f);
        }

        // Triangulação da lâmina unindo as secções consecutivas
        for (let r = 0; r < rows.length - 1; r++) {
            const i = baseIndex + r * 3;
            this.indices.push(
                i, i + 1, i + 3,
                i + 1, i + 4, i + 3,
                i + 1, i + 2, i + 4,
                i + 2, i + 5, i + 4
            );
        }
    }

    _normalize(v) {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1.0;
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    /**
     * Verifica se a estrada bloqueia a colocação no raio de folga de segurança.
     * Amostra a máscara em cruz (centro, esquerda, direita, cima, baixo) para evitar intersecções feias.
     */
    _isRoadBlocked(x, z, clearance) {
        if (this.sampleRoadMask(x, z) > this.roadExclusionThreshold) return true;
        return (
            this.sampleRoadMask(x + clearance, z) > this.roadExclusionThreshold ||
            this.sampleRoadMask(x - clearance, z) > this.roadExclusionThreshold ||
            this.sampleRoadMask(x, z + clearance) > this.roadExclusionThreshold ||
            this.sampleRoadMask(x, z - clearance) > this.roadExclusionThreshold
        );
    }

    /**
     * Determina o nível de desbaste (clearing) da relva próximo de flores ou rochas.
     * Garante transições suaves através de um decaimento quadrático suave (similar a smoothstep).
     */
    _grassClearingAt(x, z) {
        let clearing = 0.0;
        for (const patch of this.flowerPatches) {
            const dx = x - patch.x;
            const dz = z - patch.z;
            const radius = patch.radius ?? this.flowerClearingRadius;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist >= radius) continue;
            const t = 1.0 - dist / radius;
            clearing = Math.max(clearing, t * t * (3.0 - 2.0 * t) * this.flowerClearingStrength);
        }

        for (const patch of this.rockPatches) {
            const dx = x - patch.x;
            const dz = z - patch.z;
            const radius = patch.radius ?? 2.0;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist >= radius) continue;
            const t = 1.0 - dist / radius;
            clearing = Math.max(clearing, t * t * (3.0 - 2.0 * t) * (patch.strength ?? 0.92));
        }

        return Math.min(0.96, clearing);
    }

    /**
     * Determina a inclinação do terreno em (x, z) por diferenças finitas centrais.
     */
    _slopeAt(x, z) {
        const e = this.heightEpsilon;
        const hx1 = this.sampleHeight(x + e, z);
        const hx0 = this.sampleHeight(x - e, z);
        const hz1 = this.sampleHeight(x, z + e);
        const hz0 = this.sampleHeight(x, z - e);
        
        const dx = (hx1 - hx0) / (2 * e);
        const dz = (hz1 - hz0) / (2 * e);
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Desenha a relva na cena.
     * Desativa culling traseiro para que ambas as faces das lâminas sejam visíveis.
     * Usa discard no shader com Depth Buffer ativo para evitar artefactos de mistura alfa.
     */
    display() {
        const gl = this.scene.gl;

        // Visualização de duas faces
        gl.disable(gl.CULL_FACE);

        // Otimização para Depth Buffer
        gl.disable(gl.BLEND);
        gl.depthMask(true);

        if (this.grassShader) this.scene.setActiveShader(this.grassShader);

        this.material.apply();
        if (this.scene.heightMapTexture) {
            this.scene.heightMapTexture.bind(1);
        }

        // Desenhar cada lote de geometria acumulada
        for (const batch of this.batches || []) {
            batch.display();
        }

        if (this.grassShader) this.scene.setActiveShader(this.scene.defaultShader);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
}
