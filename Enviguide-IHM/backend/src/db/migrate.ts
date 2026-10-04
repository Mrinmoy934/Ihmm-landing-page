// -- Database Migration (MongoDB Indexes) --------------------------
// Creates all collections and indexes if they don't exist.
import { connectDb, closePool } from '../config/database.js';

async function migrate() {
  const db = await connectDb();
  console.log('Running MongoDB migrations (index creation)...');

  // 1. Users collection
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ status: 1 });
  
  // 2. Vessels collection
  const vessels = db.collection('vessels');
  await vessels.createIndex({ imo_number: 1 }, { unique: true });
  await vessels.createIndex({ created_by_id: 1 });
  
  // 3. Audit Summaries collection
  const auditSummaries = db.collection('audit_summaries');
  await auditSummaries.createIndex({ vessel_id: 1 });
  await auditSummaries.createIndex({ status: 1 });
  await auditSummaries.createIndex({ last_activity: -1 });

  // 4. Audit Line Items collection
  const auditLineItems = db.collection('audit_line_items');
  await auditLineItems.createIndex({ audit_id: 1 });
  await auditLineItems.createIndex({ vessel_id: 1 });
  await auditLineItems.createIndex({ po_number: 1 });
  await auditLineItems.createIndex({ vendor_email: 1 });

  // 5. GA Plans
  const gaPlans = db.collection('ga_plans');
  await gaPlans.createIndex({ vessel_id: 1 });

  // 6. Deck Areas
  const deckAreas = db.collection('deck_areas');
  await deckAreas.createIndex({ ga_plan_id: 1, name: 1 }, { unique: true });

  // 7. Decks
  const decks = db.collection('decks');
  await decks.createIndex({ vessel_id: 1 });
  await decks.createIndex({ level: 1 });

  // 8. Materials
  const materials = db.collection('materials');
  await materials.createIndex({ vessel_id: 1 });
  await materials.createIndex({ deck_id: 1 });

  // 9. Documents
  const documents = db.collection('documents');
  await documents.createIndex({ vessel_id: 1 });
  await documents.createIndex({ document_type: 1 });

  // 10. Purchase Orders
  const purchaseOrders = db.collection('purchase_orders');
  await purchaseOrders.createIndex({ vessel_id: 1 });
  await purchaseOrders.createIndex({ po_number: 1 });
  await purchaseOrders.createIndex({ supplier_name: 1 });

  // 11. Clarification Requests
  const clarificationRequests = db.collection('clarification_requests');
  await clarificationRequests.createIndex({ vessel_id: 1 });
  await clarificationRequests.createIndex({ imo_number: 1 });
  await clarificationRequests.createIndex({ public_token: 1 }, { unique: true, sparse: true });

  // 12. Clarification Items
  const clarificationItems = db.collection('clarification_items');
  await clarificationItems.createIndex({ clarification_id: 1, item_index: 1 }, { unique: true });
  await clarificationItems.createIndex({ mds_status: 1 });

  // 13. Reports
  const reports = db.collection('reports');
  await reports.createIndex({ vessel_id: 1 });
  await reports.createIndex({ report_type: 1 });

  // 14. Suspected Keywords
  const suspectedKeywords = db.collection('suspected_keywords');
  await suspectedKeywords.createIndex({ keyword: 1 }, { unique: true });

  // 15. Suppliers
  const suppliers = db.collection('suppliers');
  await suppliers.createIndex({ name: 1 });

  // 16. Equipment Master
  const equipmentMaster = db.collection('equipment_master');
  await equipmentMaster.createIndex({ name: 1 });

  // 17. User Categories
  const userCategories = db.collection('user_categories');
  await userCategories.createIndex({ name: 1 }, { unique: true });

  // 18. Menu Items
  const menuItems = db.collection('menu_items');
  await menuItems.createIndex({ path: 1 });

  // 19. Permission Nodes
  const permissionNodes = db.collection('permission_nodes');
  await permissionNodes.createIndex({ parent_id: 1 });

  // 20. User Permissions
  const userPermissions = db.collection('user_permissions');
  await userPermissions.createIndex({ user_id: 1, node_id: 1 }, { unique: true });

  // 21. Role Permissions
  const rolePermissions = db.collection('role_permissions');
  await rolePermissions.createIndex({ role_name: 1, node_id: 1 }, { unique: true });

  // 22. Contact Messages
  const contactMessages = db.collection('contact_messages');
  await contactMessages.createIndex({ status: 1 });

  console.log('MongoDB migrations complete! All indexes created.');
}

migrate()
  .then(() => closePool())
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
