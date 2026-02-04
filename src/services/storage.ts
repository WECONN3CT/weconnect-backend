// ============================================
// SUPABASE STORAGE SERVICE
// ============================================
// Handles file uploads to Supabase Storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BUCKET_NAME = 'post-images';

let supabase: SupabaseClient | null = null;

// Initialize Supabase client
const getSupabaseClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Storage] Supabase nicht konfiguriert - SUPABASE_URL und SUPABASE_ANON_KEY fehlen');
    return null;
  }

  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Storage] Supabase Storage initialisiert');
  }

  return supabase;
};

/**
 * Upload a file to Supabase Storage
 * @param file - The file buffer
 * @param fileName - Original filename
 * @param userId - User ID for organizing files
 * @param mimeType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export const uploadFile = async (
  file: Buffer,
  fileName: string,
  userId: string,
  mimeType: string
): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error('[Storage] Supabase nicht verfügbar');
    return null;
  }

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}-${sanitizedName}`;

    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[Storage] Upload Fehler:', error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log(`[Storage] Datei hochgeladen: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[Storage] Unerwarteter Fehler:', error);
    return null;
  }
};

/**
 * Upload multiple files
 * @param files - Array of file objects
 * @param userId - User ID
 * @returns Array of public URLs
 */
export const uploadMultipleFiles = async (
  files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  userId: string
): Promise<string[]> => {
  const urls: string[] = [];

  for (const file of files) {
    const url = await uploadFile(file.buffer, file.originalname, userId, file.mimetype);
    if (url) {
      urls.push(url);
    }
  }

  return urls;
};

/**
 * Delete a file from Supabase Storage
 * @param fileUrl - The public URL of the file
 * @returns true if successful
 */
export const deleteFile = async (fileUrl: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (pathParts.length < 2) return false;

    const filePath = decodeURIComponent(pathParts[1]);

    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[Storage] Delete Fehler:', error.message);
      return false;
    }

    console.log(`[Storage] Datei gelöscht: ${filePath}`);
    return true;
  } catch (error) {
    console.error('[Storage] Delete Fehler:', error);
    return false;
  }
};

/**
 * Check if storage is configured
 */
export const isStorageConfigured = (): boolean => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
};
