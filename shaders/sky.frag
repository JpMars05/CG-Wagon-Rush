/**
 * sky.frag - ceu procedural com ciclo dia/noite.
 *
 * Dia: gradiente azul iluminado pela direcao do sol.
 * Noite: azul profundo com estrelas estaticas geradas no shader.
 */

#ifdef GL_ES
precision highp float;
#endif

varying vec3 vSkyDir;

uniform vec3 uSunDir;
uniform float uSunVisibility;
uniform float uTwilightFactor;
uniform float uStarVisibility;
uniform float uSunDiskVisibility;

// Hash deterministico usado para distribuir estrelas por celulas do ceu.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float starField(vec3 dir) {
    // Projeta a direcao 3D em uma grelha 2D de azimute/altitude.
    float azimuth = atan(dir.z, dir.x) / 6.2831853 + 0.5;
    float altitude = clamp(dir.y, 0.0, 1.0);
    vec2 cell = floor(vec2(azimuth * 360.0, altitude * 135.0));
    float rnd = hash(cell);
    float star = smoothstep(0.9925, 1.0, rnd);
    float size = hash(cell + vec2(19.17));
    float brightness = mix(0.35, 1.0, size);

    vec2 local = fract(vec2(azimuth * 360.0, altitude * 135.0)) - 0.5;
    float core = smoothstep(0.22, 0.0, length(local));
    float horizonFade = smoothstep(0.05, 0.34, altitude);

    // Remove estrelas perto do horizonte para evitar ruido visual no limite.
    return star * core * brightness * horizonFade;
}

void main() {
    // Direcoes normalizadas: pixel atual do ceu e sol.
    vec3 dir = normalize(vSkyDir);
    vec3 sunDir = normalize(uSunDir);

    float day = clamp(uSunVisibility, 0.0, 1.0);
    float night = 1.0 - day;
    float twilight = clamp(uTwilightFactor, 0.0, 1.0);
    float disk = clamp(uSunDiskVisibility, 0.0, 1.0);
    float up = clamp(dir.y, 0.0, 1.0);
    float sunDot = max(dot(dir, sunDir), 0.0);
    float sunHeight = clamp(sunDir.y, 0.0, 1.0);

    // Gradiente diurno entre horizonte e zenite.
    vec3 dayHorizon = mix(vec3(0.62, 0.78, 0.94), vec3(0.78, 0.88, 0.98), sunHeight);
    vec3 dayZenith = mix(vec3(0.10, 0.34, 0.72), vec3(0.20, 0.52, 0.94), sunHeight);
    vec3 daySky = mix(dayHorizon, dayZenith, pow(up, 0.72));

    float lowSun = 1.0 - sunHeight;
    vec3 sunsetTint = vec3(1.0, 0.53, 0.20);
    float horizonWarmth = smoothstep(0.0, 0.34, 1.0 - up) * max(twilight, smoothstep(0.05, 0.82, day) * lowSun);
    daySky = mix(daySky, sunsetTint, horizonWarmth * 0.42);

    // Disco solar: um brilho largo mais um nucleo pequeno e intenso.
    float solarGlow = pow(sunDot, 7.0) * disk;
    float solarCore = pow(sunDot, 450.0) * disk;
    daySky += vec3(1.0, 0.78, 0.42) * solarGlow * mix(0.20, 0.52, lowSun);
    daySky += vec3(1.0, 0.93, 0.72) * solarCore * 1.8;

    // Gradiente noturno e brilho oposto ao sol para sugerir lua/ambiente.
    vec3 nightHorizon = vec3(0.012, 0.020, 0.045);
    vec3 nightZenith = vec3(0.002, 0.006, 0.022);
    vec3 nightSky = mix(nightHorizon, nightZenith, pow(up, 0.62));
    nightSky += vec3(0.06, 0.08, 0.16) * pow(max(dot(dir, vec3(-sunDir.x, 0.35, -sunDir.z)), 0.0), 9.0) * night;

    float stars = starField(dir) * clamp(uStarVisibility, 0.0, 1.0);
    nightSky += vec3(0.78, 0.86, 1.0) * stars;

    // Mistura final entre ceu noturno, diurno e aquecimento do crepusculo.
    vec3 color = mix(nightSky, daySky, smoothstep(0.02, 0.92, day));
    color = mix(color, color + vec3(0.16, 0.055, 0.015) * smoothstep(0.0, 0.38, 1.0 - up), twilight * 0.45);
    gl_FragColor = vec4(color, 1.0);
}
