import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { AudioManager, FootstepSurface } from './AudioManager';

const DEV_PLAYER_POS_STORAGE_KEY = 'gamificacion_dev_player_pos';

/**
 * Controlador en primera persona con fisica y colisiones precisas basadas en three-mesh-bvh.
 */
export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Estado de posicion y movimiento
  public position: THREE.Vector3 = new THREE.Vector3(12.5, 3.9, 90);
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private isGrounded: boolean = false;
  private playerHeight: number = 1.75;
  private playerRadius: number = 0.4;

  // Capsula geometrica para colisiones precisas
  private capsule: Capsule;

  // Malla BVH de colisiones del mundo
  private colliderMesh: THREE.Mesh | null = null;

  // Gestor de audio procedural
  private audioManager: AudioManager | null = null;
  private stepDistance: number = 0;
  private isRunning: boolean = false;

  // Rotaciones de camara
  private pitch: number = 0;
  private yaw: number = 0;
  private isLocked: boolean = false;

  // Deshabilitacion temporal durante edicion en modo editor o menu de pausa
  public isEditorActive: boolean = false;
  public isMenuOpen: boolean = false;

  // Flag de persistencia en desarrollo
  public hasLoadedDevPosition: boolean = false;
  private devSaveTimer: number = 0;

  // Teclado
  private keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyE: false,
    ShiftLeft: false,
    ShiftRight: false,
  };

  // Parametros fisicos
  private walkSpeed: number = 13.0;
  private runSpeed: number = 19.5;
  private jumpForce: number = 9.0;
  private gravity: number = 26.0;

  // Listeners
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnPointerLockChange: () => void;

  public onInteractPressed?: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Inicializar capsula centrada en la posicion
    this.capsule = new Capsule(
      new THREE.Vector3(this.position.x, this.position.y + this.playerRadius, this.position.z),
      new THREE.Vector3(this.position.x, this.position.y + this.playerHeight - this.playerRadius, this.position.z),
      this.playerRadius
    );

    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnPointerLockChange = this.onPointerLockChange.bind(this);

    if (import.meta.env.DEV) {
      this.hasLoadedDevPosition = this.loadDevPosition();
    }

    this.attachEventListeners();
    this.syncCapsuleToPosition();
    this.updateCameraTransform();
  }

  private loadDevPosition(): boolean {
    try {
      const raw = localStorage.getItem(DEV_PLAYER_POS_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.x === 'number' && typeof data.y === 'number' && typeof data.z === 'number') {
          this.position.set(data.x, data.y, data.z);
          if (typeof data.yaw === 'number') this.yaw = data.yaw;
          if (typeof data.pitch === 'number') this.pitch = data.pitch;
          this.syncCapsuleToPosition();
          this.updateCameraTransform();
          console.log('[INFO] Posicion restaurada en desarrollo:', this.position);
          return true;
        }
      }
    } catch {
      // Ignorar lectura corrupta
    }
    return false;
  }

  private saveDevPosition(): void {
    if (!import.meta.env.DEV) return;
    try {
      const payload = {
        x: Number(this.position.x.toFixed(2)),
        y: Number(this.position.y.toFixed(2)),
        z: Number(this.position.z.toFixed(2)),
        yaw: Number(this.yaw.toFixed(3)),
        pitch: Number(this.pitch.toFixed(3)),
      };
      localStorage.setItem(DEV_PLAYER_POS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar
    }
  }

  public resetSpawnPosition(defaultPos: THREE.Vector3 = new THREE.Vector3(12.5, 3.9, 90)): void {
    if (import.meta.env.DEV) {
      try {
        localStorage.removeItem(DEV_PLAYER_POS_STORAGE_KEY);
      } catch {
        // Ignorar
      }
    }
    this.position.copy(defaultPos);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.hasLoadedDevPosition = false;
    this.syncCapsuleToPosition();
    this.updateCameraTransform();
    console.log('[INFO] Posicion del jugador restablecida al spawn.');
  }

  private syncCapsuleToPosition(): void {
    this.capsule.start.set(
      this.position.x,
      this.position.y + this.playerRadius,
      this.position.z
    );
    this.capsule.end.set(
      this.position.x,
      this.position.y + this.playerHeight - this.playerRadius,
      this.position.z
    );
  }

  private attachEventListeners(): void {
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('pointerlockchange', this.boundOnPointerLockChange);

    this.domElement.addEventListener('click', () => {
      this.audioManager?.resume();
      // Solo solicitar pointer lock si el editor de mapa y el menu no estan abiertos
      if (!this.isLocked && !this.isEditorActive && !this.isMenuOpen) {
        this.domElement.requestPointerLock();
      }
    });
  }

  /**
   * Libera el puntero del raton para permitir la interaccion con menus y botones.
   */
  public unlockPointer(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.isLocked = false;
  }

  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.audioManager?.resume();
    if (this.keys[e.code] !== undefined) {
      this.keys[e.code] = true;
    }
    if (e.code === 'KeyE') {
      if (this.onInteractPressed) {
        this.onInteractPressed();
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (this.keys[e.code] !== undefined) {
      this.keys[e.code] = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isLocked || this.isEditorActive || this.isMenuOpen) return;

    const sensitivity = 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;

    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.updateCameraTransform();
  }

  private updateCameraTransform(): void {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;

    this.camera.quaternion.setFromEuler(euler);
    this.camera.position.set(this.position.x, this.position.y + 1.6, this.position.z);
  }

  public setColliderMesh(mesh: THREE.Mesh | null): void {
    this.colliderMesh = mesh;
  }

  public setAudioManager(am: AudioManager): void {
    this.audioManager = am;
  }

  /**
   * Identifica la superficie que esta pisando el jugador segun su ubicacion y altura.
   */
  public getFootstepSurface(): FootstepSurface {
    // Si esta en o por debajo del nivel del agua (0.05 con margen hasta 0.12m)
    if (this.position.y <= 0.12) {
      return 'water';
    }

    // Si esta sobre el entarimado o escalones de madera de Sala_Bienvenida
    if (
      this.position.x >= -17.5 &&
      this.position.x <= 17.5 &&
      this.position.z >= 41.5 &&
      this.position.z <= 93.5 &&
      this.position.y >= 2.2
    ) {
      return 'wood';
    }

    // Si esta en la plataforma elevada o interior de Choza Alta
    if (
      this.position.x >= -75.0 &&
      this.position.x <= -45.0 &&
      this.position.z >= -60.0 &&
      this.position.z <= -30.0 &&
      this.position.y >= 3.2
    ) {
      return 'wood';
    }

    // Si esta en el entarimado de Choza Baja
    if (
      this.position.x >= 50.0 &&
      this.position.x <= 80.0 &&
      this.position.z >= -15.0 &&
      this.position.z <= 15.0 &&
      this.position.y >= 1.5
    ) {
      return 'wood';
    }

    // Terreno natural de pasto y tierra
    return 'grass';
  }

  /**
   * Actualiza el movimiento del jugador resolviendo colisiones mediante MeshBVH.
   */
  public update(delta: number): void {
    // Si el menu esta abierto o el editor esta manipulando un objeto, pausar movimiento
    if (this.isMenuOpen || (this.isEditorActive && !this.isLocked)) {
      return;
    }

    const prevX = this.position.x;
    const prevZ = this.position.z;
    const prevGrounded = this.isGrounded;

    // Detectar si el jugador corre con Shift
    this.isRunning = this.keys.ShiftLeft || this.keys.ShiftRight;
    const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;

    const moveX = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
    const moveZ = (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) - (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    const inputDirection = new THREE.Vector3()
      .addScaledVector(forward, -moveZ)
      .addScaledVector(right, moveX);

    if (inputDirection.lengthSq() > 0) {
      inputDirection.normalize();
    }

    // Salto con sonido
    if (this.keys.Space && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.audioManager?.playJump();
    }

    // Aplicar gravedad
    this.velocity.y -= this.gravity * delta;

    // Velocidad horizontal con control reactivo
    const targetHorizVel = inputDirection.multiplyScalar(currentSpeed);
    const damping = this.isGrounded ? 16.0 : 4.0;
    this.velocity.x += (targetHorizVel.x - this.velocity.x) * Math.min(1.0, damping * delta);
    this.velocity.z += (targetHorizVel.z - this.velocity.z) * Math.min(1.0, damping * delta);

    // Reiniciar flag de suelo antes de evaluar colisiones
    this.isGrounded = false;

    // Ejecutar subpasos de colision para estabilidad frente a geometrias inclinadas y escaleras
    const subSteps = 3;
    const deltaStep = delta / subSteps;

    for (let step = 0; step < subSteps; step++) {
      // 1. Desplazar la capsula segun la velocidad actual del subpaso
      this.capsule.translate(new THREE.Vector3().copy(this.velocity).multiplyScalar(deltaStep));

      // 2. Resolver colisiones contra la malla de triangulos con BVH
      if (this.colliderMesh && this.colliderMesh.geometry.boundsTree) {
        const playerBox = new THREE.Box3();
        playerBox.makeEmpty();
        playerBox.expandByPoint(this.capsule.start);
        playerBox.expandByPoint(this.capsule.end);
        playerBox.min.addScalar(-this.capsule.radius);
        playerBox.max.addScalar(this.capsule.radius);

        const lineSegment = new THREE.Line3(this.capsule.start, this.capsule.end);

        this.colliderMesh.geometry.boundsTree.shapecast({
          intersectsBounds: (box) => box.intersectsBox(playerBox),
          intersectsTriangle: (tri) => {
            const triPoint = new THREE.Vector3();
            const capsulePoint = new THREE.Vector3();
            const distance = tri.closestPointToSegment(lineSegment, triPoint, capsulePoint);

            if (distance < this.capsule.radius) {
              const depth = this.capsule.radius - distance;
              const dir = capsulePoint.sub(triPoint).normalize();

              // Extraer la capsula de la penetracion
              this.capsule.start.addScaledVector(dir, depth);
              this.capsule.end.addScaledVector(dir, depth);
              lineSegment.start.copy(this.capsule.start);
              lineSegment.end.copy(this.capsule.end);

              playerBox.min.addScaledVector(dir, depth);
              playerBox.max.addScaledVector(dir, depth);

              // Detectar suelo (normal hacia arriba)
              if (dir.y > 0.45) {
                this.isGrounded = true;
                if (this.velocity.y < 0) {
                  this.velocity.y = 0;
                }
              } else if (dir.y < -0.3) {
                // Choque con techo
                if (this.velocity.y > 0) {
                  this.velocity.y = 0;
                }
              }

              // Proyectar velocidad sobre el plano tangente para deslizamiento suave
              const normalVel = this.velocity.dot(dir);
              if (normalVel < 0) {
                this.velocity.addScaledVector(dir, -normalVel);
              }
            }
          },
        });
      }
    }

    // Sincronizar posicion del jugador con la base de la capsula
    this.position.copy(this.capsule.start);
    this.position.y -= this.playerRadius;

    // Detectar sonido de aterrizaje al tocar suelo
    if (!prevGrounded && this.isGrounded) {
      this.audioManager?.playLand(this.getFootstepSurface());
    }

    // Reproduccion de pisadas por distancia horizontal recorrida
    if (this.isGrounded) {
      const movedDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
      if (movedDist > 0.001) {
        this.stepDistance += movedDist;
        const stepThreshold = this.isRunning ? 2.1 : 2.5;

        if (this.stepDistance >= stepThreshold) {
          this.stepDistance = 0;
          this.audioManager?.playFootstep(this.getFootstepSurface(), this.isRunning);
        }
      }
    } else {
      this.stepDistance = 0;
    }

    // Limites perimetrales y rescate de emergencia en caso de caida al agua o escape por fallos
    const maxBoundary = 119.0;
    if (
      Math.abs(this.position.x) > maxBoundary ||
      Math.abs(this.position.z) > maxBoundary ||
      this.position.y < -4.0 ||
      this.position.y > 55.0
    ) {
      console.warn('[WARN] Jugador fuera de los limites permitidos del mapa. Reubicando al punto de inicio.');
      this.resetSpawnPosition();
    }

    this.updateCameraTransform();

    // Guardado periodico en desarrollo
    if (import.meta.env.DEV) {
      this.devSaveTimer += delta;
      if (this.devSaveTimer >= 0.3) {
        this.devSaveTimer = 0;
        this.saveDevPosition();
      }
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getAnimationState(): 'idle' | 'walk' | 'run' | 'jump' {
    if (!this.isGrounded) {
      return 'jump';
    }
    const isMoving =
      this.keys.KeyW ||
      this.keys.KeyS ||
      this.keys.KeyA ||
      this.keys.KeyD ||
      this.keys.ArrowUp ||
      this.keys.ArrowDown ||
      this.keys.ArrowLeft ||
      this.keys.ArrowRight;

    if (!isMoving) {
      return 'idle';
    }
    return this.isRunning ? 'run' : 'walk';
  }

  public setPosition(pos: THREE.Vector3): void {
    this.position.copy(pos);
    this.syncCapsuleToPosition();
    this.updateCameraTransform();
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('pointerlockchange', this.boundOnPointerLockChange);
  }
}
