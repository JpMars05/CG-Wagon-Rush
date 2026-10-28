/**
 * grass.frag - cor procedural para relva e materiais simples para flores.
 *
 * A relva usa variacao por lamina, manchas largas no terreno e gradiente por
 * altura: base mais escura/oliva, zona media verde natural, pontas mais secas.
 */

#ifdef GL_ES
precision highp float;
#endif

varying vec2  vTextureCoord;
varying vec3  vNormal;
varying float vHeightFactor;
varying vec2  vTerrainUV;
varying vec3  vWorldPos;
varying float vBladeSeed;
varying float vPatchNoise;

uniform sampler2D uHeightMap;

uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform float uSunVisibility;
uniform vec3 uLanternPos;
uniform vec3 uLanternColor;
uniform float uLanternRadius;
uniform float uLanternIntensity;
uniform float uProceduralGrassColor;

uniform vec4 uGlobalAmbient;

struct Material {
    vec4  ambient;
    vec4  diffuse;
    vec4  specular;
    vec4  emission;
    float shininess;
};

uniform Material uFrontMaterial;

// Pequenos hashes deterministicos para variacao por lamina e por zona.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
}

float hash1(float n) {
    return fract(sin(n * 437.23 + 17.17) * 43758.5453);
}

vec3 grassAlbedo() {
    // Gradiente de cor por altura combinado com variacao por lamina.
    float h = smoothstep(0.0, 1.0, vHeightFactor);
    float bladeVar = hash1(vBladeSeed * 19.17);
    float fineVar = hash(vWorldPos.xz * 1.73 + vBladeSeed);
    float patch = vPatchNoise;

    vec3 deepOlive = vec3(0.070, 0.130, 0.045);
    vec3 shadowGreen = vec3(0.125, 0.225, 0.070);
    vec3 livingGreen = vec3(0.235, 0.355, 0.115);
    vec3 mutedGreen = vec3(0.315, 0.405, 0.145);
    vec3 strawTip = vec3(0.520, 0.455, 0.205);
    vec3 earthOlive = vec3(0.250, 0.240, 0.110);

    vec3 color = mix(deepOlive, shadowGreen, smoothstep(0.0, 0.32, h));
    color = mix(color, livingGreen, smoothstep(0.20, 0.78, h));
    color = mix(color, mutedGreen, smoothstep(0.42, 0.92, h) * 0.20);

    float dryness = smoothstep(0.48, 1.0, h) * mix(0.20, 0.62, bladeVar);
    color = mix(color, strawTip, dryness);
    color = mix(color, earthOlive, smoothstep(0.58, 1.0, patch) * 0.24);

    float patchTint = mix(-0.18, 0.06, patch);
    color *= 1.0 + patchTint;
    color *= mix(0.82, 1.08, bladeVar);
    color *= mix(0.90, 1.04, fineVar);

    // Algumas laminas ficam ligeiramente mais amareladas ou azul-escuras.
    color = mix(color, color * vec3(1.18, 1.00, 0.68), smoothstep(0.60, 1.0, bladeVar) * 0.34);
    color = mix(color, color * vec3(0.72, 0.84, 0.92), smoothstep(0.0, 0.20, bladeVar) * 0.16);

    // Dessatura para evitar verde artificial demasiado vivo.
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, 0.72);
    color *= 0.86;

    return color;
}

void main() {
    // Reconstroi uma normal aproximada do terreno a partir do heightmap local.
    float offset = 1.0 / 256.0;
    float hL = texture2D(uHeightMap, vTerrainUV + vec2(-offset, 0.0)).r;
    float hR = texture2D(uHeightMap, vTerrainUV + vec2(offset, 0.0)).r;
    float hD = texture2D(uHeightMap, vTerrainUV + vec2(0.0, -offset)).r;
    float hU = texture2D(uHeightMap, vTerrainUV + vec2(0.0, offset)).r;
    vec3 terrainNormal = normalize(vec3((hL - hR) * 15.0, 400.0 * offset, (hD - hU) * 15.0));

    // Mistura a normal real da lamina com a normal do terreno para integrar a relva.
    vec3 bladeNormal = normalize(vNormal);
    vec3 n = normalize(mix(terrainNormal, bladeNormal, 0.72));
    vec3 l = normalize(uLightDir);
    vec3 v = normalize(uCameraPos - vWorldPos);

    vec3 materialColor = uFrontMaterial.diffuse.rgb;
    vec3 albedo = mix(materialColor, grassAlbedo(), clamp(uProceduralGrassColor, 0.0, 1.0));

    // Iluminacao principal com half-Lambert para manter a relva legivel.
    float terrainDot = dot(terrainNormal, l);
    float terrainOcclusion = smoothstep(-0.25, 0.22, terrainDot);
    float ndotl = dot(n, l);
    float halfLambert = ndotl * 0.5 + 0.5;
    float diffuseIntensity = halfLambert * halfLambert;
    diffuseIntensity *= mix(0.28, 1.0, terrainOcclusion) * mix(0.34, 1.0, uSunVisibility);

    float backLight = pow(clamp(-ndotl, 0.0, 1.0), 1.25);
    float translucency = backLight * 0.28 * terrainOcclusion * uSunVisibility * smoothstep(0.18, 1.0, vHeightFactor);

    // Brilho subtil nas pontas, como humidade/cerosidade da relva.
    vec3 h = normalize(l + v);
    float spec = pow(max(dot(n, h), 0.0), 22.0);
    vec3 specular = vec3(0.10, 0.13, 0.08) * spec * smoothstep(0.35, 1.0, vHeightFactor) * terrainOcclusion * uSunVisibility;

    vec3 lanternVec = uLanternPos - vWorldPos;
    float lanternDist = length(lanternVec);
    vec3 lanternDir = lanternDist > 0.001 ? lanternVec / lanternDist : vec3(0.0, 1.0, 0.0);
    float lanternFalloff = pow(clamp(1.0 - lanternDist / max(uLanternRadius, 0.001), 0.0, 1.0), 2.0);
    float lanternDiffuse = max(dot(n, lanternDir), 0.0) * lanternFalloff * uLanternIntensity;

    // Soma das contribuicoes: ambiente, sol, translucidez, lanterna e especular.
    vec3 ambient = albedo * (uGlobalAmbient.rgb + uFrontMaterial.ambient.rgb * 0.28);
    vec3 sunLight = albedo * diffuseIntensity;
    vec3 subsurface = albedo * vec3(0.95, 1.00, 0.58) * translucency;
    vec3 lanternLight = albedo * uLanternColor * lanternDiffuse * 1.8;

    vec3 color = ambient + sunLight + subsurface + lanternLight + specular + uFrontMaterial.emission.rgb;
    gl_FragColor = vec4(color, uFrontMaterial.diffuse.a);
}
