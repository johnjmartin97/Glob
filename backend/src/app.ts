import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { exercisesRouter } from './modules/exercises/exercises.routes';
import { templatesRouter } from './modules/templates/templates.routes';
import { sessionsRouter } from './modules/sessions/sessions.routes';
import { nutritionRouter } from './modules/nutrition/nutrition.routes';
import { supplementsRouter } from './modules/supplements/supplements.routes';
import { sleepRouter } from './modules/sleep/sleep.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/exercises', exercisesRouter);
  api.use('/templates', templatesRouter);
  api.use('/sessions', sessionsRouter);
  api.use('/nutrition', nutritionRouter);
  api.use('/supplements', supplementsRouter);
  api.use('/sleep', sleepRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
