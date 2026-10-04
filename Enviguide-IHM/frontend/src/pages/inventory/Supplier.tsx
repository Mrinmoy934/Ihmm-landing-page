import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, Download, Package, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import '../auth/Registered.css'; 

interface SupplierItem {
    id?: string;
    supplierName: string;
    category: string;
    location: string;
    contactEmail: string;
    rating: string;
}

export default function Supplier() {
    const [search, setSearch] = useState('');
    const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Supplier
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<SupplierItem | null>(null);
    const [supplierForm, setSupplierForm] = useState({
        supplierName: '',
        category: 'Marine Products',
        location: '',
        contactEmail: '',
        rating: 'A'
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: any[] }>('/suppliers');
            if (res.success) {
                const mapped = res.data.map(s => ({
                    id: s.id,
                    supplierName: s.name || '',
                    category: s.category || '',
                    location: s.location || '',
                    contactEmail: s.contactEmail || '',
                    rating: s.rating || 'A'
                }));
                setSuppliers(mapped);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch suppliers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    // Filter suppliers
    const filteredSuppliers = suppliers.filter(s => 
        s.supplierName.toLowerCase().includes(search.toLowerCase()) || 
        s.category.toLowerCase().includes(search.toLowerCase()) ||
        s.location.toLowerCase().includes(search.toLowerCase())
    );

    // Submit Add/Edit
    const handleSupplierSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const body = {
                name: supplierForm.supplierName,
                category: supplierForm.category,
                location: supplierForm.location,
                contactEmail: supplierForm.contactEmail,
                rating: supplierForm.rating,
                status: 'Active'
            };

            if (currentSupplier && currentSupplier.id) {
                // Update
                const res = await api.put<{ success: boolean; data: any }>(
                    `/suppliers/${currentSupplier.id}`,
                    body
                );
                if (res.success) {
                    setSuppliers(suppliers.map(s => s.id === currentSupplier.id ? {
                        id: res.data.id,
                        supplierName: res.data.name || '',
                        category: res.data.category || '',
                        location: res.data.location || '',
                        contactEmail: res.data.contactEmail || '',
                        rating: res.data.rating || 'A'
                    } : s));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: any }>(
                    '/suppliers',
                    body
                );
                if (res.success) {
                    setSuppliers([{
                        id: res.data.id,
                        supplierName: res.data.name || '',
                        category: res.data.category || '',
                        location: res.data.location || '',
                        contactEmail: res.data.contactEmail || '',
                        rating: res.data.rating || 'A'
                    }, ...suppliers]);
                }
            }
            setIsSupplierModalOpen(false);
            setCurrentSupplier(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving supplier');
        }
    };

    const resetForm = () => {
        setSupplierForm({
            supplierName: '',
            category: 'Marine Products',
            location: '',
            contactEmail: '',
            rating: 'A'
        });
    };

    const handleEditClick = (supplier: SupplierItem) => {
        setCurrentSupplier(supplier);
        setSupplierForm({
            supplierName: supplier.supplierName,
            category: supplier.category,
            location: supplier.location,
            contactEmail: supplier.contactEmail,
            rating: supplier.rating
        });
        setIsSupplierModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) return;
        try {
            await api.delete(`/suppliers/${id}`);
            setSuppliers(suppliers.filter(s => s.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete supplier');
        }
    };

    // Open email send
    const handleSendClick = (supplier: SupplierItem) => {
        setEmailForm({
            to: supplier.contactEmail,
            subject: `Request for MD / SDoC - ${supplier.supplierName}`,
            body: `Dear Sales Team,\n\nWe require the Material Declaration (MD) and Supplier's Declaration of Conformity (SDoC) for the recently ordered parts.\n\nPlease upload them directly to our portal or reply with the attachments.\n\nBest regards,\nMarine Safety Officer`
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
        if (filteredSuppliers.length === 0) return;
        const headers = ['Supplier Name', 'Category', 'Location', 'Contact Email', 'Rating'];
        const keys = ['supplierName', 'category', 'location', 'contactEmail', 'rating'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredSuppliers as any[]) {
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
        link.setAttribute('download', `suppliers_list_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / SUPPLIER</div>
                            <h1>Managed Suppliers</h1>
                            <p>Directory of approved marine equipment and service suppliers.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredSuppliers.length === 0}>
                                <Download size={16} /> Export CSV
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentSupplier(null); resetForm(); setIsSupplierModalOpen(true); }}>
                                <Plus size={18} /> Add New Supplier
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search suppliers by name, category or region..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> Category</button>
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Supplier Name</th>
                                        <th>Category</th>
                                        <th>Location</th>
                                        <th>Contact Email</th>
                                        <th>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading suppliers from database...</td>
                                        </tr>
                                    ) : filteredSuppliers.map((s) => (
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
                                                    <Package size={14} color="#00B0FA" /> {s.supplierName}
                                                </div>
                                            </td>
                                            <td><span className="doc-type-tag">{s.category}</span></td>
                                            <td>{s.location}</td>
                                            <td className="email-cell" onClick={() => handleSendClick(s)}>{s.contactEmail}</td>
                                            <td>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    background: s.rating.startsWith('A') ? '#ECFDF5' : '#FEF3C7',
                                                    color: s.rating.startsWith('A') ? '#059669' : '#D97706',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontWeight: 800
                                                }}>
                                                    {s.rating}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filteredSuppliers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No suppliers found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredSuppliers.length} approved suppliers</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Supplier Add/Edit Modal */}
            {isSupplierModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsSupplierModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSupplierSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Supplier Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Wilhelmsen Ships Service"
                                        value={supplierForm.supplierName} 
                                        onChange={(e) => setSupplierForm({ ...supplierForm, supplierName: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category *</label>
                                    <select 
                                        value={supplierForm.category} 
                                        onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                                    >
                                        <option value="Marine Products">Marine Products</option>
                                        <option value="Engine Parts">Engine Parts</option>
                                        <option value="Electrical">Electrical</option>
                                        <option value="Heat Transfer">Heat Transfer</option>
                                        <option value="General Stores">General Stores</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Location *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Norway"
                                        value={supplierForm.location} 
                                        onChange={(e) => setSupplierForm({ ...supplierForm, location: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Contact Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. supply@wilhelmsen.com"
                                        value={supplierForm.contactEmail} 
                                        onChange={(e) => setSupplierForm({ ...supplierForm, contactEmail: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Rating</label>
                                    <select 
                                        value={supplierForm.rating} 
                                        onChange={(e) => setSupplierForm({ ...supplierForm, rating: e.target.value })}
                                    >
                                        <option value="A+">A+</option>
                                        <option value="A">A</option>
                                        <option value="B+">B+</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsSupplierModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Supplier</button>
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
                            <h2>Send Supplier Inquiry</h2>
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
