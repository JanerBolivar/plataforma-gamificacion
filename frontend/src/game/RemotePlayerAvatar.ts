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
 * Cache global de prototipos GLB para modelos de personajes humanoides.
 * Utiliza SkeletonUtils.clone para replicar correctamente las jerarquias
 * de esqueletos y SkinnedMesh de Three.js.
 */
class AvatarModelCache {
  private static loader = new GLTFLoader();
  private static cache = new Map<string, THREE.Group>();
  private static loadingPromises = new Map<string, Promise<THREE.Group>>();

  public static async getModel(modelType: string): Promise<THREE.Group> {
    const filename = modelType === 'man' ? 'man_boddy.glb' : 'female_boddy.glb';
    const url = `/models/pj/${filename}`;

    let template = this.cache.get(url);
    if (!template) {
      if (this.loadingPromises.has(url)) {
        template = await this.loadingPromises.get(url)!;
      } else {
        const promise = new Promise<THREE.Group>((resolve, reject) => {
          this.loader.load(
            url,
            (gltf) => {
              this.cache.set(url, gltf.scene);
              this.loadingPromises.delete(url);
              resolve(gltf.scene);
            },
            undefined,
            (err) => {
              this.loadingPromises.delete(url);
              reject(err);
            }
          );
        });
        this.loadingPromises.set(url, promise);
        template = await promise;
      }
    }

    // Es fundamental utilizar SkeletonUtils.clone para que cada instancia
    // posea sus propios huesos vinculados a su propia SkinnedMesh.
    const cloned = SkeletonUtils.clone(template) as THREE.Group;
    return cloned;
  }
}

/**
 * Representa y anima el avatar humanoide 3D de un jugador remoto conectado a la sala.
 */
export class RemotePlayerAvatar {
  public group: THREE.Group;
  private nameplateSprite: THREE.Sprite;
  public modelRoot: THREE.Group | null = null;
  private shortName: string;

  // Huesos de las extremidades y sus cuaterniones de descanso para animacion procedural
  private leftArmBone: THREE.Bone | null = null;
  private rightArmBone: THREE.Bone | null = null;
  private leftLegBone: THREE.Bone | null = null;
  private rightLegBone: THREE.Bone | null = null;

  private leftArmRestQuat = new THREE.Quaternion();
  private rightArmRestQuat = new THREE.Quaternion();
  private leftLegRestQuat = new THREE.Quaternion();
  private rightLegRestQuat = new THREE.Quaternion();

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;
  private currentAnimState: string = 'idle';
  private animTimer: number = 0;
  private teamColor: string;

  constructor(data: RemotePlayerData) {
    this.group = new THREE.Group();
    this.group.name = `RemoteAvatar_${data.userId}`;
    this.teamColor = data.teamColor || '#3b82f6';

    // 1. Etiqueta flotante con Primer Nombre y Primer Apellido
    const nameParts = (data.fullName || '').trim().split(/\s+/);
    this.shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1]}` : (nameParts[0] || 'Jugador');
    this.nameplateSprite = this.createNameplate(this.shortName, data.teamName, this.teamColor);
    // Posicionada sobre la cabeza (~2.15m de altura)
    this.nameplateSprite.position.set(0, 2.15, 0);
    this.group.add(this.nameplateSprite);

    // 2. Anillo indicador luminoso en los pies con el color del equipo
    const ringGeo = new THREE.RingGeometry(0.35, 0.45, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.teamColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.04, 0);
    this.group.add(ringMesh);

    // 3. Posicion inicial del grupo
    this.group.position.set(data.x, data.y, data.z);
    this.group.rotation.y = data.ry;
    this.targetPosition.set(data.x, data.y, data.z);
    this.targetRotationY = data.ry;

    // 4. Cargar e integrar el modelo GLB humanoide correspondiente
    this.loadCharacterModel(data.avatarModel || 'female');
  }

  private async loadCharacterModel(modelType: string): Promise<void> {
    try {
      const character = await AvatarModelCache.getModel(modelType);
      this.modelRoot = character;

      // Orientar el modelo hacia el frente (+Z en glTF a -Z en Three.js forward)
      character.rotation.y = Math.PI;

      // Habilitar sombras y deshabilitar frustum culling en mallas con skinning
      character.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false; // Esencial para evitar desaparicion de SkinnedMesh
        }

        // Mapear huesos del esqueleto estándar para locomocion procedural
        if ((child as THREE.Bone).isBone) {
          const bone = child as THREE.Bone;
          const name = bone.name.toLowerCase();
          if (name.includes('leftarm') && !name.includes('fore')) {
            this.leftArmBone = bone;
            this.leftArmRestQuat.copy(bone.quaternion);
          } else if (name.includes('rightarm') && !name.includes('fore')) {
            this.rightArmBone = bone;
            this.rightArmRestQuat.copy(bone.quaternion);
          } else if (name.includes('leftupleg') || (name.includes('left') && name.includes('thigh'))) {
            this.leftLegBone = bone;
            this.leftLegRestQuat.copy(bone.quaternion);
          } else if (name.includes('rightupleg') || (name.includes('right') && name.includes('thigh'))) {
            this.rightLegBone = bone;
            this.rightLegRestQuat.copy(bone.quaternion);
          }
        }
      });

      this.group.add(character);
      console.log(`[INFO] Modelo humanoide ${modelType} anadido exitosamente al avatar de ${this.shortName}.`);
    } catch (err) {
      console.error(`[ERROR] No se pudo cargar modelo humanoide ${modelType}:`, err);
    }
  }

  private createNameplate(fullName: string, teamName: string, teamColor: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // Fondo semitransparente con esquinas redondeadas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.roundRect(ctx, 10, 10, 300, 76, 12);
    ctx.fill();

    // Borde fino del color del equipo
    ctx.strokeStyle = teamColor || '#38bdf8';
    ctx.lineWidth = 3;
    this.roundRect(ctx, 10, 10, 300, 76, 12);
    ctx.stroke();

    // Nombre y Apellido
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(fullName, 160, 44);

    // Nombre del Equipo
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = teamColor || '#38bdf8';
    ctx.fillText(teamName, 160, 70);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.72, 1);
    return sprite;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  public updateData(data: { x: number; y: number; z: number; ry: number; animState?: string }): void {
    this.targetPosition.set(data.x, data.y, data.z);
    this.targetRotationY = data.ry;
    if (data.animState) {
      this.currentAnimState = data.animState;
    }
  }

  public update(delta: number): void {
    // 1. Interpolacion suave hacia la posicion objetivo
    this.group.position.lerp(this.targetPosition, Math.min(1.0, delta * 12));

    // 2. Interpolacion de rotacion en eje Y
    let diffRot = this.targetRotationY - this.group.rotation.y;
    while (diffRot < -Math.PI) diffRot += Math.PI * 2;
    while (diffRot > Math.PI) diffRot -= Math.PI * 2;
    this.group.rotation.y += diffRot * Math.min(1.0, delta * 14);

    // 3. Animacion de locomocion mediante cuaterniones relativos al estado de reposo
    if (this.currentAnimState === 'walk' || this.currentAnimState === 'run') {
      const speedFactor = this.currentAnimState === 'run' ? 14 : 8;
      const amplitude = this.currentAnimState === 'run' ? 0.45 : 0.25;

      this.animTimer += delta * speedFactor;
      const swing = Math.sin(this.animTimer) * amplitude;

      const swingArmQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), swing);
      const invArmQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -swing);
      const swingLegQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -swing * 0.7);
      const invLegQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), swing * 0.7);

      if (this.leftArmBone) {
        this.leftArmBone.quaternion.copy(this.leftArmRestQuat).multiply(swingArmQuat);
      }
      if (this.rightArmBone) {
        this.rightArmBone.quaternion.copy(this.rightArmRestQuat).multiply(invArmQuat);
      }
      if (this.leftLegBone) {
        this.leftLegBone.quaternion.copy(this.leftLegRestQuat).multiply(swingLegQuat);
      }
      if (this.rightLegBone) {
        this.rightLegBone.quaternion.copy(this.rightLegRestQuat).multiply(invLegQuat);
      }
    } else {
      // Estado idle: regresar suavemente a postura neutra original
      const lerpSpeed = Math.min(1.0, delta * 8);
      if (this.leftArmBone) this.leftArmBone.quaternion.slerp(this.leftArmRestQuat, lerpSpeed);
      if (this.rightArmBone) this.rightArmBone.quaternion.slerp(this.rightArmRestQuat, lerpSpeed);
      if (this.leftLegBone) this.leftLegBone.quaternion.slerp(this.leftLegRestQuat, lerpSpeed);
      if (this.rightLegBone) this.rightLegBone.quaternion.slerp(this.rightLegRestQuat, lerpSpeed);
    }
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    if (this.nameplateSprite.material.map) {
      this.nameplateSprite.material.map.dispose();
    }
    this.nameplateSprite.material.dispose();
  }
}
