import { CGFobject } from '../../lib/CGF.js';

/**
 * MyPlane
 * Desenha um plano subdividido em N divisões no plano XY, centrado na origem.
 */
export class MyPlane extends CGFobject {
    constructor(scene, nDivs, minS = 0, maxS = 1, minT = 0, maxT = 1) {
        super(scene);
        this.nDivs = typeof nDivs !== 'undefined' ? nDivs : 1;
        this.patchLength = 1.0 / this.nDivs;
        this.minS = minS;
        this.maxS = maxS;
        this.minT = minT;
        this.maxT = maxT;
        
        this.initBuffers();
    }

    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        var yCoord = 0.5;
        // Percorrer as linhas e colunas para gerar a grelha de pontos
        for (var j = 0; j <= this.nDivs; j++) {
            var xCoord = -0.5;
            for (var i = 0; i <= this.nDivs; i++) {
                // Desenhar no plano XY virado para Z+
                this.vertices.push(xCoord, yCoord, 0);
                this.normals.push(0, 0, 1);
                
                // Mapear coordenadas de textura (s, t) interpoladas de acordo com os limites passados
                this.texCoords.push(this.minS + i * (this.maxS - this.minS) / this.nDivs, this.minT + j * (this.maxT - this.minT) / this.nDivs);
                xCoord += this.patchLength;
            }
            yCoord -= this.patchLength;
        }

        // Criar triângulos ligando os pontos gerados
        for (var j = 0; j < this.nDivs; j++) {
            for (var i = 0; i < this.nDivs; i++) {
                // Índices dos 4 cantos de cada quadrícula da grelha
                var p1 = j * (this.nDivs + 1) + i;
                var p2 = j * (this.nDivs + 1) + (i + 1);
                var p3 = (j + 1) * (this.nDivs + 1) + i;
                var p4 = (j + 1) * (this.nDivs + 1) + (i + 1);

                // Desenhar dois triângulos por quadrícula (sentido CCW)
                this.indices.push(p1, p3, p2);
                this.indices.push(p2, p3, p4);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}