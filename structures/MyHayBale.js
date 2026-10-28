import { CGFobject, CGFappearance } from '../../lib/CGF.js';

/**
 * HayBlock
 * Um cubo esticado cujas coordenadas de textura escalam com as dimensões do bloco,
 * evitando que a textura de feno fique deformada/esticada.
 */
class HayBlock extends CGFobject {
    constructor(scene, length, height, depth) {
        super(scene);
        this.length = length;
        this.height = height;
        this.depth = depth;
        this.initBuffers();
    }
    
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.texCoords = [];

        var x2 = this.length / 2;
        var y2 = this.height / 2;
        var z2 = this.depth / 2;

        // FRENTE (Z = z2)
        this.vertices.push(-x2, -y2, z2,  x2, -y2, z2,  -x2, y2, z2,  x2, y2, z2);
        this.normals.push(0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1);
        this.texCoords.push(0, this.height,  this.length, this.height,  0, 0,  this.length, 0);
        
        // TRÁS (Z = -z2)
        this.vertices.push(x2, -y2, -z2,  -x2, -y2, -z2,  x2, y2, -z2,  -x2, y2, -z2);
        this.normals.push(0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1);
        this.texCoords.push(0, this.height,  this.length, this.height,  0, 0,  this.length, 0);

        // CIMA (Y = y2)
        this.vertices.push(-x2, y2, z2,  x2, y2, z2,  -x2, y2, -z2,  x2, y2, -z2);
        this.normals.push(0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0);
        this.texCoords.push(0, this.depth,  this.length, this.depth,  0, 0,  this.length, 0);

        // BAIXO (Y = -y2)
        this.vertices.push(-x2, -y2, -z2,  x2, -y2, -z2,  -x2, -y2, z2,  x2, -y2, z2);
        this.normals.push(0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0);
        this.texCoords.push(0, this.depth,  this.length, this.depth,  0, 0,  this.length, 0);

        // DIREITA (X = x2)
        this.vertices.push(x2, -y2, z2,  x2, -y2, -z2,  x2, y2, z2,  x2, y2, -z2);
        this.normals.push(1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0);
        this.texCoords.push(0, this.height,  this.depth, this.height,  0, 0,  this.depth, 0);

        // ESQUERDA (X = -x2)
        this.vertices.push(-x2, -y2, -z2,  -x2, -y2, z2,  -x2, y2, -z2,  -x2, y2, z2);
        this.normals.push(-1, 0, 0,  -1, 0, 0,  -1, 0, 0,  -1, 0, 0);
        this.texCoords.push(0, this.height,  this.depth, this.height,  0, 0,  this.depth, 0);

        for (var i = 0; i < 6; i++) {
            var offset = i * 4;
            this.indices.push(offset, offset + 1, offset + 2);
            this.indices.push(offset + 1, offset + 3, offset + 2);
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }
}

/**
 * MyHayBale
 * Representa um fardo de palha com textura e duas cordas de amarração à volta.
 */
export class MyHayBale extends CGFobject {
    constructor(scene) {
        super(scene);
        
        // Criar o bloco de palha principal
        this.baleObj = new HayBlock(scene, 1.5, 1.0, 1.0);
        
        // Criar os blocos das cordas verticais e horizontais
        this.ropeVerticalObj = new HayBlock(scene, 0.04, 0.95, 0.02);
        this.ropeHorizontalObj = new HayBlock(scene, 0.04, 0.02, 0.95);

        // Configurar material e textura da palha
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.4, 0.35, 0.15, 1.0);
        this.material.setDiffuse(0.8, 0.7, 0.35, 1.0);
        this.material.setSpecular(0.05, 0.05, 0.05, 1.0);
        this.material.setEmission(0.0, 0.0, 0.0, 1);
        this.material.setShininess(5.0);
        this.hayTex = scene.assets.getTexture('textures/feno.png');
        this.material.setTexture(this.hayTex);
        this.material.setTextureWrap('REPEAT', 'REPEAT');

        // Configurar material e textura das cordas 
        this.ropeMat = new CGFappearance(scene);
        this.ropeMat.setAmbient(0.15, 0.1, 0.05, 1.0);
        this.ropeMat.setDiffuse(0.4, 0.3, 0.15, 1.0);
        this.ropeMat.setSpecular(0.05, 0.05, 0.05, 1.0);
        this.ropeMat.setEmission(0, 0, 0, 1);
        this.ropeMat.setShininess(10.0);
        this.ropeTex = scene.assets.getTexture('textures/barn_wood.jpg');
        this.ropeMat.setTexture(this.ropeTex);
        this.ropeMat.setTextureWrap('REPEAT', 'REPEAT');
    }

    display() {
        const sc = this.scene;

        // 1. Desenhar o fardo de palha
        this.material.apply();
        sc.pushMatrix();
        this.baleObj.display();
        sc.popMatrix();

        // 2. Desenhar as duas cordas
        this.ropeMat.apply();
        for (const xOff of [-0.4, 0.4]) {
            // Cordas verticais
            sc.pushMatrix();
            sc.translate(xOff, 0, 0.51);
            this.ropeVerticalObj.display();
            sc.popMatrix();

            sc.pushMatrix();
            sc.translate(xOff, 0, -0.51);
            this.ropeVerticalObj.display();
            sc.popMatrix();

            // Cordas horizontais
            sc.pushMatrix();
            sc.translate(xOff, 0.51, 0);
            this.ropeHorizontalObj.display();
            sc.popMatrix();

            sc.pushMatrix();
            sc.translate(xOff, -0.51, 0);
            this.ropeHorizontalObj.display();
            sc.popMatrix();
        }
    }
}
