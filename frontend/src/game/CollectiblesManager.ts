import * as THREE from 'three';

export interface CollectibleItem {
  id: string;
  name: string;
  model: THREE.Group;
  collected: boolean;
  position: THREE.Vector3;
  interactRadius: number;
}

/**
 * Gestiona los 4 objetos coleccionables y el estado de activacion del portal de teletransporte.
 */
export class CollectiblesManager {
  private items: Map<string, CollectibleItem> = new Map();
  private portalModel: THREE.Group | null = null;
  private portalActive: boolean = false;
  private portalLight: THREE.PointLight | null = null;
  private onCollectionChanged?: (collectedCount: number, items: Record<string, boolean>, portalActive: boolean) => void;

  /**
   * Registra la funcion de callback para notificar cambios en la recoleccion.
   */
  public setCallback(callback: (collectedCount: number, items: Record<string, boolean>, portalActive: boolean) => void): void {
    this.onCollectionChanged = callback;
  }

  /**
   * Registra un objeto coleccionable en el gestor.
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
   * Actualiza la rotacion de los coleccionables y animaciones del portal.
   */
  public update(delta: number): void {
    const rotSpeed = delta * 1.5;

    this.items.forEach((item) => {
      if (!item.collected && item.model.visible) {
        item.model.rotation.y += rotSpeed;
        // Leve flotacion sinusoidal
        item.model.position.y = item.position.y + Math.sin(Date.now() * 0.003) * 0.15;
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
      if (!item.collected) {
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
   * Recolecta un objeto por su identificador.
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
   * Activa los efectos visuales del portal de salida.
   */
  private activatePortal(): void {
    this.portalActive = true;
    console.log('[INFO] Los 4 objetos fueron recolectados. Portal dimensional activado.');

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

  public dispose(): void {
    this.items.clear();
    this.portalModel = null;
    this.portalLight = null;
  }
}
