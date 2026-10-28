import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MyHayBale } from '../structures/MyHayBale.js';
import { MyCylinder } from '../primitives/MyCylinder.js';
import { MyRandom } from '../utils/MyRandom.js';

/**
 * ArrowHead
 * Representa a cabeça cónica/piramidal de uma seta indicadora.
 * Desenha uma geometria cónica simples para sinalizar fardos à distância.
 */
class ArrowHead extends CGFobject {
    /**
     * Construtor da cabeça da seta.
     * @param {CGFscene} scene A cena 3D principal
     * @param {number} slices Subdivisões circulares do cone
     */
    constructor(scene, slices = 18) {
        super(scene);
        this.slices = slices;
        this.initBuffers();
    }

    /**
     * Inicializa os buffers de vértices, normais e coordenadas de textura da ponta cónica.
     */
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        const baseY = 0.45;
        const tipY = -0.45;
        const radius = 1.0;
        const slope = Math.sqrt(radius * radius + (baseY - tipY) * (baseY - tipY));
        const ny = radius / slope;
        const side = (baseY - tipY) / slope;

        // Vértice do topo da ponta cónica
        this.vertices.push(0, tipY, 0);
        this.normals.push(0, -0.35, 0);
        this.texCoords.push(0.5, 0);

        // Vértices da base circular
        for (let i = 0; i <= this.slices; i++) {
            const a = (i / this.slices) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const z = Math.sin(a) * radius;
            this.vertices.push(x, baseY, z);
            this.normals.push(x * side, ny, z * side);
            this.texCoords.push(i / this.slices, 1);

            if (i > 0) {
                this.indices.push(0, i, i + 1);
            }
        }

        const center = this.vertices.length / 3;
        this.vertices.push(0, baseY, 0);
        this.normals.push(0, 1, 0);
        this.texCoords.push(0.5, 0.5);

        // Preenchimento da face plana inferior da base do cone
        const baseStart = center + 1;
        for (let i = 0; i <= this.slices; i++) {
            const a = (i / this.slices) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const z = Math.sin(a) * radius;
            this.vertices.push(x, baseY, z);
            this.normals.push(0, 1, 0);
            this.texCoords.push(0.5 + x * 0.5, 0.5 + z * 0.5);

            if (i > 0) {
                this.indices.push(center, baseStart + i, baseStart + i - 1);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

/**
 * BaleArrow
 * Representa a seta flutuante tridimensional que paira sobre cada fardo de palha ativo.
 */
class BaleArrow {
    /**
     * Construtor da seta indicadora.
     * @param {CGFscene} scene A cena 3D principal
     */
    constructor(scene) {
        this.scene = scene;
        this.shaft = new MyCylinder(scene, 18);
        this.head = new ArrowHead(scene, 18);

        // Material verde padrão quando a carroça está longe do fardo
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.08, 0.85, 0.18, 1.0);
        this.material.setDiffuse(0.16, 1.0, 0.28, 1.0);
        this.material.setSpecular(0.45, 0.85, 0.35, 1.0);
        this.material.setEmission(0.05, 0.68, 0.12, 1.0);
        this.material.setShininess(24.0);

        // Material brilhante quando a carroça está perto
        this.nearMaterial = new CGFappearance(scene);
        this.nearMaterial.setAmbient(0.16, 1.0, 0.32, 1.0);
        this.nearMaterial.setDiffuse(0.38, 1.0, 0.48, 1.0);
        this.nearMaterial.setSpecular(0.72, 1.0, 0.58, 1.0);
        this.nearMaterial.setEmission(0.10, 0.95, 0.18, 1.0);
        this.nearMaterial.setShininess(32.0);
    }

    /**
     * Renderiza a seta flutuante com rotação, oscilação de altura e pulsação em tamanho.
     * @param {number} x Coordenada X global do fardo
     * @param {number} y Coordenada Y global da base do fardo
     * @param {number} z Coordenada Z global do fardo
     * @param {number} timeSeconds Tempo de cena em segundos
     * @param {number} proximity Fator de proximidade (0 = longe, 1 = muito perto)
     */
    display(x, y, z, timeSeconds, proximity) {
        const sc = this.scene;
        // Oscilação vertical sinusoidal 
        const bob = Math.sin(timeSeconds * 3.4) * 0.75;
        // Rotação horizontal contínua
        const spin = timeSeconds * 1.6;
        // Efeito de pulsação de escala
        const pulse = Math.sin(timeSeconds * 5.0) * 0.08;
        const scale = 2.15 + proximity * 0.42 + pulse;

        // Escolha dinamicamente o material com base na proximidade da carroça
        (proximity > 0.45 ? this.nearMaterial : this.material).apply();

        sc.pushMatrix();
        sc.translate(x, y + 14.0 + bob, z);
        sc.rotate(spin, 0, 1, 0);
        sc.scale(scale, scale, scale);

        // Haste da seta (Cilindro vertical)
        sc.pushMatrix();
        sc.translate(0, 1.25, 0);
        sc.rotate(Math.PI / 2, 1, 0, 0);
        sc.scale(0.32, 0.32, 1.95);
        this.shaft.display();
        sc.popMatrix();

        // Cabeça da seta (Cone apontando para baixo)
        sc.pushMatrix();
        sc.translate(0, 0.05, 0);
        sc.scale(1.08, 1.34, 1.08);
        this.head.display();
        sc.popMatrix();

        sc.popMatrix();
    }
}

/**
 * MyHayBaleManager
 * Classe gestora que gera proceduralmente, atualiza, deteta proximidade e gere
 * o ciclo de vida e a recolha dos fardos de palha espalhados pelo mapa de jogo.
 */
export class MyHayBaleManager {
    /**
     * Construtor do gestor de fardos.
     * @param {CGFscene} scene A cena 3D principal
     */
    constructor(scene) {
        this.scene = scene;
        this.rng = new MyRandom(this.scene.hayBaleSeed ?? 1);
        this.hayBale = new MyHayBale(scene);
        this.arrow = new BaleArrow(scene);
        this.bales = [];
        this._built = false;
        this._time = 0;
    }

    /**
     * Inicializa e gera os fardos de palha no mapa com base no relevo do terreno (heightmap)
     * respeita as restrições de estradas e distâncias entre entidades fixas.
     * @param {MyGrass} grassRef Referência ao objeto de relva/terreno
     */
    buildFromHeightmap(grassRef) {
        this.rng = new MyRandom(this.scene.hayBaleSeed ?? 1);
        this.grassRef = grassRef;
        this.bales = [];

        const count = this.scene.hayBaleCount ?? 3;
        let attempts = 0;
        while (this.bales.length < count && attempts < count * 90) {
            const bale = this._createRandomBale(grassRef);
            attempts += this._lastSpawnAttempts ?? 0;
            if (bale) this.bales.push(bale);
            else break;
        }

        this._built = true;
        console.log(`MyHayBaleManager: ${this.bales.length} fardos gerados em ${attempts} tentativas.`);
    }

    /**
     * Gera individualmente um fardo de palha numa posição aleatória válida.
     * @param {MyGrass} grassRef Referência ao objeto de relva/terreno
     * @param {number} excludedIndex Índice do fardo a excluir das verificações de distância
     * @returns {Object|null} Objeto contendo os dados de estado do fardo gerado ou null se falhar
     * @private
     */
    _createRandomBale(grassRef = this.grassRef, excludedIndex = -1) {
        if (!grassRef) return null;

        const maxDist = Math.min((this.scene.playAreaRadius ?? 250.0) * 0.78, grassRef.worldScale * 0.46);
        const roadThreshold = this.scene.roadExclusionThreshold ?? 0.18;
        const maxAttempts = 120;
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;

            const a = this.rng.range(0, Math.PI * 2);
            const r = Math.sqrt(this.rng.next()) * maxDist;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;

            // Garantir que está dentro dos limites da área jogável
            if (
                typeof grassRef.isInPlayArea === 'function' &&
                !grassRef.isInPlayArea(x, z, 2.0)
            ) continue;

            // Evitar estradas
            if (typeof grassRef.sampleRoadMask === 'function' && grassRef.sampleRoadMask(x, z) > roadThreshold) {
                continue;
            }

            // Distância de segurança a outras entidades e fardos existentes
            if (!this._isFarEnoughFromFixedEntities(x, z)) continue;
            if (!this._isFarEnoughFromExistingBales(x, z, excludedIndex)) continue;

            this._lastSpawnAttempts = attempts;
            return {
                x,
                y: grassRef.sampleHeight(x, z),
                z,
                value: this.scene.hayBaleValue ?? 50,
                captured: false,
                visibleRadius: this.scene.hayBaleVisibleRadius ?? 31.0,
                captureRadius: this.scene.hayBaleCaptureRadius ?? 5.1,
                yaw: this.rng.range(0, Math.PI * 2),
                scale: this.rng.range(1.45, 1.85) * 1.5
            };
        }

        this._lastSpawnAttempts = attempts;
        return null;
    }

    /**
     * Verifica se a coordenada está suficientemente afastada das entidades fixas do jogo
     * @param {number} x Coordenada X global
     * @param {number} z Coordenada Z global
     * @returns {boolean} True se estiver longe o suficiente, false caso contrário
     * @private
     */
    _isFarEnoughFromFixedEntities(x, z) {
        const checks = [];

        // Celeiro
        if (this.scene.barn && this.scene.barn.barn) {
            checks.push({ x: this.scene.barn.barn.x, z: this.scene.barn.barn.z, radius: 34.0 });
        }
        // Zona de entrega
        if (this.scene.baleZone && this.scene.baleZone._placed) {
            checks.push({ x: this.scene.baleZone.x, z: this.scene.baleZone.z, radius: this.scene.baleZone.radius + 18.0 });
        }
        // Carroça principal
        if (this.scene.wagon) {
            const wagonClearRadius = Math.max(24.0, (this.scene.hayBaleCaptureRadius ?? 5.1) + 6.0);
            checks.push({ x: this.scene.wagon.wagonX, z: this.scene.wagon.wagonZ, radius: wagonClearRadius });
        }
        for (const c of checks) {
            const dx = x - c.x;
            const dz = z - c.z;
            if (dx * dx + dz * dz < c.radius * c.radius) return false;
        }

        return true;
    }

    /**
     * Verifica se a coordenada está suficientemente afastada de outros fardos de palha já gerados.
     * @param {number} x Coordenada X global
     * @param {number} z Coordenada Z global
     * @param {number} excludedIndex Índice do fardo a ignorar nesta verificação
     * @returns {boolean} True se estiver longe o suficiente, false caso contrário
     * @private
     */
    _isFarEnoughFromExistingBales(x, z, excludedIndex = -1) {
        for (let i = 0; i < this.bales.length; i++) {
            if (i === excludedIndex) continue;
            const bale = this.bales[i];
            if (bale.captured) continue;
            const dx = x - bale.x;
            const dz = z - bale.z;
            if (dx * dx + dz * dz < 26.0 * 26.0) return false;
        }
        return true;
    }

    /**
     * Atualiza o tempo interno do gestor para animar as rotações e pulsações.
     * @param {number} t Tempo de cena acumulado
     */
    update(t) {
        this._time = t / 1000.0;
    }

    /**
     * Retorna o fardo de palha mais próximo que esteja dentro do raio de captura da carroça.
     * @param {number} wagonX Coordenada X global da carroça
     * @param {number} wagonZ Coordenada Z global da carroça
     * @returns {Object|null} O fardo mais próximo ou null se nenhum estiver ao alcance
     */
    getNearestCollectibleBale(wagonX, wagonZ) {
        if (!this._built) return null;

        let nearest = null;
        let nearestDist = Infinity;

        for (const bale of this.bales) {
            if (bale.captured) continue;

            const dx = wagonX - bale.x;
            const dz = wagonZ - bale.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= bale.captureRadius && dist < nearestDist) {
                nearest = bale;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    /**
     * Tenta recolher o fardo mais próximo da carroça. Caso seja bem-sucedido, incrementa
     * a carga da carroça e gera um novo fardo de palha de substituição noutro local do mapa.
     * @param {number} wagonX Coordenada X global da carroça
     * @param {number} wagonZ Coordenada Z global da carroça
     * @returns {boolean} True se capturou com sucesso, false caso contrário
     */
    tryCaptureNearest(wagonX, wagonZ) {
        if (this.scene.carriedBales >= this.scene.maxCarriedBales) return false;

        const bale = this.getNearestCollectibleBale(wagonX, wagonZ);
        if (!bale) return false;

        const baleIndex = this.bales.indexOf(bale);
        const replacement = this._createRandomBale(this.grassRef)
            ?? this._createRandomBale(this.grassRef, baleIndex);
        if (!replacement || baleIndex < 0) return false;

        this.scene.carriedBales += 1;
        this.bales[baleIndex] = replacement;
        return true;
    }

    /**
     * Repõe o estado de todos os fardos como não capturados.
     */
    resetCaptures() {
        for (const bale of this.bales) {
            bale.captured = false;
        }
    }

    /**
     * Renderiza todos os fardos de palha ativos no mapa, juntamente com as suas setas indicadoras.
     */
    display() {
        if (!this._built || !this.scene.wagon) return;

        for (const bale of this.bales) {
            if (bale.captured) continue;

            const dx = this.scene.wagon.wagonX - bale.x;
            const dz = this.scene.wagon.wagonZ - bale.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const proximity = Math.max(0, 1.0 - dist / bale.visibleRadius);

            // Desenhar seta indicadora flutuante
            this.arrow.display(bale.x, bale.y, bale.z, this._time, proximity);

            // Desenhar o fardo de palha
            this.scene.pushMatrix();
            this.scene.translate(bale.x, bale.y + 0.8 * bale.scale, bale.z);
            this.scene.rotate(bale.yaw, 0, 1, 0);
            this.scene.scale(bale.scale, bale.scale * 0.9, bale.scale);
            this.hayBale.display();
            this.scene.popMatrix();
        }
    }

    /**
     * Retorna a lista de fardos que não foram recolhidos pelo jogador.
     * @returns {Array<Object>} Lista de fardos ativos
     */
    getActiveBales() {
        return this.bales.filter(bale => !bale.captured);
    }

    /**
     * Retorna esferas de colisão para a lógica física de simulação e knockback da carroça.
     * @returns {Array<Object>} Lista de esferas com x, z, raio e propriedades físicas
     */
    getCollisionObjects() {
        if (!this._built) return [];

        return this.getActiveBales().map(bale => ({
            x: bale.x,
            z: bale.z,
            radius: Math.max(1.8, bale.scale * 0.82),
            type: 'hay-bale',
            damageable: false,
            knockbackMultiplier: 2.05,
            minKnockbackForce: 6.0
        }));
    }
}
