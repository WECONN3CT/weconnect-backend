// ============================================
// CONNECTIONS CONTROLLER
// ============================================
// Verwaltet Social Media Konten Verbindungen

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Connection } from '../types';

// ============================================
// GET ALL CONNECTIONS - Alle Verbindungen
// ============================================
export const getAllConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const connections = await db.findConnectionsByUserId(userId);

    res.status(200).json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('GetAllConnections Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der Verbindungen.',
      statusCode: 500,
    });
  }
};

// ============================================
// CREATE CONNECTION - Neue Verbindung erstellen
// ============================================
export const createConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { platform, accessToken, accountName, accountId, refreshToken, expiresAt } = req.body;

    // Validierung
    if (!platform) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Plattform ist erforderlich.',
        statusCode: 400,
      });
      return;
    }

    const validPlatforms = ['instagram', 'linkedin', 'facebook', 'instagram-feed', 'instagram-reels'];
    if (!validPlatforms.includes(platform)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Ungültige Plattform. Erlaubt: ${validPlatforms.join(', ')}`,
        statusCode: 400,
      });
      return;
    }

    const now = new Date().toISOString();

    const newConnection: Connection = {
      id: uuidv4(),
      userId,
      platform,
      status: accessToken ? 'connected' : 'pending',
      accountName,
      accountId,
      accessToken,
      refreshToken,
      expiresAt,
      connectedAt: accessToken ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.createConnection(newConnection);

    console.log(`✅ Neue Verbindung erstellt: ${platform}`);

    res.status(201).json({
      success: true,
      data: newConnection,
      message: `${platform} erfolgreich verbunden!`,
    });
  } catch (error) {
    console.error('CreateConnection Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Erstellen der Verbindung.',
      statusCode: 500,
    });
  }
};

// ============================================
// UPDATE CONNECTION - Verbindung aktualisieren
// ============================================
export const updateConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const updates = req.body as Partial<Connection>;

    const connection = await db.findConnectionById(id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Verbindung nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (connection.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diese Verbindung.',
        statusCode: 403,
      });
      return;
    }

    const updatedConnection = await db.updateConnection(id, updates);

    console.log(`✅ Verbindung aktualisiert: ${id}`);

    res.status(200).json({
      success: true,
      data: updatedConnection,
      message: 'Verbindung erfolgreich aktualisiert!',
    });
  } catch (error) {
    console.error('UpdateConnection Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Aktualisieren der Verbindung.',
      statusCode: 500,
    });
  }
};

// ============================================
// DELETE CONNECTION - Verbindung löschen
// ============================================
export const deleteConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const connection = await db.findConnectionById(id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Verbindung nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (connection.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diese Verbindung.',
        statusCode: 403,
      });
      return;
    }

    await db.deleteConnection(id);

    console.log(`✅ Verbindung gelöscht: ${connection.platform}`);

    res.status(200).json({
      success: true,
      data: null,
      message: 'Verbindung erfolgreich getrennt!',
    });
  } catch (error) {
    console.error('DeleteConnection Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Löschen der Verbindung.',
      statusCode: 500,
    });
  }
};

// ============================================
// RECONNECT - Verbindung neu verbinden
// ============================================
export const reconnectConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const { accessToken, refreshToken, expiresAt } = req.body;

    const connection = await db.findConnectionById(id);

    if (!connection) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Verbindung nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (connection.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diese Verbindung.',
        statusCode: 403,
      });
      return;
    }

    const updatedConnection = await db.updateConnection(id, {
      status: 'connected',
      accessToken,
      refreshToken,
      expiresAt,
      connectedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      errorMessage: undefined,
    });

    console.log(`✅ Verbindung wiederhergestellt: ${connection.platform}`);

    res.status(200).json({
      success: true,
      data: updatedConnection,
      message: 'Verbindung erfolgreich wiederhergestellt!',
    });
  } catch (error) {
    console.error('ReconnectConnection Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Wiederherstellen der Verbindung.',
      statusCode: 500,
    });
  }
};
