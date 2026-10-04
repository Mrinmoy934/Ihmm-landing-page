import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, Download, Briefcase, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import './Ownership.css';

interface OwnershipItem {
    id?: string;
    ownerName: string;
    contactPerson: string;
    email: string;
    totalVessels: number;
    headquarters: string;
}

export default function Ownership() {
    const [search, setSearch] = useState('');
    const [owners, setOwners] = useState<OwnershipItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Owner
    const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
    const [currentOwner, setCurrentOwner] = useState<OwnershipItem | null>(null);
    const [ownerForm, setOwnerForm] = useState({
        ownerName: '',
        contactPerson: '',
        email: '',
        totalVessels: 0,
        headquarters: ''
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchOwners = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: OwnershipItem[] }>('/ownership');
            if (res.success) {
                setOwners(res.data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch ownership records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOwners();
    }, []);

    // Filter owners
    const filteredOwners = owners.filter(o => 
        o.ownerName.toLowerCase().includes(search.toLowerCase()) || 
        o.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        o.email.toLowerCase().includes(search.toLowerCase()) ||
        o.headquarters.toLowerCase().includes(search.toLowerCase())
    );

    // Submit Add/Edit
    const handleOwnerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentOwner && currentOwner.id) {
                // Update
                const res = await api.put<{ success: boolean; data: OwnershipItem }>(
                    `/ownership/${currentOwner.id}`,
                    ownerForm
                );
                if (res.success) {
                    setOwners(owners.map(o => o.id === currentOwner.id ? res.data : o));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: OwnershipItem }>(
                    '/ownership',
                    ownerForm
                );
                if (res.success) {
                    setOwners([res.data, ...owners]);
                }
            }
            setIsOwnerModalOpen(false);
            setCurrentOwner(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving ownership details');
        }
    };

    const resetForm = () => {
        setOwnerForm({
            ownerName: '',
            contactPerson: '',
            email: '',
            totalVessels: 0,
            headquarters: ''
        });
    };

    const handleEditClick = (owner: OwnershipItem) => {
        setCurrentOwner(owner);
        setOwnerForm({
            ownerName: owner.ownerName,
            contactPerson: owner.contactPerson,
            email: owner.email,
            totalVessels: owner.totalVessels,
            headquarters: owner.headquarters
        });
        setIsOwnerModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this ownership record?')) return;
        try {
            await api.delete(`/ownership/${id}`);
            setOwners(owners.filter(o => o.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete ownership record');
        }
    };

    // Open email send
    const handleSendClick = (owner: OwnershipItem) => {
        setEmailForm({
            to: owner.email,
            subject: `Fleet Inquiry - ${owner.ownerName}`,
            body: `Dear ${owner.contactPerson},\n\nWe are reviewing the technical safety records for your vessels.\nPlease confirm the registered manager details at your earliest convenience.\n\nBest regards,\nIHM Administration`
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
        if (filteredOwners.length === 0) return;
        const headers = ['Owner Name', 'Contact Person', 'Email Address', 'Vessels Owned', 'Headquarters'];
        const keys = ['ownerName', 'contactPerson', 'email', 'totalVessels', 'headquarters'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredOwners as any[]) {
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
        link.setAttribute('download', `vessel_ownership_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / REGISTERED OWNER</div>
                            <h1>Registered Owner</h1>
                            <p>Manage and track shipping companies and registered vessel owners.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredOwners.length === 0}>
                                <Download size={16} /> Export List
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentOwner(null); resetForm(); setIsOwnerModalOpen(true); }}>
                                <Plus size={18} /> Add New Owner
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search owners by name, contact or headquarters..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> Regions</button>
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Owner Name</th>
                                        <th>Contact Person</th>
                                        <th>Email Address</th>
                                        <th>Vessels Owned</th>
                                        <th>Headquarters</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading owner records from database...</td>
                                        </tr>
                                    ) : filteredOwners.map((owner) => (
                                        <tr key={owner.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(owner)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(owner)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => owner.id && handleDeleteClick(owner.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">{owner.ownerName}</td>
                                            <td>{owner.contactPerson}</td>
                                            <td className="email-cell" onClick={() => handleSendClick(owner)}>{owner.email}</td>
                                            <td className="vessel-count-cell">
                                                <div className="vessel-indicator">
                                                    <Briefcase size={14} /> {owner.totalVessels}
                                                </div>
                                            </td>
                                            <td>{owner.headquarters}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredOwners.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No owners found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredOwners.length} ownership records</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Owner Add/Edit Modal */}
            {isOwnerModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentOwner ? 'Edit Owner Details' : 'Add New Owner'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsOwnerModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleOwnerSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Owner Company Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Thor Shipping Limited"
                                        value={ownerForm.ownerName} 
                                        onChange={(e) => setOwnerForm({ ...ownerForm, ownerName: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Contact Person *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Erik Thorson"
                                        value={ownerForm.contactPerson} 
                                        onChange={(e) => setOwnerForm({ ...ownerForm, contactPerson: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email Address *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. erik.t@thorshipping.com"
                                        value={ownerForm.email} 
                                        onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} 
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Vessels Owned</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            placeholder="e.g. 12"
                                            value={ownerForm.totalVessels} 
                                            onChange={(e) => setOwnerForm({ ...ownerForm, totalVessels: parseInt(e.target.value) || 0 })} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Headquarters</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Oslo, Norway"
                                            value={ownerForm.headquarters} 
                                            onChange={(e) => setOwnerForm({ ...ownerForm, headquarters: e.target.value })} 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsOwnerModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Owner</button>
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
                            <h2>Send Fleet Inquiry Email</h2>
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
