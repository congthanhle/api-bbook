// src/modules/products/products.controller.ts

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, UpdateStockDto } from './dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products' })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('page') page?: number, 
    @Query('limit') limit?: number, 
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive === undefined ? undefined : isActive === 'true';
    return this.productsService.findAll({ page, limit, category, isActive: isActiveBool });
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'List low stock products' })
  findLowStock() {
    return this.productsService.findLowStock();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string) { return this.productsService.findOne(id); }

  @Post()
  @UseGuards(RolesGuard) @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto) { return this.productsService.create(dto); }

  @Patch(':id')
  @UseGuards(RolesGuard) @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.productsService.update(id, dto); }

  @Patch(':id/stock')
  @UseGuards(RolesGuard) @Roles('admin', 'manager', 'staff')
  @ApiOperation({ summary: 'Update product stock' })
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) { return this.productsService.updateStock(id, dto); }

  @Delete(':id')
  @UseGuards(RolesGuard) @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Delete a product (soft delete)' })
  remove(@Param('id') id: string) { return this.productsService.remove(id); }
}
