import { CGFobject } from '../../lib/CGF.js';

/**
 * MyUnitCube
 * Cubo unitário de 1x1x1 centrado na origem, com mapeamento de texturas e normais para as 6 faces.
 */
export class MyUnitCube extends CGFobject {
    constructor(scene) {
        super(scene);
        this.initBuffers();
    }
    
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.texCoords = [];

        var x2 = 0.5, y2 = 0.5, z2 = 0.5;

        // FRENTE (Z = 0.5)
        this.vertices.push(-x2, -y2, z2,  x2, -y2, z2,  -x2, y2, z2,  x2, y2, z2);
        this.normals.push(0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);
        
        // TRÁS (Z = -0.5)
        this.vertices.push(x2, -y2, -z2,  -x2, -y2, -z2,  x2, y2, -z2,  -x2, y2, -z2);
        this.normals.push(0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);

        // CIMA (Y = 0.5)
        this.vertices.push(-x2, y2, z2,  x2, y2, z2,  -x2, y2, -z2,  x2, y2, -z2);
        this.normals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);

        // BAIXO (Y = -0.5)
        this.vertices.push(-x2, -y2, -z2,  x2, -y2, -z2,  -x2, -y2, z2,  x2, -y2, z2);
        this.normals.push(0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);

        // DIREITA (X = 0.5)
        this.vertices.push(x2, -y2, z2,  x2, -y2, -z2,  x2, y2, z2,  x2, y2, -z2);
        this.normals.push(1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);

        // ESQUERDA (X = -0.5)
        this.vertices.push(-x2, -y2, -z2,  -x2, -y2, z2,  -x2, y2, -z2,  -x2, y2, z2);
        this.normals.push(-1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0);
        this.texCoords.push(0, 1,  1, 1,  0, 0,  1, 0);

        // Gerar triângulos (2 por face) com base no offset de cada uma das 6 faces
        for (var i = 0; i < 6; i++) {
            var offset = i * 4;
            this.indices.push(offset, offset + 1, offset + 2);
            this.indices.push(offset + 1, offset + 3, offset + 2);
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

