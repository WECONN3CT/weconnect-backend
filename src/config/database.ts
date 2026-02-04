// ============================================
// DATENBANK KONFIGURATION - PostgreSQL (Supabase)
// ============================================

import { Pool } from 'pg';
import { User, Post, Connection } from '../types';

// PostgreSQL Connection Pool mit SSL-Konfiguration für Supabase
// Supabase verwendet Pooler-Zertifikate die nicht streng validiert werden können
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Supabase Pooler benötigt dies
  },
  max: 20, // Max Pool-Größe
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Datenbank initialisieren (Tabellen erstellen)
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Users Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        company VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        avatar VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Spalten hinzufügen falls Tabelle schon existiert (Migration)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)
    `);

    // Posts Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500),
        content TEXT NOT NULL,
        platforms TEXT[] DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        published_at TIMESTAMP,
        media_urls TEXT[] DEFAULT '{}',
        hashtags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Connections Tabelle
    await client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(100) NOT NULL,
        platform_user_id VARCHAR(255),
        platform_username VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform)
      )
    `);

    console.log('PostgreSQL Datenbank initialisiert');
  } catch (error) {
    console.error('Fehler beim Initialisieren der Datenbank:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Hilfsfunktionen für Datenbank-Operationen
export const db = {
  // === USERS ===
  findUserByEmail: async (email: string): Promise<User | undefined> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (result.rows.length === 0) return undefined;
    return mapRowToUser(result.rows[0]);
  },

  findUserById: async (id: string): Promise<User | undefined> => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return mapRowToUser(result.rows[0]);
  },

  createUser: async (user: User): Promise<User> => {
    // Keine sensiblen Daten loggen!
    console.log('Creating new user...');
    try {
      await pool.query(
        `INSERT INTO users (id, email, password, name, first_name, last_name, company, role, avatar, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [user.id, user.email, user.password, user.name, user.firstName || null, user.lastName || null, user.company || null, user.role || 'user', user.avatar || null, user.createdAt, user.updatedAt]
      );
      console.log('User created successfully');
      return user;
    } catch (error) {
      console.error('Database createUser error:', error);
      throw error;
    }
  },

  // === POSTS ===
  findPostsByUserId: async (userId: string): Promise<Post[]> => {
    const result = await pool.query(
      'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(mapRowToPost);
  },

  findPostById: async (id: string): Promise<Post | undefined> => {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return mapRowToPost(result.rows[0]);
  },

  createPost: async (post: Post): Promise<Post> => {
    await pool.query(
      `INSERT INTO posts (id, user_id, title, content, platforms, status, scheduled_at, published_at, media_urls, hashtags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [post.id, post.userId, post.title, post.content, post.platforms, post.status, post.scheduledAt, post.publishedAt, post.mediaUrls, post.hashtags, post.createdAt, post.updatedAt]
    );
    return post;
  },

  updatePost: async (id: string, updates: Partial<Post>): Promise<Post | undefined> => {
    const existing = await db.findPostById(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE posts SET title = $1, content = $2, platforms = $3, status = $4, scheduled_at = $5, published_at = $6, media_urls = $7, hashtags = $8, updated_at = $9 WHERE id = $10`,
      [updated.title, updated.content, updated.platforms, updated.status, updated.scheduledAt, updated.publishedAt, updated.mediaUrls, updated.hashtags, updated.updatedAt, id]
    );
    return updated;
  },

  deletePost: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  // === CONNECTIONS ===
  findConnectionsByUserId: async (userId: string): Promise<Connection[]> => {
    const result = await pool.query(
      'SELECT * FROM connections WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(mapRowToConnection);
  },

  findConnectionById: async (id: string): Promise<Connection | undefined> => {
    const result = await pool.query('SELECT * FROM connections WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return mapRowToConnection(result.rows[0]);
  },

  findConnectionByPlatform: async (userId: string, platform: string): Promise<Connection | undefined> => {
    const result = await pool.query(
      'SELECT * FROM connections WHERE user_id = $1 AND platform = $2',
      [userId, platform]
    );
    if (result.rows.length === 0) return undefined;
    return mapRowToConnection(result.rows[0]);
  },

  createConnection: async (connection: Connection): Promise<Connection> => {
    // Upsert - aktualisiere oder erstelle
    await pool.query(
      `INSERT INTO connections (id, user_id, platform, platform_user_id, platform_username, access_token, refresh_token, token_expires_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, platform) DO UPDATE SET
         platform_user_id = $4, platform_username = $5, access_token = $6, refresh_token = $7, token_expires_at = $8, status = $9, updated_at = $11`,
      [connection.id, connection.userId, connection.platform, connection.platformUserId, connection.platformUsername, connection.accessToken, connection.refreshToken, connection.tokenExpiresAt, connection.status, connection.createdAt, connection.updatedAt]
    );
    return connection;
  },

  updateConnection: async (id: string, updates: Partial<Connection>): Promise<Connection | undefined> => {
    const existing = await db.findConnectionById(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE connections SET platform_user_id = $1, platform_username = $2, access_token = $3, refresh_token = $4, token_expires_at = $5, status = $6, updated_at = $7 WHERE id = $8`,
      [updated.platformUserId, updated.platformUsername, updated.accessToken, updated.refreshToken, updated.tokenExpiresAt, updated.status, updated.updatedAt, id]
    );
    return updated;
  },

  deleteConnection: async (id: string): Promise<boolean> => {
    const result = await pool.query('DELETE FROM connections WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  // === ANALYTICS ===
  countPostsByStatus: async (userId: string, status: string): Promise<number> => {
    const result = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND status = $2',
      [userId, status]
    );
    return parseInt(result.rows[0].count, 10);
  },

  countConnectionsByUserId: async (userId: string): Promise<number> => {
    const result = await pool.query(
      'SELECT COUNT(*) FROM connections WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    return parseInt(result.rows[0].count, 10);
  },
};

// Mapping Funktionen (Datenbank Zeilen -> TypeScript Objekte)
function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    role: row.role,
    avatar: row.avatar,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

function mapRowToPost(row: any): Post {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    platforms: row.platforms || [],
    status: row.status,
    scheduledAt: row.scheduled_at?.toISOString(),
    publishedAt: row.published_at?.toISOString(),
    mediaUrls: row.media_urls || [],
    hashtags: row.hashtags || [],
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

function mapRowToConnection(row: any): Connection {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    platformUserId: row.platform_user_id,
    platformUsername: row.platform_username,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at?.toISOString(),
    status: row.status,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
}

export default pool;
