import { CGFobject, CGFshader } from '../../lib/CGF.js';
import { MyPlane } from '../primitives/MyPlane.js';

/**
 * MyTerrain
 * Representa o relevo e o solo da cena de jogo.
 * Utiliza uma malha plana deformada no Vertex Shader com base num Heightmap (mapa de alturas).
 * Aplica texturas PBR (normal/specular), máscara de estradas e texturas de rocha para as montanhas,
 * suportando iluminação dinâmica (luz solar e farol/lanterna da carroça).
 */
export class MyTerrain extends CGFobject {
    constructor(scene) {
        super(scene);

        // Plano com resolução moderada (96x96 divisões) para suportar a deformação sem sobrecarregar o GPU.
        this.plane = new MyPlane(this.scene, 96);

        // O shader de terreno realiza a deformação física dos vértices do plano e o blending de texturas.
        // O CPU lê o mesmo heightmap para que a física da carroça, relva e vegetação fiquem alinhadas.
        this.terrainShader = new CGFshader(this.scene.gl, "shaders/terrain.vert", "shaders/terrain.frag");

        // Carregar as texturas do terreno (difusa e PBR normal/specular)
        this.terrainNormalMap = this.scene.assets.getTexture('textures/terrain_normal.jpg');
        this.terrainSpecularMap = this.scene.assets.getTexture('textures/terrain_specular.jpg');
        
        // Máscara e textura da estrada
        this.roadMask = this.scene.assets.getTexture('textures/road_mask.png');
        this.roadTexture = this.scene.assets.getTexture('textures/road_color.jpg');
        
        // Texturas das montanhas exteriores (rocha e normal map)
        this.rockColorMap = this.scene.assets.getTexture('textures/rock1_color.jpg');
        this.rockNormalMap = this.scene.assets.getTexture('textures/rock1_normal.jpg');

        // Configurar as unidades e variáveis uniformes (uniforms) iniciais do shader
        this.terrainShader.setUniformsValues({
            uSampler: 0,                // Canal 0: Textura difusa do terreno (atribuído pelo material da cena)
            uHeightMap: 1,              // Canal 1: Mapa de alturas
            uSamplerNormal: 2,          // Canal 2: Normal map do terreno
            uSamplerSpecular: 3,        // Canal 3: Specular map do terreno
            uRoadMask: 4,               // Canal 4: Máscara binária da estrada
            uRoadSampler: 5,            // Canal 5: Textura de estrada de terra batida
            uRockSampler: 6,            // Canal 6: Textura difusa de rocha das montanhas
            uRockNormalSampler: 7,      // Canal 7: Normal map de rocha
            uPlayAreaRadius: this.scene.playAreaRadius ?? 250.0,
            uWorldScale: this.scene.skyRadius * 2.0,
            uRoadRepeat: 18.0,          // Frequência de repetição da textura da estrada
            uRoadStrength: 1.0,         // Força de mistura da estrada no shader
            uRoadDepression: 0.25,      // Profundidade da depressão da estrada no relevo
            uLightDirView: [0, 1, 0],
            uSunVisibility: 1.0,
            uLanternPosView: [0, 0, 0],
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: 18.0,
            uLanternIntensity: 0.0,
            uTime: 0
        });
    }

    /**
     * Atualiza o tempo global no shader (útil caso haja efeitos temporais ou animações).
     * @param {number} t Tempo em milissegundos
     */
    update(t) {
        this.terrainShader.setUniformsValues({ uTime: t / 1000.0 });
    }

    /**
     * Prepara a iluminação em View Space, faz o binding das texturas e renderiza o terreno deitado.
     */
    display() {
        // Obter a matriz da câmara e a direção global do sol
        const vm = this.scene.camera.getViewMatrix();
        const ld = this.scene._sunDir();
        
        // Multiplicar o vetor de luz solar pela View Matrix da câmara para obter a direção em View Space
        // (necessário porque o fragment shader calcula o sombreamento usando normais e direções nesse espaço)
        const lightDirView = [
            vm[0] * ld[0] + vm[4] * ld[1] + vm[8] * ld[2],
            vm[1] * ld[0] + vm[5] * ld[1] + vm[9] * ld[2],
            vm[2] * ld[0] + vm[6] * ld[1] + vm[10] * ld[2]
        ];
        
        // Atualizar as variáveis de iluminação solar e da lanterna móvel
        this.terrainShader.setUniformsValues({
            uLightDirView: lightDirView,
            uSunVisibility: this.scene._sunVisibility(),
            uLanternPosView: this.scene._lanternViewPos(),
            uLanternColor: [1.0, 0.72, 0.38],
            uLanternRadius: this.scene._lanternRadius(),
            uLanternIntensity: this.scene._lanternIntensity()
        });

        // Ativar o shader personalizado de terreno
        this.scene.setActiveShader(this.terrainShader);

        // Bindings das texturas (associa cada ficheiro à unidade WebGL correspondente)
        this.scene.heightMapTexture.bind(1);
        this.terrainNormalMap.bind(2);
        this.terrainSpecularMap.bind(3);
        this.roadMask.bind(4);
        this.roadTexture.bind(5);
        if(this.rockColorMap) this.rockColorMap.bind(6);
        if(this.rockNormalMap) this.rockNormalMap.bind(7);

        this.scene.pushMatrix();

        // O MyPlane é gerado no plano XY por defeito.
        // Roda -90º em torno de X para colocá-lo horizontalmente no plano XZ (chão).
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);

        // Escalar o terreno para preencher toda a base do Sky Dome (diâmetro = skyRadius * 2)
        const worldScale = this.scene.skyRadius * 2;
        this.scene.scale(worldScale, worldScale, 1);
        
        // Renderizar a malha do plano
        this.plane.display();

        this.scene.popMatrix();
        
        // Restaurar o shader padrão da cena
        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
