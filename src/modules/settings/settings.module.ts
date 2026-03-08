// src/modules/settings/settings.module.ts

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../database/supabase.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
