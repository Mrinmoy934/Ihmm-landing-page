// ============================================================
// Backend Shared Types - mirrors frontend types/index.ts
// These will be validated by Zod schemas at runtime.
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; stack?: string };
  meta?: { page?: number; limit?: number; total?: number };
}

export type VesselStatus = 'compliant' | 'warning' | 'expired';
export type IhmMethod   = 'EU' | 'HKC';
export type UserRole    = 'admin' | 'manager' | 'viewer';
export type PoStatus    = 'responsive' | 'non-responsive' | 'pending';
export type MaterialCategory = 'hazard' | 'safe' | 'warning';

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
