/*
 * terrain.vert
 * Deforma um plano com heightmap, mascara de estrada e montanhas procedurais.
 * Tambem prepara UVs repetidas/originais e dados de mundo para o fragment.
 */
#ifdef GL_ES
precision highp float;
#endif

// Vertices do plano base.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

// Matrizes CGF.
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

// Texturas/parametros usados para deslocar vertices no vertex shader.
uniform sampler2D uHeightMap;
uniform sampler2D uRoadMask;
uniform float uRoadDepression;

uniform float uPlayAreaRadius;
uniform float uWorldScale;

const float HEIGHT_SCALE = 15.0;
const float TERRAIN_TEXTURE_REPEAT = 50.0;
const float PLAY_AREA_SCALE = 500.0;

varying vec2 vTextureCoord;
varying vec2 vTextureCoordOriginal;
varying vec3 vViewPos;
varying vec2 vWorldXZ;
varying float vMountainT;

// Suavizacao 0..1 usada para transicoes de montanha sem quebras visuais.
float smootherstep01(float t) {
    t = clamp(t, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float getMountainT(vec2 worldXZ) {
    // Mede quao longe estamos da area jogavel, usando distancia quadrada.
    float squareDist = max(abs(worldXZ.x), abs(worldXZ.y));
    float mountainBand = max(uWorldScale * 0.5 - uPlayAreaRadius, 1.0);
    return clamp((squareDist - uPlayAreaRadius) / mountainBand, 0.0, 1.0);
}

float getMountainHeight(vec2 worldXZ) {
    // Montanhas so existem fora do raio da area jogavel.
    float t = getMountainT(worldXZ);
    if (t <= 0.0) return 0.0;

    float dist = length(worldXZ);
    float angle = atan(worldXZ.y, worldXZ.x);
    float foothill = smootherstep01(t * 2.15);
    float ridge = smootherstep01((t - 0.16) / 0.84);

    float large = sin(angle * 4.0 + dist * 0.013);
    float mid = sin(angle * 8.0 - dist * 0.021 + large * 0.7);
    float peakVariation = sin(angle * 13.0 + dist * 0.009) * 0.5 +
                          sin(angle * 19.0 - dist * 0.006) * 0.5;
    float fine = sin(worldXZ.x * 0.033 + worldXZ.y * 0.017) *
                 sin(worldXZ.y * 0.029 - worldXZ.x * 0.011);
    float foldedRidges = smoothstep(-0.65, 0.9, large * 0.50 + mid * 0.34 + peakVariation * 0.16);
    float peakLift = smoothstep(0.18, 1.0, foldedRidges) * peakVariation;

    float baseRise = foothill * 7.0 + ridge * (23.0 + t * 22.0);
    float relief = ridge * ((foldedRidges - 0.35) * 17.0 + fine * 4.0 + peakLift * 7.0);
    return max(0.0, baseRise + relief);
}

void main() {
    // Calcular a posição XZ no mundo para as montanhas e shaders
    vec2 worldXZ = aVertexPosition.xy * uWorldScale;
    vWorldXZ = worldXZ;
    
    // UV correspondente aos 500 centrais.
    // aTextureCoord vai de 0 a 1 sobre o uWorldScale (800).
    // Queremos que vá de 0 a 1 sobre o PLAY_AREA_SCALE (500).
    float scaleRatio = uWorldScale / PLAY_AREA_SCALE;
    vec2 playAreaUV = (aTextureCoord - 0.5) * scaleRatio + 0.5;
    
    // Fazer clamp para as bordas do heightmap não repetirem bizarramente
    vec2 clampedUV = clamp(playAreaUV, 0.0, 1.0);
    
    vTextureCoordOriginal = clampedUV;
    
    // Textura da terra repetida proporcionalmente ao play area
    vTextureCoord = playAreaUV * TERRAIN_TEXTURE_REPEAT;

    // A altura base vem do heightmap; a estrada baixa ligeiramente essa altura.
    vec4 heightColor = texture2D(uHeightMap, clampedUV);
    float roadMask = texture2D(uRoadMask, clampedUV).r;
    float road = smoothstep(0.20, 0.85, roadMask);
    
    float baseHeight = heightColor.r * HEIGHT_SCALE;
    
    // Fator 0..1 usado para a transicao de solo para montanha.
    vMountainT = getMountainT(worldXZ);
    vec3 offset = aVertexNormal * (baseHeight - road * uRoadDepression);
    offset.z += getMountainHeight(worldXZ);

 
    // Posicao final em view space, reutilizada no fragment shader.
    vec4 viewPos = uMVMatrix * vec4(aVertexPosition + offset, 1.0);
    vViewPos = viewPos.xyz;

    gl_Position = uPMatrix * viewPos;
}
