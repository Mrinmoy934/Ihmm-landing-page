import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, Download, UserCheck, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import './Ownership.css'; // Reusing established styles

interface ManagerItem {
    id?: string;
    managerName: string;
    responsiblePerson: string;
    email: string;
    vesselsManaged: number;
    officeLocation: string;
}

export default function OwnershipManager() {
    const [search, setSearch] = useState('');
    const [managers, setManagers] = useState<ManagerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Manager
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [currentManager, setCurrentManager] = useState<ManagerItem | null>(null);
    const [managerForm, setManagerForm] = useState({
        managerName: '',
        responsiblePerson: '',
        email: '',
        vesselsManaged: 0,
        officeLocation: ''
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchManagers = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: ManagerItem[] }>('/ownership-manager');
            if (res.success) {
                setManagers(res.data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch ownership managers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManagers();
    }, []);

    // Filter managers
    const filteredManagers = managers.filter(m => 
        m.managerName.toLowerCase().includes(search.toLowerCase()) || 
        m.responsiblePerson.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        m.officeLocation.toLowerCase().includes(search.toLowerCase())
    );

    // Add / Edit Submission
    const handleManagerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentManager && currentManager.id) {
                // Update
                const res = await api.put<{ success: boolean; data: ManagerItem }>(
                    `/ownership-manager/${currentManager.id}`,
                    managerForm
                );
                if (res.success) {
                    setManagers(managers.map(m => m.id === currentManager.id ? res.data : m));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: ManagerItem }>(
                    '/ownership-manager',
                    managerForm
                );
                if (res.success) {
                    setManagers([res.data, ...managers]);
                }
            }
            setIsManagerModalOpen(false);
            setCurrentManager(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving manager details');
        }
    };

    const resetForm = () => {
        setManagerForm({
            managerName: '',
            responsiblePerson: '',
            email: '',
            vesselsManaged: 0,
            officeLocation: ''
        });
    };

    const handleEditClick = (manager: ManagerItem) => {
        setCurrentManager(manager);
        setManagerForm({
            managerName: manager.managerName,
            responsiblePerson: manager.responsiblePerson,
            email: manager.email,
            vesselsManaged: manager.vesselsManaged,
            officeLocation: manager.officeLocation
        });
        setIsManagerModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this management record?')) return;
        try {
            await api.delete(`/ownership-manager/${id}`);
            setManagers(managers.filter(m => m.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete management record');
        }
    };

    // Open email send
    const handleSendClick = (manager: ManagerItem) => {
        setEmailForm({
            to: manager.email,
            subject: `IHM Compliance Notification - ${manager.managerName}`,
            body: `Dear ${manager.responsiblePerson},\n\nThis is a standard verification regarding the IHM status for the vessels under your management.\nWe require the latest SDoC and MD certificates for the equipment installed.\n\nBest regards,\nCompliance Department`
        });
        setIsEmailModalOpen(true);
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/send-email', emailForm);
            alert('Email sent successfully!');
            setIsEmailModalOpen(false);
        } catch (err: any) {
            alert(err.message || 'Failed to send email');
        }
    };

    // Export CSV
    const handleExport = () => {
        if (filteredManagers.length === 0) return;
        const headers = ['Manager Name', 'Responsible Person', 'Email Address', 'Vessels Managed', 'Office Location'];
        const keys = ['managerName', 'responsiblePerson', 'email', 'vesselsManaged', 'officeLocation'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredManagers as any[]) {
            const values = keys.map(k => {
                const val = row[k] !== undefined && row[k] !== null ? row[k] : '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ownership_managers_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="registered-container">
            <Sidebar />
            <main className="registered-main">
                <Header />
                <div className="registered-content">
                    <div className="page-header-standard">
                        <div className="header-title-area">
                            <div className="breadcrumb-mini">MENU / SHIP MANAGER</div>
                            <h1>Ship Manager</h1>
                            <p>Manage and track technical and commercial vessel management entities.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredManagers.length === 0}>
                                <Download size={16} /> Export
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentManager(null); resetForm(); setIsManagerModalOpen(true); }}>
                                <Plus size={18} /> Add Manager
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search managers by name, email or office..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> All Regions</button>
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Manager Name</th>
                                        <th>Responsible Person</th>
                                        <th>Email</th>
                                        <th>Vessels Managed</th>
                                        <th>Office Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading manager records from database...</td>
                                        </tr>
                                    ) : filteredManagers.map((m) => (
                                        <tr key={m.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(m)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(m)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => m.id && handleDeleteClick(m.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">{m.managerName}</td>
                                            <td>{m.responsiblePerson}</td>
                                            <td className="email-cell" onClick={() => handleSendClick(m)}>{m.email}</td>
                                            <td className="vessel-count-cell">
                                                <div className="vessel-indicator">
                                                    <UserCheck size={14} /> {m.vesselsManaged}
                                                </div>
                                            </td>
                                            <td>{m.officeLocation}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredManagers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No managers found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredManagers.length} management records</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Manager Add/Edit Modal */}
            {isManagerModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentManager ? 'Edit Manager Details' : 'Add New Manager'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsManagerModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleManagerSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Manager Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Bernhard Schulte Shipmanagement"
                                        value={managerForm.managerName} 
                                        onChange={(e) => setManagerForm({ ...managerForm, managerName: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Responsible Person *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Klaus Schmidt"
                                        value={managerForm.responsiblePerson} 
                                        onChange={(e) => setManagerForm({ ...managerForm, responsiblePerson: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email Address *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. k.schmidt@bs-shipmanagement.com"
                                        value={managerForm.email} 
                                        onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })} 
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Vessels Managed</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            placeholder="e.g. 32"
                                            value={managerForm.vesselsManaged} 
                                            onChange={(e) => setManagerForm({ ...managerForm, vesselsManaged: parseInt(e.target.value) || 0 })} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Office Location</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Limassol, Cyprus"
                                            value={managerForm.officeLocation} 
                                            onChange={(e) => setManagerForm({ ...managerForm, officeLocation: e.target.value })} 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsManagerModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Manager</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Email Send Modal */}
            {isEmailModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>Send Management Inquiry</h2>
                            <button className="modal-close-btn" onClick={() => setIsEmailModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEmailSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Recipient Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        value={emailForm.to} 
                                        onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Subject *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={emailForm.subject} 
                                        onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Message Body *</label>
                                    <textarea 
                                        required 
                                        value={emailForm.body} 
                                        onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsEmailModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard"><Send size={14} /> Send Email</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
