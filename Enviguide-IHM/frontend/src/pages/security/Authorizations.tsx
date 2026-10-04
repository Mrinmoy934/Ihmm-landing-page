// ─── Security → Authorizations ──────────────────────────────────────────────
// One page that replaces the legacy User Profile / User Menu / User Rights /
// User Role Rights / User Category screens. Two tabs:
//   • User Permissions — pick a user, edit their effective grant matrix.
//   • Manage Roles     — edit a role's default grant matrix.
//
// Storage: existing /permissions/users/:id and /permissions/roles/:name
// endpoints. Each cell maps to a permission_nodes row id like
// "vessels_create" / "audits_send" — seeded by the migration.

import { useEffect, useMemo, useState, useRef } from 'react';
import { Shield, RefreshCw, Save, Check, ShieldCheck, UserPlus, X, Eye, EyeOff } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import { useAuth } from '../../contexts/AuthContext';
import './Authorizations.css';

// ─── Catalog ────────────────────────────────────────────────────────────────
// 10 modules × 7 actions = 70 leaf node ids the backend has seeded. The IDs
// here MUST match the migration seed in backend/src/db/migrate.ts.

interface ModuleDef { id: string; key: string; label: string; }

const MODULES: ModuleDef[] = [
  { id: 'mod_vessels',         key: 'vessels',         label: 'Vessels' },
  { id: 'mod_materials',       key: 'materials',       label: 'Materials Record' },
  { id: 'mod_decks',           key: 'decks',           label: 'Decks' },
  { id: 'mod_documents',       key: 'documents',       label: 'Documents' },
  { id: 'mod_purchase_orders', key: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'mod_audits',          key: 'audits',          label: 'Audits' },
  { id: 'mod_reports',         key: 'reports',         label: 'Reports' },
  { id: 'mod_certificate',     key: 'certificate',     label: 'IHM Certificate' },
  { id: 'mod_settings',        key: 'settings',        label: 'Settings' },
  { id: 'mod_security',        key: 'security',        label: 'Security' },
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'print', 'export', 'send'] as const;
type Action = typeof ACTIONS[number];

const ACTION_LABELS: Record<Action, string> = {
  create: 'Create', read: 'Read', update: 'Update', delete: 'Delete',
  print: 'Print', export: 'Export', send: 'Send',
};

const nodeId = (mod: ModuleDef, action: Action) => `${mod.key}_${action}`;

// All 70 leaf ids in display order — used by the bulk "Grant all" + dirty-check.
const ALL_LEAF_IDS: string[] = MODULES.flatMap((m) => ACTIONS.map((a) => nodeId(m, a)));

// Default roles shown if the backend returns nothing (fresh DB / no role grants
// recorded yet). Two portals only for now: Admin + Ship Owner.
const FALLBACK_ROLES = ['admin', 'superadmin', 'owner', 'ship_manager', 'vessel'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string;
  email: string;
  roleName?: string | null;
  category?: string | null;
}

type Tab = 'user' | 'role';

// ─── Component ──────────────────────────────────────────────────────────────

export default function Authorizations() {
  const { user: me, refresh: refreshAuth } = useAuth();
  const [tab, setTab] = useState<Tab>('user');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = useMemo(() => {
    if (!me) return false;
    const role = (me.roleName || me.role || '').toLowerCase();
    return role === 'superadmin' || role.includes('super');
  }, [me]);

  const isAutoGrantedAll = false;

  // The granted set for the *current* scope (user or role), and the snapshot
  // we last loaded — diffing the two drives the Save button enabled state.
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [initialGranted, setInitialGranted] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Add Ship Manager modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [smForm, setSmForm] = useState({
    name: '', email: '', phone: '', country: '', password: '', confirmPassword: '',
  });
  const [smError, setSmError] = useState<string | null>(null);
  const [smSaving, setSmSaving] = useState(false);

  const [showSmPassword, setShowSmPassword] = useState(false);
  const [showSmConfirmPassword, setShowSmConfirmPassword] = useState(false);

  const resetSmForm = () => {
    setSmForm({ name: '', email: '', phone: '', country: '', password: '', confirmPassword: '' });
    setSmError(null);
    setShowSmPassword(false);
    setShowSmConfirmPassword(false);
  };

  const submitShipManager = async () => {
    setSmError(null);
    const { name, email, password, confirmPassword } = smForm;
    if (!name.trim() || !email.trim() || !password) {
      setSmError('Name, email and password are required.');
      return;
    }
    if (password.length < 6) {
      setSmError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSmError('Passwords do not match.');
      return;
    }
    setSmSaving(true);
    try {
      const res = await api.post<{ success: boolean; data: UserRow }>(ENDPOINTS.USERS.LIST, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: smForm.phone.trim() || undefined,
        country: smForm.country.trim() || undefined,
        category: 'Ship Manager',
        roleName: 'ship_manager',
        status: 'active',
      });
      const created = res.data;
      // Re-pull users so the new row shows up in the picker, then jump
      // straight to it on the User Permissions tab — admin can tick
      // permissions immediately and Save without context-switching.
      const list = await api.get<{ success: boolean; data: UserRow[] }>(ENDPOINTS.USERS.LIST).catch(() => ({ data: [] as UserRow[] }));
      if (Array.isArray(list.data)) setUsers(list.data);
      setTab('user');
      setSelectedRole('ship_manager');
      setSelectedUserId(created.id);
      setShowAddModal(false);
      resetSmForm();
      setToast({ kind: 'ok', text: `Ship Manager "${created.name}" created. Tick permissions and Save.` });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setSmError((err as Error).message || 'Failed to create Ship Manager');
    } finally {
      setSmSaving(false);
    }
  };

  // ── Load users + roles once ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ success: boolean; data: UserRow[] }>(ENDPOINTS.USERS.LIST).catch(() => ({ success: false, data: [] as UserRow[] })),
      api.get<{ success: boolean; data: string[] }>(ENDPOINTS.PERMISSIONS.ROLES).catch(() => ({ success: false, data: [] as string[] })),
    ]).then(([u, r]) => {
      if (cancelled) return;
      const userRows = Array.isArray(u.data) ? u.data : [];
      setUsers(userRows);
      // Union backend roles with the static fallback list — guarantees the
      // dropdown is never empty on a fresh deployment.
      const merged = new Set<string>([...(Array.isArray(r.data) ? r.data : []), ...FALLBACK_ROLES]);
      const roleList = Array.from(merged).sort();
      setRoles(roleList);
      if (roleList.length && !selectedRole) setSelectedRole(roleList[0]);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reload grants whenever the active scope changes ────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadGrants = async () => {
      if (tab === 'user' && !selectedUserId) {
        setGranted(new Set()); setInitialGranted(new Set());
        return;
      }
      if (tab === 'role' && !selectedRole) {
        setGranted(new Set()); setInitialGranted(new Set());
        return;
      }
      setLoading(true);
      try {
        const path = tab === 'user'
          ? ENDPOINTS.PERMISSIONS.USER(selectedUserId)
          : ENDPOINTS.PERMISSIONS.ROLE(selectedRole);
        const res = await api.get<{ success: boolean; data: string[] }>(path);
        if (cancelled) return;
        const ids = Array.isArray(res.data) ? res.data : [];
        // Keep only the *new* module-action ids; legacy node ids (ship_view etc.)
        // continue to live in the same table but aren't editable here.
        const filtered = new Set(ids.filter((id) => ALL_LEAF_IDS.includes(id)));
        setGranted(filtered);
        setInitialGranted(new Set(filtered));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadGrants();
    return () => { cancelled = true; };
  }, [tab, selectedUserId, selectedRole]);

  const filteredUsers = useMemo(() => {
    if (!selectedRole) return users;
    return users.filter((u) => (u.roleName || u.category || '').toLowerCase() === selectedRole.toLowerCase());
  }, [users, selectedRole]);

  const dropdownFilteredUsers = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return filteredUsers;
    return filteredUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        (u.email || '').toLowerCase().includes(query)
    );
  }, [filteredUsers, searchTerm]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const has = (id: string) => {
    if (isAutoGrantedAll) return true;
    return granted.has(id);
  };

  const toggle = (id: string) => {
    if (isAutoGrantedAll) return;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleModuleAll = (mod: ModuleDef) => {
    if (isAutoGrantedAll) return;
    const ids = ACTIONS.map((a) => nodeId(mod, a));
    const allOn = ids.every((id) => granted.has(id));
    setGranted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (allOn) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const toggleColumn = (action: Action) => {
    if (isAutoGrantedAll) return;
    const ids = MODULES.map((m) => nodeId(m, action));
    const allOn = ids.every((id) => granted.has(id));
    setGranted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (allOn) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const grantAllCascade = () => {
    if (isAutoGrantedAll) return;
    setGranted(new Set(ALL_LEAF_IDS));
  };
  const revokeAll       = () => {
    if (isAutoGrantedAll) return;
    setGranted(new Set());
  };

  // ── Dirty + scope label ───────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (isAutoGrantedAll) return false;
    if (granted.size !== initialGranted.size) return true;
    for (const id of granted) if (!initialGranted.has(id)) return true;
    return false;
  }, [granted, initialGranted, isAutoGrantedAll]);

  const scopeLabel = useMemo(() => {
    if (tab === 'user') {
      const u = users.find((x) => x.id === selectedUserId);
      return u ? `${u.name} Permissions` : 'Select a user';
    }
    return selectedRole ? `${selectedRole} Permissions` : 'Select a role';
  }, [tab, users, selectedUserId, selectedRole]);

  // ── Save / Refresh ────────────────────────────────────────────────────────
  const refresh = () => {
    setGranted(new Set(initialGranted));
    setToast({ kind: 'ok', text: 'Reverted to last saved state' });
    setTimeout(() => setToast(null), 2200);
  };

  const save = async () => {
    if (!isDirty) return;
    if (tab === 'user' && !selectedUserId) return;
    if (tab === 'role' && !selectedRole) return;
    setSaving(true);
    try {
      const path = tab === 'user'
        ? ENDPOINTS.PERMISSIONS.USER(selectedUserId)
        : ENDPOINTS.PERMISSIONS.ROLE(selectedRole);
      // Preserve any legacy node grants we filtered out on load — fetch the
      // full server list, drop the new module-action ids, then merge our edits.
      // This is what "keep the old nodes" guarantees in practice: editing the
      // matrix here never wipes legacy ship_view / fleet_add / etc. grants.
      const fullRes = await api.get<{ success: boolean; data: string[] }>(path);
      const fullIds = Array.isArray(fullRes.data) ? fullRes.data : [];
      const legacy = fullIds.filter((id) => !ALL_LEAF_IDS.includes(id));
      const final = [...legacy, ...granted];
      await api.put(path, { nodeIds: final });
      setInitialGranted(new Set(granted));
      // If the admin just edited their own grants (or their own role's grants),
      // re-fetch /auth/me so the sidebar gating updates without a relog.
      const editingSelf = tab === 'user' && me && selectedUserId === me.id;
      if (editingSelf) await refreshAuth();
      setToast({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setToast({ kind: 'err', text: (err as Error).message || 'Save failed' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2200);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const scopeReady = tab === 'user' ? !!selectedUserId : !!selectedRole;
  const allCascadeOn = ALL_LEAF_IDS.every((id) => granted.has(id));

  return (
    <div className="auth-page-container">
      <Sidebar />
      <main className="auth-page">
        <Header />

        {/* Hero */}
        <section className="auth-hero">
          <div className="auth-hero-icon"><Shield size={26} /></div>
          <div className="auth-hero-text">
            <h1>Authorizations</h1>
            <p>Manage roles and module-level access permissions</p>
          </div>
          <div className="auth-hero-actions">
            {isSuperAdmin && (
              <button type="button" className="auth-btn outline" onClick={() => { resetSmForm(); setShowAddModal(true); }}>
                <UserPlus size={15} /> Add Ship Manager
              </button>
            )}
            <button type="button" className="auth-btn ghost" onClick={refresh} disabled={!isDirty || saving}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button type="button" className="auth-btn primary" onClick={save} disabled={!isDirty || !scopeReady || saving}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'user' ? 'active' : ''}`}
            onClick={() => setTab('user')}
          >
            User Permissions
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'role' ? 'active' : ''}`}
            onClick={() => setTab('role')}
          >
            Manage Roles
          </button>
        </div>

        {/* Filters */}
        <section className="auth-filters-card">
          {tab === 'user' ? (
            <>
              <div className="auth-field">
                <label>Filter by Role</label>
                <select value={selectedRole} onChange={(e) => { setSelectedRole(e.target.value); setSelectedUserId(''); }}>
                  <option value="">All roles</option>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="auth-field auth-field-grow" ref={dropdownRef} style={{ position: 'relative' }}>
                <label>Select User <span className="auth-field-meta">({filteredUsers.length} users)</span></label>
                <div 
                  className="custom-dropdown-trigger" 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '38px',
                    fontSize: '14px'
                  }}
                >
                  <span style={{ color: selectedUserId ? '#0f172a' : '#64748b' }}>
                    {selectedUserId 
                      ? (() => {
                          const u = users.find(x => x.id === selectedUserId);
                          return u ? `${u.name} · ${u.email || ''}` : '— Choose a user —';
                        })()
                      : '— Choose a user —'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
                </div>

                {isDropdownOpen && (
                  <div 
                    className="custom-dropdown-panel"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      marginTop: '4px',
                      maxHeight: '300px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        type="text"
                        placeholder="Search user by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        autoFocus
                      />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, maxHeight: '220px' }}>
                      <div
                        onClick={() => {
                          setSelectedUserId('');
                          setIsDropdownOpen(false);
                          setSearchTerm('');
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#64748b',
                          borderBottom: '1px solid #f1f5f9'
                        }}
                      >
                        — Choose a user —
                      </div>
                      {dropdownFilteredUsers.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                          No users found
                        </div>
                      ) : (
                        dropdownFilteredUsers.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setIsDropdownOpen(false);
                              setSearchTerm('');
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              backgroundColor: selectedUserId === u.id ? '#f1f5f9' : 'transparent',
                              borderBottom: '1px solid #f8fafc'
                            }}
                          >
                            <div style={{ fontWeight: 500, color: '#0f172a' }}>{u.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="auth-field auth-field-grow">
              <label>Select Role</label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </section>

        {/* Scope title + Expand / Collapse (kept simple — modules don't expand
            for now; the row IS the module) */}
        <section className="auth-scope-bar">
          <div className="auth-scope-title">
            <ShieldCheck size={18} />
            <div>
              <h2>{scopeLabel}</h2>
              <p>Configure module permissions</p>
            </div>
          </div>
        </section>

        {/* Quick actions — column toggles + grant-all cascade */}
        <section className="auth-quick-actions">
          <span className="auth-quick-label">Permissions:</span>
          {ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className="auth-quick-link"
              onClick={() => toggleColumn(a)}
              disabled={!scopeReady || isAutoGrantedAll}
              title={`Toggle ${ACTION_LABELS[a]} across all modules`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
          <button
            type="button"
            className={`auth-quick-link auth-quick-grant ${allCascadeOn ? 'on' : ''}`}
            onClick={() => allCascadeOn ? revokeAll() : grantAllCascade()}
            disabled={!scopeReady || isAutoGrantedAll}
          >
            <strong>All</strong> – Grant all (cascades)
          </button>
        </section>

        {/* Matrix */}
        <section className="auth-matrix-card">
          {isAutoGrantedAll && (
            <div className="auth-admin-alert" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              margin: '16px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              color: '#15803D',
              fontSize: '14px',
              fontWeight: 500
            }}>
              <ShieldCheck size={18} />
              <span>All module permissions are automatically granted and locked for Admins and Super Admins.</span>
            </div>
          )}
          <table className="auth-matrix">
            <thead>
              <tr>
                <th className="col-mod">MODULE</th>
                {ACTIONS.map((a) => (
                  <th key={a}>{ACTION_LABELS[a].toUpperCase()}</th>
                ))}
                <th>ALL</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => {
                const allOn = ACTIONS.every((a) => has(nodeId(m, a)));
                return (
                  <tr key={m.id}>
                    <td className="col-mod">
                      <div className="mod-cell">
                        <span className="mod-icon"><Shield size={16} /></span>
                        <span>{m.label}</span>
                      </div>
                    </td>
                    {ACTIONS.map((a) => {
                      const id = nodeId(m, a);
                      const on = has(id);
                      return (
                        <td key={a}>
                          <button
                            type="button"
                            className={`auth-cell ${on ? 'on' : ''}`}
                            onClick={() => toggle(id)}
                            disabled={!scopeReady || isAutoGrantedAll}
                            aria-pressed={on}
                            aria-label={`${m.label} – ${ACTION_LABELS[a]}`}
                          >
                            {on && <Check size={14} strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className={`auth-cell ${allOn ? 'on' : ''}`}
                        onClick={() => toggleModuleAll(m)}
                        disabled={!scopeReady || isAutoGrantedAll}
                        aria-pressed={allOn}
                        aria-label={`${m.label} – Grant all`}
                      >
                        {allOn && <Check size={14} strokeWidth={3} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!scopeReady && (
            <div className="auth-empty">
              {tab === 'user'
                ? 'Pick a user above to view and edit their permissions.'
                : 'Pick a role above to edit its default permission set.'}
            </div>
          )}
          {loading && <div className="auth-loading">Loading…</div>}
        </section>

        {toast && (
          <div className={`auth-toast ${toast.kind}`}>{toast.text}</div>
        )}

        {/* ── Add Ship Manager modal ─────────────────────────────────────── */}
        {showAddModal && (
          <div className="sm-modal-overlay" onClick={() => !smSaving && setShowAddModal(false)}>
            <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
              <header className="sm-modal-header">
                <div className="sm-modal-title">
                  <UserPlus size={20} />
                  <div>
                    <h3>Add Ship Manager</h3>
                    <p>Create the account, then grant module permissions on the matrix.</p>
                  </div>
                </div>
                <button type="button" className="sm-modal-close" onClick={() => !smSaving && setShowAddModal(false)} aria-label="Close">
                  <X size={18} />
                </button>
              </header>

              {/* Wrapping in a <form> with autoComplete="off" prevents
                  the browser from stuffing saved emails / passwords into
                  unrelated fields (the Country field used to render the
                  logged-in admin's email). Each input still gets a
                  precise autocomplete hint so password managers can do
                  the right thing. */}
              <form
                className="sm-modal-body"
                autoComplete="off"
                onSubmit={(e) => { e.preventDefault(); submitShipManager(); }}
              >
                <div className="sm-row sm-row-2">
                  <div className="sm-field">
                    <label htmlFor="sm-name">Full Name <span className="sm-required">*</span></label>
                    <input
                      id="sm-name"
                      name="sm-name"
                      type="text"
                      autoComplete="off"
                      value={smForm.name}
                      onChange={(e) => setSmForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Frank Shaw"
                      autoFocus
                    />
                  </div>
                  <div className="sm-field">
                    <label htmlFor="sm-email">Email <span className="sm-required">*</span></label>
                    <input
                      id="sm-email"
                      name="sm-email"
                      type="email"
                      autoComplete="off"
                      value={smForm.email}
                      onChange={(e) => setSmForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="manager@company.com"
                    />
                  </div>
                </div>
                <div className="sm-row sm-row-2">
                  <div className="sm-field">
                    <label htmlFor="sm-phone">Phone</label>
                    <input
                      id="sm-phone"
                      name="sm-phone"
                      type="tel"
                      autoComplete="off"
                      value={smForm.phone}
                      onChange={(e) => setSmForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="sm-field">
                    <label htmlFor="sm-country">Country</label>
                    <input
                      id="sm-country"
                      name="sm-country"
                      type="text"
                      autoComplete="off"
                      value={smForm.country}
                      onChange={(e) => setSmForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="India"
                    />
                  </div>
                </div>
                <div className="sm-row sm-row-2">
                  <div className="sm-field">
                    <label htmlFor="sm-password">Temporary Password <span className="sm-required">*</span></label>
                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="sm-password"
                        name="sm-password"
                        type={showSmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={smForm.password}
                        onChange={(e) => setSmForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="At least 6 characters"
                        style={{ width: '100%', paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmPassword(!showSmPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px'
                        }}
                      >
                        {showSmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="sm-field">
                    <label htmlFor="sm-confirm-password">Confirm Password <span className="sm-required">*</span></label>
                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="sm-confirm-password"
                        name="sm-confirm-password"
                        type={showSmConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={smForm.confirmPassword}
                        onChange={(e) => setSmForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Re-enter password"
                        style={{ width: '100%', paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmConfirmPassword(!showSmConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px'
                        }}
                      >
                        {showSmConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="sm-hint">
                  The Ship Manager will receive no email — share the email + temporary
                  password with them directly. They can change it once logged in.
                </p>

                {smError && <div className="sm-error">{smError}</div>}
              </form>

              <footer className="sm-modal-footer">
                <button type="button" className="auth-btn ghost" onClick={() => setShowAddModal(false)} disabled={smSaving}>
                  Cancel
                </button>
                <button type="button" className="auth-btn primary" onClick={submitShipManager} disabled={smSaving}>
                  <UserPlus size={15} /> {smSaving ? 'Creating…' : 'Create Ship Manager'}
                </button>
              </footer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
