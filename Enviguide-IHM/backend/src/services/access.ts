// -- Access helpers ---------------------------------------------------------
// One-line predicate the data services use to decide whether the caller
// gets the full-fleet view or the per-user-scoped view.
//
// Background: vessels carry a `created_by_id` column. Until now every
// service path filtered SELECTs by it, which meant *every* admin saw
// only the vessels they personally onboarded — defeating the point of
// having a shared admin team. Admins should see all vessels (and
// everything downstream — audits, POs, decks, materials). Non-admin
// roles (Ship Manager, Supplier, Viewer) stay scoped to their own data.
//
// We cache the lookup for 60 seconds per user so we don't hit the
// users table on every request inside a hot endpoint.

import { getDb } from '../config/database.js';

const TTL_MS = 60_000;
type CacheEntry = { isAdmin: boolean; expires: number };
const cache = new Map<string, CacheEntry>();

/** True when the user's `category` column equals 'admin' (case-insensitive). */
export async function isUserAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.expires > now) return hit.isAdmin;

  const db = getDb();
  const row = await db.collection('users').findOne(
    { _id: userId },
    { projection: { category: 1 } }
  ) as { category?: string } | null;

  const cat = String(row?.category ?? '').toLowerCase();
  const isAdmin = !!row && (cat === 'admin' || cat === 'superadmin' || cat.includes('admin'));
  cache.set(userId, { isAdmin, expires: now + TTL_MS });
  return isAdmin;
}

/** Drop the cached admin flag for a user — call after role/category
 *  changes so the next request reflects the new state immediately. */
export function invalidateAdminCache(userId: string): void {
  cache.delete(userId);
}
