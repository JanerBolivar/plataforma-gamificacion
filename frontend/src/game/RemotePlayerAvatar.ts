import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface RemotePlayerData {
  userId: string;
  fullName: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  avatarModel?: string; // 'female' | 'man'
  x: number;
  y: number;
  z: number;
  ry: number;
  animState: string;
}

/**
 * Vinculo de hueso: almacena la referencia al objeto THREE.Bone,
 * su cuaternion de bind-pose y los cuaterniones precalculados de IDLE y JUMP.
 */
interface BoneBinding {
  bone: THREE.Bone;
  bindQuat: THREE.Quaternion;
  idleQuat: THREE.Quaternion;
  jumpQuat: THREE.Quaternion;
}

// ---------------------------------------------------------------------------
// Cache de prototipos GLB
// ---------------------------------------------------------------------------

class AvatarModelCache {
  private static loader = new GLTFLoader();
  private static cache = new Map<string, THREE.Group>();
  private static loading = new Map<string, Promise<THREE.Group>>();

  public static async get(modelType: string): Promise<THREE.Group> {
    const url = `/models/pj/${modelType === 'man' ? 'man_boddy.glb' : 'female_boddy.glb'}`;

    let tmpl = this.cache.get(url);
    if (!tmpl) {
      let p = this.loading.get(url);
      if (!p) {
        p = new Promise<THREE.Group>((resolve, reject) =>
          this.loader.load(url, (g) => { this.cache.set(url, g.scene); this.loading.delete(url); resolve(g.scene); },
            undefined, (e) => { this.loading.delete(url); reject(e); })
        );
        this.loading.set(url, p);
      }
      tmpl = await p;
    }
    return SkeletonUtils.clone(tmpl) as THREE.Group;
  }
}

// ---------------------------------------------------------------------------
// Configuraciones de animacion por modelo
// ---------------------------------------------------------------------------
interface CharacterAnimConfig {
  idlePose: Record<string, [number, number, number]>;
  walk: {
    freq: number;
    thighAxis: string;
    thigh: number;
    thighSign: number;
    knee: number;
    kneeSign: number;
    ankle: number;
    hipSway: number;
    armAxis: string;
    armSwing: number;
    armLag: number;
    armSign: number;
    armMirror: number;
    elbowAxis: string;
    elbowBend: number;
    elbowSign: number;
    elbowMirror: number;
  };
  jump: {
    height: number;
    speed: number;
    pose: Record<string, [number, number, number]>;
  };
}

const FEMALE_ANIM_CONFIG: CharacterAnimConfig = {
  idlePose: {
    LeftForeArm:  [-0.25, 0, 0],
    RightForeArm: [-0.25, 0, 0],
    LeftArm:      [0.34,  0, 0],
    RightArm:     [0.34,  0, 0],
  },
  walk: {
    freq: 5.8,
    thighAxis: 'X',
    thigh: 0.52,
    thighSign: 1,
    knee: 1.23,
    kneeSign: -1,
    ankle: 0.35,
    hipSway: 0.05,
    armAxis: 'Z',
    armSwing: 0.22,
    armLag: 0.25,
    armSign: 1,
    armMirror: -1,
    elbowAxis: 'Z',
    elbowBend: 0.23,
    elbowSign: -1,
    elbowMirror: 1,
  },
  jump: {
    height: 0.45,
    speed: 5.0,
    pose: {
      LeftUpLeg:  [0.55,  0, 0],
      RightUpLeg: [-0.25, 0, 0],
      LeftLeg:    [-1.1,  0, 0],
      RightLeg:   [-0.45, 0, 0],
      LeftArm:    [0,     0, 0.42],
      RightArm:   [0,     0, 0.5],
    },
  },
};

const MAN_ANIM_CONFIG: CharacterAnimConfig = {
  idlePose: {
    LeftForeArm:  [0.54, 0.23, 0.32],
    RightForeArm: [0.61, 0.11, -0.2],
    LeftArm:      [0.04, 0, 0],
    RightArm:     [-0.01, 0, 0],
    LeftHand:     [0.35, 0, 0],
    RightHand:    [0.3, -0.69, 0],
  },
  walk: {
    freq: 5.8,
    thighAxis: 'X',
    thigh: 0.52,
    thighSign: 1,
    knee: 1.23,
    kneeSign: -1,
    ankle: 0.35,
    hipSway: 0.05,
    armAxis: 'Z',
    armSwing: 0.22,
    armLag: 0.25,
    armSign: 1,
    armMirror: -1,
    elbowAxis: 'Z',
    elbowBend: 0.23,
    elbowSign: -1,
    elbowMirror: 1,
  },
  jump: {
    height: 0.45,
    speed: 5.0,
    pose: {
      LeftUpLeg:  [0.55, 0, 0],
      RightUpLeg: [-0.25, 0, 0],
      LeftLeg:    [-1.1, 0, 0],
      RightLeg:   [-0.45, 0, 0],
      LeftArm:    [0, 0, -0.5],
      RightArm:   [0, 0, 0.5],
    },
  },
};

export class RemotePlayerAvatar {
  public group: THREE.Group;
  private nameplateSprite: THREE.Sprite;
  public modelRoot: THREE.Group | null = null;
  private shortName: string;
  private modelType: 'female' | 'man' = 'female';
  private animConfig: CharacterAnimConfig;

  // Mapa de articulaciones vinculadas
  private bones = new Map<string, BoneBinding>();

  // ---- Estado ----
  private targetPos = new THREE.Vector3();
  private targetRY = 0;
  private animState = 'idle';
  private timer = 0;
  private teamColor: string;

  // Vectores de eje reutilizables
  private static readonly AX = new THREE.Vector3(1, 0, 0);
  private static readonly AY = new THREE.Vector3(0, 1, 0);
  private static readonly AZ = new THREE.Vector3(0, 0, 1);
  private static readonly AXES: Record<string, THREE.Vector3> = {
    X: RemotePlayerAvatar.AX,
    Y: RemotePlayerAvatar.AY,
    Z: RemotePlayerAvatar.AZ,
  };

  // ---------------------------------------------------------------------------
  constructor(data: RemotePlayerData) {
    this.group = new THREE.Group();
    this.group.name = `RemoteAvatar_${data.userId}`;
    this.teamColor = data.teamColor || '#3b82f6';
    this.modelType = data.avatarModel === 'man' ? 'man' : 'female';
    this.animConfig = this.modelType === 'man' ? MAN_ANIM_CONFIG : FEMALE_ANIM_CONFIG;

    const parts = (data.fullName || '').trim().split(/\s+/);
    this.shortName = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0] || 'Jugador';

    this.nameplateSprite = this.buildNameplate(this.shortName, data.teamName, this.teamColor);
    this.nameplateSprite.position.set(0, 2.2, 0);
    this.group.add(this.nameplateSprite);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.45, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(this.teamColor), side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.04, 0);
    this.group.add(ring);

    this.group.position.set(data.x, data.y, data.z);
    this.group.rotation.y = data.ry;
    this.targetPos.set(data.x, data.y, data.z);
    this.targetRY = data.ry;

    this.loadModel(this.modelType);
  }

  // ---------------------------------------------------------------------------
  // Carga del modelo y mapeo de articulaciones
  // ---------------------------------------------------------------------------

  private async loadModel(modelType: string): Promise<void> {
    try {
      const root = await AvatarModelCache.get(modelType);
      this.modelRoot = root;
      root.rotation.y = Math.PI;

      let bonesFound = 0;
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
        }
        if ((child as THREE.Bone).isBone) {
          this.registerBone(child as THREE.Bone);
          bonesFound++;
        }
      });

      this.group.add(root);
      console.log(`[INFO] Avatar ${modelType} cargado (${bonesFound} huesos) para ${this.shortName}.`);
    } catch (err) {
      console.error(`[ERROR] Fallo al cargar avatar ${modelType}:`, err);
    }
  }

  private applyEulerOffset(baseQuat: THREE.Quaternion, [rx, ry, rz]: [number, number, number]): THREE.Quaternion {
    const q = baseQuat.clone();
    if (rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(RemotePlayerAvatar.AX, rx));
    if (ry) q.multiply(new THREE.Quaternion().setFromAxisAngle(RemotePlayerAvatar.AY, ry));
    if (rz) q.multiply(new THREE.Quaternion().setFromAxisAngle(RemotePlayerAvatar.AZ, rz));
    return q;
  }

  private registerBone(bone: THREE.Bone): void {
    const bind = bone.quaternion.clone();
    const idleOffset = this.animConfig.idlePose[bone.name] || [0, 0, 0];
    const idle = this.applyEulerOffset(bind, idleOffset);

    const jumpOffset = this.animConfig.jump.pose[bone.name] || [0, 0, 0];
    const jump = this.applyEulerOffset(idle, jumpOffset);

    const binding: BoneBinding = {
      bone,
      bindQuat: bind,
      idleQuat: idle,
      jumpQuat: jump,
    };

    this.bones.set(bone.name, binding);
  }

  private setAxisOffset(entry: BoneBinding | undefined, axis: THREE.Vector3, angle: number): void {
    if (!entry) return;
    entry.bone.quaternion
      .copy(entry.idleQuat)
      .multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  }

  private toIdle(entry: BoneBinding | undefined, alpha: number): void {
    if (!entry) return;
    entry.bone.quaternion.slerp(entry.idleQuat, alpha);
  }

  // ---------------------------------------------------------------------------
  // Ciclo de actualizacion
  // ---------------------------------------------------------------------------

  public updateData(data: { x: number; y: number; z: number; ry: number; animState?: string }): void {
    this.targetPos.set(data.x, data.y, data.z);
    this.targetRY = data.ry;
    if (data.animState) this.animState = data.animState;
  }

  public update(delta: number): void {
    // Interpolacion de posicion
    this.group.position.lerp(this.targetPos, Math.min(1, delta * 12));

    // Interpolacion de rotacion Y
    let dr = this.targetRY - this.group.rotation.y;
    while (dr < -Math.PI) dr += Math.PI * 2;
    while (dr >  Math.PI) dr -= Math.PI * 2;
    this.group.rotation.y += dr * Math.min(1, delta * 14);

    if (this.animState === 'walk' || this.animState === 'run') {
      this.walk(delta);
    } else if (this.animState === 'jump') {
      this.jump(delta);
    } else {
      this.idle(delta);
    }
  }

  // ---------------------------------------------------------------------------
  // Animacion de Caminar / Correr
  // ---------------------------------------------------------------------------

  private applyLeg(phase: number, bUpLeg: BoneBinding | undefined, bLeg: BoneBinding | undefined, bFoot: BoneBinding | undefined, mult = 1): void {
    const cfg = this.animConfig.walk;
    const thighAxis = RemotePlayerAvatar.AXES[cfg.thighAxis] || RemotePlayerAvatar.AX;
    const st = Math.sin(phase);

    const thigh = cfg.thighSign * st * cfg.thigh * mult;
    const swing = Math.max(0, st);
    const knee = cfg.kneeSign * swing * swing * cfg.knee * mult;
    const stance = Math.max(0, -Math.sin(phase - 0.3));
    const ankle = -(stance * cfg.ankle);

    this.setAxisOffset(bUpLeg, thighAxis, thigh);
    this.setAxisOffset(bLeg, RemotePlayerAvatar.AX, knee);
    this.setAxisOffset(bFoot, RemotePlayerAvatar.AX, ankle);
  }

  private applyArm(
    phase: number,
    bShoulder: BoneBinding | undefined,
    bArm: BoneBinding | undefined,
    bForeArm: BoneBinding | undefined,
    isRight: boolean,
    mult = 1
  ): void {
    const cfg = this.animConfig.walk;
    const armAxis = RemotePlayerAvatar.AXES[cfg.armAxis] || RemotePlayerAvatar.AZ;
    const elbowAxis = RemotePlayerAvatar.AXES[cfg.elbowAxis] || RemotePlayerAvatar.AZ;

    const delayedPhase = phase - cfg.armLag;
    const dir = cfg.armSign * (isRight ? 1 : cfg.armMirror);
    const armAngle = dir * Math.sin(delayedPhase) * cfg.armSwing * mult;

    if (bShoulder) this.setAxisOffset(bShoulder, armAxis, armAngle * 0.15);
    this.setAxisOffset(bArm, armAxis, armAngle);

    const forwardSwing = Math.max(0, Math.sin(delayedPhase));
    const elbowDir = cfg.elbowSign * (isRight ? 1 : cfg.elbowMirror);
    const elbowAngle = elbowDir * forwardSwing * cfg.elbowBend * mult;
    this.setAxisOffset(bForeArm, elbowAxis, elbowAngle);
  }

  private walk(delta: number): void {
    const cfg = this.animConfig.walk;
    const mult = this.animState === 'run' ? 1.45 : 1.0;
    this.timer += delta * cfg.freq * mult;
    const t = this.timer;

    if (this.modelRoot) {
      this.modelRoot.position.y = THREE.MathUtils.lerp(this.modelRoot.position.y, 0, delta * 10);
    }

    const hips = this.bones.get('Hips');
    const spine2 = this.bones.get('Spine2');
    this.setAxisOffset(hips, RemotePlayerAvatar.AZ, Math.sin(t * 2) * cfg.hipSway);
    this.setAxisOffset(spine2, RemotePlayerAvatar.AZ, -Math.sin(t) * 0.035);

    this.applyLeg(t, this.bones.get('LeftUpLeg'), this.bones.get('LeftLeg'), this.bones.get('LeftFoot'), mult);
    this.applyLeg(t + Math.PI, this.bones.get('RightUpLeg'), this.bones.get('RightLeg'), this.bones.get('RightFoot'), mult);
    this.applyArm(t + Math.PI, this.bones.get('LeftShoulder'), this.bones.get('LeftArm'), this.bones.get('LeftForeArm'), false, mult);
    this.applyArm(t, this.bones.get('RightShoulder'), this.bones.get('RightArm'), this.bones.get('RightForeArm'), true, mult);
  }

  // ---------------------------------------------------------------------------
  // Animacion de Salto (JUMP)
  // ---------------------------------------------------------------------------

  private jump(delta: number): void {
    const cfg = this.animConfig.jump;
    this.timer += delta * cfg.speed;
    const jumpArc = Math.abs(Math.sin(this.timer));

    if (this.modelRoot) {
      this.modelRoot.position.y = jumpArc * cfg.height;
    }

    this.bones.forEach((entry) => {
      entry.bone.quaternion.copy(entry.idleQuat).slerp(entry.jumpQuat, jumpArc);
    });
  }

  // ---------------------------------------------------------------------------
  // Postura de Reposo (IDLE)
  // ---------------------------------------------------------------------------

  private idle(delta: number): void {
    if (this.modelRoot) {
      this.modelRoot.position.y = THREE.MathUtils.lerp(this.modelRoot.position.y, 0, delta * 10);
    }

    const alpha = Math.min(1, delta * 10);
    this.bones.forEach((entry) => {
      this.toIdle(entry, alpha);
    });

    this.timer *= 0.9;
  }

  // ---------------------------------------------------------------------------
  // Nameplate
  // ---------------------------------------------------------------------------

  private buildNameplate(name: string, team: string, color: string): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 96;
    const ctx = cv.getContext('2d')!;

    this.rr(ctx, 10, 10, 300, 76, 12);
    ctx.fillStyle = 'rgba(15,23,42,0.88)';
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    this.rr(ctx, 10, 10, 300, 76, 12);
    ctx.stroke();

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(name, 160, 44);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(team, 160, 70);

    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(2.4, 0.72, 1);
    return sp;
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---------------------------------------------------------------------------
  // Dispose
  // ---------------------------------------------------------------------------

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat?.dispose());
      }
    });
    this.nameplateSprite.material.map?.dispose();
    this.nameplateSprite.material.dispose();
  }
}
