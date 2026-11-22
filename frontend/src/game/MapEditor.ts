import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { WorldBuilder } from './WorldBuilder';
import { MapObjectDefinition, MapObjectCategory } from '../types/map';

/**
 * Gestor del editor de mapa interactivo para entorno de desarrollo (F2, gizmos y guardado).
 */
export class MapEditor {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private worldBuilder: WorldBuilder;

  private transformControls: TransformControls;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();

  public isActive: boolean = false;
  public isDragging: boolean = false;

  private selectedObject: THREE.Group | null = null;
  private selectedDef: MapObjectDefinition | null = null;

  // Callbacks para sincronizacion con interfaz React (shadcn/ui)
  public onActiveStateChange?: (active: boolean) => void;
  public onSelectionChange?: (def: MapObjectDefinition | null) => void;
  public onTransformUpdate?: (
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number]
  ) => void;
  public onBVHRebuilt?: () => void;

  // Listeners guardados
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnPointerDown: (e: MouseEvent) => void;
  private boundOnContextMenu: (e: MouseEvent) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    worldBuilder: WorldBuilder
  ) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.worldBuilder = worldBuilder;

    // Inicializar TransformControls
    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.transformControls.size = 0.85;
    this.transformControls.setMode('translate');

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.isDragging = !!event.value;
      if (!event.value) {
        // Al soltar el gizmo, reconstruir BVH de colisiones
        this.worldBuilder.rebuildCollisionBVH();
        if (this.onBVHRebuilt) {
          this.onBVHRebuilt();
        }
      }
    });

    this.transformControls.addEventListener('change', () => {
      if (this.selectedObject && this.selectedDef) {
        const p = this.selectedObject.position;
        const r = this.selectedObject.rotation;
        const s = this.selectedObject.scale;

        const pos: [number, number, number] = [
          Number(p.x.toFixed(2)),
          Number(p.y.toFixed(2)),
          Number(p.z.toFixed(2)),
        ];
        const rot: [number, number, number] = [
          Number(r.x.toFixed(3)),
          Number(r.y.toFixed(3)),
          Number(r.z.toFixed(3)),
        ];
        const scale: [number, number, number] = [
          Number(s.x.toFixed(2)),
          Number(s.y.toFixed(2)),
          Number(s.z.toFixed(2)),
        ];

        this.selectedDef.position = pos;
        this.selectedDef.rotation = rot;
        this.selectedDef.scale = scale;

        if (this.onTransformUpdate) {
          this.onTransformUpdate(pos, rot, scale);
        }
      }
    });

    this.scene.add(this.transformControls.getHelper());

    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnContextMenu = this.onContextMenu.bind(this);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'F2') {
      e.preventDefault();
      this.toggleActive();
      return;
    }

    if (!this.isActive) return;

    // Al pulsar la tecla Control, alternar a rotacion
    if (e.key === 'Control') {
      this.transformControls.setMode('rotate');
    }

    // Tecla Escape para deseleccionar
    if (e.code === 'Escape' && this.selectedObject) {
      e.stopPropagation();
      this.deselect();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.isActive) return;

    // Al soltar Control, retornar a traslacion
    if (e.key === 'Control') {
      this.transformControls.setMode('translate');
    }
  }

  private onContextMenu(e: MouseEvent): void {
    // Si el editor esta activo, evitar menu contextual nativo del navegador
    if (this.isActive) {
      e.preventDefault();
    }
  }

  private onPointerDown(e: MouseEvent): void {
    if (!this.isActive || this.isDragging) return;

    // Si el usuario hace clic derecho o izquierdo sobre el lienzo cuando el cursor esta liberado
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Buscar intersecciones con mallas del mapa
    const candidates: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.parent) {
        candidates.push(obj);
      }
    });

    const intersects = this.raycaster.intersectObjects(candidates, false);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        // Encontrar grupo raiz con userData.mapObjectId
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== this.scene) {
          if (cur.userData && cur.userData.mapObjectId) {
            this.selectObjectById(cur.userData.mapObjectId);
            return;
          }
          cur = cur.parent;
        }
      }
    }
  }

  public toggleActive(forceState?: boolean): boolean {
    this.isActive = forceState !== undefined ? forceState : !this.isActive;

    if (this.isActive) {
      // Liberar puntero para manipular controles de la interfaz
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.transformControls.enabled = true;
    } else {
      this.deselect();
      this.transformControls.enabled = false;
    }

    if (this.onActiveStateChange) {
      this.onActiveStateChange(this.isActive);
    }

    return this.isActive;
  }

  public selectObjectById(id: string | null): void {
    if (!id) {
      this.deselect();
      return;
    }

    const entry = this.worldBuilder.getObjectById(id);
    if (!entry) {
      this.deselect();
      return;
    }

    this.selectedObject = entry.object;
    this.selectedDef = entry.definition;
    this.transformControls.attach(this.selectedObject);

    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedDef);
    }
  }

  public deselect(): void {
    this.selectedObject = null;
    this.selectedDef = null;
    this.transformControls.detach();

    if (this.onSelectionChange) {
      this.onSelectionChange(null);
    }
  }

  public setMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.transformControls.setMode(mode);
  }

  public updateSelectedTransform(
    pos?: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number]
  ): void {
    if (!this.selectedObject || !this.selectedDef) return;

    if (pos) {
      this.selectedObject.position.set(pos[0], pos[1], pos[2]);
      this.selectedDef.position = pos;
    }
    if (rot) {
      this.selectedObject.rotation.set(rot[0], rot[1], rot[2]);
      this.selectedDef.rotation = rot;
    }
    if (scale) {
      this.selectedObject.scale.set(scale[0], scale[1], scale[2]);
      this.selectedDef.scale = scale;
    }

    this.selectedObject.updateMatrixWorld(true);
    this.worldBuilder.rebuildCollisionBVH();
    if (this.onBVHRebuilt) {
      this.onBVHRebuilt();
    }

    if (this.onTransformUpdate) {
      this.onTransformUpdate(
        this.selectedDef.position,
        this.selectedDef.rotation,
        this.selectedDef.scale
      );
    }
  }

  /**
   * Duplica el objeto actualmente seleccionado en una posicion cercana.
   */
  public duplicateSelected(): MapObjectDefinition | null {
    if (!this.selectedDef) return null;

    const newId = `${this.selectedDef.model.replace('.glb', '').toLowerCase()}_${Date.now()}`;
    const newPos: [number, number, number] = [
      Number((this.selectedDef.position[0] + 2.0).toFixed(2)),
      this.selectedDef.position[1],
      Number((this.selectedDef.position[2] + 2.0).toFixed(2)),
    ];

    const newDef: MapObjectDefinition = {
      id: newId,
      model: this.selectedDef.model,
      category: this.selectedDef.category,
      name: this.selectedDef.name ? `${this.selectedDef.name} (Copia)` : undefined,
      position: newPos,
      rotation: [...this.selectedDef.rotation],
      scale: [...this.selectedDef.scale],
    };

    const inst = this.worldBuilder.instantiateObject(newDef, true);
    if (inst) {
      this.selectObjectById(newId);
      return newDef;
    }
    return null;
  }

  /**
   * Elimina el objeto seleccionado del mapa.
   */
  public deleteSelected(): boolean {
    if (!this.selectedDef) return false;
    const id = this.selectedDef.id;
    this.deselect();
    return this.worldBuilder.removeObject(id);
  }

  /**
   * Agrega una nueva instancia de modelo disponible al frente de la camara.
   */
  public addNewObject(modelName: string, category: MapObjectCategory = 'vegetation'): MapObjectDefinition | null {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const spawnPos = this.camera.position.clone().addScaledVector(dir, 8.0);
    const newId = `${modelName.replace('.glb', '').toLowerCase()}_${Date.now()}`;

    const newDef: MapObjectDefinition = {
      id: newId,
      model: modelName,
      category,
      position: [Number(spawnPos.x.toFixed(2)), Number(spawnPos.y.toFixed(2)), Number(spawnPos.z.toFixed(2))],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };

    const inst = this.worldBuilder.instantiateObject(newDef, true);
    if (inst) {
      this.selectObjectById(newId);
      return newDef;
    }
    return null;
  }

  /**
   * Guarda el estado del mapa actual en disco mediante el endpoint de desarrollo en Vite.
   */
  public async saveMapToDisk(): Promise<{ success: boolean; message: string }> {
    const mapData = this.worldBuilder.getMapData();

    try {
      const res = await fetch('/__dev/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapData, null, 2),
      });

      if (res.ok) {
        console.log('[INFO] Archivo pantano-map.json guardado en disco exitosamente.');
        return { success: true, message: 'Mapa guardado en disco exitosamente.' };
      } else {
        throw new Error(`Respuesta de servidor no satisfactoria: ${res.status}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.warn('[WARN] Endpoint de desarrollo no disponible, iniciando descarga de respaldo:', errMsg);

      // Descarga directa en archivo local como respaldo
      const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pantano-map.json';
      a.click();
      URL.revokeObjectURL(url);

      return { success: true, message: 'Archivo descargado como respaldo.' };
    }
  }

  public getSelectedDefinition(): MapObjectDefinition | null {
    return this.selectedDef;
  }

  public getAvailableModels(): string[] {
    return [
      'Sala_Bienvenida.glb',
      'Choza_Alta.glb',
      'Choza_Baja.glb',
      'Arbol_pantano.glb',
      'Tronco.glb',
      'Arbol_TP.glb',
      'TP.glb',
      'Adivinalo.glb',
      'Carta_Pregunta.glb',
      'TiburonAzul.glb',
      'TiburonRojo.glb',
    ];
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    this.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);

    this.transformControls.dispose();
    this.scene.remove(this.transformControls.getHelper());
  }
}
