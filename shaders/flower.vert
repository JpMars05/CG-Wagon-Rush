/**
 * flower.vert — Vertex shader das flores.
 *
 * Difere do grass.vert num ponto essencial:
 *   - O seed/fase do vento é lido de aTextureCoord.x (pré-calculado no CPU)
 *     em vez de ser calculado a partir de aVertexPosition.xz.
 *   - Isto garante que TODOS os vértices da mesma flor (caule, pétalas, centro)
 *     recebem exatamente o mesmo deslocamento do vento → a flor move-se
 *     como um corpo rígido.
 *
 * aTextureCoord.x = seed pré-calculado (0..1), igual para toda a flor
 * aTextureCoord.y = fator de altura (1 = base, 0 = topo)
 */

#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

// Parâmetros do vento
uniform float uTime;
uniform float uWindStrength;
uniform float uWindFreq;
uniform float uWindSpeed;
uniform vec2  uWindDir;
uniform float uWorldScale;

varying vec2  vTextureCoord;
varying vec3  vNormal;
varying float vHeightFactor;
varying vec2  vTerrainUV;
varying vec3  vWorldPos;
varying float vBladeSeed;
varying float vPatchNoise;

// Hash deterministico para variar manchas/cor sem estado global.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    vTextureCoord = aTextureCoord;

    // Fator de altura: 0 na base, 1 na ponta
    vHeightFactor = clamp(1.0 - aTextureCoord.y, 0.0, 1.0);

    vec2 wind = normalize(uWindDir);

    // ── Seed partilhado por toda a flor ──────────────────────────────────
    // Lido diretamente dos texCoords — igual para caule, pétalas e centro.
    float seed = aTextureCoord.x;
    float bladePhase = seed * 6.2831853;

    // Onda espacial (a variação entre vértices da mesma flor é mínima)
    float travel = dot(aVertexPosition.xz, wind) * uWindFreq;

    // ── Movimento: onda principal + rajada (sem flutter para flores) ─────
    float primaryWave = sin(travel + uTime * uWindSpeed + bladePhase);
    float gustPhase = uTime * uWindSpeed * 0.35 + bladePhase * 0.5;
    float gust = sin(gustPhase) * sin(gustPhase * 0.73 + 1.3) * 0.4;

    // Envelope quadrático — base fixa, topo move-se
    float envelope = 0.06 + 0.94 * pow(vHeightFactor, 2.2);

    // Dobra combinada
    float bend = (primaryWave + gust) * uWindStrength * envelope;

    // Aplica a dobra no plano horizontal; a flor inteira partilha a mesma fase.
    vec3 bent = aVertexPosition + vec3(wind.x * bend, 0.0, wind.y * bend);

    // Arco descendente na ponta
    bent.y -= vHeightFactor * bend * bend * 0.03;

    // Calcula coordenadas UV do terreno para passar para o fragment
    vTerrainUV = vec2(aVertexPosition.x / uWorldScale + 0.5, aVertexPosition.z / uWorldScale + 0.5);

    // Varyings usados no fragment shader de relva/flores para luz e cor.
    vNormal = aVertexNormal;
    vWorldPos = bent;
    vBladeSeed = seed;
    vPatchNoise = hash(floor(aVertexPosition.xz * 0.075));

    gl_Position = uPMatrix * uMVMatrix * vec4(bent, 1.0);
}
