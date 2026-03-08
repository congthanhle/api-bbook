// src/modules/staff/staff.module.ts

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../database/supabase.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [SupabaseModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
