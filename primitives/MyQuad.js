import { CGFobject } from '../../lib/CGF.js';

/**
 * MyQuad
 * Primitiva de retângulo 2D (quadrilátero) centrado na origem e virado para Z+.
 */
export class MyQuad extends CGFobject {
	constructor(scene, coords) {
		super(scene);
		this.initBuffers();
		if (coords != undefined)
			this.updateTexCoords(coords);
	}
	
	initBuffers() {
		// Cantos do quad de tamanho 1x1 centrado na origem
		this.vertices = [
			-0.5, -0.5, 0,	// 0: inferior esquerdo
			0.5, -0.5, 0,	// 1: inferior direito
			-0.5, 0.5, 0,	// 2: superior esquerdo
			0.5, 0.5, 0		// 3: superior direito
		];

		// Sentido anti-horário (CCW) para desenhar as faces viradas para a frente
		this.indices = [
			0, 1, 2,
			1, 3, 2
		];

		// Todas as normais apontam para Z+ (iluminação na face da frente)
		this.normals = [
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,
			0, 0, 1
		];
		
		// Coordenadas de textura (s, t) padrão (0 a 1)
		this.texCoords = [
			0, 1, // canto inferior esquerdo
			1, 1, // canto inferior direito
			0, 0, // canto superior esquerdo
			1, 0  // canto superior direito
		];

		this.primitiveType = this.scene.gl.TRIANGLES;
		this.initGLBuffers();
	}

	/**
	 * Atualiza as coordenadas de textura do quad.
	 * @param {Array} coords - Novas coordenadas [s0, t0, s1, t1, ...]
	 */
	updateTexCoords(coords) {
		this.texCoords = [...coords];
		this.updateTexCoordsGLBuffers();
	}
}
