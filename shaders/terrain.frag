/*
 * terrain.frag
 * Shader principal do chao: mistura terreno, estrada e rocha; reconstrui
 * normais do heightmap; aplica normal/specular maps, sol, lanterna e ambiente.
 */
#ifdef GL_ES
precision highp float;
#endif

// UVs, posicao e fatores calculados no vertex shader.
varying vec2 vTextureCoord;
varying vec2 vTextureCoordOriginal;
varying vec3 vViewPos;
varying float vMountainT;

uniform sampler2D uSampler;
uniform sampler2D uHeightMap;
uniform sampler2D uSamplerNormal;    // Mapa de Normais do Terreno
uniform sampler2D uSamplerSpecular;  // Mapa de Rugosidade/Specular
uniform sampler2D uRoadMask;
uniform sampler2D uRoadSampler;

uniform sampler2D uRockSampler;
uniform sampler2D uRockNormalSampler;

uniform float uPlayAreaRadius;
uniform float uWorldScale;
uniform vec3 uLightDirView;
uniform mat4 uNMatrix;
uniform float uRoadRepeat;
uniform float uRoadStrength;
uniform float uSunVisibility;
uniform vec3 uLanternPosView;
uniform vec3 uLanternColor;
uniform float uLanternRadius;
uniform float uLanternIntensity;

// Escalas partilhadas com o vertex shader para manter altura/normais coerentes.
const float HEIGHT_SCALE = 15.0;
const float PLAY_AREA_SCALE = 500.0;
const float HEIGHTMAP_TEXEL = 1.0 / 256.0;

varying vec2 vWorldXZ;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float smootherstep01(float t) {
    t = clamp(t, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float getMountainT(vec2 worldXZ) {
    float squareDist = max(abs(worldXZ.x), abs(worldXZ.y));
    float mountainBand = max(uWorldScale * 0.5 - uPlayAreaRadius, 1.0);
    return clamp((squareDist - uPlayAreaRadius) / mountainBand, 0.0, 1.0);
}

float getMountainHeight(vec2 worldXZ) {
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

float getProceduralHeight(vec2 worldXZ, float baseHeight) {
    // Soma a altura do heightmap com o relevo procedural das montanhas.
    return baseHeight + getMountainHeight(worldXZ);
}

void main() {
    // Textura do terreno e textura da estrada antes do blending.
    vec4 terrainColor = texture2D(uSampler, vTextureCoord);
    vec4 roadColor = texture2D(uRoadSampler, vTextureCoordOriginal * uRoadRepeat);

    // A mascara da estrada define onde a textura de estrada substitui o solo.
    float roadMask = texture2D(uRoadMask, vTextureCoordOriginal).r;
    float edgeNoise = (hash(floor(vTextureCoordOriginal * 512.0)) - 0.5) * 0.08;
    float road = smoothstep(0.20 + edgeNoise, 0.82 + edgeNoise, roadMask) * uRoadStrength;
    road = clamp(road, 0.0, 1.0);

    float squareDist = max(abs(vWorldXZ.x), abs(vWorldXZ.y));
    if (squareDist > uPlayAreaRadius) road = 0.0; // Sem estrada nas montanhas

    vec4 color = mix(terrainColor, roadColor, road);
    
    // 1. Normal Geometrica a partir do Height Map + Procedural
    float offsetUV = HEIGHTMAP_TEXEL;
    float worldOffset = offsetUV * PLAY_AREA_SCALE; // Passo em metros
    
    vec2 clampedUV_L = clamp(vTextureCoordOriginal + vec2(-offsetUV, 0.0), 0.0, 1.0);
    vec2 clampedUV_R = clamp(vTextureCoordOriginal + vec2(offsetUV, 0.0), 0.0, 1.0);
    vec2 clampedUV_D = clamp(vTextureCoordOriginal + vec2(0.0, -offsetUV), 0.0, 1.0);
    vec2 clampedUV_U = clamp(vTextureCoordOriginal + vec2(0.0, offsetUV), 0.0, 1.0);
    
    float hL_base = texture2D(uHeightMap, clampedUV_L).r * HEIGHT_SCALE;
    float hR_base = texture2D(uHeightMap, clampedUV_R).r * HEIGHT_SCALE;
    float hD_base = texture2D(uHeightMap, clampedUV_D).r * HEIGHT_SCALE;
    float hU_base = texture2D(uHeightMap, clampedUV_U).r * HEIGHT_SCALE;
    
    float hL = getProceduralHeight(vWorldXZ + vec2(-worldOffset, 0.0), hL_base);
    float hR = getProceduralHeight(vWorldXZ + vec2(worldOffset, 0.0), hR_base);
    float hD = getProceduralHeight(vWorldXZ + vec2(0.0, -worldOffset), hD_base);
    float hU = getProceduralHeight(vWorldXZ + vec2(0.0, worldOffset), hU_base);
    
    // O eixo Z da normal recebe o tamanho do passo para manter a proporcao (2.0 * worldOffset)
    vec3 geomNormalObj = normalize(vec3(hL - hR, hU - hD, 2.0 * worldOffset));
    
    // Transformar a Normal para o View Space
    vec3 N = normalize((uNMatrix * vec4(geomNormalObj, 0.0)).xyz);
    
    // Mistura de Rocha baseada na inclinação e distância
    float slope = 1.0 - geomNormalObj.z; // z é o "up" na geometria original antes do view space
    float isMountain = smoothstep(0.12, 0.58, vMountainT);
    // Misturar rocha onde a inclinação é alta ou nas zonas muito altas
    float slopeRock = smoothstep(0.20, 0.62, slope);
    float peakRock = smoothstep(0.54, 1.0, vMountainT) * smoothstep(0.06, 0.34, slope);
    float broadPatch = sin(vWorldXZ.x * 0.018 + vWorldXZ.y * 0.012) * 0.55 +
                       sin(vWorldXZ.x * 0.006 - vWorldXZ.y * 0.021) * 0.45;
    float patchMask = smoothstep(-0.18, 0.76, broadPatch);
    float highPeak = smoothstep(0.60, 1.0, vMountainT);
    float summitRock = smoothstep(0.78, 1.0, vMountainT);
    float rockBlend = (slopeRock * 0.72 + peakRock * 1.05 + highPeak * 0.42 + summitRock * 0.38) * isMountain;
    rockBlend *= mix(0.58, 1.0, max(patchMask, highPeak * 0.9));
    rockBlend = clamp(rockBlend, 0.0, 0.96);
    
    // UV de rocha em coordenadas de mundo para nao depender da malha do plano.
    vec2 rockUV = vWorldXZ * 0.035;
    rockUV += vec2(sin(vWorldXZ.y * 0.018), cos(vWorldXZ.x * 0.016)) * 0.35;
    vec4 rockColor = texture2D(uRockSampler, rockUV);
    float highDryRock = smoothstep(0.52, 1.0, vMountainT) * smoothstep(0.12, 0.40, slope);
    rockColor.rgb = mix(terrainColor.rgb * vec3(0.82, 0.86, 0.76), rockColor.rgb, 0.92);
    rockColor.rgb = mix(rockColor.rgb, vec3(0.58, 0.56, 0.50), highDryRock * 0.08);
    color = mix(color, rockColor, rockBlend);
    
    // 2. Construir o TBN (Espaco Tangente)
    vec3 TObj = vec3(1.0, 0.0, 0.0);
    vec3 T = normalize((uNMatrix * vec4(TObj, 0.0)).xyz);
    // Garantir ortogonalidade
    T = normalize(T - dot(T, N) * N);
    vec3 B = cross(N, T);
    mat3 TBN = mat3(T, B, N);
    
    // 3. Normal Mapping: o normal map esta em tangent space; o TBN converte
    // essa perturbacao para view space, onde tambem esta a luz.
    vec3 terrainNormalMap = texture2D(uSamplerNormal, vTextureCoord).rgb * 2.0 - 1.0;
    vec3 rockNormalMapSample = texture2D(uRockNormalSampler, rockUV).rgb * 2.0 - 1.0;
    vec3 normalMap = mix(terrainNormalMap, rockNormalMapSample, rockBlend);
    normalMap = normalize(mix(normalMap, vec3(0.0, 0.0, 1.0), road * 0.35));
    vec3 finalNormal = normalize(TBN * normalMap);
    
    // 4. Specular/Roughness Mapping (lendo o canal vermelho)
    float specFactor = texture2D(uSamplerSpecular, vTextureCoord).r;
    specFactor = mix(specFactor, 0.08, road);
    
    // 5. Iluminacao PBR Simplificada (View Space)
    vec3 lightDir = normalize(uLightDirView);
    vec3 viewDir = normalize(-vViewPos);
    
    // Diffuse
    float day = clamp(uSunVisibility, 0.0, 1.0);
    float diff = max(dot(finalNormal, lightDir), 0.0) * mix(0.05, 1.0, day);
    vec3 diffuse = color.rgb * diff * 0.85;
    
    // Specular (o terreno terra/musgo tem brilho baco, specFactor controla intensidade)
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(finalNormal, halfDir), 0.0), 10.0); 
    // Terrenos nao refletem muito a nao ser que estejam molhados/pedregosos
    vec3 specular = vec3(0.2) * spec * specFactor * day;

    // Luz local da lanterna, calculada no mesmo espaco das normais finais.
    vec3 lanternVec = uLanternPosView - vViewPos;
    float lanternDist = length(lanternVec);
    vec3 lanternDir = lanternDist > 0.001 ? lanternVec / lanternDist : vec3(0.0, 1.0, 0.0);
    float lanternFalloff = pow(clamp(1.0 - lanternDist / max(uLanternRadius, 0.001), 0.0, 1.0), 2.0);
    float lanternDiffuse = max(dot(finalNormal, lanternDir), 0.0) * lanternFalloff * uLanternIntensity;
    vec3 lanternLight = color.rgb * uLanternColor * lanternDiffuse * 1.0;
    
    // Ambient
    vec3 nightTint = color.rgb * vec3(0.07, 0.09, 0.16);
    vec3 dayAmbient = color.rgb * 0.25;
    vec3 ambient = mix(nightTint, dayAmbient, day);
    
    // Composicao final e nevoa/tonalidade fria nas montanhas altas.
    vec3 finalColor = ambient + diffuse + specular + lanternLight;
    vec3 mountainAir = mix(vec3(0.08, 0.10, 0.16), vec3(0.58, 0.66, 0.72), day);
    finalColor = mix(finalColor, mountainAir, smoothstep(0.58, 1.0, vMountainT) * 0.18);
    
    gl_FragColor = vec4(finalColor, color.a);
}
