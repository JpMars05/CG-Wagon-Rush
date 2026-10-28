import { CGFobject, CGFappearance } from '../../lib/CGF.js';
import { MySimpleWagonBed } from './MySimpleWagonBed.js';
import { MySimpleWheel } from './MySimpleWheel.js';
import { MySimpleCanvas } from './MySimpleCanvas.js';
import { MySimpleTongue } from './MySimpleTongue.js';
import { MyHorse } from './MyHorse.js';
import { MyHayBale } from '../structures/MyHayBale.js';

/**
 * MyWagonSimple
 * Controlador principal da carroça. Gere o estado cinemático (velocidade, yaw, pitch, roll),
 * colisões, knockback, suspensão das rodas e a renderização do veículo,
 * do cavalo associado, dos ganchos e da carga transportadas
 */
export class MyWagonSimple extends CGFobject {
    /**
     * Construtor da carroça simples.
     * @param {CGFscene} scene A cena 3D principal
     */
    constructor(scene) {
        super(scene);
        this.wagonBed = new MySimpleWagonBed(scene);
        this.wheel = new MySimpleWheel(scene);
        this.canvas = new MySimpleCanvas(scene);
        this.hoop = new MySimpleCanvas(scene, 30, 20, 0.0, 0.0);
        this.tongue = new MySimpleTongue(scene);
        this.horse = new MyHorse(scene);
        this.carriedHayBale = new MyHayBale(scene);

        this.lanternMaterial = new CGFappearance(scene);
        this.lanternMaterial.setAmbient(0.35, 0.2, 0.06, 1.0);
        this.lanternMaterial.setDiffuse(0.9, 0.55, 0.18, 1.0);
        this.lanternMaterial.setSpecular(0.45, 0.3, 0.15, 1.0);
        this.lanternMaterial.setEmission(0.28, 0.16, 0.05, 1.0);
        this.lanternMaterial.setShininess(12.0);

        this.ropeMaterial = new CGFappearance(scene);
        this.ropeMaterial.setAmbient(0.12, 0.09, 0.05, 1.0);
        this.ropeMaterial.setDiffuse(0.25, 0.18, 0.1, 1.0);
        this.ropeMaterial.setSpecular(0.03, 0.03, 0.03, 1.0);
        this.ropeMaterial.setShininess(4.0);

        // Estado cinemático e de posicionamento
        this.wagonX = 0;
        this.wagonY = 0;
        this.wagonZ = 0;
        this.wagonAngle = 0; // Direção (Yaw)
        this.wagonPitch = 0; // Inclinação Frente-Trás
        this.wagonRoll = 0;  // Inclinação Esquerda-Direita
        this.steeringAngle = 0; // Ângulo das rodas da frente
        this.wheelRotation = 0; // Ângulo acumulado de rotação das rodas

        this.speed = 0;
        this.maxSpeed = 16.0;
        this.accel = 4.0;
        this.brakeDecel = 6.0;   // Travagem maisforte que a aceleração
        this.friction = 1.5;
        this.steeringSpeed = 0.7;
        this.minSpeedToSteer = 0.3; // Velocidade mínima para poder virar

        // Raios das rodas em unidades do mundo (geometria local * escala da carroça)
        this.rearWheelRadius = 1.0 * 2.25;
        this.frontWheelRadius = 1.0 * 2.25 * 0.75;

        // Estado de knockback
        this.knockbackTimer = 0;
        this.knockbackVelX = 0;
        this.knockbackVelZ = 0;
        this.knockbackDuration = 0.65;
        this._terrainPoseInitialized = false;
        this._wheelSuspension = null;
        this._wheelContactsLocal = [
            { key: 'frontLeft', x: 2.2 * 2.25, z: 1.45 * 2.25 },
            { key: 'frontRight', x: 2.2 * 2.25, z: -1.45 * 2.25 },
            { key: 'rearLeft', x: -1.6 * 2.25, z: 1.45 * 2.25 },
            { key: 'rearRight', x: -1.6 * 2.25, z: -1.45 * 2.25 }
        ];
        this.suspensionStiffness = scene.wagonSuspensionStiffness ?? 56.0;
        this.suspensionDamping = scene.wagonSuspensionDamping ?? 8.4;
    }

    getLanternLocalPosition() {
        return { x: -1.25, y: 1.78, z: 0.0 };
    }

    _displayCarriedHayBales() {
        const carried = Math.min(this.scene.carriedBales || 0, this.scene.maxCarriedBales || 2);
        if (carried <= 0) return;

        const placements = [
            { x: -1.35, y: -0.02, z: -0.42, rotY: 0.16, rotZ: -0.04 },
            { x: -0.55, y: 0.01, z: 0.42, rotY: -0.18, rotZ: 0.05 }
        ];

        for (let i = 0; i < carried; i++) {
            const p = placements[i];
            this.scene.pushMatrix();
            this.scene.translate(p.x, p.y, p.z);
            this.scene.rotate(p.rotY, 0, 1, 0);
            this.scene.rotate(p.rotZ, 0, 0, 1);
            this.scene.scale(0.66, 0.56, 0.66);
            this.carriedHayBale.display();
            this.scene.popMatrix();
        }
    }

    getLanternWorldPosition() {
        const p = this.getLanternLocalPosition();
        return this._localToWorld(p.x, p.y, p.z);
    }

    _displayBeamBetween(start, end, thickness = 0.04, drawable = this.wagonBed.cube) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 0.001) return;

        const horizontal = Math.sqrt(dx * dx + dz * dz);
        const yaw = Math.atan2(-dz, dx);
        const pitch = Math.atan2(dy, horizontal);

        this.scene.pushMatrix();
        this.scene.translate(
            (start.x + end.x) * 0.5,
            (start.y + end.y) * 0.5,
            (start.z + end.z) * 0.5
        );
        this.scene.rotate(yaw, 0, 1, 0);
        this.scene.rotate(pitch, 0, 0, 1);
        this.scene.scale(length, thickness, thickness);
        drawable.display();
        this.scene.popMatrix();
    }

    _localToWorld(x, y, z) {
        const s = 2.25;
        let wx = x * s;
        let wy = y * s;
        let wz = z * s;

        const cosRoll = Math.cos(-this.wagonRoll);
        const sinRoll = Math.sin(-this.wagonRoll);
        let ry = wy * cosRoll - wz * sinRoll;
        let rz = wy * sinRoll + wz * cosRoll;
        wy = ry;
        wz = rz;

        const cosPitch = Math.cos(this.wagonPitch);
        const sinPitch = Math.sin(this.wagonPitch);
        let px = wx * cosPitch - wy * sinPitch;
        let py = wx * sinPitch + wy * cosPitch;
        wx = px;
        wy = py;

        const cosYaw = Math.cos(this.wagonAngle);
        const sinYaw = Math.sin(this.wagonAngle);
        let fx = wx * cosYaw + wz * sinYaw;
        let fz = -wx * sinYaw + wz * cosYaw;

        return [this.wagonX + fx, this.wagonY + wy, this.wagonZ + fz];
    }

    getCollisionSpheres() {
        const localSpheres = [
            { x: -1.65, z: 0.0, radius: 1.6, label: 'wagon-back' },
            { x: -0.35, z: -1.15, radius: 1.5, label: 'wagon-right' },
            { x: -0.35, z: 1.15, radius: 1.5, label: 'wagon-left' },
            { x: 1.35, z: 0.0, radius: 1.65, label: 'wagon-front' },
            { x: 3.25, z: 0.0, radius: 1.1, label: 'tongue' },
            { x: 5.05, z: 0.0, radius: 1.4, label: 'horse-body' },
            { x: 6.75, z: 0.0, radius: 0.9, label: 'horse-head' }
        ];

        return localSpheres.map(sphere => {
            const p = this._localToWorld(sphere.x, 0, sphere.z);
            return {
                x: p[0],
                z: p[2],
                radius: sphere.radius,
                label: sphere.label
            };
        });
    }

    _spheresOverlap(a, b) {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const radiusSum = a.radius + b.radius;
        return (dx * dx + dz * dz) < radiusSum * radiusSum;
    }

    _collisionObjectsFrom(source) {
        if (!source || typeof source.getCollisionObjects !== 'function') return [];
        return source.getCollisionObjects();
    }

    _firstCollisionWith(type, objects) {
        const wagonSpheres = this.getCollisionSpheres();

        for (const wagonSphere of wagonSpheres) {
            for (const objectSphere of objects) {
                if (this._spheresOverlap(wagonSphere, objectSphere)) {
                    return {
                        type,
                        wagonSphere,
                        object: objectSphere,
                        damageable: !!objectSphere.damageable,
                        knockbackMultiplier: objectSphere.knockbackMultiplier ?? 1.0,
                        minKnockbackForce: objectSphere.minKnockbackForce ?? 0.0
                    };
                }
            }
        }

        return null;
    }

    getCurrentCollision() {
        const rockHit = this._firstCollisionWith('rock', this._collisionObjectsFrom(this.scene.rocks));
        if (rockHit) return rockHit;

        const fenceHit = this._firstCollisionWith('fence', this._collisionObjectsFrom(this.scene.roadFence));
        if (fenceHit) return fenceHit;

        const baleHit = this._firstCollisionWith('hay-bale', this._collisionObjectsFrom(this.scene.hayBaleManager));
        if (baleHit) return baleHit;

        return this._firstCollisionWith('barn', this._collisionObjectsFrom(this.scene.barn));
    }

    _applyPlayAreaBoundary(options = {}) {
        const limit = (this.scene.playAreaRadius ?? 250.0) - (this.scene.playAreaBoundaryInset ?? 1.0);
        if (limit <= 0) return false;

        let correctionX = 0.0;
        let correctionZ = 0.0;

        for (const sphere of this.getCollisionSpheres()) {
            const minX = sphere.x - sphere.radius;
            const maxX = sphere.x + sphere.radius;
            const minZ = sphere.z - sphere.radius;
            const maxZ = sphere.z + sphere.radius;

            if (minX < -limit) correctionX = Math.max(correctionX, -limit - minX);
            if (maxX > limit) correctionX = Math.min(correctionX, limit - maxX);
            if (minZ < -limit) correctionZ = Math.max(correctionZ, -limit - minZ);
            if (maxZ > limit) correctionZ = Math.min(correctionZ, limit - maxZ);
        }

        if (correctionX === 0.0 && correctionZ === 0.0) return false;

        this.wagonX += correctionX;
        this.wagonZ += correctionZ;

        if (correctionX !== 0.0) this.knockbackVelX = 0.0;
        if (correctionZ !== 0.0) this.knockbackVelZ = 0.0;

        const correctionLen = Math.sqrt(correctionX * correctionX + correctionZ * correctionZ) || 1.0;
        const normalX = correctionX / correctionLen;
        const normalZ = correctionZ / correctionLen;

        if (options.knockback) {
            const impactSpeed = options.impactSpeed ?? this.speed ?? 0.0;
            const minForce = options.minForce ?? 3.5;
            const knockbackForce = Math.max(minForce, impactSpeed * 1.2);

            this.knockbackVelX = normalX * knockbackForce;
            this.knockbackVelZ = normalZ * knockbackForce;
            this.knockbackTimer = this.knockbackDuration;
            this.speed = 0.0;
            return true;
        }

        const forwardX = Math.cos(this.wagonAngle);
        const forwardZ = -Math.sin(this.wagonAngle);
        if (forwardX * normalX + forwardZ * normalZ < 0.0) this.speed = 0.0;

        return true;
    }

    update(dt) {
        if (this.scene.gameOver || !this.scene.gameStarted || this.scene.startCountdownActive) {
            if (this.horse && typeof this.horse.update === 'function') {
                this.horse.update(dt, 0.0, this.maxSpeed);
            }
            this.speed = 0;
            this.steeringAngle *= 0.85;
            this.knockbackTimer = 0;
            return;
        }

        if (this.horse && typeof this.horse.update === 'function') {
            this.horse.update(dt, this.speed, this.maxSpeed);
        }

        // ── Fase de knockback ──────────────────────
        if (this.knockbackTimer > 0) {
            this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);

            // Aplicar movimento de knockback com decaimento
            this.wagonX += this.knockbackVelX * dt;
            this.wagonZ += this.knockbackVelZ * dt;
            this.knockbackVelX *= 0.88;
            this.knockbackVelZ *= 0.88;

            this.speed = 0;
            this.steeringAngle *= 0.9;

            // Rodar rodas para trás durante o knockback
            const kbSpeed = Math.sqrt(this.knockbackVelX * this.knockbackVelX + this.knockbackVelZ * this.knockbackVelZ);
            if (kbSpeed > 0.1) {
                this.wheelRotation += (kbSpeed / this.rearWheelRadius) * dt;
            }

            this._applyPlayAreaBoundary({
                knockback: true,
                impactSpeed: kbSpeed,
                minForce: 3.5
            });

            // Continuar a seguir o terreno durante o knockback
            this._sampleTerrain(dt);
            return;
        }

        // ── Input normal do jogador ─────────────────────────────────────────
        let accelerating = false;
        let braking = false;

        if (this.scene.gui && this.scene.gui.isKeyPressed) {
            // W: Acelerar para a frente
            if (this.scene.gui.isKeyPressed("KeyW")) {
                this.speed += this.accel * dt;
                accelerating = true;
            }

            // S: Apenas trava — reduz a velocidade mas nunca vai abaixo de 0
            if (this.scene.gui.isKeyPressed("KeyS")) {
                if (this.speed > 0) {
                    this.speed -= this.brakeDecel * dt;
                    if (this.speed < 0) this.speed = 0;
                }
                braking = true;
            }

            // Direção (A/D) — só funciona quando a carroça tem velocidade para a frente
            let steeringTurned = false;
            let speedRatio = Math.min(this.speed / this.maxSpeed, 1.0);
            let canSteer = this.speed >= this.minSpeedToSteer;

            if (canSteer && this.scene.gui.isKeyPressed("KeyA")) {
                this.wagonAngle += this.steeringSpeed * speedRatio * dt;
                this.steeringAngle = Math.min(this.steeringAngle + 1.2 * dt, Math.PI / 12);
                steeringTurned = true;
            }
            if (canSteer && this.scene.gui.isKeyPressed("KeyD")) {
                this.wagonAngle -= this.steeringSpeed * speedRatio * dt;
                this.steeringAngle = Math.max(this.steeringAngle - 1.2 * dt, -Math.PI / 12);
                steeringTurned = true;
            }
            if (!steeringTurned) {
                let centerRate = canSteer ? 0.93 : 0.85;
                this.steeringAngle *= centerRate;
            }
        }

        // Fricção natural 
        if (!accelerating && !braking) {
            if (this.speed > 0) {
                this.speed -= this.friction * dt;
                if (this.speed < 0) this.speed = 0;
            }
        }

        // Limites
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < 0) this.speed = 0;

        // Rotação das rodas
        if (this.speed > 0.01) {
            this.wheelRotation -= (this.speed / this.rearWheelRadius) * dt;
        }

        // Salvar posição antes do movimento
        const prevX = this.wagonX;
        const prevZ = this.wagonZ;

        // Mover
        const moveX = this.speed * Math.cos(this.wagonAngle) * dt;
        const moveZ = -this.speed * Math.sin(this.wagonAngle) * dt;
        this.wagonX += moveX;
        this.wagonZ += moveZ;
        this._applyPlayAreaBoundary({
            knockback: true,
            impactSpeed: this.speed,
            minForce: 3.5
        });

        // ── Colisão com knockback ───────────────────────────────────────────
        const collision = this.getCurrentCollision();
        if (collision) {
            // Reverter posição (sem slide)
            this.wagonX = prevX;
            this.wagonZ = prevZ;

            // Calcular knockback para trás, proporcional à velocidade
            const impactSpeed = this.speed;
            const knockbackMultiplier = collision.knockbackMultiplier ?? 1.0;
            const minKnockbackForce = collision.minKnockbackForce ?? 0.0;
            const knockbackForce = Math.max(minKnockbackForce, impactSpeed * 1.2 * knockbackMultiplier);
            const backDirX = -Math.cos(this.wagonAngle);
            const backDirZ = Math.sin(this.wagonAngle);

            this.knockbackVelX = backDirX * knockbackForce;
            this.knockbackVelZ = backDirZ * knockbackForce;
            this.knockbackTimer = this.knockbackDuration;
            this.speed = 0;

            // Aplicar dano (respeita cooldown interno)
            collision.impactSpeed = impactSpeed;
            if (typeof this.scene.applyCollisionDamage === 'function') {
                this.scene.applyCollisionDamage(collision);
            }
        }

        // ── Terreno ─────────────────────────────────────────────────────────
        this._sampleTerrain(dt);
    }

    /**
     * Interpolacao suave usada nas rampas de contacto.
     */
    _smoothstep(edge0, edge1, value) {
        const t = Math.max(0.0, Math.min(1.0, (value - edge0) / (edge1 - edge0)));
        return t * t * (3.0 - 2.0 * t);
    }

    _wheelContactWorldPositions() {
        const cosA = Math.cos(this.wagonAngle);
        const sinA = Math.sin(this.wagonAngle);

        return this._wheelContactsLocal.map(contact => ({
            key: contact.key,
            localX: contact.x,
            localZ: contact.z,
            x: this.wagonX + contact.x * cosA + contact.z * sinA,
            z: this.wagonZ - contact.x * sinA + contact.z * cosA
        }));
    }

    /**
     * Altura extra provocada por rochas pequenas que funcionam como relevo.
     */
    _rideOverRockHeightAt(contact, rideOverRocks, forwardX, forwardZ, rightX, rightZ) {
        let lift = 0.0;

        for (const rock of rideOverRocks) {
            const radius = rock.radius || 1.0;
            const dx = contact.x - rock.x;
            const dz = contact.z - rock.z;
            const longitudinal = (dx * forwardX + dz * forwardZ) / radius;
            const lateral = (dx * rightX + dz * rightZ) / (radius * (rock.lateralScale || 0.95));
            const absLateral = Math.abs(lateral);

            if (longitudinal < -1.08 || longitudinal > 1.12 || absLateral > 1.0) continue;

            let entry0 = -1.02;
            let entry1 = -0.22;
            let exit0 = 0.18;
            let exit1 = 0.92;
            let lateralStart = 0.48;
            let irregularity = 1.0;

            if (rock.profile === 'flat') {
                entry1 = -0.34;
                exit0 = 0.28;
                exit1 = 1.04;
                lateralStart = 0.62;
            } else if (rock.profile === 'irregular') {
                entry1 = -0.12;
                exit0 = 0.08;
                exit1 = 0.74;
                lateralStart = 0.36;
                irregularity += Math.sin(longitudinal * 8.0 + lateral * 4.5 + (rock.phase || 0.0)) * 0.16;
                irregularity += lateral * Math.sin((rock.phase || 0.0) * 1.7) * 0.10;
            }

            const entry = this._smoothstep(entry0, entry1, longitudinal);
            const exit = 1.0 - this._smoothstep(exit0, exit1, longitudinal);
            const lateralFalloff = 1.0 - this._smoothstep(lateralStart, 1.0, absLateral);
            const ramp = Math.max(0.0, entry * exit * lateralFalloff);
            lift = Math.max(lift, (rock.height || 0.0) * ramp * Math.max(0.72, irregularity));
        }

        return lift;
    }

    _ensureWheelSuspension(targets) {
        if (this._wheelSuspension) return;

        this._wheelSuspension = {};
        for (const target of targets) {
            this._wheelSuspension[target.key] = {
                height: target.height,
                velocity: 0.0
            };
        }
    }

    _updateWheelSuspension(targets, dt) {
        this._ensureWheelSuspension(targets);
        const step = Math.min(Math.max(dt, 0.0), 0.045);

        for (const target of targets) {
            const state = this._wheelSuspension[target.key];
            if (!state || !this._terrainPoseInitialized || step <= 0.0) {
                this._wheelSuspension[target.key] = { height: target.height, velocity: 0.0 };
                continue;
            }

            const spring = (target.height - state.height) * this.suspensionStiffness;
            const damping = state.velocity * this.suspensionDamping;
            state.velocity += (spring - damping) * step;
            state.height += state.velocity * step;
        }
    }

    /**
     * Amostra o terreno para atualizar Y, Pitch e Roll da carroça.
     */
    _sampleTerrain(dt = 0) {
        if (this.scene.grass && typeof this.scene.grass.sampleHeight === 'function') {
            const contacts = this._wheelContactWorldPositions();
            const rideOverRocks = (
                this.scene.rocks &&
                typeof this.scene.rocks.getRideOverRocks === 'function'
            ) ? this.scene.rocks.getRideOverRocks() : [];

            const forwardX = Math.cos(this.wagonAngle);
            const forwardZ = -Math.sin(this.wagonAngle);
            const rightX = Math.sin(this.wagonAngle);
            const rightZ = Math.cos(this.wagonAngle);

            const targets = contacts.map(contact => ({
                ...contact,
                height: this.scene.grass.sampleHeight(contact.x, contact.z) +
                    this._rideOverRockHeightAt(contact, rideOverRocks, forwardX, forwardZ, rightX, rightZ)
            }));

            this._updateWheelSuspension(targets, dt);
            this._terrainPoseInitialized = true;

            const fl = this._wheelSuspension.frontLeft.height;
            const fr = this._wheelSuspension.frontRight.height;
            const rl = this._wheelSuspension.rearLeft.height;
            const rr = this._wheelSuspension.rearRight.height;

            const frontAvg = (fl + fr) * 0.5;
            const rearAvg = (rl + rr) * 0.5;
            const leftAvg = (fl + rl) * 0.5;
            const rightAvg = (fr + rr) * 0.5;
            const avgHeight = (fl + fr + rl + rr) * 0.25;

            const frontX = this._wheelContactsLocal[0].x;
            const rearX = this._wheelContactsLocal[2].x;
            const leftZ = this._wheelContactsLocal[0].z;
            const rightZLocal = this._wheelContactsLocal[1].z;

            this.wagonY = avgHeight + 3.375;
            this.wagonPitch = Math.atan2(frontAvg - rearAvg, frontX - rearX);
            this.wagonRoll = Math.atan2(leftAvg - rightAvg, leftZ - rightZLocal);
        }
    }

    display() {
        this.scene.pushMatrix();

        // 0. Posicionamento e Rotação no Mundo
        this.scene.translate(this.wagonX, this.wagonY, this.wagonZ);

        // Direção (Yaw) em Y
        this.scene.rotate(this.wagonAngle, 0, 1, 0);

        // Subida/Descida (Pitch) em Z
        this.scene.rotate(this.wagonPitch, 0, 0, 1);

        // Inclinação lateral (Roll) em X
        this.scene.rotate(-this.wagonRoll, 1, 0, 0);

        // 1. Aumentar o tamanho de todos os elementos da carroça
        this.scene.scale(2.25, 2.25, 2.25);

        // 2. Cama da carroça 
        this.wagonBed.display();
        this._displayCarriedHayBales();

        // 3. Eixo Traseiro e Rodas Traseiras
        let xFront = 2.2;
        let xBack = -1.6;
        let zPos = 1.45;

        // Eixo Traseiro
        this.scene.pushMatrix();
        this.scene.translate(xBack, -0.5, 0);
        this.scene.scale(0.15, 0.15, zPos * 2);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        // Roda Trás Esquerda
        this.scene.pushMatrix();
        this.scene.translate(xBack, -0.5, zPos);
        this.scene.rotate(this.wheelRotation, 0, 0, 1); // Rotação da roda
        this.wheel.display();
        this.scene.popMatrix();

        // Roda Trás Direita
        this.scene.pushMatrix();
        this.scene.translate(xBack, -0.5, -zPos);
        this.scene.rotate(this.wheelRotation, 0, 0, 1); // Rotação da roda
        this.wheel.display();
        this.scene.popMatrix();

        // 4. Tela Arco 
        this.scene.pushMatrix();
        this.scene.translate(-1.25, 0.45, 0);
        this.scene.scale(2.5, 2.2, 1.2);
        this.canvas.display();
        this.scene.popMatrix();

        // 4.1. Suportes de Madeira 
        let oldMat = this.hoop.material;
        this.hoop.material = this.wagonBed.material;

        let hoops = [
            { hx: -2.48, rot: 0.22, scaleY: 2.22 },
            { hx: -1.865, rot: 0.11, scaleY: 2.22 },
            { hx: -1.25, rot: 0.0, scaleY: 2.22 },
            { hx: -0.635, rot: -0.11, scaleY: 2.22 },
            { hx: -0.02, rot: -0.22, scaleY: 2.22 }
        ];

        for (let h of hoops) {
            this.scene.pushMatrix();
            this.scene.translate(h.hx, 0.45, 0);
            this.scene.rotate(h.rot, 0, 0, 1);
            this.scene.scale(0.08, h.scaleY, 1.22);
            this.hoop.display();
            this.scene.popMatrix();
        }
        this.hoop.material = oldMat;

        // 4.2. Lampiao simples suspenso no arco central
        const lantern = this.getLanternLocalPosition();

        this.ropeMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(lantern.x, 2.36, lantern.z);
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        this.scene.scale(0.025, 0.025, 0.6);
        this.wagonBed.cylinder.display();
        this.scene.popMatrix();

        this.lanternMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(lantern.x, lantern.y, lantern.z);

        this.scene.pushMatrix();
        this.scene.scale(0.2, 0.26, 0.2);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(0, 0.2, 0);
        this.scene.scale(0.12, 0.08, 0.12);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(0, -0.22, 0);
        this.scene.scale(0.1, 0.05, 0.1);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        this.scene.popMatrix();

        // 5. Grupo Frontal Independente (Eixo Frontal, Rodas Frontais e Vara)
        this.scene.pushMatrix();
        this.scene.translate(xFront, -0.75, 0); // Centro de rotação do eixo frontal
        this.scene.rotate(this.steeringAngle, 0, 1, 0); // Rotação da direção

        // Eixo Frontal
        this.scene.pushMatrix();
        this.scene.scale(0.12, 0.12, zPos * 2);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        // Roda Frente Esquerda
        // Rodas menores giram mais rápido para a mesma velocidade linear
        let frontWheelRot = this.wheelRotation * (this.rearWheelRadius / this.frontWheelRadius);
        this.scene.pushMatrix();
        this.scene.translate(0, 0, zPos);
        this.scene.scale(0.75, 0.75, 0.75);
        this.scene.rotate(frontWheelRot, 0, 0, 1); // Rotação da roda (mais rápida que traseiras)
        this.wheel.display();
        this.scene.popMatrix();

        // Roda Frente Direita
        this.scene.pushMatrix();
        this.scene.translate(0, 0, -zPos);
        this.scene.scale(0.75, 0.75, 0.75);
        this.scene.rotate(frontWheelRot, 0, 0, 1); // Rotação da roda (mais rápida que traseiras)
        this.wheel.display();
        this.scene.popMatrix();

        // Vara Frontal ligada ao eixo frontal
        this.scene.pushMatrix();
        this.scene.translate(1.5, 0.0, 0);
        this.tongue.display();
        this.scene.popMatrix();

        const horseX = 5.05;
        const horseY = -0.75;
        const horseHeight = 3.0;

        this.scene.pushMatrix();
        this.scene.translate(horseX, horseY, 0.0);
        this.horse.display(horseHeight);
        this.scene.popMatrix();

        this.ropeMaterial.apply();

        const leftBolt = { x: 2.80, y: 0.10, z: 1.15 };
        const rightBolt = { x: 2.80, y: 0.10, z: -1.15 };
        const leftChest = { x: 5.86, y: 1.02, z: 0.58 };
        const rightChest = { x: 5.86, y: 1.02, z: -0.58 };
        const leftLowerChest = { x: 5.72, y: 0.60, z: 0.52 };
        const rightLowerChest = { x: 5.72, y: 0.60, z: -0.52 };
        const leftShoulder = { x: 5.95, y: 1.30, z: 0.46 };
        const rightShoulder = { x: 5.95, y: 1.30, z: -0.46 };

        // Barra de peito do arreio, encostada ao cavalo.
        this.scene.pushMatrix();
        this.scene.translate(5.86, 1.02, 0.0);
        this.scene.scale(0.08, 0.07, 1.26);
        this.wagonBed.cube.display();
        this.scene.popMatrix();

        // Traces principais: saem exatamente dos parafusos laterais da vara.
        this._displayBeamBetween(leftBolt, leftChest, 0.045);
        this._displayBeamBetween(rightBolt, rightChest, 0.045);

        // Segunda linha mais baixa para dar espessura ao conjunto de tracao.
        this._displayBeamBetween({ x: leftBolt.x + 0.08, y: leftBolt.y - 0.10, z: leftBolt.z - 0.10 }, leftLowerChest, 0.032);
        this._displayBeamBetween({ x: rightBolt.x + 0.08, y: rightBolt.y - 0.10, z: rightBolt.z + 0.10 }, rightLowerChest, 0.032);

        // Pequeno colar no pescoço/peito para integrar as correias no corpo.
        this._displayBeamBetween(leftLowerChest, leftChest, 0.035);
        this._displayBeamBetween(rightLowerChest, rightChest, 0.035);
        this._displayBeamBetween(leftChest, leftShoulder, 0.038);
        this._displayBeamBetween(rightChest, rightShoulder, 0.038);
        this._displayBeamBetween(leftShoulder, rightShoulder, 0.035);
        this._displayBeamBetween(leftChest, rightChest, 0.032);

        this.scene.popMatrix(); // Fim do Grupo Frontal

        this.scene.popMatrix(); // Fim da Carroça
    }
}
