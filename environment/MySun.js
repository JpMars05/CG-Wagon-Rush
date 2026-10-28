import { CGFobject, CGFappearance } from '../../lib/CGF.js';

/**
 * MySun
 * Representa o Sol na cena como uma esfera emissiva com textura detalhada.
 * Permite controlar dinamicamente a intensidade emissiva com base na visibilidade (por exemplo, ao anoitecer).
 */
export class MySun extends CGFobject {
    constructor(scene, size = 4.0) {
        super(scene);
        this.size = size;
        
        // Criar a geometria esférica do sol
        this.initBuffers();
        
        // Inicializar materiais e texturas
        this._buildMaterial();
    }

    /**
     * Gera os vértices, normais e coordenadas de textura de uma esfera 3D.
     */
    initBuffers() {
        this.vertices = []; 
        this.normals = []; 
        this.texCoords = []; 
        this.indices = [];
        const slices = 32, stacks = 32;

        // Gerar coordenadas esféricas polares
        for (let i = 0; i <= stacks; i++) {
            const theta = i * Math.PI / stacks;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let j = 0; j <= slices; j++) {
                const phi = j * 2 * Math.PI / slices;
                const x = Math.cos(phi) * sinTheta;
                const y = cosTheta;
                const z = Math.sin(phi) * sinTheta;
                
                // Escalar pelo tamanho do sol desejado
                this.vertices.push(x * this.size, y * this.size, z * this.size);
                
                // Em esferas centradas na origem, a normal é igual ao ponto normalizado
                this.normals.push(x, y, z);
                
                // Mapeamento de textura esférico cilíndrico
                this.texCoords.push(1 - j / slices, i / stacks);
            }
        }

        // Definir a topologia dos triângulos (conectividade)
        for (let i = 0; i < stacks; i++) {
            for (let j = 0; j < slices; j++) {
                const first = (i * (slices + 1)) + j;
                const second = first + slices + 1;
                
                this.indices.push(first, second, first + 1);
                this.indices.push(second, second + 1, first + 1);
            }
        }
        
        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    /**
     * Constrói o material emissivo amarelo/dourado e associa a textura do sol.
     */
    _buildMaterial() {
        this.mat = new CGFappearance(this.scene);
        this.texture = this.scene.assets.getTexture('textures/sun1.jpg');
        this.mat.setTexture(this.texture);

        // O sol brilha por emissão própria, ignorando parcialmente a iluminação ambiente
        this.mat.setEmission(1.0, 0.9, 0.5, 1.0); 
        this.mat.setAmbient(0.3, 0.3, 0.3, 1.0);
        this.mat.setDiffuse(0.7, 0.7, 0.7, 1.0);
        this.mat.setSpecular(1.0, 1.0, 1.0, 1.0);
        this.mat.setShininess(100);
    }

    /**
     * Renderiza o Sol escalando a iluminação e a emissão com base na visibilidade diurna.
     * @param {number} [visibility=1.0] Fator de brilho do sol (0.0 a 1.0)
     */
    display(visibility = 1.0) {
        const v = Math.max(0.0, Math.min(1.0, visibility));
        
        // Modifica dinamicamente a emissividade e difusão no apply para simular pôr-do-sol
        this.mat.setEmission(1.0 * v, 0.9 * v, 0.5 * v, 1.0);
        this.mat.setAmbient(0.3 * v, 0.3 * v, 0.3 * v, 1.0);
        this.mat.setDiffuse(0.7 * v, 0.7 * v, 0.7 * v, 1.0);
        this.mat.apply();
        
        super.display();
    }
}
