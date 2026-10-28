import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MyPlane } from './MyPlane.js';

/**
 * MyPlaneQuad
 * Representa um plano quadrado deitado no chão com material cinzento padrão.
 */
export class MyPlaneQuad extends CGFobject {
    constructor(scene) {
        super(scene);
        
        // Primitiva de plano básica com 1 divisão
        this.plane = new MyPlane(scene, 1);
        
        // Inicializar material cinzento
        this.material = new CGFappearance(scene);
        this.material.setAmbient(0.3, 0.3, 0.3, 1.0);
        this.material.setDiffuse(0.6, 0.6, 0.6, 1.0); // Cinzento
        this.material.setSpecular(0.1, 0.1, 0.1, 1.0);
        this.material.setShininess(10.0);
    }

    display() {
        this.scene.pushMatrix();
        
        // Aumentar o tamanho e rodar para deitar o plano no chão (plano XZ)
        this.scene.scale(5, 1, 5); 
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        
        this.material.apply();
        this.plane.display();
        
        this.scene.popMatrix();
    }
}

