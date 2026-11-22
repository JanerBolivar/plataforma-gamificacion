import { apiClient } from '../api/client';
import { HealthStatus } from '../types/health';

export const healthService = {
  async checkHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>('/api/health');
    return response.data;
  },
};
