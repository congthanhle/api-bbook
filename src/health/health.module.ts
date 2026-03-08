// src/health/health.module.ts

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { SupabaseModule } from '../database/supabase.module';

@Module({
  imports: [TerminusModule, SupabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
