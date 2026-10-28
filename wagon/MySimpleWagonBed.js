import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MyUnitCube } from '../primitives/MyUnitCube.js';
import { MyCylinder } from '../primitives/MyCylinder.js';

/**
 * MySimpleWagonBed
 * Representa a cama de madeira da carroça, incluindo as paredes laterais com estacas,
 * banco do condutor, caixa de ferramentas exterior e um rolo de lona de reserva.
 */
export class MySimpleWagonBed extends CGFobject {
    /**
     * Construtor da cama da carroça.
     * @param {CGFscene} scene 
     */
    constructor(scene) {
        super(scene);
        this.cube = new MyUnitCube(scene);
        this.cylinder = new MyCylinder(scene, 16);

        // Material de madeira clara para as tábuas estruturais principais
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.4, 0.3, 0.2, 1.0);
        this.material.setDiffuse(0.65, 0.45, 0.25, 1.0);
        this.material.setSpecular(0.1, 0.1, 0.1, 1.0);
        this.material.setShininess(5.0);

        // Material para as tiras de couro 
        this.darkMaterial = new CGFappearance(scene);
        this.darkMaterial.setAmbient(0.2, 0.1, 0.05, 1.0);
        this.darkMaterial.setDiffuse(0.35, 0.15, 0.05, 1.0);
        this.darkMaterial.setSpecular(0.2, 0.2, 0.2, 1.0);
        this.darkMaterial.setShininess(10.0);

        // Material bege para o rolo de lona enrolado
        this.canvasMaterial = new CGFappearance(scene);
        this.canvasMaterial.setAmbient(0.7, 0.65, 0.55, 1.0);
        this.canvasMaterial.setDiffuse(0.85, 0.8, 0.7, 1.0);
        this.canvasMaterial.setSpecular(0.05, 0.05, 0.05, 1.0);
        this.canvasMaterial.setShininess(1.0);

        // Material de madeira escura
        this.toolboxMaterial = new CGFappearance(scene);
        this.toolboxMaterial.setAmbient(0.3, 0.2, 0.1, 1.0);
        this.toolboxMaterial.setDiffuse(0.4, 0.25, 0.15, 1.0);
        this.toolboxMaterial.setSpecular(0.3, 0.3, 0.3, 1.0);
        this.toolboxMaterial.setShininess(20.0);
    }

    /**
     * Renderiza e monta a caixa da carroça combinando múltiplos cubos e cilindros escalados.
     */
    display() {
        this.material.apply();

        // ── 1. Piso da Carroça ─────────────────
        this.scene.pushMatrix();
        this.scene.translate(0, -0.45, 0);
        this.scene.scale(5.0, 0.1, 2.4);
        this.cube.display();
        this.scene.popMatrix();

        // ── 2. Painéis Verticais das Paredes Laterais  ─────
        // 10 tábuas de 0.48 de largura com pequeno espaçamento
        for (let i = 0; i < 10; i++) {
            let xPos = -2.25 + i * 0.5;

            // Parede Esquerda
            this.scene.pushMatrix();
            this.scene.translate(xPos, 0.05, -1.15);
            this.scene.scale(0.48, 0.9, 0.1);
            this.cube.display();
            this.scene.popMatrix();

            // Parede Direita
            this.scene.pushMatrix();
            this.scene.translate(xPos, 0.05, 1.15);
            this.scene.scale(0.48, 0.9, 0.1);
            this.cube.display();
            this.scene.popMatrix();
        }

        // ── 3. Rebordos Superiores Horizontais ───────────
        this.scene.pushMatrix();
        this.scene.translate(0, 0.55, -1.15);
        this.scene.scale(5.1, 0.1, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(0, 0.55, 1.15);
        this.scene.scale(5.1, 0.1, 0.15);
        this.cube.display();
        this.scene.popMatrix();

        // ── 4. Parede Traseira (Tábuas Verticais) ─────────────────────────────
        for (let i = 0; i < 5; i++) {
            let zPos = -1.0 + i * 0.5;
            this.scene.pushMatrix();
            this.scene.translate(-2.45, 0.05, zPos);
            this.scene.scale(0.1, 0.9, 0.48);
            this.cube.display();
            this.scene.popMatrix();
        }

        // ── 5. Estacas Verticais de Reforço das Paredes ──────────────
        let stakePositions = [-2.4, -0.8, 0.8, 2.4];
        for (let i of stakePositions) {
            // Esquerda
            this.scene.pushMatrix();
            this.scene.translate(i, 0.1, -1.25);
            this.scene.scale(0.2, 1.2, 0.15);
            this.cube.display();
            this.scene.popMatrix();

            // Direita
            this.scene.pushMatrix();
            this.scene.translate(i, 0.1, 1.25);
            this.scene.scale(0.2, 1.2, 0.15);
            this.cube.display();
            this.scene.popMatrix();
        }

        // ── 6. Banco do Condutor ─────────────────────────────────────────────
        this.scene.pushMatrix();
        this.scene.translate(2.0, 0.3, 0);
        this.scene.scale(0.8, 0.1, 2.2);
        this.cube.display();
        this.scene.popMatrix();

        // Pernas/suportes de fixação do banco ao piso
        this.scene.pushMatrix();
        this.scene.translate(2.0, -0.05, 1.0);
        this.scene.scale(0.4, 0.6, 0.1);
        this.cube.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(2.0, -0.05, -1.0);
        this.scene.scale(0.4, 0.6, 0.1);
        this.cube.display();
        this.scene.popMatrix();

        // Apoio inclinado para os pés do condutor na frente
        this.scene.pushMatrix();
        this.scene.translate(2.7, -0.15, 0);
        this.scene.rotate(Math.PI / 5, 0, 0, 1);
        this.scene.scale(0.6, 0.05, 2.2);
        this.cube.display();
        this.scene.popMatrix();

        // ── 7. Caixa de Ferramentas Exterior (Lateral Direita) ───────────────
        this.toolboxMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(0.5, 0.1, -1.35); // Exterior da parede direita
        this.scene.scale(1.2, 0.6, 0.3);
        this.cube.display();
        this.scene.popMatrix();

        // ── 8. Rolo de Lona Extra Amarrado (Lateral Esquerda) ────────────────
        this.scene.pushMatrix();
        this.scene.translate(0.5, 0.1, 1.35);

        // Cilindro representativo do rolo de tecido
        this.canvasMaterial.apply();
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.scale(0.2, 0.2, 1.2);
        this.cylinder.display();
        this.scene.popMatrix();

        // Duas tiras de couro escuro
        this.darkMaterial.apply();
        let strapZ = [-0.4, 0.4];
        for (let z of strapZ) {
            this.scene.pushMatrix();
            this.scene.translate(z, 0, 0);
            this.scene.rotate(Math.PI / 2, 0, 1, 0);
            this.scene.scale(0.21, 0.21, 0.08);
            this.cylinder.display();
            this.scene.popMatrix();
        }
        this.scene.popMatrix();

        this.material.apply(); // Restaura o material original de madeira clara
    }
}

