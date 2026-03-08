// src/modules/customers/customers.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  Header,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'List all customers with search, filter, pagination' })
  findAll(
    @Query() query: CustomerQueryDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.findAll(query, user);
  }

  @Get('stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Get customer stats summary (admin only)' })
  getStats() {
    return this.service.getStats();
  }

  @Get('export')
  @Roles('admin')
  @ApiOperation({ summary: 'Export all customers as CSV (admin only)' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="customers.csv"')
  async exportCsv(@Res() res: Response) {
    const buffer = await this.service.exportCsv();
    res.end(buffer); // We use end instead of send for buffer streaming across express versions
  }

  @Get('by-phone/:phone')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Lookup customer by phone — used during booking creation' })
  findByPhone(@Param('phone') phone: string) {
    return this.service.findByPhone(phone);
  }

  @Get(':id')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Get single customer profile (NO booking history)' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Create new customer' })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'staff')
  @ApiOperation({ summary: 'Update customer profile' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete customer (admin only)' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
