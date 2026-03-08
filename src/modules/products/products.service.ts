// src/modules/products/products.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateProductDto, UpdateProductDto, UpdateStockDto } from './dto';
import { normalisePagination, buildPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginationQuery } from '../../common/interfaces';

/**
 * Service for managing venue products (equipment, refreshments, etc.)
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Returns a paginated list of products. */
  async findAll(query: PaginationQuery & { category?: string }) {
    const { page, limit, offset } = normalisePagination(query);
    const client = this.supabase.getClient(true);

    let qb = client.from('products').select('*', { count: 'exact' }).eq('is_active', true).order('name', { ascending: true });
    if (query.category) qb = qb.eq('category', query.category);

    const { data, error, count } = await qb.range(offset, offset + limit - 1);
    if (error) { this.logger.error(`Failed to fetch products: ${error.message}`); throw error; }
    return { data: data || [], meta: buildPaginationMeta(count || 0, page, limit) };
  }

  /** Finds a single product by ID. */
  async findOne(id: string) {
    const client = this.supabase.getClient(true);
    const { data, error } = await client.from('products').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundException(`Product "${id}" not found`);
    return data;
  }

  /** Creates a new product. */
  async create(dto: CreateProductDto) {
    const client = this.supabase.getClient(true);
    const { data, error } = await client
      .from('products')
      .insert({
        name: dto.name, description: dto.description || null, category: dto.category || 'other',
        price: dto.price, cost_price: dto.costPrice || 0, stock_qty: dto.stockQty || 0,
        sku: dto.sku || null, image_url: dto.imageUrl || null,
      })
      .select().single();
    if (error) { this.logger.error(`Failed to create product: ${error.message}`); throw error; }
    return data;
  }

  /** Updates a product. */
  async update(id: string, dto: UpdateProductDto) {
    const client = this.supabase.getClient(true);
    const updateData: Record<string, unknown> = {};
    if (dto.name) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.category) updateData['category'] = dto.category;
    if (dto.price !== undefined) updateData['price'] = dto.price;
    if (dto.costPrice !== undefined) updateData['cost_price'] = dto.costPrice;
    if (dto.stockQty !== undefined) updateData['stock_qty'] = dto.stockQty;
    if (dto.sku !== undefined) updateData['sku'] = dto.sku;
    if (dto.imageUrl !== undefined) updateData['image_url'] = dto.imageUrl;

    const { data, error } = await client.from('products').update(updateData).eq('id', id).select().single();
    if (error || !data) throw new NotFoundException(`Product "${id}" not found`);
    return data;
  }

  /** Updates product stock quantity. */
  async updateStock(id: string, dto: UpdateStockDto) {
    const client = this.supabase.getClient(true);
    const { data, error } = await client.from('products').update({ stock_qty: dto.stockQty }).eq('id', id).select().single();
    if (error || !data) throw new NotFoundException(`Product "${id}" not found`);
    return data;
  }

  /** Soft-deletes a product. */
  async remove(id: string) {
    const client = this.supabase.getClient(true);
    const { error } = await client.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw new NotFoundException(`Product "${id}" not found`);
    return { message: 'Product deactivated successfully' };
  }
}
