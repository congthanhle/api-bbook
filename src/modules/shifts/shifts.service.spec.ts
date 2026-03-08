// src/modules/shifts/shifts.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { SupabaseService } from '../../database/supabase.service';
import { ShiftStatus } from './dto';

// ──────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────

const adminUser = { sub: 'admin-1', email: 'admin@courtos.io', role: 'admin' };
const staffUser = { sub: 'staff-1', email: 'staff@courtos.io', role: 'staff' };

const mockShift = {
  id: 'shift-1',
  name: 'Morning Shift',
  date: '2026-03-15',
  start_time: '08:00',
  end_time: '16:00',
  notes: null,
  status: ShiftStatus.UPCOMING,
  created_by: 'admin-1',
};

const mockAssignment = {
  id: 'assign-1',
  staff_id: 'staff-1',
  shift_id: 'shift-1',
  checked_in_at: null,
  checked_out_at: null,
  notes: null,
  users: { id: 'staff-1', name: 'Staff A', avatar_url: null },
};

const mockShiftWithAssignments = {
  ...mockShift,
  shift_assignments: [mockAssignment],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockQueryBuilder(returnData: any, returnError: any = null, count: number | null = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};
  const methods = [
    'select', 'eq', 'neq', 'in', 'or', 'gte', 'lte', 'lt', 'gt',
    'order', 'range', 'single', 'insert', 'update', 'upsert', 'delete',
  ];

  for (const method of methods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder['single'] = jest.fn().mockResolvedValue({ data: returnData, error: returnError });
  builder['range'] = jest.fn().mockResolvedValue({ data: returnData, error: returnError, count });

  // For insert/update that don't chain to single
  const originalInsert = builder['insert'];
  builder['insert'] = jest.fn().mockImplementation(() => {
    const chain = { ...builder };
    chain['select'] = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
    });
    return chain;
  });
  builder['update'] = jest.fn().mockReturnValue(builder);
  builder['delete'] = jest.fn().mockReturnValue(builder);
  builder['upsert'] = jest.fn().mockResolvedValue({ error: returnError });

  return builder;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockSupabase() {
  const mockClient = {
    from: jest.fn().mockReturnValue(createMockQueryBuilder(mockShiftWithAssignments)),
  };

  return {
    getClient: jest.fn().mockReturnValue(mockClient),
    _mockClient: mockClient,
  };
}

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe('ShiftsService', () => {
  let service: ShiftsService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(async () => {
    mockSupabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────
  // findAll
  // ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated shifts for admin', async () => {
      const qb = createMockQueryBuilder([mockShiftWithAssignments], null, 1);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      const result = await service.findAll({}, adminUser);
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should return only assigned shifts for staff', async () => {
      // First call: shift_assignments query
      const assignQb = createMockQueryBuilder(null);
      assignQb['select'] = jest.fn().mockReturnValue(assignQb);
      assignQb['eq'] = jest.fn().mockResolvedValue({ data: [{ shift_id: 'shift-1' }], error: null });

      // Second call: shifts query
      const shiftsQb = createMockQueryBuilder([mockShiftWithAssignments], null, 1);

      mockSupabase._mockClient.from = jest.fn()
        .mockReturnValueOnce(assignQb)
        .mockReturnValueOnce(shiftsQb);

      const result = await service.findAll({}, staffUser);
      expect(result.data).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────
  // findOne
  // ──────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return shift for admin', async () => {
      const qb = createMockQueryBuilder(mockShiftWithAssignments);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      const result = await service.findOne('shift-1', adminUser);
      expect(result.id).toBe('shift-1');
    });

    it('should allow assigned staff to view shift', async () => {
      const qb = createMockQueryBuilder(mockShiftWithAssignments);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      const result = await service.findOne('shift-1', staffUser);
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for unassigned staff', async () => {
      const shiftNoAssignment = { ...mockShift, shift_assignments: [] };
      const qb = createMockQueryBuilder(shiftNoAssignment);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(
        service.findOne('shift-1', staffUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when shift not found', async () => {
      const qb = createMockQueryBuilder(null, { message: 'not found' });
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(
        service.findOne('nonexistent', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should throw BadRequestException when endTime <= startTime', async () => {
      await expect(
        service.create({
          name: 'Invalid Shift',
          date: '2026-03-15',
          startTime: '16:00',
          endTime: '08:00',
        }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a shift successfully', async () => {
      const insertQb = createMockQueryBuilder({ ...mockShift, id: 'new-shift' });
      insertQb['insert'] = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { ...mockShift, id: 'new-shift' }, error: null }),
        }),
      });

      // findOne call after creation
      const findQb = createMockQueryBuilder({ ...mockShiftWithAssignments, id: 'new-shift' });

      mockSupabase._mockClient.from = jest.fn()
        .mockReturnValueOnce(insertQb)   // insert shift
        .mockReturnValueOnce(findQb);    // findOne

      const result = await service.create({
        name: 'Morning Shift',
        date: '2026-03-15',
        startTime: '08:00',
        endTime: '16:00',
      }, 'admin-1');

      expect(result).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('should reject deleting non-upcoming shifts', async () => {
      const ongoingShift = { ...mockShift, status: ShiftStatus.ONGOING };
      const qb = createMockQueryBuilder(ongoingShift);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(service.remove('shift-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────
  // checkIn
  // ──────────────────────────────────────────────────────

  describe('checkIn', () => {
    it('should throw NotFoundException when not assigned', async () => {
      const qb = createMockQueryBuilder(null, { message: 'not found' });
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(
        service.checkIn('shift-1', 'unassigned-staff'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already checked in', async () => {
      const checkedIn = { ...mockAssignment, checked_in_at: '2026-03-15T08:00:00Z' };
      const qb = createMockQueryBuilder(checkedIn);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(
        service.checkIn('shift-1', 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────
  // checkOut
  // ──────────────────────────────────────────────────────

  describe('checkOut', () => {
    it('should throw BadRequestException when not checked in', async () => {
      const notCheckedIn = { ...mockAssignment, checked_in_at: null };
      const qb = createMockQueryBuilder(notCheckedIn);
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      await expect(
        service.checkOut('shift-1', 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────────────
  // conflictCheck
  // ──────────────────────────────────────────────────────

  describe('conflictCheck', () => {
    it('should return no conflict when staff has no assignments', async () => {
      const qb = createMockQueryBuilder(null);
      qb['select'] = jest.fn().mockReturnValue(qb);
      qb['eq'] = jest.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase._mockClient.from = jest.fn().mockReturnValue(qb);

      const result = await service.conflictCheck('staff-1', '2026-03-15', '08:00', '16:00');
      expect(result.hasConflict).toBe(false);
    });

    it('should detect overlapping shifts', async () => {
      // First call: get assignments
      const assignQb = createMockQueryBuilder(null);
      assignQb['select'] = jest.fn().mockReturnValue(assignQb);
      assignQb['eq'] = jest.fn().mockResolvedValue({
        data: [{ shift_id: 'existing-shift' }],
        error: null,
      });

      // Second call: check overlap
      const overlapQb = createMockQueryBuilder(null);
      overlapQb['select'] = jest.fn().mockReturnValue(overlapQb);
      overlapQb['in'] = jest.fn().mockReturnValue(overlapQb);
      overlapQb['eq'] = jest.fn().mockReturnValue(overlapQb);
      overlapQb['lt'] = jest.fn().mockReturnValue(overlapQb);
      overlapQb['gt'] = jest.fn().mockResolvedValue({
        data: [{ id: 'existing-shift', name: 'Existing', start_time: '09:00', end_time: '17:00' }],
        error: null,
      });

      mockSupabase._mockClient.from = jest.fn()
        .mockReturnValueOnce(assignQb)
        .mockReturnValueOnce(overlapQb);

      const result = await service.conflictCheck('staff-1', '2026-03-15', '10:00', '14:00');
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingShift).toBeDefined();
    });
  });
});
