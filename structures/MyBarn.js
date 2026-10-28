import { CGFobject, CGFappearance } from '../../lib/CGF.js';

/**
 * UnitBox
 * Caixa unitária centrada na origem (1x1x1) com normais e coordenadas de textura
 * independentes por face (evita interpolações incorretas de iluminação nas arestas)
 */
class UnitBox extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        const faces = [
            { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
            { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
            { n: [-1, 0, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
            { n: [1, 0, 0], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
            { n: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
            { n: [0, -1, 0], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
        ];

        for (let f = 0; f < faces.length; f++) {
            const face = faces[f];
            for (let i = 0; i < 4; i++) {
                this.vertices.push(...face.v[i]);
                this.normals.push(...face.n);
            }
            this.texCoords.push(0, 1, 1, 1, 1, 0, 0, 0);
            const base = f * 4;
            this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

/**
 * TriangularPrism
 * Prisma triangular com base na origem e cumeeira/cume esticado ao longo do eixo Z.
 * Usado para fazer o telhado inclinado do celeiro.
 */
class TriangularPrism extends CGFobject {
    constructor(scene, width, height, depth) {
        super(scene);
        this.w = width / 2;
        this.h = height;
        this.d = depth / 2;
        this.initBuffers();
    }

    initBuffers() {
        const w = this.w, h = this.h, d = this.d;
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        // Calcular a inclinação e normais dos painéis laterais do telhado
        const slopeLen = Math.sqrt(w * w + h * h);
        const nlx = -h / slopeLen, nly = w / slopeLen;
        const nrx = h / slopeLen, nry = w / slopeLen;

        let idx = 0;
        const addQuad = (v0, v1, v2, v3, nx, ny, nz) => {
            this.vertices.push(...v0, ...v1, ...v2, ...v3);
            for (let i = 0; i < 4; i++) this.normals.push(nx, ny, nz);
            this.texCoords.push(0, 1, 1, 1, 1, 0, 0, 0);
            this.indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
            idx += 4;
        };

        const addTri = (v0, v1, v2, nx, ny, nz) => {
            this.vertices.push(...v0, ...v1, ...v2);
            for (let i = 0; i < 3; i++) this.normals.push(nx, ny, nz);
            this.texCoords.push(0, 1, 1, 1, 0.5, 0);
            this.indices.push(idx, idx + 1, idx + 2);
            idx += 3;
        };

        // Painéis do telhado (esquerda e direita)
        addQuad([-w, 0, -d], [0, h, -d], [0, h, d], [-w, 0, d], nlx, nly, 0);
        addQuad([-w, 0, d], [0, h, d], [0, h, -d], [-w, 0, -d], -nlx, -nly, 0);
        addQuad([w, 0, d], [0, h, d], [0, h, -d], [w, 0, -d], nrx, nry, 0);
        addQuad([w, 0, -d], [0, h, -d], [0, h, d], [w, 0, d], -nrx, -nry, 0);
        
        // Tampas triangulares frontais e traseiras
        addTri([-w, 0, -d], [w, 0, -d], [0, h, -d], 0, 0, -1);
        addTri([w, 0, -d], [-w, 0, -d], [0, h, -d], 0, 0, 1);
        addTri([w, 0, d], [-w, 0, d], [0, h, d], 0, 0, 1);
        addTri([-w, 0, d], [w, 0, d], [0, h, d], 0, 0, -1);

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

/**
 * MyBarn
 * Celeiro rústico de madeira vermelha no estilo Wild West.
 * Combina materiais detalhados, texturas posicionadas para simular portas/janelas,
 * vigas exteriores em 3D, telhado prismático e fardos de palha decorativos.
 */
export class MyBarn extends CGFobject {
    constructor(scene) {
        super(scene);
        this.scene = scene;

        // ── Dimensões base do Celeiro ────────────────────────────────────────
        this.width = 18.0;
        this.depth = 24.0;
        this.wallHeight = 12.0;
        this.roofHeight = 8.0;
        this.wallThick = 0.5;
        this.foundationHeight = 3.0;

        this.doorWidth = 8.0;
        this.doorHeight = 9.0;

        // ── Primitivas Utilizadas ────────────────────────────────────────────
        this.box = new UnitBox(scene);
        this.roof = new TriangularPrism(
            scene,
            this.width + 2.5,  // Alero lateral
            this.roofHeight,
            this.depth + 2.0   // Alero frontal/traseiro
        );

        // ── Texturas ─────────────────────────────────────────────────────────
        this.wallTex = scene.assets.getTexture('textures/barn_wood.jpg');
        this.frontTex = scene.assets.getTexture('textures/barn_front.jpg');
        this.sideTex = scene.assets.getTexture('textures/barn_side.jpg');
        this.backTex = scene.assets.getTexture('textures/barn_back.jpg');

        this.initMaterials(scene);

        this.barn = null;
        this._built = false;
    }

    /**
     * Configura todos os materiais de renderização
     */
    initMaterials(scene) {
        // Parede frontal
        this.frontMat = new CGFappearance(scene);
        this.frontMat.setAmbient(0.55, 0.36, 0.26, 1.0);
        this.frontMat.setDiffuse(0.95, 0.72, 0.56, 1.0);
        this.frontMat.setSpecular(0.08, 0.07, 0.05, 1.0);
        this.frontMat.setEmission(0.025, 0.012, 0.006, 1);
        this.frontMat.setShininess(3.0);
        this.frontMat.setTexture(this.frontTex);
        this.frontMat.setTextureWrap('CLAMP_TO_EDGE', 'CLAMP_TO_EDGE');

        // Paredes laterais
        this.sideMat = new CGFappearance(scene);
        this.sideMat.setAmbient(0.55, 0.36, 0.26, 1.0);
        this.sideMat.setDiffuse(0.95, 0.72, 0.56, 1.0);
        this.sideMat.setSpecular(0.08, 0.07, 0.05, 1.0);
        this.sideMat.setEmission(0.025, 0.012, 0.006, 1);
        this.sideMat.setShininess(3.0);
        this.sideMat.setTexture(this.sideTex);
        this.sideMat.setTextureWrap('CLAMP_TO_EDGE', 'CLAMP_TO_EDGE');

        // Parede traseira
        this.backMat = new CGFappearance(scene);
        this.backMat.setAmbient(0.55, 0.36, 0.26, 1.0);
        this.backMat.setDiffuse(0.95, 0.72, 0.56, 1.0);
        this.backMat.setSpecular(0.08, 0.07, 0.05, 1.0);
        this.backMat.setEmission(0.025, 0.012, 0.006, 1);
        this.backMat.setShininess(3.0);
        this.backMat.setTexture(this.backTex);
        this.backMat.setTextureWrap('CLAMP_TO_EDGE', 'CLAMP_TO_EDGE');

        // Paredes genéricas de madeira vermelha/castanha
        this.wallMat = new CGFappearance(scene);
        this.wallMat.setAmbient(0.50, 0.32, 0.22, 1.0);
        this.wallMat.setDiffuse(0.88, 0.62, 0.43, 1.0);
        this.wallMat.setSpecular(0.07, 0.06, 0.045, 1.0);
        this.wallMat.setEmission(0.02, 0.010, 0.004, 1);
        this.wallMat.setShininess(3.0);
        this.wallMat.setTexture(this.wallTex);
        this.wallMat.setTextureWrap('REPEAT', 'REPEAT');

        // Telhado
        this.roofMat = new CGFappearance(scene);
        this.roofMat.setAmbient(0.30, 0.24, 0.18, 1.0);
        this.roofMat.setDiffuse(0.52, 0.42, 0.31, 1.0);
        this.roofMat.setSpecular(0.07, 0.06, 0.05, 1.0);
        this.roofMat.setEmission(0.012, 0.008, 0.004, 1);
        this.roofMat.setShininess(2.0);
        this.roofMat.setTexture(this.wallTex);
        this.roofMat.setTextureWrap('REPEAT', 'REPEAT');

        // Fundação (pedra/cimento cinzento)
        this.foundMat = new CGFappearance(scene);
        this.foundMat.setAmbient(0.2, 0.2, 0.2, 1.0);
        this.foundMat.setDiffuse(0.35, 0.33, 0.3, 1.0);
        this.foundMat.setSpecular(0.05, 0.05, 0.05, 1.0);
        this.foundMat.setEmission(0, 0, 0, 1);
        this.foundMat.setShininess(5.0);

        // Vigas e molduras rústicas
        this.beamMat = new CGFappearance(scene);
        this.beamMat.setAmbient(0.32, 0.21, 0.12, 1.0);
        this.beamMat.setDiffuse(0.55, 0.35, 0.18, 1.0);
        this.beamMat.setSpecular(0.06, 0.05, 0.04, 1.0);
        this.beamMat.setEmission(0.012, 0.007, 0.003, 1);
        this.beamMat.setShininess(2.0);
        this.beamMat.setTexture(this.wallTex);
        this.beamMat.setTextureWrap('REPEAT', 'REPEAT');

        // Madeira escura da porta simulada
        this.darkWoodMat = new CGFappearance(scene);
        this.darkWoodMat.setAmbient(0.24, 0.14, 0.08, 1.0);
        this.darkWoodMat.setDiffuse(0.42, 0.25, 0.13, 1.0);
        this.darkWoodMat.setSpecular(0.05, 0.04, 0.03, 1.0);
        this.darkWoodMat.setEmission(0.010, 0.005, 0.002, 1);
        this.darkWoodMat.setShininess(2.0);
        this.darkWoodMat.setTexture(this.wallTex);
        this.darkWoodMat.setTextureWrap('REPEAT', 'REPEAT');

        // Chão interior do celeiro
        this.floorMat = new CGFappearance(scene);
        this.floorMat.setAmbient(0.15, 0.1, 0.06, 1.0);
        this.floorMat.setDiffuse(0.28, 0.2, 0.12, 1.0);
        this.floorMat.setSpecular(0.02, 0.02, 0.02, 1.0);
        this.floorMat.setEmission(0, 0, 0, 1);
        this.floorMat.setShininess(2.0);
    }

    /**
     * Posiciona o celeiro na cena com base no mapa de alturas.
     * Fica na coordenada normalizada (0.25, 0.18) do terreno.
     */
    buildFromHeightmap(grassRef) {
        const worldScale = (grassRef.scene.playAreaRadius ?? 250.0) * 2.0;
        const barnX = (0.25 - 0.5) * worldScale;
        const barnZ = (0.18 - 0.5) * worldScale;
        const fy = grassRef.sampleHeight(barnX, barnZ);

        // Orientação rotacional de 207° 
        this.barn = { x: barnX, y: fy, z: barnZ, yaw: Math.PI * 1.15 };
        this._built = true;
        console.log(`MyBarn: Celeiro em (${barnX.toFixed(1)}, ${fy.toFixed(1)}, ${barnZ.toFixed(1)})`);
    }

    update(t) { }

    /**
     * Helper para desenhar caixas 3D redimensionadas e posicionadas.
     */
    _box(w, h, d, tx, ty, tz) {
        this.scene.pushMatrix();
        this.scene.translate(tx, ty + h / 2, tz);
        this.scene.scale(w, h, d);
        this.box.display();
        this.scene.popMatrix();
    }

    /**
     * Desenha uma viga de madeira na parede frontal
     */
    _beamOnFront(x1, y1, x2, y2, thickness, depth, z) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) return;

        this.scene.pushMatrix();
        this.scene.translate((x1 + x2) * 0.5, (y1 + y2) * 0.5, z);
        this.scene.rotate(Math.atan2(dy, dx), 0, 0, 1);
        this.scene.scale(len, thickness, depth);
        this.box.display();
        this.scene.popMatrix();
    }

    /**
     * Desenha uma viga de madeira na parede lateral.
     */
    _beamOnSide(x, z1, y1, z2, y2, thickness, depth) {
        const dz = z2 - z1;
        const dy = y2 - y1;
        const len = Math.sqrt(dz * dz + dy * dy);
        if (len < 0.001) return;

        this.scene.pushMatrix();
        this.scene.translate(x, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
        this.scene.rotate(Math.atan2(dz, dy), 1, 0, 0);
        this.scene.scale(depth, len, thickness);
        this.box.display();
        this.scene.popMatrix();
    }

    /**
     * Detalhes geométricos 3D da porta frontal do celeiro.
     */
    _displayFrontDetails(W, D, H) {
        const hd = D * 0.5;
        const z = -hd - 0.08;
        const doorW = this.doorWidth;
        const doorH = this.doorHeight;
        const frame = 0.34;
        const depth = 0.24;

        this.darkWoodMat.apply();
        this._box(doorW * 0.96, doorH * 0.94, 0.08, 0, 0.06, z - 0.03);

        this.beamMat.apply();
        this._box(frame, doorH + frame, depth, -doorW * 0.5, 0, z);
        this._box(frame, doorH + frame, depth, doorW * 0.5, 0, z);
        this._box(doorW + frame, frame, depth, 0, doorH, z);
        this._box(doorW + frame * 0.6, frame * 0.9, depth, 0, 0.15, z);

        this._beamOnFront(-doorW * 0.38, 1.0, doorW * 0.38, doorH - 0.7, 0.34, depth, z - 0.02);
        this._beamOnFront(doorW * 0.38, 1.0, -doorW * 0.38, doorH - 0.7, 0.34, depth, z - 0.02);
    }

    /**
     * Transforma coordenadas locais do celeiro em coordenadas reais XZ da cena.
     */
    _localToWorldXZ(localX, localZ) {
        const b = this.barn;
        const cosY = Math.cos(b.yaw);
        const sinY = Math.sin(b.yaw);

        return {
            x: b.x + localX * cosY + localZ * sinY,
            z: b.z - localX * sinY + localZ * cosY
        };
    }

    /**
     * Gera uma grelha de colisão circular à volta do perímetro das paredes do celeiro.
     */
    getCollisionObjects() {
        if (!this._built || !this.barn) return [];

        const objects = [];
        const hw = this.width / 2;
        const hd = this.depth / 2;
        const radius = 2.9;
        const step = 5.0;

        const add = (localX, localZ) => {
            const p = this._localToWorldXZ(localX, localZ);
            objects.push({
                x: p.x,
                z: p.z,
                radius,
                type: 'barn',
                damageable: true
            });
        };

        const sampleLine = (min, max) => {
            const values = [min];
            for (let v = min + step; v < max; v += step) values.push(v);
            values.push(max);
            return values;
        };

        // Amostrar ao longo da parede frontal e traseira
        for (const x of sampleLine(-hw, hw)) {
            add(x, -hd);
            add(x, hd);
        }

        // Amostrar ao longo das paredes laterais
        for (const z of sampleLine(-hd + step, hd - step)) {
            add(-hw, z);
            add(hw, z);
        }

        return objects;
    }

    display() {
        if (!this._built || !this.barn) return;

        const sc = this.scene;
        const W = this.width, D = this.depth, H = this.wallHeight;
        const T = this.wallThick;
        const hw = W / 2, hd = D / 2;
        const FH = this.foundationHeight;

        sc.pushMatrix();
        sc.translate(this.barn.x, this.barn.y, this.barn.z);
        sc.rotate(this.barn.yaw, 0, 1, 0);

        // ── 1. Fundação de Pedra ──────────────────────────────────────────
        this.foundMat.apply();
        this._box(W + 1.0, FH, D + 1.0, 0, -FH, 0.5);

        // ── 2. Chão Interior de Madeira ───────────────────────────────────
        this.floorMat.apply();
        this._box(W - T, 0.5, D - T, 0, 0.01, 0);

        // ── 3. Paredes ──────────────────

        // Parede frontal
        this.frontMat.apply();
        sc.pushMatrix();
        sc.translate(0, H / 2, -hd + T / 2);
        sc.rotate(Math.PI, 0, 1, 0);
        sc.scale(W, H, T);
        this.box.display();
        sc.popMatrix();

        // Parede traseira
        this.backMat.apply();
        sc.pushMatrix();
        sc.translate(0, H / 2, hd - T / 2);
        sc.scale(W, H, T);
        this.box.display();
        sc.popMatrix();

        this.sideMat.apply();

        // Parede esquerda
        sc.pushMatrix();
        sc.translate(-hw + T / 2, H / 2, 0);
        sc.rotate(-Math.PI / 2, 0, 1, 0);
        sc.scale(D, H, T);
        this.box.display();
        sc.popMatrix();

        // Parede direita
        sc.pushMatrix();
        sc.translate(hw - T / 2, H / 2, 0);
        sc.rotate(Math.PI / 2, 0, 1, 0);
        sc.scale(D, H, T);
        this.box.display();
        sc.popMatrix();

        // ── 4. Vigas Horizontais Exteriores ───────────────────────────────
        this.beamMat.apply();
        const sH = 0.25, sD = 0.15;
        for (const yFrac of [0.33, 0.66]) {
            const sy = H * yFrac;
            sc.pushMatrix(); sc.translate(-hw - sD / 2, sy, 0); sc.scale(sD, sH, D + 0.2); this.box.display(); sc.popMatrix();
            sc.pushMatrix(); sc.translate(hw + sD / 2, sy, 0); sc.scale(sD, sH, D + 0.2); this.box.display(); sc.popMatrix();
            sc.pushMatrix(); sc.translate(0, sy, hd + sD / 2); sc.scale(W + 0.2, sH, sD); this.box.display(); sc.popMatrix();
        }

        // ── 5. Postes Verticais dos Cantos ──────────────────────────────────
        this.wallMat.apply();
        const pw = 0.3;
        for (const cx of [-hw, hw])
            for (const cz of [-hd, hd])
                this._box(pw, H, pw, cx, 0, cz);
        this._box(pw, H, pw, -hw, 0, 0);
        this._box(pw, H, pw, hw, 0, 0);

        // ── 6. Telhado Inclinado ───────────────────────────────────────────
        this.roofMat.apply();
        sc.pushMatrix();
        sc.translate(0, H, 0);
        this.roof.display();
        sc.popMatrix();

        // Cumeeira
        this.beamMat.apply();
        sc.pushMatrix(); sc.translate(0, H + this.roofHeight, 0); sc.scale(0.3, 0.3, D + 2.5); this.box.display(); sc.popMatrix();

        // Aleros laterais inferiores
        for (const side of [-1, 1]) {
            sc.pushMatrix(); sc.translate(side * (W / 2 + 1.2), H - 0.1, 0); sc.scale(0.2, 0.2, D + 2.5); this.box.display(); sc.popMatrix();
        }

        // ── 7. Detalhes frontais e porta 3D ────────────────────────────────
        this._displayFrontDetails(W, D, H);

        sc.popMatrix();
    }
}

