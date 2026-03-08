// src/modules/shifts/shifts.module.ts

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../database/supabase.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
