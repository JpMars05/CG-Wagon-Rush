import { CGFtexture } from '../../lib/CGF.js';

/**
 * MyAssetManager
 * Gere e centraliza o carregamento de texturas e imagens do projeto.
 * Permite ler e fazer cache de dados de pixéis das imagens no lado do CPU (essencial para
 * a leitura de altura do terrain e máscaras de estrada).
 */
export class MyAssetManager {
    constructor(scene) {
        this.scene = scene;
        this.textures = new Map();         // Cache de objetos CGFtexture
        this.imageDataEntries = new Map(); // Cache de dados de imagem carregados no CPU
    }

    /**
     * Retorna um objeto CGFtexture para o caminho especificado, criando-o se ainda não existir na cache.
     * @param {string} path - Caminho para o ficheiro de imagem da textura.
     * @returns {CGFtexture}
     */
    getTexture(path) {
        if (!this.textures.has(path)) {
            this.textures.set(path, new CGFtexture(this.scene, path));
        }
        return this.textures.get(path);
    }

    /**
     * Obtém os dados de imagem guardados na cache (retorna null se ainda não tiverem sido carregados).
     * @param {string} path - Caminho da imagem.
     * @returns {ImageData|null}
     */
    getCachedImageData(path) {
        const entry = this.imageDataEntries.get(path);
        return entry && entry.data ? entry.data : null;
    }

    /**
     * Carrega uma imagem de forma assíncrona e extrai os seus dados de pixéis (ImageData) usando um Canvas 2D temporário.
     * @param {string} path - Caminho para a imagem.
     * @param {object} [options={}] - Configurações opcionais (ex: se é opcional).
     * @returns {Promise<ImageData|null>}
     */
    getImageData(path, options = {}) {
        const existing = this.imageDataEntries.get(path);
        if (existing) return existing.promise;

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Desenhar a imagem num Canvas 2D oculto para ler os pixéis
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, img.width, img.height);
                
                // Guardar na cache
                this.imageDataEntries.set(path, { promise, data });
                resolve(data);
            };
            img.onerror = () => {
                const message = `MyAssetManager: falha ao carregar a imagem ${path}`;
                if (options.optional) {
                    console.warn(message);
                    this.imageDataEntries.set(path, { promise, data: null });
                    resolve(null);
                } else {
                    reject(new Error(message));
                }
            };
            img.src = path;
        });

        // Guardar a promise pendente na cache para evitar múltiplos pedidos da mesma imagem
        this.imageDataEntries.set(path, { promise, data: null });
        return promise;
    }

    /**
     * Pré-carrega de imediato o heightmap e o mapa de estradas do terreno,
     * para que fiquem prontos no CPU assim que a cena começar.
     */
    preloadCriticalTerrain() {
        this.getImageData('textures/heigthmap.jpg');
        this.getImageData('textures/road_mask.png', { optional: true });
        this.getTexture('textures/heigthmap.jpg');
        this.getTexture('textures/road_mask.png');
    }
}

