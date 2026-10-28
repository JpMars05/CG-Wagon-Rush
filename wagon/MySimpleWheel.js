import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MyUnitCube } from '../primitives/MyUnitCube.js';
import { MyCylinder } from '../primitives/MyCylinder.js';

/**
 * MySimpleWheel
 * Representa uma roda de madeira reforçada com aro metálico e 12 raios.
 * Utiliza primitivas geométricas (cubo e cilindro) para construir a roda.
 */
export class MySimpleWheel extends CGFobject {
    /**
     * Construtor da roda simples.
     * @param {CGFscene} scene 
     */
    constructor(scene) {
        super(scene);
        this.cube = new MyUnitCube(scene);
        this.cylinder = new MyCylinder(scene, 16);
        
        // Material de madeira escura para o centro e raios
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.2, 0.1, 0.05, 1.0);
        this.material.setDiffuse(0.4, 0.2, 0.1, 1.0);
        this.material.setSpecular(0.1, 0.1, 0.1, 1.0);
        this.material.setShininess(10.0);

        // Material metálico para o aro exterior
        this.metalMaterial = new CGFappearance(scene);
        this.metalMaterial.setAmbient(0.3, 0.3, 0.3, 1.0);
        this.metalMaterial.setDiffuse(0.4, 0.4, 0.4, 1.0);
        this.metalMaterial.setSpecular(0.8, 0.8, 0.8, 1.0);
        this.metalMaterial.setShininess(50.0);
    }

    /**
     * Desenha a roda na cena combinando o hub, raios, aro de madeira e aro de metal.
     */
    display() {
        // ── 1. Hub Central ───────────────────────────────────────────────────
        this.material.apply();
        this.scene.pushMatrix();
        this.scene.scale(0.3, 0.3, 0.4); // Eixo central
        this.cylinder.display();
        this.scene.popMatrix();

        // ── 2. Raios da Roda (12 Spokes) ──────────────────────────────────────
        for (let i = 0; i < 12; i++) {
            this.scene.pushMatrix();
            this.scene.rotate(i * Math.PI / 6, 0, 0, 1);
            this.scene.translate(0, 0.5, 0); 
            this.scene.scale(0.06, 0.9, 0.06); // Raios espessos
            this.cube.display();
            this.scene.popMatrix();
        }

        // ── 3. Aro de Madeira (16 segmentos acoplados) ────────────────────────
        let numSegments = 16;
        let angleStep = (2 * Math.PI) / numSegments;
        let segmentLength = 2 * Math.PI * 1.0 / numSegments + 0.05; 

        for (let i = 0; i < numSegments; i++) {
            this.scene.pushMatrix();
            this.scene.rotate(i * angleStep, 0, 0, 1);
            this.scene.translate(0, 0.95, 0); 
            this.scene.scale(segmentLength, 0.12, 0.18); // Aro de madeira
            this.cube.display();
            this.scene.popMatrix();
        }

        // ── 4. Aro Metálico Protetor Exterior ───────────────────────────────
        this.metalMaterial.apply();
        for (let i = 0; i < numSegments; i++) {
            this.scene.pushMatrix();
            this.scene.rotate(i * angleStep, 0, 0, 1);
            this.scene.translate(0, 1.01, 0); 
            this.scene.scale(segmentLength + 0.01, 0.04, 0.20); // Aro metálico
            this.cube.display();
            this.scene.popMatrix();
        }
    }
}

