import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import { config } from './config.js';
import { pool, query } from './db.js';
import { authRouter } from './routes/auth.js';
import { securityRouter } from './routes/security.js';
import { apiRouter } from './routes/api.js';
import { statementsRouter } from './routes/statements.js';
import { configureSocket } from './socket.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  console.info(JSON.stringify({ method: req.method, path: req.path, ip: req.ip }));
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not-ready' });
  }
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/security', authLimiter, securityRouter);
app.use('/api/statements', apiLimiter, statementsRouter);
app.use('/api', apiLimiter, apiRouter);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.allowedOrigins, credentials: true },
  transports: ['websocket', 'polling']
});
configureSocket(io);

server.listen(config.port, () => console.info(`EmCoin API listening on port ${config.port}`));

async function shutdown(signal) {
  console.info(`${signal} received, shutting down`);
  io.close();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
