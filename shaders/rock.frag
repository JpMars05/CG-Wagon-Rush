/*
 * rock.frag
 * Shader de materiais das rochas. Suporta cor por material, texturas PBR
 * simples, normal mapping, especular Blinn-Phong, musgo e luz da lanterna.
 */
#ifdef GL_ES
precision highp float;
#endif

// Base TBN, UV e posicao vindas do vertex shader.
varying vec2 vTextureCoord;
varying vec3 vNormalView;
varying vec3 vTangentView;
varying vec3 vBitangentView;
varying vec3 vViewPos;
varying float vHeightRatio;

uniform sampler2D uSampler;          // Color Map
uniform sampler2D uSamplerNormal;    // Normal Map
uniform sampler2D uSamplerSpecular;  // Specular/Roughness Map
uniform bool uHasTexture;
uniform vec3 uLightDirView;          // Luz no View Space!
uniform float uSunVisibility;
uniform vec3 uLanternPosView;
uniform vec3 uLanternColor;
uniform float uLanternRadius;
uniform float uLanternIntensity;
uniform float uMossAmount;

// Material CGF aplicado antes de desenhar cada grupo de rochas.
struct materialProperties {
    vec4 ambient;
    vec4 diffuse;
    vec4 specular;
    vec4 emission;
    float shininess;
};
uniform materialProperties uFrontMaterial;

void main() {
    // Reconstruir a base TBN recebida do vertex shader. O normal map vem em
    // tangent space, mas a luz e a camera estao em view space.
    vec3 N = normalize(vNormalView);
    vec3 T = normalize(vTangentView);
    vec3 B = normalize(vBitangentView);
    mat3 TBN = mat3(T, B, N);
    
    // Direcao da camera em view space: a camera esta na origem desse espaco.
    vec3 viewDir = normalize(-vViewPos);
    vec3 lightDir = normalize(uLightDirView); // Luz ajustada para view space
    
    vec4 baseColor = uFrontMaterial.diffuse;
    vec3 finalNormal = N;
    float specFactor = 1.0;
    
    if (uHasTexture) {
        // 1. Cor Base (Substitui completamente a cor padrao)
        vec4 texColor = texture2D(uSampler, vTextureCoord);
        baseColor = vec4(texColor.rgb, 1.0);
        
        // 2. Normal Mapping: converter cor [0, 1] para vetor [-1, 1] e depois
        // passar essa normal perturbada para view space com a matriz TBN.
        vec3 normalMapColor = texture2D(uSamplerNormal, vTextureCoord).rgb;
        vec3 perturbedNormal = normalMapColor * 2.0 - 1.0;
        finalNormal = normalize(TBN * perturbedNormal);
        
        // 3. Specular / Roughness Map: uso o canal R como intensidade simples
        // de brilho, suficiente para dar variacao sem complicar o modelo.
        float specTex = texture2D(uSamplerSpecular, vTextureCoord).r;
        specFactor = specTex; // Mais branco = mais brilho
    }
    
    float day = clamp(uSunVisibility, 0.0, 1.0);

    // Ambient: durante a noite substitui o ambiente normal por um tom frio.
    vec3 nightAmbient = baseColor.rgb * vec3(0.025, 0.032, 0.060);
    vec3 dayAmbient = uFrontMaterial.ambient.rgb * baseColor.rgb;
    vec3 ambient = mix(nightAmbient, dayAmbient, day);
    
    // Diffuse (Half-Lambert para rochas organicas)
    float diff = (dot(finalNormal, lightDir) * 0.5 + 0.5) * mix(0.10, 1.0, day);
    vec3 diffuse = baseColor.rgb * diff;
    
    // Specular Blinn-Phong (afetado pelo specFactor do mapa)
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(finalNormal, halfDir), 0.0), uFrontMaterial.shininess);
    vec3 specular = uFrontMaterial.specular.rgb * spec * specFactor * day;
    
    vec3 finalColor = ambient + diffuse + specular;
    
    // Moss (aplicado as partes voltadas para cima)
    float mossBlend = smoothstep(0.4, 0.0, vHeightRatio) * uMossAmount; 
    vec3 mossColor = vec3(0.25, 0.45, 0.15) * baseColor.rgb * 0.7; 
    finalColor = mix(finalColor, mossColor, mossBlend);
    
    // AO - base darkening
    float ao = clamp(1.0 - (vHeightRatio * 0.4), 0.0, 1.0);
    finalColor *= ao;

    // Lanterna local da carroca, com queda quadratica dentro do raio.
    vec3 lanternVec = uLanternPosView - vViewPos;
    float lanternDist = length(lanternVec);
    vec3 lanternDir = lanternDist > 0.001 ? lanternVec / lanternDist : vec3(0.0, 1.0, 0.0);
    float lanternFalloff = pow(clamp(1.0 - lanternDist / max(uLanternRadius, 0.001), 0.0, 1.0), 2.0);
    float lanternDiffuse = max(dot(finalNormal, lanternDir), 0.0) * lanternFalloff * uLanternIntensity;
    finalColor += baseColor.rgb * uLanternColor * lanternDiffuse * 1.6;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
