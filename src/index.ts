// ============================================
// HAUPTDATEI - Server Start
// ============================================
// Professionelle, sichere Express.js API

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Umgebungsvariablen laden (MUSS zuerst passieren!)
dotenv.config();

// Security Middleware importieren
import {
  generalLimiter,
  authLimiter,
  apiLimiter,
  securityHeaders,
  verifyWebhookSignature,
  sanitizeRequestBody,
} from './middleware/security';

// Routen importieren
import authRoutes from './routes/authRoutes';
import postsRoutes from './routes/postsRoutes';
import connectionsRoutes from './routes/connectionsRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Datenbank initialisieren (PostgreSQL)
import { initializeDatabase, db } from './config/database';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SICHERHEITS-CHECKS BEIM START
// ============================================

const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error('❌ KRITISCHER FEHLER: Fehlende Umgebungsvariablen:');
  missingEnvVars.forEach(v => console.error(`   - ${v}`));
  console.error('   Bitte setze diese in der .env Datei oder in Railway.');
  process.exit(1);
}

// Warnung wenn WEBHOOK_SECRET nicht gesetzt
if (!process.env.WEBHOOK_SECRET) {
  console.warn('⚠️  WARNUNG: WEBHOOK_SECRET nicht gesetzt. Webhook-Authentifizierung deaktiviert.');
}

// ============================================
// SECURITY MIDDLEWARE (ZUERST!)
// ============================================

// Helmet Security Headers
app.use(securityHeaders);

// Allgemeines Rate Limiting
app.use(generalLimiter);

// ============================================
// STANDARD MIDDLEWARE
// ============================================

// CORS - Erlaubt Anfragen vom Frontend
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Erlaubt Anfragen ohne Origin (z.B. mobile Apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blockiert: ${origin}`);
      callback(new Error('Nicht erlaubt durch CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature', 'X-Webhook-Timestamp'],
}));

// JSON Parser mit Größenlimit (Schutz vor großen Payloads)
app.use(express.json({ limit: '1mb' }));

// Input Sanitization
app.use(sanitizeRequestBody);

// Request Logger (ohne sensitive Daten!)
app.use((req, res, next) => {
  // Keine Passwörter oder Tokens loggen
  const safeLog = `${req.method} ${req.path}`;
  console.log(`📥 ${safeLog}`);
  next();
});

// ============================================
// ROUTEN
// ============================================

// Health Check - Prüft ob Server läuft (ohne sensible Infos)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server läuft! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// Auth Routen mit strengem Rate Limiting
app.use('/api/auth', authLimiter, authRoutes);

// API Routen mit Standard Rate Limiting
app.use('/api/posts', apiLimiter, postsRoutes);
app.use('/api/connections', apiLimiter, connectionsRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);

// ============================================
// WEBHOOK ENDPUNKT FÜR N8N CALLBACKS
// ============================================

// n8n kann hier Status-Updates senden (mit Authentifizierung)
app.post('/api/webhook/n8n/callback', verifyWebhookSignature, async (req, res) => {
  // Keine sensiblen Daten loggen!
  console.log('📬 n8n Callback erhalten');

  const { postId, status, error } = req.body;

  // Validierung
  if (!postId || typeof postId !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'postId ist erforderlich.',
      statusCode: 400,
    });
    return;
  }

  const validStatuses = ['published', 'failed', 'pending'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Ungültiger Status.',
      statusCode: 400,
    });
    return;
  }

  try {
    // Post-Status in der Datenbank aktualisieren
    const post = await db.findPostById(postId);
    if (post) {
      await db.updatePost(postId, {
        status: status || 'published',
        publishedAt: status === 'published' ? new Date().toISOString() : undefined,
      });
      console.log(`✅ Post ${postId} Status aktualisiert: ${status}`);
    } else {
      console.warn(`⚠️ Post ${postId} nicht gefunden`);
    }

    res.json({ success: true, received: true });
  } catch (err) {
    console.error('Webhook Verarbeitungsfehler:', err);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler bei der Verarbeitung.',
      statusCode: 500,
    });
  }
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'Route nicht gefunden.',
    statusCode: 404,
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Keine Stack-Traces in Produktion loggen
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Server Fehler:', err);
  } else {
    console.error('❌ Server Fehler:', err.message);
  }

  // Generische Fehlermeldung (keine Details preisgeben)
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

const HOST = '0.0.0.0'; // Wichtig für Railway/Docker

initializeDatabase()
  .then(() => {
    app.listen(Number(PORT), HOST, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════╗');
      console.log('║                                                    ║');
      console.log('║   🚀 WeConnect Backend gestartet!                  ║');
      console.log('║   🔒 Security Features aktiviert                   ║');
      console.log('║                                                    ║');
      console.log(`║   📍 Server:    http://localhost:${PORT}              ║`);
      console.log(`║   📍 API:       http://localhost:${PORT}/api          ║`);
      console.log('║                                                    ║');
      console.log('║   ✅ Rate Limiting aktiv                           ║');
      console.log('║   ✅ Security Headers aktiv                        ║');
      console.log('║   ✅ Input Sanitization aktiv                      ║');
      console.log('║                                                    ║');
      console.log('╚════════════════════════════════════════════════════╝');
      console.log('');
    });
  })
  .catch((error) => {
    console.error('Fehler beim Starten:', error);
    process.exit(1);
  });
