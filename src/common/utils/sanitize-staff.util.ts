// src/common/utils/sanitize-staff.util.ts

/**
 * Fields that are considered sensitive and should never be exposed to staff-role users.
 */
const SENSITIVE_FIELDS = [
  'salary',
  'salaryType',
  'salary_type',
  'bankAccountNumber',
  'bank_account_number',
  'idCardNumber',
  'id_card_number',
] as const;

/**
 * Strips sensitive financial/identity fields from a staff record
 * when the requesting user has the 'staff' role.
 *
 * Admin users receive the full record unmodified.
 *
 * @param staff  - The staff record (or array of records) to sanitize
 * @param role   - The role of the requesting user ('admin' | 'staff')
 * @returns Sanitized record(s)
 */
export function sanitizeForRole<T extends Record<string, unknown>>(
  staff: T,
  role: string,
): T;
export function sanitizeForRole<T extends Record<string, unknown>>(
  staff: T[],
  role: string,
): T[];
export function sanitizeForRole<T extends Record<string, unknown>>(
  staff: T | T[],
  role: string,
): T | T[] {
  if (role !== 'staff') return staff;

  const strip = (record: T): T => {
    const sanitized = { ...record };
    for (const field of SENSITIVE_FIELDS) {
      delete sanitized[field];
    }
    // Also strip nested staff_profiles sensitive fields if present
    if (sanitized['staff_profiles'] && typeof sanitized['staff_profiles'] === 'object') {
      const profile = { ...(sanitized['staff_profiles'] as Record<string, unknown>) };
      for (const field of SENSITIVE_FIELDS) {
        delete profile[field];
      }
      (sanitized as Record<string, unknown>)['staff_profiles'] = profile;
    }
    return sanitized;
  };

  return Array.isArray(staff) ? staff.map(strip) : strip(staff);
}
