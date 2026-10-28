import { CGFobject, CGFappearance } from '../../lib/CGF.js';

/**
 * MySimpleCanvas
 * Representa o toldo (lona) arqueado e deformado da carroça.
 * Aplica uma deformação procedural (sag/flare) para simular o caimento do tecido entre os arcos de suporte.
 */
export class MySimpleCanvas extends CGFobject {
    /**
     * Construtor da lona simples.
     * @param {CGFscene} scene 
     * @param {number} slices Subdivisões circulares do arco
     * @param {number} stacks Subdivisões ao longo do comprimento
     * @param {number} sagAmount Intensidade do caimento do tecido entre arcos
     * @param {number} flareAmount Alargamento/projeção da lona nas extremidades
     */
    constructor(scene, slices = 30, stacks = 20, sagAmount = 0.15, flareAmount = 0.2, isHoop = false, hoopX = 0.0) {
        super(scene);
        this.slices = slices;
        this.stacks = stacks;
        this.sagAmount = sagAmount;
        this.flareAmount = flareAmount;
        this.isHoop = isHoop;
        this.hoopX = hoopX;
        this.initBuffers();

        // Material bege para simular tecido de lona
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.7, 0.65, 0.55, 1.0);
        this.material.setDiffuse(0.85, 0.8, 0.7, 1.0);
        this.material.setSpecular(0.05, 0.05, 0.05, 1.0); // Praticamente sem brilho especular
        this.material.setShininess(1.0);
    }

    /**
     * Gera proceduralmente a malha semi-cilíndrica deformada da lona.
     */
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.texCoords = [];

        var alphaAng = Math.PI / this.slices;

        for (var j = 0; j <= this.stacks; j++) {
            var xBase = -0.5 + (j / this.stacks);
            var normalizedX = this.isHoop ? this.hoopX : (xBase * 2.0); // Mapeado de -1.0 a 1.0
            
            // O toldo descaí/afunda ligeiramente entre os arcos estruturais de madeira.
            // O descaimento máximo é modelado sinusoidalmente.
            var sag = this.sagAmount * Math.abs(Math.sin(normalizedX * 2.0 * Math.PI));
            var scaleY = 1.0 - sag;

            var ang = 0;
            for (var i = 0; i <= this.slices; i++) {
                var cz = Math.cos(ang); 
                var sy = Math.sin(ang) * scaleY;
                
                // Efeito Flare: a lona projeta-se um pouco para fora nas pontas frontais/traseiras 
                var flare = Math.sin(ang) * this.flareAmount * normalizedX;
                var xPos = xBase + flare;

                this.vertices.push(xPos, sy, cz);
                
                // Normais aproximadas apontando para fora do semi-cilindro
                this.normals.push(0, sy, cz);
                this.texCoords.push((j / this.stacks), i / this.slices);

                if (j > 0 && i > 0) {
                    var p1 = (j - 1) * (this.slices + 1) + (i - 1);
                    var p2 = (j - 1) * (this.slices + 1) + i;
                    var p3 = j * (this.slices + 1) + (i - 1);
                    var p4 = j * (this.slices + 1) + i;

                    // Triângulos exteriores
                    this.indices.push(p1, p2, p3);
                    this.indices.push(p2, p4, p3);
                    
                    // Triângulos interiores
                    this.indices.push(p3, p2, p1);
                    this.indices.push(p3, p4, p2);
                }
                ang += alphaAng;
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    /**
     * Renderiza o toldo temporariamente desativando o CULL_FACE para podermos ver o seu interior.
     */
    display() {
        this.scene.gl.disable(this.scene.gl.CULL_FACE); // Torna as faces interiores visíveis
        this.material.apply();
        super.display();
        this.scene.gl.enable(this.scene.gl.CULL_FACE); // Restaura o estado normal de culling
    }
}

