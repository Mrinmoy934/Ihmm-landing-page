import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Send, Filter, Download, Wrench, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import '../auth/Registered.css'; 

interface EquipmentItem {
    id?: string;
    equipmentName: string;
    modelCode: string;
    manufacturer: string;
    systemType: string;
    nextService: string;
}

export default function Equipment() {
    const [search, setSearch] = useState('');
    const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state for Add/Edit Equipment
    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
    const [currentEquipment, setCurrentEquipment] = useState<EquipmentItem | null>(null);
    const [equipmentForm, setEquipmentForm] = useState({
        equipmentName: '',
        modelCode: '',
        manufacturer: '',
        systemType: 'Propulsion',
        nextService: ''
    });

    // Modal state for Send Email
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: '',
        subject: '',
        body: ''
    });

    const fetchEquipment = async () => {
        try {
            setLoading(true);
            const res = await api.get<{ success: boolean; data: any[] }>('/equipment');
            if (res.success) {
                const mapped = res.data.map(e => ({
                    id: e.id,
                    equipmentName: e.name || '',
                    modelCode: e.modelCode || '',
                    manufacturer: e.manufacturer || '',
                    systemType: e.systemType || '',
                    nextService: e.nextServiceDate || ''
                }));
                setEquipment(mapped);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch equipment records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEquipment();
    }, []);

    // Filter list
    const filteredEquipment = equipment.filter(e => 
        e.equipmentName.toLowerCase().includes(search.toLowerCase()) || 
        e.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
        e.systemType.toLowerCase().includes(search.toLowerCase()) ||
        e.modelCode.toLowerCase().includes(search.toLowerCase())
    );

    // Submit Add/Edit
    const handleEquipmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const body = {
                name: equipmentForm.equipmentName,
                modelCode: equipmentForm.modelCode,
                manufacturer: equipmentForm.manufacturer,
                systemType: equipmentForm.systemType,
                nextServiceDate: equipmentForm.nextService,
                status: 'Active'
            };

            if (currentEquipment && currentEquipment.id) {
                // Update
                const res = await api.put<{ success: boolean; data: any }>(
                    `/equipment/${currentEquipment.id}`,
                    body
                );
                if (res.success) {
                    setEquipment(equipment.map(e => e.id === currentEquipment.id ? {
                        id: res.data.id,
                        equipmentName: res.data.name || '',
                        modelCode: res.data.modelCode || '',
                        manufacturer: res.data.manufacturer || '',
                        systemType: res.data.systemType || '',
                        nextService: res.data.nextServiceDate || ''
                    } : e));
                }
            } else {
                // Create
                const res = await api.post<{ success: boolean; data: any }>(
                    '/equipment',
                    body
                );
                if (res.success) {
                    setEquipment([{
                        id: res.data.id,
                        equipmentName: res.data.name || '',
                        modelCode: res.data.modelCode || '',
                        manufacturer: res.data.manufacturer || '',
                        systemType: res.data.systemType || '',
                        nextService: res.data.nextServiceDate || ''
                    }, ...equipment]);
                }
            }
            setIsEquipmentModalOpen(false);
            setCurrentEquipment(null);
            resetForm();
        } catch (err: any) {
            alert(err.message || 'Error saving equipment details');
        }
    };

    const resetForm = () => {
        setEquipmentForm({
            equipmentName: '',
            modelCode: '',
            manufacturer: '',
            systemType: 'Propulsion',
            nextService: ''
        });
    };

    const handleEditClick = (item: EquipmentItem) => {
        setCurrentEquipment(item);
        setEquipmentForm({
            equipmentName: item.equipmentName,
            modelCode: item.modelCode,
            manufacturer: item.manufacturer,
            systemType: item.systemType,
            nextService: item.nextService
        });
        setIsEquipmentModalOpen(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this equipment?')) return;
        try {
            await api.delete(`/equipment/${id}`);
            setEquipment(equipment.filter(e => e.id !== id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete equipment');
        }
    };

    // Open email send
    const handleSendClick = (item: EquipmentItem) => {
        setEmailForm({
            to: '',
            subject: `Service Schedule - ${item.equipmentName}`,
            body: `Dear Engineering Team,\n\nPlease note the upcoming maintenance schedule for "${item.equipmentName}" (Model: ${item.modelCode}).\n\nScheduled Next Service: ${item.nextService}.\n\nPlease ensure spare parts and manuals are prepared.\n\nBest regards,\nTechnical Operations`
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
        if (filteredEquipment.length === 0) return;
        const headers = ['Equipment Name', 'Model Code', 'Manufacturer', 'System Type', 'Next Service'];
        const keys = ['equipmentName', 'modelCode', 'manufacturer', 'systemType', 'nextService'];
        
        const csvRows = [headers.join(',')];
        for (const row of filteredEquipment as any[]) {
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
        link.setAttribute('download', `equipment_list_${Date.now()}.csv`);
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
                            <div className="breadcrumb-mini">MENU / EQUIPMENT</div>
                            <h1>Vessel Equipment</h1>
                            <p>Global database of critical ship equipment and maintenance schedules.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-standard" onClick={handleExport} disabled={filteredEquipment.length === 0}>
                                <Download size={16} /> Export Specs
                            </button>
                            <button className="btn-primary-standard" onClick={() => { setCurrentEquipment(null); resetForm(); setIsEquipmentModalOpen(true); }}>
                                <Plus size={18} /> Register Equipment
                            </button>
                        </div>
                    </div>

                    <div className="table-filter-bar">
                        <div className="search-wrapper-standard">
                            <Search size={18} className="search-icon-standard" />
                            <input 
                                type="text" 
                                placeholder="Search by name, model or manufacturer..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-actions-standard">
                            <button className="filter-pill-btn"><Filter size={14} /> System Systems</button>
                        </div>
                    </div>

                    {error && <div style={{ color: '#EF4444', padding: '16px', background: '#FEF2F2', borderRadius: '8px', fontWeight: 600 }}>{error}</div>}

                    <div className="standard-table-container">
                        <div className="table-scroll-wrapper">
                            <table className="standard-table">
                                <thead>
                                    <tr>
                                        <th className="th-action">Action</th>
                                        <th>Equipment Name</th>
                                        <th>Model Code</th>
                                        <th>Manufacturer</th>
                                        <th>System Type</th>
                                        <th>Next Service</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Loading equipment from database...</td>
                                        </tr>
                                    ) : filteredEquipment.map((e) => (
                                        <tr key={e.id}>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    <button className="action-btn edit-btn" title="Edit" onClick={() => handleEditClick(e)}><Edit2 size={14} /></button>
                                                    <button className="action-btn send-btn" title="Send Notification Email" onClick={() => handleSendClick(e)}><Send size={14} /></button>
                                                    <button className="action-btn delete-btn" title="Delete" onClick={() => e.id && handleDeleteClick(e.id)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="font-bold-main">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Wrench size={14} color="#00B0FA" /> {e.equipmentName}
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{e.modelCode}</td>
                                            <td>{e.manufacturer}</td>
                                            <td><span className="doc-type-tag">{e.systemType}</span></td>
                                            <td className="date-cell">{e.nextService || 'N/A'}</td>
                                        </tr>
                                    ))}
                                    {!loading && filteredEquipment.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="empty-table-msg">No equipment found in database.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-pagination-standard">
                            <span className="pagination-text">Showing {filteredEquipment.length} critical systems</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Equipment Add/Edit Modal */}
            {isEquipmentModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>{currentEquipment ? 'Edit Equipment Details' : 'Register Equipment'}</h2>
                            <button className="modal-close-btn" onClick={() => setIsEquipmentModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEquipmentSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Equipment Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. Main Engine - 6S60MC"
                                        value={equipmentForm.equipmentName} 
                                        onChange={(e) => setEquipmentForm({ ...equipmentForm, equipmentName: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Model Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. MAN-2022-X1"
                                        value={equipmentForm.modelCode} 
                                        onChange={(e) => setEquipmentForm({ ...equipmentForm, modelCode: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Manufacturer *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        placeholder="e.g. MAN Energy Solutions"
                                        value={equipmentForm.manufacturer} 
                                        onChange={(e) => setEquipmentForm({ ...equipmentForm, manufacturer: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>System Type *</label>
                                    <select 
                                        value={equipmentForm.systemType} 
                                        onChange={(e) => setEquipmentForm({ ...equipmentForm, systemType: e.target.value })}
                                    >
                                        <option value="Propulsion">Propulsion</option>
                                        <option value="Electrical">Electrical</option>
                                        <option value="Environmental">Environmental</option>
                                        <option value="Safety">Safety</option>
                                        <option value="Auxiliary">Auxiliary</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Next Service Date</label>
                                    <input 
                                        type="date" 
                                        value={equipmentForm.nextService} 
                                        onChange={(e) => setEquipmentForm({ ...equipmentForm, nextService: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary-standard" onClick={() => setIsEquipmentModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary-standard">Save Equipment</button>
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
                            <h2>Send Service Schedule</h2>
                            <button className="modal-close-btn" onClick={() => setIsEmailModalOpen(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEmailSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Recipient Email *</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="e.g. chief-engineer@vessel.com"
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
