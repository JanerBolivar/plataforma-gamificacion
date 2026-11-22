import * as THREE from 'three';
import { StaticGeometryGenerator, MeshBVH } from 'three-mesh-bvh';
import { PlayerController } from './PlayerController';

/**
 * Escenario 3D base para la fase "Circo" (arena delimitada de 50 x 50 unidades).
 */
export class CircoScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private playerController: PlayerController;
  private colliderMesh: THREE.Mesh | null = null;

  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  private boundOnResize: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.lastTime = performance.now();

    // 1. Escena y atmosfera de carpa de circo
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a102a);
    this.scene.fog = new THREE.FogExp2(0x1a102a, 0.018);

    // 2. Camara
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );

    // 3. Renderer optimizado
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    // 4. Iluminacion tematica de arena
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x2d1838, 1.3);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffe0b2, 1.1);
    dirLight.position.set(15, 30, 15);
    this.scene.add(dirLight);

    // Foco central tenue en la pista
    const centerSpot = new THREE.PointLight(0xffd54f, 1.5, 35);
    centerSpot.position.set(0, 12, 0);
    this.scene.add(centerSpot);

    // 5. Construccion del entorno y colisiones BVH
    this.buildArenaEnvironment();

    // 6. Controlador en primera persona
    this.playerController = new PlayerController(this.camera, this.renderer.domElement);
    this.playerController.setColliderMesh(this.colliderMesh);
    this.playerController.setPosition(new THREE.Vector3(0, 1.0, 15));

    this.boundOnResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundOnResize);

    this.animate();
  }

  private buildArenaEnvironment(): void {
    const collidersGroup = new THREE.Group();

    // 1. Suelo de la arena (50 x 50 metros)
    const floorGeo = new THREE.PlaneGeometry(50, 50, 16, 16);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x4a1828, // Rojo arena oscuro de carpa
      roughness: 0.85,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0, 0);
    this.scene.add(floorMesh);
    collidersGroup.add(floorMesh.clone(false));

    // Pista circular central decorativa
    const ringGeo = new THREE.RingGeometry(8, 9, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0.02, 0);
    this.scene.add(ringMesh);

    // 2. Muros perimetrales (50 x 50 delimitados con altura 8m)
    const wallHeight = 8;
    const wallThickness = 2;
    const wallLength = 50;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x311b38,
      roughness: 0.7,
    });

    const createWall = (x: number, z: number, w: number, d: number) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, wallHeight / 2, z);
      this.scene.add(mesh);
      collidersGroup.add(mesh.clone(false));
    };

    // Muro Norte (z = -25)
    createWall(0, -25, wallLength, wallThickness);
    // Muro Sur (z = +25)
    createWall(0, 25, wallLength, wallThickness);
    // Muro Oeste (x = -25)
    createWall(-25, 0, wallThickness, wallLength);
    // Muro Este (x = +25)
    createWall(25, 0, wallThickness, wallLength);

    // Generar arbol BVH consolidado
    try {
      const generator = new StaticGeometryGenerator(collidersGroup);
      generator.attributes = ['position'];
      const mergedGeo = generator.generate();
      mergedGeo.boundsTree = new MeshBVH(mergedGeo, { targetLeafSize: 10 });
      this.colliderMesh = new THREE.Mesh(mergedGeo);
      console.log('[INFO] BVH generado para el escenario Circo (50x50).');
    } catch (err) {
      console.error('[ERROR] Error al generar BVH del Circo:', err);
    }
  }

  private onWindowResize(): void {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate(): void {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.playerController.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  public getPlayerController(): PlayerController {
    return this.playerController;
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.boundOnResize);
    this.playerController.dispose();

    if (this.colliderMesh) {
      this.colliderMesh.geometry.dispose();
      this.colliderMesh = null;
    }

    this.scene.traverse((obj) => {
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

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
