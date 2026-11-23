import { Client, Room, getStateCallbacks } from '@colyseus/sdk';

export interface RemotePlayerState {
  userId: string;
  fullName: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  avatarModel?: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  animState: string;
}

export interface TeamLeaderboardEntry {
  teamId: string;
  name: string;
  color: string;
  score: number;
  cardsCount: number;
  portalActive: boolean;
}

export interface CardCollectedEvent {
  teamName: string;
  collectibleType: string;
  points: number;
}

export interface PortalActivatedEvent {
  teamName: string;
}

export interface TimeExpiredEvent {
  message: string;
}

export interface MatchTerminatedEvent {
  message: string;
}

export interface SessionTerminatedEvent {
  message: string;
}

/**
 * Gestor de comunicacion multijugador en tiempo real mediante Colyseus.
 */
export class NetworkManager {
  private client: Client;
  private room: Room | null = null;
  public mySessionId: string | null = null;

  private isDisposed: boolean = false;
  private joinPromise: Promise<Room | null> | null = null;

  // Control de tasa de envio de movimiento (throttling ~18 FPS)
  private lastMoveSentTime: number = 0;
  private lastSentPos = { x: 0, y: 0, z: 0, ry: 0, animState: '' };

  // Mapa de jugadores remotos activos en la sala para consulta rapida
  public connectedPlayersMap: Map<string, RemotePlayerState> = new Map();

  // Callbacks para la escena 3D y la interfaz React
  public onPlayerJoined?: (sessionId: string, player: RemotePlayerState) => void;
  public onPlayerLeft?: (sessionId: string) => void;
  public onPlayerMoved?: (sessionId: string, player: RemotePlayerState) => void;
  public onTimeRemainingChanged?: (seconds: number) => void;
  public onLeaderboardChanged?: (teams: TeamLeaderboardEntry[]) => void;
  public onCollectibleCollected?: (collectibleId: string, collectedByTeamId: string) => void;
  public onCollectibleSpawned?: (collectible: any) => void;
  public onCollectiblesReloaded?: (collectibles: any[]) => void;
  public onCardCollected?: (event: CardCollectedEvent) => void;
  public onPortalActivated?: (event: PortalActivatedEvent) => void;
  public onTimeExpired?: (event: TimeExpiredEvent) => void;
  public onMatchTerminated?: (event: MatchTerminatedEvent) => void;
  public onSessionTerminated?: (event: SessionTerminatedEvent) => void;
  public onConnected?: (sessionId: string) => void;
  public onDisconnect?: () => void;

  constructor() {
    const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const wsUrl = rawApiUrl.replace(/^http/, 'ws');
    this.client = new Client(wsUrl);
  }

  /**
   * Conecta a la sala de juego Colyseus correspondiente a la partida.
   */
  public async joinMatch(matchId: string): Promise<Room | null> {
    if (this.isDisposed) {
      console.warn('[WARN] Intento de conectar con un NetworkManager ya desechado.');
      return null;
    }

    if (this.room) {
      console.log('[INFO] Ya existe una conexion activa a Colyseus.');
      return this.room;
    }

    if (this.joinPromise) {
      console.log('[INFO] Conexion a Colyseus en progreso. Reutilizando promesa existente.');
      return this.joinPromise;
    }

    this.joinPromise = (async () => {
      try {
        const room = await this.client.joinOrCreate('swamp_room', { matchId });

        if (this.isDisposed) {
          console.log('[INFO] Instancia descartada antes de completar conexion. Abandonando sala SwampRoom.');
          try {
            room.leave();
          } catch {}
          return null;
        }

        this.room = room;
        this.mySessionId = room.sessionId;
        console.log(`[INFO] Conectado a swamp_room (${room.roomId}) con sessionId: ${this.mySessionId}`);

        if (this.onConnected && this.mySessionId) {
          this.onConnected(this.mySessionId);
        }

        this.setupRoomListeners();
        return room;
      } catch (err) {
        if (!this.isDisposed) {
          console.error('[ERROR] Error al conectar a la sala Colyseus:', err);
        }
        throw err;
      } finally {
        this.joinPromise = null;
      }
    })();

    return this.joinPromise;
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    const $ = getStateCallbacks(this.room);

    // 1. Escuchar y sincronizar jugadores remotos mediante proxy de estado
    const knownSessionIds = new Set<string>();

    const registerPlayer = (player: any, sessionId: string) => {
      // Ignorar nuestro propio avatar para permanecer en primera persona
      if (sessionId === this.mySessionId) return;
      if (knownSessionIds.has(sessionId)) return;
      knownSessionIds.add(sessionId);

      const playerData: RemotePlayerState = {
        userId: player.userId,
        fullName: player.fullName,
        teamId: player.teamId,
        teamName: player.teamName,
        teamColor: player.teamColor,
        avatarModel: player.avatarModel || 'female',
        x: player.x,
        y: player.y,
        z: player.z,
        ry: player.ry,
        animState: player.animState || 'idle',
      };

      this.connectedPlayersMap.set(sessionId, playerData);
      if (this.onPlayerJoined) {
        this.onPlayerJoined(sessionId, playerData);
      }

      $(player).onChange(() => {
        if (sessionId === this.mySessionId) return;
        playerData.x = player.x;
        playerData.y = player.y;
        playerData.z = player.z;
        playerData.ry = player.ry;
        playerData.animState = player.animState || 'idle';

        if (this.onPlayerMoved) {
          this.onPlayerMoved(sessionId, playerData);
        }
      });
    };

    const syncExistingPlayers = () => {
      if (!this.room || !this.room.state) return;
      const playersMap = (this.room.state as any).players;
      if (playersMap) {
        // Limpiar avatares de sesiones que ya no existen en el servidor
        const currentActiveSessionIds = new Set<string>();
        if (typeof playersMap.forEach === 'function') {
          playersMap.forEach((player: any, sessionId: string) => {
            currentActiveSessionIds.add(sessionId);
            registerPlayer(player, sessionId);
          });
        } else if (typeof playersMap.entries === 'function') {
          for (const [sessionId, player] of playersMap.entries()) {
            currentActiveSessionIds.add(sessionId);
            registerPlayer(player, sessionId);
          }
        }

        for (const knownId of Array.from(knownSessionIds)) {
          if (!currentActiveSessionIds.has(knownId)) {
            knownSessionIds.delete(knownId);
            this.connectedPlayersMap.delete(knownId);
            if (this.onPlayerLeft) {
              this.onPlayerLeft(knownId);
            }
          }
        }
      }
    };

    $((this.room.state as any).players).onAdd((player: any, sessionId: string) => {
      registerPlayer(player, sessionId);
    });

    $((this.room.state as any).players).onRemove((_player: any, sessionId: string) => {
      knownSessionIds.delete(sessionId);
      this.connectedPlayersMap.delete(sessionId);
      if (sessionId === this.mySessionId) return;
      if (this.onPlayerLeft) {
        this.onPlayerLeft(sessionId);
      }
    });

    // 2. Escuchar cambios en equipos y tabla de posiciones
    const updateLeaderboard = () => {
      if (!this.room || !this.room.state) return;
      const teamsList: TeamLeaderboardEntry[] = [];
      const teamsMap = (this.room.state as any).teams;

      if (teamsMap) {
        if (typeof teamsMap.forEach === 'function') {
          teamsMap.forEach((t: any) => {
            if (t && t.teamId) {
              teamsList.push({
                teamId: t.teamId,
                name: t.name || 'Equipo',
                color: t.color || '#3b82f6',
                score: t.score || 0,
                cardsCount: t.collectedTypes ? t.collectedTypes.length : 0,
                portalActive: !!t.portalActive,
              });
            }
          });
        } else if (typeof teamsMap.values === 'function') {
          for (const t of teamsMap.values()) {
            if (t && t.teamId) {
              teamsList.push({
                teamId: t.teamId,
                name: t.name || 'Equipo',
                color: t.color || '#3b82f6',
                score: t.score || 0,
                cardsCount: t.collectedTypes ? t.collectedTypes.length : 0,
                portalActive: !!t.portalActive,
              });
            }
          }
        }
      }

      // Ordenar de mayor a menor puntaje
      teamsList.sort((a, b) => b.score - a.score);

      if (this.onLeaderboardChanged && teamsList.length > 0) {
        this.onLeaderboardChanged(teamsList);
      }
    };

    // Callback inmediato cuando se recibe el estado o la coleccion de equipos y jugadores
    if (this.room.onStateChange) {
      this.room.onStateChange.once((state: any) => {
        if (typeof state.timeRemaining === 'number' && this.onTimeRemainingChanged) {
          this.onTimeRemainingChanged(state.timeRemaining);
        }
        updateLeaderboard();
        syncExistingPlayers();
      });
      this.room.onStateChange(() => {
        updateLeaderboard();
        syncExistingPlayers();
      });
    }

    $((this.room.state as any).teams).onAdd((team: any) => {
      updateLeaderboard();
      $(team).onChange(() => {
        updateLeaderboard();
      });
      if (team.collectedTypes) {
        $(team.collectedTypes).onChange(() => {
          updateLeaderboard();
        });
      }
    });

    // Forzar lectura inicial si el estado ya contiene equipos o jugadores
    updateLeaderboard();
    syncExistingPlayers();

    // 3. Escuchar coleccionables
    $((this.room.state as any).collectibles).onAdd((c: any) => {
      $(c).onChange(() => {
        if (c.collected && this.onCollectibleCollected) {
          this.onCollectibleCollected(c.id, c.collectedByTeamId);
        }
      });
    });

    // 4. Temporizador de partida
    if (typeof (this.room.state as any).timeRemaining === 'number' && this.onTimeRemainingChanged) {
      this.onTimeRemainingChanged((this.room.state as any).timeRemaining);
    }

    $(this.room.state as any).listen('timeRemaining', (time: number) => {
      if (this.onTimeRemainingChanged) {
        this.onTimeRemainingChanged(time);
      }
    });

    // 5. Mensajes globales de sala
    this.room.onMessage('collectible_collected', (msg: { collectibleId: string; collectedByTeamId: string; collectibleType: string }) => {
      if (this.onCollectibleCollected) {
        this.onCollectibleCollected(msg.collectibleId, msg.collectedByTeamId);
      }
    });

    this.room.onMessage('card_collected', (msg: CardCollectedEvent) => {
      if (this.onCardCollected) {
        this.onCardCollected(msg);
      }
    });

    this.room.onMessage('portal_activated', (msg: PortalActivatedEvent) => {
      if (this.onPortalActivated) {
        this.onPortalActivated(msg);
      }
    });

    this.room.onMessage('collectible_spawned', (msg: { collectible: any }) => {
      if (this.onCollectibleSpawned) {
        this.onCollectibleSpawned(msg.collectible);
      }
    });

    this.room.onMessage('collectibles_reloaded', (msg: { collectibles: any[] }) => {
      if (this.onCollectiblesReloaded) {
        this.onCollectiblesReloaded(msg.collectibles);
      }
    });

    this.room.onMessage('time_expired', (msg: TimeExpiredEvent) => {
      if (this.onTimeExpired) {
        this.onTimeExpired(msg);
      }
    });

    this.room.onMessage('match_terminated', (msg: MatchTerminatedEvent) => {
      if (this.onMatchTerminated) {
        this.onMatchTerminated(msg);
      }
    });

    this.room.onMessage('session_terminated', (msg: SessionTerminatedEvent) => {
      if (this.isDisposed) return;
      console.log('[WARN] Sesion terminada por nueva conexion externa:', msg.message);
      if (this.onSessionTerminated) {
        this.onSessionTerminated(msg);
      }
    });

    this.room.onLeave(() => {
      console.log('[INFO] Desconectado de la sala Colyseus.');
      if (!this.isDisposed && this.onDisconnect) {
        this.onDisconnect();
      }
    });
  }

  /**
   * Envia las coordenadas locales del jugador con control de frecuencia (throttling).
   */
  public sendMove(x: number, y: number, z: number, ry: number, animState: string): void {
    if (!this.room || this.isDisposed) return;

    const now = performance.now();
    if (now - this.lastMoveSentTime < 55) {
      // Limitar a ~18 envios por segundo
      return;
    }

    const distSq =
      Math.pow(x - this.lastSentPos.x, 2) +
      Math.pow(y - this.lastSentPos.y, 2) +
      Math.pow(z - this.lastSentPos.z, 2);
    const dRot = Math.abs(ry - this.lastSentPos.ry);
    const animChanged = animState !== this.lastSentPos.animState;

    // Solo transmitir si hubo un desplazamiento significativo o cambio de animacion
    if (distSq > 0.0004 || dRot > 0.015 || animChanged) {
      this.lastMoveSentTime = now;
      this.lastSentPos = { x, y, z, ry, animState };
      this.room.send('move', {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        ry: Number(ry.toFixed(3)),
        animState,
      });
    }
  }

  /**
   * Envia la solicitud de recoleccion de una carta al servidor autoritativo.
   */
  public sendCollect(collectibleId: string): void {
    if (!this.room || this.isDisposed) return;
    this.room.send('collect', { collectibleId });
  }

  public leave(): void {
    this.isDisposed = true;

    // Desvincular callbacks para evitar invocaciones residuales tras desmontar
    this.onPlayerJoined = undefined;
    this.onPlayerLeft = undefined;
    this.onPlayerMoved = undefined;
    this.onTimeRemainingChanged = undefined;
    this.onLeaderboardChanged = undefined;
    this.onCollectibleCollected = undefined;
    this.onCardCollected = undefined;
    this.onPortalActivated = undefined;
    this.onTimeExpired = undefined;
    this.onMatchTerminated = undefined;
    this.onSessionTerminated = undefined;
    this.onConnected = undefined;
    this.onDisconnect = undefined;

    this.connectedPlayersMap.clear();

    if (this.room) {
      try {
        this.room.leave();
      } catch (err) {
        console.warn('[WARN] Error al abandonar la sala Colyseus:', err);
      }
      this.room = null;
      this.mySessionId = null;
    }
  }
}
