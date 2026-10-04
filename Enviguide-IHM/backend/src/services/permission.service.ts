import { getDb, getClient } from '../config/database.js';

interface NodeRow {
  id: string;
  label: string;
  parent_id: string | null;
  sort_order: number;
}

export interface PermissionNode {
  id: string;
  label: string;
  children?: PermissionNode[];
}

function buildTree(rows: NodeRow[]): PermissionNode[] {
  type InternalNode = PermissionNode & { parent_id: string | null };
  const byId = new Map<string, InternalNode>();
  for (const r of rows) {
    byId.set(r.id, { id: r.id, label: r.label, parent_id: r.parent_id, children: [] });
  }
  const roots: InternalNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (!node) continue;
    const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  const strip = (nodes: InternalNode[]) => {
    for (const n of nodes) {
      delete (n as { parent_id?: string | null }).parent_id;
      if (n.children && n.children.length === 0) delete n.children;
      else if (n.children) strip(n.children as InternalNode[]);
    }
  };
  strip(roots);
  return roots;
}

export const PermissionService = {
  /** List all nodes as a hierarchical tree */
  async listNodes(): Promise<PermissionNode[]> {
    const db = getDb();
    const rows = await db.collection('permission_nodes')
      .find({})
      .sort({ sort_order: 1, label: 1 })
      .toArray();

    const nodeRows = rows.map((r) => ({
      id: r._id as string,
      label: r.label as string,
      parent_id: r.parent_id as string | null,
      sort_order: r.sort_order as number,
    }));

    return buildTree(nodeRows);
  },

  /** Upsert a permission node (id stable — e.g. 'ship_view') */
  async upsertNode(id: string, label: string, parentId: string | null = null, sortOrder = 0) {
    const db = getDb();
    await db.collection('permission_nodes').updateOne(
      { _id: id },
      { $set: { label, parent_id: parentId, sort_order: sortOrder } },
      { upsert: true }
    );
  },

  async deleteNode(id: string) {
    const db = getDb();
    await db.collection('permission_nodes').deleteOne({ _id: id });
  },

  /** Get flat list of node ids granted to a user */
  async getUserPermissions(userId: string): Promise<string[]> {
    const db = getDb();
    const cursor = db.collection('user_permissions').find({ user_id: userId });
    const rows = await cursor.toArray();
    return rows.map((x) => x.node_id as string);
  },

  /** Replace a user's permission set with the given list (atomic) */
  async setUserPermissions(userId: string, nodeIds: string[]) {
    const client = getClient();
    const session = client.startSession();
    try {
      session.startTransaction();
      const db = getDb();
      await db.collection('user_permissions').deleteMany({ user_id: userId }, { session });
      if (nodeIds.length > 0) {
        const docs = nodeIds.map((nodeId) => ({ user_id: userId, node_id: nodeId }));
        // Insert with ignore duplicates if any node_id matches
        try {
          await db.collection('user_permissions').insertMany(docs, { session, ordered: false });
        } catch (err: any) {
          // ignore duplicate key error
          if (!err.message.includes('E11000')) {
            throw err;
          }
        }
      }
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  },

  /** Get flat list of node ids granted to a role */
  async getRolePermissions(roleName: string): Promise<string[]> {
    const db = getDb();
    const cursor = db.collection('role_permissions').find({ role_name: roleName });
    const rows = await cursor.toArray();
    return rows.map((x) => x.node_id as string);
  },

  /** Replace a role's permission set with the given list (atomic) */
  async setRolePermissions(roleName: string, nodeIds: string[]) {
    const client = getClient();
    const session = client.startSession();
    try {
      session.startTransaction();
      const db = getDb();
      await db.collection('role_permissions').deleteMany({ role_name: roleName }, { session });
      if (nodeIds.length > 0) {
        const docs = nodeIds.map((nodeId) => ({ role_name: roleName, node_id: nodeId }));
        try {
          await db.collection('role_permissions').insertMany(docs, { session, ordered: false });
        } catch (err: any) {
          if (!err.message.includes('E11000')) {
            throw err;
          }
        }
      }
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  },

  async listRoles(): Promise<string[]> {
    const db = getDb();
    
    // Distinct from role_permissions
    const rolePerms = await db.collection('role_permissions').distinct('role_name');
    // Distinct from users
    const usersRoles = await db.collection('users').distinct('role_name', { role_name: { $ne: null } });

    const rolesSet = new Set<string>([...rolePerms, ...usersRoles]);
    return Array.from(rolesSet).sort();
  },
};
