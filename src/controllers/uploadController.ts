// ============================================
// UPLOAD CONTROLLER
// ============================================
// Handles file upload endpoints

import { Request, Response } from 'express';
import { uploadMultipleFiles, isStorageConfigured } from '../services/storage';

/**
 * Upload images for a post
 * POST /api/upload/images
 */
export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if storage is configured
    if (!isStorageConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Storage nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_ANON_KEY setzen.',
        statusCode: 503,
      });
      return;
    }

    const userId = req.user!.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Keine Dateien zum Hochladen.',
        statusCode: 400,
      });
      return;
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.mimetype));

    if (invalidFiles.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nur Bilder (JPEG, PNG, GIF, WebP) sind erlaubt.',
        statusCode: 400,
      });
      return;
    }

    // Check file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(f => f.size > maxSize);

    if (oversizedFiles.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Dateien dürfen maximal 10MB groß sein.',
        statusCode: 400,
      });
      return;
    }

    console.log(`[Upload] ${files.length} Dateien werden hochgeladen für User ${userId}`);

    // Upload files to Supabase Storage
    const urls = await uploadMultipleFiles(files, userId);

    if (urls.length === 0) {
      res.status(500).json({
        success: false,
        error: 'Upload Failed',
        message: 'Fehler beim Hochladen der Dateien.',
        statusCode: 500,
      });
      return;
    }

    console.log(`[Upload] ${urls.length} Dateien erfolgreich hochgeladen`);

    res.status(200).json({
      success: true,
      data: {
        urls,
        count: urls.length,
      },
      message: `${urls.length} Datei(en) erfolgreich hochgeladen.`,
    });
  } catch (error) {
    console.error('[Upload] Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Hochladen.',
      statusCode: 500,
    });
  }
};
