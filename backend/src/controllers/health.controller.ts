import { Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

/**
 * Controlador encargado de procesar solicitudes de comprobacion de estado del servicio.
 */
export class HealthController {
  /**
   * Responde con el estado operativo actual del servidor.
   */
  public static checkHealth(_req: Request, res: Response): void {
    const healthStatus = HealthService.getHealthStatus();
    res.status(200).json(healthStatus);
  }
}
