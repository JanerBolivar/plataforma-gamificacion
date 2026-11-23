import { prisma } from '../config/prisma.js';
import { MatchStatus, MatchStage, InvitationStatus, Role, CollectibleType } from '@prisma/client';
import { CreateMatchInput, CreateTeamInput, RespondInvitationInput } from '../models/match.model.js';
import { PANTANO_MAP_CONFIG } from '../config/map-zones.js';
import { SwampRoom } from '../game/SwampRoom.js';
import { CircoRoom } from '../game/CircoRoom.js';

/**
 * Servicio encargado de la logica de negocio para partidas, equipos e invitaciones.
 */
export class MatchService {
  /**
   * Obtiene la partida activa actual del usuario si existe.
   */
  public static async getUserActiveMatch(userId: string) {
    const activeParticipant = await prisma.matchParticipant.findFirst({
      where: {
        userId,
        match: {
          status: { in: [MatchStatus.WAITING, MatchStatus.IN_PROGRESS] },
        },
      },
      include: {
        match: {
          include: {
            creator: { select: { id: true, firstName: true, lastName: true, email: true } },
            teams: true,
            participants: true,
          },
        },
        team: true,
      },
    });

    if (!activeParticipant) return null;

    return {
      match: activeParticipant.match,
      team: activeParticipant.team,
    };
  }

  /**
   * Obtiene el listado de partidas clasificado por categorias y permisos.
   */
  public static async getMatches(userId: string, userRole: Role) {
    const myActive = await this.getUserActiveMatch(userId);

    const activeMatchesRaw = await prisma.match.findMany({
      where: { status: MatchStatus.WAITING },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        teams: { select: { id: true } },
        participants: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeMatches = activeMatchesRaw.map((m) => ({
      id: m.id,
      name: m.name,
      maxTeams: m.maxTeams,
      maxTeamMembers: m.maxTeamMembers,
      status: m.status,
      currentStage: m.currentStage,
      creatorId: m.creatorId,
      creatorName: `${m.creator.firstName} ${m.creator.lastName}`.trim(),
      createdAt: m.createdAt,
      startedAt: m.startedAt,
      finishedAt: m.finishedAt,
      teamCount: m.teams.length,
      participantCount: m.participants.length,
    }));

    const historyMatchesRaw = await prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,
        participants: {
          some: { userId },
        },
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true } },
        teams: { select: { id: true } },
        participants: { select: { id: true } },
      },
      orderBy: { finishedAt: 'desc' },
      take: 20,
    });

    const historyMatches = historyMatchesRaw.map((m) => ({
      id: m.id,
      name: m.name,
      maxTeams: m.maxTeams,
      maxTeamMembers: m.maxTeamMembers,
      status: m.status,
      currentStage: m.currentStage,
      creatorId: m.creatorId,
      creatorName: `${m.creator.firstName} ${m.creator.lastName}`.trim(),
      createdAt: m.createdAt,
      startedAt: m.startedAt,
      finishedAt: m.finishedAt,
      teamCount: m.teams.length,
      participantCount: m.participants.length,
    }));

    let allMatches: any[] | undefined = undefined;
    if (userRole === Role.ADMIN || userRole === Role.TEACHER) {
      const allRaw = await prisma.match.findMany({
        include: {
          creator: { select: { id: true, firstName: true, lastName: true } },
          teams: { select: { id: true } },
          participants: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      allMatches = allRaw.map((m) => ({
        id: m.id,
        name: m.name,
        maxTeams: m.maxTeams,
        maxTeamMembers: m.maxTeamMembers,
        status: m.status,
        currentStage: m.currentStage,
        creatorId: m.creatorId,
        creatorName: `${m.creator.firstName} ${m.creator.lastName}`.trim(),
        createdAt: m.createdAt,
        startedAt: m.startedAt,
        finishedAt: m.finishedAt,
        teamCount: m.teams.length,
        participantCount: m.participants.length,
      }));
    }

    return {
      activeMatches,
      myActiveMatch: myActive,
      historyMatches,
      ...(allMatches ? { allMatches } : {}),
    };
  }

  /**
   * Crea una nueva partida si el usuario no tiene otra activa.
   */
  public static async createMatch(userId: string, data: CreateMatchInput) {
    const existingActive = await this.getUserActiveMatch(userId);
    if (existingActive) {
      throw new Error('Ya se encuentra participando en una partida activa. Debe abandonarla primero.');
    }

    if (data.maxTeams < 2 || data.maxTeams > 6) {
      throw new Error('La cantidad maxima de equipos debe ser entre 2 y 6.');
    }

    return prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          name: data.name.trim(),
          maxTeams: data.maxTeams,
          creatorId: userId,
          status: MatchStatus.WAITING,
          currentStage: MatchStage.LOBBY,
        },
      });

      await tx.matchParticipant.create({
        data: {
          matchId: match.id,
          userId,
          teamId: null,
        },
      });

      console.log(`[INFO] Partida creada: ${match.name} (ID: ${match.id}) por usuario ${userId}`);
      return match;
    });
  }

  /**
   * Retorna los detalles completos del lobby de una partida.
   */
  public static async getMatchLobby(matchId: string, userId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } },
        teams: {
          include: {
            members: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
              },
            },
          },
        },
        participants: {
          where: { teamId: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          },
        },
      },
    });

    if (!match) {
      throw new Error('La partida especificada no existe.');
    }

    const pendingInvitations = await prisma.teamInvitation.findMany({
      where: {
        matchId,
        inviteeId: userId,
        status: InvitationStatus.PENDING,
      },
      include: {
        team: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      match: {
        id: match.id,
        name: match.name,
        maxTeams: match.maxTeams,
        maxTeamMembers: match.maxTeamMembers,
        status: match.status,
        currentStage: match.currentStage,
        creator: match.creator,
        createdAt: match.createdAt,
        startedAt: match.startedAt,
        finishedAt: match.finishedAt,
      },
      teams: match.teams.map((t) => ({
        id: t.id,
        name: t.name,
        swampCompleted: t.swampCompleted,
        createdAt: t.createdAt,
        memberCount: t.members.length,
        members: t.members.map((m) => ({
          participantId: m.id,
          userId: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          role: m.user.role,
          joinedAt: m.joinedAt,
        })),
      })),
      unassignedParticipants: match.participants.map((p) => ({
        participantId: p.id,
        userId: p.user.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        role: p.user.role,
        joinedAt: p.joinedAt,
      })),
      myPendingInvitations: pendingInvitations,
    };
  }

  /**
   * Une al usuario autenticado a una partida en estado WAITING.
   */
  public static async joinMatch(matchId: string, userId: string) {
    const existingActive = await this.getUserActiveMatch(userId);
    if (existingActive) {
      if (existingActive.match.id === matchId) {
        return existingActive.match;
      }
      throw new Error('Ya se encuentra registrado en otra partida activa.');
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('La partida especificada no fue encontrada.');
    }

    if (match.status !== MatchStatus.WAITING) {
      throw new Error('No es posible unirse a una partida que no este en sala de espera.');
    }

    await prisma.matchParticipant.create({
      data: {
        matchId,
        userId,
        teamId: null,
      },
    });

    console.log(`[INFO] Usuario ${userId} se unio a la sala de espera de partida ${matchId}`);
    return match;
  }

  /**
   * Retira al usuario de la sala de espera de la partida.
   */
  public static async leaveMatch(matchId: string, userId: string) {
    const participant = await prisma.matchParticipant.findUnique({
      where: {
        matchId_userId: { matchId, userId },
      },
      include: { match: true },
    });

    if (!participant) {
      throw new Error('El usuario no forma parte de esta partida.');
    }

    if (participant.match.status === MatchStatus.FINISHED || participant.match.status === MatchStatus.CANCELLED) {
      throw new Error('No es posible abandonar una partida que ya ha finalizado o ha sido cancelada.');
    }

    return prisma.$transaction(async (tx) => {
      const teamId = participant.teamId;

      await tx.matchParticipant.delete({
        where: { id: participant.id },
      });

      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          OR: [{ inviterId: userId }, { inviteeId: userId }],
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      if (teamId) {
        const remainingMembers = await tx.matchParticipant.count({
          where: { teamId },
        });
        if (remainingMembers === 0) {
          await tx.team.delete({ where: { id: teamId } });
          console.log(`[INFO] Equipo ${teamId} eliminado por falta de integrantes.`);
        }
      }

      console.log(`[INFO] Usuario ${userId} abandono la partida ${matchId}`);
    });
  }

  /**
   * Crea un nuevo equipo dentro de la partida y asigna al creador.
   */
  public static async createTeam(matchId: string, userId: string, data: CreateTeamInput) {
    const participant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
      include: { match: { include: { teams: true } } },
    });

    if (!participant) {
      throw new Error('Debe ser participante de la partida para crear un equipo.');
    }

    if (participant.match.status !== MatchStatus.WAITING) {
      throw new Error('Solo es posible crear equipos mientras la partida este en sala de espera.');
    }

    if (participant.teamId !== null) {
      throw new Error('Ya pertenece a un equipo dentro de esta partida.');
    }

    if (participant.match.teams.length >= participant.match.maxTeams) {
      throw new Error(`Se ha alcanzado el limite maximo de ${participant.match.maxTeams} equipos.`);
    }

    const teamName = data.name.trim();
    if (!teamName) {
      throw new Error('El nombre del equipo no puede estar vacio.');
    }

    return prisma.$transaction(async (tx) => {
      const existingTeam = await tx.team.findUnique({
        where: { matchId_name: { matchId, name: teamName } },
      });

      if (existingTeam) {
        throw new Error('Ya existe un equipo con ese nombre en esta partida.');
      }

      const team = await tx.team.create({
        data: {
          name: teamName,
          matchId,
        },
      });

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { teamId: team.id },
      });

      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          inviteeId: userId,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      console.log(`[INFO] Equipo "${team.name}" creado en partida ${matchId} por usuario ${userId}`);
      return team;
    });
  }

  /**
   * Asigna un participante sin equipo a un equipo existente.
   */
  public static async joinTeam(matchId: string, teamId: string, userId: string) {
    const participant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
      include: { match: true },
    });

    if (!participant) {
      throw new Error('No es participante de esta partida.');
    }

    if (participant.match.status !== MatchStatus.WAITING) {
      throw new Error('Solo es posible unirse a equipos durante la sala de espera.');
    }

    if (participant.teamId !== null) {
      throw new Error('Ya cuenta con un equipo asignado. Abandone su equipo actual primero.');
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, matchId },
      include: { members: true },
    });

    if (!team) {
      throw new Error('El equipo seleccionado no existe en esta partida.');
    }

    if (team.members.length >= participant.match.maxTeamMembers) {
      throw new Error(`El equipo ya alcanzo el maximo de ${participant.match.maxTeamMembers} integrantes.`);
    }

    return prisma.$transaction(async (tx) => {
      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { teamId },
      });

      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          inviteeId: userId,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      console.log(`[INFO] Usuario ${userId} se unio al equipo ${team.name} en partida ${matchId}`);
    });
  }

  /**
   * Retira al usuario de su equipo actual.
   */
  public static async leaveTeam(matchId: string, teamId: string, userId: string) {
    const participant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
      include: { match: true },
    });

    if (!participant || participant.teamId !== teamId) {
      throw new Error('El usuario no pertenece al equipo indicado.');
    }

    if (participant.match.status !== MatchStatus.WAITING) {
      throw new Error('Solo es posible abandonar el equipo en sala de espera.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { teamId: null },
      });

      const remainingMembers = await tx.matchParticipant.count({
        where: { teamId },
      });

      if (remainingMembers === 0) {
        await tx.team.delete({ where: { id: teamId } });
        console.log(`[INFO] Equipo ${teamId} eliminado tras salida del ultimo integrante.`);
      }

      console.log(`[INFO] Usuario ${userId} salio del equipo ${teamId}`);
    });
  }

  /**
   * Invita a un usuario sin equipo a unirse a un equipo.
   */
  public static async inviteToTeam(
    matchId: string,
    teamId: string,
    inviterId: string,
    inviteeId: string
  ) {
    if (inviterId === inviteeId) {
      throw new Error('No es posible invitarse a si mismo.');
    }

    const inviterParticipant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId: inviterId } },
      include: { match: true },
    });

    if (!inviterParticipant || inviterParticipant.teamId !== teamId) {
      throw new Error('Debe ser integrante del equipo para enviar invitaciones.');
    }

    if (inviterParticipant.match.status !== MatchStatus.WAITING) {
      throw new Error('Solo es posible invitar participantes en sala de espera.');
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new Error('El equipo especificado no existe.');
    }

    if (team.members.length >= inviterParticipant.match.maxTeamMembers) {
      throw new Error('El equipo ya cuenta con el maximo de integrantes permitidos.');
    }

    const inviteeParticipant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId: inviteeId } },
    });

    if (!inviteeParticipant) {
      throw new Error('El usuario invitado no forma parte de la partida.');
    }

    if (inviteeParticipant.teamId !== null) {
      throw new Error('El usuario invitado ya pertenece a un equipo.');
    }

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        matchId,
        teamId,
        inviteeId,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new Error('Ya existe una invitacion pendiente para este usuario en este equipo.');
    }

    const invitation = await prisma.teamInvitation.create({
      data: {
        matchId,
        teamId,
        inviterId,
        inviteeId,
        status: InvitationStatus.PENDING,
      },
    });

    console.log(`[INFO] Invitacion enviada de usuario ${inviterId} a ${inviteeId} para equipo ${team.name}`);
    return invitation;
  }

  /**
   * Responde (aceptar o rechazar) a una invitacion de equipo.
   */
  public static async respondInvitation(
    matchId: string,
    invitationId: string,
    userId: string,
    data: RespondInvitationInput
  ) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: {
        match: true,
        team: { include: { members: true } },
      },
    });

    if (!invitation || invitation.matchId !== matchId || invitation.inviteeId !== userId) {
      throw new Error('La invitacion no fue encontrada o no corresponde al usuario.');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('La invitacion ya fue respondida o no se encuentra pendiente.');
    }

    if (invitation.match.status !== MatchStatus.WAITING) {
      throw new Error('La partida ya no se encuentra en sala de espera.');
    }

    if (data.action === 'REJECT') {
      return prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REJECTED },
      });
    }

    // ACCION ACCEPT
    const participant = await prisma.matchParticipant.findUnique({
      where: { matchId_userId: { matchId, userId } },
    });

    if (!participant) {
      throw new Error('El usuario ya no forma parte de esta partida.');
    }

    if (participant.teamId !== null) {
      throw new Error('Ya cuenta con un equipo asignado.');
    }

    if (invitation.team.members.length >= invitation.match.maxTeamMembers) {
      throw new Error('El equipo ya alcanzo el maximo de integrantes.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.teamInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.ACCEPTED },
      });

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: { teamId: invitation.teamId },
      });

      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          inviteeId: userId,
          id: { not: invitationId },
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      console.log(`[INFO] Usuario ${userId} acepto invitacion e ingreso al equipo ${invitation.team.name}`);
    });
  }

  /**
   * Valida si un usuario tiene permisos administrativos o de creacion sobre una partida.
   */
  private static async validateMatchManagementPermission(matchId: string, userId: string, userRole: Role) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Partida no encontrada.');
    }

    const canManage = userRole === Role.ADMIN || userRole === Role.TEACHER || match.creatorId === userId;
    if (!canManage) {
      throw new Error('No cuenta con autorizacion para gestionar esta partida.');
    }

    return match;
  }

  /**
   * Inicia la partida ejecutando la transaccion de limpieza, generacion de coleccionables y paso a IN_PROGRESS.
   */
  public static async startMatch(matchId: string, userId: string, userRole: Role) {
    const match = await this.validateMatchManagementPermission(matchId, userId, userRole);

    if (match.status !== MatchStatus.WAITING) {
      throw new Error('Solo se pueden iniciar partidas en estado de espera.');
    }

    const teams = await prisma.team.findMany({
      where: { matchId },
      include: { members: true },
    });

    const teamsWithMembers = teams.filter((t) => t.members.length > 0);
    if (teamsWithMembers.length < 2 || teamsWithMembers.length > 6) {
      throw new Error('Se requieren entre 2 y 6 equipos con integrantes para iniciar la partida.');
    }

    const N = teamsWithMembers.length;
    const collectibleTypes: CollectibleType[] = [
      CollectibleType.ADIVINALO,
      CollectibleType.CARTA_PREGUNTA,
      CollectibleType.TIBURON_AZUL,
      CollectibleType.TIBURON_ROJO,
    ];

    const generatedPositions: Array<{ posX: number; posZ: number; type: CollectibleType }> = [];
    const { bounds, exclusionZones, minDistanceBetweenItems, maxSpawnRetries } = PANTANO_MAP_CONFIG;

    for (const type of collectibleTypes) {
      for (let i = 0; i < N; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < maxSpawnRetries) {
          attempts++;

          // Generar coordenadas aleatorias uniformes dentro de los limites de la isla
          const posX = Number((Math.random() * (bounds.maxX - bounds.minX) + bounds.minX).toFixed(2));
          const posZ = Number((Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ).toFixed(2));

          // 1. Validar que no este dentro de ninguna zona de exclusion
          const inExclusionZone = exclusionZones.some((zone) => {
            const dist = Math.hypot(posX - zone.centerX, posZ - zone.centerZ);
            return dist < zone.radius;
          });

          if (inExclusionZone) {
            continue;
          }

          // 2. Validar distancia minima respecto a coleccionables previamente ubicados
          const tooCloseToOther = generatedPositions.some((item) => {
            const dist = Math.hypot(posX - item.posX, posZ - item.posZ);
            return dist < minDistanceBetweenItems;
          });

          if (tooCloseToOther) {
            continue;
          }

          generatedPositions.push({ posX, posZ, type });
          placed = true;
        }

        if (!placed) {
          console.warn(`[WARN] Limite de reintentos alcanzado al ubicar coleccionable de tipo ${type}.`);
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      // Expulsar participantes sin equipo
      await tx.matchParticipant.deleteMany({
        where: {
          matchId,
          teamId: null,
        },
      });

      // Rechazar invitaciones pendientes
      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      // Eliminar registros previos de coleccionables si existieran
      await tx.matchCollectible.deleteMany({
        where: { matchId },
      });

      // Persistir las instancias de coleccionables generadas
      if (generatedPositions.length > 0) {
        await tx.matchCollectible.createMany({
          data: generatedPositions.map((pos) => ({
            matchId,
            type: pos.type,
            posX: pos.posX,
            posZ: pos.posZ,
          })),
        });
      }

      // Pasar partida a IN_PROGRESS y etapa a SWAMP
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          currentStage: MatchStage.SWAMP,
          startedAt: new Date(),
        },
      });

      console.log(`[INFO] Partida ${matchId} iniciada exitosamente con ${generatedPositions.length} coleccionables generados.`);
      return updatedMatch;
    });
  }

  /**
   * Consulta el listado de objetos coleccionables generados para una partida.
   */
  public static async getMatchCollectibles(matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    });

    if (!match) {
      throw new Error('La partida especificada no existe.');
    }

    return prisma.matchCollectible.findMany({
      where: { matchId },
      select: {
        id: true,
        type: true,
        posX: true,
        posZ: true,
        collectedByTeamId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Genera de forma procedural un unico coleccionable respetando zonas de exclusion (Modo Admin).
   */
  public static async spawnSingleCollectible(
    matchId: string,
    type: CollectibleType,
    userId: string,
    userRole: Role
  ) {
    if (userRole !== Role.ADMIN) {
      throw new Error('Solo los administradores pueden generar objetos en el mapa.');
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    });

    if (!match) {
      throw new Error('La partida especificada no existe.');
    }

    if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) {
      throw new Error('No es posible generar objetos en una partida finalizada.');
    }

    const { bounds, exclusionZones, maxSpawnRetries } = PANTANO_MAP_CONFIG;
    let posX = 0;
    let posZ = 0;
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < maxSpawnRetries) {
      attempts++;
      const candidateX = Number((Math.random() * (bounds.maxX - bounds.minX) + bounds.minX).toFixed(2));
      const candidateZ = Number((Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ).toFixed(2));

      const inExclusionZone = exclusionZones.some((zone) => {
        const dist = Math.hypot(candidateX - zone.centerX, candidateZ - zone.centerZ);
        return dist < zone.radius;
      });

      if (!inExclusionZone) {
        posX = candidateX;
        posZ = candidateZ;
        placed = true;
      }
    }

    if (!placed) {
      posX = 15;
      posZ = 15;
    }

    const collectible = await prisma.matchCollectible.create({
      data: {
        matchId,
        type,
        posX,
        posZ,
      },
    });

    const swampRoom = SwampRoom.getActiveRoom(matchId);
    if (swampRoom) {
      swampRoom.spawnCollectible({
        id: collectible.id,
        type: collectible.type,
        posX: collectible.posX,
        posZ: collectible.posZ,
      });
    }

    console.log(`[INFO] Admin ${userId} genero coleccionable ${type} en (${posX}, ${posZ}) para partida ${matchId}.`);
    return collectible;
  }

  /**
   * Regenera todo el conjunto de coleccionables de la partida respetando las zonas de exclusion (Modo Admin).
   */
  public static async regenerateMatchCollectibles(
    matchId: string,
    userId: string,
    userRole: Role
  ) {
    if (userRole !== Role.ADMIN) {
      throw new Error('Solo los administradores pueden regenerar los objetos del mapa.');
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { teams: true },
    });

    if (!match) {
      throw new Error('La partida especificada no existe.');
    }

    if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) {
      throw new Error('No es posible regenerar objetos en una partida finalizada.');
    }

    const N = Math.max(2, match.teams.length);
    const collectibleTypes: CollectibleType[] = [
      CollectibleType.ADIVINALO,
      CollectibleType.CARTA_PREGUNTA,
      CollectibleType.TIBURON_AZUL,
      CollectibleType.TIBURON_ROJO,
    ];

    const generatedPositions: Array<{ posX: number; posZ: number; type: CollectibleType }> = [];
    const { bounds, exclusionZones, minDistanceBetweenItems, maxSpawnRetries } = PANTANO_MAP_CONFIG;

    for (const type of collectibleTypes) {
      for (let i = 0; i < N; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < maxSpawnRetries) {
          attempts++;
          const posX = Number((Math.random() * (bounds.maxX - bounds.minX) + bounds.minX).toFixed(2));
          const posZ = Number((Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ).toFixed(2));

          const inExclusionZone = exclusionZones.some((zone) => {
            const dist = Math.hypot(posX - zone.centerX, posZ - zone.centerZ);
            return dist < zone.radius;
          });

          if (inExclusionZone) continue;

          const tooCloseToOther = generatedPositions.some((item) => {
            const dist = Math.hypot(posX - item.posX, posZ - item.posZ);
            return dist < minDistanceBetweenItems;
          });

          if (tooCloseToOther) continue;

          generatedPositions.push({ posX, posZ, type });
          placed = true;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.matchCollectible.deleteMany({
        where: { matchId },
      });

      if (generatedPositions.length > 0) {
        await tx.matchCollectible.createMany({
          data: generatedPositions.map((pos) => ({
            matchId,
            type: pos.type,
            posX: pos.posX,
            posZ: pos.posZ,
          })),
        });
      }
    });

    const swampRoom = SwampRoom.getActiveRoom(matchId);
    if (swampRoom) {
      await swampRoom.reloadCollectibles();
    }

    console.log(`[INFO] Admin ${userId} regenero ${generatedPositions.length} coleccionables para la partida ${matchId}.`);
    return prisma.matchCollectible.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finaliza una partida activa.
   */
  public static async finishMatch(matchId: string, userId: string, userRole: Role) {
    const match = await this.validateMatchManagementPermission(matchId, userId, userRole);

    if (match.status !== MatchStatus.IN_PROGRESS && match.status !== MatchStatus.WAITING) {
      throw new Error('Solo se pueden finalizar partidas en curso o en espera.');
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.FINISHED,
        currentStage: MatchStage.FINISHED,
        finishedAt: new Date(),
      },
    });

    // Desconectar inmediatamente a todos los jugadores de las salas multijugador activas
    SwampRoom.closeRoomForMatch(matchId, 'La partida ha sido finalizada por un administrador.');
    CircoRoom.closeRoomForMatch(matchId, 'La partida ha sido finalizada por un administrador.');

    console.log(`[INFO] Partida ${matchId} finalizada.`);
    return updated;
  }

  /**
   * Cancela una partida.
   */
  public static async cancelMatch(matchId: string, userId: string, userRole: Role) {
    const match = await this.validateMatchManagementPermission(matchId, userId, userRole);

    if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) {
      throw new Error('La partida ya se encuentra terminada o cancelada.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.teamInvitation.updateMany({
        where: {
          matchId,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.REJECTED },
      });

      const res = await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.CANCELLED,
          currentStage: MatchStage.FINISHED,
          finishedAt: new Date(),
        },
      });

      return res;
    });

    // Desconectar inmediatamente a todos los jugadores de las salas multijugador activas
    SwampRoom.closeRoomForMatch(matchId, 'La partida ha sido cancelada por un administrador.');
    CircoRoom.closeRoomForMatch(matchId, 'La partida ha sido cancelada por un administrador.');

    console.log(`[INFO] Partida ${matchId} cancelada.`);
    return updated;
  }
}
