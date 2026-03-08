// src/health/health.controller.ts

import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupabaseService } from '../database/supabase.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private supabase: SupabaseService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Run system health checks' })
  check() {
    this.logger.log('Executing health check ping');
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB limit
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9, // Warn if disk is >90% full
        }),
      async () => {
        // Ping supabase admin client
        try {
          const client = this.supabase.getClient(true);
          const { error } = await client.from('app_settings').select('key').limit(1);
          if (error) throw error;
          return { supabase: { status: 'up' } };
        } catch (e: any) {
          return { supabase: { status: 'down', message: e.message } };
        }
      },
    ]);
  }
}
