import { CGFobject } from '../../lib/CGF.js';

/**
 * CGFobjBatch
 * Sub-objeto que representa um lote (batch) de geometria extraído de um ficheiro OBJ.
 * Como o WebGL no CGF usa índices de 16 bits (limite de 65535 vértices por draw call),
 * modelos 3D complexos (como o cavalo) precisam de ser partidos em múltiplos lotes.
 */
class CGFobjBatch extends CGFobject {
    constructor(scene, vertices, normals, texCoords, indices) {
        super(scene);
        this.vertices = vertices;
        this.normals = normals;
        this.texCoords = texCoords;
        this.indices = indices;
        this.primitiveType = scene.gl.TRIANGLES;
        // Só inicializa buffers se tiver geometria válida
        if (vertices.length > 0) this.initGLBuffers();
    }
}

/**
 * CGFobjModel
 * Carregador assíncrono de modelos no formato .OBJ.
 * Suporta modelos grandes dividindo-os automaticamente em sub-lotes e permite
 * passar funções customizadas para transformar posições ou normais dos vértices durante o loading.
 */
export class CGFobjModel extends CGFobject {
    constructor(scene, modelUrl, options = {}) {
        super(scene);
        this.modelUrl = modelUrl;
        this.ready = false;
        this.batches = [];
        
        // Callbacks opcionais para aplicar transformações (escala, rotação, etc.) diretamente nos dados importados
        this.transformPosition = options.transformPosition || ((p) => p);
        this.transformNormal = options.transformNormal || ((n) => n);
        
        // Limite padrão de vértices por lote para compatibilidade WebGL
        this.maxVerticesPerBatch = options.maxVerticesPerBatch || 60000;

        this._load();
    }

    /**
     * Efetua o fetch assíncrono do ficheiro .obj e despoleta o parsing.
     */
    async _load() {
        try {
            const response = await fetch(this.modelUrl);
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            this.loadData(await response.text());
            this.ready = true;
        } catch (error) {
            console.error(`CGFobjModel: falha ao carregar o modelo em ${this.modelUrl}`, error);
        }
    }

    /**
     * Faz o parsing do texto do ficheiro OBJ e divide-o em batches.
     * @param {string} objectData - Conteúdo em texto do ficheiro .obj
     */
    loadData(objectData) {
        const positions = [];
        const normals = [];
        const texCoords = [];

        let batchVertices = [];
        let batchNormals = [];
        let batchTexCoords = [];
        let batchIndices = [];
        let batchVertexMap = new Map(); // Mapa para evitar duplicar o mesmo vértice no lote

        // Finaliza o lote atual e instancia um CGFobjBatch
        const finishBatch = () => {
            if (batchVertices.length === 0) return;
            this.batches.push(new CGFobjBatch(
                this.scene,
                batchVertices,
                batchNormals,
                batchTexCoords,
                batchIndices
            ));
            // Resetar buffers para o próximo lote
            batchVertices = [];
            batchNormals = [];
            batchTexCoords = [];
            batchIndices = [];
            batchVertexMap = new Map();
        };

        // Adiciona um vértice ao lote atual (e devolve o índice correspondente)
        const addVertex = (token) => {
            const cached = batchVertexMap.get(token);
            if (cached !== undefined) return cached;

            const parts = token.split('/');
            const positionIndex = Number(parts[0]) - 1;
            const texCoordIndex = parts[1] ? Number(parts[1]) - 1 : -1;
            const normalIndex = parts[2] ? Number(parts[2]) - 1 : -1;

            // Obter e transformar a posição e a normal do vértice
            const position = this.transformPosition(positions[positionIndex] || [0, 0, 0]);
            const normal = this._normalize(this.transformNormal(normals[normalIndex] || [0, 1, 0]));
            const texCoord = texCoords[texCoordIndex] || [0, 0];
            const nextIndex = batchVertices.length / 3;

            batchVertices.push(position[0], position[1], position[2]);
            batchNormals.push(normal[0], normal[1], normal[2]);
            batchTexCoords.push(texCoord[0], texCoord[1]);
            
            batchVertexMap.set(token, nextIndex);
            return nextIndex;
        };

        // Emite um triângulo no lote, criando um novo lote se exceder o limite de vértices
        const emitTriangle = (a, b, c) => {
            if ((batchVertices.length / 3) + 3 > this.maxVerticesPerBatch) finishBatch();
            batchIndices.push(addVertex(a), addVertex(b), addVertex(c));
        };

        // Ler o ficheiro linha a linha
        for (const rawLine of objectData.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (line === '' || line.startsWith('#')) continue; // Ignorar vazias e comentários

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vértice tridimensional [x, y, z]
                positions.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
            } else if (type === 'vn') {
                // Vetor Normal [x, y, z]
                normals.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
            } else if (type === 'vt') {
                // Coordenadas de textura [u, v]
                texCoords.push([Number(parts[1]), Number(parts[2])]);
            } else if (type === 'f') {
                // Face (geralmente quadriláteros ou polígonos - triangula usando fan-triangulation)
                const face = parts.slice(1);
                for (let i = 1; i < face.length - 1; i++) {
                    emitTriangle(face[0], face[i], face[i + 1]);
                }
            }
        }

        // Finaliza o último lote restante
        finishBatch();
    }

    /**
     * Normaliza um vetor 3D.
     */
    _normalize(v) {
        const len = Math.hypot(v[0], v[1], v[2]) || 1.0;
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    /**
     * Desenha todos os lotes de geometria carregados.
     */
    display() {
        if (!this.ready) return;
        for (const batch of this.batches) {
            batch.display();
        }
    }
}

