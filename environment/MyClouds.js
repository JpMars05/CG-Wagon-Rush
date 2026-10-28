import { CGFobject, CGFappearance, CGFshader } from '../../lib/CGF.js';

/**
 * MyClouds
 * Cúpula hemisférica superior de nuvens dinâmicas.
 * Renderiza um céu nublado com rotação contínua e controlo de transparência/cobertura via shader.
 * Utiliza mistura (blending) do WebGL e desativa a escrita no buffer de profundidade (depth mask)
 * para permitir que a luz do sol e o fundo do domo de céu espreitem entre as nuvens.
 */
export class MyClouds extends CGFobject {
    constructor(scene, radius = 99, slices = 40, stacks = 20) {
        super(scene);
        this.radius = radius;
        this.slices = slices;
        this.stacks = stacks;
        this.rotationAngle = 0;

        // Gerar a malha do hemisfério
        this.initBuffers();
        
        // Configurar material difuso e textura base
        this.initMaterial();

        // Inicializar shader personalizado de nuvens (permite esbater texturas com base no canal alfa e cor do crepúsculo)
        this.cloudsShader = new CGFshader(this.scene.gl, "shaders/clouds.vert", "shaders/clouds.frag");
        this.cloudsShader.setUniformsValues({ 
            uSampler: 0, 
            uCloudCover: 0.5, 
            uSunVisibility: 1.0, 
            uTwilightFactor: 0.0 
        });
    }

    /**
     * Constrói a geometria de um hemisfério (cúpula superior) com normais invertidas.
     */
    initBuffers() {
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        this.indices = [];

        // Construir cúpula de stack = 0 (equador) até stack = stacks (topo)
        for (let stack = 0; stack <= this.stacks; stack++) {
            // phi varia de 0 (topo/norte) até PI/2 (equador horizontal)
            const phi = (stack * Math.PI) / (2 * this.stacks);
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            for (let slice = 0; slice <= this.slices; slice++) {
                const theta = (slice * 2 * Math.PI) / this.slices;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                // Coordenadas cartesianas a partir das coordenadas esféricas
                const x = this.radius * sinPhi * cosTheta;
                const y = this.radius * cosPhi;
                const z = this.radius * sinPhi * sinTheta;

                this.vertices.push(x, y, z);

                // Normais apontadas para dentro, pois a câmara observa a cúpula pelo interior
                this.normals.push(-sinPhi * cosTheta, -cosPhi, -sinPhi * sinTheta);

                // Coordenadas de textura cilíndricas lineares
                this.texCoords.push(slice / this.slices, stack / this.stacks);
            }
        }

        // Definir a topologia dos triângulos visível pelo interior (sentido inverso do padrão)
        for (let stack = 0; stack < this.stacks; stack++) {
            for (let slice = 0; slice < this.slices; slice++) {
                const first = (stack * (this.slices + 1)) + slice;
                const second = first + this.slices + 1;

                // Winding order específico para visualização a partir do centro (dentro para fora)
                this.indices.push(first + 1, second, first);
                this.indices.push(first + 1, second + 1, second);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    /**
     * Inicializa a aparência das nuvens com o mapa de textura HDRI tonemapped.
     */
    initMaterial() {
        this.material = new CGFappearance(this.scene);
        this.material.setAmbient(0.8, 0.8, 0.8, 1.0);
        this.material.setDiffuse(1.0, 1.0, 1.0, 1.0);
        this.material.setSpecular(0.0, 0.0, 0.0, 1.0);

        // Emissão ambiente ténue para as nuvens continuarem parcialmente visíveis durante a noite
        this.material.setEmission(0.1, 0.1, 0.1, 1.0);

        this.texture = this.scene.assets.getTexture('textures/DaySkyHDRI007B_2K_TONEMAPPED.jpg');
        this.material.setTexture(this.texture);

        // Repetir no sentido horizontal (Z/X) e cortar/clamp no horizonte (Y)
        this.material.setTextureWrap('REPEAT', 'CLAMP_TO_EDGE');
    }

    /**
     * Permite reconfigurar dinamicamente a subdivisão da cúpula se necessário.
     */
    updateBuffers(radius, slices, stacks) {
        this.radius = radius;
        this.slices = slices;
        this.stacks = stacks;
        this.initBuffers();
    }

    /**
     * Atualiza o ângulo de rotação do céu para simular a deslocação do vento.
     */
    update(timeSinceStart) {
        this.rotationAngle = timeSinceStart * 0.02;
    }

    /**
     * Renderiza o hemisfério de nuvens com misturas de transparência.
     */
    display(cloudCover = 1.0, cloudSpeed = 1.0) {
        const gl = this.scene.gl;

        // Desativar culling para garantir que ambas as faces da cúpula possam ser processadas se necessário
        gl.disable(gl.CULL_FACE);
        
        // Ativar alfa blending (permite transparência gradual das nuvens)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);

        // Desativar escrita no Depth Buffer para as nuvens não taparem o Sol ou as estrelas
        // que estão desenhados a distâncias teoricamente maiores na cúpula celeste
        gl.depthMask(false);

        this.scene.pushMatrix();

        // Aplicar rotação contínua proporcional à velocidade do vento configurada
        this.scene.rotate(this.rotationAngle * cloudSpeed, 0, 1, 0);

        // Ativar o shader personalizado de nuvens e passar uniformes
        this.scene.setActiveShader(this.cloudsShader);
        this.cloudsShader.setUniformsValues({
            uCloudCover: cloudCover,
            uSunVisibility: this.scene._sunVisibility(),
            uTwilightFactor: this.scene.twilightFactor ?? 0.0,
        });

        this.material.apply();
        super.display();

        // Restaurar o shader padrão
        this.scene.setActiveShader(this.scene.defaultShader);

        this.scene.popMatrix();

        // Repor os estados originais do pipeline WebGL
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
}
