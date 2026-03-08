// src/modules/courts/courts.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CourtsService } from './courts.service';
import {
  CreateCourtDto,
  UpdateCourtDto,
  CreatePriceRuleDto,
  UpdatePriceRuleDto,
  BulkUpdatePricesDto,
  LockCourtDto,
  CourtQueryDto,
} from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

/**
 * Controller for court management, price rules, and slot locking.
 *
 * Endpoints fall into four categories:
 * 1. Court CRUD        — /courts
 * 2. Price rules       — /courts/:id/price-rules
 * 3. Slot locking      — /courts/:id/lock, /courts/:id/unlock
 * 4. Price calculation  — /courts/:id/calculate-price
 */
@ApiTags('Courts')
@ApiBearerAuth()
@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  // ═══════════════════════════════════════════════════════════
  // COURT CRUD
  // ═══════════════════════════════════════════════════════════

  @Get()
  @ApiOperation({ summary: 'List courts with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of courts' })
  findAll(@Query() query: CourtQueryDto) {
    return this.courtsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a court by ID (includes price rules)' })
  @ApiParam({ name: 'id', type: String, description: 'Court UUID' })
  @ApiResponse({ status: 200, description: 'Court with price rules' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.courtsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new court (admin)' })
  @ApiResponse({ status: 201, description: 'Court created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a court (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Court updated' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourtDto,
  ) {
    return this.courtsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate a court (admin, soft-delete)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Court deactivated' })
  @ApiResponse({ status: 404, description: 'Court not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.courtsService.remove(id);
  }

  // ═══════════════════════════════════════════════════════════
  // PRICE RULES
  // ═══════════════════════════════════════════════════════════

  @Get(':id/price-rules')
  @ApiOperation({ summary: 'Get all price rules for a court' })
  @ApiParam({ name: 'id', type: String, description: 'Court UUID' })
  @ApiResponse({ status: 200, description: 'List of price rules' })
  getPriceRules(@Param('id', ParseUUIDPipe) id: string) {
    return this.courtsService.getPriceRules(id);
  }

  @Post(':id/price-rules')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Add a price rule to a court (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Price rule created' })
  @ApiResponse({ status: 409, description: 'Overlapping time range' })
  addPriceRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePriceRuleDto,
  ) {
    return this.courtsService.addPriceRule(id, dto);
  }

  @Patch('price-rules/:ruleId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a price rule (admin)' })
  @ApiParam({ name: 'ruleId', type: String, description: 'Price rule UUID' })
  @ApiResponse({ status: 200, description: 'Price rule updated' })
  @ApiResponse({ status: 409, description: 'Overlapping time range' })
  updatePriceRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdatePriceRuleDto,
  ) {
    return this.courtsService.updatePriceRule(ruleId, dto);
  }

  @Delete('price-rules/:ruleId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a price rule (admin)' })
  @ApiParam({ name: 'ruleId', type: String })
  @ApiResponse({ status: 200, description: 'Price rule deleted' })
  deletePriceRule(@Param('ruleId', ParseUUIDPipe) ruleId: string) {
    return this.courtsService.deletePriceRule(ruleId);
  }

  @Post(':id/price-rules/bulk')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk replace price rules for a court (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Price rules replaced' })
  @ApiResponse({ status: 409, description: 'Overlapping rules in the batch' })
  bulkUpdatePrices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdatePricesDto,
  ) {
    return this.courtsService.bulkUpdatePrices(id, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // SLOT LOCKING
  // ═══════════════════════════════════════════════════════════

  @Post(':id/lock')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Lock court time slots (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Slots locked' })
  lockCourt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockCourtDto,
    @CurrentUser('id') userId: string,
  ) {
    dto.action = 'lock';
    return this.courtsService.lockOrUnlockCourt(id, dto, userId);
  }

  @Post(':id/unlock')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Unlock court time slots (admin)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Slots unlocked' })
  unlockCourt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockCourtDto,
    @CurrentUser('id') userId: string,
  ) {
    dto.action = 'unlock';
    return this.courtsService.lockOrUnlockCourt(id, dto, userId);
  }

  // ═══════════════════════════════════════════════════════════
  // PRICE CALCULATION
  // ═══════════════════════════════════════════════════════════

  @Get(':id/calculate-price')
  @ApiOperation({ summary: 'Calculate booking price for a court + time range' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2026-03-15' })
  @ApiQuery({ name: 'startTime', required: true, type: String, example: '08:00' })
  @ApiQuery({ name: 'endTime', required: true, type: String, example: '10:00' })
  @ApiResponse({ status: 200, description: 'Calculated price' })
  calculatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.courtsService.calculatePrice(id, date, startTime, endTime);
  }
}
