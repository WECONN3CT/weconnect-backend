// ============================================
// POSTS CONTROLLER
// ============================================
// Verarbeitet alle Post-bezogenen Anfragen

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { db } from '../config/database';
import { Post, CreatePostInput, PostMetadata } from '../types';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';

// Hilfsfunktion: Metadata berechnen
const calculateMetadata = (content: string): PostMetadata => {
  const words = content.trim().split(/\s+/).filter(w => w.length > 0);
  const hashtags = content.match(/#\w+/g) || [];
  const mentions = content.match(/@\w+/g) || [];

  return {
    characterCount: content.length,
    wordCount: words.length,
    hashtags,
    mentions,
  };
};

// ============================================
// GET ALL POSTS - Alle Posts des Benutzers
// ============================================
export const getAllPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const posts = await db.findPostsByUserId(userId);

    // Nach Erstellungsdatum sortieren (neueste zuerst)
    posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({
      success: true,
      data: {
        data: posts,
        pagination: {
          page: 1,
          limit: posts.length,
          total: posts.length,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    console.error('GetAllPosts Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der Posts.',
      statusCode: 500,
    });
  }
};

// ============================================
// GET POST BY ID - Einzelnen Post abrufen
// ============================================
export const getPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const post = await db.findPostById(id);

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Post nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    // Prüfen ob Post dem Benutzer gehört
    if (post.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diesen Post.',
        statusCode: 403,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('GetPostById Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden des Posts.',
      statusCode: 500,
    });
  }
};

// ============================================
// CREATE POST - Neuen Post erstellen
// ============================================
export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const input = req.body as CreatePostInput;

    // Validierung
    if (!input.platforms || input.platforms.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Mindestens eine Plattform muss ausgewählt sein.',
        statusCode: 400,
      });
      return;
    }

    const now = new Date().toISOString();
    const content = input.content || `Post über: ${input.topic}`;

    const newPost: Post = {
      id: uuidv4(),
      userId,
      title: input.title || input.topic,
      content,
      platforms: input.platforms,
      status: input.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: input.scheduledAt,
      contentType: input.contentType || 'text',
      tone: input.tone,
      topic: input.topic,
      imagePrompt: input.imagePrompt,
      metadata: calculateMetadata(content),
      createdAt: now,
      updatedAt: now,
    };

    await db.createPost(newPost);

    console.log(`✅ Neuer Post erstellt: ${newPost.id}`);

    res.status(201).json({
      success: true,
      data: newPost,
      message: 'Post erfolgreich erstellt!',
    });
  } catch (error) {
    console.error('CreatePost Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Erstellen des Posts.',
      statusCode: 500,
    });
  }
};

// ============================================
// UPDATE POST - Post aktualisieren
// ============================================
export const updatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const updates = req.body as Partial<Post>;

    const post = await db.findPostById(id);

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Post nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diesen Post.',
        statusCode: 403,
      });
      return;
    }

    // Metadata neu berechnen wenn Content geändert wurde
    if (updates.content) {
      updates.metadata = calculateMetadata(updates.content);
    }

    const updatedPost = await db.updatePost(id, updates);

    console.log(`✅ Post aktualisiert: ${id}`);

    res.status(200).json({
      success: true,
      data: updatedPost,
      message: 'Post erfolgreich aktualisiert!',
    });
  } catch (error) {
    console.error('UpdatePost Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Aktualisieren des Posts.',
      statusCode: 500,
    });
  }
};

// ============================================
// DELETE POST - Post löschen
// ============================================
export const deletePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const post = await db.findPostById(id);

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Post nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diesen Post.',
        statusCode: 403,
      });
      return;
    }

    await db.deletePost(id);

    console.log(`✅ Post gelöscht: ${id}`);

    res.status(200).json({
      success: true,
      data: null,
      message: 'Post erfolgreich gelöscht!',
    });
  } catch (error) {
    console.error('DeletePost Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Löschen des Posts.',
      statusCode: 500,
    });
  }
};

// ============================================
// PUBLISH POST - Post veröffentlichen (n8n Webhook)
// ============================================
export const publishPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const post = await db.findPostById(id);

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Post nicht gefunden.',
        statusCode: 404,
      });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Keine Berechtigung für diesen Post.',
        statusCode: 403,
      });
      return;
    }

    // Verbundene Accounts für die Plattformen holen
    const connections = await db.findConnectionsByUserId(userId);
    const activeConnections = connections.filter(
      c => post.platforms.includes(c.platform) && c.status === 'connected'
    );

    if (activeConnections.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Keine verbundenen Accounts für die gewählten Plattformen.',
        statusCode: 400,
      });
      return;
    }

    // n8n Webhook aufrufen
    try {
      console.log(`📤 Sende Post an n8n: ${N8N_WEBHOOK_URL}/publish`);

      await axios.post(`${N8N_WEBHOOK_URL}/publish`, {
        post: {
          id: post.id,
          content: post.content,
          platforms: post.platforms,
          imageUrls: post.imageUrls,
          videoUrl: post.videoUrl,
        },
        connections: activeConnections.map(c => ({
          platform: c.platform,
          accountId: c.accountId,
          accessToken: c.accessToken,
        })),
        userId,
      });

      // Status auf "published" setzen
      const updatedPost = await db.updatePost(id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
      });

      console.log(`✅ Post veröffentlicht: ${id}`);

      res.status(200).json({
        success: true,
        data: updatedPost,
        message: 'Post erfolgreich veröffentlicht!',
      });
    } catch (webhookError) {
      console.error('n8n Webhook Fehler:', webhookError);

      // Status auf "failed" setzen
      await db.updatePost(id, { status: 'failed' });

      res.status(500).json({
        success: false,
        error: 'Webhook Error',
        message: 'Fehler beim Senden an n8n. Bitte prüfe ob n8n läuft.',
        statusCode: 500,
      });
    }
  } catch (error) {
    console.error('PublishPost Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Veröffentlichen des Posts.',
      statusCode: 500,
    });
  }
};
