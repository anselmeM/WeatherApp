import { test } from 'node:test';
import assert from 'node:assert';
import { db, initDb, getUser, createUser, updateUser, dbRun } from './db.js';

test('Database persistence tests (SQLite)', async (t) => {
  // Wait for table creation
  await initDb();
  
  // Clear table for clean state
  await dbRun('DELETE FROM users');

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
    await dbRun('DELETE FROM users WHERE email = ?', [testUser.email]);
  });
});
