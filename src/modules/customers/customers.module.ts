// src/modules/customers/customers.module.ts

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../database/supabase.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService], // Exported for BookingsModule to update stats
})
export class CustomersModule {}
