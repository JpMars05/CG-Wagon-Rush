import { CGFobject, CGFappearance, CGFshader } from '../../lib/CGF.js';
import { MyRandom } from '../utils/MyRandom.js';

/**
 * RockMesh
 * Geometria procedural de uma rocha individual.
 * Baseada numa UV-sphere de baixa resolução com deformação por ruído pseudoaleatório (hash),
 * achatamento da base para assentar no terreno e suporte a Flat ou Smooth Shading.
 */
class RockMesh extends CGFobject {
    constructor(scene, morph) {
        super(scene);
        this.morph = morph;
        
        // Gerar a malha com a morfologia fornecida
        this.initBuffers();
    }

    /**
     * Função hash pseudoaleatória determinística para deformar os vértices da rocha.
     */
    _hash(x, y, z) {
        const dot = x * 12.9898 + y * 78.233 + z * 37.719;
        return (Math.sin(dot) * 43758.5453) % 1;
    }

    /**
     * Gera os vértices, normais e coordenadas de textura com deformações morfológicas.
     */
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        const latBands = this.morph.lat;
        const lonBands = this.morph.lon;
        const radius = 1.0;

        let rawVerts = [];

        // 1. Gerar os vértices de uma esfera e aplicar perturbações de ruído
        for (let i = 0; i <= latBands; i++) {
            const theta = (i * Math.PI) / latBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            let row = [];
            for (let j = 0; j <= lonBands; j++) {
                const phi = (j * 2 * Math.PI) / lonBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // Posição base na esfera unitária
                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinPhi * sinTheta;

                // Deformar a rocha de forma irregular usando a função hash
                let h = this._hash(x, y, z);
                let disp = 1.0 + (h - 0.5) * this.morph.noiseAmp;

                // Escala nos 3 eixos independentes para dar formas achatadas ou alongadas
                x *= radius * disp * this.morph.sx;
                y *= radius * disp * this.morph.sy;
                z *= radius * disp * this.morph.sz;

                // Achatamento da base para a rocha não parecer que está a flutuar nas encostas
                if (y < 0) {
                    y = Math.max(y, -0.15 * this.morph.sy);
                }

                let u = j / lonBands;
                let v = i / latBands;

                row.push({ x, y, z, u, v, nx: 0, ny: 0, nz: 0 });
            }
            rawVerts.push(row);
        }

        // 2. Construir triângulos e calcular normais (Flat vs Smooth Shading)
        if (this.morph.flatShading) {
            // Flat shading: cada triângulo tem os seus próprios vértices e normais planas (estilo facetado)
            let idx = 0;
            for (let i = 0; i < latBands; i++) {
                for (let j = 0; j < lonBands; j++) {
                    let v1 = rawVerts[i][j];
                    let v2 = rawVerts[i + 1][j];
                    let v3 = rawVerts[i + 1][j + 1];
                    let v4 = rawVerts[i][j + 1];

                    // Adicionar triângulos no sentido CCW (Counter-Clockwise)
                    this._addFlatTri(v1, v3, v2, idx); idx += 3;
                    this._addFlatTri(v1, v4, v3, idx); idx += 3;
                }
            }
        } else {
            // Smooth shading: acumular normais nos vértices partilhados para suavizar as arestas
            for (let i = 0; i < latBands; i++) {
                for (let j = 0; j < lonBands; j++) {
                    let v1 = rawVerts[i][j];
                    let v2 = rawVerts[i + 1][j];
                    let v3 = rawVerts[i + 1][j + 1];
                    let v4 = rawVerts[i][j + 1];

                    // Calcular normais dos dois triângulos da face
                    let n1 = this._calcNorm(v1, v3, v2);
                    let n2 = this._calcNorm(v1, v4, v3);

                    this._addNorm(v1, n1); this._addNorm(v3, n1); this._addNorm(v2, n1);
                    this._addNorm(v1, n2); this._addNorm(v4, n2); this._addNorm(v3, n2);
                }
            }

            // Normalizar e enviar dados para os buffers WebGL
            for (let i = 0; i <= latBands; i++) {
                for (let j = 0; j <= lonBands; j++) {
                    let v = rawVerts[i][j];
                    let l = Math.sqrt(v.nx * v.nx + v.ny * v.ny + v.nz * v.nz) || 1;
                    this.vertices.push(v.x, v.y, v.z);
                    this.normals.push(v.nx / l, v.ny / l, v.nz / l);
                    this.texCoords.push(v.u, v.v);
                }
            }

            for (let i = 0; i < latBands; i++) {
                for (let j = 0; j < lonBands; j++) {
                    let first = (i * (lonBands + 1)) + j;
                    let second = first + lonBands + 1;
                    this.indices.push(first, second + 1, second);
                    this.indices.push(first, first + 1, second + 1);
                }
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    /**
     * Calcula o produto vetorial para obter a normal geométrica de um triângulo.
     */
    _calcNorm(v1, v2, v3) {
        let ax = v2.x - v1.x, ay = v2.y - v1.y, az = v2.z - v1.z;
        let bx = v3.x - v1.x, by = v3.y - v1.y, bz = v3.z - v1.z;
        return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
    }

    _addNorm(v, n) { v.nx += n.x; v.ny += n.y; v.nz += n.z; }

    /**
     * Adiciona um triângulo facetado (flat) aos buffers.
     */
    _addFlatTri(v1, v2, v3, idx) {
        let n = this._calcNorm(v1, v2, v3);
        let l = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1;
        let nx = n.x / l, ny = n.y / l, nz = n.z / l;

        this.vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        this.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        this.texCoords.push(v1.u, v1.v, v2.u, v2.v, v3.u, v3.v);
        this.indices.push(idx, idx + 1, idx + 2);
    }
}

/**
 * MyRock
 * Sistema gestor de rochas procedurais espalhadas pelo mapa.
 * Controla a geração de rochas em declives adequados (evitando estradas e vegetação),
 * diferencia rochas que causam colisão daquelas que a carroça pode simplesmente galgar (ride-over),
 * e atualiza o shader com mapeamento PBR e efeito de musgo procedural.
 */
export class MyRock {
    constructor(scene) {
        this.scene = scene;
        
        // Seed isolada para que a vegetação e o terreno não sofram alterações se mudarmos as rochas
        this.rng = new MyRandom(this.scene.rockSeed ?? 1);

        // 4 Morfologias distintas de rochas procedurais
        this.morphs = [
            { lat: 10, lon: 14, sx: 1.0, sy: 0.9, sz: 1.0, noiseAmp: 0.08, flatShading: false }, // Round/Arredondada
            { lat: 6, lon: 10, sx: 1.4, sy: 0.35, sz: 1.2, noiseAmp: 0.15, flatShading: true },  // Flat/Achatada
            { lat: 8, lon: 12, sx: 0.9, sy: 1.1, sz: 0.9, noiseAmp: 0.3, flatShading: true },    // Jagged/Pontiaguda
            { lat: 12, lon: 16, sx: 1.1, sy: 1.0, sz: 1.1, noiseAmp: 0.12, flatShading: false }  // Boulder/Calhau gigante
        ];

        // 3 Materiais/Aparências base (tons cinzentos e acastanhados)
        this.materials = [
            this._createMat([0.2, 0.2, 0.2], [0.55, 0.55, 0.55], [0.15, 0.15, 0.15], 20), // Cinza Claro
            this._createMat([0.2, 0.18, 0.15], [0.45, 0.40, 0.35], [0.05, 0.05, 0.05], 5), // Acastanhado
            this._createMat([0.15, 0.15, 0.15], [0.35, 0.35, 0.35], [0.04, 0.04, 0.04], 4)  // Cinza Escuro
        ];

        // Carregar texturas PBR (difusa, normal map e specular) para as rochas
        this.textures = [];
        for (let i = 1; i <= 3; i++) {
            this.textures.push({
                color: scene.assets.getTexture(`textures/rock${i}_color.jpg`),
                normal: scene.assets.getTexture(`textures/rock${i}_normal.jpg`),
                specular: scene.assets.getTexture(`textures/rock${i}_specular.jpg`)
            });
        }

        // Criar shader específico das rochas (suporta blending de texturas e musgo nos topos)
        this.shader = new CGFshader(scene.gl, 'shaders/rock.vert', 'shaders/rock.frag');
        this.shader.setUniformsValues({
            uSampler: 0,
            uSamplerNormal: 1,
            uSamplerSpecular: 2,
            uHasTexture: false,
            uLightDirView: [0, 1, 0],
            uSunVisibility: 1.0,
            uLanternPosView: [0, 0, 0],
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: 18.0,
            uLanternIntensity: 0.0,
            uMossAmount: scene.rockMossAmount ?? 0.5
        });

        this.rocks = [];
        this._built = false;
    }

    _createMat(amb, diff, spec, shininess) {
        let m = new CGFappearance(this.scene);
        m.setAmbient(...amb, 1.0);
        m.setDiffuse(...diff, 1.0);
        m.setSpecular(...spec, 1.0);
        m.setEmission(0, 0, 0, 1);
        m.setShininess(shininess);
        return m;
    }

    /**
     * Calcula o declive local do terreno calculando o gradiente em X e Z.
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

    /**
     * Gera e distribui proceduralmente as rochas no mapa de alturas.
     */
    buildFromHeightmap(grassRef) {
        this.rng = new MyRandom(this.scene.rockSeed ?? 1);

        const count = this.scene.rockCount ?? 30;
        const scaleMult = this.scene.rockScale ?? 1.0;
        const slopeMin = this.scene.rockSlopeMin ?? 0.05;
        const slopeMax = 0.8;

        const worldScale = (grassRef.scene.playAreaRadius ?? 250.0) * 2.0;
        const epsilon = worldScale / 256.0;
        const maxDist = (this.scene.playAreaRadius ?? 250.0) * 0.96;

        this.rocks = [];
        let attempts = 0;

        while (this.rocks.length < count && attempts < count * 10) {
            attempts++;

            const a = this.rng.range(0, Math.PI * 2);
            const r = Math.sqrt(this.rng.next()) * maxDist;
            const fx = Math.cos(a) * r;
            const fz = Math.sin(a) * r;

            if (
                typeof grassRef.isInPlayArea === 'function' &&
                !grassRef.isInPlayArea(fx, fz, 2.0)
            ) continue;

            if (
                typeof grassRef.sampleRoadMask === 'function' &&
                grassRef.sampleRoadMask(fx, fz) > (this.scene.roadExclusionThreshold ?? 0.18)
            ) continue;

            const slope = this._slopeAt(grassRef, fx, fz, epsilon);
            if (slope < slopeMin || slope > slopeMax) continue;

            const baseScale = scaleMult * this.rng.range(0.55, 2.5);

            let tooClose = false;
            const clusters = grassRef.getClusters();
            if (clusters.length < 500) {
                for (const cl of clusters) {
                    const dx = fx - cl.x;
                    const dz = fz - cl.z;
                    const distSq = dx * dx + dz * dz;
                    const safeDist = cl.radius + baseScale * 1.2;
                    if (distSq < safeDist * safeDist) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (tooClose) continue;

            const flowerPatches = typeof grassRef.getFlowerPatches === 'function'
                ? grassRef.getFlowerPatches()
                : [];
            for (const patch of flowerPatches) {
                const dx = fx - patch.x;
                const dz = fz - patch.z;
                const distSq = dx * dx + dz * dz;
                const safeDist = patch.radius + baseScale * 1.4;
                if (distSq < safeDist * safeDist) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            const fy = grassRef.sampleHeight(fx, fz);

            const mType = this.rng.int(this.morphs.length);
            const aType = this.rng.int(this.materials.length);
            const rideRoll = this.rng.next();
            let rideProfile = rideRoll < 0.34 ? 'flat' : (rideRoll < 0.76 ? 'medium' : 'irregular');
            if (mType === 1 && rideRoll < 0.82) rideProfile = 'flat';
            if (mType === 2 && rideRoll > 0.28) rideProfile = 'irregular';

            this.rocks.push({
                mesh: new RockMesh(this.scene, this.morphs[mType]),
                morphIdx: mType,
                matIdx: aType,
                x: fx,
                y: fy - 0.02 * baseScale,
                z: fz,
                scale: baseScale,
                yaw: this.rng.range(0, Math.PI * 2),
                rideProfile,
                ridePhase: this.rng.range(0, Math.PI * 2)
            });
        }

        this._built = true;
        console.log(`MyRock: ${this.rocks.length} rochas geradas em ${attempts} tentativas.`);
    }

    /**
     * Devolve os patches circulares das rochas para a vegetação evitar nascer sobre elas.
     */
    getRockPatches() {
        return this.rocks.map(rock => ({
            x: rock.x,
            z: rock.z,
            radius: Math.max(1.4, rock.scale * 1.35),
            strength: 0.94
        }));
    }

    /**
     * Calcula as propriedades físicas e a altura de colisão/galgamento da rocha.
     */
    _rideOverDataForRock(rock) {
        const heightScale = this.scene.rockRideOverHeightScale ?? 0.8;
        const morph = this.morphs[rock.morphIdx] || this.morphs[0];
        const profile = rock.rideProfile || 'medium';
        const profileHeight = profile === 'flat' ? 0.45 : (profile === 'irregular' ? 1.08 : 0.82);
        const profileRadius = profile === 'flat' ? 1.24 : (profile === 'irregular' ? 0.96 : 1.08);
        const lateralScale = profile === 'flat' ? 1.16 : (profile === 'irregular' ? 0.82 : 0.95);
        const horizontalRadius = rock.scale * Math.max(morph.sx, morph.sz) * profileRadius;
        const height = rock.scale * (0.35 + morph.sy * 0.55) * heightScale * profileHeight;

        return {
            x: rock.x,
            z: rock.z,
            radius: Math.max(1.15, horizontalRadius),
            height: Math.max(0.25, Math.min(1.85, height)),
            profile,
            phase: rock.ridePhase,
            lateralScale,
            type: 'ride-over-rock'
        };
    }

    /**
     * Determina se a carroça consegue passar por cima da rocha (ride-over) ou se bate contra ela.
     */
    _isRideOverRock(rock) {
        const maxScale = this.scene.rockRideOverMaxScale ?? 2.05;
        const maxHeight = this.scene.rockRideOverMaxHeight ?? 1.35;
        const rideData = this._rideOverDataForRock(rock);

        if (rock.scale <= maxScale) return true;
        if (rideData.height <= maxHeight && rock.scale <= maxScale * 1.12) return true;
        if (rideData.profile === 'flat' && rideData.height <= maxHeight && rock.scale <= maxScale * 1.35) return true;

        return false;
    }

    /**
     * Devolve os objetos de colisão impenetráveis (onde a carroça bate e sofre dano/knockback).
     */
    getCollisionObjects() {
        if (!this._built) return [];

        return this.rocks
            .filter(rock => !this._isRideOverRock(rock))
            .map(rock => ({
                x: rock.x,
                z: rock.z,
                radius: Math.max(1.55, rock.scale * 1.25),
                type: 'rock',
                damageable: true
            }));
    }

    /**
     * Devolve as rochas suaves que funcionam como lombas/solavancos físicos (ride-over).
     */
    getRideOverRocks() {
        if (!this._built) return [];

        return this.rocks
            .filter(rock => this._isRideOverRock(rock))
            .map(rock => this._rideOverDataForRock(rock));
    }

    /**
     * Sincroniza parâmetros de musgo e texturização no shader.
     */
    update(t) {
        if (!this.shader) return;
        this.shader.setUniformsValues({
            uMossAmount: this.scene.rockMossAmount ?? 0.5,
            uHasTexture: this.scene.rockUseTextures ?? false
        });
    }

    /**
     * Renderiza todas as rochas agrupadas pelo seu material correspondente (otimização de draw calls).
     */
    display() {
        if (!this._built) return;

        this.scene.setActiveShader(this.shader);
        const useTex = this.scene.rockUseTextures ?? false;

        // Converter a iluminação para View Space (necessário para o Normal Mapping)
        const vm = this.scene.camera.getViewMatrix();
        const ld = this.scene._sunDir();
        const lightDirView = [
            vm[0] * ld[0] + vm[4] * ld[1] + vm[8] * ld[2],
            vm[1] * ld[0] + vm[5] * ld[1] + vm[9] * ld[2],
            vm[2] * ld[0] + vm[6] * ld[1] + vm[10] * ld[2]
        ];
        this.shader.setUniformsValues({
            uLightDirView: lightDirView,
            uSunVisibility: this.scene._sunVisibility(),
            uLanternPosView: this.scene._lanternViewPos(),
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: this.scene._lanternRadius(),
            uLanternIntensity: this.scene._lanternIntensity()
        });

        // Batching manual por material para evitar trocas redundantes de estado do GPU
        for (let matIdx = 0; matIdx < this.materials.length; matIdx++) {
            this.materials[matIdx].apply();
            if (useTex && this.textures[matIdx]) {
                this.textures[matIdx].color.bind(0);
                this.textures[matIdx].normal.bind(1);
                this.textures[matIdx].specular.bind(2);
            }

            for (const rock of this.rocks) {
                if (rock.matIdx !== matIdx) continue;

                this.scene.pushMatrix();
                this.scene.translate(rock.x, rock.y, rock.z);
                this.scene.rotate(rock.yaw, 0, 1, 0);
                this.scene.scale(rock.scale, rock.scale, rock.scale);
                rock.mesh.display();
                this.scene.popMatrix();
            }
        }

        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
