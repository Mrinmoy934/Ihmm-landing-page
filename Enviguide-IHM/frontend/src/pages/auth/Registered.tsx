import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, Download, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import './Registered.css';

interface Vessel {
    id?: string;
    name: string;
    imoNumber: string;
    shipOwner: string;
    shipManager: string;
    keelLaidDate?: string;
    vesselType?: string;
}

export default function Registered() {
    const [search, setSearch] = useState('');
    const [vessels, setVessels] = useState<Vessel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Vessel
    const [isVesselModalOpen, setIsVesselModalOpen] = useState(false);
    const [currentVessel, setCurrentVessel] = useState<Vessel | null>(null);
    const [vesselForm, setVesselForm] = useState({
        name: '',
        imoNumber: '',
        shipOwner: '',
        shipManager: '',
        keelLaidDate: '',
        vesselType: 'Container Ship'
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchVessels = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: Vessel[] }>(ENDPOINTS.VESSELS.LIST);
            if (res.success) {
                setVessels(res.data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch vessels');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVessels();
    }, []);

    // Filter list
    const filteredVessels = vessels.filter(v => 
        v.name.toLowerCase().includes(search.toLowerCase()) || 
        v.imoNumber.includes(search) ||
        v.shipOwner.toLowerCase().includes(search.toLowerCase()) ||
        v.shipManager.toLowerCase().includes(search.toLowerCase())
    );

    // Add / Edit submission
    const handleVesselSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (currentVessel && currentVessel.id) {
                // Update
                const res = await api.put<{ success: boolean; data: Vessel }>(
                    ENDPOINTS.VESSELS.DETAIL(currentVessel.id),
                    vesselForm
                );
                if (res.success) {
                    setVessels(vessels.map(v => v.id === currentVessel.id ? res.data : v));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: Vessel }>(
                    ENDPOINTS.VESSELS.LIST,
                    vesselForm
                );
                if (res.success) {
                    setVessels([res.data, ...vessels]);
                }
            }
            setIsVesselModalOpen(false);
            setCurrentVessel(null);
            resetVesselForm();
        } catch (err: any) {
            alert(err.message || 'Error saving vessel');
        }
    };

    const resetVesselForm = () => {
        setVesselForm({
            name: '',
            imoNumber: '',
            shipOwner: '',
            shipManager: '',
            keelLaidDate: '',
            vesselType: 'Container Ship'
        });
    };

    const handleEditClick = (vessel: Vessel) => {
        setCurrentVessel(vessel);
        setVesselForm({
            name: vessel.name,
            imoNumber: vessel.imoNumber,
            shipOwner: vessel.shipOwner,
            shipManager: vessel.shipManager,
            keelLaidDate: vessel.keelLaidDate || '',
            vesselType: vessel.vesselType || 'Container Ship'
        });
        setIsVesselModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this vessel?')) return;
        try {
            await api.delete(ENDPOINTS.VESSELS.DETAIL(id));
            setVessels(vessels.filter(v => v.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete vessel');
        }
    };

    // Open email send
    const handleSendClick = (vessel: Vessel) => {
        setEmailForm({
            to: '',
            subject: `IHM Certificate Update for ${vessel.name}`,
            body: `Dear Partner,\n\nWe are updating IHM records for vessel "${vessel.name}" (IMO: ${vessel.imoNumber}).\nPlease provide the latest documentation for this vessel.\n\nBest regards,\nIHM Safety Team`
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
        if (filteredVessels.length === 0) return;
        const headers = ['Vessel Name', 'IMO Number', 'Ship Owner', 'Ship Manager', 'Keel Laid Date', 'Vessel Type'];
        const keys = ['name', 'imoNumber', 'shipOwner', 'shipManager', 'keelLaidDate', 'vesselType'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredVessels as any[]) {
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
        link.setAttribute('download', `registered_vessels_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / REGISTERED</div>
                            <h1>Registered Vessels</h1>
                            <p>Overview of all vessels currently registered in the IHM system.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredVessels.length === 0}>
                                <Download size={16} /> Export
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentVessel(null); resetVesselForm(); setIsVesselModalOpen(true); }}>
                                <Plus size={18} /> Register New Vessel
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search by name, IMO, owner or manager..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> Filters</button>
                            <button className="filter-pill-btn">All Vessels</button>
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
                                        <th>Ship Owner</th>
                                        <th>Ship Manager</th>
                                        <th>Keel Laid Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading vessels from database...</td>
                                        </tr>
                                    ) : filteredVessels.map((v) => (
                                        <tr key={v.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(v)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(v)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => v.id && handleDeleteClick(v.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">{v.name}</td>
                                            <td className="imo-cell">{v.imoNumber}</td>
                                            <td>{v.shipOwner}</td>
                                            <td>{v.shipManager}</td>
                                            <td className="date-cell">{v.keelLaidDate || 'N/A'}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredVessels.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No vessels found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredVessels.length} vessels</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Vessel Add/Edit Modal */}
            {isVesselModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentVessel ? 'Edit Vessel' : 'Register New Vessel'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsVesselModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleVesselSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Vessel Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. MV Ocean Pioneer"
                                        value={vesselForm.name} 
                                        onChange={(e) => setVesselForm({ ...vesselForm, name: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>IMO Number (7 digits) *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        pattern="\d{7}"
                                        placeholder="e.g. 9123456"
                                        value={vesselForm.imoNumber} 
                                        onChange={(e) => setVesselForm({ ...vesselForm, imoNumber: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ship Owner *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Maersk Line"
                                        value={vesselForm.shipOwner} 
                                        onChange={(e) => setVesselForm({ ...vesselForm, shipOwner: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ship Manager</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. V.Ships"
                                        value={vesselForm.shipManager} 
                                        onChange={(e) => setVesselForm({ ...vesselForm, shipManager: e.target.value })} 
                                    />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Keel Laid Date</label>
                                        <input 
                                            type="date" 
                                            value={vesselForm.keelLaidDate} 
                                            onChange={(e) => setVesselForm({ ...vesselForm, keelLaidDate: e.target.value })} 
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Vessel Type</label>
                                        <select 
                                            value={vesselForm.vesselType} 
                                            onChange={(e) => setVesselForm({ ...vesselForm, vesselType: e.target.value })}
                                        >
                                            <option value="Container Ship">Container Ship</option>
                                            <option value="Bulk Carrier">Bulk Carrier</option>
                                            <option value="Crude Oil Tanker">Crude Oil Tanker</option>
                                            <option value="General Cargo">General Cargo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsVesselModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Vessel</button>
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
                            <h2>Send Notification Email</h2>
                            <button className="modal-close-btn" onClick={() => setIsEmailModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEmailSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Recipient Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. contact@shipping.com"
                                        value={emailForm.to} 
                                        onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Subject *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. IHM Document Request"
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
