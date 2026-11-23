import { Schema, MapSchema, type } from '@colyseus/schema';
import { PlayerSchema } from './SwampState.js';

export { PlayerSchema };

/**
 * Esquema de sincronizacion de estado para equipos en el escenario Circo.
 */
export class CircoTeamSchema extends Schema {
  @type('string') teamId: string = '';
  @type('string') name: string = '';
  @type('string') color: string = '#3b82f6';
  @type('number') score: number = 0;
  @type('number') seat: number = 0;
  @type('string') representativeId: string = '';
  @type('string') representativeName: string = '';
  @type('number') tokenPosition: number = 0;
  @type('number') opportunities: number = 0;
}

/**
 * Estado global sincronizado de la sala multijugador del Circo.
 */
export class CircoState extends Schema {
  @type('string') matchId: string = '';
  @type('string') phase: string = 'SELECTING_PODIUMS'; // "SELECTING_PODIUMS" | "PLAYING" | "PODIUM" | "FINISHED"
  @type('number') timeRemaining: number = 0;
  @type('number') questionTimeRemaining: number = 0;
  @type('number') currentTurnSeat: number = 1;
  @type('string') turnStep: string = 'IDLE'; // "IDLE" | "SPINNING" | "CARD_ANIMATING" | "QUESTION_ACTIVE" | "GUESS_IT_ORDERING" | "GUESS_IT_ANSWERING" | "SHARK_SELECTING_TARGET" | "CROWN_ANIMATING"
  @type('number') arrowRotationY: number = 0;
  @type('string') activeCardType: string = ''; // "" | "PREGUNTA" | "ADIVINALO" | "TIBURON_ROJO" | "TIBURON_AZUL" | "CORONA"
  @type('string') winningTeamId: string = '';
  @type('string') winningTeamName: string = '';
  @type('string') victoryReason: string = '';
  @type('number') podiumTimeRemaining: number = 0;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: CircoTeamSchema }) teams = new MapSchema<CircoTeamSchema>();
}
