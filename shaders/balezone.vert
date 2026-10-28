/*
 * balezone.vert
 * Vertex shader simples para os indicadores da zona de entrega.
 * Mantem as coordenadas UV e a posicao local disponiveis para o fragment
 * shader, que e quem desenha o disco/efeito vertical.
 */
#ifdef GL_ES
precision highp float;
#endif

// Atributos vindos da malha CGF.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

// Matrizes standard: model-view e projection.
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

// Dados interpolados para cada fragmento.
varying vec2 vTextureCoord;
varying vec3 vLocalPos;

void main() {
    // Reencaminha UVs e posicao local sem modificacoes.
    vTextureCoord = aTextureCoord;
    vLocalPos = aVertexPosition;

    // Transformacao final para clip space.
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
