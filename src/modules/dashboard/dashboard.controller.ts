// src/modules/dashboard/dashboard.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue stats for a date range' })
  @ApiQuery({ name: 'startDate', required: true, type: String, example: '2026-03-01' })
  @ApiQuery({ name: 'endDate', required: true, type: String, example: '2026-03-31' })
  getRevenue(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.dashboardService.getRevenue(startDate, endDate);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Get court occupancy for a date range' })
  @ApiQuery({ name: 'startDate', required: true, type: String, example: '2026-03-01' })
  @ApiQuery({ name: 'endDate', required: true, type: String, example: '2026-03-31' })
  getOccupancy(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.dashboardService.getOccupancy(startDate, endDate);
  }
}
