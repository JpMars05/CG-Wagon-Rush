import { CGFobject } from '../../lib/CGF.js';

/**
 * MyHemisphere
 * Meia-esfera com faces e normais orientadas para o interior, usada para criar o Sky Dome.
 */
export class MyHemisphere extends CGFobject {
    constructor(scene, radius = 1.0, slices = 40, stacks = 20) {
        super(scene);

        // Guardar parâmetros para podermos atualizar a geometria dinamicamente
        this.radius = radius;
        this.slices = slices;
        this.stacks = stacks;

        this.initBuffers();
    }

    /**
     * Inicializa os buffers de geometria.
     * Implementa winding order CCW (Counter-Clockwise) visto do interior.
     */
    initBuffers() {
        this.vertices  = [];
        this.normals   = [];
        this.texCoords = [];
        this.indices   = [];

        const R      = this.radius;
        const stacks = this.stacks;
        const slices = this.slices;

        // Gerar vértices, normais e coordenadas de textura
        for (let i = 0; i <= stacks; i++) {
            const phi    = (Math.PI / 2) * (i / stacks);
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            for (let j = 0; j <= slices; j++) {
                const theta    = (2 * Math.PI) * (j / slices);
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                // O eixo Y é o eixo vertical (topo da esfera)
                const x = R * sinPhi * cosTheta;
                const y = R * cosPhi;
                const z = R * sinPhi * sinTheta;

                this.vertices.push(x, y, z);

                // Normais invertidas: apontam para o centro da esfera (0,0,0) para vermos a iluminação por dentro
                this.normals.push(
                    -sinPhi * cosTheta,
                    -cosPhi,
                    -sinPhi * sinTheta
                );

                // Mapeamento UV para cobrir o interior da cúpula
                this.texCoords.push(j / slices, i / stacks);
            }
        }

        // Gerar índices com winding order CCW visto do interior da esfera
        for (let i = 0; i < stacks; i++) {
            for (let j = 0; j < slices; j++) {
                const a = i * (slices + 1) + j;
                const b = a + (slices + 1);

                // Invertido (a, b, a+1) para que a face da frente seja a interior
                this.indices.push(a, b, a + 1);
                this.indices.push(b, b + 1, a + 1);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    /**
     * Reconstrói os buffers se mudarmos os parâmetros na interface.
     */
    updateBuffers(radius, slices, stacks) {
        this.radius  = radius;
        this.slices  = slices;
        this.stacks  = stacks;
        this.initBuffers();
    }
}

