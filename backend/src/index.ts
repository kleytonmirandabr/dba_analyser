import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', methods: ['GET', 'POST'] }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('short'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API routes placeholder
app.get('/api/status', (_req, res) => {
  res.json({ 
    data: { 
      service: 'DBA Analyser API',
      version: '1.0.0',
      uptime: process.uptime(),
      vpn: { connected: false, configUploaded: false }
    } 
  });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[WS] Client disconnected:', socket.id));
});

// Start
const PORT = parseInt(process.env.PORT || '3030');
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[DBA Analyser] Backend running on port ${PORT}`);
  console.log(`[DBA Analyser] Health: http://localhost:${PORT}/health`);
});

export { app, io };
