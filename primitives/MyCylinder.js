import { CGFobject } from '../../lib/CGF.js';

/**
 * MyCylinder
 * Primitiva que desenha um cilindro ao longo do eixo Z, de -0.5 a 0.5, com raio 1.
 * Inclui o corpo lateral e as tampas circular superior e inferior.
 */
export class MyCylinder extends CGFobject {
    constructor(scene, slices = 16) {
        super(scene);
        this.slices = slices;
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.texCoords = [];

        var ang = 0;
        var alphaAng = 2 * Math.PI / this.slices;

        // --- Corpo Lateral do Cilindro ---
        // Desenhar duas linhas de pontos (Z = -0.5 e Z = 0.5) para cada fatia
        for(var i = 0; i <= this.slices; i++) {
            var sa = Math.sin(ang);
            var ca = Math.cos(ang);

            // Vértice na base de trás (Z = -0.5)
            this.vertices.push(ca, sa, -0.5);
            // Vértice na base da frente (Z = 0.5)
            this.vertices.push(ca, sa, 0.5);

            // Normais apontam para fora do eixo Z (sem inclinação em Z)
            this.normals.push(ca, sa, 0);
            this.normals.push(ca, sa, 0);

            // Coordenadas de textura s varia ao longo da circunferência, t varia ao longo do comprimento
            this.texCoords.push(i / this.slices, 1);
            this.texCoords.push(i / this.slices, 0);

            // Criar faces laterais (quadrados divididos em 2 triângulos)
            if (i > 0) {
                var p1 = (i - 1) * 2;
                var p2 = (i - 1) * 2 + 1;
                var p3 = i * 2;
                var p4 = i * 2 + 1;

                this.indices.push(p1, p3, p2);
                this.indices.push(p2, p3, p4);
            }
            ang += alphaAng;
        }

        // --- Tampas do Cilindro ---
        var offset = this.vertices.length / 3;
        
        // 1. Tampa Z = -0.5 (Trás)
        // Adicionar o ponto central da tampa
        this.vertices.push(0, 0, -0.5);
        this.normals.push(0, 0, -1);
        this.texCoords.push(0.5, 0.5);
        var centerTop = offset;
        offset++;
        
        // Adicionar os pontos do perímetro
        ang = 0;
        for(var i = 0; i <= this.slices; i++) {
            var sa = Math.sin(ang);
            var ca = Math.cos(ang);
            this.vertices.push(ca, sa, -0.5);
            this.normals.push(0, 0, -1);
            this.texCoords.push(0.5 + ca/2, 0.5 - sa/2);
            
            // Ligar o ponto atual, o ponto anterior e o centro
            if (i > 0) {
                this.indices.push(centerTop, offset + i, offset + i - 1);
            }
            ang += alphaAng;
        }
        offset += this.slices + 1;

        // 2. Tampa Z = 0.5 (Frente)
        // Adicionar o ponto central da tampa
        this.vertices.push(0, 0, 0.5);
        this.normals.push(0, 0, 1);
        this.texCoords.push(0.5, 0.5);
        var centerBottom = offset;
        offset++;
        
        // Adicionar os pontos do perímetro
        ang = 0;
        for(var i = 0; i <= this.slices; i++) {
            var sa = Math.sin(ang);
            var ca = Math.cos(ang);
            this.vertices.push(ca, sa, 0.5);
            this.normals.push(0, 0, 1);
            this.texCoords.push(0.5 + ca/2, 0.5 + sa/2);
            
            // Ligar o ponto anterior, o ponto atual e o centro (sentido CCW)
            if (i > 0) {
                this.indices.push(centerBottom, offset + i - 1, offset + i);
            }
            ang += alphaAng;
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

