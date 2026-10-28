/**
 * grass.vert - vento organico para relva geometrica.
 *
 * A base fica imovel: o envelope de vento e 0 quando vHeightFactor = 0.
 * O topo recebe uma combinacao de onda direcional, rajadas lentas e flutter
 * lateral pequeno, evitando movimento sincronizado entre laminas.
 */

#ifdef GL_ES
precision highp float;
#endif

attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

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

// Hash deterministico: da variedade visual sem depender de numeros aleatorios no CPU.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
    // A coordenada Y da textura e usada como altura da lamina.
    vTextureCoord = aTextureCoord;
    vHeightFactor = clamp(1.0 - aTextureCoord.y, 0.0, 1.0);

    // Vetores principal e lateral do vento para separar dobra e oscilacao.
    vec2 wind = normalize(uWindDir);
    vec2 crossWind = vec2(-wind.y, wind.x);
    float seed = aTextureCoord.x;
    float phase = seed * 6.2831853;
    vec2 worldXZ = aVertexPosition.xz;

    // Ondas espaciais: evitam que toda a relva se mova em bloco.
    float travel = dot(worldXZ, wind) * uWindFreq;
    float crossTravel = dot(worldXZ, crossWind) * (uWindFreq * 0.67);
    float time = uTime * uWindSpeed;

    float broadWave = sin(travel * 0.75 + time * 0.85 + phase);
    float secondaryWave = sin(crossTravel + time * 1.17 + phase * 1.73) * 0.42;
    float gust = sin(time * 0.31 + travel * 0.23 + phase * 0.37);
    gust = smoothstep(-0.15, 0.95, gust) * sin(time * 0.19 + crossTravel * 0.33 + phase) * 0.55;
    float flutter = sin(time * 3.7 + travel * 1.8 + phase * 4.1) * 0.09;

    // A base da lamina fica cravada no terreno. O vento so comeca a atuar
    // acima da zona inferior, com uma transicao forte para evitar "raizes" a deslizar.
    float envelope = smoothstep(0.26, 1.0, vHeightFactor);
    envelope = pow(envelope, 2.6);

    float strength = uWindStrength * envelope;
    float forwardBend = (broadWave + secondaryWave + gust) * strength * 0.26;
    float sideBend = (secondaryWave * 0.55 + flutter) * strength * 0.10;

    // Posicao final da lamina ja dobrada pelo vento.
    vec3 bent = aVertexPosition;
    bent.x += wind.x * forwardBend + crossWind.x * sideBend;
    bent.z += wind.y * forwardBend + crossWind.y * sideBend;
    bent.y -= envelope * forwardBend * forwardBend * 0.014;

    // UV do terreno permite ao fragment shader amostrar o heightmap local.
    vTerrainUV = vec2(aVertexPosition.x / uWorldScale + 0.5, aVertexPosition.z / uWorldScale + 0.5);
    vNormal = aVertexNormal;
    vWorldPos = bent;
    vBladeSeed = seed;
    vPatchNoise = hash(floor(worldXZ * 0.075));

    gl_Position = uPMatrix * uMVMatrix * vec4(bent, 1.0);
}
