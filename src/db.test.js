import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { users, saveUsers, loadUsers } from './db.js';

test('Database persistence tests', async (t) => {
  const DB_FILE = './users.json';
  let backupExists = false;
  let backupData = '';

  // Setup: Backup existing database if it exists
  if (fs.existsSync(DB_FILE)) {
    backupExists = true;
    backupData = fs.readFileSync(DB_FILE, 'utf8');
  }

  // Ensure database file is removed or reset for testing
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }

  await t.test('should load an empty map when users.json does not exist', () => {
    // Manually run loadUsers and check
    const tempUsers = loadUsers();
    assert.ok(tempUsers instanceof Map);
    assert.strictEqual(tempUsers.size, 0);
  });

  await t.test('should set and save a user successfully', () => {
    const testUser = {
      email: 'test_db_user@example.com',
      password: 'hashedpassword',
      tier: 'free',
      createdAt: new Date().toISOString(),
      locations: ['Paris', 'London']
    };

    // Add user to the shared users map
    users.set(testUser.email, testUser);
    saveUsers();

    // Verify the file was written to disk
    assert.ok(fs.existsSync(DB_FILE));
    
    // Load it back using loadUsers
    const reloadedUsers = loadUsers();
    assert.ok(reloadedUsers.has(testUser.email));
    
    const reloadedUser = reloadedUsers.get(testUser.email);
    assert.strictEqual(reloadedUser.email, testUser.email);
    assert.deepStrictEqual(reloadedUser.locations, testUser.locations);

    // Clean up test user from map
    users.delete(testUser.email);
  });

  // Teardown: Restore backup database or remove test file
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }
  if (backupExists) {
    fs.writeFileSync(DB_FILE, backupData, 'utf8');
  }
});
