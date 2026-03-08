// src/modules/upload/upload.service.ts

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Uploads a file to a specific Supabase storage bucket.
   * @param file The Multer file object
   * @param bucket The Supabase bucket name ('avatars', 'courts', 'products')
   * @param path The destination path inside the bucket
   * @returns The public URL of the uploaded file
   */
  async uploadFile(file: Express.Multer.File, bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase
      .getClient(true)
      .storage.from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Failed to upload file to ${bucket}/${path}: ${error.message}`);
      throw new InternalServerErrorException('File upload failed');
    }

    // Get public URL
    const { data: publicUrlData } = this.supabase
      .getClient(true)
      .storage.from(bucket)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /**
   * Deletes a file from a specified bucket.
   * @param bucket The Supabase bucket name
   * @param path The filepath to delete
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase
      .getClient(true)
      .storage.from(bucket)
      .remove([path]);

    if (error) {
      this.logger.error(`Failed to delete file from ${bucket}/${path}: ${error.message}`);
      throw new InternalServerErrorException('File deletion failed');
    }
  }

  /**
   * Generates a unique path based on user ID and timestamp.
   * Example: `user-123/1678901234_profile.jpg`
   */
  generatePath(userId: string, originalName: string): string {
    const timestamp = Date.now();
    // Sanitize filename: replace non-alphanumeric chars with underscore, keep extension
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${userId}/${timestamp}_${sanitizedName}`;
  }
}
