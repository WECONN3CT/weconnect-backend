// ============================================
// SECURITY MIDDLEWARE
// ============================================
// Professionelle Sicherheits-Middleware für die API

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================
// RATE LIMITING
// ============================================

// Allgemeines Rate Limiting für alle Routen
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Anfragen pro IP
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Zu viele Anfragen. Bitte versuche es später erneut.',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strenges Rate Limiting für Auth-Endpunkte (Login, Signup)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Max 5 Login/Signup-Versuche
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Erfolgreiche Logins nicht zählen
});

// Rate Limiting für API-Endpunkte
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 60, // Max 60 Anfragen pro Minute
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'API-Limit erreicht. Bitte warte kurz.',
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// HELMET - SECURITY HEADERS
// ============================================

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Für API nicht nötig
  hsts: {
    maxAge: 31536000, // 1 Jahr
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ============================================
// WEBHOOK AUTHENTICATION
// ============================================

// Webhook-Secret für n8n Callbacks (muss in ENV gesetzt werden)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Middleware zur Verifizierung von Webhook-Requests
export const verifyWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Wenn kein Secret konfiguriert, Warnung loggen aber durchlassen (für Entwicklung)
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️ WEBHOOK_SECRET nicht konfiguriert! Webhook-Authentifizierung deaktiviert.');
    next();
    return;
  }

  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Webhook-Signatur fehlt.',
      statusCode: 401,
    });
    return;
  }

  // Timestamp prüfen (max 5 Minuten alt)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - requestTime) > 300) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Webhook-Request abgelaufen.',
      statusCode: 401,
    });
    return;
  }

  // Signatur verifizieren
  const payload = JSON.stringify(req.body) + timestamp;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Ungültige Webhook-Signatur.',
      statusCode: 401,
    });
    return;
  }

  next();
};

// ============================================
// INPUT SANITIZATION
// ============================================

// Gefährliche HTML/Script-Tags entfernen
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// Middleware für Request-Body-Sanitization
export const sanitizeRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeInput(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key of Object.keys(obj)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }
  next();
};

// ============================================
// PASSWORD VALIDATION
// ============================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Passwort muss mindestens 8 Zeichen lang sein.');
  }
  if (password.length > 128) {
    errors.push('Passwort darf maximal 128 Zeichen lang sein.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Großbuchstaben enthalten.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Passwort muss mindestens einen Kleinbuchstaben enthalten.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Passwort muss mindestens eine Zahl enthalten.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Passwort muss mindestens ein Sonderzeichen enthalten.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ============================================
// EMAIL VALIDATION
// ============================================

export const validateEmail = (email: string): boolean => {
  // Strengere E-Mail-Validierung
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) return false;
  if (email.length > 254) return false;

  // Domain muss mindestens einen Punkt haben
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  if (!parts[1].includes('.')) return false;

  // TLD muss mindestens 2 Zeichen haben
  const tld = parts[1].split('.').pop();
  if (!tld || tld.length < 2) return false;

  return true;
};

// ============================================
// CONTENT LENGTH VALIDATION
// ============================================

export const validateContentLength = (
  content: string,
  maxLength: number = 10000
): boolean => {
  return content.length <= maxLength;
};
