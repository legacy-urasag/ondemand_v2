import { MongoClient, Db } from 'mongodb';
import { env } from './env.js';

const client = new MongoClient(env.MONGODB_URI);

let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  await client.connect();
  db = client.db();

  console.log('🍃 Connected to MongoDB Atlas');

  return db;
}
