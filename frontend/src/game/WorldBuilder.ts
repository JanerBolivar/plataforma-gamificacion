import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { StaticGeometryGenerator, MeshBVH } from 'three-mesh-bvh';
import { CollectiblesManager } from './CollectiblesManager';
import { MapData, MapObjectDefinition } from '../types/map';

export interface WorldBuildProgress {
  loaded: number;
  total: number;
  currentAsset: string;
}

export interface WorldBuilderConfig {
  mapName?: string;
  mapUrl?: string;
  modelsBasePath?: string;
}

/**
 * Genera el terreno, el agua, carga el mapa estatico JSON e instancia las mallas con colision BVH.
 */
export class WorldBuilder {
  private scene: THREE.Scene;
  private gltfLoader: GLTFLoader;
  private collectiblesManager: CollectiblesManager | null = null;
  private config: WorldBuilderConfig;

  // Terreno y grupos
  private terrainMesh: THREE.Mesh | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private baseWaterY: number = 0.05;
  private collidersGroup: THREE.Group = new THREE.Group();
  private colliderMesh: THREE.Mesh | null = null;
  private grassTexture: THREE.CanvasTexture | null = null;

  // Cache de modelos base
  private loadedPrototypes: Map<string, THREE.Group> = new Map();

  // Registro de objetos instanciados mapeados por ID
  private mapData: MapData = { version: '1.0', mapName: 'pantano', objects: [] };
  private instantiatedObjects: Map<string, { definition: MapObjectDefinition; object: THREE.Group }> = new Map();

  constructor(
    scene: THREE.Scene,
    collectiblesManager: CollectiblesManager | null = null,
    config?: WorldBuilderConfig
  ) {
    this.scene = scene;
    this.collectiblesManager = collectiblesManager;
    this.config = {
      mapName: config?.mapName || 'pantano',
      mapUrl: config?.mapUrl || (config?.mapName ? `/maps/${config.mapName}-map.json` : '/maps/pantano-map.json'),
      modelsBasePath: config?.modelsBasePath || (config?.mapName ? `/models/${config.mapName}/` : '/models/pantano/'),
    };
    this.mapData = { version: '1.0', mapName: this.config.mapName || 'pantano', objects: [] };
    this.gltfLoader = new GLTFLoader();

    this.collidersGroup.name = 'WorldCollidersGroup';
    this.scene.add(this.collidersGroup);
  }

  /**
   * Funcion analitica de altura del terreno suave para el pantano con zonas bajas inundables.
   */
  public getTerrainHeight(x: number, z: number): number {
    // Zona frontal de bienvenida y spawn: tierra firme y seca
    if (z > 55) {
      return 0.20;
    }

    // Transicion suave entre la zona de bienvenida (z: 55 a 40) y el pantano salvaje
    const transition = z > 40 ? (55 - z) / 15 : 1.0;

    const wave1 = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5;
    const wave2 = Math.sin(x * 0.025 + z * 0.025) * 0.4;
    const wave3 = Math.sin(x * 0.09) * 0.15;

    // Islote suave alrededor del portal (x: 60, z: -75) para que no quede sumergido
    const distPortal = Math.hypot(x - 60, z - (-75));
    const portalMound = Math.max(0, 1.0 - distPortal / 20) * 0.45;

    // Altura del terreno con depresiones pantanosas de hasta -0.40m
    const rawHeight = (wave1 + wave2 + wave3) + 0.15 + portalMound;
    const clampedHeight = Math.max(-0.40, rawHeight);

    return clampedHeight * transition + (1 - transition) * 0.20;
  }

  /**
   * Crea la malla del terreno con colores de suelo pantanoso y el plano de agua.
   */
  public buildEnvironment(): void {
    const terrainGeo = new THREE.PlaneGeometry(250, 250, 64, 64);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const colors: number[] = [];

    const swampGreen = new THREE.Color(0x3e5236);    // Verde pasto pantanoso
    const swampDryGrass = new THREE.Color(0x525c3e); // Pasto en lomas altas
    const mudBrown = new THREE.Color(0x32281d);      // Tierra humeda en orillas
    const submergedMud = new THREE.Color(0x1a1612);  // Fango oscuro bajo el agua
    const waterLevel = 0.05;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const h = this.getTerrainHeight(x, z);
      posAttr.setY(i, h);

      const tempColor = new THREE.Color();
      if (h < waterLevel) {
        // Fondo sumergido bajo el agua: fango oscuro profundo
        const depthFactor = Math.min(1.0, (waterLevel - h) / 0.45);
        tempColor.lerpColors(mudBrown, submergedMud, depthFactor);
      } else if (h < waterLevel + 0.20) {
        // Ribera y orilla humeda inmediata
        const bankFactor = (h - waterLevel) / 0.20;
        tempColor.lerpColors(mudBrown, swampGreen, bankFactor);
      } else {
        // Zonas elevadas con pasto
        const hillFactor = Math.min(1.0, (h - (waterLevel + 0.20)) / 0.65);
        tempColor.lerpColors(swampGreen, swampDryGrass, hillFactor);
      }
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    // Generar textura procedural sutil de pasto optimizada para bajo consumo de memoria
    this.grassTexture = this.createSubtleGrassTexture();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.name = 'TerrainMesh';
    this.terrainMesh.receiveShadow = false;
    this.scene.add(this.terrainMesh);

    // Muros perimetrales invisibles para impedir que el jugador salga de la isla
    this.createInvisibleBoundaries();

    // Plano de agua continuo que inunda las hondonadas bajas (y = 0.05) y rodea la isla
    const waterGeo = new THREE.PlaneGeometry(600, 600);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a3630, // Verde azulado turbio de pantano
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.name = 'WaterMesh';
    this.waterMesh.position.y = waterLevel; // Nivel del agua a 0.05
    this.scene.add(this.waterMesh);
  }

  /**
   * Genera una textura procedural sutil de pasto optimizada para equipos de bajos recursos.
   */
  private createSubtleGrassTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Color base verde pasto neutro
      ctx.fillStyle = '#687c5b';
      ctx.fillRect(0, 0, size, size);

      // Gradiente suave de fondo para profundidad organica
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, 'rgba(80, 100, 70, 0.3)');
      grad.addColorStop(0.5, 'rgba(115, 135, 100, 0.2)');
      grad.addColorStop(1, 'rgba(70, 90, 60, 0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Briznas y microdetalles sutiles de hierba
      ctx.fillStyle = 'rgba(130, 155, 115, 0.22)';
      for (let i = 0; i < 450; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = 1.0 + Math.random() * 1.5;
        const h = 2.0 + Math.random() * 4.0;
        ctx.fillRect(x, y, w, h);
      }

      // Motas oscuras de tierra y base de raices
      ctx.fillStyle = 'rgba(45, 55, 38, 0.18)';
      for (let i = 0; i < 350; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 0.8 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Toques claros de iluminacion en la hierba
      ctx.fillStyle = 'rgba(155, 180, 135, 0.15)';
      for (let i = 0; i < 280; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = 1.0 + Math.random() * 1.0;
        const h = 2.0 + Math.random() * 3.0;
        ctx.fillRect(x, y, w, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Genera 4 muros de colision invisibles alrededor del perimetro para confinar al jugador en la isla.
   */
  private createInvisibleBoundaries(): void {
    const limit = 118;
    const height = 35;
    const thickness = 4;
    const length = 240;

    const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });

    // Muro Norte (z = -limit)
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), invisibleMaterial);
    northWall.position.set(0, height / 2, -limit);
    northWall.name = 'BoundaryWall_North';
    this.collidersGroup.add(northWall);

    // Muro Sur (z = +limit)
    const southWall = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), invisibleMaterial);
    southWall.position.set(0, height / 2, limit);
    southWall.name = 'BoundaryWall_South';
    this.collidersGroup.add(southWall);

    // Muro Oeste (x = -limit)
    const westWall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, length), invisibleMaterial);
    westWall.position.set(-limit, height / 2, 0);
    westWall.name = 'BoundaryWall_West';
    this.collidersGroup.add(westWall);

    // Muro Este (x = +limit)
    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, length), invisibleMaterial);
    eastWall.position.set(limit, height / 2, 0);
    eastWall.name = 'BoundaryWall_East';
    this.collidersGroup.add(eastWall);
  }

  /**
   * Crea el entorno acuatico para el escenario Circo (isla flotante donde las rocas inferiores
   * quedan sumergidas hasta la mitad a Y = -68.0).
   */
  public buildCircoEnvironment(): void {
    this.baseWaterY = -68.0;

    // Gran plano de agua oceano circundante
    const waterGeo = new THREE.PlaneGeometry(1600, 1600, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0c3452, // Azul turquesa/marino profundo con tono nocturno
      roughness: 0.12,
      metalness: 0.28,
      transparent: true,
      opacity: 0.88,
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(0, this.baseWaterY, 0);
    this.waterMesh.name = 'CircoWaterPlane';
    this.scene.add(this.waterMesh);
  }

  /**
   * Carga el archivo JSON del mapa, descarga los modelos GLB necesarios e instancia la escena.
   */
  public async loadWorldModels(onProgress?: (progress: WorldBuildProgress) => void): Promise<void> {
    const mapUrl = this.config.mapUrl || '/maps/pantano-map.json';
    const basePath = this.config.modelsBasePath || '/models/pantano/';

    try {
      const res = await fetch(mapUrl);
      if (res.ok) {
        this.mapData = (await res.json()) as MapData;
        console.log(`[INFO] Mapa ${mapUrl} cargado exitosamente (${this.mapData.objects.length} objetos).`);
      } else {
        console.warn(`[WARN] No se encontro ${mapUrl}, se utilizara plantilla vacia.`);
      }
    } catch (err) {
      console.error(`[ERROR] Error al cargar ${mapUrl}:`, err);
    }

    // Identificar modelos unicos referenciados en el mapa
    const uniqueModels = Array.from(new Set(this.mapData.objects.map((o) => o.model)));

    let loadedCount = 0;
    for (const modelFile of uniqueModels) {
      if (onProgress) {
        onProgress({
          loaded: loadedCount,
          total: uniqueModels.length,
          currentAsset: modelFile,
        });
      }

      try {
        const gltf = await this.loadGLTF(`${basePath}${modelFile}`);

        // Ocultar mallas designadas exclusivamente para colisiones fisicas (ej. COLLIDER_Limites)
        gltf.scene.traverse((child) => {
          if (child.name && (child.name.includes('COLLIDER') || child.name.toLowerCase().includes('collider'))) {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshBasicMaterial({ visible: false });
            }
          }
        });

        this.loadedPrototypes.set(modelFile, gltf.scene);
        loadedCount++;
      } catch (err) {
        console.error(`[ERROR] Fallo al cargar prototipo 3D: ${modelFile}`, err);
      }
    }

    if (onProgress) {
      onProgress({
        loaded: uniqueModels.length,
        total: uniqueModels.length,
        currentAsset: 'Generando colisiones precisas (BVH)...',
      });
    }

    // Instanciar objetos a partir del mapa cargado (omitiendo coleccionables estaticos ya que provienen de la partida)
    for (const objDef of this.mapData.objects) {
      if (objDef.category === 'collectible') continue;
      this.instantiateObject(objDef, false);
    }

    // Generar malla BVH consolidada para colisiones del jugador
    this.rebuildCollisionBVH();
  }

  private loadGLTF(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf: GLTF) => resolve(gltf),
        undefined,
        (err: unknown) => reject(err)
      );
    });
  }

  /**
   * Instancia un objeto en la escena segun su definicion de mapa.
   */
  public instantiateObject(def: MapObjectDefinition, rebuildBVH = true): THREE.Group | null {
    const proto = this.loadedPrototypes.get(def.model);
    if (!proto) {
      console.warn(`[WARN] Modelo no cargado en cache para instanciacion: ${def.model}`);
      return null;
    }

    const instance = proto.clone(true);
    instance.name = `MapObj_${def.id}`;
    instance.userData = {
      mapObjectId: def.id,
      model: def.model,
      category: def.category,
      name: def.name,
    };

    instance.position.set(def.position[0], def.position[1], def.position[2]);
    instance.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
    instance.scale.set(def.scale[0], def.scale[1], def.scale[2]);

    // Ocultar mallas designadas como colisionadores fisicos (ej. COLLIDER_Limites)
    instance.traverse((child) => {
      if (child.name && (child.name.includes('COLLIDER') || child.name.toLowerCase().includes('collider'))) {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = new THREE.MeshBasicMaterial({ visible: false });
        }
      }
    });

    instance.updateMatrixWorld(true);

    if (def.category === 'collectible') {
      this.scene.add(instance);
      if (this.collectiblesManager) {
        this.collectiblesManager.registerItem(
          def.id,
          def.name || def.id,
          instance,
          instance.position.clone()
        );
      }
    } else if (def.category === 'portal') {
      this.scene.add(instance);
      if (this.collectiblesManager) {
        this.collectiblesManager.registerPortal(instance);
      }
    } else {
      // Estructuras, vegetacion y props forman parte del arbol de colisiones fisicas
      this.collidersGroup.add(instance);
    }

    this.instantiatedObjects.set(def.id, { definition: def, object: instance });

    if (rebuildBVH) {
      this.rebuildCollisionBVH();
    }

    return instance;
  }

  /**
   * Elimina un objeto del mapa y de la escena.
   */
  public removeObject(id: string): boolean {
    const entry = this.instantiatedObjects.get(id);
    if (!entry) return false;

    const { definition, object } = entry;

    if (definition.category === 'structure' || definition.category === 'vegetation') {
      this.collidersGroup.remove(object);
    } else {
      this.scene.remove(object);
    }

    this.instantiatedObjects.delete(id);
    this.mapData.objects = this.mapData.objects.filter((o) => o.id !== id);

    this.rebuildCollisionBVH();
    return true;
  }

  /**
   * Actualiza la posicion, rotacion y escala de un objeto en tiempo real.
   */
  public updateObjectTransform(
    id: string,
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number]
  ): void {
    const entry = this.instantiatedObjects.get(id);
    if (!entry) return;

    entry.object.position.set(pos[0], pos[1], pos[2]);
    entry.object.rotation.set(rot[0], rot[1], rot[2]);
    entry.object.scale.set(scale[0], scale[1], scale[2]);
    entry.object.updateMatrixWorld(true);

    entry.definition.position = pos;
    entry.definition.rotation = rot;
    entry.definition.scale = scale;
  }

  /**
   * Reconstruye la estructura de colision BVH fusionando el terreno y las estructuras.
   */
  public rebuildCollisionBVH(): THREE.Mesh | null {
    if (!this.terrainMesh && this.collidersGroup.children.length === 0) {
      console.warn('[WARN] No hay terreno ni objetos en collidersGroup para generar BVH.');
      return null;
    }

    // Crear un contenedor temporal que consolide terreno y objetos solidos
    const mergeContainer = new THREE.Group();
    if (this.terrainMesh) {
      mergeContainer.add(this.terrainMesh.clone(false));
    }

    // Clonar mallas del collidersGroup preservando su matriz mundial
    this.collidersGroup.updateMatrixWorld(true);
    for (const child of this.collidersGroup.children) {
      mergeContainer.add(child.clone(true));
    }
    mergeContainer.updateMatrixWorld(true);

    // Filtrar objetos desactivados (visible = false) para que no formen parte de las colisiones
    // (Preserva objetos como COLLIDER_Limites que tienen visible = true con material invisible)
    const hiddenObjects: THREE.Object3D[] = [];
    mergeContainer.traverse((c) => {
      if (!c.visible) {
        hiddenObjects.push(c);
      }
    });
    for (const hidden of hiddenObjects) {
      hidden.parent?.remove(hidden);
    }
    mergeContainer.updateMatrixWorld(true);

    try {
      const generator = new StaticGeometryGenerator(mergeContainer);
      generator.attributes = ['position']; // Optimizacion: unicamente vertices para colision
      const mergedGeometry = generator.generate();

      mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, {
        targetLeafSize: 10,
        strategy: 0,
      });

      if (this.colliderMesh) {
        this.colliderMesh.geometry.dispose();
      }

      this.colliderMesh = new THREE.Mesh(mergedGeometry);
      console.log(
        `[INFO] BVH de colisiones generado exitosamente (${mergedGeometry.attributes.position.count / 3} triangulos).`
      );
      return this.colliderMesh;
    } catch (err) {
      console.error('[ERROR] Error al generar arbol BVH de colisiones:', err);

      // Fallback de emergencia si existe terreno base
      if (this.terrainMesh) {
        try {
          const fallbackGeo = this.terrainMesh.geometry.clone();
          fallbackGeo.boundsTree = new MeshBVH(fallbackGeo, { targetLeafSize: 10, strategy: 0 });
          if (this.colliderMesh) {
            this.colliderMesh.geometry.dispose();
          }
          this.colliderMesh = new THREE.Mesh(fallbackGeo);
          console.warn('[WARN] BVH de colisiones generado sobre el terreno base como respaldo.');
          return this.colliderMesh;
        } catch (fallbackErr) {
          console.error('[ERROR] Fallo critico en respaldo de colision de terreno:', fallbackErr);
          return null;
        }
      }
      return null;
    }
  }

  public getColliderMesh(): THREE.Mesh | null {
    return this.colliderMesh;
  }

  public getMapData(): MapData {
    return {
      version: this.mapData.version || '1.0',
      mapName: this.mapData.mapName || this.config.mapName || 'pantano',
      objects: Array.from(this.instantiatedObjects.values())
        .map((entry) => entry.definition)
        .filter((def) => def.category !== 'collectible'),
    };
  }

  public getObjectById(id: string): { definition: MapObjectDefinition; object: THREE.Group } | undefined {
    return this.instantiatedObjects.get(id);
  }

  public getAvailableModels(): string[] {
    return Array.from(this.loadedPrototypes.keys());
  }

  public getTerrainMesh(): THREE.Mesh | null {
    return this.terrainMesh;
  }

  public getCollidersGroup(): THREE.Group {
    return this.collidersGroup;
  }

  /**
   * Actualiza el efecto de micro-ondulacion de la superficie del agua.
   */
  public update(elapsedTime: number): void {
    if (this.waterMesh) {
      // Movimiento ondulatorio sutil del agua adaptado a la altura del nivel de agua
      const waveAmplitude = this.config.mapName === 'circo' ? 0.08 : 0.006;
      this.waterMesh.position.y = this.baseWaterY + Math.sin(elapsedTime * 1.4) * waveAmplitude;
    }
  }

  public dispose(): void {
    if (this.colliderMesh) {
      this.colliderMesh.geometry.dispose();
      this.colliderMesh = null;
    }
    if (this.grassTexture) {
      this.grassTexture.dispose();
      this.grassTexture = null;
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    this.loadedPrototypes.clear();
    this.instantiatedObjects.clear();
  }
}
