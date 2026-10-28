/**
 * sky.vert - skydome procedural.
 *
 * Passa a direcao local do hemisferio para o fragment shader. O ceu fica
 * independente de texturas e pode reagir diretamente a posicao do sol.
 */

#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;

// O skydome usa apenas model-view/projection; nao precisa de normais/UVs.
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

// Direcao local do ponto no dome, usada para gerar cor no fragment shader.
varying vec3 vSkyDir;

void main() {
    // Normalizar transforma a posicao da esfera numa direcao de observacao.
    vSkyDir = normalize(aVertexPosition);
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
