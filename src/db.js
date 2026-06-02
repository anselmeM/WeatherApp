import fs from 'fs';

const DB_FILE = './users.json';

export function loadUsers() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (e) {
    console.error('Failed to load users database:', e);
  }
  return new Map();
}

export const users = loadUsers();

export function saveUsers() {
  try {
    const obj = Object.fromEntries(users);
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save users database:', e);
  }
}
