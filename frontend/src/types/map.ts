/**
 * Definicion de tipos para la serializacion y gestion del mapa estatico 3D.
 */

export type MapObjectCategory = 'structure' | 'vegetation' | 'collectible' | 'portal';

export interface MapObjectDefinition {
  id: string;
  model: string;
  category: MapObjectCategory;
  name?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface MapData {
  version: string;
  mapName: string;
  objects: MapObjectDefinition[];
}
