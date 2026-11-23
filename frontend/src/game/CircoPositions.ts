/**
 * Matriz estatica de posiciones para las fichas de los jugadores en el escenario Circo.
 * Las coordenadas son fijas en todas las partidas para cada casilla del circuito (6 posiciones: indices 0 a 5).
 * Lo que cambia durante la partida y se persiste en el servidor es el indice de avance (tokenPosition: 0..5).
 * Al alcanzar la posicion 5 (sexta casilla), se activa la animacion de la Corona y se otorga una oportunidad.
 */

export interface TokenCoord {
  step: number;
  x: number;
  y: number;
  z: number;
}

export const CIRCO_TOKEN_POSITIONS: Record<number, TokenCoord[]> = {
  // Puesto 1: FichaPlayer_Azul (Modelo: ficha_azul_1)
  1: [
    { step: 0, x: 49.77, y: -12.3, z: -25.71 },
    { step: 1, x: 52.8, y: -12.3, z: -29.23 },
    { step: 2, x: 55.14, y: -12.3, z: -31.41 },
    { step: 3, x: 57.54, y: -12.3, z: -35.15 },
    { step: 4, x: 58.04, y: -12.3, z: -39.09 },
    { step: 5, x: 59, y: -12.3, z: -42.61 }, // Meta (Corona)
  ],

  // Puesto 2: FichaPlayer_Amarillo (Modelo: ficha_amarillo_1)
  2: [
    { step: 0, x: 59.76, y: -12.3, z: -47.32 },
    { step: 1, x: 58.5, y: -12.3, z: -51.37 },
    { step: 2, x: 57.68, y: -12.3, z: -55.1 },
    { step: 3, x: 55.7, y: -12.3, z: -58.46 },
    { step: 4, x: 52.53, y: -12.3, z: -61.88 },
    { step: 5, x: 49.95, y: -12.3, z: -64.14 }, // Meta (Corona)
  ],

  // Puesto 3: FichaPlayer_AmarilloClaro (Modelo: ficha_amarilloclaro_1)
  3: [
    { step: 0, x: 45.66, y: -12.3, z: -66.79 },
    { step: 1, x: 42.02, y: -12.3, z: -67.89 },
    { step: 2, x: 38.42, y: -12.3, z: -68.99 },
    { step: 3, x: 33.72, y: -12.3, z: -69.06 },
    { step: 4, x: 30.6, y: -12.3, z: -67.81 },
    { step: 5, x: 26.3, y: -12.3, z: -66.66 }, // Meta (Corona)
  ],

  // Puesto 4: FichaPlayer_VerdeClaro (Modelo: ficha_verdeclaro_1)
  4: [
    { step: 0, x: 12.34, y: -12.3, z: -43.36 },
    { step: 1, x: 19.46, y: -12.3, z: -61.5 },
    { step: 2, x: 16.51, y: -12.3, z: -58.92 },
    { step: 3, x: 14.84, y: -12.3, z: -55.34 },
    { step: 4, x: 13.58, y: -12.3, z: -51.5 },
    { step: 5, x: 12.48, y: -12.3, z: -47.65 }, // Meta (Corona)
  ],

  // Puesto 5: FichaPlayer_MoradoClaro (Modelo: ficha_moradoclaro_1)
  5: [
    { step: 0, x: 22.1, y: -12.3, z: -64.82 },
    { step: 1, x: 13.36, y: -12.3, z: -39.07 },
    { step: 2, x: 14.48, y: -12.3, z: -35.34 },
    { step: 3, x: 16.59, y: -12.3, z: -31.72 },
    { step: 4, x: 19.4, y: -12.3, z: -28.93 },
    { step: 5, x: 22.04, y: -12.3, z: -26.15 }, // Meta (Corona)
  ],

  // Puesto 6: FichaPlayer_Rojo (Modelo: ficha_rojo_1)
  6: [
    { step: 0, x: 25.87, y: -12.3, z: -27.35 },
    { step: 1, x: 30.32, y: -12.3, z: -22.64 },
    { step: 2, x: 34.1, y: -12.3, z: -21.69 },
    { step: 3, x: 38.16, y: -12.3, z: -21.21 },
    { step: 4, x: 42.02, y: -12.3, z: -22.36 },
    { step: 5, x: 45.72, y: -12.3, z: -23.51 }, // Meta (Corona)
  ],
};

/**
 * Obtiene la coordenada 3D exacta para un puesto y paso determinado.
 * Indices validos de 0 a 5 (6 posiciones en total).
 */
export function getTokenPositionCoord(seat: number, step: number): { x: number; y: number; z: number } {
  const seatPositions = CIRCO_TOKEN_POSITIONS[seat] || CIRCO_TOKEN_POSITIONS[1];
  const clampedStep = Math.max(0, Math.min(step, 5));
  const coord = seatPositions.find((c) => c.step === clampedStep) || seatPositions[0];
  return { x: coord.x, y: coord.y, z: coord.z };
}
