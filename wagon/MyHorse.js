import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { CGFobjModel } from '../utils/CGFobjModel.js';

/**
 * MyHorse
 * Carrega e controla a animação e renderização de um cavalo tridimensional a partir de um ficheiro OBJ.
 * Simula o andamento (trote) através de pequenas oscilações de translação e rotação em tempo real.
 */
export class MyHorse extends CGFobject {
    /**
     * Construtor da classe de cavalo.
     * @param {CGFscene} scene 
     */
    constructor(scene) {
        super(scene);

        // Material com cor de pele castanha escura
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.18, 0.12, 0.075, 1.0);
        this.material.setDiffuse(0.42, 0.25, 0.13, 1.0);
        this.material.setSpecular(0.10, 0.08, 0.055, 1.0);
        this.material.setShininess(10.0);

        // Estado da animação cíclica
        this.gaitPhase = 0.0;
        this.gaitIntensity = 0.0;
        this.gaitSpeedRatio = 0.0;

        // Limites e centro medidos no ficheiro horse.obj.
        // O OBJ original está mapeado em Z-up: X = largura, Y = comprimento, Z = altura.
        this.bounds = {
            min: [-3.5708, -80.8991, 0.1754],
            max: [19.7576, 13.3867, 78.9684],
            center: [8.0934, -33.7562, 39.5719],
            height: 78.793,
        };

        // Carrega o modelo 3D aplicando uma transformação local síncrona para alinhar o modelo na origem local
        this.model = new CGFobjModel(scene, 'objects/horse.obj', {
            transformPosition: ([x, y, z]) => [
                -(y - this.bounds.center[1]),
                z - this.bounds.min[2],
                x - this.bounds.center[0],
            ],
            transformNormal: ([x, y, z]) => [-y, z, x],
        });
    }

    /**
     * Atualiza a fase e intensidade do andamento dinamicamente em função da velocidade da carroça.
     * @param {number} dt Tempo decorrido desde o último frame
     * @param {number} speed Velocidade linear atual da carroça
     * @param {number} maxSpeed Velocidade linear máxima
     */
    update(dt, speed = 0.0, maxSpeed = 1.0) {
        const safeMaxSpeed = Math.max(0.001, maxSpeed);
        const targetRatio = Math.max(0.0, Math.min(1.0, Math.abs(speed) / safeMaxSpeed));
        const blend = Math.min(1.0, dt * 7.0);

        // Interpolação suave para evitar variações bruscas na animação
        this.gaitSpeedRatio += (targetRatio - this.gaitSpeedRatio) * blend;
        this.gaitIntensity += (targetRatio - this.gaitIntensity) * blend;

        const moving = this.gaitSpeedRatio > 0.01;
        if (moving) {
            // A frequência/cadência do passo aumenta com a velocidade
            const cadence = 3.4 + this.gaitSpeedRatio * 6.8;
            this.gaitPhase = (this.gaitPhase + dt * cadence) % (Math.PI * 2.0);
        }
    }

    /**
     * Desenha o cavalo aplicando transformações de oscilação baseadas no andamento.
     * @param {number} targetHeight Altura de escala do cavalo no mundo
     */
    display(targetHeight = 1.75) {
        const gl = this.scene.gl;
        const wasCullEnabled = gl.isEnabled(gl.CULL_FACE);
        const scale = targetHeight / this.bounds.height;
        const intensity = this.gaitIntensity;
        const phase = this.gaitPhase;
        const doublePhase = phase * 2.0;

        // Cálculos procedurais de animação
        const bob = Math.abs(Math.sin(phase)) * 0.11 * intensity;       // Movimento de subir/descer
        const stride = Math.sin(phase) * 0.045 * intensity;              // Passadas horizontais
        const sway = Math.sin(doublePhase) * 0.025 * intensity;          // Oscilação lateral (Roll)
        const pitch = Math.sin(phase + Math.PI * 0.15) * 0.035 * intensity; // Inclinação frontal (Pitch)
        const roll = Math.sin(doublePhase + Math.PI * 0.35) * 0.025 * intensity;
        const yaw = Math.sin(phase) * 0.018 * intensity;                 // Rotação de direção (Yaw)

        this.material.apply();
        gl.disable(gl.CULL_FACE); // Desativa Culling temporariamente para o modelo OBJ complexo

        this.scene.pushMatrix();
        this.scene.translate(stride, bob, sway);
        this.scene.rotate(yaw, 0, 1, 0);
        this.scene.rotate(pitch, 0, 0, 1);
        this.scene.rotate(roll, 1, 0, 0);
        this.scene.scale(scale, scale, scale);
        this.model.display();
        this.scene.popMatrix();

        if (wasCullEnabled) gl.enable(gl.CULL_FACE); // Restaura o estado anterior de Culling
    }
}
