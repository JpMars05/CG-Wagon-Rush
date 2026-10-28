/*
 * clouds.frag
 * Combina a textura de nuvens com cobertura, ciclo dia/noite e tom quente
 * de crepusculo. O alpha final decide quanto da nuvem fica visivel.
 */
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;

// Textura das nuvens e controlos atmosfericos vindos da cena.
uniform sampler2D uSampler;
uniform float uCloudCover;
uniform float uSunVisibility;
uniform float uTwilightFactor;

void main() {
    // Cor base da textura no ponto atual.
    vec4 color = texture2D(uSampler, vTextureCoord);
    
    // Se usares um PNG, o color.a terá a transparência que definiste no editor.
    // Combinamos a transparência da imagem com o brilho para um efeito suave.
    float brightness = (color.r + color.g + color.b) / 3.0;
    
    // O Alpha final é o alpha da textura multiplicado pela cobertura de nuvens
    float finalAlpha = color.a * uCloudCover;
    
    // Se a textura for um JPG (sem alpha), usamos o brilho como fallback
    if (color.a == 1.0) {
        finalAlpha = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.2, brightness);
    }
    
    // Fatores normalizados para misturar noite, dia e tons de fim de tarde.
    float day = clamp(uSunVisibility, 0.0, 1.0);
    float twilight = clamp(uTwilightFactor, 0.0, 1.0);
    vec3 nightCloud = vec3(0.045, 0.055, 0.085);
    vec3 dayCloud = color.rgb;
    vec3 warmCloud = dayCloud * vec3(1.15, 0.72, 0.42);
    vec3 litCloud = mix(nightCloud, dayCloud, mix(0.18, 1.0, day));
    litCloud = mix(litCloud, warmCloud, twilight * 0.45);
    float nightAlpha = mix(0.34, 1.0, day);

    // Alpha fica menor durante a noite para as nuvens nao taparem totalmente o ceu.
    gl_FragColor = vec4(litCloud, finalAlpha * nightAlpha);
}
