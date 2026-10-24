import { Types } from 'mongoose';
import type { Page } from '@tgh/shared';

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function skipFor(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}
