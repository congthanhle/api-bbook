// src/modules/staff/staff.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
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
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  StaffQueryDto,
  AdminStaffResponseDto,
  StaffOwnResponseDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ── GET /staff ──────────────────────────────────────────
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all staff (admin only)' })
  @ApiOkResponse({ type: [AdminStaffResponseDto] })
  @ApiForbiddenResponse({ description: 'Staff role not allowed' })
  findAll(
    @Query() query: StaffQueryDto,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.staffService.findAll(query, user);
  }

  // ── GET /staff/me ───────────────────────────────────────
  @Get('me')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Get own staff profile' })
  @ApiOkResponse({ type: StaffOwnResponseDto })
  findMe(@CurrentUser('sub') userId: string) {
    return this.staffService.findMe(userId);
  }

  // ── GET /staff/:id ──────────────────────────────────────
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a staff member by ID (admin only)' })
  @ApiOkResponse({ type: AdminStaffResponseDto })
  @ApiNotFoundResponse({ description: 'Staff not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.staffService.findOne(id, user);
  }

  // ── POST /staff ─────────────────────────────────────────
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new staff member (admin only)' })
  @ApiCreatedResponse({ type: AdminStaffResponseDto })
  @ApiConflictResponse({ description: 'Email already exists' })
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser('sub') adminUserId: string,
  ) {
    return this.staffService.create(dto, adminUserId);
  }

  // ── PATCH /staff/:id ────────────────────────────────────
  @Patch(':id')
  @Roles('admin', 'staff')
  @ApiOperation({
    summary: 'Update a staff member (admin: all fields, staff: own profile only)',
  })
  @ApiOkResponse({ type: AdminStaffResponseDto, description: 'Admin response' })
  @ApiForbiddenResponse({ description: 'Staff cannot update other staff' })
  @ApiNotFoundResponse({ description: 'Staff not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.staffService.update(id, dto, user);
  }

  // ── PATCH /staff/:id/deactivate ─────────────────────────
  @Patch(':id/deactivate')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate a staff member (admin only)' })
  @ApiOkResponse({ description: 'Staff deactivated' })
  @ApiNotFoundResponse({ description: 'Staff not found' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id);
  }

  // ── PATCH /staff/:id/activate ───────────────────────────
  @Patch(':id/activate')
  @Roles('admin')
  @ApiOperation({ summary: 'Activate a staff member (admin only)' })
  @ApiOkResponse({ description: 'Staff activated' })
  @ApiNotFoundResponse({ description: 'Staff not found' })
  activate(@Param('id') id: string) {
    return this.staffService.activate(id);
  }

  // ── GET /staff/:id/shifts ───────────────────────────────
  @Get(':id/shifts')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Get shifts for a staff member' })
  @ApiOkResponse({ description: 'Array of shifts' })
  @ApiForbiddenResponse({ description: 'Staff can only view own shifts' })
  getStaffShifts(
    @Param('id') staffId: string,
    @Query('month') month: string | undefined,
    @CurrentUser() user: { sub: string; email: string; role: string },
  ) {
    return this.staffService.getStaffShifts(staffId, { month }, user);
  }
}
