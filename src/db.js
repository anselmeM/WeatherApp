import PrismaClientPkg from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const { PrismaClient } = PrismaClientPkg;

const isTest = process.env.NODE_ENV === 'test';
const dbUrl = isTest ? 'file:./test.db' : 'file:./users.db';

const adapter = new PrismaBetterSqlite3({
  url: dbUrl
});

export const prisma = new PrismaClient({ adapter });

// Stub functions to maintain backward compatibility with any legacy imports
export const db = null;
export const dbRun = null;
export const dbGet = null;

export async function initDb() {
  // Schema is managed via Prisma CLI (npx prisma db push)
  // This is a no-op to prevent existing code from throwing errors.
}

/**
 * Retrieve a user by email.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function getUser(email) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase();
  const row = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });
  if (!row) return null;
  
  return {
    ...row,
    locations: JSON.parse(row.locations || '[]')
  };
}

/**
 * Create a new user.
 * @param {object} user
 */
export async function createUser(user) {
  const normalizedEmail = user.email.toLowerCase();
  const locationsStr = JSON.stringify(user.locations || []);
  
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: user.password,
      tier: user.tier || 'free',
      createdAt: user.createdAt,
      locations: locationsStr,
      apiCalls: user.apiCalls || 0
    }
  });
}

/**
 * Update user details.
 * @param {string} email
 * @param {object} updates
 */
export async function updateUser(email, updates) {
  if (!email) return;
  const normalizedEmail = email.toLowerCase();
  
  const user = await getUser(normalizedEmail);
  if (!user) return;
  
  const merged = { ...user, ...updates };
  const locationsStr = JSON.stringify(merged.locations || []);
  
  await prisma.user.update({
    where: { email: normalizedEmail },
    data: {
      password: merged.password,
      tier: merged.tier,
      locations: locationsStr,
      apiCalls: merged.apiCalls
    }
  });
}
