// src/modules/shifts/shifts.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import {
  CreateShiftDto,
  UpdateShiftDto,
  AssignStaffDto,
  CheckInDto,
  ShiftQueryDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  // ── GET /shifts ─────────────────────────────────────────
  @Get()
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'List shifts (admin: all, staff: assigned only)' })
  @ApiOkResponse({ description: 'Paginated list of shifts' })
  findAll(
    @Query() query: ShiftQueryDto,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.shiftsService.findAll(query, user);
  }

  // ── GET /shifts/calendar ────────────────────────────────
  @Get('calendar')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Monthly calendar view (grouped by date)' })
  @ApiOkResponse({ description: 'Shifts grouped by date' })
  getMonthlyCalendar(
    @Query('month') month: string,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.shiftsService.getMonthlyCalendar(month, user);
  }

  // ── GET /shifts/:id ─────────────────────────────────────
  @Get(':id')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Get shift by ID (staff: only if assigned)' })
  @ApiOkResponse({ description: 'Shift details with assignments' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  @ApiForbiddenResponse({ description: 'Staff not assigned to this shift' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.shiftsService.findOne(id, user);
  }

  // ── POST /shifts ────────────────────────────────────────
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a shift (admin only)' })
  @ApiCreatedResponse({ description: 'Shift created' })
  @ApiBadRequestResponse({ description: 'Invalid time range' })
  @ApiConflictResponse({ description: 'Staff scheduling conflict' })
  create(
    @Body() dto: CreateShiftDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.shiftsService.create(dto, adminId);
  }

  // ── PATCH /shifts/:id ───────────────────────────────────
  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a shift (admin only)' })
  @ApiOkResponse({ description: 'Shift updated' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftsService.update(id, dto);
  }

  // ── DELETE /shifts/:id ──────────────────────────────────
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a shift (admin only, upcoming only)' })
  @ApiOkResponse({ description: 'Shift deleted' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete non-upcoming shift' })
  remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }

  // ── POST /shifts/:id/assign ─────────────────────────────
  @Post(':id/assign')
  @Roles('admin')
  @ApiOperation({ summary: 'Assign staff to a shift (admin only)' })
  @ApiOkResponse({ description: 'Updated assignment list' })
  @ApiConflictResponse({ description: 'Staff scheduling conflict' })
  @ApiNotFoundResponse({ description: 'Shift not found' })
  assignStaff(
    @Param('id') shiftId: string,
    @Body() dto: AssignStaffDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.shiftsService.assignStaff(shiftId, dto, adminId);
  }

  // ── DELETE /shifts/:id/staff/:staffId ───────────────────
  @Delete(':id/staff/:staffId')
  @Roles('admin')
  @ApiOperation({ summary: 'Unassign staff from a shift (admin only)' })
  @ApiOkResponse({ description: 'Staff unassigned' })
  unassignStaff(
    @Param('id') shiftId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.shiftsService.unassignStaff(shiftId, staffId);
  }

  // ── POST /shifts/:id/check-in ───────────────────────────
  @Post(':id/check-in')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Check in to a shift' })
  @ApiOkResponse({ description: 'Checked in' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiBadRequestResponse({ description: 'Already checked in' })
  checkIn(
    @Param('id') shiftId: string,
    @CurrentUser('sub') staffId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.shiftsService.checkIn(shiftId, staffId, dto.notes);
  }

  // ── POST /shifts/:id/check-out ──────────────────────────
  @Post(':id/check-out')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Check out from a shift' })
  @ApiOkResponse({ description: 'Checked out' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiBadRequestResponse({ description: 'Not checked in or already checked out' })
  checkOut(
    @Param('id') shiftId: string,
    @CurrentUser('sub') staffId: string,
  ) {
    return this.shiftsService.checkOut(shiftId, staffId);
  }
}
