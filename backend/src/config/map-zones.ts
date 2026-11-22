/**
 * Configuracion geografica y zonas seguras para la generacion procedural de objetos en la Isla del Pantano.
 */

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ExclusionZone {
  name: string;
  centerX: number;
  centerZ: number;
  radius: number;
}

export interface MapZonesConfig {
  bounds: MapBounds;
  exclusionZones: ExclusionZone[];
  minDistanceBetweenItems: number;
  maxSpawnRetries: number;
}

export const PANTANO_MAP_CONFIG: MapZonesConfig = {
  // Limites seguros de tierra firme con margen de seguridad respecto al perimetro exterior
  bounds: {
    minX: -112,
    maxX: 112,
    minZ: -112,
    maxZ: 112,
  },

  // Zonas de exclusion donde queda estrictamente prohibida la generacion de coleccionables
  exclusionZones: [
    {
      name: 'Sala_Bienvenida',
      centerX: 0,
      centerZ: 80,
      radius: 35,
    },
    {
      name: 'Zona_TP',
      centerX: 60,
      centerZ: -75,
      radius: 25,
    },
  ],

  // Separacion minima obligatoria entre coleccionables para asegurar dispersion equitativa
  minDistanceBetweenItems: 15,

  // Limite de reintentos por objeto para evitar bucles infinitos durante el muestreo aleatorio
  maxSpawnRetries: 250,
};
