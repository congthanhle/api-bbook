// src/modules/overview/overview.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OverviewService } from './overview.service';
import {
  GetOverviewDto,
  UpdateSlotStatusDto,
  BulkUpdateSlotsDto,
  MonthLockDto,
} from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

/**
 * Overview controller — the primary booking grid surface.
 *
 * Provides grid data, slot state management, and month-level access control.
 */
@ApiTags('Overview')
@ApiBearerAuth()
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  // ── Grid Data ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get court overview grid for a date' })
  @ApiResponse({ status: 200, description: 'Overview grid with all courts and slots' })
  getOverview(@Query() dto: GetOverviewDto) {
    return this.overviewService.getOverview(dto);
  }

  @Get('time-slots')
  @ApiOperation({ summary: 'Get all time slot definitions (reference data)' })
  @ApiResponse({ status: 200, description: 'List of 32 time slots' })
  getTimeSlots() {
    return this.overviewService.getTimeSlots();
  }

  // ── Slot Management ───────────────────────────────────────

  @Patch('slot')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a single slot status (admin)' })
  @ApiResponse({ status: 200, description: 'Slot updated' })
  @ApiResponse({ status: 400, description: 'Cannot change a booked slot' })
  updateSlotStatus(
    @Body() dto: UpdateSlotStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.overviewService.updateSlotStatus(dto, userId);
  }

  @Patch('slots/bulk')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk update slot statuses (admin)' })
  @ApiResponse({ status: 200, description: 'Slots updated with skip report' })
  bulkUpdateSlots(
    @Body() dto: BulkUpdateSlotsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.overviewService.bulkUpdateSlots(dto, userId);
  }

  // ── Month Locks ───────────────────────────────────────────

  @Get('month-locks')
  @ApiOperation({ summary: 'Get all month lock statuses' })
  @ApiResponse({ status: 200, description: 'List of month locks' })
  getMonthLocks() {
    return this.overviewService.getMonthLocks();
  }

  @Post('month-locks/lock')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Lock a month (admin)' })
  @ApiResponse({ status: 200, description: 'Month locked' })
  lockMonth(@Body() dto: MonthLockDto) {
    return this.overviewService.lockMonth(dto);
  }

  @Post('month-locks/unlock')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Unlock a month (admin)' })
  @ApiResponse({ status: 200, description: 'Month unlocked' })
  unlockMonth(
    @Body() dto: MonthLockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.overviewService.unlockMonth(dto, userId);
  }
}
