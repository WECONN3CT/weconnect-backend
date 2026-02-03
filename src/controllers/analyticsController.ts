// ============================================
// ANALYTICS CONTROLLER
// ============================================
// Liefert Statistiken und Dashboard-Daten

import { Request, Response } from 'express';
import { db } from '../config/database';
import { DashboardMetrics, AnalyticsData } from '../types';

// ============================================
// GET DASHBOARD - Dashboard Metriken
// ============================================
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const posts = await db.findPostsByUserId(userId);
    const connections = await db.findConnectionsByUserId(userId);

    // Metriken berechnen
    const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;
    const pendingApprovals = posts.filter(p => p.status === 'review').length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const connectedAccounts = connections.filter(c => c.status === 'connected').length;

    // Geschätzte Reichweite (Beispiel-Berechnung)
    const estimatedReach = publishedPosts * 150 + connectedAccounts * 500;

    const metrics: DashboardMetrics = {
      scheduledPosts,
      pendingApprovals,
      totalReach: estimatedReach > 1000
        ? `${(estimatedReach / 1000).toFixed(1)}k`
        : estimatedReach.toString(),
      engagementRate: publishedPosts > 0 ? '3.2%' : '0%',
    };

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('GetDashboard Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der Dashboard-Daten.',
      statusCode: 500,
    });
  }
};

// ============================================
// GET POST ANALYTICS - Statistiken für einen Post
// ============================================
export const getPostAnalytics = async (req: Request, res: Response): Promise<void> => {
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

    // Beispiel-Analytics (in Produktion würden diese von den Social Media APIs kommen)
    const analytics: AnalyticsData = {
      views: post.status === 'published' ? Math.floor(Math.random() * 1000) + 100 : 0,
      likes: post.status === 'published' ? Math.floor(Math.random() * 100) + 10 : 0,
      shares: post.status === 'published' ? Math.floor(Math.random() * 20) + 1 : 0,
      comments: post.status === 'published' ? Math.floor(Math.random() * 15) : 0,
      clickThroughRate: post.status === 'published' ? Math.random() * 5 : 0,
      impressions: post.status === 'published' ? Math.floor(Math.random() * 2000) + 200 : 0,
    };

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('GetPostAnalytics Fehler:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Fehler beim Laden der Analytics.',
      statusCode: 500,
    });
  }
};
