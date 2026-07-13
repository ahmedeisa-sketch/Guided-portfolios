import { ZodError } from 'zod';
import { config } from '../config.js';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` } });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: error.flatten().fieldErrors
      }
    });
  }

  const status = Number(error.status || 500);
  const code = error.code || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Internal server error' : error.message;

  if (status >= 500) console.error(error);

  return res.status(status).json({
    error: {
      code,
      message,
      ...(config.isProduction || status < 500 ? {} : { detail: error.message })
    }
  });
}
