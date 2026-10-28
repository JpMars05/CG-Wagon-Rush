/**
 * MyRandom
 * Gerador pseudoaleatório determinístico LCG (Linear Congruential Generator).
 * Garante que a sequência de números gerados seja sempre igual para a mesma seed,
 * essencial para que a geração procedural (árvores, flores, rochas) seja igual em cada arranque.
 */
export class MyRandom {
    /**
     * @constructor
     * @param {number} [seed=1] - Semente inicial do gerador.
     */
    constructor(seed = 1) {
        // Forçar a seed para um unsigned int de 32 bits (domínio natural do gerador LCG)
        this.state = seed >>> 0;
    }

    /**
     * Gera o próximo número decimal aleatório no intervalo [0, 1).
     * @returns {number} Valor entre 0 (inclusive) e 1 (exclusive).
     */
    next() {
        // LCG clássico: novo_estado = (a * estado + c) mod 2^32.
        // O operador >>> 0 faz o mod 2^32 de forma simples em JavaScript.
        this.state = (1664525 * this.state + 1013904223) >>> 0;
        return this.state / 4294967296;
    }

    /**
     * Retorna um número decimal no intervalo [min, max).
     * @param {number} min - Limite mínimo.
     * @param {number} max - Limite máximo.
     * @returns {number}
     */
    range(min, max) {
        return min + (max - min) * this.next();
    }

    /**
     * Retorna um número inteiro no intervalo [0, maxExclusive).
     * @param {number} maxExclusive - Limite máximo (não incluído).
     * @returns {number}
     */
    int(maxExclusive) {
        return Math.floor(this.next() * maxExclusive);
    }
}
