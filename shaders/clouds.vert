/*
 * clouds.vert
 * Vertex shader das nuvens. Apenas passa as UVs para o fragment shader e
 * aplica a transformacao normal da malha para o espaco de clip.
 */
#ifdef GL_ES
precision highp float;
#endif

// Atributos standard da geometria.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

// Matrizes standard CGF.
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

// UV usada para amostrar a textura de nuvens no fragment shader.
varying vec2 vTextureCoord;

void main() {
    // Mantem a textura alinhada com a geometria original.
    vTextureCoord = aTextureCoord;

    // Posiciona o vertice no ecra.
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
