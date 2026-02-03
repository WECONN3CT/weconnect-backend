// ============================================
// HAUPTDATEI - Server Start
// ============================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Umgebungsvariablen laden
dotenv.config();

// Routen importieren
import authRoutes from './routes/authRoutes';
import postsRoutes from './routes/postsRoutes';
import connectionsRoutes from './routes/connectionsRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Datenbank initialisieren (PostgreSQL)
import { initializeDatabase } from './config/database';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Erlaubt Anfragen vom Frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// JSON Parser - Versteht JSON im Request Body
app.use(express.json());

// Request Logger - Zeigt alle Anfragen in der Konsole
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTEN
// ============================================

// Health Check - Prüft ob Server läuft
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server läuft! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// API Routen einbinden
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/analytics', analyticsRoutes);

// ============================================
// WEBHOOK ENDPUNKT FÜR N8N CALLBACKS
// ============================================

// n8n kann hier Status-Updates senden
app.post('/api/webhook/n8n/callback', express.json(), (req, res) => {
  console.log('📬 n8n Callback erhalten:', req.body);

  const { postId, status, error } = req.body;

  if (postId) {
    // Hier könnte man den Post-Status in der Datenbank aktualisieren
    console.log(`Post ${postId} Status: ${status || 'unbekannt'}`);
  }

  res.json({ success: true, received: true });
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} nicht gefunden.`,
    statusCode: 404,
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Fehler:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'Ein unerwarteter Fehler ist aufgetreten.',
    statusCode: 500,
  });
});

// ============================================
// SERVER STARTEN
// ============================================

// Datenbank initialisieren und Server starten
const HOST = '0.0.0.0'; // Wichtig für Railway/Docker - muss auf alle Interfaces hören

initializeDatabase()
  .then(() => {
    app.listen(Number(PORT), HOST, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════╗');
      console.log('║                                                    ║');
      console.log('║   🚀 WeConnect Backend gestartet!                  ║');
  console.log('║                                                    ║');
  console.log(`║   📍 Server:    http://localhost:${PORT}              ║`);
  console.log(`║   📍 API:       http://localhost:${PORT}/api          ║`);
  console.log('║                                                    ║');
  console.log('║   📚 Verfügbare Endpunkte:                         ║');
  console.log('║      • POST /api/auth/signup                       ║');
  console.log('║      • POST /api/auth/login                        ║');
  console.log('║      • GET  /api/auth/me                           ║');
  console.log('║      • GET  /api/posts                             ║');
  console.log('║      • POST /api/posts                             ║');
  console.log('║      • GET  /api/connections                       ║');
  console.log('║      • GET  /api/analytics/dashboard               ║');
  console.log('║                                                    ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
    });
  })
  .catch((error) => {
    console.error('Fehler beim Starten:', error);
    process.exit(1);
  });
