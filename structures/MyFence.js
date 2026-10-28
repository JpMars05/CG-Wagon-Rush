import { CGFobject, CGFappearance } from '../../lib/CGF.js';

/**
 * MyFence
 * Cerca de madeira que acompanha o contorno da estrada.
 * Inclui lógica para se adaptar ao relevo do terreno, deixar portões abertos (gaps)
 * e colocar lanternas nos postes finais.
 */
export class MyFence extends CGFobject {
    constructor(scene) {
        super(scene);
        this.scene = scene;
        
        // Criar a caixa unitária usada para desenhar os postes e as travessas
        this.box = this._buildBox();

        this._built = false;

        // Dimensões padrão dos postes e travessas
        this.postWidth   = 0.35;
        this.postHeight  = 3.5;
        this.railHeight  = 0.2;
        this.railDepth   = 0.12;
        this.postSpacing = 6.0;    // Distância desejada entre postes consecutivas

        // Altura relativa das duas travessas no poste
        this.railLow  = 0.35;
        this.railHigh = 0.72;

        // Configuração do portão de entrada
        this.gateWidth = 12.0;

        // Arrays para guardar as instâncias geradas dinamicamente
        this.posts = [];             // { x, y, z }
        this.segments = [];          // { x1, z1, y1, x2, z2, y2 }
        this.lanterns = [];          // { x, y, z, angle }
        this.collisionObjects = [];  // { x, z, radius, type, damageable }
        
        this.lanternPoleHeight = 2.0;
        this.lanternSize = 0.75;
        this.lanternLightOffset = this.postHeight + this.lanternPoleHeight - this.lanternSize * 0.27;

        this.initMaterials(scene);
    }

    /**
     * Inicializa os diferentes materiais e aspetos visuais da cerca e lanternas.
     */
    initMaterials(scene) {
        // Madeira envelhecida para postes e travessas
        this.woodMat = new CGFappearance(scene);
        this.woodMat.setAmbient(0.18, 0.12, 0.06, 1.0);
        this.woodMat.setDiffuse(0.38, 0.24, 0.12, 1.0);
        this.woodMat.setSpecular(0.04, 0.03, 0.02, 1.0);
        this.woodMat.setEmission(0, 0, 0, 1);
        this.woodMat.setShininess(3.0);

        // Metal escuro das lanternas
        this.metalMat = new CGFappearance(scene);
        this.metalMat.setAmbient(0.05, 0.04, 0.035, 1.0);
        this.metalMat.setDiffuse(0.12, 0.10, 0.08, 1.0);
        this.metalMat.setSpecular(0.18, 0.14, 0.10, 1.0);
        this.metalMat.setEmission(0.0, 0.0, 0.0, 1.0);
        this.metalMat.setShininess(12.0);

        // Vidro aceso das lanternas
        this.lanternMat = new CGFappearance(scene);
        this.lanternMat.setAmbient(0.45, 0.28, 0.06, 1.0);
        this.lanternMat.setDiffuse(1.0, 0.65, 0.20, 1.0);
        this.lanternMat.setSpecular(0.6, 0.38, 0.15, 1.0);
        this.lanternMat.setEmission(1.0, 0.62, 0.16, 1.0);
        this.lanternMat.setShininess(18.0);

        // Halo brilhante das lanternas
        this.lanternHaloMat = new CGFappearance(scene);
        this.lanternHaloMat.setAmbient(0.0, 0.0, 0.0, 1.0);
        this.lanternHaloMat.setDiffuse(0.0, 0.0, 0.0, 1.0);
        this.lanternHaloMat.setSpecular(0.0, 0.0, 0.0, 1.0);
        this.lanternHaloMat.setEmission(0.85, 0.48, 0.10, 1.0);
        this.lanternHaloMat.setShininess(1.0);
    }

    /**
     * Constrói uma caixa unitária manual para evitar a dependência de MyUnitCube
     * e otimizar a criação de geometria.
     */
    _buildBox() {
        const box = new CGFobject(this.scene);
        const faces = [
            { n: [0, 0, 1],  v: [[-0.5,-0.5, 0.5],[ 0.5,-0.5, 0.5],[ 0.5, 0.5, 0.5],[-0.5, 0.5, 0.5]] },
            { n: [0, 0,-1],  v: [[ 0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5, 0.5,-0.5],[ 0.5, 0.5,-0.5]] },
            { n: [-1, 0, 0], v: [[-0.5,-0.5,-0.5],[-0.5,-0.5, 0.5],[-0.5, 0.5, 0.5],[-0.5, 0.5,-0.5]] },
            { n: [1, 0, 0],  v: [[ 0.5,-0.5, 0.5],[ 0.5,-0.5,-0.5],[ 0.5, 0.5,-0.5],[ 0.5, 0.5, 0.5]] },
            { n: [0, 1, 0],  v: [[-0.5, 0.5, 0.5],[ 0.5, 0.5, 0.5],[ 0.5, 0.5,-0.5],[-0.5, 0.5,-0.5]] },
            { n: [0,-1, 0],  v: [[-0.5,-0.5,-0.5],[ 0.5,-0.5,-0.5],[ 0.5,-0.5, 0.5],[-0.5,-0.5, 0.5]] },
        ];
        box.vertices = [];
        box.normals = [];
        box.texCoords = [];
        box.indices = [];
        for (let f = 0; f < faces.length; f++) {
            for (let i = 0; i < 4; i++) {
                box.vertices.push(...faces[f].v[i]);
                box.normals.push(...faces[f].n);
            }
            box.texCoords.push(0,1, 1,1, 1,0, 0,0);
            const b = f * 4;
            box.indices.push(b, b+1, b+2, b, b+2, b+3);
        }
        box.primitiveType = this.scene.gl.TRIANGLES;
        box.initGLBuffers();
        return box;
    }

    /**
     * Constrói dinamicamente a cerca acompanhando a estrada do terreno usando a máscara de estradas.
     */
    buildAlongRoad(grassRef, options = {}) {
        const mask = grassRef && grassRef.roadMaskImageData;
        if (!mask) {
            this._built = false;
            return;
        }

        this.posts = [];
        this.segments = [];
        this.lanterns = [];
        this.collisionObjects = [];

        const width = mask.width;
        const height = mask.height;
        const data = mask.data;
        const worldScale = (grassRef.scene.playAreaRadius ?? 250.0) * 2.0;
        const threshold = options.threshold ?? 0.55;
        const offset = options.offset ?? 5.4; // Desvio para a cerca não ficar no meio da estrada
        const spacing = options.postSpacing ?? 7.0;
        const gateEvery = options.gateEvery ?? 11;
        const gateWidth = options.gateWidth ?? 21.0;
        const gatePeriod = Math.max(gateWidth + spacing * 2.0, options.gateEveryDistance ?? gateEvery * spacing);
        const minContourLength = options.minContourLength ?? 90.0;
        const maxContours = options.maxContours ?? 4;
        const maxInnerContours = options.maxInnerContours ?? Math.max(0, maxContours - 1);
        const minSecondaryContourLength = options.minSecondaryContourLength ?? minContourLength * 1.4;
        const minSecondaryContourArea = options.minSecondaryContourArea ?? 900.0;
        const simplifyEpsilon = options.simplifyEpsilon ?? 3.2; // Tolerância para simplificar vértices redundantes
        const smoothingPasses = options.smoothingPasses ?? 2;
        const clearings = options.clearings ?? [];

        this.postSpacing = spacing;
        this.gateWidth = gateWidth;

        // Verifica se a célula da máscara é estrada (valor alto em R)
        const isRoad = (ix, iy) => {
            if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
            const idx = (iy * width + ix) * 4;
            return data[idx] / 255.0 > threshold;
        };

        // Flood fill para encontrar a componente conexa principal da estrada
        const largestRoadComponent = this._largestRoadComponent(width, height, isRoad);
        if (!largestRoadComponent) {
            this._built = false;
            return;
        }

        const inRoadComponent = (ix, iy) => {
            if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
            return largestRoadComponent[(iy * width) + ix] === 1;
        };

        // Identificar as arestas da fronteira da estrada
        const key = (x, y) => `${x},${y}`;
        const edges = [];
        const addEdge = (ax, ay, bx, by, nx, nz) => {
            edges.push({
                ax, ay, bx, by, nx, nz,
                aKey: key(ax, ay),
                bKey: key(bx, by),
            });
        };

        for (let iy = 0; iy < height; iy++) {
            for (let ix = 0; ix < width; ix++) {
                if (!inRoadComponent(ix, iy)) continue;

                if (!inRoadComponent(ix, iy - 1)) addEdge(ix, iy, ix + 1, iy, 0, -1);
                if (!inRoadComponent(ix + 1, iy)) addEdge(ix + 1, iy, ix + 1, iy + 1, 1, 0);
                if (!inRoadComponent(ix, iy + 1)) addEdge(ix + 1, iy + 1, ix, iy + 1, 0, 1);
                if (!inRoadComponent(ix - 1, iy)) addEdge(ix, iy + 1, ix, iy, -1, 0);
            }
        }

        // Criar listas de adjacência para ligar as arestas em contornos fechados
        const adjacency = new Map();
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (!adjacency.has(e.aKey)) adjacency.set(e.aKey, []);
            if (!adjacency.has(e.bKey)) adjacency.set(e.bKey, []);
            adjacency.get(e.aKey).push(i);
            adjacency.get(e.bKey).push(i);
        }

        const visited = new Array(edges.length).fill(false);
        const contours = [];
        for (let i = 0; i < edges.length; i++) {
            if (visited[i]) continue;

            const contour = [];
            let current = i;
            let fromKey = edges[i].aKey;
            let guard = 0;

            // Seguir as arestas ligadas consecutivamente
            while (current !== -1 && !visited[current] && guard++ < edges.length) {
                const edge = edges[current];
                visited[current] = true;
                contour.push(edge);

                const toKey = edge.aKey === fromKey ? edge.bKey : edge.aKey;
                const candidates = (adjacency.get(toKey) || []).filter(id => !visited[id]);
                if (candidates.length === 0) break;

                current = this._chooseNextRoadEdge(edge, fromKey, candidates, edges);
                fromKey = toKey;
            }

            if (contour.length > 0) contours.push(contour);
        }

        // Classificar contornos pelo comprimento e área
        const contourCandidates = contours
            .map(contour => ({
                contour,
                length: this._roadContourPixelLength(contour),
                area: Math.abs(this._roadContourPixelArea(contour)),
            }))
            .map(entry => ({
                ...entry,
                worldLength: entry.length * worldScale / Math.max(width, height),
                worldArea: entry.area * worldScale * worldScale / (width * height),
            }))
            .filter(entry => entry.worldLength >= minContourLength)
            .sort((a, b) => b.worldLength - a.worldLength);

        const contourEntries = [];
        if (contourCandidates.length > 0) {
            contourEntries.push(contourCandidates[0]); // O contorno exterior principal da pista

            const innerContours = contourCandidates
                .slice(1)
                .filter(entry =>
                    entry.worldLength >= minSecondaryContourLength &&
                    entry.worldArea >= minSecondaryContourArea
                )
                .slice(0, maxInnerContours);

            contourEntries.push(...innerContours); // Ilhas interiores (como o centro do circuito)
        }

        // Processar, suavizar, simplificar e gerar postes para cada contorno validado
        for (let i = 0; i < contourEntries.length; i++) {
            let points = this._roadContourToWorldPoints(contourEntries[i].contour, width, height, worldScale, offset);
            points = this._smoothRoadFencePoints(points, smoothingPasses);
            points = this._simplifyRoadFencePoints(points, simplifyEpsilon);
            this._addRoadFencePosts(points, grassRef, {
                spacing,
                gateWidth,
                gatePeriod,
                gateOffset: gatePeriod * (0.45 + (i % 3) * 0.18),
                minContourLength,
                clearings,
            });
        }

        this._buildCollisionObjects();
        this._built = this.posts.length > 0;
        console.log(`MyFence: road fence ${this.posts.length} postes, ${this.segments.length} segmentos, ${contourEntries.length}/${contours.length} contornos.`);
    }

    // ── MÉTODOS AUXILIARES DE ESTRADA ─────────────────────────────────────
    
    /**
     * Encontra a maior componente conexa de estrada (elimina ruído isolado da Road_Mask)
     */
    _largestRoadComponent(width, height, isRoad) {
        const visited = new Uint8Array(width * height);
        let bestCells = null;
        let bestSize = 0;
        const queue = [];

        for (let sy = 0; sy < height; sy++) {
            for (let sx = 0; sx < width; sx++) {
                const startIdx = sy * width + sx;
                if (visited[startIdx] || !isRoad(sx, sy)) continue;

                const cells = [];
                queue.length = 0;
                queue.push(startIdx);
                visited[startIdx] = 1;

                for (let qi = 0; qi < queue.length; qi++) {
                    const idx = queue[qi];
                    cells.push(idx);
                    const x = idx % width;
                    const y = Math.floor(idx / width);

                    const neighbors = [
                        idx - 1,
                        idx + 1,
                        idx - width,
                        idx + width,
                    ];

                    for (const nIdx of neighbors) {
                        if (nIdx < 0 || nIdx >= visited.length || visited[nIdx]) continue;
                        const nx = nIdx % width;
                        const ny = Math.floor(nIdx / width);
                        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
                        if (!isRoad(nx, ny)) continue;
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }

                if (cells.length > bestSize) {
                    bestSize = cells.length;
                    bestCells = cells;
                }
            }
        }

        if (!bestCells || bestCells.length === 0) return null;

        const component = new Uint8Array(width * height);
        for (const idx of bestCells) component[idx] = 1;
        return component;
    }

    /**
     * Escolhe a próxima aresta que minimiza a mudança de direção brusca.
     */
    _chooseNextRoadEdge(previousEdge, previousFromKey, candidates, edges) {
        if (candidates.length <= 1) return candidates[0] ?? -1;

        const previousToKey = previousEdge.aKey === previousFromKey ? previousEdge.bKey : previousEdge.aKey;
        const previousVec = previousEdge.aKey === previousFromKey
            ? [previousEdge.bx - previousEdge.ax, previousEdge.by - previousEdge.ay]
            : [previousEdge.ax - previousEdge.bx, previousEdge.ay - previousEdge.by];

        let best = candidates[0];
        let bestDot = -Infinity;

        for (const id of candidates) {
            const edge = edges[id];
            const vec = edge.aKey === previousToKey
                ? [edge.bx - edge.ax, edge.by - edge.ay]
                : [edge.ax - edge.bx, edge.ay - edge.by];
            const dot = previousVec[0] * vec[0] + previousVec[1] * vec[1];
            if (dot > bestDot) {
                bestDot = dot;
                best = id;
            }
        }

        return best;
    }

    /**
     * Transforma coordenadas de contorno pixel em coordenadas reais do mundo WebGL.
     */
    _roadContourToWorldPoints(contour, width, height, worldScale, offset) {
        const points = [];

        for (const edge of contour) {
            const u = ((edge.ax + edge.bx) * 0.5) / width;
            const v = ((edge.ay + edge.by) * 0.5) / height;
            points.push({
                x: (u - 0.5) * worldScale + edge.nx * offset,
                z: (v - 0.5) * worldScale + edge.nz * offset,
            });
        }

        return points;
    }

    _roadContourPixelLength(contour) {
        let length = 0;
        for (const edge of contour) {
            const dx = edge.bx - edge.ax;
            const dy = edge.by - edge.ay;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    }

    _roadContourPixelArea(contour) {
        if (contour.length < 3) return 0.0;

        let area = 0.0;
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % contour.length];
            const ax = (a.ax + a.bx) * 0.5;
            const ay = (a.ay + a.by) * 0.5;
            const bx = (b.ax + b.bx) * 0.5;
            const by = (b.ay + b.by) * 0.5;
            area += ax * by - bx * ay;
        }

        return area * 0.5;
    }

    /**
     * Aplica uma suavização de vizinhança aos pontos da cerca para contornar curvas de forma orgânica.
     */
    _smoothRoadFencePoints(points, passes) {
        let result = points;
        for (let pass = 0; pass < passes; pass++) {
            if (result.length < 4) return result;
            const smoothed = [];
            for (let i = 0; i < result.length; i++) {
                const prev = result[(i - 1 + result.length) % result.length];
                const curr = result[i];
                const next = result[(i + 1) % result.length];
                smoothed.push({
                    x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
                    z: prev.z * 0.25 + curr.z * 0.5 + next.z * 0.25,
                });
            }
            result = smoothed;
        }
        return result;
    }

    /**
     * Simplifica os contornos removendo pontos excessivamente próximos de segmentos de reta.
     */
    _simplifyRoadFencePoints(points, epsilon) {
        if (points.length < 4) return points;

        const simplified = [points[0]];
        let anchor = points[0];

        for (let i = 1; i < points.length - 1; i++) {
            const next = points[i + 1];
            const dist = this._pointToSegmentDistance(points[i], anchor, next);
            if (dist >= epsilon || this._distanceXZ(anchor, points[i]) >= epsilon * 2.5) {
                simplified.push(points[i]);
                anchor = points[i];
            }
        }

        simplified.push(points[points.length - 1]);
        return simplified;
    }

    _pointToSegmentDistance(point, a, b) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lenSq = dx * dx + dz * dz;
        if (lenSq < 0.0001) return this._distanceXZ(point, a);
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        return Math.sqrt((point.x - px) * (point.x - px) + (point.z - pz) * (point.z - pz));
    }

    /**
     * Gera postes de forma interpolada ao longo dos pontos simplificados do contorno.
     */
    _addRoadFencePosts(points, grassRef, options) {
        if (points.length < 2) return;

        const spacing = options.spacing;
        const maxSegmentLength = spacing * 1.85;
        const distances = [0];
        let totalLength = 0;

        // Calcular distâncias acumuladas ao longo do caminho
        for (let i = 1; i < points.length; i++) {
            const d = this._distanceXZ(points[i - 1], points[i]);
            if (d > maxSegmentLength) {
                // Segmento partido ou longo demais: quebra o caminho e faz recursão
                this._addRoadFencePosts(points.slice(i), grassRef, options);
                points.length = i;
                break;
            }
            totalLength += d;
            distances.push(totalLength);
        }

        if (totalLength < options.minContourLength) return;

        const closed = this._distanceXZ(points[0], points[points.length - 1]) < maxSegmentLength;
        const sampled = [];
        const limit = closed ? totalLength : totalLength + spacing * 0.25;

        // Amostrar posições a cada 'spacing' metros
        for (let d = 0; d <= limit; d += spacing) {
            const travel = closed ? d % totalLength : Math.min(d, totalLength);
            const p = this._pointAtDistance(points, distances, travel);
            
            // Ignorar postes que caem fora da área de jogo, num portão de corte, ou numa clareira
            if (
                (typeof grassRef.isInPlayArea === 'function' && !grassRef.isInPlayArea(p.x, p.z, 1.0)) ||
                this._isRoadGateDistance(travel, options.gatePeriod, options.gateWidth, options.gateOffset) ||
                this._isInRoadFenceClearing(p, options.clearings)
            ) {
                sampled.push({ gate: true });
                continue;
            }

            const y = grassRef.sampleHeight(p.x, p.z);
            sampled.push({ x: p.x, y, z: p.z, gate: false });
        }

        let run = [];
        const flushRun = () => {
            this._addFenceRun(run);
            run = [];
        };

        // Separar em múltiplos blocos contínuos delimitados pelos gaps
        for (const post of sampled) {
            if (post.gate) {
                flushRun();
            } else {
                run.push(post);
            }
        }
        flushRun();

        // Fechar o contorno unindo o último run ao primeiro, se for o caso
        if (closed) {
            const first = sampled.find(p => !p.gate);
            const last = [...sampled].reverse().find(p => !p.gate);
            if (first && last && this._distanceXZ(first, last) < maxSegmentLength) {
                this.segments.push({
                    x1: last.x, z1: last.z, y1: last.y,
                    x2: first.x, z2: first.z, y2: first.y,
                });
            }
        }
    }

    /**
     * Adiciona um troço de cerca contínuo e coloca lanternas nas suas extremidades.
     */
    _addFenceRun(run) {
        if (!run || run.length === 0) return;

        for (let i = 0; i < run.length; i++) {
            this.posts.push(run[i]);
            if (i === 0) continue;
            this.segments.push({
                x1: run[i - 1].x, z1: run[i - 1].z, y1: run[i - 1].y,
                x2: run[i].x,     z2: run[i].z,     y2: run[i].y,
            });
        }

        if (run.length < 2) return;

        // Lanternas nas pontas do troço aberto
        this._addLanternAtRunEnd(run[0], run[1]);
        this._addLanternAtRunEnd(run[run.length - 1], run[run.length - 2]);
    }

    _addLanternAtRunEnd(post, neighbor) {
        const dx = post.x - neighbor.x;
        const dz = post.z - neighbor.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.001) return;

        const angle = Math.atan2(dx, dz);
        const duplicate = this.lanterns.some(l => {
            const lx = l.x - post.x;
            const lz = l.z - post.z;
            return lx * lx + lz * lz < 1.0;
        });
        if (duplicate) return;

        this.lanterns.push({
            x: post.x,
            y: post.y,
            z: post.z,
            angle,
        });
    }

    _isRoadGateDistance(distance, period, width, offset) {
        const local = ((distance - offset) % period + period) % period;
        return Math.min(local, period - local) < width * 0.5;
    }

    _isInRoadFenceClearing(point, clearings) {
        for (const clearing of clearings || []) {
            const dx = point.x - clearing.x;
            const dz = point.z - clearing.z;
            const radius = clearing.radius ?? 0.0;
            if (dx * dx + dz * dz < radius * radius) return true;
        }
        return false;
    }

    _pointAtDistance(points, distances, target) {
        for (let i = 1; i < distances.length; i++) {
            if (distances[i] < target) continue;
            const span = distances[i] - distances[i - 1] || 1.0;
            const t = (target - distances[i - 1]) / span;
            return {
                x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
                z: points[i - 1].z + (points[i].z - points[i - 1].z) * t,
            };
        }

        return points[points.length - 1];
    }

    _distanceXZ(a, b) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Constrói e subdivide objetos circulares de colisão em torno dos postes e travessas.
     */
    _buildCollisionObjects() {
        this.collisionObjects = [];

        // Colisão nos postes
        for (const post of this.posts) {
            this.collisionObjects.push({
                x: post.x,
                z: post.z,
                radius: 1.55,
                type: 'fence',
                damageable: true
            });
        }

        // Subamostrar travessas longas para que a carroça não atravesse a cerca a meio
        for (const seg of this.segments) {
            const dx = seg.x2 - seg.x1;
            const dz = seg.z2 - seg.z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const samples = Math.max(1, Math.ceil(len / 3.0));

            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                this.collisionObjects.push({
                    x: seg.x1 + dx * t,
                    z: seg.z1 + dz * t,
                    radius: 1.15,
                    type: 'fence',
                    damageable: true
                });
            }
        }
    }

    getCollisionObjects() {
        return this._built ? this.collisionObjects : [];
    }

    /**
     * Devolve as posições 3D globais das fontes de luz das lanternas da cerca.
     */
    getLanternWorldPositions(reference = null, maxCount = Infinity) {
        if (!this._built || this.lanterns.length === 0) return [];

        const positions = this.lanterns.map(l => ({
            x: l.x,
            y: l.y + this.lanternLightOffset,
            z: l.z,
        }));

        // Se for passada uma referência, ordena as luzes pelas mais próximas
        if (reference) {
            positions.sort((a, b) => {
                const adx = a.x - reference.x;
                const adz = a.z - reference.z;
                const bdx = b.x - reference.x;
                const bdz = b.z - reference.z;
                return (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
            });
        }

        return positions.slice(0, maxCount).map(p => [p.x, p.y, p.z]);
    }

    display() {
        if (!this._built) return;
        const sc = this.scene;

        this.woodMat.apply();

        const pw = this.postWidth;
        const ph = this.postHeight;

        // ── Desenhar Postes ────────────────────────────────────────────────
        for (const p of this.posts) {
            sc.pushMatrix();
            sc.translate(p.x, p.y + ph / 2, p.z);
            sc.scale(pw, ph, pw);
            this.box.display();
            sc.popMatrix();

            // Topo pontiagudo/chapéu decorativo do poste
            sc.pushMatrix();
            sc.translate(p.x, p.y + ph + 0.2, p.z);
            sc.scale(pw * 0.7, 0.5, pw * 0.7);
            this.box.display();
            sc.popMatrix();
        }

        // ── Desenhar Travessas ─────────────────────────────────────────────
        for (const seg of this.segments) {
            const dx = seg.x2 - seg.x1;
            const dz = seg.z2 - seg.z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dx, dz);
            const midX = (seg.x1 + seg.x2) / 2;
            const midZ = (seg.z1 + seg.z2) / 2;
            const midY = (seg.y1 + seg.y2) / 2;

            // Inclinação vertical para a madeira acompanhar o relevo do terreno
            const dy = seg.y2 - seg.y1;
            const tilt = Math.atan2(dy, len);

            // Desenhar a travessa inferior e a superior
            for (const frac of [this.railLow, this.railHigh]) {
                const ry = frac * ph;

                sc.pushMatrix();
                sc.translate(midX, midY + ry, midZ);
                sc.rotate(angle, 0, 1, 0);
                sc.rotate(-tilt, 1, 0, 0);
                sc.scale(this.railDepth, this.railHeight, len);
                this.box.display();
                sc.popMatrix();
            }
        }

        // Desenhar as lanternas associadas
        this._displayLanterns(sc);
    }

    /**
     * Renderiza as lanternas
     */
    _displayLanterns(sc) {
        if (!this.lanterns || this.lanterns.length === 0) return;

        const ph = this.postHeight;
        const poleHeight = this.lanternPoleHeight;
        const size = this.lanternSize;

        for (const l of this.lanterns) {
            this.metalMat.apply();

            // Poste suporte da lanterna
            sc.pushMatrix();
            sc.translate(l.x, l.y + ph + poleHeight * 0.5, l.z);
            sc.scale(0.16, poleHeight, 0.16);
            this.box.display();
            sc.popMatrix();

            // Placa superior 
            sc.pushMatrix();
            sc.translate(l.x, l.y + ph + poleHeight + size * 0.12, l.z);
            sc.rotate(l.angle, 0, 1, 0);
            sc.scale(size * 1.05, 0.16, size * 1.05);
            this.box.display();
            sc.popMatrix();

            // Placa inferior 
            sc.pushMatrix();
            sc.translate(l.x, l.y + ph + poleHeight - size * 0.72, l.z);
            sc.rotate(l.angle, 0, 1, 0);
            sc.scale(size * 0.88, 0.12, size * 0.88);
            this.box.display();
            sc.popMatrix();

            // 4 barras metálicas laterais de proteção do vidro
            const barOffset = size * 0.42;
            for (const sx of [-1, 1]) {
                for (const sz of [-1, 1]) {
                    sc.pushMatrix();
                    sc.translate(l.x, l.y + ph + poleHeight - size * 0.28, l.z);
                    sc.rotate(l.angle, 0, 1, 0);
                    sc.translate(sx * barOffset, 0, sz * barOffset);
                    sc.scale(0.08, size * 0.92, 0.08);
                    this.box.display();
                    sc.popMatrix();
                }
            }

            // Halo brilhante interior do fogo
            this.lanternHaloMat.apply();
            sc.pushMatrix();
            sc.translate(l.x, l.y + ph + poleHeight - size * 0.27, l.z);
            sc.scale(size * 0.72, size * 0.82, size * 0.72);
            this.box.display();
            sc.popMatrix();

            // Lâmpada acesa interior
            this.lanternMat.apply();
            sc.pushMatrix();
            sc.translate(l.x, l.y + ph + poleHeight - size * 0.27, l.z);
            sc.scale(size * 0.46, size * 0.58, size * 0.46);
            this.box.display();
            sc.popMatrix();
        }
    }
}

