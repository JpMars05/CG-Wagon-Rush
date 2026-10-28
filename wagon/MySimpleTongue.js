import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MyUnitCube } from '../primitives/MyUnitCube.js';
import { MyCylinder } from '../primitives/MyCylinder.js';

/**
 * MySimpleTongue
 * Representa a vara frontal de madeira e os ganchos metálicos que ligam a carroça ao cavalo.
 * É composta por traves convergentes de madeira, ganchos de metal e pinos de fixação.
 */
export class MySimpleTongue extends CGFobject {
    /**
     * Construtor da vara simples.
     * @param {CGFscene} scene 
     */
     constructor(scene) {
        super(scene);
        this.cube = new MyUnitCube(scene);
        this.cylinder = new MyCylinder(scene, 8);

        // Material rústico de madeira para a estrutura
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.3, 0.2, 0.1, 1.0);
        this.material.setDiffuse(0.5, 0.3, 0.15, 1.0);
        this.material.setSpecular(0.1, 0.1, 0.1, 1.0);
        this.material.setShininess(5.0);

        // Material metálico para as ferragens e ganchos de suporte
        this.metalMaterial = new CGFappearance(scene);
        this.metalMaterial.setAmbient(0.2, 0.2, 0.2, 1.0);
        this.metalMaterial.setDiffuse(0.3, 0.3, 0.3, 1.0);
        this.metalMaterial.setSpecular(0.8, 0.8, 0.8, 1.0);
        this.metalMaterial.setShininess(50.0);
    }

    /**
     * Renderiza a vara, as traves diagonais, a barra transversal e as ferragens de acoplamento.
     */
    display() {
        this.material.apply();

        // ── 1. Traves Principais Convergentes ────────────────────────────────
        // Trave Esquerda
        this.scene.pushMatrix();
        this.scene.translate(0, 0, 0.15);
        this.scene.rotate(Math.PI / 60, 0, 1, 0); // Ligeiramente inclinado para dentro
        this.scene.scale(3.0, 0.2, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        // Trave Direita
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -0.15);
        this.scene.rotate(-Math.PI / 60, 0, 1, 0);
        this.scene.scale(3.0, 0.2, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        // ── 2. Barra Transversal de Tração ──────────────────────
        this.scene.pushMatrix();
        this.scene.translate(1.3, 0, 0); // Posicionado perto da ponta
        this.scene.scale(0.2, 0.2, 2.5); // Barra transversal longa
        this.cube.display();
        this.scene.popMatrix();

        // ── 3. Suportes Diagonais Traseiros ────────────
        // Suporte diagonal esquerdo
        this.scene.pushMatrix();
        this.scene.translate(-0.9, 0, 0.55);
        this.scene.rotate(-Math.PI / 5, 0, 1, 0);
        this.scene.scale(1.5, 0.15, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        // Suporte diagonal direito
        this.scene.pushMatrix();
        this.scene.translate(-0.9, 0, -0.55);
        this.scene.rotate(Math.PI / 5, 0, 1, 0);
        this.scene.scale(1.5, 0.15, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        // ── 4. Ferragens, Ganchos e Reforço de Metal ─────────────────────────
        this.metalMaterial.apply();
        
        // Ponta frontal reforçada com metal
        this.scene.pushMatrix();
        this.scene.translate(1.5, 0, 0);
        this.scene.scale(0.2, 0.25, 0.4);
        this.cube.display();
        this.scene.popMatrix();

        // Anel de tração 
        this.scene.pushMatrix();
        this.scene.translate(1.65, 0, 0);
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.scene.scale(0.15, 0.15, 0.05);
        this.cylinder.display();
        this.scene.popMatrix();

        // Pinos de fixação nas extremidades da barra transversal
        for (let z of [-1.15, 1.15]) {
            this.scene.pushMatrix();
            this.scene.translate(1.3, 0.1, z);
            this.scene.rotate(Math.PI / 2, 1, 0, 0);
            this.scene.scale(0.05, 0.05, 0.25);
            this.cylinder.display();
            this.scene.popMatrix();
        }
    }
}

