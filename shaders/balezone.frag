/*
 * balezone.frag
 * Desenha os efeitos visuais da zona de entrega: um disco no chao ou
 * uma parede/coluna translucida, dependendo de uMode.
 */
#ifdef GL_ES
precision highp float;
#endif

// Coordenadas interpoladas a partir do vertex shader.
varying vec2 vTextureCoord;
varying vec3 vLocalPos;

// Parametros controlados pelo jogo para animacao, estado e cor.
uniform float uTime;
uniform float uMode;
uniform float uInside;
uniform float uDelivery;
uniform float uIntensity;
uniform vec3 uColor;

// Gera uma linha circular suave centrada em "center".
float ring(float r, float center, float width) {
    return 1.0 - smoothstep(width, width * 1.9, abs(r - center));
}

void main() {
    vec4 outColor = vec4(0.0);

    if (uMode < 0.5) {
        // Modo disco: converte UV [0,1] para coordenadas circulares [-1,1].
        vec2 p = vTextureCoord * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        // Camadas do disco: preenchimento suave, anel exterior e anel interior.
        float softDisk = smoothstep(1.0, 0.18, r);
        float boundary = ring(r, 0.86, 0.045);
        float innerThread = ring(r, 0.52 + sin(uTime * 0.85) * 0.025, 0.018) * 0.34;
        float breathe = 0.82 + 0.18 * sin(uTime * 1.35);
        float deliveryWave = ring(r, mix(0.12, 0.96, uDelivery), 0.055) * sin(uDelivery * 3.14159);

        // Cores mudam entre estado normal, jogador dentro e entrega ativa.
        vec3 hayGold = vec3(0.96, 0.66, 0.22);
        vec3 activeGreen = vec3(0.34, 0.96, 0.46);
        vec3 deliveryWhite = vec3(1.0, 0.92, 0.66);
        vec3 color = mix(hayGold, activeGreen, uInside);
        color = mix(color, deliveryWhite, deliveryWave * 0.78);

        float alpha = (softDisk * 0.24 + boundary * 0.78 + innerThread) * breathe;
        alpha += deliveryWave * 0.65;
        alpha *= uIntensity;

        outColor = vec4(color, alpha);
    } else {
        // Modo vertical: cria uma faixa translucida que desvanece em altura.
        float h = clamp(vTextureCoord.y, 0.0, 1.0);
        float verticalFade = smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.62, 1.0, h));
        float strand = 0.55 + 0.45 * sin(vTextureCoord.x * 37.0 + uTime * 1.7);
        float drift = 0.72 + 0.28 * sin(vTextureCoord.x * 11.0 - uTime * 0.9);
        float deliveryRise = sin(uDelivery * 3.14159) * smoothstep(0.0, 0.42, h) * (1.0 - smoothstep(0.48, 1.0, h));

        vec3 color = mix(uColor, vec3(1.0, 0.9, 0.58), deliveryRise * 0.72);
        float alpha = verticalFade * (0.16 + 0.10 * uInside) * strand * drift;
        alpha += deliveryRise * 0.22;
        alpha *= uIntensity;

        outColor = vec4(color, alpha);
    }

    // Evita desenhar fragmentos quase invisiveis.
    if (outColor.a <= 0.002) discard;
    gl_FragColor = outColor;
}
