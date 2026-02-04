// ============================================
// SENTRY ERROR TRACKING - Backend (Optional)
// ============================================
// Um Sentry zu aktivieren:
// 1. npm install @sentry/node
// 2. Setze SENTRY_DSN in .env
// 3. Importiere initSentry in index.ts (vor allen anderen imports!)

import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryModule: any = null;
let sentryInitialized = false;

/**
 * Sentry initialisieren (nur wenn DSN konfiguriert ist)
 *
 * Installation:
 * npm install @sentry/node
 *
 * In index.ts (GANZ OBEN, vor anderen imports):
 * import { initSentry } from './lib/sentry';
 * initSentry();
 */
export const initSentry = async () => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] Nicht konfiguriert - Error Tracking deaktiviert');
    return;
  }

  try {
    // Dynamischer Import - funktioniert nur wenn @sentry/node installiert ist
    // @ts-ignore - Sentry ist optional
    sentryModule = await import('@sentry/node').catch(() => null);

    if (!sentryModule) {
      console.log('[Sentry] @sentry/node nicht installiert - npm install @sentry/node');
      return;
    }

    sentryModule.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      enabled: process.env.NODE_ENV === 'production',
    });

    sentryInitialized = true;
    console.log('[Sentry] Error Tracking aktiviert');
  } catch (error) {
    console.warn('[Sentry] Konnte nicht initialisiert werden:', error);
  }
};

/**
 * Sentry Request Handler Middleware
 */
export const sentryRequestHandler = () => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!sentryInitialized || !sentryModule) return next();

    sentryModule.setContext?.('request', {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    });

    next();
  };
};

/**
 * Sentry Error Handler Middleware
 */
export const sentryErrorHandler = () => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (!sentryInitialized || !sentryModule) return next(err);

    sentryModule.captureException?.(err, {
      extra: {
        method: req.method,
        url: req.url,
        body: req.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userId: (req as any).user?.id,
      },
    });

    next(err);
  };
};

/**
 * Manuell einen Fehler an Sentry senden
 */
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  if (!sentryInitialized || !sentryModule) {
    console.error('[Error]', error.message, context);
    return;
  }

  sentryModule.captureException?.(error, { extra: context });
};

/**
 * Benutzer-Kontext für Sentry setzen
 */
export const setUserContext = (user: { id: string; email: string } | null) => {
  if (!sentryInitialized || !sentryModule) return;

  if (user) {
    sentryModule.setUser?.({ id: user.id, email: user.email });
  } else {
    sentryModule.setUser?.(null);
  }
};
