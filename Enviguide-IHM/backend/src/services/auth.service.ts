import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { env } from '../config/env.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  country: string | null;
  status: string;
  category: string;
  password: string;
  last_activity: Date | null;
  created_at: Date;
  updated_at: Date;
  role_name?: string | null;
  vessel_id?: string | null;
  ship_manager?: string | null;
  ship_owner?: string | null;
}

// Convert MongoDB document to UserRow structure expected by Auth routes
function toUserRow(doc: any): UserRow | null {
  if (!doc) return null;
  return {
    id: doc._id,
    email: doc.email,
    name: doc.name,
    phone: doc.phone ?? null,
    country: doc.country ?? null,
    status: doc.status,
    category: doc.category,
    password: doc.password,
    last_activity: doc.last_activity ? new Date(doc.last_activity) : null,
    created_at: new Date(doc.created_at),
    updated_at: new Date(doc.updated_at),
    role_name: doc.role_name ?? null,
    vessel_id: doc.vessel_id ?? null,
    ship_manager: doc.ship_manager ?? null,
    ship_owner: doc.ship_owner ?? null,
  };
}

export const AuthService = {
  async findUserByEmail(email: string) {
    const db = getDb();
    const doc = await db.collection('users').findOne({ email: String(email).trim().toLowerCase() });
    return toUserRow(doc);
  },

  async findUserById(id: string) {
    const db = getDb();
    const doc = await db.collection('users').findOne({ _id: id });
    return toUserRow(doc);
  },

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },

  generateToken(user: { id: string; email: string; category: string }): string {
    const secret: jwt.Secret = env.JWT_SECRET;
    const options: jwt.SignOptions = { expiresIn: env.JWT_EXPIRES_IN as unknown as number };
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.category },
      secret,
      options,
    );
  },

  async updateLastActivity(userId: string) {
    const db = getDb();
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { last_activity: new Date(), updated_at: new Date() } }
    );
  },
};
