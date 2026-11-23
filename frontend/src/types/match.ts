export type MatchStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type MatchStage = 'LOBBY' | 'SWAMP' | 'CIRCO' | 'FINISHED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface MatchSummary {
  id: string;
  name: string;
  maxTeams: number;
  maxTeamMembers: number;
  status: MatchStatus;
  currentStage?: MatchStage;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  teamCount: number;
  participantCount: number;
}

export interface MyActiveMatch {
  match: {
    id: string;
    name: string;
    maxTeams: number;
    maxTeamMembers: number;
    status: MatchStatus;
    currentStage?: MatchStage;
    creator: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  team: {
    id: string;
    name: string;
    swampCompleted?: boolean;
  } | null;
}

export interface MatchesResponse {
  activeMatches: MatchSummary[];
  myActiveMatch: MyActiveMatch | null;
  historyMatches: MatchSummary[];
  allMatches?: MatchSummary[];
}

export interface TeamMember {
  participantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface LobbyTeam {
  id: string;
  name: string;
  score?: number;
  circoSeat?: number | null;
  circoOpportunities?: number;
  circoTokenPosition?: number;
  swampCompleted?: boolean;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

export interface LobbyParticipant {
  participantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface PendingInvitation {
  id: string;
  matchId: string;
  teamId: string;
  status: InvitationStatus;
  createdAt: string;
  team: {
    id: string;
    name: string;
  };
  inviter: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MatchLobbyDetails {
  match: {
    id: string;
    name: string;
    maxTeams: number;
    maxTeamMembers: number;
    status: MatchStatus;
    currentStage?: MatchStage;
    creator: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  };
  teams: LobbyTeam[];
  unassignedParticipants: LobbyParticipant[];
  myPendingInvitations: PendingInvitation[];
}

export type CollectibleType = 'ADIVINALO' | 'CARTA_PREGUNTA' | 'TIBURON_AZUL' | 'TIBURON_ROJO';

export interface MatchCollectibleDto {
  id: string;
  type: CollectibleType;
  posX: number;
  posZ: number;
  collectedByTeamId?: string | null;
}
