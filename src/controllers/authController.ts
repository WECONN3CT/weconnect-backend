// ============================================
// AUTH CONTROLLER
// ============================================
// Verarbeitet Login, Signup, Logout Anfragen

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { User, SafeUser, LoginCredentials, SignupCredentials } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-nicht-sicher';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Hilfsfunktion: Token erstellen
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' } as jwt.SignOptions);
};

// Hilfsfunktion: Passwort aus User entfernen
const toSafeUser = (user: User): SafeUser => {
  const { password, ...safeUser } = user;
  return safeUser;
};

// ============================================
// SIGNUP - Neuen Benutzer registrieren
// ============================================
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Signup request body:', req.body);
    const { email, password, firstName, lastName } = req.body as SignupCredentials;
    const name = `${firstName} ${lastName}`;
    console.log('Parsed data:', { email, password: '***', firstName, lastName, name });

    // Validierung
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Alle Felder müssen ausgefüllt sein.',
        statusCode: 400,
      });
      return;
    }

    // E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Ungültige E-Mail-Adresse.',
        statusCode: 400,
      });
      return;
    }

    // Prüfen ob E-Mail bereits existiert
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Diese E-Mail-Adresse ist bereits registriert.',
        statusCode: 409,
      });
      return;
    }

    // Passwort verschlüsseln
    const hashedPassword = await bcrypt.hash(password, 12);

    // Benutzer erstellen
    const now = new Date().toISOString();
    const newUser: User = {
      id: uuidv4(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      firstName,
      lastName,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.createUser(newUser);
    } catch (dbError) {
      console.error('Database Error beim User erstellen:', dbError);
      throw dbError;
    }

    // Token erstellen
    const token = generateToken(newUser.id);

    console.log(`✅ Neuer Benutzer registriert: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: toSafeUser(newUser),
        token,
      },
      message: 'Erfolgreich registriert!',
    });
  } catch (error: any) {
    console.error('Signup Fehler Details:', {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error?.message || 'Ein Fehler ist aufgetreten.',
      statusCode: 500,
    });
  }
};

// ============================================
// LOGIN - Benutzer anmelden
// ============================================
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginCredentials;

    // Validierung
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'E-Mail und Passwort sind erforderlich.',
        statusCode: 400,
      });
      return;
    }

    // Benutzer finden
    const user = await db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'E-Mail oder Passwort ist falsch.',
        statusCode: 401,
      });
      return;
    }

    // Passwort prüfen
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'E-Mail oder Passwort ist falsch.',
        statusCode: 401,
      });
      return;
    }

    // Token erstellen
    const token = generateToken(user.id);

    console.log(`✅ Benutzer eingeloggt: ${email}`);

    res.status(200).json({
      success: true,
      data: {
        user: toSafeUser(user),
        token,
      },
      message: 'Erfolgreich eingeloggt!',
    });
  } catch (error) {
    console.error('Login Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Ein Fehler ist aufgetreten.',
      statusCode: 500,
    });
  }
};

// ============================================
// LOGOUT - Benutzer abmelden
// ============================================
export const logout = async (req: Request, res: Response): Promise<void> => {
  // Bei JWT-basierter Auth wird das Token clientseitig gelöscht
  // Server muss nichts tun
  console.log(`✅ Benutzer ausgeloggt`);

  res.status(200).json({
    success: true,
    data: null,
    message: 'Erfolgreich ausgeloggt!',
  });
};

// ============================================
// ME - Aktuellen Benutzer abrufen
// ============================================
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.user wird von der Auth-Middleware gesetzt
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Nicht eingeloggt.',
        statusCode: 401,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    console.error('Me Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Ein Fehler ist aufgetreten.',
      statusCode: 500,
    });
  }
};
