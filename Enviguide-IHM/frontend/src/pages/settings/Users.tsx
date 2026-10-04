import { useState, useEffect, useMemo } from 'react';
import {
    Search, Plus, Edit2,
    Trash2, Filter, Download, Mail,
    Phone, Globe, Tag, FileText, AlertTriangle,
    History, Users as UsersIcon, ChevronLeft, ChevronRight, X,
    Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import { useAuth } from '../../contexts/AuthContext';
import './Users.css';

interface UserData {
    id: string;
    contactPerson: string;
    email: string;
    country: string;
    phone: string;
    status: 'Active' | 'Inactive';
    paymentStatus: 'Paid' | 'Unpaid';
    category: string;
    origin: string;
    lastActivity?: number; // days
    password?: string;
    vesselId?: string;
    shipManager?: string;
    shipOwner?: string;
    username?: string;
}

const EMPTY_FORM = {
    contactPerson: '',
    email: '',
    country: '',
    phone: '',
    status: 'Active' as const,
    paymentStatus: 'Unpaid' as const,
    category: 'Ship Owner',
    origin: 'Direct',
    password: '',
    vesselId: '',
    shipManager: '',
    shipOwner: '',
    username: ''
};

export default function Users() {
    const { user: me, hasPermission } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserData[]>([]);
    const [vesselList, setVesselList] = useState<any[]>([]);

    const fetchVessels = () => {
        api.get<{ success: boolean; data: any[] }>(ENDPOINTS.VESSELS.LIST)
            .then((res) => {
                const list = res.data || [];
                setVesselList(list);
            })
            .catch((err) => console.error('Failed to load vessels:', err));
    };

    const managerList = useMemo(() => {
        const managers = vesselList.map(v => v.shipManager).filter(Boolean);
        return Array.from(new Set(managers));
    }, [vesselList]);

    const ownerList = useMemo(() => {
        const owners = vesselList.flatMap(v => [v.shipOwner, v.registeredOwner]).filter(Boolean);
        return Array.from(new Set(owners));
    }, [vesselList]);


    const isSuperAdmin = useMemo(() => {
        if (!me) return false;
        const role = (me.roleName || me.role || '').toLowerCase();
        return role === 'superadmin' || role.includes('super');
    }, [me]);

    const isAdminOrSuper = useMemo(() => {
        if (!me) return false;
        const role = (me.roleName || me.role || '').toLowerCase();
        return role === 'superadmin' || role.includes('super') || role === 'admin' || role.includes('admin') || me.isAdmin;
    }, [me]);

    const canCreateUser = useMemo(() => {
        return isSuperAdmin;
    }, [isSuperAdmin]);

    const canUpdateUser = useMemo(() => {
        return isAdminOrSuper || hasPermission('security_update');
    }, [isAdminOrSuper, hasPermission]);

    const canDeleteUser = useMemo(() => {
        return isAdminOrSuper || hasPermission('security_delete');
    }, [isAdminOrSuper, hasPermission]);
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
    
    // Advanced Filters panel state
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterPayment, setFilterPayment] = useState('All');
    const [filterOrigin, setFilterOrigin] = useState('All');
    const [filterCountry, setFilterCountry] = useState('All');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal control states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);

    const [showAddPassword, setShowAddPassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [formData, setFormData] = useState<Omit<UserData, 'id'>>(EMPTY_FORM);
    const [bulkText, setBulkText] = useState('');
    
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalSubmitting, setModalSubmitting] = useState(false);

    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => {
            setToast(null);
        }, 4000);
    };

    // Load users directly from the MongoDB Atlas database
    const fetchUsers = () => {
        setLoading(true);
        setError(null);
        api.get<{ success: boolean; data: any[] }>(ENDPOINTS.USERS.LIST)
            .then((res) => {
                if (res.success && Array.isArray(res.data)) {
                    const mapped: UserData[] = res.data.map(u => ({
                        id: u.id,
                        contactPerson: u.name || '',
                        email: u.email || '',
                        country: u.country || '',
                        phone: u.phone || '',
                        status: u.status === 'active' ? 'Active' : 'Inactive',
                        paymentStatus: u.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
                        category: u.category || '',
                        origin: u.origin || 'Direct',
                        lastActivity: u.lastActivity || 0,
                        vesselId: u.vesselId || '',
                        shipManager: u.shipManager || '',
                        shipOwner: u.shipOwner || ''
                    }));
                    setUsers(mapped);
                } else {
                    setError('Unexpected data format received');
                }
            })
            .catch((err) => {
                console.error('Failed to load users:', err);
                setError(err.message || 'Failed to retrieve users. Please verify your connection.');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchUsers();
        fetchVessels();
    }, []);

    // Create user handler
    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isVessel = formData.category === 'Vessel';
        const isManager = formData.category === 'Ship Manager';
        const isOwner = formData.category === 'Ship Owner';
        const targetEmailOrUsername = isVessel ? formData.username : formData.email;

        // Auto-calculate name if hidden
        let nameValue = formData.contactPerson;
        if (isVessel) {
            nameValue = vesselList.find(v => v.id === formData.vesselId)?.name || 'Vessel User';
        } else if (isManager) {
            nameValue = formData.shipManager || 'Ship Manager';
        } else if (isOwner) {
            nameValue = formData.shipOwner || 'Ship Owner';
        }

        if (!nameValue || !targetEmailOrUsername) {
            setModalError('Required fields (Vessel/Manager/Owner selection or Username/Email) are missing.');
            return;
        }

        setModalSubmitting(true);
        setModalError(null);

        try {
            const payload = {
                name: nameValue,
                email: targetEmailOrUsername,
                password: formData.password || 'Envi123', // default password fallback
                country: formData.country,
                phone: isVessel ? '' : formData.phone,
                status: formData.status.toLowerCase(),
                paymentStatus: formData.paymentStatus,
                category: formData.category,
                origin: formData.origin,
                vesselId: isVessel ? formData.vesselId : undefined,
                shipManager: isManager ? formData.shipManager : undefined,
                shipOwner: isOwner ? formData.shipOwner : undefined
            };

            await api.post(ENDPOINTS.USERS.LIST, payload);
            setShowAddModal(false);
            setFormData(EMPTY_FORM);
            fetchUsers();
            showToast('success', 'User account created successfully!');
        } catch (err: any) {
            console.error('Error creating user:', err);
            const msg = err.message || 'Failed to create user.';
            if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('email')) {
                showToast('error', 'Email already registered');
            } else {
                showToast('error', msg);
            }
            setModalError(msg);
        } finally {
            setModalSubmitting(false);
        }
    };

    // Update user handler
    const handleUpdateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        const isVessel = formData.category === 'Vessel';
        const isManager = formData.category === 'Ship Manager';
        const isOwner = formData.category === 'Ship Owner';
        const targetEmailOrUsername = isVessel ? formData.username : formData.email;

        // Auto-calculate name if hidden
        let nameValue = formData.contactPerson;
        if (isVessel) {
            nameValue = vesselList.find(v => v.id === formData.vesselId)?.name || 'Vessel User';
        } else if (isManager) {
            nameValue = formData.shipManager || 'Ship Manager';
        } else if (isOwner) {
            nameValue = formData.shipOwner || 'Ship Owner';
        }

        if (!nameValue || !targetEmailOrUsername) {
            setModalError('Required fields (Vessel/Manager/Owner selection or Username/Email) are missing.');
            return;
        }

        setModalSubmitting(true);
        setModalError(null);

        try {
            const payload: Record<string, any> = {
                name: nameValue,
                email: targetEmailOrUsername,
                country: formData.country,
                phone: isVessel ? '' : formData.phone,
                status: formData.status.toLowerCase(),
                paymentStatus: formData.paymentStatus,
                category: formData.category,
                origin: formData.origin,
                vesselId: isVessel ? formData.vesselId : undefined,
                shipManager: isManager ? formData.shipManager : undefined,
                shipOwner: isOwner ? formData.shipOwner : undefined
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            await api.put(ENDPOINTS.USERS.DETAIL(selectedUser.id), payload);
            setShowEditModal(false);
            setSelectedUser(null);
            setFormData(EMPTY_FORM);
            fetchUsers();
            showToast('success', 'User account updated successfully!');
        } catch (err: any) {
            console.error('Error updating user:', err);
            const msg = err.message || 'Failed to update user.';
            if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('email')) {
                showToast('error', 'Email already registered');
            } else {
                showToast('error', msg);
            }
            setModalError(msg);
        } finally {
            setModalSubmitting(false);
        }
    };

    // Delete user handler
    const handleDeleteUserSubmit = async () => {
        if (!selectedUser) return;
        setModalSubmitting(true);
        setModalError(null);

        try {
            await api.delete(ENDPOINTS.USERS.DETAIL(selectedUser.id));
            setShowDeleteModal(false);
            setSelectedUser(null);
            fetchUsers();
            showToast('success', 'User account deleted successfully!');
        } catch (err: any) {
            console.error('Error deleting user:', err);
            showToast('error', err.message || 'Failed to delete user.');
        } finally {
            setModalSubmitting(false);
        }
    };

    // Bulk Import handler
    const handleBulkImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkText.trim()) {
            setModalError('Please enter user CSV data to import.');
            return;
        }

        setModalSubmitting(true);
        setModalError(null);

        try {
            const lines = bulkText.split('\n');
            const parsedUsers = [];
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                // Format: Name, Email, Category, Country, Phone, Status, PaymentStatus, Origin
                const [name, email, category, country, phone, status, paymentStatus, origin] = line.split(',').map(s => s?.trim() || '');
                if (name && email) {
                    parsedUsers.push({
                        name,
                        email,
                        category: category || 'Ship Owner',
                        country: country || '',
                        phone: phone || '',
                        status: (status || 'active').toLowerCase(),
                        paymentStatus: paymentStatus || 'Unpaid',
                        origin: origin || 'Direct'
                    });
                }
            }

            if (parsedUsers.length === 0) {
                throw new Error('No valid user records found in the pasted data. Check formatting: Name,Email');
            }

            await api.post('/users/bulk', { users: parsedUsers });
            setShowBulkModal(false);
            setBulkText('');
            fetchUsers();
        } catch (err: any) {
            console.error('Error importing bulk users:', err);
            setModalError(err.message || 'Failed to import users. Check formatting.');
        } finally {
            setModalSubmitting(false);
        }
    };

    // CSV Download Report generator
    const handleDownloadReport = () => {
        if (filteredUsers.length === 0) {
            setError('No user records match current filters to export.');
            return;
        }

        const headers = ['Contact Person', 'Email', 'Category', 'Country', 'Phone', 'Status', 'Payment Status', 'Origin'];
        const csvRows = [headers.join(',')];

        filteredUsers.forEach(u => {
            const values = [
                `"${u.contactPerson.replace(/"/g, '""')}"`,
                `"${u.email.replace(/"/g, '""')}"`,
                `"${u.category.replace(/"/g, '""')}"`,
                `"${u.country.replace(/"/g, '""')}"`,
                `"${u.phone.replace(/"/g, '""')}"`,
                `"${u.status}"`,
                `"${u.paymentStatus}"`,
                `"${u.origin}"`
            ];
            csvRows.push(values.join(','));
        });

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `user_accounts_report_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const openAddModal = () => {
        setFormData(EMPTY_FORM);
        setModalError(null);
        setShowAddPassword(false);
        setShowAddModal(true);
    };

    const openEditModal = (user: UserData) => {
        const isVessel = user.category === 'Vessel';
        setSelectedUser(user);
        setFormData({
            contactPerson: user.contactPerson,
            email: isVessel ? '' : user.email,
            country: user.country,
            phone: user.phone,
            status: user.status,
            paymentStatus: user.paymentStatus,
            category: user.category,
            origin: user.origin,
            password: '',
            vesselId: user.vesselId || '',
            shipManager: user.shipManager || '',
            shipOwner: user.shipOwner || '',
            username: isVessel ? user.email : ''
        });
        setModalError(null);
        setShowEditPassword(false);
        setShowEditModal(true);
    };

    const openDeleteModal = (user: UserData) => {
        setSelectedUser(user);
        setModalError(null);
        setShowDeleteModal(true);
    };

    const openDetailModal = (user: UserData) => {
        setSelectedUser(user);
        setShowDetailModal(true);
    };

    const openBulkModal = () => {
        setBulkText('');
        setModalError(null);
        setShowBulkModal(true);
    };

    // In-memory searching, sorting and multi-field filtering
    const filteredUsers = users.filter(user => {
        // Search Term matches
        const matchesSearch =
            (user.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.category || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Quick Status Toolbar filter
        const matchesStatus = filterStatus === 'All' || user.status === filterStatus;

        // Advanced filter selectors
        const matchesCategory = filterCategory === 'All' || user.category === filterCategory;
        const matchesPayment = filterPayment === 'All' || user.paymentStatus === filterPayment;
        const matchesOrigin = filterOrigin === 'All' || user.origin === filterOrigin;
        const matchesCountry = filterCountry === 'All' || user.country === filterCountry;

        return matchesSearch && matchesStatus && matchesCategory && matchesPayment && matchesOrigin && matchesCountry;
    });

    // Unique countries listed in current users to populate country filter dynamically
    const uniqueCountries = Array.from(new Set(users.map(u => u.country).filter(Boolean)));

    return (
        <div className="users-page-container">
            <Sidebar />
            <main className="users-page-main">
                <Header notificationCount={users.filter(u => u.status === 'Inactive').length} />

                <div className="users-content-wrapper">
                    {/* Hero header card */}
                    <div className="users-hero-card">
                        <div className="hero-left">
                            <div className="hero-icon">
                                <UsersIcon size={26} />
                            </div>
                            <div className="hero-text">
                                <h1>User Management</h1>
                                <p>Manage roles, registration details, and payment statuses for contact persons.</p>
                            </div>
                        </div>
                        <div className="hero-actions">
                            {canCreateUser && (
                                <>
                                    <button className="btn-bulk" onClick={openBulkModal}>
                                        <FileText size={18} />
                                        <span>Bulk Import</span>
                                    </button>
                                    <button className="btn-add" onClick={openAddModal}>
                                        <Plus size={18} />
                                        <span>Add New User</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="users-main-card">
                        <div className="users-toolbar">
                            <div className="users-search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email or category..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="toolbar-groups">
                                <div className="status-toggle">
                                    <button
                                        className={filterStatus === 'All' ? 'active' : ''}
                                        onClick={() => setFilterStatus('All')}
                                    >
                                        All
                                    </button>
                                    <button
                                        className={filterStatus === 'Active' ? 'active' : ''}
                                        onClick={() => setFilterStatus('Active')}
                                    >
                                        Active
                                    </button>
                                    <button
                                        className={filterStatus === 'Inactive' ? 'active' : ''}
                                        onClick={() => setFilterStatus('Inactive')}
                                    >
                                        Inactive
                                    </button>
                                </div>

                                <button className="btn-icon" onClick={fetchUsers} title="Refresh Data">
                                    <History size={18} />
                                </button>
                                <button 
                                    className={`btn-icon ${showFiltersPanel ? 'active' : ''}`} 
                                    onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                                    title="Advanced Filters"
                                    style={{
                                        borderColor: showFiltersPanel ? '#00B2FF' : undefined,
                                        backgroundColor: showFiltersPanel ? '#F0F9FF' : undefined,
                                        color: showFiltersPanel ? '#00B2FF' : undefined
                                    }}
                                >
                                    <Filter size={18} />
                                </button>
                                <button className="btn-icon" onClick={handleDownloadReport} title="Export CSV Report">
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Advanced Filters Panel */}
                        {showFiltersPanel && (
                            <div className="filters-panel" style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #F1F5F9',
                                background: '#FAFCFF',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '16px',
                                animation: 'fadeIn 0.2s ease-out'
                            }}>
                                <div className="form-group">
                                    <label style={{fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4}}>Category Filter</label>
                                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white'}}>
                                        <option value="All">All Categories</option>
                                        <option value="Super Admin">Super Admin</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Ship Owner">Ship Owner</option>
                                        <option value="Ship Manager">Ship Manager</option>
                                        <option value="Vessel">Vessel</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4}}>Payment Status</label>
                                    <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} style={{padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white'}}>
                                        <option value="All">All Statuses</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Unpaid">Unpaid</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4}}>Origin Partner</label>
                                    <select value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)} style={{padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white'}}>
                                        <option value="All">All Origins</option>
                                        <option value="Direct">Direct</option>
                                        <option value="Partner">Partner</option>
                                        <option value="System">System</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4}}>Country</label>
                                    <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} style={{padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0', background: 'white'}}>
                                        <option value="All">All Countries</option>
                                        {uniqueCountries.map(country => (
                                            <option key={country} value={country}>{country}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{ padding: '20px 24px', color: '#EF4444', fontWeight: 600, fontSize: '13px' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="table-responsive">
                            {loading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                                    Loading users from database...
                                </div>
                            ) : (
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th className="sticky-col">Action</th>
                                            <th>Contact Person</th>
                                            <th>Registration Details</th>
                                            <th>Status</th>
                                            <th>Payment</th>
                                            <th>Category</th>
                                            <th>Last Activity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map(user => (
                                            <tr key={user.id}>
                                                <td className="sticky-col">
                                                    <div className="action-btns">
                                                        {canUpdateUser && (
                                                            <button className="btn-edit" title="Edit User" onClick={() => openEditModal(user)}>
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                        <button className="btn-history" title="View Details Card" onClick={() => openDetailModal(user)}>
                                                            <History size={14} />
                                                        </button>
                                                        {canDeleteUser && (
                                                            <button className="btn-delete" title="Delete User" onClick={() => openDeleteModal(user)}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="person-cell">
                                                        <div className="avatar-mini">
                                                            {(user.contactPerson || 'U').charAt(0)}
                                                        </div>
                                                        <div className="person-info">
                                                            <span className="person-name">{user.contactPerson}</span>
                                                            <div className="person-sub">
                                                                {user.category === 'Vessel' ? <UsersIcon size={12} /> : <Mail size={12} />}
                                                                <span>{user.email}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="meta-cell">
                                                        <div className="meta-item">
                                                            <Globe size={12} />
                                                            <span>{user.country || 'N/A'}</span>
                                                        </div>
                                                        <div className="meta-item">
                                                            <Phone size={12} />
                                                            <span>{user.category === 'Vessel' ? '—' : (user.phone || 'N/A')}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge-status ${user.status.toLowerCase()}`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge-payment ${user.paymentStatus.toLowerCase()}`}>
                                                        {user.paymentStatus}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="category-cell">
                                                        <Tag size={12} className="tag-icon" />
                                                        <span>{user.category || 'Viewer'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={`activity-cell ${user.lastActivity && user.lastActivity > 365 ? 'overdue' : ''}`}>
                                                        {user.lastActivity && user.lastActivity > 365 && <AlertTriangle size={14} />}
                                                        <span>{user.lastActivity ? `${user.lastActivity} days ago` : 'Never'}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                                                    No users found matching current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="table-footer">
                            <span className="count-text">Showing <b>{filteredUsers.length}</b> of {users.length} contact persons</span>
                            <div className="pagination">
                                <button className="prev" disabled aria-label="Previous page">
                                    <ChevronLeft size={14} />
                                </button>
                                <button className="page-num active">1</button>
                                <button className="next" disabled aria-label="Next page">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── ADD USER MODAL ── */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>Add New User Account</h3>
                            <button className="btn-icon" onClick={() => setShowAddModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUserSubmit}>
                            <div className="modal-body">
                                {modalError && <div className="error-banner">{modalError}</div>}
                                
                                <div className="form-group">
                                    <label>Category (Role) *</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        required
                                    >
                                        <option value="Super Admin">Super Admin</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Ship Owner">Ship Owner</option>
                                        <option value="Ship Manager">Ship Manager</option>
                                        <option value="Vessel">Vessel</option>
                                    </select>
                                </div>

                                {formData.category === 'Vessel' && (
                                    <div className="form-group">
                                        <label>Select Vessel *</label>
                                        <select
                                            value={formData.vesselId}
                                            onChange={(e) => {
                                                const v = vesselList.find(x => x.id === e.target.value);
                                                setFormData({ 
                                                    ...formData, 
                                                    vesselId: e.target.value,
                                                    contactPerson: v ? v.name : formData.contactPerson,
                                                    username: v ? String(v.name).toLowerCase().replace(/\s+/g, '-') : formData.username
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">-- Select Vessel --</option>
                                            {vesselList.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} (IMO: {v.imoNumber})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formData.category === 'Ship Manager' && (
                                    <div className="form-group">
                                        <label>Select Ship Manager *</label>
                                        <select
                                            value={formData.shipManager}
                                            onChange={(e) => setFormData({ ...formData, shipManager: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Ship Manager --</option>
                                            {managerList.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formData.category === 'Ship Owner' && (
                                    <div className="form-group">
                                        <label>Select Ship Owner *</label>
                                        <select
                                            value={formData.shipOwner}
                                            onChange={(e) => setFormData({ ...formData, shipOwner: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Ship Owner --</option>
                                            {ownerList.map(o => (
                                                <option key={o} value={o}>{o}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(formData.category === 'Super Admin' || formData.category === 'Admin') && (
                                    <div className="form-group">
                                        <label>Contact Person Name *</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. John Doe"
                                            value={formData.contactPerson}
                                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                {formData.category === 'Vessel' ? (
                                    <div className="form-group">
                                        <label>Username (for login) *</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. mv-ocean-pioneer"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Email Address *</label>
                                        <input
                                            type="email"
                                            placeholder="john.doe@company.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Password (Default: Envi123)</label>
                                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type={showAddPassword ? 'text' : 'password'}
                                            placeholder="Min 6 characters"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            style={{ width: '100%', paddingRight: '40px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAddPassword(!showAddPassword)}
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
                                            {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Country</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Netherlands"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>

                                {formData.category !== 'Vessel' && (
                                    <div className="form-group">
                                        <label>Phone Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. +31 6 12345678"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Origin</label>
                                    <select
                                        value={formData.origin}
                                        onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                    >
                                        <option value="Direct">Direct</option>
                                        <option value="Partner">Partner</option>
                                        <option value="System">System</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select
                                        value={formData.paymentStatus}
                                        onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'Paid' | 'Unpaid' })}
                                    >
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Paid">Paid</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Account Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-modal-cancel" onClick={() => setShowAddModal(false)} disabled={modalSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-modal-submit" disabled={modalSubmitting}>
                                    {modalSubmitting ? 'Adding...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── EDIT USER MODAL ── */}
            {showEditModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>Edit User Account: {selectedUser.contactPerson}</h3>
                            <button className="btn-icon" onClick={() => setShowEditModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateUserSubmit}>
                            <div className="modal-body">
                                {modalError && <div className="error-banner">{modalError}</div>}
                                
                                <div className="form-group">
                                    <label>Category (Role) *</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        required
                                    >
                                        <option value="Super Admin">Super Admin</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Ship Owner">Ship Owner</option>
                                        <option value="Ship Manager">Ship Manager</option>
                                        <option value="Vessel">Vessel</option>
                                    </select>
                                </div>

                                {formData.category === 'Vessel' && (
                                    <div className="form-group">
                                        <label>Select Vessel *</label>
                                        <select
                                            value={formData.vesselId}
                                            onChange={(e) => {
                                                const v = vesselList.find(x => x.id === e.target.value);
                                                setFormData({ 
                                                    ...formData, 
                                                    vesselId: e.target.value,
                                                    contactPerson: v ? v.name : formData.contactPerson,
                                                    username: v ? String(v.name).toLowerCase().replace(/\s+/g, '-') : formData.username
                                                });
                                            }}
                                            required
                                        >
                                            <option value="">-- Select Vessel --</option>
                                            {vesselList.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} (IMO: {v.imoNumber})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formData.category === 'Ship Manager' && (
                                    <div className="form-group">
                                        <label>Select Ship Manager *</label>
                                        <select
                                            value={formData.shipManager}
                                            onChange={(e) => setFormData({ ...formData, shipManager: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Ship Manager --</option>
                                            {managerList.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formData.category === 'Ship Owner' && (
                                    <div className="form-group">
                                        <label>Select Ship Owner *</label>
                                        <select
                                            value={formData.shipOwner}
                                            onChange={(e) => setFormData({ ...formData, shipOwner: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select Ship Owner --</option>
                                            {ownerList.map(o => (
                                                <option key={o} value={o}>{o}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(formData.category === 'Super Admin' || formData.category === 'Admin') && (
                                    <div className="form-group">
                                        <label>Contact Person Name *</label>
                                        <input
                                            type="text"
                                            value={formData.contactPerson}
                                            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                {formData.category === 'Vessel' ? (
                                    <div className="form-group">
                                        <label>Username (for login) *</label>
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Email Address *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>New Password (Leave blank to keep current)</label>
                                    <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type={showEditPassword ? 'text' : 'password'}
                                            placeholder="Enter new password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            style={{ width: '100%', paddingRight: '40px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEditPassword(!showEditPassword)}
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
                                            {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Country</label>
                                    <input
                                        type="text"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>

                                {formData.category !== 'Vessel' && (
                                    <div className="form-group">
                                        <label>Phone Number</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Origin</label>
                                    <select
                                        value={formData.origin}
                                        onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                    >
                                        <option value="Direct">Direct</option>
                                        <option value="Partner">Partner</option>
                                        <option value="System">System</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Payment Status</label>
                                    <select
                                        value={formData.paymentStatus}
                                        onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'Paid' | 'Unpaid' })}
                                    >
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Paid">Paid</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Account Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-modal-cancel" onClick={() => setShowEditModal(false)} disabled={modalSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-modal-submit" disabled={modalSubmitting}>
                                    {modalSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── DELETE USER MODAL ── */}
            {showDeleteModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>Confirm Deletion</h3>
                            <button className="btn-icon" onClick={() => setShowDeleteModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {modalError && <div className="error-banner">{modalError}</div>}
                            <p style={{ fontSize: '14px', color: '#475569', margin: 0, textAlign: 'left' }}>
                                Are you sure you want to delete the user account for <b>{selectedUser.contactPerson}</b>?
                            </p>
                            <p style={{ fontSize: '12px', color: '#EF4444', margin: 0, fontWeight: 600, textAlign: 'left' }}>
                                Warning: This action is permanent and cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-modal-cancel" onClick={() => setShowDeleteModal(false)} disabled={modalSubmitting}>
                                Cancel
                            </button>
                            <button className="btn-modal-delete" onClick={handleDeleteUserSubmit} disabled={modalSubmitting}>
                                {modalSubmitting ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── USER DETAIL CARD MODAL ── */}
            {showDetailModal && selectedUser && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header" style={{background: 'linear-gradient(135deg, #00B2FF 0%, #0099e0 100%)', color: 'white'}}>
                            <h3 style={{color: 'white'}}>User Profile Details</h3>
                            <button className="btn-icon" onClick={() => setShowDetailModal(false)} style={{border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white'}}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body" style={{padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
                            
                            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                                <div style={{width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #DBEAFE, #F0F9FF)', color: '#0099e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800'}}>
                                    {selectedUser.contactPerson.charAt(0)}
                                </div>
                                <div style={{textAlign: 'left'}}>
                                    <h2 style={{margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0F172A'}}>{selectedUser.contactPerson}</h2>
                                    <span style={{padding: '4px 8px', background: '#F1F5F9', borderRadius: '6px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase'}}>{selectedUser.category}</span>
                                </div>
                            </div>

                            <hr style={{border: 'none', borderBottom: '1px solid #F1F5F9', margin: '0'}} />

                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left'}}>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>User ID</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600, wordBreak: 'break-all'}}>{selectedUser.id}</p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Email Address</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600}}>{selectedUser.email}</p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Country</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600}}>{selectedUser.country || 'N/A'}</p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Phone Number</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600}}>{selectedUser.phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Account Status</span>
                                    <p style={{margin: '4px 0 0 0'}}>
                                        <span className={`badge-status ${selectedUser.status.toLowerCase()}`}>{selectedUser.status}</span>
                                    </p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Payment Status</span>
                                    <p style={{margin: '4px 0 0 0'}}>
                                        <span className={`badge-payment ${selectedUser.paymentStatus.toLowerCase()}`}>{selectedUser.paymentStatus}</span>
                                    </p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Partner Origin</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600}}>{selectedUser.origin}</p>
                                </div>
                                <div>
                                    <span style={{fontSize: '10px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase'}}>Last Activity</span>
                                    <p style={{margin: '4px 0 0 0', fontSize: '13px', color: '#334155', fontWeight: 600}}>{selectedUser.lastActivity ? `${selectedUser.lastActivity} days ago` : 'Never'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{background: '#F8FAFC'}}>
                            <button className="btn-modal-cancel" onClick={() => setShowDetailModal(false)}>
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── BULK IMPORT MODAL ── */}
            {showBulkModal && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{maxWidth: '640px'}}>
                        <div className="modal-header">
                            <h3>Bulk Import User Accounts</h3>
                            <button className="btn-icon" onClick={() => setShowBulkModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleBulkImportSubmit}>
                            <div className="modal-body">
                                {modalError && <div className="error-banner">{modalError}</div>}
                                
                                <p style={{fontSize: '13px', color: '#64748B', margin: '0 0 8px 0', textAlign: 'left'}}>
                                    Enter user records (one per line) formatted as comma-separated values (CSV). 
                                    A default password (<b>Envi123</b>) will be hashed and assigned to all imported users automatically.
                                </p>
                                
                                <div style={{padding: '10px 14px', background: '#F1F5F9', borderRadius: '8px', fontSize: '11px', color: '#475569', fontFamily: 'monospace', textAlign: 'left', marginBottom: '12px'}}>
                                    Format: <b>Name, Email, Category, Country, Phone, Status, PaymentStatus, Origin</b>
                                    <br />
                                    Example: <i>Bindhiya Rajendran, bindhya@gmail.com, Certified hazmat Companies, India, 9585936420, Active, Paid, Direct</i>
                                </div>

                                <div className="form-group">
                                    <label>CSV Records *</label>
                                    <textarea
                                        rows={8}
                                        placeholder="Name, Email, Category, Country, Phone&#10;Alice Doe, alice@company.com, Manager, Germany, +49170283&#10;Bob Smith, bob@shipowner.com, Ship Owner, Norway, +479023482"
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        required
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #E2E8F0',
                                            fontSize: '13px',
                                            background: '#F8FAFC',
                                            color: '#0F172A',
                                            width: '100%',
                                            fontFamily: 'monospace',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-modal-cancel" onClick={() => setShowBulkModal(false)} disabled={modalSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-modal-submit" disabled={modalSubmitting}>
                                    {modalSubmitting ? 'Importing...' : 'Import User Records'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div className="toast-centered" style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
                    color: toast.type === 'error' ? '#991B1B' : '#065F46',
                    border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
                    padding: '16px 28px',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 600,
                    fontSize: '15px',
                    pointerEvents: 'none'
                }}>
                    {toast.type === 'error' ? (
                        <AlertTriangle size={20} color="#EF4444" />
                    ) : (
                        <CheckCircle2 size={20} color="#10B981" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
