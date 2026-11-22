import * as THREE from 'three';
import { WorldBuilder, WorldBuildProgress } from './WorldBuilder';
import { PlayerController } from './PlayerController';
import { CollectiblesManager } from './CollectiblesManager';
import { MapEditor } from './MapEditor';
import { AudioManager } from './AudioManager';

/**
 * Escena principal 3D del pantano. Gestiona el ciclo de renderizado, camara, BVH y MapEditor.
 */
export class SwampScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private worldBuilder: WorldBuilder;
  private playerController: PlayerController;
  public collectiblesManager: CollectiblesManager;
  private mapEditor: MapEditor | null = null;
  private audioManager: AudioManager;

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;

  private boundOnResize: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Inicializacion de Escena y Niebla atmosferica
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2624);
    this.scene.fog = new THREE.FogExp2(0x1a2624, 0.012);

    // 2. Camara con campo de vision optimizado
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      350
    );

    // 3. Renderer optimizado para equipos de bajos recursos
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = false;

    container.appendChild(this.renderer.domElement);

    // 4. Iluminacion ligera y sobria
    const hemiLight = new THREE.HemisphereLight(0xddeedd, 0x223322, 1.2);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.0);
    dirLight.position.set(40, 60, 30);
    this.scene.add(dirLight);

    // 5. Instanciar modulos base
    this.audioManager = new AudioManager();
    this.collectiblesManager = new CollectiblesManager();
    this.worldBuilder = new WorldBuilder(this.scene, this.collectiblesManager);
    this.playerController = new PlayerController(this.camera, this.renderer.domElement);
    this.playerController.setAudioManager(this.audioManager);

    // Si no habia posicion previa cargada de desarrollo, fijar spawn al pie de las escaleras
    if (!this.playerController.hasLoadedDevPosition) {
      this.playerController.setPosition(new THREE.Vector3(12.5, 3.9, 90));
    }

    // 6. Instanciar Editor de Mapa exclusivamente en entorno de desarrollo
    if (import.meta.env.DEV) {
      this.mapEditor = new MapEditor(
        this.scene,
        this.camera,
        this.renderer.domElement,
        this.worldBuilder
      );

      // Conectar estado del editor con los controles de movimiento
      this.mapEditor.onActiveStateChange = (active) => {
        this.playerController.isEditorActive = active;
      };

      // Al reconstruir colisiones en el editor, sincronizar colliderMesh
      this.mapEditor.onBVHRebuilt = () => {
        this.playerController.setColliderMesh(this.worldBuilder.getColliderMesh());
      };
    }

    this.boundOnResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundOnResize);

    // Iniciar bucle de renderizado
    this.animate();
  }

  /**
   * Construye el terreno y carga los modelos 3D con indicador de progreso.
   */
  public async initWorld(onProgress?: (progress: WorldBuildProgress) => void): Promise<void> {
    this.worldBuilder.buildEnvironment();
    await this.worldBuilder.loadWorldModels(onProgress);

    // Conectar malla BVH consolidada con el controlador del jugador
    this.playerController.setColliderMesh(this.worldBuilder.getColliderMesh());

    // Configurar tecla E para interactuar con objetos
    this.playerController.onInteractPressed = () => {
      const nearby = this.collectiblesManager.checkNearby(this.playerController.getPosition());
      if (nearby && nearby.type === 'item' && nearby.id) {
        this.collectiblesManager.collect(nearby.id);
      }
    };
  }

  private onWindowResize(): void {
    if (this.isDisposed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  private animate(): void {
    if (this.isDisposed) return;

    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // Actualizar jugador y colisiones geometricas precisas con three-mesh-bvh
    this.playerController.update(delta);

    // Actualizar micro-ondulacion de agua y rotacion de coleccionables
    this.worldBuilder.update(elapsedTime);
    this.collectiblesManager.update(delta);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Restablece la posicion del jugador al punto de inicio.
   */
  public resetPlayerSpawn(): void {
    this.playerController.resetSpawnPosition(new THREE.Vector3(12.5, 3.9, 90));
  }

  public getPlayerController(): PlayerController {
    return this.playerController;
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

  /**
   * Obtiene la informacion del objeto o portal cercano al jugador.
   */
  public getNearbyInteraction() {
    return this.collectiblesManager.checkNearby(this.playerController.getPosition());
  }

  public getPlayerPosition(): THREE.Vector3 {
    return this.playerController.getPosition();
  }

  /**
   * Libera exhaustivamente recursos de memoria GPU y listeners.
   */
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
    this.collectiblesManager.dispose();
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
