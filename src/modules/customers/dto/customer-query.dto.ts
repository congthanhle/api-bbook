// src/modules/customers/dto/customer-query.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsIn } from 'class-validator';

export enum MembershipTier {
  REGULAR = 'regular',
  SILVER = 'silver',
  GOLD = 'gold',
  VIP = 'vip',
}

export class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: MembershipTier })
  @IsEnum(MembershipTier)
  @IsOptional()
  tier?: MembershipTier;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['totalSpend', 'totalVisits', 'createdAt', 'lastVisitAt', 'name'], default: 'createdAt' })
  @IsIn(['totalSpend', 'totalVisits', 'createdAt', 'lastVisitAt', 'name'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: string = 'desc';
}
