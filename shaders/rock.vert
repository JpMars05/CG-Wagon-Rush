/*
 * rock.vert
 * Prepara as rochas para normal mapping. Alem da posicao final, envia para o
 * fragment shader a base TBN em view space e um fator vertical para musgo/AO.
 */
#ifdef GL_ES
precision highp float;
#endif

// Geometria procedural da rocha.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

// Matrizes CGF usadas para posicao e normais.
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

// Dados interpolados para iluminacao no fragment shader.
varying vec2 vTextureCoord;
varying vec3 vNormalView;
varying vec3 vTangentView;
varying vec3 vBitangentView;
varying vec3 vViewPos;
varying float vHeightRatio;

void main() {
    // As UVs tambem servem para texturas e para estimar topo/base.
    vTextureCoord = aTextureCoord;
    vHeightRatio = aTextureCoord.y; // 0 (topo) a 1 (base)

    // A normal local do vertice
    vec3 N = aVertexNormal;

    // Calcular a Tangente (T) local.
    // Como a esfera usa U ao longo da longitude, uma boa aproximacao da
    // tangente e o produto vetorial entre a normal e o eixo vertical.
    vec3 T = cross(N, vec3(0.0, 1.0, 0.0));
    if (length(T) < 0.001) {
        // Nas pontas exatas (polos), usamos o eixo Z para evitar vetor nulo
        T = cross(N, vec3(0.0, 0.0, 1.0));
    }
    T = normalize(T);

    // Calcular a Bitangente (B) local. Com N, T e B formo a base TBN que o
    // fragment shader usa para converter a normal do normal map.
    vec3 B = normalize(cross(N, T));

    // Converter T, B, N para View Space usando a uNMatrix. A iluminacao das
    // rochas tambem e feita em view space, por isso mantenho tudo coerente.
    vNormalView    = normalize((uNMatrix * vec4(N, 0.0)).xyz);
    vTangentView   = normalize((uNMatrix * vec4(T, 0.0)).xyz);
    vBitangentView = normalize((uNMatrix * vec4(B, 0.0)).xyz);
    
    // Posicao no View Space para o calculo de especular e luz da lanterna.
    vec4 viewPos = uMVMatrix * vec4(aVertexPosition, 1.0);
    vViewPos = viewPos.xyz;
    
    gl_Position = uPMatrix * viewPos;
}
