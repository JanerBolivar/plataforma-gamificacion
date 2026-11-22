import * as THREE from 'three';

export interface RemotePlayerData {
  userId: string;
  fullName: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  animState: string;
}

/**
 * Representa y anima el avatar tridimensional de un jugador remoto conectado en la sala.
 */
export class RemotePlayerAvatar {
  public group: THREE.Group;
  private head: THREE.Mesh;
  private torso: THREE.Mesh;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private nameplateSprite: THREE.Sprite;

  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetRotationY: number = 0;
  private currentAnimState: string = 'idle';
  private animTimer: number = 0;

  constructor(data: RemotePlayerData) {
    this.group = new THREE.Group();
    this.group.name = `RemoteAvatar_${data.userId}`;

    const color = new THREE.Color(data.teamColor || '#3b82f6');
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5d0b0, roughness: 0.6 });
    const clothesMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.28);
    this.torso = new THREE.Mesh(torsoGeo, clothesMat);
    this.torso.position.set(0, 1.15, 0);
    this.group.add(this.torso);

    // 2. Cabeza
    const headGeo = new THREE.SphereGeometry(0.24, 12, 10);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.set(0, 1.68, 0);
    this.group.add(this.head);

    // 3. Brazo izquierdo (con pivote en el hombro)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.35, 1.45, 0);
    const armGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
    leftArmMesh.position.set(0, -0.26, 0);
    this.leftArmPivot.add(leftArmMesh);
    this.group.add(this.leftArmPivot);

    // 4. Brazo derecho (con pivote en el hombro)
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.35, 1.45, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
    rightArmMesh.position.set(0, -0.26, 0);
    this.rightArmPivot.add(rightArmMesh);
    this.group.add(this.rightArmPivot);

    // 5. Pierna izquierda (con pivote en la cadera)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.16, 0.82, 0);
    const legGeo = new THREE.BoxGeometry(0.18, 0.64, 0.18);
    const leftLegMesh = new THREE.Mesh(legGeo, limbMat);
    leftLegMesh.position.set(0, -0.32, 0);
    this.leftLegPivot.add(leftLegMesh);
    this.group.add(this.leftLegPivot);

    // 6. Pierna derecha (con pivote en la cadera)
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.16, 0.82, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, limbMat);
    rightLegMesh.position.set(0, -0.32, 0);
    this.rightLegPivot.add(rightLegMesh);
    this.group.add(this.rightLegPivot);

    // 7. Etiqueta flotante con Nombre y Equipo (Primer Nombre y Primer Apellido)
    const nameParts = (data.fullName || '').trim().split(/\s+/);
    const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1]}` : (nameParts[0] || 'Jugador');
    this.nameplateSprite = this.createNameplate(shortName, data.teamName, data.teamColor);
    this.nameplateSprite.position.set(0, 2.25, 0);
    this.group.add(this.nameplateSprite);

    // Posicion inicial
    this.group.position.set(data.x, data.y, data.z);
    this.group.rotation.y = data.ry;
    this.targetPosition.set(data.x, data.y, data.z);
    this.targetRotationY = data.ry;
  }

  private createNameplate(fullName: string, teamName: string, teamColor: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // Fondo semitransparente con esquinas redondeadas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
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

    // 3. Animacion procedural de extremidades
    if (this.currentAnimState === 'walk' || this.currentAnimState === 'run') {
      const speedFactor = this.currentAnimState === 'run' ? 14 : 8;
      const amplitude = this.currentAnimState === 'run' ? 0.7 : 0.42;

      this.animTimer += delta * speedFactor;
      const swing = Math.sin(this.animTimer) * amplitude;

      this.leftArmPivot.rotation.x = swing;
      this.rightArmPivot.rotation.x = -swing;
      this.leftLegPivot.rotation.x = -swing;
      this.rightLegPivot.rotation.x = swing;
    } else if (this.currentAnimState === 'jump') {
      this.leftArmPivot.rotation.x = -0.8;
      this.rightArmPivot.rotation.x = -0.8;
      this.leftLegPivot.rotation.x = 0.4;
      this.rightLegPivot.rotation.x = 0.2;
    } else {
      // Estado idle: volver suavemente a postura neutra
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, 0, delta * 8);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, 0, delta * 8);
      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0, delta * 8);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0, delta * 8);
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
