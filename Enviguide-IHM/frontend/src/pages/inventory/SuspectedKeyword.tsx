import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, AlertCircle, Tag, Download, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import '../auth/Registered.css'; 

interface KeywordItem {
    id?: string;
    keyword: string;
    hazardType: string;
    severity: string;
    lastUpdated: string;
}

export default function SuspectedKeyword() {
    const [search, setSearch] = useState('');
    const [keywords, setKeywords] = useState<KeywordItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Keyword
    const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
    const [currentKeyword, setCurrentKeyword] = useState<KeywordItem | null>(null);
    const [keywordForm, setKeywordForm] = useState({
        keyword: '',
        hazardType: 'Health Hazard',
        severity: 'Medium'
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchKeywords = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: any[] }>('/suspected-keywords');
            if (res.success) {
                const mapped = res.data.map(k => ({
                    id: k.id,
                    keyword: k.keyword || '',
                    hazardType: k.hazardType || '',
                    severity: k.severity || 'Medium',
                    lastUpdated: k.updatedAt ? new Date(k.updatedAt).toISOString().split('T')[0] : 'N/A'
                }));
                setKeywords(mapped);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch suspected keywords');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeywords();
    }, []);

    // Filter keywords
    const filteredKeywords = keywords.filter(k => 
        k.keyword.toLowerCase().includes(search.toLowerCase()) || 
        k.hazardType.toLowerCase().includes(search.toLowerCase())
    );

    // Submit Add/Edit
    const handleKeywordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const body = {
                keyword: keywordForm.keyword.toUpperCase().trim(),
                hazardType: keywordForm.hazardType,
                severity: keywordForm.severity,
                status: 'Active'
            };

            if (currentKeyword && currentKeyword.id) {
                // Update
                const res = await api.put<{ success: boolean; data: any }>(
                    `/suspected-keywords/${currentKeyword.id}`,
                    body
                );
                if (res.success) {
                    setKeywords(keywords.map(k => k.id === currentKeyword.id ? {
                        id: res.data.id,
                        keyword: res.data.keyword || '',
                        hazardType: res.data.hazardType || '',
                        severity: res.data.severity || 'Medium',
                        lastUpdated: res.data.updatedAt ? new Date(res.data.updatedAt).toISOString().split('T')[0] : 'N/A'
                    } : k));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: any }>(
                    '/suspected-keywords',
                    body
                );
                if (res.success) {
                    setKeywords([{
                        id: res.data.id,
                        keyword: res.data.keyword || '',
                        hazardType: res.data.hazardType || '',
                        severity: res.data.severity || 'Medium',
                        lastUpdated: res.data.updatedAt ? new Date(res.data.updatedAt).toISOString().split('T')[0] : 'N/A'
                    }, ...keywords]);
                }
            }
            setIsKeywordModalOpen(false);
            setCurrentKeyword(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving keyword');
        }
    };

    const resetForm = () => {
        setKeywordForm({
            keyword: '',
            hazardType: 'Health Hazard',
            severity: 'Medium'
        });
    };

    const handleEditClick = (k: KeywordItem) => {
        setCurrentKeyword(k);
        setKeywordForm({
            keyword: k.keyword,
            hazardType: k.hazardType,
            severity: k.severity
        });
        setIsKeywordModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this keyword?')) return;
        try {
            await api.delete(`/suspected-keywords/${id}`);
            setKeywords(keywords.filter(k => k.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete keyword');
        }
    };

    // Open email send
    const handleSendClick = (k: KeywordItem) => {
        setEmailForm({
            to: '',
            subject: `Alert: High Risk Suspected Material Keyword - ${k.keyword}`,
            body: `Dear Engineering & Safety Teams,\n\nPlease be informed that the keyword "${k.keyword}" has been designated as a suspected hazardous material keyword (Severity: ${k.severity}) under ${k.hazardType}.\n\nPlease inspect all purchase orders and SDoC documents to ensure full compliance.\n\nBest regards,\nIHM Administration`
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
        if (filteredKeywords.length === 0) return;
        const headers = ['Keyword', 'Hazard Type', 'Severity Level', 'Last System Update'];
        const keys = ['keyword', 'hazardType', 'severity', 'lastUpdated'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredKeywords as any[]) {
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
        link.setAttribute('download', `suspected_keywords_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / SUSPECTED KEYWORD</div>
                            <h1>Suspected Keywords</h1>
                            <p>Global list of keywords indicating potential Presence of Hazardous Materials (IHM).</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredKeywords.length === 0}>
                                <Download size={16} /> Export CSV
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentKeyword(null); resetForm(); setIsKeywordModalOpen(true); }}>
                                <Plus size={18} /> Add New Keyword
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search targeted keywords..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> Hazard Type</button>
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Keyword</th>
                                        <th>Hazard Type</th>
                                        <th>Severity Level</th>
                                        <th>Last System Update</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>Loading keywords from database...</td>
                                        </tr>
                                    ) : filteredKeywords.map((k) => (
                                        <tr key={k.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(k)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(k)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => k.id && handleDeleteClick(k.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Tag size={16} color="#00B0FA" />
                                                    <span style={{ letterSpacing: '0.02em' }}>{k.keyword}</span>
                                                </div>
                                            </td>
                                            <td><span className="doc-type-tag">{k.hazardType}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <AlertCircle size={14} color={k.severity === 'Critical' ? '#EF4444' : '#F59E0B'} />
                                                    <span style={{ 
                                                        color: k.severity === 'Critical' ? '#EF4444' : '#F59E0B',
                                                        fontWeight: 700,
                                                        fontSize: '12px'
                                                    }}>{k.severity}</span>
                                                </div>
                                            </td>
                                            <td className="date-cell">{k.lastUpdated}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredKeywords.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="empty-table-msg">No keywords found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredKeywords.length} high-risk keywords</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Keyword Add/Edit Modal */}
            {isKeywordModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentKeyword ? 'Edit Keyword Details' : 'Add New Keyword'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsKeywordModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleKeywordSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Keyword *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. ASBESTOS"
                                        value={keywordForm.keyword} 
                                        onChange={(e) => setKeywordForm({ ...keywordForm, keyword: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Hazard Type *</label>
                                    <select 
                                        value={keywordForm.hazardType} 
                                        onChange={(e) => setKeywordForm({ ...keywordForm, hazardType: e.target.value })}
                                    >
                                        <option value="Health Hazard">Health Hazard</option>
                                        <option value="Environmental">Environmental</option>
                                        <option value="Chemical">Chemical</option>
                                        <option value="Heavy Metal">Heavy Metal</option>
                                        <option value="Ozone Depleting">Ozone Depleting</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Severity Level *</label>
                                    <select 
                                        value={keywordForm.severity} 
                                        onChange={(e) => setKeywordForm({ ...keywordForm, severity: e.target.value })}
                                    >
                                        <option value="Critical">Critical</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsKeywordModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Keyword</button>
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
                            <h2>Send Keyword Alert</h2>
                            <button className="modal-close-btn" onClick={() => setIsEmailModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEmailSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Recipient Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. operations@fleet.com"
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
