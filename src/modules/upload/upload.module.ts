// src/modules/upload/upload.module.ts

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../database/supabase.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [SupabaseModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
