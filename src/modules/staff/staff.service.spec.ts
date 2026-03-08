// src/modules/staff/staff.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { SupabaseService } from '../../database/supabase.service';
import { StaffNotFoundException, SelfUpdateForbiddenException, DuplicateEmailException } from '../../common/exceptions';
import { SalaryType } from './dto';

// ──────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────

const mockStaffProfile = {
  id: 'sp-1',
  salary: 8000000,
  salary_type: 'monthly',
  hire_date: '2024-01-15',
  notes: null,
  bank_name: 'Vietcombank',
  bank_account_number: '0123456789',
  bank_account_name: 'NGUYEN VAN A',
  id_card_number: '079123456789',
  address: '123 Nguyen Trai, Q1, TPHCM',
};

const mockUser = {
  id: 'user-1',
  name: 'Nguyen Van A',
  phone: '0901234567',
  avatar_url: null,
  role: 'staff',
  is_active: true,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  staff_profiles: mockStaffProfile,
};

const adminUser = { sub: 'admin-1', email: 'admin@courtos.io', role: 'admin' };
const staffUser = { sub: 'user-1', email: 'staff@courtos.io', role: 'staff' };
const otherStaff = { sub: 'user-2', email: 'other@courtos.io', role: 'staff' };

// ──────────────────────────────────────────────────────────
// Mock SupabaseService
// ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockQueryBuilder(returnData: any, returnError: any = null, count: number | null = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};
  const methods = ['select', 'eq', 'in', 'or', 'gte', 'lte', 'ilike', 'order', 'range', 'single', 'insert', 'update', 'upsert', 'delete'];

  for (const method of methods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  // Terminal methods return the data
  builder['single'] = jest.fn().mockResolvedValue({ data: returnData, error: returnError });
  builder['range'] = jest.fn().mockResolvedValue({ data: returnData, error: returnError, count });

  // For insert/update/upsert that chain .select().single()
  const chainResult = { data: returnData, error: returnError };
  builder['insert'] = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(chainResult),
    }),
  });
  builder['update'] = jest.fn().mockReturnValue(builder);
  builder['upsert'] = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(chainResult),
    }),
  });

  return builder;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockSupabase(overrides: Record<string, any> = {}) {
  const mockClient = {
    from: jest.fn().mockReturnValue(createMockQueryBuilder(mockUser)),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'new-user-1' } },
          error: null,
        }),
        getUserById: jest.fn().mockResolvedValue({
          data: { user: { email: 'staff@courtos.io' } },
        }),
        deleteUser: jest.fn().mockResolvedValue({ error: null }),
      },
    },
    ...overrides,
  };

  return {
    getClient: jest.fn().mockReturnValue(mockClient),
    _mockClient: mockClient,
  };
}

// ──────────────────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────────────────

describe('StaffService', () => {
  let service: StaffService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(async () => {
    mockSupabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: SupabaseService,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────
  // findMe
  // ──────────────────────────────────────────────────────

  describe('findMe', () => {
    it('should return own profile without salary fields', async () => {
      const qb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.findMe('user-1') as any;

      expect(result).toBeDefined();
      expect(result.salary).toBeUndefined();
      expect(result.salary_type).toBeUndefined();
      expect(result.bank_account_number).toBeUndefined();
      expect(result.id_card_number).toBeUndefined();
    });

    it('should throw StaffNotFoundException when user not found', async () => {
      const qb = createMockQueryBuilder(null, { message: 'not found' });
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(service.findMe('nonexistent')).rejects.toThrow(StaffNotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────
  // findAll
  // ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results for admin', async () => {
      const qb = createMockQueryBuilder([mockUser], null, 1);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      const result = await service.findAll({}, adminUser);

      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should throw ForbiddenException for staff role', async () => {
      await expect(
        service.findAll({}, staffUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────
  // findOne
  // ──────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return staff record for admin', async () => {
      const qb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.findOne('user-1', adminUser) as any;
      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
    });

    it('should allow staff to view own profile (delegates to findMe)', async () => {
      const qb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.findOne('user-1', staffUser) as any;
      expect(result).toBeDefined();
      // Salary should be stripped since it goes through findMe → sanitizeForRole
      expect(result.salary).toBeUndefined();
    });

    it('should throw ForbiddenException when staff views another staff', async () => {
      await expect(
        service.findOne('user-1', otherStaff),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should allow admin to update any field', async () => {
      const existsQb = createMockQueryBuilder({ id: 'user-1' });
      const updateQb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn()
        .mockReturnValueOnce(existsQb)   // check exists
        .mockReturnValueOnce(updateQb)   // update users
        .mockReturnValueOnce(updateQb)   // update staff_profiles
        .mockReturnValueOnce(updateQb);  // findOne fetch

      const result = await service.update(
        'user-1',
        { salary: 10000000, name: 'Updated Name' },
        adminUser,
      );

      expect(result).toBeDefined();
    });

    it('should allow staff to update own allowed fields', async () => {
      const existsQb = createMockQueryBuilder({ id: 'user-1' });
      const updateQb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn()
        .mockReturnValueOnce(existsQb)
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(updateQb);

      const result = await service.update(
        'user-1',
        { phone: '0909999888' },
        staffUser,
      );

      expect(result).toBeDefined();
    });

    it('should throw SelfUpdateForbiddenException when staff updates another staff', async () => {
      await expect(
        service.update('user-1', { phone: '0909999888' }, otherStaff),
      ).rejects.toThrow(SelfUpdateForbiddenException);
    });

    it('should throw ForbiddenException when staff tries to update disallowed fields', async () => {
      await expect(
        service.update('user-1', { salary: 999 }, staffUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a staff member via Supabase admin API', async () => {
      // Setup for the final findOne call
      const qb = createMockQueryBuilder(mockUser);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      // Override upsert to succeed
      qb['upsert'] = jest.fn().mockResolvedValue({ error: null });
      qb['insert'] = jest.fn().mockResolvedValue({ error: null });

      const dto = {
        email: 'new@courtos.io',
        password: 'Password@123',
        name: 'New Staff',
        salary: 8000000,
        salaryType: SalaryType.MONTHLY,
        hireDate: '2024-01-15',
      };

      const result = await service.create(dto, 'admin-1');
      expect(result).toBeDefined();
      expect(mockSupabase._mockClient.auth.admin.createUser).toHaveBeenCalled();
    });

    it('should throw DuplicateEmailException when email exists', async () => {
      mockSupabase._mockClient.auth.admin.createUser = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'User already been registered' },
      });

      const dto = {
        email: 'existing@courtos.io',
        password: 'Password@123',
        name: 'Existing',
        salary: 8000000,
        salaryType: SalaryType.MONTHLY,
        hireDate: '2024-01-15',
      };

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(DuplicateEmailException);
    });
  });

  // ──────────────────────────────────────────────────────
  // getStaffShifts
  // ──────────────────────────────────────────────────────

  describe('getStaffShifts', () => {
    it('should allow staff to view own shifts', async () => {
      mockSupabase._mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await service.getStaffShifts('user-1', {}, staffUser);
      expect(result).toEqual([]);
    });

    it('should throw ForbiddenException when staff views another staff shifts', async () => {
      await expect(
        service.getStaffShifts('user-1', {}, otherStaff),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
