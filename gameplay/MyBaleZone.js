import { CGFobject, CGFappearance, CGFshader } from '../../lib/CGF.js';
import { MyHayBale } from '../structures/MyHayBale.js';
import { MyCylinder } from '../primitives/MyCylinder.js';

/**
 * MyBaleZone
 * Representa a zona de entrega dos fardos de palha recolhidos.
 * Renderiza uma aura circular brilhante pulsante no chão e um feixe luminoso
 * semi-transparente vertical através do uso de shaders. Acumula os fardos entregues em pilhas.
 */
export class MyBaleZone extends CGFobject {
    /**
     * Construtor da zona de entrega.
     * @param {CGFscene} scene A cena 3D principal
     * @param {number} radius Raio da área de entrega
     * @param {number} numBales Capacidade de fardos
     */
    constructor(scene, radius, numBales) {
        super(scene);
        this.scene = scene;
        this.radius = radius || 18.0;
        this.numBales = numBales || 16;

        this.hayBale = new MyHayBale(scene);
        // Disco com transparência para projetar o brilho no chão
        this.auraDisk = this._buildDisk(this.radius * 1.05, 96, 0.5);
        // Cilindro sem bases usado para simular o feixe luminoso vertical
        this.beamCylinder = this._buildOpenCylinder(64);
        // Postes delimitadores de madeira à volta da zona
        this.markerCylinder = new MyCylinder(scene, 12);

        this._time = 0;
        this.deliveryFeedbackUntil = 0;
        this.deliveryFeedbackDuration = 1600;

        // Posição no mundo 3D
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this._placed = false;

        // Estado da interseção cinemática
        this.wagonInside = false;
        this.deliveredBales = 0;

        // ── Materiais e Texturas ────────────────────────────────────────────

        // Material de madeira para as estacas marcadoras verticais
        this.markerMat = new CGFappearance(scene);
        this.markerMat.setAmbient(0.12, 0.08, 0.04, 1.0);
        this.markerMat.setDiffuse(0.28, 0.17, 0.08, 1.0);
        this.markerMat.setSpecular(0.03, 0.025, 0.02, 1.0);
        this.markerMat.setEmission(0.0, 0.0, 0.0, 1.0);
        this.markerMat.setShininess(3.0);
        this.markerMat.setTexture(scene.assets.getTexture('textures/barn_wood.jpg'));
        this.markerMat.setTextureWrap('REPEAT', 'REPEAT');

        // Shader customizado para a aura brilhante e feixe glow vertical
        this.zoneShader = new CGFshader(scene.gl, 'shaders/balezone.vert', 'shaders/balezone.frag');
        this.zoneShader.setUniformsValues({
            uTime: 0.0,
            uMode: 0.0,
            uInside: 0.0,
            uDelivery: 1.0,
            uIntensity: 1.0,
            uColor: [1.0, 0.66, 0.22]
        });
    }

    /**
     * Constrói uma malha circular plana para ser usada como base ou aura.
     * @param {number} radius Raio do disco
     * @param {number} segments Subdivisões circulares
     * @param {number} texScale Escala das coordenadas de textura
     * @returns {CGFobject} O objeto geométrico gerado
     * @private
     */
    _buildDisk(radius, segments, texScale = 0.5) {
        const disk = new CGFobject(this.scene);
        const verts = [0, 0, 0];
        const norms = [0, 1, 0];
        const texs = [0.5, 0.5];
        const inds = [];

        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            verts.push(c * radius, 0, s * radius);
            norms.push(0, 1, 0);
            texs.push(0.5 + c * texScale, 0.5 + s * texScale);
            if (i > 0) inds.push(0, i, i + 1);
        }

        disk.vertices = verts;
        disk.normals = norms;
        disk.texCoords = texs;
        disk.indices = inds;
        disk.primitiveType = this.scene.gl.TRIANGLES;
        disk.initGLBuffers();
        return disk;
    }

    /**
     * Constrói uma malha cilíndrica sem bases, alinhada ao longo do eixo Z.
     * @param {number} segments Subdivisões circulares
     * @returns {CGFobject} O objeto geométrico gerado
     * @private
     */
    _buildOpenCylinder(segments) {
        const cylinder = new CGFobject(this.scene);
        const verts = [];
        const norms = [];
        const texs = [];
        const inds = [];

        for (let i = 0; i <= segments; i++) {
            const u = i / segments;
            const a = u * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);

            verts.push(c, s, 0.0, c, s, 1.0);
            norms.push(c, s, 0.0, c, s, 0.0);
            texs.push(u, 0.0, u, 1.0);

            if (i > 0) {
                const base = (i - 1) * 2;
                inds.push(base, base + 2, base + 1);
                inds.push(base + 1, base + 2, base + 3);
            }
        }

        cylinder.vertices = verts;
        cylinder.normals = norms;
        cylinder.texCoords = texs;
        cylinder.indices = inds;
        cylinder.primitiveType = this.scene.gl.TRIANGLES;
        cylinder.initGLBuffers();
        return cylinder;
    }

    /**
     * Retorna a posição 3D no mundo da fonte de luz associada a esta zona de entrega.
     * @returns {Array<number>} Coordenadas [x, y, z] para a luz
     */
    getLanternWorldPos() {
        const deliveryActive = this._time < this.deliveryFeedbackUntil;
        return [this.x, this.y + (deliveryActive ? 6.0 : 4.0), this.z];
    }

    /**
     * Retorna a cor emissiva da luz baseada no estado da zona de entrega.
     * @returns {Array<number>} Vetor [r, g, b]
     */
    getLightColor() {
        const deliveryActive = this._time < this.deliveryFeedbackUntil;
        if (deliveryActive) return [1.0, 0.86, 0.45]; // Amarelo/laranja brilhante na entrega
        if (this.wagonInside) return [0.38, 0.95, 0.46]; // Verde se a carroça estiver dentro
        return [1.0, 0.64, 0.20]; // Laranja padrão em espera
    }

    /**
     * Retorna a intensidade da fonte de luz associada.
     * @returns {number} Fator de intensidade luminosa
     */
    getLightIntensity() {
        const deliveryActive = this._time < this.deliveryFeedbackUntil;
        if (deliveryActive) return 2.8;
        return this.wagonInside ? 2.15 : 1.85;
    }

    /**
     * Atualiza a deteção cinemática se a carroça está dentro da zona de entrega.
     * @param {number} wagonX Posição X da carroça no mundo
     * @param {number} wagonZ Posição Z da carroça no mundo
     * @param {number} t Tempo de cena acumulado
     */
    update(wagonX, wagonZ, t) {
        if (!this._placed) return;
        const dx = wagonX - this.x;
        const dz = wagonZ - this.z;
        this.wagonInside = Math.sqrt(dx * dx + dz * dz) < this.radius * 0.85;
        if (t !== undefined) this._time = t;
    }

    /**
     * Ativa o feedback visual temporário de entrega
     * @param {number} totalDelivered Quantidade total de fardos entregues até ao momento
     */
    triggerDeliveryFeedback(totalDelivered) {
        this.deliveryFeedbackUntil = this._time + this.deliveryFeedbackDuration;
        this.deliveredBales = totalDelivered ?? ((this.deliveredBales ?? 0) + 1);
    }

    /**
     * Renderiza as estacas circulares demarcadoras, a aura transparente do chão,
     * o feixe brilhante vertical e as pilhas físicas de fardos entregues.
     */
    display() {
        if (!this._placed) return;
        const sc = this.scene;
        const gl = sc.gl;
        const deliveryActive = this._time < this.deliveryFeedbackUntil;
        const deliveryProgress = deliveryActive
            ? 1.0 - ((this.deliveryFeedbackUntil - this._time) / this.deliveryFeedbackDuration)
            : 1.0;
        const deliveryPulse = deliveryActive ? Math.sin(deliveryProgress * Math.PI) : 0.0;

        sc.pushMatrix();
        // Ligeiramente elevado para evitar Z-fighting com o plano do terreno
        sc.translate(this.x, this.y + 0.15, this.z);

        const shaderTime = this._time * 0.001;
        const glowColor = this.getLightColor();
        const deliveryAmount = deliveryActive ? deliveryProgress : 1.0;
        const zoneIntensity = 2.15 + (this.wagonInside ? 0.35 : 0.0) + deliveryPulse * 1.05;

        // 1. Renderizar postes delimitadores de madeira circularmente
        this.markerMat.apply();
        const markerCount = 14;
        for (let i = 0; i < markerCount; i++) {
            const a = (i / markerCount) * Math.PI * 2;
            const mx = Math.cos(a) * this.radius * 0.88;
            const mz = Math.sin(a) * this.radius * 0.88;
            sc.pushMatrix();
            sc.translate(mx, 0.45, mz);
            sc.rotate(-Math.PI / 2, 1, 0, 0);
            sc.scale(0.18, 0.18, 0.9 + (i % 3) * 0.08);
            this.markerCylinder.display();
            sc.popMatrix();
        }

        // 2. Renderizar a aura brilhante horizontal
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Mistura aditiva brilhante
        gl.depthMask(false);
        sc.setActiveShader(this.zoneShader);

        this.zoneShader.setUniformsValues({
            uTime: shaderTime,
            uMode: 0.0,
            uInside: this.wagonInside ? 1.0 : 0.0,
            uDelivery: deliveryAmount,
            uIntensity: zoneIntensity,
            uColor: glowColor
        });
        sc.pushMatrix();
        sc.translate(0, 0.015, 0);
        this.auraDisk.display();
        sc.popMatrix();

        // 3. Renderizar o feixe luminoso vertical 
        this.zoneShader.setUniformsValues({
            uMode: 1.0,
            uIntensity: 2.05 + (this.wagonInside ? 0.28 : 0.0) + deliveryPulse * 0.95
        });
        sc.pushMatrix();
        sc.rotate(-Math.PI / 2, 1, 0, 0); // Erguido verticalmente em Y
        sc.scale(this.radius * 0.96, this.radius * 0.96, 15.5);
        this.beamCylinder.display();
        sc.popMatrix();

        sc.setActiveShader(sc.defaultShader);
        gl.depthMask(true);
        gl.disable(gl.BLEND);

        // 4. Renderizar pilhas dinâmicas (fardos entregues) no centro
        if (this.deliveredBales > 0) {
            const count = this.deliveredBales;
            const innerRadius = this.radius * 0.4;
            for (let i = 0; i < count; i++) {
                const layer = Math.floor(i / 5);
                const indexInLayer = i % 5;
                const countInLayer = Math.min(5, count - layer * 5);
                
                const angleOffset = layer * 0.5 + Math.sin(i * 4.3) * 0.2;
                const angle = (indexInLayer / countInLayer) * Math.PI * 2 + angleOffset;
                
                const r = innerRadius * (0.35 + (i % 2) * 0.25 - layer * 0.05); 
                const bx = Math.cos(angle) * r;
                const bz = Math.sin(angle) * r;
                
                const baseScale = 2.2;
                const baleScale = baseScale + Math.sin(i * 1.7) * 0.15;
                const verticalScale = baleScale * 0.75;
                
                const by = (verticalScale / 2) + layer * (verticalScale * 0.85); 
                
                sc.pushMatrix();
                sc.translate(bx, by, bz);
                
                // Rotações procedurais orgânicas para simular empilhamento desalinhado natural
                sc.rotate(angle + Math.sin(i * 2.9) * 0.4, 0, 1, 0);
                sc.rotate(Math.sin(i * 3.7) * 0.08, 1, 0, 0);
                sc.rotate(Math.cos(i * 1.3) * 0.08, 0, 0, 1);
                
                sc.scale(baleScale, verticalScale, baleScale);
                this.hayBale.display();
                sc.popMatrix();
            }
        }

        sc.popMatrix();
    }
}
