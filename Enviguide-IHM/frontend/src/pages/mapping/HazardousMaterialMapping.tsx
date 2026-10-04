import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutGrid,
    Plus,
    Search,
    Filter,
    Flame,
    MapPin,
    ChevronDown,
    RotateCcw,
    Upload,
    X,
    ZoomIn,
    ZoomOut,
    FileText,
    Eye,
    Ship,
    Calendar,
    ChevronLeft,
    Check,
    AlertTriangle
} from 'lucide-react';
import './HazardousMaterialMapping.css';

interface MaterialEntry {
    id: string;
    avoidUpdation: boolean;
    movementType: string;
    ihmPart: string;
    hazMaterials: string[];
    deckPlan: string;
    shipPO: string;
    name: string;
    compartment: string;
    equipment: string;
    position: string;
    component: string;
    material: string;
    quantity: string;
    unit: string;
    hmStatus: 'CHM' | 'PCHM' | 'Non-CHM';
    files: string[];
    pin: { x: number; y: number } | null;
    category?: string;
    description?: string;
    manufacturer?: string;
    ihmPartNumber?: string;
    equipmentClass?: string;
    noOfPieces?: string;
    totalQuantity?: string;
    createdDate?: string;
    updatedDate?: string;
    remarks?: string;
}

import type { Material } from '../../types/index';

import { PLAN_GENERIC } from '../../assets/ship_plans';
import { api } from '../../lib/apiClient';
import { ENDPOINTS, API_CONFIG } from '../../config/api.config';

/** Backend → MaterialEntry shape used by this page. Backend stores
 *  hazard_type as a single string; the form keeps an array, so we wrap. */
function backendToEntry(m: Record<string, unknown>): MaterialEntry {
    const px = m.pin && typeof m.pin === 'object' ? (m.pin as { x?: number; y?: number }).x : undefined;
    const py = m.pin && typeof m.pin === 'object' ? (m.pin as { x?: number; y?: number }).y : undefined;
    return {
        id: String(m.id),
        avoidUpdation: Boolean(m.avoidUpdation),
        movementType: (m.movementType as string) || '',
        ihmPart: (m.ihmPart as string) || '',
        hazMaterials: m.hazardType ? [m.hazardType as string] : [],
        deckPlan: (m.deckAreaName as string) || (m.deckName as string) || '',
        shipPO: (m.shipPO as string) || '',
        name: (m.name as string) || '',
        compartment: (m.compartment as string) || '',
        equipment: (m.equipment as string) || '',
        position: (m.position as string) || '',
        component: (m.component as string) || '',
        material: (m.materialName as string) || '',
        quantity: (m.quantity as string) || '',
        unit: (m.unit as string) || 'kg',
        hmStatus: ((m.hmStatus as string) || 'CHM').toUpperCase() === 'PCHM' ? 'PCHM' : 'CHM',
        files: [],
        pin: typeof px === 'number' && typeof py === 'number' ? { x: px, y: py } : null,
        description: (m.description as string) || '',
        manufacturer: (m.manufacturer as string) || '',
        ihmPartNumber: (m.ihmPartNumber as string) || '',
        equipmentClass: (m.equipmentClass as string) || '',
        noOfPieces: (m.noOfPieces as string) || '',
        totalQuantity: (m.totalQuantity as string) || '',
        remarks: (m.remarks as string) || '',
    };
}

/** Pull just `Part I` / `Part II` / `Part III` out of the dropdown's
 *  human-readable label for the backend's strict validator. */
function shortIhmPart(raw: string): string {
    const s = (raw || '').toLowerCase();
    if (s.includes('part iii')) return 'Part III';
    if (s.includes('part ii')) return 'Part II';
    return 'Part I';
}

/** Form payload → backend body. Drops fields the backend doesn't store
 *  (deckPlan label, hazMaterials array). */
function entryToBackendBody(entry: Omit<MaterialEntry, 'id' | 'pin'>, pin: { x: number; y: number } | null) {
    return {
        name: entry.name,
        ihmPart: shortIhmPart(entry.ihmPart),
        category: entry.hmStatus === 'CHM' ? 'hazard' : 'warning',
        hazardType: entry.hazMaterials[0] || null,
        hmStatus: entry.hmStatus,
        equipmentClass: entry.equipmentClass || null,
        quantity: entry.quantity || null,
        unit: entry.unit || null,
        noOfPieces: entry.noOfPieces || null,
        totalQuantity: entry.totalQuantity || null,
        compartment: entry.compartment || null,
        equipment: entry.equipment || null,
        position: entry.position || null,
        component: entry.component || null,
        materialName: entry.material || null,
        shipPO: entry.shipPO || null,
        movementType: entry.movementType || null,
        manufacturer: entry.manufacturer || null,
        ihmPartNumber: entry.ihmPartNumber || null,
        description: entry.description || null,
        remarks: entry.remarks || null,
        avoidUpdation: Boolean(entry.avoidUpdation),
        pin,
    };
}

export default function HazardousMaterialMapping() {
    const location = useLocation();
    const navigate = useNavigate();
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const { user } = useAuth();

    const isReadOnly = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || '').toLowerCase();
        const isOwnerOrManager = role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role === 'vessel' || role.includes('owner') || role.includes('manager') || role.includes('vessel');
        const isReadOnlyQuery = query.get('readOnly') === 'true';
        return isOwnerOrManager || isReadOnlyQuery;
    }, [user, query]);

    let rawUrl = (query.get('url') || query.get('planUrl') || '').trim();
    let fileUrl = rawUrl;
    if (!fileUrl || fileUrl === 'undefined' || fileUrl === 'null' || fileUrl.includes('ga_plan_')) {
        fileUrl = PLAN_GENERIC;
    } else if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
        const cleanPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
        fileUrl = `${API_CONFIG.BASE_URL.replace(/\/+$/, '')}${cleanPath}`;
    }
    const sectionName = (query.get('name') || query.get('deckTitle') || query.get('deckName') || 'A-DECK 01').trim();
    const rect = {
        x: parseFloat(query.get('x') || '0'),
        y: parseFloat(query.get('y') || '0'),
        w: parseFloat(query.get('w') || '1000'),
        h: parseFloat(query.get('h') || '700')
    };
    const vesselId = query.get('vesselId') || '';
    const deckAreaId = query.get('deckAreaId') || query.get('deckId') || '';

    const [effectiveVesselId, setEffectiveVesselId] = useState<string>(vesselId);

    const [zoom, setZoom] = useState(100);
    const [viewMode, setViewMode] = useState<'list' | 'add' | 'detail'>('list');
    const [activeTool, setActiveTool] = useState<'none' | 'pin'>('none');
    const vesselName = query.get('vessel') || 'Unknown Vessel';
    const [inventory, setInventory] = useState<MaterialEntry[]>([]);
    const lastLoadedKeyRef = useRef("");
    const [searchQuery] = useState('');
    const [tempPin, setTempPin] = useState<{ x: number, y: number } | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });

    const [availableDecks, setAvailableDecks] = useState<any[]>([]);
    const [deckSelectorOpen, setDeckSelectorOpen] = useState(false);
    const [targetDeckForTransfer, setTargetDeckForTransfer] = useState<string | null>(null); // New state for pending transfer

    useEffect(() => {
        if (!effectiveVesselId && vesselName) {
            api.get<{ success: boolean; data: any[] }>(ENDPOINTS.VESSELS.LIST)
                .then(res => {
                    const list = res.data || [];
                    const found = list.find((v: any) => v.name?.toLowerCase() === vesselName.toLowerCase());
                    if (found && (found.id || found.vesselId)) {
                        setEffectiveVesselId(String(found.id || found.vesselId));
                    }
                })
                .catch(() => {});
        }
    }, [vesselName, effectiveVesselId]);

    useEffect(() => {
        const sections = localStorage.getItem(`vessel_sections_${vesselName}`);
        if (sections) {
            setAvailableDecks(JSON.parse(sections));
        }
    }, [vesselName]);

    // Handle incoming material transfer
    useEffect(() => {
        if (location.state && location.state.transferMaterial) {
            const transfer = location.state.transferMaterial;
            setTransferringMaterialId(transfer.id || null);
            setViewingMaterial(null);
            setViewMode('add');
            setActiveTool('pin');
            // Pre-fill form with transferred data
            setFormData({
                avoidUpdation: transfer.avoidUpdation || false,
                movementType: transfer.movementType || '',
                ihmPart: transfer.ihmPart || '',
                hazMaterials: transfer.hazMaterials || [],
                files: transfer.files || [],
                description: transfer.description || '',
                manufacturer: transfer.manufacturer || '',
                ihmPartNumber: transfer.ihmPartNumber || '',
                compartment: transfer.compartment || '',
                // Required fields from interface
                name: transfer.name || '',
                deckPlan: sectionName || '', // We are on the new deck now
                shipPO: transfer.shipPO || '',
                equipment: transfer.equipment || '',
                position: transfer.position || '',
                component: transfer.component || '',
                material: transfer.material || '',
                quantity: transfer.quantity || '',
                unit: transfer.unit || '',
                hmStatus: transfer.hmStatus || 'CHM'
            });
            // Clear navigation state to prevent re-triggering on refresh
            window.history.replaceState({}, document.title);

            setTimeout(() => {
                setBannerMessage({
                    title: `RE-MAPPING INITIATED: ${transfer.name}`,
                    body: `Technical details have been pre-filled. Please click on the plan to set the new location for this material on ${sectionName}.`,
                    type: 'info'
                });
            }, 600);
        }
    }, [location.state, sectionName]);

    // Constants for GA plan size - Use high-res 2000px for clarity
    const CROPPER_WIDTH = 1000;

    const wrapperRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<Omit<MaterialEntry, 'id' | 'pin'>>({
        avoidUpdation: false,
        movementType: '',
        ihmPart: '',
        hazMaterials: [],
        deckPlan: sectionName,
        shipPO: '',
        name: '',
        compartment: '',
        equipment: '',
        position: '',
        component: '',
        material: '',
        quantity: '',
        unit: 'kg',
        noOfPieces: '1',
        totalQuantity: '0.01',
        createdDate: new Date().toISOString().split('T')[0],
        updatedDate: new Date().toISOString().split('T')[0],
        remarks: '',
        equipmentClass: '',
        hmStatus: 'CHM',
        files: [] as string[]
    });

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [viewingMaterial, setViewingMaterial] = useState<MaterialEntry | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [bannerMessage, setBannerMessage] = useState<{ title: string; body: string; type: 'info' | 'error' } | null>(null);
    const [transferringMaterialId, setTransferringMaterialId] = useState<string | null>(null);

    const validationTimerRef = useRef<any>(null);
    const triggerValidationError = (msg: string) => {
        if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
        setValidationError(msg);
        validationTimerRef.current = setTimeout(() => {
            setValidationError(null);
        }, 3000);
    };

    const getHazardColor = (item: MaterialEntry) => {
        const status = (item.hmStatus || '').toUpperCase();
        const category = (item.category || '').toLowerCase();
        if (status === 'CHM' || category === 'hazard' || category === 'high') return '#EF4444'; // Red
        if (status === 'PCHM' || category === 'warning' || category === 'medium') return '#F59E0B'; // Amber/Orange
        if (status === 'NON-CHM' || status === 'SAFE' || category === 'safe' || category === 'low') return '#10B981'; // Green
        return '#EF4444';
    };

    // Initial mode check and focus on crop
    useEffect(() => {
        // 1. Sync inventory when deck or vessel changes. Backed vessels
        //    pull from the API; demo / non-backed vessels still hit
        //    localStorage so the wizard works without a backend record.
        const matId = query.get('matId');
        const key = `inventory_${vesselName}_${sectionName}`;
        lastLoadedKeyRef.current = key;

        let cancelled = false;
        if (vesselId) {
            (async () => {
                try {
                    const params = deckAreaId ? `?deckAreaId=${encodeURIComponent(deckAreaId)}` : '';
                    const res = await api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(
                        ENDPOINTS.MATERIALS.LIST(vesselId) + params,
                    );
                    if (cancelled) return;
                    const entries = (res.data || []).map(backendToEntry);
                    setInventory(entries);
                    if (matId) {
                        const found = entries.find((i) => i.id === matId);
                        if (found) {
                            setViewingMaterial(found);
                            setViewMode('detail');
                        }
                    }
                } catch (err) {
                    console.error('Failed to load materials from backend:', err);
                    if (!cancelled) setInventory([]);
                }
            })();
        } else {
            const stored = localStorage.getItem(key);
            const parsed = stored ? JSON.parse(stored) : [];
            setInventory(parsed);
            if (matId) {
                const found = parsed.find((i: MaterialEntry) => i.id === matId);
                if (found) {
                    setViewingMaterial(found);
                    setViewMode('detail');
                }
            }
        }

        // 3. Handle mode add
        if (query.get('mode') === 'add') {
            setViewMode('add');
            setActiveTool('pin');
        }

        const updatePosition = () => {
            const viewport = wrapperRef.current?.getBoundingClientRect();
            if (viewport && viewport.width > 0) {
                // Cap zoom to 150% (1.5) to keep it "personal size" and clear
                const initialZoom = 100; // Fixed "personal size" zoom at 100%
                setZoom(initialZoom);

                // Center precisely
                setOffset({
                    x: (viewport.width / 2) - ((rect.w / 2) * initialZoom / 100),
                    y: (viewport.height / 2) - ((rect.h / 2) * initialZoom / 100)
                });
            }
        };

        // Run with a small delay to ensure layout is ready
        const timer = setTimeout(updatePosition, 100);
        window.addEventListener('resize', updatePosition);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [rect.w, rect.h, query, vesselName, sectionName, vesselId, deckAreaId]);

    // Save to localStorage whenever inventory changes — both for backed and
    // non-backed vessels so the deck material log view always stays synced.
    useEffect(() => {
        const key = `inventory_${vesselName}_${sectionName}`;
        if (inventory.length > 0) {
            localStorage.setItem(key, JSON.stringify(inventory));
            window.dispatchEvent(new Event('storage'));
        }
    }, [inventory, sectionName, vesselName]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (isReadOnly) return;
        if (activeTool === 'pin') {
            const frameRect = e.currentTarget.getBoundingClientRect();
            // Get local coordinates within the crop area
            const localX = (e.clientX - frameRect.left) / (zoom / 100);
            const localY = (e.clientY - frameRect.top) / (zoom / 100);

            // Convert to absolute GA coordinates
            const x = localX + rect.x;
            const y = localY + rect.y;

            setTempPin({ x, y });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'none') {
            setIsPanning(true);
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning && activeTool === 'none') {
            const dx = e.clientX - lastPanPoint.current.x;
            const dy = e.clientY - lastPanPoint.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleZoom = (delta: number) => {
        const newZoom = Math.min(800, Math.max(10, zoom + delta)); // Increased max zoom for small crops
        if (newZoom === zoom) return;

        const viewport = wrapperRef.current?.getBoundingClientRect();
        if (viewport) {
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;

            // Calculate position relative to container
            const containerRelX = (centerX - offset.x) / (zoom / 100);
            const containerRelY = (centerY - offset.y) / (zoom / 100);

            setOffset({
                x: centerX - containerRelX * (newZoom / 100),
                y: centerY - containerRelY * (newZoom / 100)
            });
            setZoom(newZoom);
        } else {
            setZoom(newZoom);
        }
    };



    const resetFormAfterCreate = () => {
        setValidationError(null);
        setTempPin(null);
        setFormData({
            avoidUpdation: false,
            movementType: '',
            ihmPart: '',
            hazMaterials: [],
            deckPlan: sectionName,
            shipPO: '',
            name: '',
            compartment: '',
            equipment: '',
            position: '',
            component: '',
            material: '',
            quantity: '',
            unit: 'kg',
            noOfPieces: '1',
            totalQuantity: '0.01',
            createdDate: new Date().toISOString().split('T')[0],
            updatedDate: new Date().toISOString().split('T')[0],
            remarks: '',
            equipmentClass: '',
            hmStatus: 'CHM',
            files: [] as string[]
        });
        setViewMode('list');
        setActiveTool('none');
    };

    const handleAddMaterial = async () => {
        if (!tempPin) {
            triggerValidationError("Please drop a pin on the deck plan first.");
            return;
        }

        if (!formData.name || !formData.ihmPart || formData.hazMaterials.length === 0) {
            triggerValidationError("Please fill in all required fields (Name, IHM Part, and Hazardous Materials).");
            return;
        }

        // Backed vessel — persist via the API and re-use the server id.
        if (vesselId) {
            try {
                const body = {
                    ...entryToBackendBody(formData, tempPin),
                    ...(deckAreaId ? { deckAreaId } : {}),
                };
                
                if (transferringMaterialId) {
                    // Update existing material via PUT!
                    const res = await api.put<{ success: boolean; data: Record<string, unknown> }>(
                        ENDPOINTS.MATERIALS.DETAIL(vesselId, transferringMaterialId),
                        body
                    );
                    const updated = backendToEntry({ ...res.data, deckAreaName: sectionName });
                    if (deckAreaId && String(res.data.deckAreaId || res.data.deckArea) !== String(deckAreaId)) {
                        setInventory((prev) => prev.filter(i => i.id !== transferringMaterialId));
                    } else {
                        setInventory((prev) => prev.map(i => i.id === transferringMaterialId ? updated : i));
                    }
                } else {
                    // Create new
                    const res = await api.post<{ success: boolean; data: Record<string, unknown> }>(
                        ENDPOINTS.MATERIALS.LIST(vesselId),
                        body,
                    );
                    const created = backendToEntry({ ...res.data, deckAreaName: sectionName });
                    setInventory((prev) => [...prev, created]);
                }
                
                setTransferringMaterialId(null);
                resetFormAfterCreate();
            } catch (err) {
                console.error('Failed to create material:', err);
                triggerValidationError('Could not save the material. Please try again.');
            }
            return;
        }

        // Demo / non-backed vessel — keep the localStorage flow.
        const newEntry: MaterialEntry = {
            id: transferringMaterialId || Date.now().toString(),
            ...formData,
            pin: tempPin,
        };
        setInventory((prev) => [...prev, newEntry]);

        const recordMaterial: Material = {
            id: `MAPPED-${newEntry.id}`,
            name: newEntry.name,
            ihmPart: newEntry.ihmPart,
            category: newEntry.hmStatus === 'CHM' ? 'hazard' : 'warning',
            status: 'Verified',
            completion: 100,
            zone: sectionName,
            poNo: newEntry.shipPO,
            component: newEntry.component,
            materialName: newEntry.material,
            hazardType: newEntry.hazMaterials[0] || '',
            equipment: newEntry.equipment,
        };
        const vesselInventoryKey = `vessel_inventory_${vesselName}`;
        const existingVesselInv: Material[] = JSON.parse(localStorage.getItem(vesselInventoryKey) || '[]');
        
        let updatedVesselInv = existingVesselInv;
        if (transferringMaterialId) {
            updatedVesselInv = existingVesselInv.filter(i => i.id !== `MAPPED-${transferringMaterialId}`);
        }
        localStorage.setItem(vesselInventoryKey, JSON.stringify([...updatedVesselInv, recordMaterial]));

        setTransferringMaterialId(null);
        resetFormAfterCreate();
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.material.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [inventory, searchQuery]);

    const groupedInventory = useMemo(() => {
        const groups: { [key: string]: MaterialEntry[] } = {};
        filteredInventory.forEach(item => {
            const group = (item.material || 'UNSPECIFIED').toUpperCase();
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
        });
        return groups;
    }, [filteredInventory]);

    const [hoveredMaterialId, setHoveredMaterialId] = useState<string | null>(null);

    const [highlightedMaterialId, setHighlightedMaterialId] = useState<string | null>(null);

    const handlePinClick = (id: string) => {
        setHighlightedMaterialId(id);

        // Find element and scroll
        setTimeout(() => {
            const el = document.getElementById(`material-card-${id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);

        // Remove highlight after animation
        setTimeout(() => {
            setHighlightedMaterialId(null);
        }, 1500);
    };

    return (
        <div className="hazmat-mapping-page">
            <header className="mapping-header-v5">
                <div className="h-left-v5">
                    <button className="back-btn-v5" onClick={() => {
                        if (window.opener && !window.opener.closed) {
                            window.close();
                        } else if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/decks');
                        }
                    }}>
                        <ChevronLeft size={20} />
                    </button>
                    <div className="logo-group-v5">
                        <Ship size={22} className="logo-icon-v5 sailing-logo" />
                        <strong>IHM</strong>
                        <span>Hazardous Material Mapping</span>
                    </div>
                </div>

            </header>

            <div className="mapping-main-v5">
                <main className="viewer-viewport-v5"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}>

                    <div className="toolbelt-floating-v5">
                        <div className="t-cluster">
                            <button onClick={() => handleZoom(10)} title="Zoom In">
                                <ZoomIn size={20} />
                            </button>
                            <button onClick={() => handleZoom(-10)} title="Zoom Out">
                                <ZoomOut size={20} />
                            </button>
                            <button className="reset-label-v5" onClick={() => {
                                const viewport = wrapperRef.current?.getBoundingClientRect();
                                if (viewport) {
                                    const initialZoom = 100;
                                    setZoom(initialZoom);
                                    setOffset({
                                        x: (viewport.width / 2) - ((rect.w / 2) * initialZoom / 100),
                                        y: (viewport.height / 2) - ((rect.h / 2) * initialZoom / 100)
                                    });
                                }
                            }}>
                                <RotateCcw size={14} /> RESET
                            </button>
                        </div>
                    </div>

                    <div className="pan-surface-v5" ref={wrapperRef}>
                        <div className="coord-scaler" style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100})`,
                            cursor: activeTool === 'pin' ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                            transformOrigin: '0 0'
                        }}>
                            <div className="crop-container-v5"
                                style={{ width: rect.w, height: rect.h }}
                                onClick={handleCanvasClick}>


                                <img
                                    src={fileUrl}
                                    alt="Ship Section"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = PLAN_GENERIC;
                                    }}
                                    style={{
                                        position: 'absolute',
                                        left: -rect.x,
                                        top: -rect.y,
                                        width: CROPPER_WIDTH,
                                        maxWidth: 'none'
                                    }}
                                />

                                {inventory.map(item => {
                                    // If we are viewing a specific material detail, only show its pin
                                    const shouldShowPin = viewingMaterial ? item.id === viewingMaterial.id : true;
                                    const isHovered = hoveredMaterialId === item.id;

                                    return item.pin && shouldShowPin && (
                                        <div key={item.id} className="pin-marker-v5"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePinClick(item.id);
                                            }}
                                            style={{
                                                left: item.pin.x - rect.x,
                                                top: item.pin.y - rect.y,
                                                transform: `translate(-50%, -50%) scale(${100 / zoom})`,
                                                color: isHovered ? '#DC2626' : getHazardColor(item),
                                                zIndex: isHovered ? 100 : 10,
                                                cursor: 'pointer'
                                            }}>
                                            <div className="pin-icon-box" style={{ filter: isHovered ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' : undefined }}>
                                                <Flame size={isHovered ? 26 : 20} fill="currentColor" />
                                            </div>
                                        </div>
                                    );
                                })}

                                {tempPin && viewMode === 'add' && (
                                    <div className="pin-marker-v5 ghost"
                                        style={{
                                            left: tempPin.x - rect.x,
                                            top: tempPin.y - rect.y,
                                            transform: `translate(-50%, -50%) scale(${100 / zoom})`
                                        }}>
                                        <div className="pin-icon-box">
                                            <Flame size={20} fill="currentColor" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bottom-info-pill">
                        <div className="pill-content">
                            <span>CURRENT VIEW:</span>
                            <strong>{sectionName}</strong>
                        </div>
                    </div>
                </main>

                <aside className="inventory-v5-side">
                    {viewMode === 'list' && (
                        <>
                            <div className="v5-side-header">
                                <div className="v5-h-top">
                                    <div className="v5-title">
                                        <LayoutGrid size={18} color="#1E3A8A" />
                                        <h3>MATERIAL INVENTORY</h3>
                                    </div>
                                    <div className="v5-controls">
                                        <Filter size={18} style={{ cursor: 'pointer' }} />
                                        <Search size={18} style={{ cursor: 'pointer' }} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="v5-inventory-list">
                        {viewMode === 'list' ? (
                            Object.entries(groupedInventory).length === 0 ? (
                                <div className="v5-empty-state">No materials found.</div>
                            ) : (
                                Object.entries(groupedInventory).map(([cat, items]) => (
                                    <div key={cat} className="v5-cat-group">
                                        <div className="v5-cat-header">
                                            <div className="v5-cat-pill" />
                                            <span className="v5-cat-name">{cat}</span>
                                            <span className="v5-cat-meta">{items.length} Items</span>
                                        </div>
                                        <div className="v5-cat-items">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    id={`material-card-${item.id}`}
                                                    className={`v5-item-card ${highlightedMaterialId === item.id ? 'pin-highlight' : ''}`}
                                                    onClick={() => { setViewingMaterial(item); setViewMode('detail'); }}
                                                    onMouseEnter={() => setHoveredMaterialId(item.id)}
                                                    onMouseLeave={() => setHoveredMaterialId(null)}
                                                >
                                                    <div className="v5-card-inner">
                                                        <div className="v5-selection-rail">
                                                            <div className={`v5-check-circle ${viewingMaterial?.id === item.id ? 'checked' : ''}`}>
                                                                {viewingMaterial?.id === item.id && <Check size={14} strokeWidth={3} className="check-mark" />}
                                                            </div>
                                                        </div>
                                                        <div className="v5-card-data">
                                                            <div className="v5-data-top">
                                                                <h4>{item.name}</h4>
                                                                <span className={`v5-status-tag ${item.hmStatus.toLowerCase() === 'chm' ? 'in-use' : 'mapped'}`}>
                                                                    {item.hmStatus.toLowerCase() === 'chm' ? 'IN USE' : 'MAPPED'}
                                                                </span>
                                                            </div>
                                                            <div className="v5-data-sub">{item.material}</div>
                                                            <p className="v5-data-desc">
                                                                {item.ihmPart || 'Part I Materials contained in ship structure or equipment - I-2'}
                                                            </p>

                                                            <div className="v5-location-box">
                                                                <span className="v5-loc-label">Location Details:</span>
                                                                <p className="v5-loc-text">{item.compartment || 'Accommodation A-Deck'} / {item.position || 'Smoking Room'}</p>
                                                                <div className="v5-usage-line">
                                                                    <strong>{item.quantity || '0.01'} {item.unit || 'used'}</strong> in {item.equipment || 'SURFACE MOUNTED TYPE SWITCH'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )
                        ) : viewMode === 'detail' && viewingMaterial ? (
                            <div className="material-detail-panel-v5" style={{ padding: '0', background: '#F8FAFC' }}>
                                <div style={{ padding: '16px 16px 0 16px' }}>
                                    <button
                                        onClick={() => { setViewingMaterial(null); setViewMode('list'); setValidationError(null); setTempPin(null); setActiveTool('none'); }}
                                        className="back-btn-v5"
                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', height: '32px' }}
                                    >
                                        <ChevronLeft size={16} /> BACK
                                    </button>
                                </div>
                                <div className="detail-card-premium">
                                    <div className="detail-header-row">
                                        <div className="dh-left">
                                            <div className="dh-icon-box">
                                                <Flame size={20} color="#2563EB" />
                                            </div>
                                            <div className="dh-titles">
                                                <h3>{viewingMaterial.name}</h3>
                                                {viewingMaterial.shipPO && (
                                                    <span className="dh-ref">PO: {viewingMaterial.shipPO}</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="status-badge-premium mapped" style={{ marginLeft: 'auto' }}>MAPPED</span>
                                    </div>

                                    <div className="detail-form-grid">
                                        <div className="df-group">
                                            <label>IHM PART NUMBER</label>
                                            <input
                                                key={`ihm-${viewingMaterial.id}`}
                                                type="text"
                                                className="df-input"
                                                value={viewingMaterial.ihmPartNumber || ''}
                                                onChange={e => setViewingMaterial({ ...viewingMaterial, ihmPartNumber: e.target.value })}
                                                placeholder="e.g. IHM-CAD-P4022"
                                                readOnly={isReadOnly}
                                            />
                                        </div>
                                        <div className="df-group">
                                            <label>LOCATION ON SHIP</label>
                                            <div className="df-input deck-selector-field" onClick={() => { if (!isReadOnly) setDeckSelectorOpen(!deckSelectorOpen); }} style={{ cursor: isReadOnly ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '38px', position: 'relative', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#F8FAFC', padding: '8px 12px', boxSizing: 'border-box' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    {/* Show target deck if selected, else current */}
                                                    <span>{targetDeckForTransfer || viewingMaterial.deckPlan || sectionName}</span>
                                                    <ChevronDown size={14} />
                                                </div>

                                                {deckSelectorOpen && (
                                                    <div className="dropdown-v4" style={{ top: '100%', left: 0, width: '100%', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                                                        {availableDecks.map((deck: any) => (
                                                            <div key={deck.id} className="drop-item" onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeckSelectorOpen(false);
                                                                // Just set the target, don't navigate yet
                                                                setTargetDeckForTransfer(deck.title || deck.sectionName);
                                                            }}>
                                                                {deck.title || deck.sectionName}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="df-group full">
                                        <label>MANUFACTURER DETAILS</label>
                                        <textarea
                                            key={`mfr-${viewingMaterial.id}`}
                                            className="df-textarea"
                                            value={viewingMaterial.manufacturer || ''}
                                            onChange={e => setViewingMaterial({ ...viewingMaterial, manufacturer: e.target.value })}
                                            placeholder="e.g. Maritime Component Solutions Ltd."
                                            readOnly={isReadOnly}
                                        />
                                    </div>

                                    <div className="df-group full">
                                        <label>LINK DOCUMENT</label>
                                        {!isReadOnly && (
                                            <div className="doc-attach-box" onClick={() => {
                                                // Mock add file
                                                const newFile = `Document_${Math.floor(Math.random() * 1000)}.pdf`;
                                                const updatedFiles = [...(viewingMaterial.files || []), newFile];
                                                setViewingMaterial({ ...viewingMaterial, files: updatedFiles });
                                            }}>
                                                <Upload size={16} />
                                                <span>Attach MSDS or MD Declaration (.pdf)</span>
                                            </div>
                                        )}

                                        <div className="attached-files-list">
                                            {/* Logic for Dropbox if > 2 files */}
                                            {(viewingMaterial.files && viewingMaterial.files.length > 2) ? (
                                                <div className="custom-select-v2" onClick={() => setOpenDropdown(openDropdown === 'files_list' ? null : 'files_list')}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FileText size={14} color="#2563EB" />
                                                        <span>{viewingMaterial.files.length} Documents Attached</span>
                                                    </div>
                                                    <ChevronDown size={14} />

                                                    {openDropdown === 'files_list' && (
                                                        <div className="dropdown-v4">
                                                            {viewingMaterial.files.map((file: string, idx: number) => (
                                                                <div key={idx} className="drop-item file-item-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ fontSize: '12px', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file}</span>
                                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                                        <Eye size={14} className="action-icon-blue" style={{ cursor: 'pointer', color: '#00B0FA' }} />
                                                                        {!isReadOnly && (
                                                                            <X size={14} className="action-icon-red" style={{ cursor: 'pointer', color: '#EF4444' }} onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const newFiles = viewingMaterial.files.filter((_, i) => i !== idx);
                                                                                setViewingMaterial({ ...viewingMaterial, files: newFiles });
                                                                            }} />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                // Normal List for <= 2
                                                (viewingMaterial.files || []).map((file: string, idx: number) => (
                                                    <div key={idx} className="attached-file-row">
                                                        <FileText size={14} color="#2563EB" />
                                                        <span style={{ flex: 1 }}>{file}</span>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <Eye size={16} style={{ cursor: 'pointer', color: '#94A3B8' }} />
                                                            {!isReadOnly && (
                                                                <X size={16} className="remove-file" onClick={() => {
                                                                    const newFiles = (viewingMaterial.files || []).filter((_, i) => i !== idx);
                                                                    setViewingMaterial({ ...viewingMaterial, files: newFiles });
                                                                }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="detail-actions-footer">
                                         <button className="hm-mapping-btn cancel" onClick={() => { setViewingMaterial(null); setViewMode('list'); setValidationError(null); setTempPin(null); setActiveTool('none'); }}>
                                            {isReadOnly ? 'CLOSE' : 'CANCEL'}
                                        </button>
                                        {!isReadOnly && (
                                            <button className="hm-mapping-btn save" onClick={async () => {
                                                if (targetDeckForTransfer) {
                                                    const deck = availableDecks.find(d => (d.title || d.sectionName) === targetDeckForTransfer);
                                                    if (deck) {
                                                        const r = deck.rect || { x: 0, y: 0, width: 2000, height: 1400 };
                                                        const newInv = inventory.filter(i => i.id !== viewingMaterial.id);
                                                        setInventory(newInv);
                                                        if (!vesselId) {
                                                            // Demo / non-backed vessel — keep localStorage path.
                                                            localStorage.setItem(`inventory_${vesselName}_${sectionName}`, JSON.stringify(newInv));
                                                        }

                                                        const params = new URLSearchParams({
                                                            url: fileUrl,
                                                            name: deck.title || deck.sectionName,
                                                            vessel: vesselName,
                                                            x: (r.x || 0).toString(),
                                                            y: (r.y || 0).toString(),
                                                            w: (r.width || r.w || 2000).toString(),
                                                            h: (r.height || r.h || 1400).toString(),
                                                        });
                                                        if (vesselId) params.set('vesselId', vesselId);
                                                        if (deck.id) params.set('deckAreaId', deck.id);

                                                        navigate(`${location.pathname}?${params.toString()}`, {
                                                            state: { transferMaterial: { ...viewingMaterial, deckPlan: deck.title || deck.sectionName } }
                                                        });
                                                        return;
                                                    }
                                                }
                                                // Normal Save — backed vessels persist via PUT.
                                                if (vesselId) {
                                                    try {
                                                        await api.put(
                                                            ENDPOINTS.MATERIALS.DETAIL(vesselId, viewingMaterial.id),
                                                            entryToBackendBody(viewingMaterial, viewingMaterial.pin),
                                                        );
                                                    } catch (err) {
                                                        console.error('Failed to update material:', err);
                                                        setValidationError('Could not save changes. Please try again.');
                                                        return;
                                                    }
                                                }
                                                setViewingMaterial(null);
                                                setViewMode('list');
                                            }}>SAVE CHANGES</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="add-material-form-v5">
                                <div className="form-header-v5">
                                    <h4>ADD MATERIAL</h4>
                                </div>

                                <div className="form-content-v5">

                                    {activeTool === 'pin' && !tempPin && (
                                        <div className="drop-pin-alert">
                                            <MapPin size={16} />
                                            <span>Please drop a pin on the deck plan</span>
                                        </div>
                                    )}

                                    <div className="form-section-card">
                                        <label className="checkbox-field-premium">
                                            <input type="checkbox" checked={formData.avoidUpdation} onChange={(e) => setFormData({ ...formData, avoidUpdation: e.target.checked })} />
                                            <span className="custom-check" />
                                            <span>Avoid Updation</span>
                                        </label>
                                    </div>

                                    <div className="form-group-technical">
                                        <label>MOVEMENT TYPE</label>
                                        <div className="custom-select-v2" onClick={() => setOpenDropdown(openDropdown === 'movement' ? null : 'movement')}>
                                            <span>{formData.movementType || 'Select Type'}</span>
                                            <ChevronDown size={14} />
                                            {openDropdown === 'movement' && (
                                                <div className="dropdown-v4">
                                                    {['MTS - Move to Store', 'MTS - Move from Store', 'Relocate Deck', 'Relocate Location', 'Landed Ashore'].map(type => (
                                                        <div key={type} className="drop-item" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, movementType: type }); setOpenDropdown(null); }}>{type}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group-technical">
                                        <label>IHM PART <span className="req">*</span></label>
                                        <div className="custom-select-v2" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'ihm' ? null : 'ihm'); }}>
                                            <span>{formData.ihmPart || 'Select IHM Part'}</span>
                                            <ChevronDown size={14} />
                                            {openDropdown === 'ihm' && (
                                                <div className="dropdown-v4">
                                                    {['Part I - Materials contained in ship structure or equipment', 'Part II - Operationally generated wastes', 'Part III - Stores'].map(part => (
                                                        <div key={part} className="drop-item" onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFormData({ ...formData, ihmPart: part, equipmentClass: '' });
                                                            setOpenDropdown('eq_class'); // Trigger open equipment class
                                                        }}>{part}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Equipment Class Logic - Always Visible */}
                                    <div className="form-group-technical">
                                        <label>EQUIPMENT CLASS</label>

                                        <div className={`custom-select-v2 ${!formData.ihmPart ? 'disabled-selection' : ''}`}
                                            onClick={() => {
                                                if (formData.ihmPart) {
                                                    setOpenDropdown(openDropdown === 'eq_class' ? null : 'eq_class');
                                                }
                                            }}>
                                            <span>{formData.equipmentClass || 'Select Equipment Class'}</span>
                                            <ChevronDown size={14} />
                                            {openDropdown === 'eq_class' && (
                                                <div className="dropdown-v4">
                                                    {formData.ihmPart?.includes('Part I') ? (
                                                        ['1-1 Paints and Coatings systems', '1-2 Equipment and Machinery', '1-3 Structure and Hull'].map((opt, i) => (
                                                            <div key={`${opt}-${i}`} className="drop-item" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, equipmentClass: opt }); setOpenDropdown(null); }}>{opt}</div>
                                                        ))
                                                    ) : formData.ihmPart ? (
                                                        ['Part 2', 'Part 2', 'Part 2'].map((opt, i) => (
                                                            <div key={`${opt}-${i}`} className="drop-item" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, equipmentClass: opt }); setOpenDropdown(null); }}>{opt}</div>
                                                        ))
                                                    ) : (
                                                        <div className="drop-item disabled">Please select IHM Part first</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group-technical">
                                        <label>SUSPECTED HAZARDOUS MATERIALS <span className="req">*</span></label>
                                        <div className="custom-select-v2" onClick={() => setOpenDropdown(openDropdown === 'suspected_hm' ? null : 'suspected_hm')}>
                                            <span>{formData.hazMaterials[0] || 'Select suspected material'}</span>
                                            <ChevronDown size={14} />
                                            {openDropdown === 'suspected_hm' && (
                                                <div className="dropdown-v4">
                                                    {(() => {
                                                        // IHM Part I splits into Table A (prohibited), Table B
                                                        // (regulated/restricted) and Annex II additions per the
                                                        // Hong Kong Convention. Parts II / III stay flat.
                                                        type Group = { title: string; items: string[] };
                                                        type HazmatList = string[] | Group[];
                                                        const HAZMAT_BY_PART: Record<string, HazmatList> = {
                                                            'I': [
                                                                {
                                                                    title: 'Table A',
                                                                    items: [
                                                                        'Asbestos',
                                                                        'Polychlorinated Biphenyls (PCB)',
                                                                        'Ozone Depleting Substance',
                                                                        'Organotin Compounds',
                                                                        'Cybutryne',
                                                                    ],
                                                                },
                                                                {
                                                                    title: 'Table B',
                                                                    items: [
                                                                        'Cadmium (and compounds)',
                                                                        'Chromium (and compounds)',
                                                                        'Lead (and compounds)',
                                                                        'Mercury (and compounds)',
                                                                        'Polybrominated Biphenyl (PBB)',
                                                                        'Polybrominated Diphenyl Ethers (PBDE)',
                                                                        'Polychloronaphthalenes (Cl >= 3)',
                                                                        'Radioactive Material',
                                                                        'Certain Shortchain Chlorinated Paraffins',
                                                                    ],
                                                                },
                                                                {
                                                                    title: 'Annex II',
                                                                    items: [
                                                                        'Perfluorooctane Sulfonic Acid (PFOS)',
                                                                        'Hexabromocyclododecane (HBCDD)',
                                                                    ],
                                                                },
                                                            ],
                                                            'II': [
                                                                'Operational wastes - Sludges',
                                                                'Oily waste / Bilge water residue',
                                                                'Sewage',
                                                                'Garbage (Plastics)',
                                                                'Incinerator ash',
                                                                'Medical waste',
                                                                'Quarantine waste',
                                                                'Cargo residues',
                                                                'Cargo hold wash water',
                                                                'Exhaust gas cleaning residues',
                                                                'Cleaning chemical residues',
                                                            ],
                                                            'III': [
                                                                'Paints and coatings',
                                                                'Cleaning chemicals',
                                                                'Lubricating oils and greases',
                                                                'Batteries (Lead-acid, NiCd, Li-ion)',
                                                                'Fuel additives',
                                                                'Refrigerants / Halons',
                                                                'Fire-fighting foam (AFFF / PFOS-based)',
                                                                'Compressed gases',
                                                                'Welding gases',
                                                                'Solvents and thinners',
                                                                'Fluorescent tubes / Mercury lamps',
                                                                'Electronic components',
                                                                'Pesticides / Fumigants',
                                                            ],
                                                        };
                                                        const partKey = formData.ihmPart?.includes('Part III') ? 'III'
                                                            : formData.ihmPart?.includes('Part II') ? 'II'
                                                            : formData.ihmPart?.includes('Part I') ? 'I'
                                                            : null;
                                                        const isGroupedList = (l: HazmatList): l is Group[] =>
                                                            Array.isArray(l) && l.length > 0 && typeof l[0] === 'object' && 'items' in (l[0] as object);

                                                        const pickItem = (mat: string) => {
                                                            setFormData({ ...formData, hazMaterials: [mat] });
                                                            setOpenDropdown(null);
                                                        };

                                                        const headerStyle: React.CSSProperties = {
                                                            padding: '8px 12px 4px',
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            letterSpacing: '0.06em',
                                                            textTransform: 'uppercase',
                                                            color: '#94A3B8',
                                                            background: '#F8FAFC',
                                                            borderTop: '1px solid #E2E8F0',
                                                            position: 'sticky',
                                                            top: 0,
                                                        };

                                                        // Grouped render — Part I (and 'all' fallback gets flat).
                                                        if (partKey === 'I') {
                                                            const groups = HAZMAT_BY_PART['I'] as Group[];
                                                            return (
                                                                <>
                                                                    {groups.map((g) => (
                                                                        <React.Fragment key={g.title}>
                                                                            <div style={headerStyle}>{g.title}</div>
                                                                            {g.items.map((mat) => (
                                                                                <div
                                                                                    key={mat}
                                                                                    className="drop-item"
                                                                                    onClick={(e) => { e.stopPropagation(); pickItem(mat); }}
                                                                                >
                                                                                    {mat}
                                                                                </div>
                                                                            ))}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </>
                                                            );
                                                        }

                                                        // Flat render for Part II / III, or all-parts fallback.
                                                        const flat: string[] = partKey
                                                            ? (HAZMAT_BY_PART[partKey] as string[])
                                                            : Object.values(HAZMAT_BY_PART).flatMap((l) =>
                                                                isGroupedList(l) ? l.flatMap((g) => g.items) : (l as string[]),
                                                            );
                                                        return flat.map((mat) => (
                                                            <div
                                                                key={mat}
                                                                className="drop-item"
                                                                onClick={(e) => { e.stopPropagation(); pickItem(mat); }}
                                                            >
                                                                {mat}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-row-balanced">
                                        <div className="form-group-technical flex-1">
                                            <label>DECK PLAN <span className="req">*</span></label>
                                            <input type="text" value={formData.deckPlan} readOnly className="read-only-input" />
                                        </div>
                                        <div className="form-group-technical flex-1">
                                            <label>SHIP PO</label>
                                            <input type="text" placeholder="e.g. PO-123456" value={formData.shipPO} onChange={e => setFormData({ ...formData, shipPO: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-group-technical">
                                        <label>NAME <span className="req">*</span></label>
                                        <input type="text" placeholder="Enter entry name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>

                                    <div className="form-row-balanced">
                                        <div className="form-group-technical">
                                            <label>COMPARTMENT</label>
                                            <input type="text" placeholder="e.g. Engine Room" value={formData.compartment} onChange={e => setFormData({ ...formData, compartment: e.target.value })} />
                                        </div>
                                        <div className="form-group-technical">
                                            <label>EQUIPMENT</label>
                                            <input type="text" placeholder="e.g. Pump" value={formData.equipment} onChange={e => setFormData({ ...formData, equipment: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-row-balanced">
                                        <div className="form-group-technical">
                                            <label>POSITION</label>
                                            <input type="text" placeholder="e.g. Port Side" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} />
                                        </div>
                                        <div className="form-group-technical">
                                            <label>COMPONENT</label>
                                            <input type="text" placeholder="e.g. Gasket" value={formData.component} onChange={e => setFormData({ ...formData, component: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-group-technical">
                                        <label>MATERIAL</label>
                                        <input type="text" placeholder="e.g. Rubber" value={formData.material} onChange={e => setFormData({ ...formData, material: e.target.value })} />
                                    </div>

                                    {/* Fields from Screenshot - Added eg: labels */}
                                    <div className="form-row-quad" style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                        <div className="form-group-technical flex-1">
                                            <label>Quantity of HM</label>
                                            <input type="text" placeholder="eg: 0.02" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                                        </div>
                                        <div className="form-group-technical flex-1">
                                            <label>Unit</label>
                                            <div className="custom-select-v2" onClick={() => setOpenDropdown(openDropdown === 'unit' ? null : 'unit')}>
                                                <span>{formData.unit}</span>
                                                <ChevronDown size={14} />
                                                {openDropdown === 'unit' && (
                                                    <div className="dropdown-v4">
                                                        {['kg', 'm\u00B2', 'pcs', 'ltr'].map(u => (
                                                            <div key={u} className="drop-item" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, unit: u }); setOpenDropdown(null); }}>{u}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="form-group-technical flex-1">
                                            <label>No. of Pieces</label>
                                            <input type="text" placeholder="eg: 8" value={formData.noOfPieces} onChange={e => setFormData({ ...formData, noOfPieces: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="total-quantity-status" style={{ padding: '8px 0', borderBottom: '1px solid #E2E8F0', marginBottom: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '16px', height: '16px', border: '1px solid #94A3B8', borderRadius: '2px' }} />
                                            <div style={{ color: '#00B0FA', fontWeight: 'bold' }}>
                                                Total Quantity of HM: <span style={{ color: '#1E293B', marginLeft: '5px' }}>{formData.noOfPieces} PCS | {formData.quantity || '0.00'} {formData.unit}</span>
                                            </div>
                                        </div>
                                    </div>



                                    {/* Hazard Level & Status Selection */}
                                    <div className="hm-status-section" style={{ marginTop: '20px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#1E293B', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                                            HAZARD LEVEL & STATUS *
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
                                            {/* CHM - High Risk (Red) */}
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, hmStatus: 'CHM' })}
                                                style={{
                                                    boxSizing: 'border-box',
                                                    height: '58px',
                                                    border: formData.hmStatus === 'CHM' ? '2px solid #EF4444' : '2px solid #E2E8F0',
                                                    background: formData.hmStatus === 'CHM' ? '#FEF2F2' : '#FFFFFF',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '4px',
                                                    boxShadow: formData.hmStatus === 'CHM' ? '0 0 0 3px rgba(239, 68, 68, 0.2)' : 'none',
                                                    transition: 'all 0.15s ease-in-out',
                                                    outline: 'none'
                                                }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626', lineHeight: '1.2' }}>🔴 CHM</span>
                                                <span style={{ fontSize: '10px', color: '#991B1B', marginTop: '2px', fontWeight: '600', lineHeight: '1.1' }}>Contains HM</span>
                                            </button>

                                            {/* PCHM - Potential Risk (Amber/Orange) */}
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, hmStatus: 'PCHM' })}
                                                style={{
                                                    boxSizing: 'border-box',
                                                    height: '58px',
                                                    border: formData.hmStatus === 'PCHM' ? '2px solid #F59E0B' : '2px solid #E2E8F0',
                                                    background: formData.hmStatus === 'PCHM' ? '#FFFBEB' : '#FFFFFF',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '4px',
                                                    boxShadow: formData.hmStatus === 'PCHM' ? '0 0 0 3px rgba(245, 158, 11, 0.2)' : 'none',
                                                    transition: 'all 0.15s ease-in-out',
                                                    outline: 'none'
                                                }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#D97706', lineHeight: '1.2' }}>🟠 PCHM</span>
                                                <span style={{ fontSize: '10px', color: '#92400E', marginTop: '2px', fontWeight: '600', lineHeight: '1.1' }}>Potential HM</span>
                                            </button>

                                            {/* Non-CHM - Safe / Below Threshold (Green) */}
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, hmStatus: 'Non-CHM' })}
                                                style={{
                                                    boxSizing: 'border-box',
                                                    height: '58px',
                                                    border: formData.hmStatus === 'Non-CHM' ? '2px solid #10B981' : '2px solid #E2E8F0',
                                                    background: formData.hmStatus === 'Non-CHM' ? '#ECFDF5' : '#FFFFFF',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '4px',
                                                    boxShadow: formData.hmStatus === 'Non-CHM' ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none',
                                                    transition: 'all 0.15s ease-in-out',
                                                    outline: 'none'
                                                }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669', lineHeight: '1.2' }}>🟢 Non-CHM</span>
                                                <span style={{ fontSize: '10px', color: '#065F46', marginTop: '2px', fontWeight: '600', lineHeight: '1.1' }}>Below Threshold</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-row-balanced" style={{ marginTop: '20px' }}>
                                        <div className="form-group-technical flex-1">
                                            <label>Created Date *</label>
                                            <div className="premium-date-wrapper">
                                                <input type="date" value={formData.createdDate} onChange={e => setFormData({ ...formData, createdDate: e.target.value })} />
                                                <Calendar size={16} className="date-icon-abs" />
                                            </div>
                                            <span style={{ fontSize: '9px', color: '#94A3B8' }}>DD/MM/YYYY</span>
                                        </div>
                                        <div className="form-group-technical flex-1">
                                            <label>Updated Date For Report *</label>
                                            <div className="premium-date-wrapper">
                                                <input type="date" value={formData.updatedDate} onChange={e => setFormData({ ...formData, updatedDate: e.target.value })} />
                                                <Calendar size={16} className="date-icon-abs" />
                                            </div>
                                            <span style={{ fontSize: '9px', color: '#94A3B8' }}>DD/MM/YYYY</span>
                                        </div>
                                    </div>

                                    <div className="form-group-technical" style={{ marginTop: '15px' }}>
                                        <label>Remarks</label>
                                        <textarea
                                            placeholder="NO. : 4090200)"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', minHeight: '60px' }}
                                            value={formData.remarks}
                                            onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-footer-v5">
                                    <button className="discard-btn-v5" onClick={resetFormAfterCreate}>DISCARD</button>
                                    <button className="create-btn-v5" onClick={handleAddMaterial}>CREATE ENTRY</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="sidebar-fab-v5">
                        {viewMode === 'list' && !isReadOnly && (
                            <button className="fab-blue-v5" onClick={() => { resetFormAfterCreate(); setViewMode('add'); setActiveTool('pin'); }}>
                                <Plus size={32} />
                            </button>
                        )}
                    </div>
                </aside>
            </div >


            <footer className="technical-footer-v3">
                <div className="f-meta-group">
                    <div className="f-status-item">
                        <span>SYSTEM ACTIVE</span>
                    </div>
                    <div className="f-divider" />
                    <div className="f-h-item">TOTAL HAZMAT ITEMS: {inventory.length}</div>
                    <div className="f-divider" />
                    <div className="f-h-item">LAST SYNC: JUST NOW</div>
                </div>

            </footer>
            {bannerMessage && (
                <div className="custom-banner-overlay">
                    <div className={`custom-banner-card ${bannerMessage.type}`}>
                        <div className={`custom-banner-icon ${bannerMessage.type}`}>
                            {bannerMessage.type === 'info' ? <Ship size={24} /> : <Flame size={24} />}
                        </div>
                        <div className="custom-banner-text">
                            <h4 className="custom-banner-title">{bannerMessage.title}</h4>
                            <p className="custom-banner-body">{bannerMessage.body}</p>
                        </div>
                        <button className="custom-banner-close" onClick={() => setBannerMessage(null)}>×</button>
                    </div>
                </div>
            )}
            {validationError && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999999,
                    background: '#0F172A',
                    color: '#FFFFFF',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    maxWidth: '460px',
                    width: '90%'
                }}>
                    <AlertTriangle size={24} color="#F59E0B" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.4, flex: 1, color: '#F8FAFC' }}>{validationError}</span>
                    <button
                        onClick={() => setValidationError(null)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: 1,
                            padding: '4px',
                            borderRadius: '4px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}
        </div >
    );
}
