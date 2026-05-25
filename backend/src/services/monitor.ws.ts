import { Server as SocketIO } from 'socket.io';
import { AppDataSource } from '../config/database';
import { Connection } from '../entities/connection.entity';
import { decrypt } from '../config/encryption';
import { createAdapter } from '../adapters/adapter.factory';

let io: SocketIO;

export function initMonitorSocket(socketIo: SocketIO) {
  io = socketIo;

  io.on('connection', (socket) => {
    // Client joins a monitoring room for a specific connection
    socket.on('monitor:subscribe', async (connId: string) => {
      socket.join(`monitor:${connId}`);
      // Send initial data
      try {
        const data = await fetchMonitorData(connId);
        socket.emit('monitor:data', data);
      } catch (err: any) {
        socket.emit('monitor:error', { error: err.message });
      }
    });

    socket.on('monitor:unsubscribe', (connId: string) => {
      socket.leave(`monitor:${connId}`);
    });
  });

  // Poll every 5 seconds for active rooms
  setInterval(async () => {
    const rooms = io.sockets.adapter.rooms;
    for (const [roomName] of rooms) {
      if (!roomName.startsWith('monitor:')) continue;
      const connId = roomName.replace('monitor:', '');
      const sockets = await io.in(roomName).fetchSockets();
      if (sockets.length === 0) continue;

      try {
        const data = await fetchMonitorData(connId);
        io.to(roomName).emit('monitor:data', data);
      } catch (err: any) {
        io.to(roomName).emit('monitor:error', { error: err.message });
      }
    }
  }, 5000);
}

async function fetchMonitorData(connId: string) {
  const connRepo = AppDataSource.getRepository(Connection);
  const conn = await connRepo.findOne({ where: { id: connId, isActive: true } });
  if (!conn) throw new Error('Connection not found');

  const adapter = createAdapter(conn.dbType);
  await adapter.connect({ host: conn.host, port: conn.port, database: conn.databaseName, username: conn.username, password: decrypt(conn.passwordEncrypted) });

  const [queries, locks] = await Promise.all([adapter.getActiveQueries(), adapter.getLocks()]);
  await adapter.disconnect();

  return { queries, locks, timestamp: Date.now() };
}
