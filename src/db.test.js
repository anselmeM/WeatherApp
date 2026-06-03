import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { prisma, getUser, createUser, updateUser } from './db.js';

test('Database persistence tests (Prisma / SQLite)', async (t) => {
  // Set environment variable to ensure we run against test DB
  process.env.NODE_ENV = 'test';

  // Automatically deploy database schema to test.db before running tests
  try {
    execSync('npx prisma db push', {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      },
      stdio: 'pipe' // Keep output clean
    });
  } catch (error) {
    console.error('Failed to run prisma db push for test database:', error.message);
    throw error;
  }
  
  // Clear table for clean state
  await prisma.user.deleteMany();

  await t.test('should return null when user does not exist', async () => {
    const user = await getUser('nonexistent@example.com');
    assert.strictEqual(user, null);
  });

  await t.test('should create, get, and update a user successfully', async () => {
    const testUser = {
      email: 'test_db_user@example.com',
      password: 'hashedpassword',
      tier: 'free',
      createdAt: new Date().toISOString(),
      locations: ['Paris', 'London'],
      apiCalls: 0
    };

    // Create user
    await createUser(testUser);
    
    // Retrieve user
    const retrievedUser = await getUser(testUser.email);
    assert.strictEqual(retrievedUser.email, testUser.email);
    assert.deepStrictEqual(retrievedUser.locations, testUser.locations);
    assert.strictEqual(retrievedUser.tier, 'free');

    // Update user
    await updateUser(testUser.email, { tier: 'premium', locations: ['Paris'] });
    
    // Retrieve updated user
    const updatedUser = await getUser(testUser.email);
    assert.strictEqual(updatedUser.tier, 'premium');
    assert.deepStrictEqual(updatedUser.locations, ['Paris']);

    // Clean up
    await prisma.user.delete({
      where: { email: testUser.email }
    });
  });
});
