import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

/**
 * Configura e inicializa la instancia principal de la aplicacion Express.
 */
export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  app.use('/api', routes);

  app.use(errorHandler);

  return app;
};

export default createApp;
