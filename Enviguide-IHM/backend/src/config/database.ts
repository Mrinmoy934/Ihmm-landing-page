// -- MongoDB Connection Pool (MongoClient) -------------------
import { MongoClient, Db, Collection } from 'mongodb';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const dbLog = logger.child('db');

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  dbLog.info('Connecting to MongoDB...');
  // We append the database name 'ihm_enviguide' to the URI if it's not already there.
  let uri = env.MONGODB_URI;
  if (uri && !uri.includes('ihm.kltlone.mongodb.net/')) {
    uri = uri.replace('ihm.kltlone.mongodb.net', 'ihm.kltlone.mongodb.net/ihm_enviguide');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  dbLog.info('Connected to MongoDB successfully.');
  return db;
}

// Eager connection at module import
connectDb().catch((err) => {
  dbLog.error('Failed to connect to MongoDB at startup:', err.message);
});

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not connected yet.');
  }
  return db;
}

export function getCollection<T = any>(name: string): Collection<T & { _id: string }> {
  return getDb().collection<T & { _id: string }>(name);
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoClient not connected yet.');
  }
  return client;
}

/** Legacy query helper for health check / simple pings */
export async function query(sql: string, params?: any[]): Promise<any> {
  const normalized = sql.trim().toLowerCase();
  if (normalized === 'select 1' || normalized === 'select 1;') {
    const database = getDb();
    await database.command({ ping: 1 });
    return { rows: [{ '1': 1 }] };
  }
  throw new Error(`SQL query() is deprecated for MongoDB. Use getDb() collection calls instead. Query attempted: ${sql}`);
}

export async function closePool(): Promise<void> {
  if (client) {
    await client.close();
    db = null;
    client = null;
    dbLog.info('MongoDB connection closed.');
  }
}

export default {
  connectDb,
  getDb,
  getCollection,
  getClient,
  query,
  closePool,
};
