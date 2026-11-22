/**
 * Servicio encargado de recopilar metricas basicas del estado de salud del sistema.
 */
export class HealthService {
  /**
   * Obtiene la informacion del estado del proceso y su tiempo de actividad.
   */
  public static getHealthStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
