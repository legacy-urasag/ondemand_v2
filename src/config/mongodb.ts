import { MongoClient, Db } from 'mongodb';
import { env } from './env.js';

const client = new MongoClient(env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  console.log('🍃 Connecting to MongoDB...');

  await client.connect();

  db = client.db();

  console.log('🍃 Connected to MongoDB Atlas');

  return db;
}