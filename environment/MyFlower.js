import { CGFobject, CGFappearance, CGFshader } from '../../lib/CGF.js';
import { MyRandom } from '../utils/MyRandom.js';

/**
 * FlowerBatch
 * Representa um lote (batch) de geometria de flores partilhando o mesmo material/cor.
 * Evita múltiplas chamadas de desenho ao agregar vértices num único buffer WebGL.
 */
class FlowerBatch extends CGFobject {
    constructor(scene, verts, norms, uvs, idxs) {
        super(scene);
        this.vertices = verts;
        this.normals = norms;
        this.texCoords = uvs;
        this.indices = idxs;
        this.primitiveType = scene.gl.TRIANGLES;
        // Só inicializamos os buffers WebGL se realmente existirem dados de vértices a desenhar
        if (verts.length > 0) this.initGLBuffers();
    }
}

/**
 * MyFlower
 * Sistema de flores procedurais geradas dinamicamente em torno dos clusters de relva.
 * Cada flor é composta por um caule fino, pétalas radiais inclinadas e um centro em cruz.
 * Utiliza o shader de vento (flower.vert) para oscilar dinamicamente no GPU.
 */
export class MyFlower {
    constructor(scene) {
        this.scene = scene;

        // Gerador de aleatoriedade próprio para as flores para garantir reprodutibilidade deterministicamente
        this.rng = new MyRandom(this.scene.flowerSeed ?? 1);

        // Parâmetros de distribuição e escala da GUI
        this.flowerProbability = scene.flowerProbability ?? 0.35;
        this.flowerScale = scene.flowerScale ?? 1.0;

        // 5 Paletas de cores vibrantes para as pétalas (Rosa, Amarelo, Branco, Vermelho, Violeta)
        this.palettes = [
            [1.0, 0.45, 0.65],  // Rosa
            [1.0, 0.90, 0.30],  // Amarelo
            [0.95, 0.95, 0.90], // Branco
            [0.90, 0.20, 0.20], // Vermelho
            [0.70, 0.35, 0.85], // Violeta
        ];

        // ── Configuração dos Materiais ───────────────────────────────────────

        // Caule (Verde Escuro)
        this.stemMat = new CGFappearance(scene);
        this.stemMat.setAmbient(0.08, 0.14, 0.04, 1.0);
        this.stemMat.setDiffuse(0.22, 0.42, 0.12, 1.0);
        this.stemMat.setSpecular(0.02, 0.02, 0.02, 1.0);
        this.stemMat.setEmission(0.0, 0.0, 0.0, 1.0);
        this.stemMat.setShininess(2.0);

        // Pétalas (Um material por paleta de cor)
        this.petalMats = this.palettes.map(c => {
            const m = new CGFappearance(scene);
            m.setAmbient(c[0] * 0.25, c[1] * 0.25, c[2] * 0.25, 1.0);
            m.setDiffuse(c[0], c[1], c[2], 1.0);
            m.setSpecular(0.12, 0.12, 0.12, 1.0);
            m.setEmission(0.0, 0.0, 0.0, 1.0);
            m.setShininess(8.0);
            return m;
        });

        // Centro (Amarelo)
        this.centerMat = new CGFappearance(scene);
        this.centerMat.setAmbient(0.25, 0.20, 0.04, 1.0);
        this.centerMat.setDiffuse(0.95, 0.80, 0.20, 1.0);
        this.centerMat.setSpecular(0.08, 0.08, 0.08, 1.0);
        this.centerMat.setEmission(0.0, 0.0, 0.0, 1.0);
        this.centerMat.setShininess(6.0);

        // Inicializar a textura GL branca 1x1 para tingimento
        this._initWhiteTexture();

        // Configurar o shader de vento para as flores (reutiliza o fragment shader da relva para iluminação uniforme)
        this.shader = new CGFshader(scene.gl, 'shaders/flower.vert', 'shaders/grass.frag');
        this.shader.setUniformsValues({
            uSampler: 0,
            uHeightMap: 1,
            uWorldScale: scene.skyRadius * 2,
            uWindStrength: 1.6,
            uWindFreq: 1.1,
            uWindSpeed: 1.25,
            uWindDir: [1.0, 0.0],
            uTime: 0.0,
            uLightDir: scene._sunDir(),
            uSunVisibility: 1.0,
            uLanternPos: [0, 0, 0],
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: 18.0,
            uLanternIntensity: 0.0,
            uProceduralGrassColor: 0.0,
        });

        this._startTime = null;

        // Lotes de geometria acumulada
        this.stemBatch = null;
        this.petalBatches = [];   
        this.centerBatch = null;
        this._built = false;
        this.flowerPatches = [];
    }

    // =====================================================================
    //  Textura branca programática
    // =====================================================================

    /**
     * Cria uma textura de cor sólida branca 1x1 em WebGL.
     * Serve para ligar à unidade 0 quando desenhamos as flores, garantindo que
     * as cores dos materiais (setDiffuse) se misturam perfeitamente sem erros de textura.
     */
    _initWhiteTexture() {
        const gl = this.scene.gl;
        this._whiteTexId = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._whiteTexId);
        // Cria um pixel branco
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        // Configura filtros simples já que a textura é de 1x1 píxeis
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Associa a textura branca programática à unidade GL ativa.
     */
    _bindWhiteTex() {
        const gl = this.scene.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._whiteTexId);
        this.scene.activeTexture = { texID: this._whiteTexId };
    }

    // =====================================================================
    //  Construção da geometria
    // =====================================================================

    /**
     * Analisa os clusters de relva e espalha flores proceduralmente neles.
     * @param {Array} clusters Lista de clusters de relva
     * @param {MyGrass} grassRef Referência à relva para amostrar alturas do terreno
     */
    buildFromClusters(clusters, grassRef) {
        this.rng = new MyRandom(this.scene.flowerSeed ?? 1);
        this.flowerPatches = [];

        // Estruturas de buffers temporários para acumulação
        // v: vértices, n: normais, uv: coordenadas textura, idx: índices de triângulos, i: offset atual
        const stem = { v: [], n: [], uv: [], idx: [], i: 0 };
        const petals = this.palettes.map(() => ({ v: [], n: [], uv: [], idx: [], i: 0 }));
        const center = { v: [], n: [], uv: [], idx: [], i: 0 };

        let flowerCount = 0;
        const maxSlope = this.scene.grassMaxSlope ?? 0.42;
        const worldScale = (grassRef.scene.playAreaRadius ?? 250.0) * 2.0;
        const epsilon = worldScale / 256.0;

        // Iterar por todos os aglomerados de relva para colocar flores nos mesmos pontos
        for (const cl of clusters) {
            // Verifica a probabilidade de germinação no aglomerado atual
            if (this.rng.next() > this.flowerProbability) continue;

            // Determina a quantidade de flores no aglomerado
            const n = 1 + (this.rng.next() < 0.3 ? 1 : 0);
            const patchRadius = Math.max(this.scene.flowerClearingRadius ?? 6.0, cl.radius * 0.48);
            const patchAngle = this.rng.range(0, Math.PI * 2);
            const patchDist = this.rng.next() * cl.coreRadius * 0.45;
            const patchX = cl.x + Math.cos(patchAngle) * patchDist;
            const patchZ = cl.z + Math.sin(patchAngle) * patchDist;
            let patchFlowerCount = 0;

            // Garante que não criamos flores fora da zona de jogo ativa
            if (
                typeof grassRef.isInPlayArea === 'function' &&
                !grassRef.isInPlayArea(patchX, patchZ, patchRadius)
            ) continue;

            for (let f = 0; f < n; f++) {
                // Distribuição circular aleatória em torno do centro do aglomerado
                const a = this.rng.range(0, Math.PI * 2);
                const d = Math.sqrt(this.rng.next()) * patchRadius * 0.38;
                const fx = patchX + Math.cos(a) * d;
                const fz = patchZ + Math.sin(a) * d;

                if (
                    typeof grassRef.isInPlayArea === 'function' &&
                    !grassRef.isInPlayArea(fx, fz, 0.5)
                ) continue;

                // Evitar colocação sobre estradas
                if (
                    typeof grassRef.sampleRoadMask === 'function' &&
                    grassRef.sampleRoadMask(fx, fz) > (this.scene.roadExclusionThreshold ?? 0.18)
                ) continue;

                // Evitar declives muito acentuados para que as flores não flutuem no ar ou fiquem enterradas
                const slope = this._slopeAt(grassRef, fx, fz, epsilon);
                if (slope > maxSlope) continue;

                // Amostrar altura exata do terreno no CPU
                const fy = grassRef.sampleHeight(fx, fz);

                // Gerar um valor de seed com base na posição da flor
                // Enviado na coordenada texCoord.x (u) para que todos os vértices de uma mesma flor
                // oscilem em harmonia sob o efeito do vento (evita que as pétalas se separem do caule)
                const seed = this._flowerSeed(fx, fz);

                // Configurações e dimensões aleatórias para diversidade visual
                const sc = this.flowerScale * this.rng.range(0.7, 1.3);
                const sH = this.rng.range(1.2, 2.7) * sc;      // Altura do caule
                const sW = this.rng.range(0.04, 0.08) * sc;    // Largura do caule
                const pN = 4 + this.rng.int(5);                // Número de pétalas (entre 4 e 8)
                const pL = this.rng.range(0.3, 0.7) * sc;      // Comprimento da pétala
                const pW = this.rng.range(0.15, 0.35) * sc;    // Largura da pétala
                const tilt = this.rng.range(20, 45) * Math.PI / 180; // Inclinação da pétala para cima
                const pal = this.rng.int(this.palettes.length); // Escolha da paleta de cor
                const cR = this.rng.range(0.08, 0.15) * sc;    // Raio do centro da flor
                const yaw = this.rng.range(0, Math.PI * 2);    // Rotação horizontal do caule

                // Acumula os vértices do caule, pétalas correspondentes e botão central nos respetivos lotes
                this._addStem(stem, fx, fy, fz, sW, sH, yaw, seed);
                this._addPetals(petals[pal], fx, fy + sH, fz, pN, pL, pW, tilt, seed);
                this._addCenter(center, fx, fy + sH, fz, cR, seed);
                flowerCount++;
                patchFlowerCount++;
            }

            // Regista as coordenadas para fazer o desbaste correspondente na relva
            if (patchFlowerCount > 0) {
                this.flowerPatches.push({
                    x: patchX,
                    z: patchZ,
                    radius: patchRadius,
                    count: patchFlowerCount
                });
            }
        }

        // Instancia os objetos de lote compilados para envio final à GPU
        this.stemBatch = stem.v.length > 0
            ? new FlowerBatch(this.scene, stem.v, stem.n, stem.uv, stem.idx) : null;

        this.petalBatches = petals.map(g =>
            g.v.length > 0 ? new FlowerBatch(this.scene, g.v, g.n, g.uv, g.idx) : null
        );

        this.centerBatch = center.v.length > 0
            ? new FlowerBatch(this.scene, center.v, center.n, center.uv, center.idx) : null;

        this._built = true;
        console.log('MyFlower: ' + flowerCount + ' flores geradas em ' + clusters.length + ' clusters.');
    }

    getFlowerPatches() {
        return this.flowerPatches || [];
    }

    /**
     * Gera o valor hash da flor a partir da sua posição.
     * Retorna um pseudo-aleatório no intervalo [0, 1] que funciona como seed estável no shader.
     */
    _flowerSeed(x, z) {
        const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        return value - Math.floor(value);
    }

    /**
     * Calcula o declive em (x, z) por diferenças finitas centrais.
     * Compara a altura nos vizinhos adjacentes do terreno para aproximar o vetor gradiente.
     */
    _slopeAt(grassRef, x, z, epsilon) {
        const hx1 = grassRef.sampleHeight(x + epsilon, z);
        const hx0 = grassRef.sampleHeight(x - epsilon, z);
        const hz1 = grassRef.sampleHeight(x, z + epsilon);
        const hz0 = grassRef.sampleHeight(x, z - epsilon);
        
        const dx = (hx1 - hx0) / (2 * epsilon);
        const dz = (hz1 - hz0) / (2 * epsilon);
        return Math.sqrt(dx * dx + dz * dz);
    }

    // ── Caule ────────────────────────────────────────────────────────────

    /**
     * Adiciona a geometria de um caule (quad vertical virado conforme o yaw).
     * Os vértices têm normais a apontar perpendicularmente para simular relevo na iluminação.
     */
    _addStem(buf, cx, cy, cz, w, h, yaw, seed) {
        const hw = w * 0.5;
        // Projeções laterais do vetor do caule baseado na rotação yaw
        const sx = Math.cos(yaw) * hw, sz = Math.sin(yaw) * hw;
        // Vetor normal perpendicular à largura da face do caule
        const nx = -Math.sin(yaw), nz = Math.cos(yaw);
        const i = buf.i;

        // Vértices do quad vertical: base esquerda, topo esquerdo, base direita, topo direito
        buf.v.push(
            cx - sx, cy, cz - sz,
            cx - sx, cy + h, cz - sz,
            cx + sx, cy, cz + sz,
            cx + sx, cy + h, cz + sz
        );
        // Normais de iluminação constantes
        for (let k = 0; k < 4; k++) buf.n.push(nx, 0, nz);
        
        // Coordenada V (y) indica a altura do vértice no caule (1 = base fixa, 0 = topo móvel)
        // para que o topo abane com o vento enquanto a base permanece fixa no chão
        buf.uv.push(seed, 1, seed, 0, seed, 1, seed, 0);
        // Índices CCW para os dois triângulos
        buf.idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        buf.i += 4;
    }

    // ── Pétalas ──────────────────────────────────────────────────────────

    /**
     * Adiciona a geometria das pétalas radiais à volta do topo do caule.
     * Gera múltiplas cards estendidas radialmente e inclinadas (tilt) para cima.
     */
    _addPetals(buf, cx, cy, cz, count, len, wid, tilt, seed) {
        const step = (Math.PI * 2) / count;
        const cosT = Math.cos(tilt), sinT = Math.sin(tilt);

        for (let p = 0; p < count; p++) {
            // Jitter angular leve para evitar que as pétalas pareçam perfeitamente simétricas/mecânicas
            const a = p * step + this.rng.range(-0.5, 0.5) * step * 0.3;
            const dirX = Math.cos(a), dirZ = Math.sin(a);
            const perpX = -dirZ, perpZ = dirX;
            const hw = wid * 0.5;
            const i = buf.i;

            // Projeção do comprimento com base na inclinação vertical
            const outH = len * cosT;
            const outY = len * sinT;

            // Vértices da pétala: base interna esquerda, base interna direita, ponta externa esquerda, ponta externa direita
            buf.v.push(
                cx + perpX * hw, cy, cz + perpZ * hw,
                cx - perpX * hw, cy, cz - perpZ * hw,
                cx + dirX * outH + perpX * hw, cy + outY, cz + dirZ * outH + perpZ * hw,
                cx + dirX * outH - perpX * hw, cy + outY, cz + dirZ * outH - perpZ * hw
            );

            // Orientação das normais para refletir a inclinação física (apontando ligeiramente para cima)
            const ny = cosT, nxz = -sinT;
            for (let k = 0; k < 4; k++) buf.n.push(dirX * nxz, ny, dirZ * nxz);

            // Coordenada V próxima de 0 (topo) para que as pétalas acompanhem e oscilem a 100% com o vento
            buf.uv.push(seed, 0.05, seed, 0.05, seed, 0.0, seed, 0.0);
            buf.idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
            buf.i += 4;
        }
    }

    // ── Centro ───────────────────────────────────────────────────────────

    /**
     * Adiciona o centro da flor (dois pequenos quads verticais cruzados que simulam pólen 3D).
     */
    _addCenter(buf, cx, cy, cz, r, seed) {
        // Direções de desvio para os dois planos cruzados em X e Z
        const offsets = [
            [r, 0, -r, 0],
            [0, r, 0, -r],
        ];

        for (const [dx1, dz1, dx2, dz2] of offsets) {
            const i = buf.i;
            const lift = r * 0.2; // Ligeiramente acima das pétalas para evitar artefactos de z-fighting

            buf.v.push(
                cx + dx1, cy + lift, cz + dz1,
                cx + dx1, cy + lift + r, cz + dz1,
                cx + dx2, cy + lift, cz + dz2,
                cx + dx2, cy + lift + r, cz + dz2
            );
            // Normais viradas para cima para uma iluminação uniforme do pólen
            for (let k = 0; k < 4; k++) buf.n.push(0, 1, 0);
            
            // Coordenadas UV: V = 0 para oscilar com o topo do caule no shader
            buf.uv.push(seed, 0.05, seed, 0.0, seed, 0.05, seed, 0.0);
            buf.idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
            buf.i += 4;
        }
    }

    // =====================================================================
    //  Update — uniforms do vento 
    // =====================================================================

    /**
     * Atualiza os uniformes do vento e direção solar no shader.
     * @param {number} t Tempo em milissegundos passado pela cena
     */
    update(t) {
        if (!this.shader) return;

        // Mantém precisão calculando o tempo decorrido relativo ao início do carregamento da cena
        if (this._startTime === null) this._startTime = t;
        const time = (t - this._startTime) / 1000.0;

        // Converte a direção do vento da cena de graus para vetor unitário
        const angle = (this.scene.windDirection || 0) * Math.PI / 180.0;
        this.shader.setUniformsValues({
            uTime: time,
            uWindStrength: (this.scene.windStrength ?? 1.3) * 0.7, // As flores abanam ligeiramente menos que a relva
            uWindFreq: this.scene.windFreq ?? 1.1,
            uWindSpeed: (this.scene.windSpeed ?? 1.25) * 0.85,
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

    // =====================================================================
    //  Display
    // =====================================================================

    /**
     * Desenha as flores divididas por passadas de material para otimização de chamadas WebGL.
     */
    display() {
        if (!this._built) return;

        const gl = this.scene.gl;

        // Desativar culling para permitir ver as duas faces das pétalas e caules
        gl.disable(gl.CULL_FACE);

        // Desativar mistura (blend) e utilizar Alpha Test (discard) no fragment shader
        gl.disable(gl.BLEND);
        gl.depthMask(true);

        this.scene.setActiveShader(this.shader);
        this._bindWhiteTex();
        if (this.scene.heightMapTexture) {
            this.scene.heightMapTexture.bind(1);
        }

        // 1. Renderizar os Caules (Verde)
        if (this.stemBatch) {
            this.stemMat.apply();
            this._bindWhiteTex();
            this.stemBatch.display();
        }

        // 2. Renderizar Pétalas (Uma chamada acumulada por cor/paleta ativa)
        for (let p = 0; p < this.petalBatches.length; p++) {
            if (!this.petalBatches[p]) continue;
            this.petalMats[p].apply();
            this._bindWhiteTex();
            this.petalBatches[p].display();
        }

        // 3. Renderizar Centros
        if (this.centerBatch) {
            this.centerMat.apply();
            this._bindWhiteTex();
            this.centerBatch.display();
        }

        // Restaurar estado padrão da cena para os restantes elementos normais de jogo
        this.scene.setActiveShader(this.scene.defaultShader);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
}

