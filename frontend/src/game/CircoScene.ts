import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WorldBuilder, WorldBuildProgress } from './WorldBuilder';
import { PlayerController } from './PlayerController';
import { MapEditor } from './MapEditor';
import { AudioManager } from './AudioManager';
import { SoundManager } from './SoundManager';
import { RemotePlayerData } from './RemotePlayerAvatar';
import { RemotePlayersManager } from './RemotePlayersManager';
import { CircoTeamState } from './CircoNetworkManager';
import { getTokenPositionCoord } from './CircoPositions';

const TOKEN_MODEL_MAP: Record<number, string> = {
  1: 'ficha_azul_1',
  2: 'ficha_amarillo_1',
  3: 'ficha_amarilloclaro_1',
  4: 'ficha_verdeclaro_1',
  5: 'ficha_moradoclaro_1',
  6: 'ficha_rojo_1',
};

const ROULETTE_CENTER_X = 36.13;
const ROULETTE_CENTER_Z = -45.09;
const CARD_BASE_Y = -15.0;
const CARD_ACTIVE_Y = -5.0;

/**
 * Escenario 3D interactivo para la fase "Circo" (isla flotante sobre el oceano con carpa de circo, ruleta, atriles y cartas).
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
  public soundManager: SoundManager;

  // Gestor centralizado de avatares remotos
  private remotePlayersManager: RemotePlayersManager;

  // Objetos y atriles del circo
  private podiumObjects: Map<number, THREE.Object3D> = new Map();
  private podiumPositions: Map<number, THREE.Vector3> = new Map();
  private totalTeams: number = 6;
  private currentTeamsData: CircoTeamState[] = [];
  private lastConfiguredTotalTeams: number = 0;
  private isWorldReady: boolean = false;

  // Ruleta: objeto flecha y animacion de giro suave y pausado
  private flechaObject: THREE.Object3D | null = null;
  private currentArrowRotationY: number = 0;
  private targetArrowRotationY: number = 0;
  private startArrowRotationY: number = 0;
  private arrowSpinDuration: number = 3.2; // Duracion total del giro en segundos
  private arrowSpinElapsed: number = 0;
  private isSpinningArrow: boolean = false;
  private hasInitializedArrow: boolean = false;

  // Fichas de jugadores en el anillo de la ruleta (coordenadas objetivo de interpolacion)
  private targetTokenPositions: Map<number, THREE.Vector3> = new Map();

  // Modelos de cartas y corona precargados
  private cardModels: Map<string, THREE.Group> = new Map();
  private activeCardModel: THREE.Group | null = null;
  private activeCardType: string = '';
  private currentCardY: number = CARD_BASE_Y;
  private cardStartY: number = CARD_BASE_Y;
  private cardTargetY: number = CARD_BASE_Y;
  private cardAnimDuration: number = 2.0; // Duracion suave de subida/bajada en segundos
  private cardAnimElapsed: number = 0;
  private isCardAnimating: boolean = false;
  private cardSpotLight: THREE.PointLight | null = null;
  private hasTriggeredCardSound: boolean = false;

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

    // Luz focal para cartas y corona cuando emergen
    this.cardSpotLight = new THREE.PointLight(0x38bdf8, 0, 30);
    this.cardSpotLight.position.set(ROULETTE_CENTER_X, -1.0, ROULETTE_CENTER_Z);
    this.scene.add(this.cardSpotLight);

    // 5. Inicializar WorldBuilder para escenario Circo
    this.worldBuilder = new WorldBuilder(this.scene, null, {
      mapName: 'circo',
      mapUrl: '/maps/circo-map.json',
      modelsBasePath: '/models/circo/',
    });

    // 6. Audio procedural, gestor de avatares remotos y controlador de jugador en primera persona
    this.audioManager = new AudioManager();
    this.soundManager = new SoundManager();
    this.remotePlayersManager = new RemotePlayersManager(this.scene);
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

    // 4. Localizar atriles PuestoPlayer_1..6 en CircoBase
    this.identifyPodiums();

    // 5. Localizar Flecha.glb y registrar posicion inicial de fichas
    this.setupRouletteAndTokens();

    // 6. Precargar cartas y corona
    await this.preloadCardAndCrownModels();

    // Asegurar posicion del jugador
    if (!this.playerController.hasLoadedDevPosition) {
      this.playerController.setPosition(new THREE.Vector3(36.42, -14.85, 120.52));
    }

    // 7. El mundo 3D esta listo: aplicar configuracion de equipos y sincronizar colisiones
    this.isWorldReady = true;
    this.applyTeamsConfiguration();
  }

  private identifyPodiums(): void {
    const circoBaseEntry = this.worldBuilder.getObjectById('circo_base_1');
    if (!circoBaseEntry) {
      console.warn('[WARN] No se encontro circo_base_1 en CircoScene.');
      return;
    }

    circoBaseEntry.object.traverse((child) => {
      for (let i = 1; i <= 6; i++) {
        if (child.name === `PuestoPlayer_${i}` || child.name.includes(`PuestoPlayer_${i}`)) {
          this.podiumObjects.set(i, child);
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          this.podiumPositions.set(i, worldPos);
          console.log(`[INFO] Atril PuestoPlayer_${i} identificado en: X=${worldPos.x.toFixed(2)}, Y=${worldPos.y.toFixed(2)}, Z=${worldPos.z.toFixed(2)}`);
        }
      }
    });
  }

  private setupRouletteAndTokens(): void {
    // Flecha
    const flechaEntry = this.worldBuilder.getObjectById('flecha_1');
    if (flechaEntry) {
      this.flechaObject = flechaEntry.object;
      this.currentArrowRotationY = this.flechaObject.rotation.y;
      this.targetArrowRotationY = this.currentArrowRotationY;
      this.startArrowRotationY = this.currentArrowRotationY;
    }

    // Fichas: inicializar segun la posicion base (paso 0) de la matriz estatica
    for (let seat = 1; seat <= 6; seat++) {
      const objId = TOKEN_MODEL_MAP[seat];
      if (!objId) continue;

      const tokenEntry = this.worldBuilder.getObjectById(objId);
      if (tokenEntry) {
        const coord = getTokenPositionCoord(seat, 0);
        const initPos = new THREE.Vector3(coord.x, coord.y, coord.z);
        tokenEntry.object.position.copy(initPos);
        this.targetTokenPositions.set(seat, initPos.clone());
      }
    }
  }

  private async preloadCardAndCrownModels(): Promise<void> {
    const gltfLoader = new GLTFLoader();
    const assets = [
      { key: 'PREGUNTA', file: 'Carta_Pregunta.glb' },
      { key: 'ADIVINALO', file: 'Carta_Adivinalo.glb' },
      { key: 'TIBURON_ROJO', file: 'Carta_TiburonRojo.glb' },
      { key: 'TIBURON_AZUL', file: 'Carta_TiburonAzul.glb' },
      { key: 'CORONA', file: 'Corona.glb' },
    ];

    for (const item of assets) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          gltfLoader.load(`/models/circo/${item.file}`, resolve, undefined, reject);
        });

        const root = gltf.scene as THREE.Group;
        root.name = `CardModel_${item.key}`;
        root.position.set(ROULETTE_CENTER_X, CARD_BASE_Y, ROULETTE_CENTER_Z);
        root.visible = false;

        // Escala ampliada para alta visibilidad en la carpa
        root.scale.set(2.4, 2.4, 2.4);

        this.scene.add(root);
        this.cardModels.set(item.key, root);
        console.log(`[INFO] Modelo de evento ${item.key} (${item.file}) precargado exitosamente.`);
      } catch (err) {
        console.error(`[ERROR] Error al precargar modelo ${item.file}:`, err);
      }
    }
  }

  /**
   * Configura visibilidad de atriles y fichas segun la cantidad de equipos en la partida.
   * Guarda los datos y los aplica inmediatamente si los modelos 3D ya estan listos.
   */
  public configureTeams(teams: CircoTeamState[], totalTeams: number): void {
    this.totalTeams = Math.max(2, Math.min(6, totalTeams));
    if (teams && teams.length > 0) {
      this.currentTeamsData = teams;
    }

    if (!this.isWorldReady) {
      console.log(`[INFO] CircoScene: Modelos cargando; configuracion guardada (${this.totalTeams} equipos).`);
      return;
    }

    this.applyTeamsConfiguration();
  }

  /**
   * Aplica la configuracion visual y fisica de los atriles y fichas segun totalTeams.
   * Reconstruye el arbol BVH para que los atriles ocultos no generen colision fantasma.
   */
  private applyTeamsConfiguration(): void {
    if (!this.isWorldReady) return;

    let podiumVisibilityChanged = false;

    // 1. Mostrar/ocultar atriles PuestoPlayer_1..6 y sus subcomponentes
    this.podiumObjects.forEach((obj, seat) => {
      const isVisible = seat <= this.totalTeams;
      if (obj.visible !== isVisible) {
        podiumVisibilityChanged = true;
      }
      obj.visible = isVisible;
      obj.traverse((child) => {
        child.visible = isVisible;
      });
    });

    // 2. Mostrar/ocultar fichas y actualizar su posicion de avance
    for (let seat = 1; seat <= 6; seat++) {
      const objId = TOKEN_MODEL_MAP[seat];
      const tokenEntry = this.worldBuilder.getObjectById(objId);
      if (!tokenEntry) continue;

      const isVisible = seat <= this.totalTeams;
      tokenEntry.object.visible = isVisible;
      tokenEntry.object.traverse((child) => {
        child.visible = isVisible;
      });

      if (!isVisible) continue;

      // Buscar datos de este equipo y posicionar la ficha segun la matriz estatica
      const team = this.currentTeamsData.find((t) => t.seat === seat);
      const tokenPosStep = team ? team.tokenPosition : 0;
      const coord = getTokenPositionCoord(seat, tokenPosStep);
      const target = new THREE.Vector3(coord.x, coord.y, coord.z);
      this.targetTokenPositions.set(seat, target);
    }

    // 3. Reconstruir BVH de colisiones si cambio la visibilidad de los atriles
    if (podiumVisibilityChanged || this.lastConfiguredTotalTeams !== this.totalTeams) {
      this.lastConfiguredTotalTeams = this.totalTeams;
      const updatedCollider = this.worldBuilder.rebuildCollisionBVH();
      if (updatedCollider) {
        this.playerController.setColliderMesh(updatedCollider);
        console.log(`[INFO] CircoScene: BVH de colisiones actualizado para ${this.totalTeams} equipos (sin colisiones invisibles).`);
      }
    }
  }

  /**
   * Establece la rotacion final calculada por el servidor para la ruleta.
   * Ejecuta una animacion pausada y suave sin aceleraciones bruscas.
   */
  public setArrowRotationY(targetRotY: number, immediate: boolean = false): void {
    if (!this.hasInitializedArrow) {
      this.hasInitializedArrow = true;
      this.currentArrowRotationY = targetRotY;
      this.targetArrowRotationY = targetRotY;
      this.startArrowRotationY = targetRotY;
      if (this.flechaObject) {
        this.flechaObject.rotation.y = targetRotY;
      }
      return;
    }

    if (Math.abs(this.targetArrowRotationY - targetRotY) > 0.01) {
      if (immediate) {
        this.isSpinningArrow = false;
        this.currentArrowRotationY = targetRotY;
        this.targetArrowRotationY = targetRotY;
        this.startArrowRotationY = targetRotY;
        if (this.flechaObject) {
          this.flechaObject.rotation.y = targetRotY;
        }
      } else {
        this.startArrowRotationY = this.currentArrowRotationY;
        this.targetArrowRotationY = targetRotY;
        this.arrowSpinElapsed = 0;
        this.isSpinningArrow = true;
        this.soundManager.playRouletteSpinSound();
      }
    }
  }

  /**
   * Activa la animacion de elevacion de una carta o la corona.
   */
  public setActiveCard(cardType: string): void {
    if (this.activeCardType === cardType && this.activeCardModel?.visible) {
      return;
    }

    if (this.activeCardModel) {
      this.activeCardModel.visible = false;
      this.activeCardModel.position.y = CARD_BASE_Y;
    }

    this.activeCardType = cardType;
    this.hasTriggeredCardSound = false;

    const model = this.cardModels.get(cardType);
    if (model) {
      this.activeCardModel = model;
      this.activeCardModel.visible = true;
      this.cardStartY = CARD_BASE_Y;
      this.cardTargetY = CARD_ACTIVE_Y;
      this.currentCardY = CARD_BASE_Y;
      this.cardAnimElapsed = 0;
      this.isCardAnimating = true;
      this.activeCardModel.position.set(ROULETTE_CENTER_X, CARD_BASE_Y, ROULETTE_CENTER_Z);

      if (this.cardSpotLight) {
        if (cardType === 'CORONA') {
          this.cardSpotLight.color.setHex(0xfbbf24); // Oro
        } else if (cardType === 'PREGUNTA') {
          this.cardSpotLight.color.setHex(0x4ade80); // Verde esmeralda
        } else if (cardType === 'TIBURON_ROJO') {
          this.cardSpotLight.color.setHex(0xef4444); // Rojo
        } else if (cardType === 'TIBURON_AZUL') {
          this.cardSpotLight.color.setHex(0x38bdf8); // Azul
        } else {
          this.cardSpotLight.color.setHex(0xfacc15); // Amarillo
        }
      }
    }
  }

  /**
   * Oculta y hace descender la carta activa con transicion suave.
   */
  public clearActiveCard(): void {
    if (this.activeCardModel) {
      this.cardStartY = this.currentCardY;
      this.cardTargetY = CARD_BASE_Y;
      this.cardAnimElapsed = 0;
      this.isCardAnimating = true;
    }
    if (this.cardSpotLight) {
      this.cardSpotLight.intensity = 0;
    }
  }

  /**
   * Verifica si el jugador local esta cerca de un atril activo (distancia <= threshold).
   */
  public checkPodiumProximity(playerPos: THREE.Vector3, threshold = 3.5): { seat: number; distance: number; position: THREE.Vector3 } | null {
    let closest: { seat: number; distance: number; position: THREE.Vector3 } | null = null;
    let minDistance = threshold;

    this.podiumPositions.forEach((pos, seat) => {
      if (seat > this.totalTeams) return;
      const d = playerPos.distanceTo(pos);
      if (d <= minDistance) {
        minDistance = d;
        closest = { seat, distance: d, position: pos };
      }
    });

    return closest;
  }

  /**
   * Teletransporta al jugador a la zona de gradas.
   */
  public teleportToStands(): void {
    const standsPosition = new THREE.Vector3(36.13, -7.5, -18.0);
    this.playerController.setPosition(standsPosition);
    console.log('[INFO] Jugador reubicado en las gradas del Circo.');
  }

  // --- Gestion de avatares remotos con RemotePlayersManager ---

  public addRemotePlayer(sessionId: string, data: RemotePlayerData): void {
    this.remotePlayersManager.addPlayer(sessionId, data);
  }

  public removeRemotePlayer(sessionId: string): void {
    this.remotePlayersManager.removePlayer(sessionId);
  }

  public updateRemotePlayer(
    sessionId: string,
    data: { x: number; y: number; z: number; ry: number; animState?: string }
  ): void {
    this.remotePlayersManager.updatePlayer(sessionId, data);
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

    // 1. Actualizar fisica y controles del jugador local
    this.playerController.update(delta);

    // 2. Ondulacion suave del agua oceano
    this.worldBuilder.update(elapsedTime);

    // 3. Animacion de giro de la Flecha de la ruleta (giro pausado, suave y fluido)
    if (this.flechaObject && this.isSpinningArrow) {
      this.arrowSpinElapsed += delta;
      const progress = Math.min(this.arrowSpinElapsed / this.arrowSpinDuration, 1.0);

      // Curva cinematica suave: arranque progresivo (primeros 25%) y frenado suave prolongado (ultimos 75%)
      let easeProgress: number;
      if (progress < 0.25) {
        const p = progress / 0.25;
        easeProgress = 0.12 * (p * p);
      } else {
        const p = (progress - 0.25) / 0.75;
        easeProgress = 0.12 + 0.88 * (1 - Math.pow(1 - p, 2.2));
      }

      this.currentArrowRotationY =
        this.startArrowRotationY + (this.targetArrowRotationY - this.startArrowRotationY) * easeProgress;
      this.flechaObject.rotation.y = this.currentArrowRotationY;

      if (progress >= 1.0) {
        this.isSpinningArrow = false;
        this.currentArrowRotationY = this.targetArrowRotationY;
        this.flechaObject.rotation.y = this.targetArrowRotationY;
      }
    }

    // 4. Interpolacion de posicion de las fichas de los equipos
    for (let seat = 1; seat <= this.totalTeams; seat++) {
      const targetPos = this.targetTokenPositions.get(seat);
      const objId = TOKEN_MODEL_MAP[seat];
      const tokenEntry = this.worldBuilder.getObjectById(objId);

      if (targetPos && tokenEntry) {
        tokenEntry.object.position.lerp(targetPos, Math.min(delta * 3.5, 1.0));
      }
    }

    // 5. Animacion de cartas y corona (elevacion y descenso vertical con interpolacion suave y giro)
    if (this.activeCardModel && this.activeCardModel.visible) {
      if (this.isCardAnimating) {
        this.cardAnimElapsed += delta;
        const progress = Math.min(this.cardAnimElapsed / this.cardAnimDuration, 1.0);

        // Curva suave (Smoothstep) sin cambios bruscos de velocidad
        const ease = progress * progress * (3 - 2 * progress);
        this.currentCardY = this.cardStartY + (this.cardTargetY - this.cardStartY) * ease;
        this.activeCardModel.position.y = this.currentCardY;

        // Disparar sonido y foco cuando la carta asoma a media altura
        if (this.cardTargetY === CARD_ACTIVE_Y && progress >= 0.35 && !this.hasTriggeredCardSound) {
          this.hasTriggeredCardSound = true;
          if (this.cardSpotLight) {
            this.cardSpotLight.intensity = 3.5;
          }
          this.soundManager.playCardEmergeSound(this.activeCardType);
        }

        if (progress >= 1.0) {
          this.isCardAnimating = false;
          this.currentCardY = this.cardTargetY;
          this.activeCardModel.position.y = this.cardTargetY;

          // Si descendio a la base por completo, ocultar modelo
          if (this.cardTargetY === CARD_BASE_Y) {
            this.activeCardModel.visible = false;
            this.activeCardModel = null;
            if (this.cardSpotLight) {
              this.cardSpotLight.intensity = 0;
            }
          }
        }
      }

      // Rotacion sutil y continua sobre el eje Y para darle presencia en escena
      if (this.activeCardModel) {
        this.activeCardModel.rotation.y += delta * 0.75;
      }
    }

    // 6. Actualizar avatares remotos
    this.remotePlayersManager.update(delta);

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

    this.remotePlayersManager.dispose();

    this.playerController.dispose();
    this.worldBuilder.dispose();
    this.audioManager.dispose();
    this.soundManager.dispose();

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
