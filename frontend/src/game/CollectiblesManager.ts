import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MatchCollectibleDto, CollectibleType } from '../types/match';

export interface CollectibleItem {
  id: string;
  name: string;
  model: THREE.Group;
  collected: boolean;
  position: THREE.Vector3;
  interactRadius: number;
}

interface CollectibleConfig {
  modelFile: string;
  name: string;
  yOffset: number;
  scale: number;
}

const COLLECTIBLE_CONFIG: Record<CollectibleType, CollectibleConfig> = {
  ADIVINALO: {
    modelFile: 'Adivinalo.glb',
    name: 'Adivínalo',
    yOffset: 1.25,
    scale: 1.0,
  },
  CARTA_PREGUNTA: {
    modelFile: 'Carta_Pregunta.glb',
    name: 'Carta Pregunta',
    yOffset: 1.25,
    scale: 1.0,
  },
  TIBURON_AZUL: {
    modelFile: 'TiburonAzul.glb',
    name: 'Tiburón Azul',
    yOffset: 1.25,
    scale: 1.0,
  },
  TIBURON_ROJO: {
    modelFile: 'TiburonRojo.glb',
    name: 'Tiburón Rojo',
    yOffset: 1.25,
    scale: 1.0,
  },
};

/**
 * Gestiona los objetos coleccionables dinamicos por partida y el estado del portal de teletransporte.
 */
export class CollectiblesManager {
  private items: Map<string, CollectibleItem> = new Map();
  private portalModel: THREE.Group | null = null;
  private portalActive: boolean = false;
  private portalLight: THREE.PointLight | null = null;
  private onCollectionChanged?: (collectedCount: number, items: Record<string, boolean>, portalActive: boolean) => void;

  private gltfLoader: GLTFLoader = new GLTFLoader();
  private prototypeCache: Map<string, THREE.Group> = new Map();
  private activeScene: THREE.Scene | null = null;

  /**
   * Registra la funcion de callback para notificar cambios en la recoleccion.
   */
  public setCallback(callback: (collectedCount: number, items: Record<string, boolean>, portalActive: boolean) => void): void {
    this.onCollectionChanged = callback;
  }

  /**
   * Carga de forma asincrona y dinamica los coleccionables generados para la partida actual.
   * Se descargan los prototipos GLB en cache y se posicionan sobre la cota exacta del terreno.
   */
  public async loadDynamicCollectibles(
    collectibles: MatchCollectibleDto[],
    scene: THREE.Scene,
    getTerrainHeight: (x: number, z: number) => number
  ): Promise<void> {
    this.activeScene = scene;

    // Remover modelos previos de coleccionables si existieran
    this.items.forEach((item) => {
      scene.remove(item.model);
    });
    this.items.clear();

    if (!collectibles || collectibles.length === 0) {
      console.log('[INFO] No hay objetos coleccionables para inicializar en esta partida.');
      return;
    }

    // 1. Identificar modelos unicos y cargarlos en cache
    const uniqueFiles = Array.from(
      new Set(
        collectibles
          .map((c) => COLLECTIBLE_CONFIG[c.type]?.modelFile)
          .filter((file): file is string => !!file)
      )
    );

    for (const file of uniqueFiles) {
      if (!this.prototypeCache.has(file)) {
        try {
          const gltf = await this.loadGLTF(`/models/pantano/${file}`);
          this.prototypeCache.set(file, gltf.scene);
        } catch (err) {
          console.error(`[ERROR] Fallo al precargar modelo de coleccionable: ${file}`, err);
        }
      }
    }

    // 2. Instanciar cada coleccionable en sus coordenadas (X, Z) y ajustar altura Y analitica
    let spawnedCount = 0;
    for (const c of collectibles) {
      const config = COLLECTIBLE_CONFIG[c.type];
      if (!config) continue;

      const proto = this.prototypeCache.get(config.modelFile);
      if (!proto) continue;

      const instance = proto.clone(true);
      instance.name = `Collectible_${c.id}`;

      // Calcular cota exacta del terreno en (X, Z) mas desplazamiento de flotacion visible
      const groundY = getTerrainHeight(c.posX, c.posZ);
      const targetY = groundY + config.yOffset;
      const basePos = new THREE.Vector3(c.posX, targetY, c.posZ);

      instance.position.copy(basePos);
      instance.scale.set(config.scale, config.scale, config.scale);
      instance.updateMatrixWorld(true);

      // Los coleccionables NO se agregan al grupo de colisiones solidas
      scene.add(instance);

      const isCollected = !!c.collectedByTeamId;
      if (isCollected) {
        instance.visible = false;
      }

      this.items.set(c.id, {
        id: c.id,
        name: config.name,
        model: instance,
        collected: isCollected,
        position: basePos,
        interactRadius: 3.5,
      });

      spawnedCount++;
    }

    console.log(`[INFO] Se instanciaron exitosamente ${spawnedCount} objetos coleccionables en el terreno.`);
  }

  private loadGLTF(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Registra manualmente un objeto coleccionable en el gestor.
   */
  public registerItem(id: string, name: string, model: THREE.Group, position: THREE.Vector3): void {
    model.position.copy(position);
    this.items.set(id, {
      id,
      name,
      model,
      collected: false,
      position: position.clone(),
      interactRadius: 3.5,
    });
  }

  /**
   * Asigna el modelo del portal para habilitar su activacion visual.
   */
  public registerPortal(portalModel: THREE.Group): void {
    this.portalModel = portalModel;

    // Crear luz tenue inicial para el portal
    this.portalLight = new THREE.PointLight(0x00ffff, 0, 15);
    this.portalLight.position.set(0, 2.5, 0);
    this.portalModel.add(this.portalLight);

    // Atenuar materiales iniciales
    this.portalModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.transparent = true;
          mat.opacity = 0.45;
          mesh.material = mat;
        }
      }
    });
  }

  /**
   * Actualiza la rotacion y animacion de flotacion de los coleccionables activos.
   */
  public update(delta: number): void {
    const rotSpeed = delta * 1.5;

    this.items.forEach((item) => {
      if (!item.collected && item.model.visible) {
        item.model.rotation.y += rotSpeed;
        // Leve flotacion sinusoidal suave
        item.model.position.y = item.position.y + Math.sin(Date.now() * 0.003 + item.position.x) * 0.15;
      }
    });

    if (this.portalActive && this.portalModel) {
      this.portalModel.rotation.y += delta * 0.8;
      if (this.portalLight) {
        this.portalLight.intensity = 2.5 + Math.sin(Date.now() * 0.005) * 1.0;
      }
    }
  }

  /**
   * Verifica si el jugador se encuentra cerca de un objeto no recolectado o del portal.
   */
  public checkNearby(playerPos: THREE.Vector3): { type: 'item' | 'portal'; id?: string; name: string } | null {
    // Verificar objetos coleccionables
    for (const [id, item] of this.items.entries()) {
      if (!item.collected && item.model.visible) {
        const dist = playerPos.distanceTo(item.model.position);
        if (dist <= item.interactRadius) {
          return { type: 'item', id, name: item.name };
        }
      }
    }

    // Verificar portal activo
    if (this.portalActive && this.portalModel) {
      const portalWorldPos = new THREE.Vector3();
      this.portalModel.getWorldPosition(portalWorldPos);
      if (playerPos.distanceTo(portalWorldPos) <= 5.0) {
        return { type: 'portal', name: 'Portal Dimensional' };
      }
    }

    return null;
  }

  /**
   * Marca un objeto como recolectado y oculta su modelo visual.
   */
  public collect(id: string): boolean {
    const item = this.items.get(id);
    if (!item || item.collected) return false;

    item.collected = true;
    item.model.visible = false;

    console.log(`[INFO] Objeto recolectado: ${item.name} (${id})`);

    const collectedCount = this.getCollectedCount();
    const itemsState = this.getItemsState();

    if (collectedCount >= 4 && !this.portalActive) {
      this.activatePortal();
    }

    if (this.onCollectionChanged) {
      this.onCollectionChanged(collectedCount, itemsState, this.portalActive);
    }

    return true;
  }

  /**
   * Marca un coleccionable como recolectado de forma remota y oculta su modelo visual en la escena.
   */
  public markCollected(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    item.collected = true;
    item.model.visible = false;
  }

  /**
   * Habilita o deshabilita el portal dimensional segun el estado del equipo local.
   */
  public setPortalActive(active: boolean): void {
    if (active === this.portalActive) return;
    this.portalActive = active;
    if (active) {
      this.activatePortal();
    }
  }

  /**
   * Activa los efectos visuales del portal de salida.
   */
  public activatePortal(): void {
    this.portalActive = true;
    console.log('[INFO] Portal dimensional activado.');

    if (this.portalModel) {
      this.portalModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.opacity = 1.0;
            mat.emissive = new THREE.Color(0x00ffff);
            mat.emissiveIntensity = 0.8;
          }
        }
      });
    }

    if (this.portalLight) {
      this.portalLight.intensity = 3.0;
    }
  }

  public getCollectedCount(): number {
    let count = 0;
    this.items.forEach((item) => {
      if (item.collected) count++;
    });
    return count;
  }

  public getItemsState(): Record<string, boolean> {
    const state: Record<string, boolean> = {};
    this.items.forEach((item, key) => {
      state[key] = item.collected;
    });
    return state;
  }

  public isPortalActive(): boolean {
    return this.portalActive;
  }

  public dispose(scene?: THREE.Scene): void {
    const targetScene = scene || this.activeScene;
    if (targetScene) {
      this.items.forEach((item) => {
        targetScene.remove(item.model);
      });
    }
    this.items.clear();
    this.prototypeCache.clear();
    this.portalModel = null;
    this.portalLight = null;
    this.activeScene = null;
  }
}
