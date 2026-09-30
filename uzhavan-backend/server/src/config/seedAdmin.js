/**
 * One-off admin seeder. Usage:
 *   ADMIN_PHONE=9000000001 ADMIN_PASSWORD=... ADMIN_NAME="Platform Admin" node src/config/seedAdmin.js
 */
import { connectDB, disconnectDB } from './db.js';
import { User } from '../modules/auth/user.model.js';
import { ROLES } from '@uzhavan360/shared';

const phone = process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Uzhavan Admin';

if (!phone || !password) {
  console.error('[SEED ADMIN] ADMIN_PHONE and ADMIN_PASSWORD are required.');
  process.exit(1);
}

await connectDB();
const existing = await User.findOne({ phone });
if (existing) {
  existing.role = ROLES.ADMIN;
  existing.isVerified = true;
  existing.password = password;
  await existing.save();
  console.log(`[SEED ADMIN] Updated existing user ${phone} to ROLE_ADMIN.`);
} else {
  await User.create({ name, phone, password, role: ROLES.ADMIN, isVerified: true });
  console.log(`[SEED ADMIN] Created admin ${phone}.`);
}
await disconnectDB();
