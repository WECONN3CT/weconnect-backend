// ============================================
// AUTH MIDDLEWARE
// ============================================
// Prüft ob der Benutzer eingeloggt ist (gültiger Token)

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { SafeUser } from '../types';

// JWT Secret - MUSS in Produktion gesetzt sein!
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ KRITISCHER FEHLER: JWT_SECRET ist nicht gesetzt!');
  console.error('   Bitte setze JWT_SECRET in den Umgebungsvariablen.');
  process.exit(1);
}

// Token aus dem Header extrahieren
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // "Bearer " entfernen
  }
  return null;
};

// Middleware: Prüft ob Benutzer eingeloggt ist
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Kein Token vorhanden. Bitte einloggen.',
        statusCode: 401,
      });
      return;
    }

    // Token verifizieren
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Benutzer aus Datenbank holen
    const user = await db.findUserById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Benutzer nicht gefunden.',
        statusCode: 401,
      });
      return;
    }

    // Benutzer an Request anhängen (ohne Passwort)
    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    req.user = safeUser;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Ungültiger Token. Bitte erneut einloggen.',
        statusCode: 401,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Ein Fehler ist aufgetreten.',
      statusCode: 500,
    });
  }
};
