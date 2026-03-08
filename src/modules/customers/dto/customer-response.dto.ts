// src/modules/customers/dto/customer-response.dto.ts

import { MembershipTier } from './customer-query.dto';

export class CustomerResponseDto {
  id!: string;
  name!: string;
  phone!: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  membershipTier!: MembershipTier;
  totalVisits!: number;
  totalSpend?: number; // Omitted for staff role
  lastVisitAt?: string;
  notes?: string;
  createdAt!: string;
}

export class CustomerStatsDto {
  totalCustomers!: number;
  newThisMonth!: number;
  byTier!: Record<string, number>;
  avgSpendPerCustomer!: number; // Admin only
}

export class CustomerLookupDto {
  found!: boolean;
  customer?: CustomerResponseDto;
}
