import fs from 'fs';
import path from 'path';
import { Room, Client, ServerError, Delayed } from 'colyseus';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { JwtUtils } from '../utils/jwt.utils.js';
import {
  CircoState,
  PlayerSchema,
  CircoTeamSchema,
} from './CircoState.js';

const TEAM_PALETTE = [
  '#3b82f6', // Azul
  '#f59e0b', // Amarillo
  '#fde047', // Amarillo Claro
  '#86efac', // Verde Claro
  '#c084fc', // Morado Claro
  '#ef4444', // Rojo
];

/**
 * Definicion de un sector de la ruleta con su rango angular en grados y su centro en radianes.
 */
export interface RouletteSector {
  id: number;
  cardType: 'PREGUNTA' | 'ADIVINALO' | 'TIBURON_ROJO' | 'TIBURON_AZUL';
  color: string;
  minDeg: number;
  maxDeg: number;
  centerRad?: number;
}

/**
 * Matriz de configuracion de los 12 sectores de la ruleta (30° por sector = 360° total).
 * Cada sector mapea el color y tipo de carta medidos en el modelo 3D.
 * Se incluyen los grados continuos (0° a 360°) y el angulo central exacto en radianes Three.js.
 */
export const ROULETTE_SECTORS: RouletteSector[] = [
  { id: 1, cardType: 'PREGUNTA', color: 'VERDE', minDeg: 17.4, maxDeg: 47.6, centerRad: 0.567 }, // ~0.304 a 0.831 rad
  { id: 2, cardType: 'TIBURON_AZUL', color: 'AZUL', minDeg: 47.6, maxDeg: 77.6, centerRad: 1.093 }, // ~0.831 a 1.355 rad
  { id: 3, cardType: 'TIBURON_ROJO', color: 'ROJO', minDeg: 77.6, maxDeg: 107.6, centerRad: 1.605 }, // ~1.355 a 1.855 rad (pi - 1.286)
  { id: 4, cardType: 'PREGUNTA', color: 'VERDE', minDeg: 107.6, maxDeg: 137.6, centerRad: 2.118 }, // ~1.855 a 2.381 rad (pi - 0.760)
  { id: 5, cardType: 'ADIVINALO', color: 'AMARILLO', minDeg: 137.6, maxDeg: 167.6, centerRad: 2.644 }, // ~2.381 a 2.907 rad (pi - 0.234)
  { id: 6, cardType: 'TIBURON_AZUL', color: 'AZUL', minDeg: 167.6, maxDeg: 197.6, centerRad: 3.170 }, // ~2.907 a 3.432 rad
  { id: 7, cardType: 'PREGUNTA', color: 'VERDE', minDeg: 197.6, maxDeg: 227.6, centerRad: 3.694 }, // ~3.432 a 3.956 rad
  { id: 8, cardType: 'ADIVINALO', color: 'AMARILLO', minDeg: 227.6, maxDeg: 257.6, centerRad: 4.220 }, // ~3.956 a 4.483 rad
  { id: 9, cardType: 'PREGUNTA', color: 'VERDE', minDeg: 257.6, maxDeg: 287.6, centerRad: 4.745 }, // ~4.483 a 5.008 rad
  { id: 10, cardType: 'TIBURON_ROJO', color: 'ROJO', minDeg: 287.6, maxDeg: 317.6, centerRad: 5.271 }, // ~5.008 a 5.535 rad
  { id: 11, cardType: 'PREGUNTA', color: 'VERDE', minDeg: 317.6, maxDeg: 347.6, centerRad: 5.797 }, // ~5.535 a 6.060 rad
  { id: 12, cardType: 'ADIVINALO', color: 'AMARILLO', minDeg: 347.6, maxDeg: 377.4, centerRad: 0.040 }, // ~6.060 a 0.304 rad
];

export const ROULETTE_SECTORS_DEGREES = ROULETTE_SECTORS;

/**
 * Calcula el angulo objetivo en radianes para un sector.
 * Si cuenta con centerRad precalculado, lo utiliza directamente; de lo contrario,
 * interpola el punto medio entre minDeg y maxDeg convirtiendolo a radianes.
 */
export function calculateSectorTargetRadians(sector: RouletteSector): number {
  if (typeof sector.centerRad === 'number') {
    return sector.centerRad;
  }
  const midDeg = (sector.minDeg + sector.maxDeg) / 2;
  const degNormalized = ((midDeg % 360) + 360) % 360;
  return (degNormalized * Math.PI) / 180;
}

interface QuestionOption {
  key: string;
  texto: string;
}

interface QuestionData {
  id: number;
  pregunta: string;
  opciones: QuestionOption[];
  respuesta_correcta: string;
}

interface AuthContext {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  team: {
    id: string;
    name: string;
    score: number;
  };
  avatarModel?: string;
}

function parseCookieHeader(rawCookie?: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawCookie) return result;
  const parts = rawCookie.split(';');
  for (const part of parts) {
    const pair = part.trim().split('=');
    const key = pair[0];
    if (key) {
      result[key] = decodeURIComponent(pair.slice(1).join('='));
    }
  }
  return result;
}

/**
 * Sala multijugador Colyseus para el escenario del Circo (Ruleta, Atriles y Preguntas).
 */
export class CircoRoom extends Room<{ state: CircoState }> {
  public maxClients = 36;
  private timerInterval?: Delayed;
  private questionTimerInterval?: Delayed;
  private questionsBank: QuestionData[] = [];
  private usedQuestionIds: Set<number> = new Set();
  private currentActiveQuestionId: number | null = null;

  private static activeRoomsByMatchId: Map<string, CircoRoom> = new Map();

  public static closeRoomForMatch(matchId: string, reason: string = 'Partida finalizada por un administrador.'): void {
    const room = CircoRoom.activeRoomsByMatchId.get(matchId);
    if (room) {
      console.log(`[INFO] Forzando cierre de CircoRoom ${room.roomId} para la partida ${matchId}: ${reason}`);
      room.broadcast('match_terminated', { message: reason });
      setTimeout(() => {
        room.disconnect();
      }, 500);
      CircoRoom.activeRoomsByMatchId.delete(matchId);
    }
  }

  public async onAuth(
    _client: Client,
    options: { matchId?: string; token?: string },
    context?: any
  ): Promise<AuthContext> {
    const matchId = options?.matchId;
    if (!matchId) {
      console.warn('[WARN] Intento de conexion a CircoRoom sin matchId');
      throw new ServerError(400, 'Identificador de partida matchId no especificado.');
    }

    let token = options?.token;
    if (!token && context) {
      const rawCookie =
        (typeof context.headers?.get === 'function'
          ? context.headers.get('cookie')
          : context.headers?.cookie) ||
        context.rawHeaders?.find?.((_: any, idx: number, arr: any[]) =>
          arr[idx - 1]?.toLowerCase?.() === 'cookie'
        );

      const cookies = parseCookieHeader(rawCookie);
      token = cookies['auth_token'];
    }

    if (!token) {
      console.warn(`[WARN] Conexion rechazada en CircoRoom (matchId: ${matchId}): Token ausente.`);
      throw new ServerError(401, 'Sesion no iniciada o token de autenticacion ausente.');
    }

    let decoded: { sub: string };
    try {
      decoded = JwtUtils.verifyToken(token);
    } catch {
      console.warn(`[WARN] Conexion rechazada en CircoRoom (matchId: ${matchId}): Token invalido.`);
      throw new ServerError(401, 'Token de sesion invalido o expirado.');
    }

    const userId = decoded.sub;

    let participant = await prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: { matchId, userId },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true, score: true } },
      },
    });

    if (!participant) {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { teams: true },
      });

      if (match && match.creatorId === userId) {
        const defaultTeam =
          match.teams[0] ||
          (await prisma.team.create({
            data: {
              name: 'Equipo 1',
              matchId,
            },
          }));

        participant = await prisma.matchParticipant.create({
          data: {
            matchId,
            userId,
            teamId: defaultTeam.id,
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            team: { select: { id: true, name: true, score: true } },
          },
        });
      } else {
        console.warn(`[WARN] Conexion rechazada en CircoRoom (matchId: ${matchId}): Usuario ${userId} no inscrito.`);
        throw new ServerError(403, 'El usuario no esta inscrito como participante en esta partida.');
      }
    }

    if (!participant.team) {
      let team = await prisma.team.findFirst({
        where: { matchId },
      });

      if (!team) {
        team = await prisma.team.create({
          data: {
            name: 'Equipo 1',
            matchId,
          },
        });
      }

      participant = await prisma.matchParticipant.update({
        where: { id: participant.id },
        data: { teamId: team.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          team: { select: { id: true, name: true, score: true } },
        },
      });
    }

    let avatarModel = 'female';
    try {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT "avatarModel" FROM "User" WHERE id = $1 LIMIT 1',
        userId
      ).catch(() => [])) as Array<{ avatarModel: string }>;
      if (rows[0]?.avatarModel === 'man') {
        avatarModel = 'man';
      }
    } catch {
      avatarModel = 'female';
    }

    return {
      userId,
      user: participant.user,
      team: participant.team!,
      avatarModel,
    };
  }

  public async onCreate(options: { matchId: string }): Promise<void> {
    const matchId = options.matchId;
    this.setState(new CircoState());
    this.state.matchId = matchId;
    this.state.timeRemaining = env.CIRCO_TIME_MINUTES * 60;
    this.state.questionTimeRemaining = 0;
    this.state.turnStep = 'IDLE';

    CircoRoom.activeRoomsByMatchId.set(matchId, this);

    // Cargar banco de preguntas en memoria
    this.loadQuestionsBank();

    // Cargar datos de la partida y equipos desde la base de datos
    await this.initializeMatchData(matchId);

    // Registrar handlers de mensajes
    this.setupMessageHandlers();

    console.log(`[INFO] CircoRoom instanciada para la partida ${matchId} con fase ${this.state.phase}`);
  }

  private loadQuestionsBank(): void {
    try {
      const candidates = [
        path.resolve(__dirname, '../data/circo-questions.json'),
        path.resolve(__dirname, '../../src/data/circo-questions.json'),
        path.resolve(process.cwd(), 'src/data/circo-questions.json'),
        path.resolve(process.cwd(), 'backend/src/data/circo-questions.json'),
      ];

      const questionsFilePath = candidates.find((p) => fs.existsSync(p));

      if (questionsFilePath && fs.existsSync(questionsFilePath)) {
        const raw = fs.readFileSync(questionsFilePath, 'utf8');
        this.questionsBank = JSON.parse(raw);
        console.log(`[INFO] Banco de preguntas de Circo cargado exitosamente (${this.questionsBank.length} preguntas) desde ${questionsFilePath}`);
      } else {
        console.error('[ERROR] No se encontro el archivo circo-questions.json en las rutas candidatas.');
      }
    } catch (err) {
      console.error('[ERROR] Error al cargar preguntas del Circo:', err);
    }
  }

  private async initializeMatchData(matchId: string): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teams: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!match) {
      throw new ServerError(404, `Partida ${matchId} no encontrada.`);
    }

    this.state.currentTurnSeat = match.circoCurrentTurnSeat || 1;
    this.state.arrowRotationY = match.circoArrowRotationY || 0;

    let assignedSeatsCount = 0;
    const totalTeams = match.teams.length;

    match.teams.forEach((t, idx) => {
      const teamSchema = new CircoTeamSchema();
      teamSchema.teamId = t.id;
      teamSchema.name = t.name;
      teamSchema.color = TEAM_PALETTE[idx % TEAM_PALETTE.length];
      teamSchema.score = t.score;
      teamSchema.seat = t.circoSeat || 0;
      teamSchema.representativeId = t.circoRepresentativeId || '';
      teamSchema.tokenPosition = t.circoTokenPosition || 0;
      teamSchema.opportunities = t.circoOpportunities || 0;

      if (t.circoRepresentativeId) {
        const rep = t.members.find((m) => m.userId === t.circoRepresentativeId);
        if (rep) {
          teamSchema.representativeName = `${rep.user.firstName} ${rep.user.lastName}`.trim();
        }
      }

      if (teamSchema.seat > 0) {
        assignedSeatsCount++;
      }

      this.state.teams.set(t.id, teamSchema);
    });

    // Si todos los equipos tienen atril asignado, la partida puede comenzar directamente
    if (totalTeams > 0 && assignedSeatsCount >= totalTeams) {
      this.state.phase = 'PLAYING';
      this.startMatchTimer();
    } else {
      this.state.phase = 'SELECTING_PODIUMS';
    }
  }

  private startMatchTimer(): void {
    if (this.timerInterval) return;

    this.timerInterval = this.clock.setInterval(() => {
      if (this.state.phase !== 'PLAYING') return;

      if (this.state.timeRemaining > 0) {
        this.state.timeRemaining -= 1;
      } else {
        this.state.phase = 'FINISHED';
        this.timerInterval?.clear();
        this.broadcast('match_finished', { message: 'El tiempo de juego ha finalizado.' });
        console.log(`[INFO] Partida de Circo ${this.state.matchId} finalizada por limite de tiempo.`);
      }
    }, 1000);
  }

  private setupMessageHandlers(): void {
    // 1. Reclamar puesto en el atril (Fase SELECTING_PODIUMS)
    this.onMessage('claim_seat', async (client, data: { seat: number }) => {
      const auth = client.auth as AuthContext;
      if (!auth) return;

      if (this.state.phase !== 'SELECTING_PODIUMS') {
        client.send('error', { message: 'La seleccion de atriles ya no esta activa.' });
        return;
      }

      const totalTeams = this.state.teams.size;
      const seat = Number(data.seat);

      if (isNaN(seat) || seat < 1 || seat > totalTeams) {
        client.send('error', { message: `El puesto debe estar entre 1 y ${totalTeams}.` });
        return;
      }

      // Validar si el puesto ya esta ocupado
      for (const [_, team] of this.state.teams.entries()) {
        if (team.seat === seat) {
          client.send('error', { message: `El puesto ${seat} ya ha sido ocupado por ${team.name}.` });
          return;
        }
      }

      // Validar si el equipo del jugador ya tiene puesto asignado
      const myTeam = this.state.teams.get(auth.team.id);
      if (!myTeam) {
        client.send('error', { message: 'Equipo no encontrado en la sala.' });
        return;
      }

      if (myTeam.seat > 0) {
        client.send('error', { message: `Tu equipo ya tiene asignado el Puesto ${myTeam.seat}.` });
        return;
      }

      // Asignar puesto y representante al equipo
      myTeam.seat = seat;
      myTeam.representativeId = auth.userId;
      myTeam.representativeName = `${auth.user.firstName} ${auth.user.lastName}`.trim();

      // Persistir en Prisma
      await prisma.team.update({
        where: { id: auth.team.id },
        data: {
          circoSeat: seat,
          circoRepresentativeId: auth.userId,
        },
      });

      console.log(`[INFO] Puesto ${seat} asignado a ${myTeam.name} (Representante: ${myTeam.representativeName})`);

      this.broadcast('seat_claimed', {
        teamId: myTeam.teamId,
        teamName: myTeam.name,
        seat: myTeam.seat,
        representativeId: myTeam.representativeId,
        representativeName: myTeam.representativeName,
      });

      // Verificar si todos los equipos tienen puesto asignado
      let allAssigned = true;
      for (const [_, team] of this.state.teams.entries()) {
        if (team.seat <= 0) {
          allAssigned = false;
          break;
        }
      }

      if (allAssigned) {
        this.state.phase = 'PLAYING';
        this.state.currentTurnSeat = 1;
        this.state.turnStep = 'IDLE';
        this.startMatchTimer();

        console.log(`[INFO] Todos los atriles han sido ocupados. Inicia fase PLAYING en Circo ${this.state.matchId}`);
        this.broadcast('phase_changed', {
          phase: 'PLAYING',
          currentTurnSeat: this.state.currentTurnSeat,
        });
      }
    });

    // 2. Girar la Ruleta (Fase PLAYING, turnStep IDLE)
    this.onMessage('spin_roulette', async (client) => {
      const auth = client.auth as AuthContext;
      if (!auth) return;

      if (this.state.phase !== 'PLAYING') {
        client.send('error', { message: 'La partida no esta en fase de juego activo.' });
        return;
      }

      if (this.state.turnStep !== 'IDLE') {
        client.send('error', { message: 'La ruleta ya se encuentra en movimiento o hay una carta activa.' });
        return;
      }

      // Buscar equipo del turno actual
      let currentTeam: CircoTeamSchema | null = null;
      for (const [_, team] of this.state.teams.entries()) {
        if (team.seat === this.state.currentTurnSeat) {
          currentTeam = team;
          break;
        }
      }

      if (!currentTeam) {
        client.send('error', { message: 'No se encontro el equipo del turno actual.' });
        return;
      }

      if (currentTeam.representativeId !== auth.userId) {
        client.send('error', { message: `Solo el representante de ${currentTeam.name} puede girar la ruleta en este turno.` });
        return;
      }

      // 1. Seleccionar un sector aleatorio de la matriz de sectores en grados
      const selectedSector =
        ROULETTE_SECTORS_DEGREES[Math.floor(Math.random() * ROULETTE_SECTORS_DEGREES.length)];

      // 2. Calcular el angulo en radianes dentro del intervalo en grados del sector
      const sectorAngleRad = calculateSectorTargetRadians(selectedSector);

      // 3. Calcular rotacion final: 2 vueltas completas y alineacion exacta con el sector
      const extraSpins = 2; // 2 vueltas completas para un giro pausado y suave
      const currentAngle = this.state.arrowRotationY;
      const currentTurns = Math.floor(currentAngle / (Math.PI * 2));
      let targetRotationY = (currentTurns + extraSpins) * Math.PI * 2 + sectorAngleRad;
      while (targetRotationY <= currentAngle + extraSpins * Math.PI * 2) {
        targetRotationY += Math.PI * 2;
      }

      this.state.arrowRotationY = targetRotationY;
      this.state.turnStep = 'SPINNING';
      this.state.activeCardType = '';

      // Persistir rotacion de la flecha en la partida
      await prisma.match.update({
        where: { id: this.state.matchId },
        data: { circoArrowRotationY: targetRotationY },
      });

      console.log(`[INFO] Giro de ruleta iniciado por ${currentTeam.name}. Destino: ${selectedSector.cardType} (${selectedSector.color})`);

      this.broadcast('roulette_spun', {
        teamName: currentTeam.name,
        targetRotationY,
        cardType: selectedSector.cardType,
      });

      // Duracion del giro de ruleta (~3.5 segundos)
      this.clock.setTimeout(async () => {
        this.state.turnStep = 'CARD_ANIMATING';
        this.state.activeCardType = selectedSector.cardType;

        this.broadcast('card_emerged', {
          cardType: selectedSector.cardType,
          teamName: currentTeam.name,
        });

        // Duracion de la animacion de elevacion de la carta (~3.0 segundos)
        this.clock.setTimeout(async () => {
          if (selectedSector.cardType !== 'PREGUNTA') {
            // Cartas no implementadas en Fase 5A: emitir placeholder y avanzar turno
            this.broadcast('card_placeholder', {
              teamName: currentTeam.name,
              cardType: selectedSector.cardType,
            });

            this.clock.setTimeout(() => {
              this.advanceToNextTurn();
            }, 2500);
          } else {
            // Carta PREGUNTA
            this.activateQuestionFlow(currentTeam);
          }
        }, 3000);
      }, 3500);
    });

    // 3. Responder pregunta activa
    this.onMessage('answer_question', async (client, data: { questionId: number; selectedOption: string }) => {
      const auth = client.auth as AuthContext;
      if (!auth) return;

      if (this.state.turnStep !== 'QUESTION_ACTIVE') {
        client.send('error', { message: 'No hay ninguna pregunta activa o se agoto el tiempo.' });
        return;
      }

      if (this.currentActiveQuestionId !== data.questionId) {
        client.send('error', { message: 'El identificador de pregunta no coincide con la pregunta activa.' });
        return;
      }

      let currentTeam: CircoTeamSchema | null = null;
      for (const [_, team] of this.state.teams.entries()) {
        if (team.seat === this.state.currentTurnSeat) {
          currentTeam = team;
          break;
        }
      }

      if (!currentTeam || currentTeam.representativeId !== auth.userId) {
        client.send('error', { message: 'Solo el representante del equipo en turno puede enviar la respuesta.' });
        return;
      }

      // Detener temporizador de pregunta
      this.questionTimerInterval?.clear();
      this.questionTimerInterval = undefined;
      this.state.questionTimeRemaining = 0;

      const question = this.questionsBank.find((q) => q.id === data.questionId);
      if (!question) {
        this.advanceToNextTurn();
        return;
      }

      const isCorrect = data.selectedOption.toLowerCase() === question.respuesta_correcta.toLowerCase();

      if (isCorrect) {
        currentTeam.score += 1;
        currentTeam.tokenPosition += 1;

        console.log(`[INFO] Respuesta CORRECTA de ${currentTeam.name}. Puntaje: ${currentTeam.score}, Ficha: ${currentTeam.tokenPosition}`);

        this.broadcast('question_result', {
          correct: true,
          teamName: currentTeam.name,
          selectedOption: data.selectedOption,
          correctOption: question.respuesta_correcta,
          score: currentTeam.score,
          tokenPosition: currentTeam.tokenPosition,
        });

        // Verificar regla de Corona / Oportunidad (posicion >= 5: sexta y ultima casilla de la matriz [0..5])
        if (currentTeam.tokenPosition >= 5) {
          currentTeam.tokenPosition = 5;
          this.state.turnStep = 'CROWN_ANIMATING';
          this.state.activeCardType = 'CORONA';
          currentTeam.opportunities += 1;

          await prisma.team.update({
            where: { id: currentTeam.teamId },
            data: {
              score: currentTeam.score,
              circoOpportunities: currentTeam.opportunities,
              circoTokenPosition: 5,
            },
          });

          console.log(`[INFO] ${currentTeam.name} alcanzo la casilla 5 (meta) y gano OPORTUNIDAD #${currentTeam.opportunities}!`);

          this.broadcast('opportunity_earned', {
            teamName: currentTeam.name,
            opportunities: currentTeam.opportunities,
          });

          // Animacion de corona dura ~4.0 segundos; al finalizar, se resetea la posicion a 0 para el proximo circuito
          this.clock.setTimeout(async () => {
            currentTeam.tokenPosition = 0;
            try {
              await prisma.team.update({
                where: { id: currentTeam.teamId },
                data: {
                  circoTokenPosition: 0,
                },
              });
            } catch (err) {
              console.error('[ERROR] Error al reiniciar posicion de ficha tras corona:', err);
            }
            this.advanceToNextTurn();
          }, 4000);
          return;
        }

        // Persistir avance en Prisma
        await prisma.team.update({
          where: { id: currentTeam.teamId },
          data: {
            score: currentTeam.score,
            circoTokenPosition: currentTeam.tokenPosition,
          },
        });

        this.clock.setTimeout(() => {
          this.advanceToNextTurn();
        }, 2000);
      } else {
        // Respuesta incorrecta: penalizacion de 1 punto (nunca menor a 0)
        if (currentTeam.score > 0) {
          currentTeam.score -= 1;
        }

        console.log(`[INFO] Respuesta INCORRECTA de ${currentTeam.name}. Puntaje: ${currentTeam.score}`);

        this.broadcast('question_result', {
          correct: false,
          teamName: currentTeam.name,
          selectedOption: data.selectedOption,
          correctOption: question.respuesta_correcta,
          score: currentTeam.score,
          tokenPosition: currentTeam.tokenPosition,
        });

        await prisma.team.update({
          where: { id: currentTeam.teamId },
          data: {
            score: currentTeam.score,
          },
        });

        this.clock.setTimeout(() => {
          this.advanceToNextTurn();
        }, 2500);
      }
    });

    // 4. Sincronizacion de movimiento y animaciones de avatar
    const handleMovement = (client: Client, data: { x: number; y: number; z: number; ry: number; animState?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) {
        p.x = data.x;
        p.y = data.y;
        p.z = data.z;
        p.ry = data.ry;
        p.animState = data.animState || 'idle';
      }
    };
    this.onMessage('player_move', handleMovement);
    this.onMessage('move', handleMovement);

    this.onMessage('ping', (client) => {
      client.send('pong', { timestamp: Date.now() });
    });
  }

  private activateQuestionFlow(currentTeam: CircoTeamSchema): void {
    if (this.questionsBank.length === 0) {
      console.warn('[WARN] Banco de preguntas vacio en CircoRoom.');
      this.advanceToNextTurn();
      return;
    }

    // Seleccionar pregunta aleatoria sin repeticion hasta agotar
    let availableQuestions = this.questionsBank.filter((q) => !this.usedQuestionIds.has(q.id));
    if (availableQuestions.length === 0) {
      this.usedQuestionIds.clear();
      availableQuestions = this.questionsBank;
    }

    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    this.usedQuestionIds.add(question.id);
    this.currentActiveQuestionId = question.id;

    this.state.turnStep = 'QUESTION_ACTIVE';
    this.state.questionTimeRemaining = env.CIRCO_QUESTION_TIME_SECONDS;

    // Enviar pregunta a todos los jugadores para visualizacion en HUD (y al representante para responder)
    this.broadcast('question_started', {
      teamName: currentTeam.name,
      representativeId: currentTeam.representativeId,
      questionId: question.id,
      pregunta: question.pregunta,
      opciones: question.opciones,
      timeSeconds: env.CIRCO_QUESTION_TIME_SECONDS,
    });

    // Iniciar temporizador regresivo de 1 segundo en el servidor
    this.questionTimerInterval?.clear();
    this.questionTimerInterval = this.clock.setInterval(() => {
      if (this.state.turnStep !== 'QUESTION_ACTIVE') {
        this.questionTimerInterval?.clear();
        return;
      }

      if (this.state.questionTimeRemaining > 0) {
        this.state.questionTimeRemaining -= 1;
      } else {
        // Se agoto el tiempo para responder
        this.questionTimerInterval?.clear();
        this.questionTimerInterval = undefined;
        this.state.questionTimeRemaining = 0;
        this.currentActiveQuestionId = null;

        console.log(`[INFO] Tiempo de pregunta agotado para ${currentTeam.name}.`);

        this.broadcast('question_timeout', {
          teamName: currentTeam.name,
          message: 'Se agoto el tiempo para responder la pregunta.',
        });

        this.clock.setTimeout(() => {
          this.advanceToNextTurn();
        }, 2000);
      }
    }, 1000);
  }

  private advanceToNextTurn(): void {
    this.state.turnStep = 'IDLE';
    this.state.activeCardType = '';
    this.state.questionTimeRemaining = 0;
    this.currentActiveQuestionId = null;

    const totalTeams = this.state.teams.size;
    if (totalTeams > 0) {
      this.state.currentTurnSeat = (this.state.currentTurnSeat % totalTeams) + 1;
    }

    // Persistir turno actual en la base de datos
    prisma.match
      .update({
        where: { id: this.state.matchId },
        data: { circoCurrentTurnSeat: this.state.currentTurnSeat },
      })
      .catch((err) => {
        console.error('[ERROR] Error al persistir circoCurrentTurnSeat:', err);
      });

    console.log(`[INFO] Siguiente turno en Circo: Puesto ${this.state.currentTurnSeat}`);

    this.broadcast('turn_changed', {
      currentTurnSeat: this.state.currentTurnSeat,
    });
  }

  public onJoin(client: Client, _options: any, auth: AuthContext): void {
    // Si el usuario ya tenia una conexion previa en esta sala, remover la sesion anterior
    for (const [existingSessionId, existingPlayer] of this.state.players.entries()) {
      if (existingPlayer.userId === auth.userId) {
        console.log(`[INFO] Reemplazando sesion previa de ${existingPlayer.fullName} (${existingSessionId}) por nueva (${client.sessionId})`);
        this.state.players.delete(existingSessionId);
      }
    }

    console.log(`[INFO] Jugador ${auth.user.firstName} (${client.sessionId}) conectado a CircoRoom (${this.state.matchId})`);

    const player = new PlayerSchema();
    player.userId = auth.userId;
    const firstName = (auth.user.firstName || '').trim().split(' ')[0] || '';
    const lastName = (auth.user.lastName || '').trim().split(' ')[0] || '';
    player.fullName = `${firstName} ${lastName}`.trim() || 'Jugador';
    player.teamId = auth.team.id;
    player.teamName = auth.team.name;
    player.avatarModel = auth.avatarModel || 'female';

    // Asignar color de equipo segun el esquema
    const teamState = this.state.teams.get(auth.team.id);
    player.teamColor = teamState?.color || '#3b82f6';

    // Posicion inicial en el spawn del circo
    player.x = 36.42;
    player.y = -14.85;
    player.z = 120.52;
    player.ry = 0;
    player.animState = 'idle';

    this.state.players.set(client.sessionId, player);

    // Enviar datos iniciales al cliente recien conectado
    client.send('init_player', {
      sessionId: client.sessionId,
      userId: auth.userId,
      teamId: auth.team.id,
      seat: teamState?.seat || 0,
      isRepresentative: teamState?.representativeId === auth.userId,
    });
  }

  public onLeave(client: Client, _code?: number): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(`[INFO] Jugador ${player.fullName} (${client.sessionId}) salio de CircoRoom`);
      this.state.players.delete(client.sessionId);
    }
  }

  public onDispose(): void {
    console.log(`[INFO] Desechando CircoRoom para la partida ${this.state.matchId}`);
    this.timerInterval?.clear();
    this.questionTimerInterval?.clear();
    CircoRoom.activeRoomsByMatchId.delete(this.state.matchId);
  }
}
