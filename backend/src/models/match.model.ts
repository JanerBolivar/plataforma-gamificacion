import { MatchStatus, MatchStage, InvitationStatus, Role } from '@prisma/client';

export interface CreateMatchInput {
  name: string;
  maxTeams: number;
}

export interface CreateTeamInput {
  name: string;
}

export interface RespondInvitationInput {
  action: 'ACCEPT' | 'REJECT';
}

export interface MatchSummary {
  id: string;
  name: string;
  maxTeams: number;
  maxTeamMembers: number;
  status: MatchStatus;
  currentStage: MatchStage;
  creatorId: string;
  creatorName: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  teamCount: number;
  participantCount: number;
}
