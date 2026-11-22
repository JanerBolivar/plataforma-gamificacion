import apiClient from '../api/client';
import { MatchesResponse, MatchLobbyDetails, MatchCollectibleDto } from '../types/match';

export const matchService = {
  async getMatches(): Promise<MatchesResponse> {
    const response = await apiClient.get<{ status: string; data: MatchesResponse }>('/api/matches');
    return response.data.data;
  },

  async createMatch(data: { name: string; maxTeams: number }): Promise<{ id: string }> {
    const response = await apiClient.post<{ status: string; data: { id: string } }>(
      '/api/matches',
      data
    );
    return response.data.data;
  },

  async getMatchLobby(matchId: string): Promise<MatchLobbyDetails> {
    const response = await apiClient.get<{ status: string; data: MatchLobbyDetails }>(
      `/api/matches/${matchId}`
    );
    return response.data.data;
  },

  async joinMatch(matchId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/join`);
  },

  async leaveMatch(matchId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/leave`);
  },

  async createTeam(matchId: string, name: string): Promise<{ id: string }> {
    const response = await apiClient.post<{ status: string; data: { id: string } }>(
      `/api/matches/${matchId}/teams`,
      { name }
    );
    return response.data.data;
  },

  async joinTeam(matchId: string, teamId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/teams/${teamId}/join`);
  },

  async leaveTeam(matchId: string, teamId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/teams/${teamId}/leave`);
  },

  async inviteToTeam(matchId: string, teamId: string, inviteeId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/teams/${teamId}/invite`, { inviteeId });
  },

  async respondInvitation(
    matchId: string,
    invitationId: string,
    action: 'ACCEPT' | 'REJECT'
  ): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/invitations/${invitationId}/respond`, {
      action,
    });
  },

  async startMatch(matchId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/start`);
  },

  async finishMatch(matchId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/finish`);
  },

  async cancelMatch(matchId: string): Promise<void> {
    await apiClient.post(`/api/matches/${matchId}/cancel`);
  },

  async getMatchCollectibles(matchId: string): Promise<MatchCollectibleDto[]> {
    const response = await apiClient.get<{ status: string; data: MatchCollectibleDto[] }>(
      `/api/matches/${matchId}/collectibles`
    );
    return response.data.data;
  },
};
