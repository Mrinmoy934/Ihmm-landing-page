import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDb, closePool } from '../config/database.js';

const DEFAULT_PASSWORD = 'Envi123';

const users = [
  { email: 'narasimha.goggi@enviguide.com',       name: 'Narasimha Goggi',       category: 'admin',   country: 'India' },
  { email: 'hruday.murikipudi@enviguide.com',      name: 'Hruday Murikipudi',     category: 'admin',   country: 'India' },
  { email: 'saisanjan.kethamreddy@enviguide.com',   name: 'Sai Sanjan Kethamreddy', category: 'admin',   country: 'India' },
  { email: 'vishnu.simhadri@enviguide.com',         name: 'Vishnu Simhadri',       category: 'admin',   country: 'India' },
  { email: 'govardhan.kothapalli@enviguide.com',    name: 'Govardhan Kothapalli',  category: 'admin',   country: 'India' },
  { email: 'sivaprasad@enviguide.com',              name: 'Sivaprasad',            category: 'admin',   country: 'India' },
];

async function seed() {
  const db = await connectDb();
  console.log('Seeding user accounts to MongoDB...');

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const usersCollection = db.collection('users');

  for (const u of users) {
    const existing = await usersCollection.findOne({ email: u.email });
    if (existing) {
      await usersCollection.updateOne(
        { email: u.email },
        { 
          $set: { 
            name: u.name,
            password: hashedPassword,
            category: u.category,
            country: u.country,
            status: 'active',
            updated_at: new Date()
          } 
        }
      );
      console.log(`Updated user: ${u.email} (${u.category})`);
    } else {
      const _id = crypto.randomUUID();
      await usersCollection.insertOne({
        _id,
        email: u.email,
        name: u.name,
        password: hashedPassword,
        category: u.category,
        country: u.country,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`Created user: ${u.email} (${u.category})`);
    }
  }

  // Also seed some default user categories to avoid errors
  const categoriesCollection = db.collection('user_categories');
  const defaultCategories = ['admin', 'manager', 'viewer', 'surveyor', 'deck officer'];
  for (const name of defaultCategories) {
    const existingCat = await categoriesCollection.findOne({ name });
    if (!existingCat) {
      await categoriesCollection.insertOne({
        _id: crypto.randomUUID(),
        name,
        description: `${name.toUpperCase()} Category`,
        status: 'Active',
        archived: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`Created category: ${name}`);
    }
  }

  // Seed default permission nodes (from the migrate script list)
  const permissionNodesCollection = db.collection('permission_nodes');
  const modules = [
    { id: 'mod_vessels', label: 'Vessels', parent_id: null, sort_order: 10 },
    { id: 'mod_materials', label: 'Materials Record', parent_id: null, sort_order: 20 },
    { id: 'mod_decks', label: 'Decks', parent_id: null, sort_order: 30 },
    { id: 'mod_documents', label: 'Documents', parent_id: null, sort_order: 40 },
    { id: 'mod_purchase_orders', label: 'Purchase Orders', parent_id: null, sort_order: 50 },
    { id: 'mod_audits', label: 'Audits', parent_id: null, sort_order: 60 },
    { id: 'mod_reports', label: 'Reports', parent_id: null, sort_order: 70 },
    { id: 'mod_certificate', label: 'IHM Certificate', parent_id: null, sort_order: 80 },
    { id: 'mod_settings', label: 'Settings', parent_id: null, sort_order: 90 },
    { id: 'mod_security', label: 'Security', parent_id: null, sort_order: 100 }
  ];

  for (const m of modules) {
    await permissionNodesCollection.updateOne(
      { _id: m.id },
      { $set: { label: m.label, parent_id: m.parent_id, sort_order: m.sort_order } },
      { upsert: true }
    );
  }

  const actions = ['create', 'read', 'update', 'delete', 'print', 'export', 'send'];
  for (const m of modules) {
    let order = 1;
    for (const act of actions) {
      const leafId = `${m.id.replace('mod_', '')}_${act}`;
      const leafLabel = act.charAt(0).toUpperCase() + act.slice(1);
      await permissionNodesCollection.updateOne(
        { _id: leafId },
        { $set: { label: leafLabel, parent_id: m.id, sort_order: order++ } },
        { upsert: true }
      );
    }
  }
  console.log('Permission nodes seeded.');

  console.log('\nDone! Users, Categories, and Permissions successfully seeded to MongoDB Atlas.');
  await closePool();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
