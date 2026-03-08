// src/modules/users/users.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import {
  normalisePagination,
  buildPaginationMeta,
} from '../../common/utils/pagination.helper';
import { PaginationQuery } from '../../common/interfaces';

/**
 * Service for managing user accounts.
 * All operations use the admin client (bypasses RLS) since this
 * is an admin-only module.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Returns a paginated list of users.
   */
  async findAll(query: PaginationQuery) {
    const { page, limit, offset } = normalisePagination(query);
    const client = this.supabase.getClient(true);

    const { data, error, count } = await client
      .from('users')
      .select('id, email, full_name, phone, role, is_active, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to fetch users: ${error.message}`);
      throw error;
    }

    return {
      data: data || [],
      meta: buildPaginationMeta(count || 0, page, limit),
    };
  }

  /**
   * Finds a single user by ID.
   */
  async findOne(id: string) {
    const client = this.supabase.getClient(true);

    const { data, error } = await client
      .from('users')
      .select('id, email, full_name, phone, role, avatar_url, is_active, last_login_at, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return data;
  }

  /**
   * Creates a new user.
   */
  async create(dto: CreateUserDto) {
    const client = this.supabase.getClient(true);

    const { data, error } = await client
      .from('users')
      .insert({
        email: dto.email,
        password_hash: dto.password, // TODO: bcrypt.hash
        full_name: dto.fullName,
        phone: dto.phone || null,
        role: dto.role || 'customer',
      })
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Updates an existing user.
   */
  async update(id: string, dto: UpdateUserDto) {
    const client = this.supabase.getClient(true);

    const updateData: Record<string, unknown> = {};
    if (dto.email) updateData['email'] = dto.email;
    if (dto.fullName) updateData['full_name'] = dto.fullName;
    if (dto.phone !== undefined) updateData['phone'] = dto.phone;
    if (dto.role) updateData['role'] = dto.role;

    const { data, error } = await client
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, email, full_name, role, updated_at')
      .single();

    if (error || !data) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return data;
  }

  /**
   * Soft-deletes a user by deactivating the account.
   */
  async remove(id: string) {
    const client = this.supabase.getClient(true);

    const { error } = await client
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return { message: 'User deactivated successfully' };
  }
}
