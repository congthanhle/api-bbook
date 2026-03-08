// src/modules/overview/overview.module.ts

import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { SlotStateService } from './slot-state.service';

@Module({
  controllers: [OverviewController],
  providers: [OverviewService, SlotStateService],
  exports: [SlotStateService],
})
export class OverviewModule {}
