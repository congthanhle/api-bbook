// src/modules/bookings/bookings.module.ts

import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { OverviewModule } from '../overview/overview.module';

@Module({
  imports: [OverviewModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
