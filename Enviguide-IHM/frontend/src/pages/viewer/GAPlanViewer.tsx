import React, { useState, useRef, useEffect } from 'react';
import {
    Hand,
    Maximize,
    RotateCw,
    RotateCcw,

    CheckCircle,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Crop,
    ZoomIn,
    ZoomOut,
    Pencil,
    Ship,
    Save,
    Undo,
    Redo,
    XCircle
} from 'lucide-react';

import './GAPlanViewer.css';
import { PLAN_GENERIC, PLAN_OCEAN_PIONEER, PLAN_ACOSTA, PLAN_AFIF, PLAN_PACIFIC_HORIZON } from '../../assets/ship_plans';
import { api } from '../../lib/apiClient';
import { ENDPOINTS, API_CONFIG } from '../../config/api.config';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface MappedSection {
    id: string;
    title: string;
    sectionId: string;
    rect: Rect;
    itemsCount: number;
    isVisible?: boolean;
    planId?: string;
}

interface GAPlanViewerProps {
    filename: string;
    fileUrl: string;
    onClose: () => void;
    mappedSections: MappedSection[];
    onUpdateSections: React.Dispatch<React.SetStateAction<MappedSection[]>>;
    focusedSectionId?: string | null;
    vesselName: string;
    /** Backend vessel UUID. When present alongside gaPlanId, deck areas
     *  persist via the API (load on mount, POST on save, DELETE on remove).
     *  When absent we fall back to the local-state-only flow used by demo
     *  vessels and ad-hoc opens. */
    vesselId?: string;
    gaPlanId?: string;
    isIsolationMode?: boolean;
    allPlans?: any[];
    showAllPlansMode?: boolean;
}


export default function GAPlanViewer({
    filename,
    fileUrl,
    onClose,
    mappedSections,
    onUpdateSections,
    focusedSectionId,
    vesselName,
    vesselId,
    gaPlanId,
    isIsolationMode = false,
    allPlans,
    showAllPlansMode = false
}: GAPlanViewerProps) {
    // True when both UUIDs are present — i.e. we're allowed to hit the API.
    const persistEnabled = Boolean(vesselId && gaPlanId);
    // View State
    const [zoom, setZoom] = useState(30); // Initial Zoom
    const [rotation, setRotation] = useState(0);
    const [imgAspectRatio, setImgAspectRatio] = useState(1.428); // Default 1000/700

    // Undo/Redo History Stacks
    const [history, setHistory] = useState<MappedSection[][]>([]);
    const [future, setFuture] = useState<MappedSection[][]>([]);
    const hasOpenedRef = useRef(false);

    // Sanitize URL internally
    const displayFileUrl = (fileUrl && !fileUrl.includes('ga_plan_')) ? fileUrl : PLAN_GENERIC;

    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<'none' | 'hand' | 'crop'>('none');
    const [localFocusedId, setLocalFocusedId] = useState<string | null>(focusedSectionId || null);

    const [croppingPlanId, setCroppingPlanId] = useState<string>('');
    const [fetchedPlans, setFetchedPlans] = useState<any[]>([]);

    useEffect(() => {
        if (allPlans && allPlans.length > 0) {
            setFetchedPlans(allPlans);
            return;
        }
        if (vesselId) {
            api.get<{ success: boolean; data: any[] }>(ENDPOINTS.GA_PLANS.LIST(vesselId))
                .then((res) => {
                    const plans = (res.data || []).map((p) => {
                        let filePathStr = String(p.filePath ?? '');
                        const resolvedUrl = filePathStr ? (filePathStr.startsWith('http') || filePathStr.startsWith('/uploads') ? filePathStr : `${API_CONFIG.BASE_URL}/${filePathStr.replace(/^\/+/, '')}`) : '';
                        return {
                            id: String(p.id),
                            name: String(p.name ?? p.fileName ?? 'GA Plan'),
                            url: resolvedUrl,
                            date: typeof p.createdAt === 'string'
                                ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '',
                        };
                    });
                    setFetchedPlans(plans);
                })
                .catch((err) => console.error("Failed to load plans in viewer:", err));
        } else {
            // Read plans from localStorage for local/mock mode
            const localPlansStr = localStorage.getItem(`vessel_plans_${vesselName}`);
            if (localPlansStr) {
                try {
                    const parsed = JSON.parse(localPlansStr);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setFetchedPlans(parsed);
                        return;
                    }
                } catch (e) {
                    console.error('Failed to parse local plans:', e);
                }
            }
            // Demo mode fallback if not in localStorage
            const demoVesselsPreviews: Record<string, string> = {
                'MV Ocean Pioneer': PLAN_OCEAN_PIONEER,
                'ACOSTA': PLAN_ACOSTA,
                'AFIF': PLAN_AFIF,
                'PACIFIC HORIZON': PLAN_PACIFIC_HORIZON
            };
            if (vesselName && demoVesselsPreviews[vesselName]) {
                setFetchedPlans([{
                    id: 'static-demo-plan-id',
                    name: 'General Arrangement Plan',
                    url: demoVesselsPreviews[vesselName],
                    date: 'Feb 09, 2026'
                }]);
            }
        }
    }, [vesselId, vesselName, allPlans]);

    const displayPlans = (showAllPlansMode && fetchedPlans.length > 0)
        ? fetchedPlans
        : fetchedPlans.find(p => p.id === gaPlanId)
            ? [fetchedPlans.find(p => p.id === gaPlanId)]
            : [{
                id: gaPlanId || 'default-plan',
                name: filename,
                url: fileUrl,
            }];

    // Sync prop to local state
    useEffect(() => {
        if (focusedSectionId) {
            setLocalFocusedId(focusedSectionId);
        }
    }, [focusedSectionId]);

    // Backend hydration: when we have real vessel + plan UUIDs, pull the
    // authoritative deck-area list from the API and replace whatever
    // localStorage / parent-state had. This keeps the popup viewer in sync
    // when the parent tab's state is stale.
    useEffect(() => {
        if (!persistEnabled || !vesselId || !gaPlanId) return;
        let cancelled = false;
        api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(
            ENDPOINTS.DECK_AREAS.LIST(vesselId, gaPlanId),
        )
            .then((res) => {
                if (cancelled) return;
                const sections: MappedSection[] = (res.data || []).map((a) => ({
                    id: String(a.id),
                    title: String(a.name ?? ''),
                    sectionId: `DECK-${String(a.id).slice(0, 4).toUpperCase()}`,
                    rect: {
                        x: Number(a.x ?? 0),
                        y: Number(a.y ?? 0),
                        width: Number(a.width ?? 0),
                        height: Number(a.height ?? 0),
                    },
                    itemsCount: 0,
                    isVisible: true,
                }));
                onUpdateSections(sections);
            })
            .catch((err) => {
                console.error('Failed to load deck areas:', err);
            });
        return () => { cancelled = true; };
    }, [persistEnabled, vesselId, gaPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-open sidebar if sections exist on load
    useEffect(() => {
        if (mappedSections.length > 0 && !hasOpenedRef.current) {
            setIsSidebarOpen(true);
            hasOpenedRef.current = true;
        }
    }, [mappedSections.length]);

    const executeUpdate = (newSections: MappedSection[]) => {
        setHistory(prev => [...prev, mappedSections]);
        setFuture([]); // Clear redo stack on new action
        onUpdateSections(newSections);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setFuture(prev => [mappedSections, ...prev]);
        setHistory(newHistory);
        onUpdateSections(previous);
        // Also update lastAddedId if we undo a creation? 
        // Logic might get complex for toast but basic undo works.
        setToast(prev => ({ ...prev, visible: false }));
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        setHistory(prev => [...prev, mappedSections]);
        setFuture(newFuture);
        onUpdateSections(next);
    };

    const canvasRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Toast state
    const [toast, setToast] = useState<{ title: string; subtitle: string; visible: boolean; type: 'success' | 'error' }>({
        title: '',
        subtitle: '',
        visible: false,
        type: 'success'
    });

    // Selection state
    const [currentSelection, setCurrentSelection] = useState<Rect | null>(null);
    const [newSelectionTitle, setNewSelectionTitle] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

    // Center view on focused section or fit entire plan
    useEffect(() => {
        if (localFocusedId) {
            const section = mappedSections.find(s => s.id === localFocusedId);
            if (section && wrapperRef.current) {
                const viewport = wrapperRef.current.parentElement?.getBoundingClientRect();
                if (viewport) {
                    // Cap zoom to 100% to keep it "personal size" and clear
                    const targetZoom = 100;
                    setZoom(targetZoom);
                    setOffset({
                        x: (viewport.width / 2) - ((section.rect.x + section.rect.width / 2) * targetZoom / 100),
                        y: (viewport.height / 2) - ((section.rect.y + section.rect.height / 2) * targetZoom / 100)
                    });
                }
            }
        } else if (wrapperRef.current) {
            // Global Fit: Scale to show entire GA plan
            const viewport = wrapperRef.current.parentElement?.getBoundingClientRect();
            if (viewport) {
                const sheetWidth = wrapperRef.current.offsetWidth || 1000;
                const sheetHeight = wrapperRef.current.offsetHeight || 700;
                const padding = 1.05; // 5% padding
                const scaleX = viewport.width / (sheetWidth * padding);
                const scaleY = viewport.height / (sheetHeight * padding);

                // Aggressive fit: Fill as much as possible
                const fitZoom = Math.min(scaleX, scaleY) * 100;
                setZoom(fitZoom);
                setOffset({
                    x: (viewport.width - (sheetWidth * fitZoom / 100)) / 2,
                    y: (viewport.height - (sheetHeight * fitZoom / 100)) / 2
                });
            }
        }
    }, [localFocusedId, mappedSections.length, fileUrl, vesselName, displayPlans.length]);

    // Pan handling
    const [isPanning, setIsPanning] = useState(false);
    const lastPanPoint = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'hand') {
            setIsPanning(true);
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
            return;
        }

        if (activeTool === 'crop') {
            const targetContainer = (e.target as HTMLElement).closest('.ga-drawing-coordinate-reference');
            if (targetContainer) {
                const planIdAttr = targetContainer.getAttribute('data-plan-id') || '';
                setCroppingPlanId(planIdAttr);

                const rect = targetContainer.getBoundingClientRect();
                if (rect && rect.width > 0) {
                    const scaleFactor = 1000 / rect.width;
                    const x = (e.clientX - rect.left) * scaleFactor;
                    const y = (e.clientY - rect.top) * scaleFactor;
                    setStartPoint({ x, y });
                    setIsDrawing(true);
                    setCurrentSelection(null);
                    setNewSelectionTitle('');
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning && activeTool === 'hand') {
            const dx = e.clientX - lastPanPoint.current.x;
            const dy = e.clientY - lastPanPoint.current.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanPoint.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (isDrawing && activeTool === 'crop' && croppingPlanId) {
            const targetContainer = canvasRef.current?.querySelector(`[data-plan-id="${croppingPlanId}"]`);
            if (targetContainer) {
                const rect = targetContainer.getBoundingClientRect();
                if (rect && rect.width > 0) {
                    const scaleFactor = 1000 / rect.width;
                    const currentX = (e.clientX - rect.left) * scaleFactor;
                    const currentY = (e.clientY - rect.top) * scaleFactor;

                    setCurrentSelection({
                        x: Math.min(startPoint.x, currentX),
                        y: Math.min(startPoint.y, currentY),
                        width: Math.max(1, Math.abs(currentX - startPoint.x)),
                        height: Math.max(1, Math.abs(currentY - startPoint.y))
                    });
                }
            }
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDrawing(false);
        if (currentSelection && (currentSelection.width < 10 || currentSelection.height < 10)) {
            setCurrentSelection(null);
        }
    };

    // --- Manual Zoom via Wheel Disabled ---

    const showToast = (title: string, subtitle: string, type: 'success' | 'error' = 'success') => {
        setToast({ title, subtitle, visible: true, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    // escape key to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setActiveTool('none');
                setCurrentSelection(null);
                setNewSelectionTitle('');
                setIsDrawing(false);
            }
        };

        // Prevent native browser zoom (Ctrl+Wheel) and accidental scroll zoom
        const handleNativeZoom = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleNativeZoom, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleNativeZoom);
        };
    }, []);

    const checkOverlap = (newRect: Rect) => {
        return mappedSections.some(section => {
            const r1 = newRect;
            const r2 = section.rect;

            // Check if rectangles intersect
            return !(r2.x > r1.x + r1.width ||
                r2.x + r2.width < r1.x ||
                r2.y > r1.y + r1.height ||
                r2.y + r2.height < r1.y);
        });
    };

    const addSelection = async () => {
        if (!currentSelection) {
            showToast("No Selection", "Please draw a rectangle on the plan first.", "error");
            return;
        }
        if (!newSelectionTitle || !newSelectionTitle.trim()) {
            showToast("Title Required", "Please enter a deck name before saving.", "error");
            return;
        }

        // Check for overlap with existing sections
        if (checkOverlap(currentSelection)) {
            showToast("Cropping Conflict", "This area is already cropped. You cannot crop the same area twice.", "error");
            return;
        }

        // Check for duplicate name (case-insensitive)
        const normalizedTitle = newSelectionTitle.trim().toLowerCase();
        const isDuplicateName = mappedSections.some(section => section.title.trim().toLowerCase() === normalizedTitle);

        if (isDuplicateName) {
            showToast("Duplicate Name", `The name "${newSelectionTitle}" is already in use. Please enter a unique name.`, "error");
            return;
        }

        const trimmedTitle = newSelectionTitle.trim();
        // Initialize empty inventory for this deck (still localStorage — items
        // tracking is unrelated to the deck-area persistence here).
        localStorage.setItem(`inventory_${vesselName}_${trimmedTitle}`, JSON.stringify([]));

        // Persist to backend when we have real IDs; fall back to a
        // client-generated id otherwise so the demo flow still works.
        const targetPlanId = croppingPlanId || gaPlanId || '';
        if (vesselId && targetPlanId) {
            try {
                const res = await api.post<{ success: boolean; data: Record<string, unknown> }>(
                    ENDPOINTS.DECK_AREAS.LIST(vesselId, targetPlanId),
                    {
                        name: trimmedTitle,
                        x: currentSelection.x,
                        y: currentSelection.y,
                        width: currentSelection.width,
                        height: currentSelection.height,
                    },
                );
                const saved = res.data || {};
                const persistedId = String(saved.id ?? Date.now());
                const newSection: MappedSection = {
                    id: persistedId,
                    title: trimmedTitle,
                    sectionId: `DECK-${persistedId.slice(0, 4).toUpperCase()}`,
                    rect: currentSelection,
                    itemsCount: 0,
                    isVisible: true,
                    planId: targetPlanId,
                };
                executeUpdate([...mappedSections, newSection]);
                showToast("Deck Saved", `${trimmedTitle} has been saved to the project.`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Save failed';
                showToast("Save Failed", msg, "error");
                return; // don't clear the input — let the user retry
            }
        } else {
            const newId = Date.now().toString();
            const sectionId = `DECK-${newId.slice(-4)}`;
            const newSection: MappedSection = {
                id: newId,
                title: trimmedTitle,
                sectionId,
                rect: currentSelection,
                itemsCount: 0,
                isVisible: true,
                planId: targetPlanId,
            };
            executeUpdate([...mappedSections, newSection]);
            showToast("Deck Saved Successfully", `${trimmedTitle} has been added to the vessel project`);
        }

        // Clear selection so the input doesn't re-render with stale state.
        setCurrentSelection(null);
        setNewSelectionTitle('');
        setActiveTool('none');
    };

    const handleNewSection = () => {
        setCurrentSelection(null);
        setNewSelectionTitle('');
        setActiveTool('crop');
    };

    const undoLastSave = () => {
        handleUndo();

    };

    const deleteSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Best-effort backend delete; local state updates regardless so the
        // UI stays responsive on transient errors.
        if (persistEnabled && vesselId && gaPlanId) {
            api.delete(ENDPOINTS.DECK_AREAS.DETAIL(vesselId, gaPlanId, id)).catch((err) => {
                console.error('Deck area delete failed:', err);
            });
        }
        const newSections = mappedSections.filter(s => s.id !== id);
        executeUpdate(newSections);
    };

    const handleEditMapping = (section: MappedSection, e: React.MouseEvent) => {
        e.stopPropagation();
        const urlParams = new URLSearchParams({
            url: fileUrl,
            name: section.title,
            x: section.rect.x.toString(),
            y: section.rect.y.toString(),
            w: section.rect.width.toString(),
            h: section.rect.height.toString(),
            mode: 'add',
            vessel: vesselName,
        });
        if (vesselId) urlParams.set('vesselId', vesselId);
        if (section.id) urlParams.set('deckAreaId', section.id);
        window.open(`/mapping?${urlParams.toString()}`, '_blank');
    };


    const CropThumbnail = ({ rect }: { rect: Rect }) => {
        const wrapperRef = useRef<HTMLDivElement>(null);
        const [boxSize, setBoxSize] = useState({ w: 256, h: 160 });

        useEffect(() => {
            if (wrapperRef.current) {
                setBoxSize({
                    w: wrapperRef.current.offsetWidth,
                    h: wrapperRef.current.offsetHeight
                });
            }
        }, []);

        // Logic: Contain the crop within the standard 16:10 box
        const scale = Math.min(boxSize.w / rect.width, boxSize.h / rect.height);

        return (
            <div className="section-thumbnail-box" ref={wrapperRef}>
                <div
                    style={{
                        width: `${rect.width * scale}px`,
                        height: `${rect.height * scale}px`,
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: '4px'
                    }}
                >
                    <img
                        src={displayFileUrl}
                        alt="crop"
                        style={{
                            position: 'absolute',
                            left: `${-rect.x * scale}px`,
                            top: `${-rect.y * scale}px`,
                            width: `${1000 * scale}px`,
                            height: 'auto',
                            maxWidth: 'none',
                            pointerEvents: 'none',
                            display: 'block'
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="ga-viewer-overlay">
            <div className={`ga-toast-v2 ${toast.type} ${toast.visible ? 'show' : ''}`}>
                <div className="toast-icon-side">
                    {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                <div className="ga-toast-content">
                    <div className="ga-toast-title">{toast.title}</div>
                    <div className="ga-toast-subtitle">{toast.subtitle}</div>
                </div>
                {toast.type === 'success' && (
                    <div className="ga-toast-action" onClick={undoLastSave}>UNDO</div>
                )}
            </div>

            {/* Top Nav Removed */}

            <div className="ga-viewer-header">
                <div className="viewer-header-left">
                    <button className="back-btn" onClick={onClose} style={{ marginRight: '24px' }}>
                        <ChevronLeft size={16} strokeWidth={3} />
                        <span>BACK TO DECKS</span>
                    </button>
                    <div className="logo-icon-box-v2">
                        <Ship size={20} className="sailing-logo" />
                    </div>
                    <div className="logo-text">
                        <h2 style={{ color: 'white', textTransform: 'none' }}>Ship GA Plan</h2>
                        <p className="logo-subtitle" style={{ color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>TECHNICAL ENGINEERING VIEWER</p>
                    </div>
                </div>

                <div className="viewer-header-actions">
                    {/* Live Sync and Close buttons removed as requested */}
                </div>
            </div>

            <div className={`ga-viewer-content-area ${isSidebarOpen ? 'sidebar-open' : ''}`}>
                <div
                    className={`ga-viewer-main ${activeTool === 'hand' ? 'hand-active' : ''} ${activeTool === 'crop' ? 'crop-active' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    // onMouseLeave={handleMouseUp} // Removed to prevent potential early drag release
                    ref={canvasRef}
                >
                    <div
                        className="ga-plan-wrapper"
                        ref={wrapperRef}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                            transformOrigin: '0 0',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '40px',
                            padding: '20px',
                            background: '#0B0F19',
                            alignItems: 'center'
                        }}
                    >
                        {displayPlans.map((plan) => {
                            const isPdfPlan = plan.url.toLowerCase().endsWith('.pdf') || plan.name.toLowerCase().endsWith('.pdf');
                            let displayUrl = plan.url;
                            if (displayUrl.includes('ga_plan_illustration.png')) {
                                displayUrl = '/ga_plan_minimal.png';
                            }
                            return (
                                <div
                                    key={plan.id}
                                    className="ga-drawing-coordinate-reference"
                                    data-plan-id={plan.id}
                                    style={{
                                        position: 'relative',
                                        width: '1000px',
                                        height: `${1000 / imgAspectRatio}px`,
                                        background: '#FFFFFF',
                                        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '3px solid #1E293B',
                                        flexShrink: 0
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '12px',
                                        left: '12px',
                                        zIndex: 10,
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        color: '#38BDF8',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        backdropFilter: 'blur(4px)'
                                    }}>
                                        {plan.name}
                                    </div>

                                    {isPdfPlan ? (
                                        <iframe
                                            src={`${displayUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                            title={plan.name}
                                            className="ga-plan-frame"
                                            style={{ width: '1000px', height: `${1000 / imgAspectRatio}px`, border: 'none', display: 'block' }}
                                        />
                                    ) : (
                                        <img
                                            src={displayUrl}
                                            alt={plan.name}
                                            className="ga-plan-image"
                                            style={{ width: '1000px', height: 'auto', display: 'block' }}
                                            draggable={false}
                                            onLoad={(e) => {
                                                const { naturalWidth, naturalHeight } = e.currentTarget;
                                                if (naturalWidth && naturalHeight) {
                                                    setImgAspectRatio(naturalWidth / naturalHeight);
                                                }
                                            }}
                                        />
                                    )}

                                    {mappedSections.map(section => (
                                        (!section.planId || section.planId === plan.id) &&
                                        ((isIsolationMode && localFocusedId) ? section.id === localFocusedId : section.isVisible) && (
                                            <div
                                                key={section.id}
                                                className="drawn-selection"
                                                style={{
                                                    position: 'absolute',
                                                    left: section.rect.x,
                                                    top: section.rect.y,
                                                    width: section.rect.width,
                                                    height: section.rect.height,
                                                    background: (localFocusedId === section.id || (activeTool === 'none' && !localFocusedId)) ? 'rgba(0, 176, 250, 0.1)' : 'transparent',
                                                    border: (localFocusedId === section.id || (activeTool === 'none' && !localFocusedId)) ? '2px solid #00B0FA' : '1px dashed rgba(0,176,250,0.3)',
                                                    zIndex: localFocusedId === section.id ? 5 : 1,
                                                    cursor: 'pointer'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLocalFocusedId(section.id);
                                                    setIsSidebarOpen(true);
                                                }}
                                            >
                                                {localFocusedId === section.id && (
                                                    <div
                                                        className="section-label-viewer"
                                                        style={{
                                                            fontSize: Math.max(12, 14 * (100 / zoom)) + 'px'
                                                        }}
                                                    >
                                                        {section.title}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ))}

                                    {isDrawing && currentSelection && croppingPlanId === plan.id && (
                                        <div
                                            className="crop-selection-marquee"
                                            style={{
                                                position: 'absolute',
                                                left: currentSelection.x,
                                                top: currentSelection.y,
                                                width: currentSelection.width,
                                                height: currentSelection.height,
                                                border: '2px dashed #00B0FA',
                                                background: 'rgba(0, 176, 250, 0.15)',
                                                zIndex: 10,
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    )}

                                    {!isDrawing && currentSelection && croppingPlanId === plan.id && (
                                        <div
                                            className="ga-selection-box"
                                            style={{
                                                position: 'absolute',
                                                left: currentSelection.x,
                                                top: currentSelection.y,
                                                width: currentSelection.width,
                                                height: currentSelection.height,
                                                border: '2px solid #00B0FA',
                                                background: 'rgba(0, 176, 250, 0.1)',
                                                zIndex: 10
                                            }}
                                        >
                                            <div
                                                className="selection-input-container"
                                                style={{
                                                    transform: `scale(${100 / zoom})`,
                                                    transformOrigin: 'top left'
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onMouseMove={(e) => e.stopPropagation()}
                                                onMouseUp={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="text"
                                                    placeholder="Enter Title..."
                                                    value={newSelectionTitle}
                                                    onChange={(e) => setNewSelectionTitle(e.target.value)}
                                                    className="selection-input"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && addSelection()}
                                                />
                                                <button
                                                    type="button"
                                                    className="input-save-btn"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => { e.stopPropagation(); addSelection(); }}
                                                    title="Save Deck Selection"
                                                >
                                                    <Save size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>



                    {/* Top Left Toolbar (Undo/Redo) */}
                    <div className="ga-toolbar-top-left">
                        <button
                            className={`tool-btn-inline ${history.length === 0 ? 'disabled' : ''}`}
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            title="Undo (Ctrl+Z)"
                            style={{ opacity: history.length === 0 ? 0.5 : 1 }}
                        >
                            <Undo size={18} />
                        </button>
                        <div className="tool-divider"></div>
                        <button
                            className={`tool-btn-inline ${future.length === 0 ? 'disabled' : ''}`}
                            onClick={handleRedo}
                            disabled={future.length === 0}
                            title="Redo (Ctrl+Y)"
                            style={{ opacity: future.length === 0 ? 0.5 : 1 }}
                        >
                            <Redo size={18} />
                        </button>
                    </div>

                    {/* Bottom Left Toolbar */}
                    <div className="ga-toolbar-left">
                        <div className="zoom-controls">
                            <button className="zoom-adjust-btn" onClick={() => setZoom(z => Math.max(10, z - 5))}>
                                <ZoomOut size={18} />
                            </button>
                            <div className="zoom-percentage">
                                <span className="zoom-label">ZOOM</span>
                                <span className="zoom-value">{zoom.toFixed(1)}%</span>
                            </div>
                            <button className="zoom-adjust-btn" onClick={() => setZoom(z => Math.min(400, z + 5))}>
                                <ZoomIn size={18} />
                            </button>
                        </div>
                        <div className="tool-divider"></div>
                        <button
                            className={`tool-btn-inline ${activeTool === 'hand' ? 'active' : ''}`}
                            onClick={() => setActiveTool(activeTool === 'hand' ? 'none' : 'hand')}
                            title="Hand Tool"
                        >
                            <Hand size={18} />
                        </button>
                        <button
                            className={`tool-btn-inline ${activeTool === 'crop' ? 'active' : ''}`}
                            onClick={handleNewSection}
                            title="Crop Tool"
                        >
                            <Crop size={18} />
                        </button>
                    </div>

                    {/* Metadata HUD */}
                    <div className="drawing-info-card">
                        <div className="info-header">
                            <span>METADATA HUD</span>
                            <div className="status-dot"></div>
                        </div>
                        <div className="info-row">
                            <span className="info-label">SCALE:</span>
                            <span className="info-value">1:100 @ ISO A0</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">DWG NO:</span>
                            <span className="info-value">GA-4592-REV04</span>
                        </div>
                        <div className="status-approved">APPROVED</div>
                        <div className="timestamp-text">25_01_27_09:42_UTC</div>
                    </div>

                    {/* Navigation Cluster */}
                    <div className="ga-toolbar-right">
                        <div className="quick-actions">
                            <button
                                className="tool-btn-inline"
                                onClick={() => {
                                    window.open(displayFileUrl, '_blank');
                                }}
                                title="Open Original File"
                            >
                                <Maximize size={18} />
                            </button>
                            <button className="tool-btn-inline" onClick={() => setRotation(r => r - 90)} title="Rotate Left"><RotateCcw size={18} /></button>
                            <button className="tool-btn-inline" onClick={() => setRotation(r => r + 90)} title="Rotate Right"><RotateCw size={18} /></button>
                            <div className="tool-divider"></div>
                            <button
                                className="tool-btn-inline reset-all-btn"
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to remove all mapped sections? This will reset the complete cropper section.")) {
                                        setZoom(100);
                                        setRotation(0);
                                        setOffset({ x: 0, y: 0 });
                                        executeUpdate([]);
                                    }
                                }}
                                title="Reset All Sections"
                            >
                                RESET
                            </button>
                        </div>
                    </div>

                    <div className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </div>
                </div>

                <div className={`ga-viewer-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="ga-sidebar-header-box">
                        <h4>MAPPED SECTIONS</h4>
                        <div className="ga-sidebar-sub-label-v2">{mappedSections.length} AREAS DEFINED</div>
                    </div>


                    <div className="ga-sections-list-container">
                        {mappedSections.map((section, idx) => {
                            const isFocused = section.id === localFocusedId;
                            return (
                                <div
                                    key={section.id}
                                    className={`ga-section-card ${isFocused ? 'active focused' : ''} ${!section.isVisible ? 'hidden-section' : ''}`}
                                    onClick={() => {
                                        setLocalFocusedId(section.id === localFocusedId ? null : section.id);
                                        // Update URL to focus on this section
                                        const query = new URLSearchParams(window.location.search);
                                        if (section.id === localFocusedId) {
                                            query.delete('focusedId');
                                        } else {
                                            query.set('focusedId', section.id);
                                        }
                                        window.history.replaceState(null, '', `${window.location.pathname}?${query.toString()}`);
                                    }}
                                >
                                    <div className="ga-card-header-top">
                                        <span className={`section-idx ${isFocused ? 'current' : ''}`}>
                                            {(idx + 1).toString().padStart(2, '0')}
                                        </span>
                                        <div className="ga-card-actions-row-v2">
                                            <Pencil
                                                size={12}
                                                className="ga-action-icon-refined edit-icon"
                                                onClick={(e) => handleEditMapping(section, e)}
                                            />
                                            <Trash2
                                                size={12}
                                                className="ga-action-icon-refined trash-icon"
                                                onClick={(e) => deleteSection(section.id, e)}
                                            />
                                        </div>
                                    </div>
                                    <CropThumbnail rect={section.rect} />
                                    <div className="section-name">{section.title}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
