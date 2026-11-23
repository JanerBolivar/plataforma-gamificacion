import * as THREE from 'three';
import { WorldBuilder, WorldBuildProgress } from './WorldBuilder';
import { PlayerController } from './PlayerController';
import { MapEditor } from './MapEditor';
import { AudioManager } from './AudioManager';

/**
 * Escenario 3D interactivo para la fase "Circo" (isla flotante sobre el oceano con carpa de circo).
 */
export class CircoScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private worldBuilder: WorldBuilder;
  private playerController: PlayerController;
  private mapEditor: MapEditor | null = null;
  private audioManager: AudioManager;

  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  private boundOnResize: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.lastTime = performance.now();

    // 1. Escena y atmosfera crepuscular sobre el oceano de la isla flotante
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x0a1424);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0x0a1424, 0.0035);

    // 2. Camara en perspectiva
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );

    // 3. Renderer optimizado con alto rendimiento
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    // 4. Iluminacion tematica de noche festiva en el circo
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f2b48, 1.3);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.3);
    dirLight.position.set(80, 150, 70);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x1e3a8a, 0.7);
    fillLight.position.set(-80, 70, -70);
    this.scene.add(fillLight);

    // Foco calido central dentro/delante de la carpa
    const tentSpot = new THREE.PointLight(0xfbbf24, 2.2, 100);
    tentSpot.position.set(35.5, 15, -44.0);
    this.scene.add(tentSpot);

    // Foco de bienvenida en la entrada del puente de madera
    const bridgeSpot = new THREE.PointLight(0xf59e0b, 1.6, 50);
    bridgeSpot.position.set(35.0, 0.0, 10.0);
    this.scene.add(bridgeSpot);

    // 5. Inicializar WorldBuilder para escenario Circo
    this.worldBuilder = new WorldBuilder(this.scene, null, {
      mapName: 'circo',
      mapUrl: '/maps/circo-map.json',
      modelsBasePath: '/models/circo/',
    });

    // 6. Audio procedural y controlador de jugador en primera persona
    this.audioManager = new AudioManager();
    this.playerController = new PlayerController(this.camera, this.renderer.domElement);
    this.playerController.setAudioManager(this.audioManager);
    this.playerController.setSurfaceConfig('wood', -68.0);
    this.playerController.setStorageKey('gamificacion_circo_dev_player_pos');
    this.playerController.setBounds(-75.0, 130.0, 200.0);

    const initialSpawn = new THREE.Vector3(36.42, -14.85, 120.52);
    this.playerController.setDefaultSpawn(initialSpawn);
    this.playerController.setPosition(initialSpawn);

    // 7. Instanciar Editor de Mapa exclusivamente en desarrollo (F2)
    if (import.meta.env.DEV) {
      this.mapEditor = new MapEditor(
        this.scene,
        this.camera,
        this.renderer.domElement,
        this.worldBuilder
      );

      this.mapEditor.setAvailableModels([
        'Flecha.glb',
        'FichaPlayer_Amarillo.glb',
        'FichaPlayer_AmarilloClaro.glb',
        'FichaPlayer_Azul.glb',
        'FichaPlayer_MoradoClaro.glb',
        'FichaPlayer_Rojo.glb',
        'FichaPlayer_VerdeClaro.glb',
        'CircoBase.glb',
      ]);

      this.mapEditor.onActiveStateChange = (active) => {
        this.playerController.isEditorActive = active;
      };

      this.mapEditor.onBVHRebuilt = () => {
        this.playerController.setColliderMesh(this.worldBuilder.getColliderMesh());
      };
    }

    this.boundOnResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundOnResize);

    this.animate();
  }

  /**
   * Construye el agua oceano a la mitad de las rocas (Y = -68.0), descarga modelos e instancia el mapa.
   */
  public async initWorld(onProgress?: (progress: WorldBuildProgress) => void): Promise<void> {
    // 1. Construir plano de agua a media altura de rocas
    this.worldBuilder.buildCircoEnvironment();

    // 2. Cargar modelos GLB referenciados en circo-map.json y generar BVH
    await this.worldBuilder.loadWorldModels(onProgress);

    // 3. Conectar colisiones BVH con el jugador
    const colliderMesh = this.worldBuilder.getColliderMesh();
    console.log('[INFO] CircoScene: BVH colliderMesh listo:', colliderMesh ? 'OK' : 'NULL');
    this.playerController.setColliderMesh(colliderMesh);

    // Asegurar posicion del jugador en caso de que este desincronizado
    if (!this.playerController.hasLoadedDevPosition) {
      this.playerController.setPosition(new THREE.Vector3(36.42, -14.85, 120.52));
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
    const elapsedTime = now * 0.001;
    this.lastTime = now;

    // Actualizar fisica del jugador
    this.playerController.update(delta);

    // Ondulacion suave del agua
    this.worldBuilder.update(elapsedTime);

    this.renderer.render(this.scene, this.camera);
  }

  public getPlayerController(): PlayerController {
    return this.playerController;
  }

  public getPlayerPosition(): THREE.Vector3 {
    return this.playerController.getPosition();
  }

  public getWorldBuilder(): WorldBuilder {
    return this.worldBuilder;
  }

  public getMapEditor(): MapEditor | null {
    return this.mapEditor;
  }

  public getAudioManager(): AudioManager {
    return this.audioManager;
  }

  public resetPlayerSpawn(): void {
    this.playerController.resetSpawnPosition(new THREE.Vector3(36.42, -14.85, 120.52));
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.boundOnResize);

    if (this.mapEditor) {
      this.mapEditor.dispose();
      this.mapEditor = null;
    }

    this.playerController.dispose();
    this.worldBuilder.dispose();
    this.audioManager.dispose();

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
