import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDb, closePool } from '../config/database.js';

const DEFAULT_PASSWORD = 'Envi123';

const TEST_USERS = [
  {
    email: 'superadmin@enviguide.com',
    name: 'Demo Super Admin',
    category: 'superadmin',
    roleName: 'superadmin',
    country: 'India',
  },
  {
    email: 'owner@enviguide.com',
    name: 'Demo Owner',
    category: 'owner',
    roleName: 'owner',
    country: 'India',
  },
  {
    email: 'manager@enviguide.com',
    name: 'Demo Ship Manager',
    category: 'ship_manager',
    roleName: 'ship_manager',
    country: 'India',
  },
  {
    email: 'staff@enviguide.com',
    name: 'Demo Staff',
    category: 'staff',
    roleName: 'staff',
    country: 'India',
  },
];

const MODULES = ['vessels', 'materials', 'decks', 'documents', 'purchase_orders', 'audits', 'reports', 'certificate', 'settings', 'security'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'print', 'export', 'send'];
const ALL_PERMISSIONS = MODULES.flatMap((m) => ACTIONS.map((a) => `${m}_${a}`));

const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  owner: [
    'vessels_read', 'vessels_print', 'vessels_export',
    'materials_read', 'materials_print', 'materials_export',
    'decks_read',
    'documents_read', 'documents_print', 'documents_export',
    'purchase_orders_read',
    'audits_read',
    'reports_read', 'reports_print', 'reports_export',
    'certificate_read', 'certificate_print', 'certificate_export',
    'settings_read',
  ],
  ship_manager: [
    'vessels_read', 'vessels_update',
    'materials_create', 'materials_read', 'materials_update',
    'decks_create', 'decks_read', 'decks_update',
    'documents_create', 'documents_read', 'documents_update',
    'purchase_orders_create', 'purchase_orders_read', 'purchase_orders_update', 'purchase_orders_send',
    'audits_create', 'audits_read', 'audits_update',
    'reports_create', 'reports_read',
    'certificate_read',
    'settings_read',
  ],
  staff: [
    'vessels_create', 'vessels_read', 'vessels_update',
    'materials_create', 'materials_read', 'materials_update',
    'decks_create', 'decks_read', 'decks_update',
    'documents_create', 'documents_read',
    'purchase_orders_create', 'purchase_orders_read',
    'audits_create', 'audits_read',
    'reports_create', 'reports_read',
    'certificate_read',
  ],
};

async function seed() {
  const db = await connectDb();
  console.log('Connecting and seeding role permissions + users...');

  // 1. Seed Role Permissions
  const rolePermsColl = db.collection('role_permissions');
  for (const [role, nodeIds] of Object.entries(ROLE_PERMISSIONS)) {
    console.log(`Setting up permissions for role: ${role}`);
    // Clear existing
    await rolePermsColl.deleteMany({ role_name: role });
    
    // Insert new
    const docs = nodeIds.map(nodeId => ({
      role_name: role,
      node_id: nodeId,
      granted_at: new Date(),
    }));
    
    if (docs.length > 0) {
      await rolePermsColl.insertMany(docs);
    }
  }

  // 2. Create Users
  const usersColl = db.collection('users');
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const u of TEST_USERS) {
    const existing = await usersColl.findOne({ email: u.email });
    if (existing) {
      console.log(`Updating existing test user: ${u.email}`);
      await usersColl.updateOne(
        { email: u.email },
        {
          $set: {
            name: u.name,
            password: hashedPassword,
            category: u.category,
            role_name: u.roleName,
            country: u.country,
            status: 'active',
            updated_at: new Date(),
          },
        }
      );
    } else {
      console.log(`Creating new test user: ${u.email}`);
      const _id = crypto.randomUUID();
      await usersColl.insertOne({
        _id,
        email: u.email,
        name: u.name,
        password: hashedPassword,
        category: u.category,
        role_name: u.roleName,
        country: u.country,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  console.log('Seeding finished successfully.');
  await closePool();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
