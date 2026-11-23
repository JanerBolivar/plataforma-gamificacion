import { Client, Room, getStateCallbacks } from '@colyseus/sdk';

export interface RemoteCircoPlayer {
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

export interface CircoTeamState {
  teamId: string;
  name: string;
  color: string;
  score: number;
  seat: number;
  representativeId: string;
  representativeName: string;
  tokenPosition: number;
  opportunities: number;
}

export interface QuestionDataPayload {
  teamName: string;
  representativeId: string;
  questionId: number;
  pregunta: string;
  opciones: Array<{ key: string; texto: string }>;
  timeSeconds: number;
}

export interface QuestionResultPayload {
  correct: boolean;
  teamName: string;
  selectedOption: string;
  correctOption?: string;
  score: number;
  tokenPosition?: number;
}

/**
 * Gestor de comunicacion en tiempo real para el escenario "Circo" con Colyseus.
 */
export class CircoNetworkManager {
  private client: Client;
  private room: Room | null = null;
  public mySessionId: string | null = null;
  public myUserId: string | null = null;
  public myTeamId: string | null = null;
  public mySeat: number = 0;
  public isRepresentative: boolean = false;

  private isConnecting: boolean = false;
  private lastMoveSentTime: number = 0;
  private lastSentPos = { x: 0, y: 0, z: 0, ry: 0, animState: '' };

  // Control de deduplicacion para evitar re-emision continua de eventos
  private lastPhase: string = '';
  private lastTimeRemaining: number = -1;
  private lastQuestionTimeRemaining: number = -1;
  private lastCurrentTurnSeat: number = -1;
  private lastTurnStep: string = '';
  private lastArrowRotationY: number = -999999;
  private lastActiveCardType: string = '';
  private lastTeamsJson: string = '';

  // Callbacks para la vista de React y la escena 3D
  public onConnected?: (sessionId: string) => void;
  public onDisconnect?: () => void;
  public onPhaseChanged?: (phase: string) => void;
  public onTimeRemainingChanged?: (seconds: number) => void;
  public onQuestionTimeRemainingChanged?: (seconds: number) => void;
  public onCurrentTurnChanged?: (seat: number) => void;
  public onTurnStepChanged?: (step: string) => void;
  public onArrowRotationChanged?: (rotY: number) => void;
  public onActiveCardTypeChanged?: (cardType: string) => void;
  public onTeamsUpdated?: (teams: CircoTeamState[]) => void;

  public onPlayerJoined?: (sessionId: string, player: RemoteCircoPlayer) => void;
  public onPlayerLeft?: (sessionId: string) => void;
  public onPlayerMoved?: (sessionId: string, player: RemoteCircoPlayer) => void;

  public onSeatClaimed?: (payload: { teamId: string; teamName: string; seat: number; representativeName: string }) => void;
  public onRouletteSpun?: (payload: { teamName: string; targetRotationY: number; cardType: string }) => void;
  public onCardEmerged?: (payload: { cardType: string; teamName: string }) => void;
  public onCardPlaceholder?: (payload: { teamName: string; cardType: string }) => void;
  public onQuestionStarted?: (payload: QuestionDataPayload) => void;
  public onQuestionResult?: (payload: QuestionResultPayload) => void;
  public onQuestionTimeout?: (payload: { teamName: string; message: string }) => void;
  public onOpportunityEarned?: (payload: { teamName: string; opportunities: number }) => void;
  public onMatchFinished?: (payload: { message: string }) => void;
  public onMatchTerminated?: (payload: { message: string }) => void;
  public onErrorReceived?: (message: string) => void;

  constructor() {
    const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const wsUrl = rawApiUrl.replace(/^http/, 'ws');
    this.client = new Client(wsUrl);
  }

  public async joinMatch(matchId: string): Promise<Room | null> {
    if (this.room || this.isConnecting) {
      return this.room;
    }

    this.isConnecting = true;
    try {
      this.room = await this.client.joinOrCreate('circo_room', { matchId });
      this.mySessionId = this.room.sessionId;
      console.log(`[INFO] Conectado a circo_room (${this.room.roomId}) con sessionId: ${this.mySessionId}`);

      if (this.onConnected && this.mySessionId) {
        this.onConnected(this.mySessionId);
      }

      this.setupRoomListeners();
      return this.room;
    } catch (err) {
      console.error('[ERROR] Error al conectar a circo_room:', err);
      this.isConnecting = false;
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;
    const room = this.room;
    const $ = getStateCallbacks(room);

    // Mensajes individuales y de servidor
    room.onMessage('init_player', (data: { sessionId: string; userId: string; teamId: string; seat: number; isRepresentative: boolean }) => {
      this.myUserId = data.userId;
      this.myTeamId = data.teamId;
      this.mySeat = data.seat;
      this.isRepresentative = data.isRepresentative;
    });

    room.onMessage('seat_claimed', (payload) => {
      if (this.onSeatClaimed) this.onSeatClaimed(payload);
    });

    room.onMessage('phase_changed', (payload) => {
      if (this.onPhaseChanged) this.onPhaseChanged(payload.phase);
      if (this.onCurrentTurnChanged) this.onCurrentTurnChanged(payload.currentTurnSeat);
    });

    room.onMessage('roulette_spun', (payload) => {
      if (this.onRouletteSpun) this.onRouletteSpun(payload);
    });

    room.onMessage('card_emerged', (payload) => {
      if (this.onCardEmerged) this.onCardEmerged(payload);
    });

    room.onMessage('card_placeholder', (payload) => {
      if (this.onCardPlaceholder) this.onCardPlaceholder(payload);
    });

    room.onMessage('question_started', (payload: QuestionDataPayload) => {
      if (this.onQuestionStarted) this.onQuestionStarted(payload);
    });

    room.onMessage('question_result', (payload: QuestionResultPayload) => {
      if (this.onQuestionResult) this.onQuestionResult(payload);
    });

    room.onMessage('question_timeout', (payload) => {
      if (this.onQuestionTimeout) this.onQuestionTimeout(payload);
    });

    room.onMessage('opportunity_earned', (payload) => {
      if (this.onOpportunityEarned) this.onOpportunityEarned(payload);
    });

    room.onMessage('turn_changed', (payload) => {
      if (this.onCurrentTurnChanged) this.onCurrentTurnChanged(payload.currentTurnSeat);
    });

    room.onMessage('match_finished', (payload) => {
      if (this.onMatchFinished) this.onMatchFinished(payload);
    });

    room.onMessage('match_terminated', (payload) => {
      if (this.onMatchTerminated) this.onMatchTerminated(payload);
    });

    room.onMessage('error', (payload: { message: string }) => {
      if (this.onErrorReceived) this.onErrorReceived(payload.message);
    });

    // 1. Sincronizacion de jugadores remotos
    const knownSessionIds = new Set<string>();

    const registerPlayer = (player: any, sessionId: string) => {
      if (sessionId === this.mySessionId) return;
      if (knownSessionIds.has(sessionId)) return;
      knownSessionIds.add(sessionId);

      const playerData: RemoteCircoPlayer = {
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
            if (this.onPlayerLeft) {
              this.onPlayerLeft(knownId);
            }
          }
        }
      }
    };

    $((room.state as any).players).onAdd((player: any, sessionId: string) => {
      registerPlayer(player, sessionId);
    });

    $((room.state as any).players).onRemove((_player: any, sessionId: string) => {
      knownSessionIds.delete(sessionId);
      if (sessionId === this.mySessionId) return;
      if (this.onPlayerLeft) {
        this.onPlayerLeft(sessionId);
      }
    });

    // 2. Escuchar cambios de estado reactivo global
    const syncTeams = () => {
      if (!this.onTeamsUpdated || !this.room?.state) return;
      const teamsMap = (this.room.state as any).teams;
      if (!teamsMap) return;

      const list: CircoTeamState[] = [];
      if (typeof teamsMap.forEach === 'function') {
        teamsMap.forEach((t: any) => {
          if (t && t.teamId) {
            list.push({
              teamId: t.teamId,
              name: t.name,
              color: t.color,
              score: t.score || 0,
              seat: t.seat || 0,
              representativeId: t.representativeId || '',
              representativeName: t.representativeName || '',
              tokenPosition: t.tokenPosition || 0,
              opportunities: t.opportunities || 0,
            });
          }
        });
      } else if (typeof teamsMap.values === 'function') {
        for (const t of teamsMap.values()) {
          if (t && t.teamId) {
            list.push({
              teamId: t.teamId,
              name: t.name,
              color: t.color,
              score: t.score || 0,
              seat: t.seat || 0,
              representativeId: t.representativeId || '',
              representativeName: t.representativeName || '',
              tokenPosition: t.tokenPosition || 0,
              opportunities: t.opportunities || 0,
            });
          }
        }
      }

      const json = JSON.stringify(list);
      if (json !== this.lastTeamsJson) {
        this.lastTeamsJson = json;
        this.onTeamsUpdated(list);
      }
    };

    room.onStateChange((state: any) => {
      if (!state) return;

      if (typeof state.phase === 'string' && state.phase !== this.lastPhase) {
        this.lastPhase = state.phase;
        if (this.onPhaseChanged) {
          this.onPhaseChanged(state.phase);
        }
      }
      if (typeof state.timeRemaining === 'number' && state.timeRemaining !== this.lastTimeRemaining) {
        this.lastTimeRemaining = state.timeRemaining;
        if (this.onTimeRemainingChanged) {
          this.onTimeRemainingChanged(state.timeRemaining);
        }
      }
      if (typeof state.questionTimeRemaining === 'number' && state.questionTimeRemaining !== this.lastQuestionTimeRemaining) {
        this.lastQuestionTimeRemaining = state.questionTimeRemaining;
        if (this.onQuestionTimeRemainingChanged) {
          this.onQuestionTimeRemainingChanged(state.questionTimeRemaining);
        }
      }
      if (typeof state.currentTurnSeat === 'number' && state.currentTurnSeat !== this.lastCurrentTurnSeat) {
        this.lastCurrentTurnSeat = state.currentTurnSeat;
        if (this.onCurrentTurnChanged) {
          this.onCurrentTurnChanged(state.currentTurnSeat);
        }
      }
      if (typeof state.turnStep === 'string' && state.turnStep !== this.lastTurnStep) {
        this.lastTurnStep = state.turnStep;
        if (this.onTurnStepChanged) {
          this.onTurnStepChanged(state.turnStep);
        }
      }
      if (typeof state.arrowRotationY === 'number' && Math.abs(state.arrowRotationY - this.lastArrowRotationY) > 0.001) {
        this.lastArrowRotationY = state.arrowRotationY;
        if (this.onArrowRotationChanged) {
          this.onArrowRotationChanged(state.arrowRotationY);
        }
      }
      if (typeof state.activeCardType === 'string' && state.activeCardType !== this.lastActiveCardType) {
        this.lastActiveCardType = state.activeCardType;
        if (this.onActiveCardTypeChanged) {
          this.onActiveCardTypeChanged(state.activeCardType);
        }
      }

      syncTeams();
      syncExistingPlayers();
    });

    // Llamar sincronizacion inicial de jugadores ya presentes en la sala
    syncExistingPlayers();

    room.onLeave(() => {
      console.log('[INFO] Desconectado de circo_room.');
      if (this.onDisconnect) this.onDisconnect();
    });
  }

  public claimSeat(seat: number): void {
    if (!this.room) return;
    this.room.send('claim_seat', { seat });
  }

  public spinRoulette(): void {
    if (!this.room) return;
    this.room.send('spin_roulette', {});
  }

  public answerQuestion(questionId: number, selectedOption: string): void {
    if (!this.room) return;
    this.room.send('answer_question', { questionId, selectedOption });
  }

  public sendMove(x: number, y: number, z: number, ry: number, animState: string): void {
    this.sendPlayerPosition(x, y, z, ry, animState);
  }

  public sendPlayerPosition(x: number, y: number, z: number, ry: number, animState: string): void {
    if (!this.room) return;

    const now = performance.now();
    if (now - this.lastMoveSentTime < 50) return; // ~20 FPS

    const posChanged =
      Math.abs(x - this.lastSentPos.x) > 0.05 ||
      Math.abs(y - this.lastSentPos.y) > 0.05 ||
      Math.abs(z - this.lastSentPos.z) > 0.05 ||
      Math.abs(ry - this.lastSentPos.ry) > 0.05 ||
      animState !== this.lastSentPos.animState;

    if (!posChanged) return;

    this.lastMoveSentTime = now;
    this.lastSentPos = { x, y, z, ry, animState };

    const payload = {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
      ry: Number(ry.toFixed(2)),
      animState,
    };

    this.room.send('player_move', payload);
    this.room.send('move', payload);
  }

  public getCurrentTeams(): CircoTeamState[] {
    if (!this.room?.state) return [];
    const teamsMap = (this.room.state as any).teams;
    if (!teamsMap) return [];
    const list: CircoTeamState[] = [];
    if (typeof teamsMap.forEach === 'function') {
      teamsMap.forEach((t: any) => {
        if (t && t.teamId) {
          list.push({
            teamId: t.teamId,
            name: t.name,
            color: t.color,
            score: t.score || 0,
            seat: t.seat || 0,
            representativeId: t.representativeId || '',
            representativeName: t.representativeName || '',
            tokenPosition: t.tokenPosition || 0,
            opportunities: t.opportunities || 0,
          });
        }
      });
    }
    return list;
  }

  public leave(): void {
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
  }
}
