import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

/**
 * Middleware global para la captura y respuesta estructurada de errores de la aplicacion.
 */
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  console.error(`[ERROR] ${statusCode} - ${message}`);
  if (err.stack) {
    console.error(`[ERROR] Pila de llamadas:\n${err.stack}`);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
