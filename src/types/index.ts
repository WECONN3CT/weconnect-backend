// ============================================
// TYPEN - Definiert die Struktur unserer Daten
// ============================================

// Benutzer
export interface User {
  id: string;
  email: string;
  password: string; // Verschlüsselt gespeichert
  name: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  role?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// Benutzer ohne Passwort (für API-Antworten)
export type SafeUser = Omit<User, 'password'>;

// Login-Daten
export interface LoginCredentials {
  email: string;
  password: string;
}

// Registrierungs-Daten
export interface SignupCredentials extends LoginCredentials {
  firstName: string;
  lastName: string;
}

// Auth-Antwort (nach Login/Signup)
export interface AuthResponse {
  user: SafeUser;
  token: string;
}

// ============================================
// POSTS
// ============================================

export type Platform = 'instagram' | 'linkedin' | 'facebook' | 'instagram-feed' | 'instagram-reels';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'review';
export type ContentType = 'text' | 'article' | 'carousel' | 'video' | 'image';
export type ToneStyle = 'professional' | 'casual' | 'friendly' | 'formal' | 'creative' | 'humorous';

export interface PostMetadata {
  characterCount: number;
  wordCount: number;
  estimatedReach?: string;
  hashtags?: string[];
  mentions?: string[];
}

export interface Post {
  id: string;
  userId: string;
  title?: string;
  content: string;
  platforms: string[];
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  imageUrls?: string[];
  videoUrl?: string;
  contentType?: ContentType;
  tone?: ToneStyle;
  topic?: string;
  imagePrompt?: string;
  metadata?: PostMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  topic: string;
  title?: string;
  content?: string;
  platforms: Platform[];
  contentType: ContentType;
  tone: ToneStyle;
  imagePrompt?: string;
  scheduledAt?: string;
}

// ============================================
// CONNECTIONS (Social Media Konten)
// ============================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface Connection {
  id: string;
  userId: string;
  platform: string;
  platformUserId?: string;
  platformUsername?: string;
  status: string;
  accountName?: string;
  accountId?: string;
  connectedAt?: string;
  lastSync?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  expiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ANALYTICS
// ============================================

export interface DashboardMetrics {
  scheduledPosts: number;
  pendingApprovals: number;
  totalReach: string;
  engagementRate?: string;
}

export interface AnalyticsData {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clickThroughRate?: number;
  impressions?: number;
}

// ============================================
// API ANTWORTEN
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// EXPRESS ERWEITERUNG
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}
