import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Download, X, AlertTriangle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import '../auth/Registered.css'; 

interface SuspendedItem {
    id?: string;
    vesselName: string;
    imoNumber: string;
    suspensionDate: string;
    reason: string;
    suspendedBy: string;
}

export default function Suspended() {
    const [search, setSearch] = useState('');
    const [suspendedList, setSuspendedList] = useState<SuspendedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Suspended Vessel
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSuspension, setCurrentSuspension] = useState<SuspendedItem | null>(null);
    const [form, setForm] = useState({
        vesselName: '',
        imoNumber: '',
        suspensionDate: '',
        reason: '',
        suspendedBy: 'IHM Authority'
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchSuspensions = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: SuspendedItem[] }>('/suspended');
            if (res.success) {
                setSuspendedList(res.data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch suspended vessels');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuspensions();
    }, []);

    // Filter list
    const filteredSuspensions = suspendedList.filter(s => 
        s.vesselName.toLowerCase().includes(search.toLowerCase()) || 
        s.imoNumber.includes(search) ||
        s.reason.toLowerCase().includes(search.toLowerCase()) ||
        s.suspendedBy.toLowerCase().includes(search.toLowerCase())
    );

    // Submit Add/Edit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentSuspension && currentSuspension.id) {
                // Update
                const res = await api.put<{ success: boolean; data: SuspendedItem }>(
                    `/suspended/${currentSuspension.id}`,
                    form
                );
                if (res.success) {
                    setSuspendedList(suspendedList.map(s => s.id === currentSuspension.id ? res.data : s));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: SuspendedItem }>(
                    '/suspended',
                    form
                );
                if (res.success) {
                    setSuspendedList([res.data, ...suspendedList]);
                }
            }
            setIsModalOpen(false);
            setCurrentSuspension(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving suspension details');
        }
    };

    const resetForm = () => {
        setForm({
            vesselName: '',
            imoNumber: '',
            suspensionDate: '',
            reason: '',
            suspendedBy: 'IHM Authority'
        });
    };

    const handleEditClick = (item: SuspendedItem) => {
        setCurrentSuspension(item);
        setForm({
            vesselName: item.vesselName,
            imoNumber: item.imoNumber,
            suspensionDate: item.suspensionDate,
            reason: item.reason,
            suspendedBy: item.suspendedBy
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this suspension record?')) return;
        try {
            await api.delete(`/suspended/${id}`);
            setSuspendedList(suspendedList.filter(s => s.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete suspension record');
        }
    };

    // Open email send
    const handleSendClick = (item: SuspendedItem) => {
        setEmailForm({
            to: '',
            subject: `Urgent: IHM Certification Suspended for IMO ${item.imoNumber}`,
            body: `Dear Vessel Operations,\n\nPlease be notified that the compliance status of vessel "${item.vesselName}" (IMO: ${item.imoNumber}) has been Suspended by ${item.suspendedBy}.\n\nSuspension Date: ${item.suspensionDate}\nReason: ${item.reason}\n\nPlease take immediate actions to rectify the certification.\n\nBest regards,\nIHM Audit Committee`
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
        if (filteredSuspensions.length === 0) return;
        const headers = ['Vessel Name', 'IMO Number', 'Suspension Date', 'Reason', 'Suspended By'];
        const keys = ['vesselName', 'imoNumber', 'suspensionDate', 'reason', 'suspendedBy'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredSuspensions as any[]) {
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
        link.setAttribute('download', `suspended_vessels_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / SUSPENDED</div>
                            <h1>Suspended Vessels</h1>
                            <p>Directory of vessels whose IHM compliance has been suspended or flag status restricted.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredSuspensions.length === 0}>
                                <Download size={16} /> Export List
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentSuspension(null); resetForm(); setIsModalOpen(true); }}>
                                <Plus size={18} /> Add Suspension
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search by name, IMO, reason or authority..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Vessel Name</th>
                                        <th>IMO Number</th>
                                        <th>Suspension Date</th>
                                        <th>Reason for Suspension</th>
                                        <th>Suspended By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading suspended vessels from database...</td>
                                        </tr>
                                    ) : filteredSuspensions.map((s) => (
                                        <tr key={s.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(s)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(s)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => s.id && handleDeleteClick(s.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <AlertTriangle size={14} color="#EF4444" /> {s.vesselName}
                                                </div>
                                            </td>
                                            <td className="imo-cell">{s.imoNumber}</td>
                                            <td className="date-cell">{s.suspensionDate || 'N/A'}</td>
                                            <td>{s.reason}</td>
                                            <td>{s.suspendedBy}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredSuspensions.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No suspended vessels found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredSuspensions.length} records</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Suspended Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentSuspension ? 'Edit Suspension Record' : 'Record New Suspension'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Vessel Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. ACOSTA"
                                        value={form.vesselName} 
                                        onChange={(e) => setForm({ ...form, vesselName: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>IMO Number (7 digits) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        pattern="\d{7}"
                                        placeholder="e.g. 9876543"
                                        value={form.imoNumber} 
                                        onChange={(e) => setForm({ ...form, imoNumber: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Suspension Date *</label>
                                    <input 
                                        type="date" 
                                        required 
                                        value={form.suspensionDate} 
                                        onChange={(e) => setForm({ ...form, suspensionDate: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Reason for Suspension *</label>
                                    <textarea 
                                        required 
                                        placeholder="e.g. Outdated IHM documentation or failed survey audit..."
                                        value={form.reason} 
                                        onChange={(e) => setForm({ ...form, reason: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Suspended By *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. IHM Authority or Port State Control"
                                        value={form.suspendedBy} 
                                        onChange={(e) => setForm({ ...form, suspendedBy: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Record Suspension</button>
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
                            <h2>Send Suspension Notification</h2>
                            <button className="modal-close-btn" onClick={() => setIsEmailModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEmailSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Recipient Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. fleet-manager@company.com"
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
