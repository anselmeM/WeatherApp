import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const isTest = process.env.NODE_ENV === 'test';
const dbFile = isTest ? ':memory:' : './users.db';

export const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  }
});

// Promisify DB methods
export const dbRun = promisify(db.run.bind(db));
export const dbGet = promisify(db.get.bind(db));

export async function initDb() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      tier TEXT DEFAULT 'free',
      createdAt TEXT,
      locations TEXT DEFAULT '[]',
      apiCalls INTEGER DEFAULT 0
    )
  `);
}

// Ensure the table exists immediately
initDb().catch(console.error);

export async function getUser(email) {
  if (!email) return null;
  const row = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!row) return null;
  return {
    ...row,
    locations: JSON.parse(row.locations || '[]')
  };
}

export async function createUser(user) {
  const locationsStr = JSON.stringify(user.locations || []);
  await dbRun(
    'INSERT INTO users (email, password, tier, createdAt, locations, apiCalls) VALUES (?, ?, ?, ?, ?, ?)',
    [user.email.toLowerCase(), user.password, user.tier, user.createdAt, locationsStr, user.apiCalls || 0]
  );
}

export async function updateUser(email, updates) {
  if (!email) return;
  const user = await getUser(email);
  if (!user) return;
  
  const merged = { ...user, ...updates };
  const locationsStr = JSON.stringify(merged.locations || []);
  
  await dbRun(
    'UPDATE users SET password = ?, tier = ?, locations = ?, apiCalls = ? WHERE email = ?',
    [merged.password, merged.tier, locationsStr, merged.apiCalls, email.toLowerCase()]
  );
}
