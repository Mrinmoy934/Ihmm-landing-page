import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import './AuditReviewDetail.css';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import {
    Search,
    Filter,
    CheckCircle2,
    AlertTriangle,
    MoreVertical,
    ShieldCheck
} from 'lucide-react';

interface ItemReview {
    id: string;
    description: string;
    quantity: string;
    hmStatus: 'Green' | 'Red' | 'PCHM' | 'Unassigned';
    mdStatus: 'Received' | 'Pending' | 'N/A';
    sdocStatus: 'Received' | 'Pending' | 'N/A';
    hmCategory?: string;
    remarks?: string;
}

export default function AuditReviewDetail() {
    const { imo } = useParams();

    const [vesselInfo, setVesselInfo] = useState<any>(null);
    const [reviewItems, setReviewItems] = useState<ItemReview[]>([]);
    const [selectedItem, setSelectedItem] = useState<ItemReview | null>(null);
    const [hmSearch, setHmSearch] = useState('');

    const [showCategorizationPanel, setShowCategorizationPanel] = useState(false);

    useEffect(() => {
        if (!imo) return;

        // Standard 20-column header indices (set by the upload flow on the backend):
        // 2 = PO Number, 6 = Item Description, 16 = Quantity
        const PO_IDX = 2, DESC_IDX = 6, QTY_IDX = 16;

        Promise.all([
            api.get<{ success: boolean; data: { rows: unknown[][] } }>(ENDPOINTS.AUDITS.LINE_ITEMS(imo)),
            api.get<{ success: boolean; data: Record<string, unknown> }>(ENDPOINTS.AUDITS.REVIEW_DETAIL(imo))
                .catch(() => ({ data: null as unknown as Record<string, unknown> })),
        ])
            .then(([lineRes, auditRes]) => {
                const rows = lineRes.data.rows || [];
                const items: ItemReview[] = rows.map((row, index) => ({
                    id: String(row[PO_IDX] || `ITEM-${index}`),
                    description: String(row[DESC_IDX] || 'No Description'),
                    quantity: String(row[QTY_IDX] || '0'),
                    hmStatus: 'Unassigned',
                    mdStatus: 'Pending',
                    sdocStatus: 'Pending',
                }));
                setReviewItems(items);

                if (auditRes && auditRes.data) {
                    setVesselInfo({
                        vesselName: auditRes.data.vesselName,
                        imoNumber: auditRes.data.imoNumber,
                        createDate: (auditRes.data.createdAt as string | undefined)?.split('T')[0] ?? '',
                    });
                } else {
                    setVesselInfo({ vesselName: 'Vessel ' + imo, imoNumber: imo, createDate: '' });
                }
            })
            .catch(() => {
                setReviewItems([]);
                setVesselInfo({ vesselName: 'Vessel ' + imo, imoNumber: imo, createDate: '' });
            });
    }, [imo]);

    const stats = useMemo(() => {
        const total = reviewItems.length;
        const reviewed = reviewItems.filter(i => i.hmStatus !== 'Unassigned').length;
        const green = reviewItems.filter(i => i.hmStatus === 'Green').length;
        const red = reviewItems.filter(i => i.hmStatus === 'Red').length;
        const pchm = reviewItems.filter(i => i.hmStatus === 'PCHM').length;

        return { total, reviewed, green, red, pchm, percent: total > 0 ? Math.round((reviewed / total) * 100) : 0 };
    }, [reviewItems]);

    const handleUpdateStatus = (id: string, updates: Partial<ItemReview>) => {
        setReviewItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        if (selectedItem?.id === id) {
            setSelectedItem(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const hmDatabase = [
        { name: 'Asbestos-containing gaskets', category: 'Asbestos', status: 'Red' },
        { name: 'Ozone depleting substances', category: 'ODS', status: 'Red' },
        { name: 'Lead-acid batteries', category: 'Heavy Metals', status: 'Red' },
        { name: 'Fluorescent tubes (Mercury)', category: 'Heavy Metals', status: 'Red' },
        { name: 'Chrome-plated components', category: 'Hexavalent Chromium', status: 'PCHM' },
        { name: 'Standard Steel Valves', category: 'Non-Hazardous', status: 'Green' },
        { name: 'Copper Piping', category: 'Non-Hazardous', status: 'Green' },
    ];

    const filteredHmDb = hmDatabase.filter(hm =>
        hm.name.toLowerCase().includes(hmSearch.toLowerCase()) ||
        hm.category.toLowerCase().includes(hmSearch.toLowerCase())
    );

    return (
        <div className="audit-review-detail-container">
            <Sidebar />
            <main className="audit-review-detail-main">
                <Header />

                <div className="review-detail-content">
                    {/* Breadcrumbs & Navigation */}
                    <div className="review-top-nav">
                        <div className="breadcrumbs">
                            <span>Administration</span>
                            <span className="sep">&rsaquo;</span>
                            <span>Pending Reviews</span>
                            <span className="sep">&rsaquo;</span>
                            <span className="active">{vesselInfo?.vesselName || 'Vessel Detail'}</span>
                        </div>
                    </div>

                    {/* Vessel Summary Header */}
                    <div className="vessel-summary-card">
                        <div className="vessel-info">
                            <div className="vessel-avatar">
                                <ShieldCheck size={32} color="#00B0FA" />
                            </div>
                            <div className="vessel-text">
                                <h1>{vesselInfo?.vesselName}</h1>
                                <p>IMO: <strong>{imo}</strong> &bull; Audit Initiated: {vesselInfo?.createDate || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="vessel-stats-grid">
                            <div className="stat-box">
                                <span className="label">TOTAL ITEMS</span>
                                <span className="value">{stats.total}</span>
                            </div>
                            <div className="stat-box">
                                <span className="label">REVIEWED</span>
                                <span className="value">{stats.reviewed}</span>
                            </div>
                            <div className="stat-box">
                                <span className="label">GREEN QTY</span>
                                <span className="value green">{stats.green}</span>
                            </div>
                            <div className="stat-box">
                                <span className="label">RED QTY</span>
                                <span className="value red">{stats.red}</span>
                            </div>
                        </div>
                        <div className="review-progress-area">
                            <div className="progress-label">
                                <span>REVIEW PROGRESS</span>
                                <span>{stats.percent}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${stats.percent}%` }} />
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="finalize-btn" disabled={stats.percent < 100}>
                                <CheckCircle2 size={18} /> FINALIZE REVIEW
                            </button>
                        </div>
                    </div>

                    {/* Main Review Area */}
                    <div className="review-main-grid">
                        <div className="items-list-section">
                            <div className="section-header">
                                <h2>Categorization Queue</h2>
                                <div className="filter-group">
                                    <div className="search-box">
                                        <Search size={22} className="search-icon" />
                                        <input type="text" placeholder="Search Vessel POs..." />
                                    </div>
                                    <button className="filter-btn"><Filter size={18} /> Filters</button>
                                </div>
                            </div>

                            <div className="table-wrapper">
                                <table className="review-table">
                                    <thead>
                                        <tr>
                                            <th>PO NUMBER</th>
                                            <th>ITEM DESCRIPTION</th>
                                            <th>QTY</th>
                                            <th>MDS</th>
                                            <th>SDOC</th>
                                            <th>STATUS</th>
                                            <th style={{ textAlign: 'center' }}>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reviewItems.map((item) => (
                                            <tr
                                                key={item.id}
                                                className={selectedItem?.id === item.id ? 'selected' : ''}
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setShowCategorizationPanel(true);
                                                }}
                                            >
                                                <td className="po-cell">{item.id}</td>
                                                <td className="desc-cell">{item.description}</td>
                                                <td>{item.quantity}</td>
                                                <td>
                                                    <span className={`doc-tag ${item.mdStatus.toLowerCase()}`}>
                                                        {item.mdStatus}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`doc-tag ${item.sdocStatus.toLowerCase()}`}>
                                                        {item.sdocStatus}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${item.hmStatus.toLowerCase()}`}>
                                                        {item.hmStatus}
                                                    </span>
                                                </td>
                                                <td className="action-cell">
                                                    <button className="row-action-btn"><MoreVertical size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Categorization Panel */}
                        {showCategorizationPanel && selectedItem && (
                            <div className="categorization-panel">
                                <div className="panel-header">
                                    <h3>Categorize Item</h3>
                                    <button className="close-panel" onClick={() => setShowCategorizationPanel(false)}>&times;</button>
                                </div>
                                <div className="selected-item-info">
                                    <label>SELECTED ITEM</label>
                                    <h4>{selectedItem.description}</h4>
                                    <p>PO: {selectedItem.id} &bull; Qty: {selectedItem.quantity}</p>
                                </div>

                                <div className="hm-categorization-section">
                                    <label>MATCH HM DATABASE</label>
                                    <div className="hm-search">
                                        <Search size={22} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search hazardous materials..."
                                            value={hmSearch}
                                            onChange={(e) => setHmSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="hm-db-list">
                                        {filteredHmDb.map((hm, idx) => (
                                            <div
                                                key={idx}
                                                className="hm-item"
                                                onClick={() => {
                                                    handleUpdateStatus(selectedItem.id, {
                                                        hmStatus: hm.status as any,
                                                        hmCategory: hm.category
                                                    });
                                                    setHmSearch('');
                                                }}
                                            >
                                                <div className="hm-info">
                                                    <span className="hm-name">{hm.name}</span>
                                                    <span className="hm-cat">{hm.category}</span>
                                                </div>
                                                <span className={`hm-tag ${hm.status.toLowerCase()}`}>{hm.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="document-checks-section">
                                    <label>DOCUMENT LOGS</label>
                                    <div className="check-row">
                                        <span>Material Declaration (MDS)</span>
                                        <select
                                            value={selectedItem.mdStatus}
                                            onChange={(e) => handleUpdateStatus(selectedItem.id, { mdStatus: e.target.value as any })}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Received">Received</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                    <div className="check-row">
                                        <span>SDoC Compliance</span>
                                        <select
                                            value={selectedItem.sdocStatus}
                                            onChange={(e) => handleUpdateStatus(selectedItem.id, { sdocStatus: e.target.value as any })}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Received">Received</option>
                                            <option value="N/A">N/A</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="panel-footer">
                                    <button className="quick-btn safe" onClick={() => handleUpdateStatus(selectedItem.id, { hmStatus: 'Green', hmCategory: 'Safe' })}>
                                        <CheckCircle2 size={16} /> MARK SAFE
                                    </button>
                                    <button className="quick-btn hazard" onClick={() => handleUpdateStatus(selectedItem.id, { hmStatus: 'Red', hmCategory: 'Verify Risk' })}>
                                        <AlertTriangle size={16} /> MARK HAZARD
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
