import { verifyAccessToken } from './utils/tokens.js';

export function configureSocket(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyAccessToken(token);
      if (payload.type !== 'access') throw new Error('Invalid token type');
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
    socket.emit('connected', { userId: socket.user.id, role: socket.user.role });
    socket.on('heartbeat', () => socket.emit('heartbeat', { ok: true, timestamp: Date.now() }));
  });
}
