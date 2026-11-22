import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

/**
 * Esquema de sincronizacion de estado para jugadores en la sala del pantano.
 */
export class PlayerSchema extends Schema {
  @type('string') userId: string = '';
  @type('string') fullName: string = '';
  @type('string') teamId: string = '';
  @type('string') teamName: string = '';
  @type('string') teamColor: string = '#3b82f6';
  @type('string') avatarModel: string = 'female';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
  @type('number') ry: number = 0;
  @type('string') animState: string = 'idle';
}

/**
 * Esquema de sincronizacion de estado para equipos en la partida.
 */
export class TeamStateSchema extends Schema {
  @type('string') teamId: string = '';
  @type('string') name: string = '';
  @type('string') color: string = '#3b82f6';
  @type('number') score: number = 0;
  @type(['string']) collectedTypes: ArraySchema<string> = new ArraySchema<string>();
  @type('boolean') portalActive: boolean = false;
}

/**
 * Esquema de sincronizacion para objetos coleccionables de la partida.
 */
export class CollectibleSchema extends Schema {
  @type('string') id: string = '';
  @type('string') type: string = '';
  @type('number') posX: number = 0;
  @type('number') posZ: number = 0;
  @type('boolean') collected: boolean = false;
  @type('string') collectedByTeamId: string = '';
}

/**
 * Estado global sincronizado de la sala de juego en el pantano.
 */
export class SwampState extends Schema {
  @type('string') matchId: string = '';
  @type('number') timeRemaining: number = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: TeamStateSchema }) teams = new MapSchema<TeamStateSchema>();
  @type({ map: CollectibleSchema }) collectibles = new MapSchema<CollectibleSchema>();
}
