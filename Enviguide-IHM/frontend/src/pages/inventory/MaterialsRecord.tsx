import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Search, ChevronRight, ChevronDown, AlertCircle,
    Database, Package, X, CheckCircle, MoreVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './MaterialsRecord.css';

import { mockMaterials } from '../../lib/mockData';
import type { Material } from '../../types/index';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';

interface MaterialsRecordProps {
    vesselName: string;
    /** Backend UUID. When present, the page fetches from
     *  `GET /vessels/:vesselId/materials` and ignores the demo mock list. */
    vesselId?: string;
}

// Map vessel name to a mock ID — used only for demo vessels (no vesselId).
const DEMO_VESSEL_ID_MAP: Record<string, string> = {
    'MV Ocean Pioneer': '1',
    'ACOSTA': '2',
    'AFIF': '3',
    'PACIFIC HORIZON': '4',
};

/** Normalise the backend `ihm_part` value (`'Part I'`, `'Part II'`, ...)
 *  into the uppercase form the table expects (`'PART I'`, ...). */
function normalizeIhmPart(raw: unknown): string {
    const s = (typeof raw === 'string' ? raw : '').toUpperCase();
    if (s.includes('III')) return 'PART III';
    if (s.includes('II')) return 'PART II';
    return 'PART I';
}

/** Convert a backend material row into the front-end `Material` shape used
 *  by the records table and side panel. */
function backendToMaterial(m: Record<string, unknown>): Material {
    const category = (m.category as Material['category']) || 'warning';
    return {
        id: String(m.id),
        vesselId: m.vesselId as string | undefined,
        name: (m.name as string) || '',
        ihmPart: normalizeIhmPart(m.ihmPart),
        category,
        status: 'Mapped',
        completion: 100,
        poNo: (m.shipPO as string) || 'PO-2026-0891',
        zone: (m.deckAreaName as string) || (m.deckName as string) || (m.deckPlan as string) || (m.compartment as string) || 'Main Deck',
        materialName: (m.materialName as string) || (m.name as string) || '',
        equipment: (m.equipment as string) || '',
        compartment: (m.compartment as string) || '',
        hazardType: (m.hazardType as string) || (m.material as string) || '',
        component: (m.component as string) || '',
        hmStatus: (m.hmStatus as string) || 'CHM',
        // Extra fields used by the detail panel — kept on the object even
        // though they're not in the Material interface (it's permissive).
        ...(m.manufacturer ? { manufacturer: m.manufacturer } : {}),
        ...(m.ihmPartNumber ? { ihmPartNumber: m.ihmPartNumber } : {}),
        ...(m.position ? { position: m.position } : {}),
    } as Material;
}

export default function MaterialsRecord({ vesselName, vesselId }: MaterialsRecordProps) {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTag, setActiveTag] = useState('All');
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(12);

    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Backend-backed materials for the current vessel. Empty for demo
    // vessels (no vesselId) — the static mock list is used instead.
    const [backendMaterials, setBackendMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadFromBackend = useCallback(async () => {
        if (!vesselId) return;
        setIsLoading(true);
        try {
            const res = await api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(
                ENDPOINTS.MATERIALS.LIST(vesselId),
            );
            setBackendMaterials((res.data || []).map(backendToMaterial));
        } catch (err) {
            console.error('Failed to load materials from backend:', err);
            setBackendMaterials([]);
        } finally {
            setIsLoading(false);
        }
    }, [vesselId]);

    // Initial fetch + re-fetch when the user returns to the tab (e.g. after
    // adding a material in the mapping page popup window).
    useEffect(() => {
        if (!vesselId) {
            setBackendMaterials([]);
            return;
        }
        loadFromBackend();
        const onFocus = () => loadFromBackend();
        const onVis = () => { if (document.visibilityState === 'visible') loadFromBackend(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [vesselId, loadFromBackend]);



    // Filter Panel State
    // Filter Panel State
    const [thresholdMin, setThresholdMin] = useState(0.00);
    const [thresholdMax, setThresholdMax] = useState(1.00);
    const [selectedParts, setSelectedParts] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [selectedChemicalGroup, setSelectedChemicalGroup] = useState('All Chemical Groups');
    const [hazardFilter, setHazardFilter] = useState<'ALL' | 'CHM' | 'PCHM' | 'Non-CHM'>('ALL');
    const [isEditing, setIsEditing] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Edit State
    const [editName, setEditName] = useState('');
    const [editPO, setEditPO] = useState('PO-12345');
    const [editRisk] = useState('High Risk');

    // Sync Horizontal Scroll
    useEffect(() => {
        const top = topScrollRef.current;
        const bottom = tableContainerRef.current;
        if (!top || !bottom) return;

        const onTopScroll = () => {
            bottom.scrollLeft = top.scrollLeft;
        };
        const onBottomScroll = () => {
            top.scrollLeft = bottom.scrollLeft;
        };

        top.addEventListener('scroll', onTopScroll);
        bottom.addEventListener('scroll', onBottomScroll);

        return () => {
            top.removeEventListener('scroll', onTopScroll);
            bottom.removeEventListener('scroll', onBottomScroll);
        };
    }, []);

    // For real (backend-backed) vessels we're empty until the API call has
    // returned data. For demo vessels we always have the static mock list.
    const hasAnyMaterials = useMemo(() => {
        if (vesselId) return backendMaterials.length > 0;
        return Object.prototype.hasOwnProperty.call(DEMO_VESSEL_ID_MAP, vesselName);
    }, [vesselId, backendMaterials, vesselName]);

    // ── HOOKS — keep ALL of them above the early returns below.
    //
    // React requires the same number of hooks on every render. We have two
    // early returns further down (Loading and empty-state) and previously
    // both useMemo's lived AFTER them. The moment a backed vessel finished
    // loading, the render path stopped early-returning and started calling
    // those hooks, tripping React's "Rendered more hooks than during the
    // previous render" rule and white-screening the whole page. Both
    // useMemo's now live up here so hook count stays constant.

    // Backend-backed vessels show only what the API returned. Demo vessels
    // (no vesselId) fall back to the static mock list.
    const vesselSpecificMaterials = useMemo<Material[]>(() => {
        let base: Material[] = [];
        if (vesselId) {
            base = [...backendMaterials];
        } else {
            const demoId = DEMO_VESSEL_ID_MAP[vesselName];
            if (demoId) {
                base = mockMaterials
                    .map((m) => ({
                        ...m,
                        vesselId: m.vesselId || (m.zone?.includes('Deck') ? '1' : '2'),
                    }))
                    .filter((m) => m.vesselId === demoId);
            }
        }

        // Also merge local storage materials added from deck mapping
        try {
            const prefix = `inventory_${vesselName}_`;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    const stored = localStorage.getItem(k);
                    if (stored) {
                        const items = JSON.parse(stored) as any[];
                        if (Array.isArray(items)) {
                            for (const item of items) {
                                const deckName = item.deckPlan || item.deckAreaName || k.replace(prefix, '') || 'Main Deck';
                                const mappedMat: Material = {
                                    id: item.id || `LOCAL-${Date.now()}`,
                                    vesselId,
                                    name: item.name || 'Mapped Material',
                                    ihmPart: normalizeIhmPart(item.ihmPart),
                                    category: item.hmStatus === 'CHM' ? 'hazard' : item.hmStatus === 'PCHM' ? 'warning' : 'safe',
                                    status: 'Mapped',
                                    completion: 100,
                                    poNo: item.shipPO || 'PO-2026-0891',
                                    zone: deckName,
                                    materialName: item.material || item.name,
                                    equipment: item.equipment || '-',
                                    compartment: item.compartment || '-',
                                    hazardType: (item.hazMaterials && item.hazMaterials[0]) || item.material || 'HazMat',
                                    component: item.component || '-',
                                    hmStatus: item.hmStatus || 'CHM',
                                } as any;
                                if (!base.some(existing => existing.id === mappedMat.id)) {
                                    base.unshift(mappedMat);
                                }
                            }
                        }
                    }
                }
            }
        } catch {}

        return base;
    }, [vesselId, vesselName, backendMaterials]);

    const counts = useMemo(() => {
        return {
            all: vesselSpecificMaterials.length,
            part1: vesselSpecificMaterials.filter(m => m.ihmPart === 'PART I').length,
            part2: vesselSpecificMaterials.filter(m => m.ihmPart === 'PART II').length,
            part3: vesselSpecificMaterials.filter(m => m.ihmPart === 'PART III').length,
        };
    }, [vesselSpecificMaterials]);

    // While the initial fetch is in flight on a backed vessel, hold off on
    // the empty state so we don't flash "No Material Records Found" before
    // the rows arrive.
    if (vesselId && isLoading && backendMaterials.length === 0) {
        return (
            <div className="materials-container" style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                Loading materials...
            </div>
        );
    }

    if (!hasAnyMaterials || vesselSpecificMaterials.length === 0) {
        return (
            <div className="empty-state-card-full" style={{ padding: '60px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', margin: '20px 0' }}>
                <div className="empty-state-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="empty-icon-large" style={{ background: '#F1F5F9', padding: '16px', borderRadius: '50%', marginBottom: '16px', color: '#64748B' }}>
                        <Package size={44} strokeWidth={1.5} />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 8px 0' }}>No Material Record Found</h2>
                    <p style={{ fontSize: '14px', color: '#64748B', margin: 0, maxWidth: '400px' }}>
                        No material records are available for this vessel.
                    </p>
                </div>
            </div>
        );
    }

    // (vesselSpecificMaterials + counts hoisted above the early returns —
    // see the long comment higher up for the React hook-ordering reason.)

    const filteredMaterials = vesselSpecificMaterials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.id.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesTag = true;
        if (activeTag !== 'All') {
            if (activeTag === 'Part I') matchesTag = m.ihmPart === 'PART I';
            else if (activeTag === 'Part II') matchesTag = m.ihmPart === 'PART II';
            else if (activeTag === 'Part III') matchesTag = m.ihmPart === 'PART III';
            else if (activeTag === 'Non-Hazardous') matchesTag = m.category === 'safe' || m.thresholdMessage === 'Non-Hazardous';
            else if (activeTag === 'Archived') matchesTag = false;
        }



        // Side Panel Filters
        let matchesPartFilter = true;
        if (selectedParts.length > 0) {
            matchesPartFilter = selectedParts.some(p => {
                const normalizedPart = p.split(':')[0].trim().toUpperCase();
                return m.ihmPart.toUpperCase() === normalizedPart;
            });
        }

        let matchesZone = true;
        if (selectedZones.length > 0) {
            matchesZone = m.zone ? selectedZones.includes(m.zone) : false;
        }

        let matchesThreshold = true;
        if (m.thresholdValue !== undefined) {
            matchesThreshold = m.thresholdValue >= thresholdMin && m.thresholdValue <= thresholdMax;
        }

        let matchesHazard = true;
        if (hazardFilter !== 'ALL') {
            const status = ((m as any).hmStatus || '').toUpperCase();
            const cat = (m.category || '').toLowerCase();
            if (hazardFilter === 'CHM') matchesHazard = status === 'CHM' || cat === 'hazard';
            else if (hazardFilter === 'PCHM') matchesHazard = status === 'PCHM' || cat === 'warning';
            else if (hazardFilter === 'Non-CHM') matchesHazard = status === 'NON-CHM' || cat === 'safe';
        }

        return matchesSearch && matchesTag && matchesPartFilter && matchesZone && matchesThreshold && matchesHazard;
    });

    const displayedMaterials = filteredMaterials.slice(0, visibleCount);

    const handleEditClick = (material: Material) => {
        const deckName = material.zone || 'A-DECK 01';
        const params = new URLSearchParams({
            matId: material.id,
            vessel: vesselName,
            name: deckName,
        });
        if (vesselId) params.set('vesselId', vesselId);
        navigate(`/mapping?${params.toString()}`);
    };

    const handleSaveUpdate = () => {
        setIsEditing(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
    };

    return (
        <div className="materials-container">
            {showToast && (
                <div className="toast-notification">
                    <div className="toast-icon">
                        <CheckCircle size={20} />
                    </div>
                    <div className="toast-content">
                        <h4>Material Record Updated</h4>
                        <p>The changes for {editName} have been successfully saved to the registry</p>
                    </div>
                    <button className="toast-undo" onClick={() => setShowToast(false)}>Undo</button>
                    <X size={18} className="toast-close" onClick={() => setShowToast(false)} style={{ cursor: 'pointer', marginLeft: '12px', opacity: 0.6 }} />
                </div>
            )}

            <div className="materials-header">
                <div className="materials-filters">
                    <div className="search-field" style={{ maxWidth: '400px' }}>
                        <Search size={18} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="Search by material name, CAS, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Active Filters Row (Dynamic) */}
            {
                (thresholdMin > 0 || thresholdMax < 1.0 || selectedParts.length > 0 || selectedZones.length > 0) && (
                    <div className="active-filters-row">
                        <div className="active-chips-container">
                            {thresholdMin > 0 || thresholdMax < 1.0 ? (
                                <div className="filter-chip">
                                    <span>Threshold: {thresholdMin.toFixed(2)}%-{thresholdMax.toFixed(2)}%</span>
                                    <X size={12} onClick={() => { setThresholdMin(0); setThresholdMax(1.0); }} />
                                </div>
                            ) : null}

                            {selectedParts.map(part => (
                                <div className="filter-chip" key={part}>
                                    <span>{part}</span>
                                    <X size={12} onClick={() => setSelectedParts(selectedParts.filter(p => p !== part))} />
                                </div>
                            ))}

                            {selectedZones.map(zone => (
                                <div className="filter-chip" key={zone}>
                                    <span>{zone}</span>
                                    <X size={12} onClick={() => setSelectedZones(selectedZones.filter(z => z !== zone))} />
                                </div>
                            ))}
                            <span className="results-count-text">Showing {filteredMaterials.length} results</span>
                        </div>
                        <div className="clear-all-link" onClick={() => {
                            setThresholdMin(0); setThresholdMax(1.0);
                            setSelectedParts([]);
                            setSelectedZones([]);
                        }}>
                            Clear All
                        </div>
                    </div>
                )
            }

            {/* Category Pills & Hazard Filter Row */}
            <div className="category-tabs-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'All Materials', count: counts.all, key: 'All' },
                        { label: 'Part I', count: counts.part1, key: 'Part I' },
                        { label: 'Part II', count: counts.part2, key: 'Part II' },
                        { label: 'Part III', count: counts.part3, key: 'Part III' }
                    ].map(tab => (
                        <div
                            key={tab.key}
                            className={`category-tab ${activeTag === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTag(tab.key)}
                        >
                            {tab.label} ({tab.count})
                        </div>
                    ))}
                </div>

                <div className="hazard-filter-pills" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                        onClick={() => setHazardFilter('ALL')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: hazardFilter === 'ALL' ? '2px solid #0284C7' : '1px solid #E2E8F0',
                            background: hazardFilter === 'ALL' ? '#E0F2FE' : '#FFFFFF',
                            color: hazardFilter === 'ALL' ? '#0369A1' : '#64748B',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        All Hazards
                    </button>
                    <button
                        onClick={() => setHazardFilter('CHM')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: hazardFilter === 'CHM' ? '2px solid #EF4444' : '1px solid #FECACA',
                            background: hazardFilter === 'CHM' ? '#FEF2F2' : '#FFFFFF',
                            color: '#DC2626',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        🔴 CHM
                    </button>
                    <button
                        onClick={() => setHazardFilter('PCHM')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: hazardFilter === 'PCHM' ? '2px solid #F59E0B' : '1px solid #FDE68A',
                            background: hazardFilter === 'PCHM' ? '#FFFBEB' : '#FFFFFF',
                            color: '#D97706',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        🟠 PCHM
                    </button>
                    <button
                        onClick={() => setHazardFilter('Non-CHM')}
                        style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: hazardFilter === 'Non-CHM' ? '2px solid #10B981' : '1px solid #A7F3D0',
                            background: hazardFilter === 'Non-CHM' ? '#ECFDF5' : '#FFFFFF',
                            color: '#059669',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        🟢 Non-CHM
                    </button>
                </div>
            </div>

            <div className={`materials-list-container ${selectedMaterialId ? '' : ''}`}>
                <div className="materials-content-wrapper">
                    <div className={`materials-list-pane ${selectedMaterialId ? 'shrunk' : ''}`}>
                        {/* Top Scrollbar Dummy */}
                        <div
                            ref={topScrollRef}
                            style={{
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                height: '10px',
                                width: '100%',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'white'
                            }}
                        >
                            <div style={{ width: '1600px', height: '1px' }}></div>
                        </div>

                        <div className="materials-table-wrapper" ref={tableContainerRef}>
                            <table className="materials-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '280px' }}>SUBSTANCE DETAILS</th>
                                        <th style={{ minWidth: '100px' }}>DECK</th>
                                        <th style={{ minWidth: '120px' }}>PO NO</th>
                                        <th style={{ minWidth: '180px' }}>COMPONENT</th>
                                        <th style={{ minWidth: '100px', textAlign: 'center' }}>HAZMAT</th>
                                        <th style={{ minWidth: '220px' }}>MATERIAL</th>
                                        <th style={{ minWidth: '220px' }}>EQUIPMENT</th>
                                        <th style={{ minWidth: '100px' }}>IHM PART</th>
                                        <th style={{ minWidth: '160px' }}>COMPLIANCE STATUS</th>
                                        <th style={{ minWidth: '180px' }}>THRESHOLD INFO</th>
                                        <th className="sticky-col" style={{ width: '80px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedMaterials.map(item => (
                                        <tr
                                            key={item.id}
                                            onClick={() => {
                                                setSelectedMaterialId(item.id);
                                                setIsFilterPanelOpen(false);
                                            }}
                                            className={selectedMaterialId === item.id ? 'active-row' : ''}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <div className="substance-cell">
                                                    <div className={`substance-icon ${item.category}`}>
                                                        {item.category === 'hazard' && <AlertCircle size={20} />}
                                                        {item.category === 'safe' && <Database size={20} />}
                                                        {item.category === 'warning' && <Package size={20} />}
                                                    </div>
                                                    <div className="substance-info">
                                                        <h4>{item.name}</h4>
                                                        <span className="substance-id">ID: {item.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="deck-cell">{item.zone || '-'}</td>
                                            <td className="po-cell">{item.poNo || '-'}</td>
                                            <td className="component-cell">{item.component || '-'}</td>
                                            <td className="hazmat-cell" style={{ textAlign: 'center' }}>
                                                {item.hazardType && (
                                                    <span className="hazmat-text-only">
                                                        {item.hazardType}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="material-cell">{item.materialName || item.name}</td>
                                            <td className="equipment-cell">{item.equipment || '-'}</td>
                                            <td>
                                                <span className="part-badge">{item.ihmPart}</span>
                                            </td>
                                            <td className="compliance-cell">
                                                <div className={`status-badge-text ${item.status === 'Certified' || item.status === 'Verified' ? 'certified' : item.status === 'Pending Survey' ? 'pending' : 'in-progress'}`}>
                                                    {item.status}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`threshold-text ${item.thresholdType}`}>
                                                    {item.thresholdMessage}
                                                </span>
                                            </td>
                                            <td className="sticky-col">
                                                <div className="action-arrow">
                                                    <ChevronRight size={20} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Load More Footer within List Pane */}
                            <div style={{
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                borderTop: '1px solid #f1f5f9'
                            }}>
                                <span style={{ fontSize: '13px', color: '#64748B' }}>
                                    Showing {displayedMaterials.length} of {filteredMaterials.length} results
                                </span>
                                {displayedMaterials.length < filteredMaterials.length && (
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                        style={{
                                            background: '#0F172A',
                                            color: 'white',
                                            border: 'none',
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        Load More <ChevronDown size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedMaterialId && (() => {
                        const selected = vesselSpecificMaterials.find(m => m.id === selectedMaterialId);
                        if (!selected) return null;
                        const riskLabel = selected.category === 'hazard' ? 'High Risk'
                            : selected.category === 'warning' ? 'Medium Risk'
                            : 'Low Risk';
                        const hasThreshold = typeof selected.thresholdValue === 'number';
                        return (
                        <div className="materials-details-pane">
                            <div className="details-panel-header">
                                <h2 style={{ fontSize: isEditing ? '16px' : '20px', textTransform: isEditing ? 'uppercase' : 'none', letterSpacing: isEditing ? '0.05em' : 'normal' }}>
                                    {isEditing ? 'Edit Material Details' : selected.name}
                                </h2>
                                {!isEditing && (
                                    <div className="po-badge">
                                        <Package size={14} />
                                        <span>PO: {selected.poNo || 'N/A'}</span>
                                    </div>
                                )}
                                <button className="close-panel-btn" onClick={() => { setSelectedMaterialId(null); setIsEditing(false); }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {isEditing ? (
                                <div className="edit-mode-container" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <div className="details-section" style={{ flex: 1 }}>
                                        <div className="edit-form-group">
                                            <label>MATERIAL NAME</label>
                                            <input
                                                type="text"
                                                className="edit-form-input"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div className="edit-form-group">
                                                <label>PO NUMBER</label>
                                                <input
                                                    type="text"
                                                    className="edit-form-input"
                                                    value={editPO}
                                                    onChange={(e) => setEditPO(e.target.value)}
                                                />
                                            </div>
                                            <div className="edit-form-group">
                                                <label>RISK LEVEL</label>
                                                <div className="edit-risk-select">
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="risk-dot"></div> {editRisk}
                                                    </span>
                                                    <ChevronDown size={16} color="#94a3b8" />
                                                </div>
                                            </div>
                                        </div>

                                        <h3 style={{ marginTop: '24px' }}>THRESHOLD MONITORING <span className="critical-badge">CRITICAL</span></h3>
                                        <div className="monitoring-visual-row" style={{ marginTop: '16px' }}>
                                            <div className="circular-dial-container">
                                                <div className="circular-ring">
                                                    <div className="circular-inner">110%</div>
                                                </div>
                                            </div>
                                            <div className="monitoring-stats">
                                                <div className="stat-label">CURRENT VALUE (MG/KG)</div>
                                                <div className="stat-value" style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '18px' }}>
                                                    1.1
                                                </div>
                                            </div>
                                        </div>

                                        <div className="monitoring-progress-bar">
                                            <div className="monitoring-fill" style={{ width: '100%' }}></div>
                                        </div>

                                        <div className="secondary-substances-grid">
                                            <div className="sec-sub-card">
                                                <div className="sec-sub-header">
                                                    <span className="sec-sub-name">SUBSTANCE A</span>
                                                    <CheckCircle size={14} color="#10b981" />
                                                </div>
                                                <div className="sec-sub-bar"><div className="sec-sub-fill" style={{ width: '40%', background: '#10b981' }}></div></div>
                                                <div className="sec-sub-val">0.2 / 2.0 <span style={{ fontSize: '10px', color: '#64748b' }}>mg/kg</span></div>
                                            </div>
                                            <div className="sec-sub-card">
                                                <div className="sec-sub-header">
                                                    <span className="sec-sub-name">SUBSTANCE B</span>
                                                    <AlertCircle size={14} color="#f59e0b" />
                                                </div>
                                                <div className="sec-sub-bar"><div className="sec-sub-fill" style={{ width: '85%', background: '#f59e0b' }}></div></div>
                                                <div className="sec-sub-val">0.85 / 1.0 <span style={{ fontSize: '10px', color: '#64748b' }}>mg/kg</span></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="edit-footer">
                                        <button className="cancel-btn-outline" onClick={() => setIsEditing(false)}>CANCEL</button>
                                        <button className="save-btn-primary" onClick={handleSaveUpdate}>
                                            <Database size={18} /> SAVE CHANGES
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="view-mode-container">
                                    <div className="details-section">
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '4px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div>
                                            SUBSTANCE INFORMATION
                                        </h3>
                                        <div className="substance-info-grid">
                                            <div className="substance-info-card">
                                                <label>MATERIAL NAME</label>
                                                <span>{selected.name || '-'}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>PO NUMBER</label>
                                                <span>{selected.poNo || 'N/A'}</span>
                                            </div>
                                            <div className="substance-info-card risk-card">
                                                <label>RISK LEVEL</label>
                                                <span><div className="risk-dot"></div> {riskLabel}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>IHM PART</label>
                                                <span>{selected.ihmPart || '-'}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>DECK / ZONE</label>
                                                <span>{selected.zone || '-'}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>EQUIPMENT</label>
                                                <span>{selected.equipment || '-'}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>COMPARTMENT</label>
                                                <span>{selected.compartment || '-'}</span>
                                            </div>
                                            <div className="substance-info-card">
                                                <label>STATUS</label>
                                                <span>{selected.status || '-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {hasThreshold && (
                                        <div className="details-section">
                                            <div className="monitoring-header">
                                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                                    <div style={{ width: '4px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div>
                                                    THRESHOLD MONITORING
                                                </h3>
                                                {selected.thresholdType === 'limit-exceeded' && (
                                                    <span className="critical-badge">CRITICAL LIMIT</span>
                                                )}
                                            </div>

                                            <div className="monitoring-visual-row">
                                                <div className="circular-dial-container">
                                                    <div className="circular-ring">
                                                        <div className="circular-inner">{Math.round((selected.thresholdValue || 0) * 100)}%</div>
                                                    </div>
                                                </div>
                                                {selected.thresholdMessage && (
                                                    <div className="monitoring-stats">
                                                        <div className="stat-label">STATUS</div>
                                                        <div className="stat-value" style={{ fontSize: '14px' }}>{selected.thresholdMessage}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="monitoring-progress-bar">
                                                <div className="monitoring-fill" style={{ width: `${Math.min(100, (selected.thresholdValue || 0) * 100)}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="panel-footer">
                                        <button className="edit-details-btn-full" onClick={() => handleEditClick(selected)}>EDIT MATERIAL DETAILS</button>
                                        <button className="more-options-btn"><MoreVertical size={18} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })()}
                    {/* Filter Side Panel */}
                    {isFilterPanelOpen && (
                        <div className="filter-side-panel">
                            <div className="filter-panel-header">
                                <h2>Refine Materials</h2>
                                <button className="close-filter-btn" onClick={() => setIsFilterPanelOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="filter-scroll-content">
                                <div className="filter-group">
                                    <div className="filter-label-row">
                                        <label>THRESHOLD RANGE (%)</label>
                                        <div className="range-badges">
                                            <span className="badge-dark">{thresholdMin.toFixed(2)}%</span>
                                            <span className="badge-dark">{thresholdMax.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                    <div className="range-slider-mock" style={{ padding: '0 8px' }}>
                                        {/* Simple dual range slider using two inputs */}
                                        <div className="dual-slider-container" style={{ position: 'relative', height: '40px', width: '100%' }}>
                                            <div className="slider-track-bg" style={{
                                                position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: '4px', background: '#E2E8F0', borderRadius: '2px'
                                            }} />
                                            <div className="slider-track-fill" style={{
                                                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                                left: `${(thresholdMin / 1.0) * 100}%`,
                                                width: `${((thresholdMax - thresholdMin) / 1.0) * 100}%`,
                                                height: '4px', background: '#3B82F6', borderRadius: '2px'
                                            }} />
                                            <input
                                                type="range"
                                                min="0" max="1.0" step="0.01"
                                                value={thresholdMin}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (val < thresholdMax) setThresholdMin(val);
                                                }}
                                                style={{
                                                    position: 'absolute', top: '0', height: '100%', width: '100%',
                                                    pointerEvents: 'none', appearance: 'none', background: 'transparent', zIndex: 10, margin: 0
                                                }}
                                                className="thumb-input"
                                            />
                                            <input
                                                type="range"
                                                min="0" max="1.0" step="0.01"
                                                value={thresholdMax}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (val > thresholdMin) setThresholdMax(val);
                                                }}
                                                style={{
                                                    position: 'absolute', top: '0', height: '100%', width: '100%',
                                                    pointerEvents: 'none', appearance: 'none', background: 'transparent', zIndex: 11, margin: 0
                                                }}
                                                className="thumb-input"
                                            />
                                        </div>
                                        <style>{`
                                            .thumb-input::-webkit-slider-thumb {
                                                pointer-events: auto;
                                                appearance: none;
                                                width: 16px;
                                                height: 16px;
                                                background: white;
                                                border: 2px solid #3B82F6;
                                                border-radius: 50%;
                                                cursor: pointer;
                                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                                position: relative;
                                                z-index: 20;
                                            }
                                        `}</style>
                                        <div className="range-labels-bottom">
                                            <span>Min (0%)</span>
                                            <span>Max (1.0%)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>IHM PART CLASSIFICATION</label>
                                    <div className="checkbox-group">
                                        {['Part I: Structure/Equipment', 'Part II: Operationally Generated', 'Part III: Stores'].map(p => {
                                            const key = p.split(':')[0].trim(); // "Part I"
                                            const isChecked = selectedParts.includes(key);
                                            return (
                                                <div
                                                    key={p}
                                                    className={`checkbox-item ${isChecked ? 'active' : ''}`}
                                                    onClick={() => {
                                                        if (isChecked) setSelectedParts(selectedParts.filter(i => i !== key));
                                                        else setSelectedParts([...selectedParts, key]);
                                                    }}
                                                >
                                                    <div className={`custom-checkbox ${isChecked ? 'checked' : ''}`}>
                                                        {isChecked && <CheckCircle size={10} color="white" />}
                                                    </div>
                                                    <span>{p}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>VESSEL ZONE</label>
                                    <div className="zone-grid">
                                        {['Engine Room', 'Deck', 'Pump Room', 'Hull', 'Accomodation'].map(zone => (
                                            <button
                                                key={zone}
                                                className={`zone-btn ${selectedZones.includes(zone) ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (selectedZones.includes(zone)) setSelectedZones(selectedZones.filter(z => z !== zone));
                                                    else setSelectedZones([...selectedZones, zone]);
                                                }}
                                            >
                                                {zone}
                                            </button>
                                        ))}
                                        <button className="zone-btn">+3 More</button>
                                    </div>
                                </div>

                                <div className="filter-group">
                                    <label>CHEMICAL GROUP</label>
                                    <div className="select-input-mock">
                                        <span>{selectedChemicalGroup}</span>
                                        <MoreVertical size={16} style={{ transform: 'rotate(90deg)' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="filter-panel-footer">
                                <button className="apply-filters-btn" onClick={() => setIsFilterPanelOpen(false)}>Apply Filters</button>
                                <button className="reset-filters-btn" onClick={() => {
                                    setThresholdMin(0.0);
                                    setThresholdMax(1.0);
                                    setSelectedParts([]);
                                    setSelectedZones([]);
                                    setSelectedChemicalGroup('All Chemical Groups');
                                }}>RESET TO DEFAULT</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
