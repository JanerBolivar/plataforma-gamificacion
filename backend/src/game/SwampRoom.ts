import { Room, Client, ServerError, Delayed } from 'colyseus';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { JwtUtils } from '../utils/jwt.utils.js';
import {
  SwampState,
  PlayerSchema,
  TeamStateSchema,
  CollectibleSchema,
} from './SwampState.js';

const TEAM_PALETTE = [
  '#ef4444', // Rojo
  '#3b82f6', // Azul
  '#10b981', // Esmeralda / Verde
  '#f59e0b', // Ambar / Amarillo
  '#8b5cf6', // Violeta
  '#ec4899', // Rosa
];

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
}

/**
 * Parsea una cabecera Cookie en un diccionario clave-valor sin dependencias externas.
 */
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
 * Sala de juego multijugador para el escenario "Isla del Pantano".
 */
export class SwampRoom extends Room<{ state: SwampState }> {
  public maxClients = 36;
  private timerInterval?: Delayed;
  private statusCheckInterval?: Delayed;

  // Registro de salas activas por matchId para permitir terminacion administrativa
  private static activeRoomsByMatchId: Map<string, SwampRoom> = new Map();

  /**
   * Cierra y desconecta a todos los jugadores de la partida si fue terminada o cancelada externamente.
   */
  public static closeRoomForMatch(matchId: string, reason: string = 'Partida finalizada por un administrador.'): void {
    const room = SwampRoom.activeRoomsByMatchId.get(matchId);
    if (room) {
      console.log(`[INFO] Forzando cierre de sala ${room.roomId} para la partida ${matchId}: ${reason}`);
      room.broadcast('match_terminated', { message: reason });
      setTimeout(() => {
        room.disconnect();
      }, 500);
      SwampRoom.activeRoomsByMatchId.delete(matchId);
    }
  }

  /**
   * Autentica la conexion WebSocket validando el token JWT desde cookies HttpOnly o cabeceras.
   */
  public async onAuth(
    _client: Client,
    options: { matchId?: string; token?: string },
    context?: any
  ): Promise<AuthContext> {
    const matchId = options?.matchId;
    if (!matchId) {
      console.warn('[WARN] Intento de conexion a SwampRoom sin matchId');
      throw new ServerError(400, 'Identificador de partida matchId no especificado.');
    }

    // 1. Extraer token JWT desde cookie auth_token o token directo en opciones
    let token = options?.token;

    if (!token && context) {
      // Extraccion desde Headers Web API o request HTTP segun la capa de transporte
      const rawCookie =
        (typeof context.headers?.get === 'function'
          ? context.headers.get('cookie')
          : context.headers?.cookie) || context.req?.headers?.cookie;

      if (rawCookie) {
        const cookies = parseCookieHeader(rawCookie);
        token = cookies['auth_token'];
      }

      if (!token) {
        const authHeader =
          (typeof context.headers?.get === 'function'
            ? context.headers.get('authorization')
            : context.headers?.authorization) || context.req?.headers?.authorization;

        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }
    }

    if (!token) {
      console.warn(`[WARN] Conexion rechazada en SwampRoom (matchId: ${matchId}): Token de autenticacion ausente.`);
      throw new ServerError(401, 'Sesion no iniciada o token de autenticacion ausente.');
    }

    let decoded: { sub: string };
    try {
      decoded = JwtUtils.verifyToken(token);
    } catch {
      console.warn(`[WARN] Conexion rechazada en SwampRoom (matchId: ${matchId}): Token invalido o expirado.`);
      throw new ServerError(401, 'Token de sesion invalido o expirado.');
    }

    const userId = decoded.sub;

    // 2. Verificar que el usuario sea participante registrado con equipo en la partida
    let participant = await prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: {
          matchId,
          userId,
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true, score: true } },
      },
    });

    if (!participant) {
      // Si el usuario es el creador de la partida, asegurar su registro como participante
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
        console.warn(`[WARN] Conexion rechazada en SwampRoom (matchId: ${matchId}): Usuario ${userId} no inscrito.`);
        throw new ServerError(403, 'El usuario no esta inscrito como participante en esta partida.');
      }
    }

    // Si el participante no tiene equipo asignado todavia, asignarle el primer equipo de la partida
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

    console.log(
      `[INFO] Usuario autenticado exitosamente en SwampRoom: ${participant.user.firstName} ${participant.user.lastName} (Equipo: ${participant.team!.name})`
    );

    return {
      userId,
      user: participant.user,
      team: participant.team!,
    };
  }

  /**
   * Inicializa el estado sincronizado de la sala, los equipos, coleccionables y temporizador.
   */
  public async onCreate(options: { matchId: string }): Promise<void> {
    const matchId = options.matchId;
    this.setState(new SwampState());
    this.state.matchId = matchId;
    this.setMetadata({ matchId });
    SwampRoom.activeRoomsByMatchId.set(matchId, this);

    // 1. Cargar equipos desde la base de datos
    const teams = await prisma.team.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
    });

    teams.forEach((t, index) => {
      const teamSchema = new TeamStateSchema();
      teamSchema.teamId = t.id;
      teamSchema.name = t.name;
      teamSchema.color = TEAM_PALETTE[index % TEAM_PALETTE.length];
      teamSchema.score = t.score || 0;
      teamSchema.portalActive = false;
      this.state.teams.set(t.id, teamSchema);
    });

    // 2. Cargar objetos coleccionables generados para la partida
    const collectibles = await prisma.matchCollectible.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
    });

    collectibles.forEach((c) => {
      const colSchema = new CollectibleSchema();
      colSchema.id = c.id;
      colSchema.type = c.type;
      colSchema.posX = c.posX;
      colSchema.posZ = c.posZ;
      colSchema.collected = !!c.collectedByTeamId;
      colSchema.collectedByTeamId = c.collectedByTeamId || '';
      this.state.collectibles.set(c.id, colSchema);

      // Si ya estaba recolectado, sincronizar historial del equipo
      if (c.collectedByTeamId) {
        const teamState = this.state.teams.get(c.collectedByTeamId);
        if (teamState && !teamState.collectedTypes.includes(c.type)) {
          teamState.collectedTypes.push(c.type);
          if (teamState.collectedTypes.length >= 4) {
            teamState.portalActive = true;
          }
        }
      }
    });

    // 3. Temporizador global del pantano
    const swampMinutes = env.SWAMP_TIME_MINUTES || 15;
    this.state.timeRemaining = swampMinutes * 60;

    this.timerInterval = this.clock.setInterval(() => {
      if (this.state.timeRemaining > 0) {
        this.state.timeRemaining -= 1;
        if (this.state.timeRemaining <= 0) {
          if (this.timerInterval) this.timerInterval.clear();
          console.log(`[INFO] Tiempo de pantano expirado para la partida ${this.state.matchId}.`);
          this.broadcast('time_expired', {
            message: 'Se ha acabado el tiempo de ejecucion. Sera trasladado al escenario Circo.',
          });
        }
      }
    }, 1000);

    // 4. Verificacion periodica del estado de la partida en la base de datos (cada 4 segundos)
    this.statusCheckInterval = this.clock.setInterval(async () => {
      try {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          select: { status: true },
        });

        if (match && (match.status === 'FINISHED' || match.status === 'CANCELLED')) {
          const reason =
            match.status === 'FINISHED'
              ? 'La partida ha sido finalizada por un administrador.'
              : 'La partida ha sido cancelada.';
          SwampRoom.closeRoomForMatch(matchId, reason);
        }
      } catch (err) {
        console.error(`[ERROR] Error al verificar estado de la partida ${matchId}:`, err);
      }
    }, 4000);

    // 5. Manejo de movimiento sincronizado
    this.onMessage(
      'move',
      (client, data: { x: number; y: number; z: number; ry: number; animState?: string }) => {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.x = data.x;
          player.y = data.y;
          player.z = data.z;
          player.ry = data.ry;
          if (data.animState) {
            player.animState = data.animState;
          }
        }
      }
    );

    // 5. Manejo de recoleccion de cartas
    this.onMessage('collect', async (client, data: { collectibleId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const teamState = this.state.teams.get(player.teamId);
      if (!teamState) return;

      const col = this.state.collectibles.get(data.collectibleId);
      if (!col || col.collected) return;

      // Un equipo solo puede recolectar como maximo una carta de cada tipo
      if (teamState.collectedTypes.includes(col.type)) {
        return;
      }

      // Conteo de cuantos equipos han recolectado previamente este tipo de carta
      let alreadyCollectedByTeams = 0;
      this.state.teams.forEach((t: TeamStateSchema) => {
        if (t.collectedTypes.includes(col.type)) {
          alreadyCollectedByTeams++;
        }
      });

      const order = alreadyCollectedByTeams + 1;
      const totalTeams = Math.max(1, this.state.teams.size);

      // Formula de puntuacion decreciente: primer equipo = 10 puntos, ultimo equipo = 1 punto
      const points = Math.max(
        1,
        Math.round(10 - ((order - 1) * (9 / Math.max(1, totalTeams - 1))))
      );

      // Actualizar estado del coleccionable
      col.collected = true;
      col.collectedByTeamId = player.teamId;

      // Actualizar estado del equipo
      teamState.score += points;
      teamState.collectedTypes.push(col.type);

      // Persistir de forma atomica en la base de datos
      try {
        await prisma.$transaction([
          prisma.matchCollectible.update({
            where: { id: col.id },
            data: {
              collectedByTeamId: player.teamId,
              collectedAt: new Date(),
            },
          }),
          prisma.team.update({
            where: { id: player.teamId },
            data: {
              score: { increment: points },
            },
          }),
        ]);
      } catch (err) {
        console.error('[ERROR] Error al persistir recoleccion de carta en Prisma:', err);
      }

      // Notificar a todos los jugadores de la partida
      this.broadcast('card_collected', {
        teamName: teamState.name,
        collectibleType: col.type,
        points,
      });

      console.log(`[INFO] Equipo "${teamState.name}" recolecto ${col.type} en puesto ${order} (+${points} pts).`);

      // Si el equipo completa los 4 tipos de cartas, activar su portal dimensional
      if (teamState.collectedTypes.length >= 4 && !teamState.portalActive) {
        teamState.portalActive = true;
        this.broadcast('portal_activated', {
          teamName: teamState.name,
        });
        console.log(`[INFO] Portal dimensional activado para el equipo "${teamState.name}".`);
      }
    });

    console.log(`[INFO] Sala multijugador SwampRoom creada para la partida ${matchId}.`);
  }

  public onJoin(client: Client, _options: any, auth: AuthContext): void {
    // Si el usuario ya tenia una conexion previa en esta sala (ej. recarga o reconexion), remover la sesion anterior
    for (const [existingSessionId, existingPlayer] of this.state.players.entries()) {
      if (existingPlayer.userId === auth.userId) {
        console.log(`[INFO] Reemplazando sesion previa de ${existingPlayer.fullName} (${existingSessionId}) por nueva (${client.sessionId})`);
        this.state.players.delete(existingSessionId);
      }
    }

    const player = new PlayerSchema();
    player.userId = auth.userId;
    // Formatear a primer nombre y primer apellido
    const firstName = (auth.user.firstName || '').trim().split(' ')[0] || '';
    const lastName = (auth.user.lastName || '').trim().split(' ')[0] || '';
    player.fullName = `${firstName} ${lastName}`.trim() || 'Jugador';
    player.teamId = auth.team.id;
    player.teamName = auth.team.name;

    const teamState = this.state.teams.get(auth.team.id);
    player.teamColor = teamState?.color || '#3b82f6';
    player.x = 12.5;
    player.y = 3.9;
    player.z = 90;
    player.ry = 0;
    player.animState = 'idle';

    this.state.players.set(client.sessionId, player);
    console.log(`[INFO] Jugador conectado a sala ${this.roomId}: ${player.fullName} (${client.sessionId})`);
  }

  public onLeave(client: Client, _code?: number): void {
    this.state.players.delete(client.sessionId);
    console.log(`[INFO] Jugador desconectado de sala ${this.roomId}: ${client.sessionId}`);
  }

  public onDispose(): void {
    if (this.timerInterval) {
      this.timerInterval.clear();
    }
    if (this.statusCheckInterval) {
      this.statusCheckInterval.clear();
    }
    SwampRoom.activeRoomsByMatchId.delete(this.state.matchId);
    console.log(`[INFO] Sala multijugador liberada para la partida ${this.state.matchId}.`);
  }
}
