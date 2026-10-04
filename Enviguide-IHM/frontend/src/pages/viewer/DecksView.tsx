import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    Upload,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Compass,
    Layers,
    FileText,
    ExternalLink,
    Pencil
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PLAN_OCEAN_PIONEER, PLAN_ACOSTA, PLAN_AFIF, PLAN_PACIFIC_HORIZON, PLAN_GENERIC } from '../../assets/ship_plans';
import GAPlanViewer from './GAPlanViewer';
import { api } from '../../lib/apiClient';
import { ENDPOINTS, API_CONFIG } from '../../config/api.config';
import './DecksView.css';
import './DecksViewPremium.css';

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
    planId: string; // Link to the plan it was cropped from
}

interface UploadedPlan {
    id: string;
    name: string;
    url: string;
    date: string;
}

// Resolve a backend file_path (relative or full URL) to something the
// browser can load directly. Backend stores like "/uploads/ga-plans/foo.png".
function resolveBackendFileUrl(filePath: string): string {
    if (!filePath) return filePath;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '');
    return `${base}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
}

export default function DecksView({ vesselName, vesselId }: { vesselName: string; vesselId?: string }) {
    const { user } = useAuth();
    const isOwnerOrManager = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || '').toLowerCase();
        return role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role === 'vessel' || role.includes('owner') || role.includes('manager') || role.includes('vessel');
    }, [user]);

    const [uploadedPlans, setUploadedPlans] = useState<UploadedPlan[]>(() => {
        const saved = localStorage.getItem(`vessel_plans_${vesselName}`);
        let plans = saved ? JSON.parse(saved) : [];
        // Sanitize URLs: Auto-fix legacy locked file references
        plans = plans.map((p: UploadedPlan) => ({
            ...p,
            url: (p.url && !p.url.includes('ga_plan_')) ? p.url : PLAN_GENERIC
        }));
        return plans;
    });

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState(0);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [activePlanId, setActivePlanId] = useState<string | null>(() => {
        if (uploadedPlans.length > 0) return uploadedPlans[0].id;
        return null;
    });
    const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);
    const [showAllMaterials, setShowAllMaterials] = useState(false);
    const [hoveredMaterial, setHoveredMaterial] = useState<{ id: string, pin: { x: number, y: number }, deckId: string } | null>(null);
    const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);
    const [deckToDelete, setDeckToDelete] = useState<{ id: string; planId: string } | null>(null);

    const [mappedSections, setMappedSections] = useState<MappedSection[]>(() => {
        const saved = localStorage.getItem(`vessel_sections_${vesselName}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved sections:', e);
                return [];
            }
        }
        return [];
    });

    // Backend-sourced material list per deck-area id, populated when the
    // vessel is real (has a vesselId). Keyed by deck.id which matches the
    // backend's deck_areas.id and is what the mapping page passes as
    // deckAreaId when it POSTs new materials. Empty for demo vessels —
    // those still read from localStorage further down.
    interface DeckMaterial {
        id: string;
        name: string;
        ihmPart?: string;
        category?: string;
        hazardType?: string;
        compartment?: string;
        equipment?: string;
        component?: string;
        material?: string;
        materialName?: string;
        quantity?: string;
        unit?: string;
        description?: string;
        pin?: { x: number; y: number };
        pinX?: number | null;
        pinY?: number | null;
        hmStatus?: string;
    }
    const [materialsByDeck, setMaterialsByDeck] = useState<Record<string, DeckMaterial[]>>({});

    // Save plans to localStorage
    useEffect(() => {
        localStorage.setItem(`vessel_plans_${vesselName}`, JSON.stringify(uploadedPlans));
    }, [uploadedPlans, vesselName]);

    // Save sections to localStorage on change
    useEffect(() => {
        localStorage.setItem(`vessel_sections_${vesselName}`, JSON.stringify(mappedSections));
    }, [mappedSections, vesselName]);

    // Backend hydration: when we have a real vesselId, fetch plans + their
    // deck areas from the API and replace local state. Falls back to
    // localStorage / demo data when the vessel isn't backed by a real
    // record (e.g. the static demo vessels).
    const reloadFromBackend = useCallback(async () => {
        if (!vesselId) return;
        try {
            const plansRes = await api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(
                ENDPOINTS.GA_PLANS.LIST(vesselId),
            );
            const plans: UploadedPlan[] = (plansRes.data || []).map((p) => ({
                id: String(p.id),
                name: String(p.name ?? p.fileName ?? 'GA Plan'),
                url: resolveBackendFileUrl(String(p.filePath ?? '')),
                date: typeof p.createdAt === 'string'
                    ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '',
            }));

            const sectionsAcrossPlans: MappedSection[] = [];
            for (const p of plansRes.data || []) {
                const planId = String(p.id);
                try {
                    const detail = await api.get<{ success: boolean; data: Record<string, unknown> }>(
                        ENDPOINTS.GA_PLANS.DETAIL(vesselId, planId),
                    );
                    const areas = (detail.data?.deckAreas as Array<Record<string, unknown>>) || [];
                    for (const a of areas) {
                        sectionsAcrossPlans.push({
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
                            planId,
                        });
                    }
                } catch (err) {
                    console.error(`Failed to load deck areas for plan ${planId}:`, err);
                }
            }

            setUploadedPlans(plans);
            setMappedSections(sectionsAcrossPlans);
            if (plans.length > 0 && !plans.some((p) => p.id === activePlanId)) {
                setActivePlanId(plans[0].id);
            }
        } catch (err) {
            console.error('Failed to load GA plans from backend:', err);
        }
    }, [vesselId, activePlanId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!vesselId) return;
        reloadFromBackend();
        // Re-hydrate when the user returns to this tab (e.g. after saving
        // a deck area in the popup viewer in another tab).
        const onFocus = () => reloadFromBackend();
        const onVis = () => { if (document.visibilityState === 'visible') reloadFromBackend(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [vesselId, reloadFromBackend]);

    useEffect(() => {
        // Unique Static Data Configuration for first 3 vessels
        const demoVessels: Record<string, { decks: { name: string, id: string, count: number }[], planName: string, planUrl: string }> = {
            'MV Ocean Pioneer': {
                planName: 'General Arrangement - Main Deck',
                planUrl: PLAN_OCEAN_PIONEER,
                decks: [
                    { name: 'Bridge Proof', id: 'BRIDGE-01', count: 6 },
                    { name: 'Tank Top', id: 'TANK-04', count: 34 },
                    { name: 'Upper Deck', id: 'UPPER-02', count: 12 },
                    { name: 'Cargo Hold 1', id: 'HOLD-01', count: 8 },
                    { name: 'Engine Room', id: 'ENG-01', count: 15 }
                ]
            },
            'ACOSTA': {
                planName: 'GA Plan - Acosta Main',
                planUrl: PLAN_ACOSTA,
                decks: [
                    { name: 'Main Deck', id: 'MAIN-01', count: 8 },
                    { name: 'Crew Accommodation', id: 'CREW-02', count: 15 },
                    { name: 'Galley Area', id: 'GALLEY-03', count: 4 },
                    { name: 'Technical Deck', id: 'TECH-04', count: 6 },
                    { name: 'Pump Room', id: 'PUMP-05', count: 10 }
                ]
            },
            'AFIF': {
                planName: 'Technical Layout - AFIF',
                planUrl: PLAN_AFIF,
                decks: [
                    { name: 'Deck A', id: 'DECKA-01', count: 10 },
                    { name: 'Deck B', id: 'DECKB-02', count: 5 },
                    { name: 'Engine Room Upper', id: 'ENG-A1', count: 20 },
                    { name: 'Lower Deck', id: 'LOW-04', count: 4 },
                    { name: 'Storage Bay', id: 'STORE-05', count: 7 }
                ]
            },
            'PACIFIC HORIZON': {
                planName: 'Pac-H-Master-GA',
                planUrl: PLAN_PACIFIC_HORIZON,
                decks: [
                    { name: 'Main Deck', id: 'PAC-M1', count: 12 },
                    { name: 'Lower Deck', id: 'PAC-L2', count: 8 },
                    { name: 'Deck A', id: 'PAC-A3', count: 15 },
                    { name: 'Deck B', id: 'PAC-B4', count: 5 },
                    { name: 'Engine Room', id: 'PAC-E5', count: 10 }
                ]
            },
            'MV NATAL': {
                planName: 'NATAL-GA-MASTER',
                planUrl: PLAN_GENERIC,
                decks: [
                    { name: 'Bridge Proof', id: 'NAT-B1', count: 8 },
                    { name: 'Main Deck', id: 'NAT-M1', count: 14 },
                    { name: 'Tank Top', id: 'NAT-T1', count: 10 },
                    { name: 'Upper Deck', id: 'NAT-U1', count: 6 },
                    { name: 'Time Proof', id: 'NAT-TP', count: 4 }
                ]
            }
        };

        const config = demoVessels[vesselName];

        if (config) {
            let basePlanId = activePlanId;

            // Priority 1: Ensure at least one plan exists for the demo vessels
            if (uploadedPlans.length === 0) {
                const staticPlanId = uuidv4();
                const staticPlan = {
                    id: staticPlanId,
                    name: config.planName,
                    url: config.planUrl, // Use Safe Data URI
                    date: 'Feb 09, 2026'
                };
                // Check if plan already exists in state to avoid loop
                setUploadedPlans(prev => {
                    if (prev.some(p => p.id === staticPlanId)) return prev;
                    return [staticPlan];
                });
                setActivePlanId(staticPlanId);
                basePlanId = staticPlanId;
            } else if (!basePlanId) {
                basePlanId = uploadedPlans[0].id;
            }

            // Priority 2: Ensure demo decks exist if no decks are mapped yet
            const savedSections = localStorage.getItem(`vessel_sections_${vesselName}`);
            if (!savedSections || JSON.parse(savedSections).length === 0) {
                const deckDefinitions = config.decks;

                // Technical coordinates mapped to the new 2000x1400 SVG system
                // The SVGs were designed to have elements at these approximate relative locations
                // Original system was 1000px wide. New system is 2000px wide. 
                // We keep the coordinates as they are because the Viewers scale them, BUT we need to ensure the SVG content matches.
                // The SVG content I wrote has BRIDGE at 400,440 (matches 410,442).
                // HOLD 1 at 670,550 (matches 675,555).
                // ENGINE at 100,550 (matches 105,555).

                const newSections: MappedSection[] = deckDefinitions.map((def, index) => {
                    // Rect definitions (Relative to 1000px width as originally designed)
                    const rects = [
                        { x: 410, y: 442, width: 140, height: 95 }, // Bridge / Top Command
                        { x: 105, y: 555, width: 200, height: 120 }, // Engine / Aft (Updated size to match SVG)
                        { x: 375, y: 555, width: 95, height: 95 },  // Mid Area
                        { x: 675, y: 555, width: 130, height: 100 }, // Cargo Hold 1
                        { x: 105, y: 749, width: 635, height: 150 }  // Main Hull Area
                    ];

                    const rect = rects[index % rects.length];

                    return {
                        id: uuidv4(),
                        title: def.name,
                        sectionId: def.id,
                        rect: rect,
                        // Increase count for the first 4 decks significantly
                        itemsCount: index < 4 ? Math.max((def as any).count || 0, 12) : ((def as any).count || 0),
                        isVisible: true,
                        planId: basePlanId || ''
                    };
                });

                // Static Data Templates for the first 3 decks
                const staticMaterials = [
                    {
                        name: 'Parts of Brass',
                        material: 'Brass',
                        desc: 'Part I Materials contained in ship structure or equipment - I-2 Equipment and machinery.',
                        loc: 'Accommodation Part B, Bridge Roof',
                        hmPart: 'Part I-2'
                    },
                    {
                        name: 'Copper Tubing',
                        material: 'Copper',
                        desc: 'Standard marine grade copper tubing for hydraulic control lines.',
                        loc: '0.05m\u00B3 in W.T. SWITCH',
                        hmPart: 'Part II'
                    },
                    {
                        name: 'Fluorescent Tubes',
                        material: 'Mercury',
                        desc: 'Mercury containing lamps for lighting fixtures throughout the bridge section.',
                        loc: 'Bridge Ceiling Panel A',
                        hmPart: 'Part II-2-1'
                    },
                    {
                        name: 'Lead-acid Batteries',
                        material: 'Lead',
                        desc: 'Emergency backup batteries for bridge communication equipment.',
                        loc: 'Radio Battery Box',
                        hmPart: 'Part I-1'
                    },
                    {
                        name: 'Fire Dampers',
                        material: 'Asbestos',
                        desc: 'Mechanical ventilation components with possible asbestos-containing gaskets.',
                        loc: 'Ventilation Shaft A',
                        hmPart: 'Part I-1-2'
                    },
                    {
                        name: 'Mercury Switches',
                        material: 'Mercury',
                        desc: 'Tilt-sensing switches within the bridge console control modules.',
                        loc: 'Bridge Console Main',
                        hmPart: 'Part II-2-2'
                    },
                    {
                        name: 'Thermal Insulation',
                        material: 'Asbestos',
                        desc: 'Lagging on exhaust pipes in the engine room.',
                        loc: 'Main Engine Exhaust',
                        hmPart: 'Part I-1'
                    },
                    {
                        name: 'Circuit Breakers',
                        material: 'PCBs',
                        desc: 'Older capacitors in main switchboard.',
                        loc: 'Engine Control Room',
                        hmPart: 'Part I-3'
                    },
                    {
                        name: 'Cooling System Agent',
                        material: 'CFCs',
                        desc: 'Refrigerant gas R-12 in provision cooling plant.',
                        loc: 'Galley Cold Store',
                        hmPart: 'Part II-1'
                    },
                    {
                        name: 'Anti-fouling Paint',
                        material: 'Organotin',
                        desc: 'Hull coating samples from dry dock inspection.',
                        loc: 'External Hull Strakes',
                        hmPart: 'Part I-4'
                    },
                    {
                        name: 'Heat Shielding',
                        material: 'Ceramic Fiber',
                        desc: 'High-temp insulation around incinerator.',
                        loc: 'Incinerator Room',
                        hmPart: 'Part II-3'
                    },
                    {
                        name: 'Emergency Light Batteries',
                        material: 'Cadmium',
                        desc: 'Ni-Cd batteries in emergency lighting units.',
                        loc: 'Corridors Deck A',
                        hmPart: 'Part I-2'
                    }
                ];

                // Populate LocalStorage
                newSections.forEach((section) => {
                    const materials = Array.from({ length: section.itemsCount }).map((_, i) => {
                        const template = staticMaterials[i % staticMaterials.length];
                        return {
                            id: uuidv4(),
                            name: `${template.name} ${i + 1}`,
                            material: template.material,
                            description: template.desc,
                            pin: {
                                x: section.rect.x + Math.random() * section.rect.width,
                                y: section.rect.y + Math.random() * section.rect.height
                            },
                            ihmPart: template.hmPart,
                            hazMaterials: [template.material],
                            deckPlan: section.title,
                            shipPO: 'PO-12345',
                            compartment: template.loc,
                            equipment: 'System A',
                            position: 'Wall',
                            component: 'Unit',
                            quantity: '1',
                            unit: 'pc',
                            hmStatus: 'CHM',
                            files: [],
                            avoidUpdation: false,
                            movementType: 'Installation'
                        };
                    });
                    localStorage.setItem(`inventory_${vesselName}_${section.title}`, JSON.stringify(materials));
                });

                localStorage.setItem(`vessel_sections_${vesselName}`, JSON.stringify(newSections));
                setMappedSections(newSections);
            }
        }
    }, [vesselName, uploadedPlans.length, activePlanId]);

    // Sync from localStorage cross-tab, on mount, and on tab focus/visibility
    useEffect(() => {
        const syncData = () => {
            const savedSections = localStorage.getItem(`vessel_sections_${vesselName}`);
            if (savedSections) {
                try {
                    const sections = JSON.parse(savedSections);
                    const updatedSections = sections.map((s: MappedSection) => {
                        const invValue = localStorage.getItem(`inventory_${vesselName}_${s.title}`);
                        const count = invValue ? JSON.parse(invValue).length : 0;
                        return { ...s, itemsCount: count };
                    });
                    setMappedSections(updatedSections);
                } catch (e) {
                    console.error('Failed to sync sections:', e);
                }
            } else {
                setMappedSections([]);
            }
        };

        const handleStorage = (e: StorageEvent) => {
            if (e.key === `vessel_sections_${vesselName}` || (e.key && e.key.includes('inventory_'))) {
                syncData();
            }
        };
        const handleFocus = () => syncData();
        const handleVisibility = () => { if (document.visibilityState === 'visible') syncData(); };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        syncData();
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [vesselName]);

    // ── Backend material loader (replaces the localStorage-only path
    //    for backed vessels) ────────────────────────────────────────
    // Pulls every material for a given deck.id (== deck_areas.id on the
    // backend) and stashes it under that key in materialsByDeck. Cheap
    // and idempotent — safe to call on every visibilitychange / focus
    // so the count auto-updates when the user comes back from the
    // Hazardous Material Mapping page.
    const loadDeckMaterialsFromBackend = useCallback(async (deckId: string) => {
        if (!vesselId) return;
        try {
            const url = `${ENDPOINTS.MATERIALS.LIST(vesselId)}?deckAreaId=${encodeURIComponent(deckId)}`;
            const res = await api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(url);
            const rows = (res.data || []) as Array<Record<string, unknown>>;
            const mapped: DeckMaterial[] = rows.map((r) => ({
                id: String(r.id ?? ''),
                name: String(r.name ?? ''),
                ihmPart: r.ihmPart ? String(r.ihmPart) : undefined,
                category: r.category ? String(r.category) : undefined,
                hazardType: r.hazardType ? String(r.hazardType) : undefined,
                compartment: r.compartment ? String(r.compartment) : undefined,
                equipment: r.equipment ? String(r.equipment) : undefined,
                component: r.component ? String(r.component) : undefined,
                material: r.material ? String(r.material) : undefined,
                materialName: r.materialName ? String(r.materialName) : undefined,
                quantity: r.quantity ? String(r.quantity) : undefined,
                unit: r.unit ? String(r.unit) : undefined,
                description: r.description ? String(r.description) : undefined,
                pinX: r.pinX != null ? Number(r.pinX) : null,
                pinY: r.pinY != null ? Number(r.pinY) : null,
                pin: r.pinX != null && r.pinY != null
                    ? { x: Number(r.pinX), y: Number(r.pinY) }
                    : undefined,
                hmStatus: r.hmStatus ? String(r.hmStatus) : undefined,
            }));
            setMaterialsByDeck((prev) => ({ ...prev, [deckId]: mapped }));
        } catch (err) {
            // Soft-fail: don't blank the existing entry on a transient
            // error, just log so the user isn't left with an empty deck.
            console.error(`Failed to load materials for deck ${deckId}:`, err);
        }
    }, [vesselId]);

    // Bulk-load materials for every visible deck whenever the section
    // list changes or the vessel changes. Single mount + every time
    // mappedSections gets a new entry.
    useEffect(() => {
        if (!vesselId || mappedSections.length === 0) return;
        for (const s of mappedSections) loadDeckMaterialsFromBackend(s.id);
    }, [vesselId, mappedSections, loadDeckMaterialsFromBackend]);

    // Refresh on tab refocus — covers the most common flow: user clicks
    // Add Material → goes to /mapping → adds the item → comes back here.
    // Without this the count stays stale until a hard reload.
    useEffect(() => {
        if (!vesselId) return;
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            for (const s of mappedSections) loadDeckMaterialsFromBackend(s.id);
        };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [vesselId, mappedSections, loadDeckMaterialsFromBackend]);

    // Listen to storage events to auto-refresh deck materials in real time
    useEffect(() => {
        const onStorage = () => setMaterialsByDeck((prev) => ({ ...prev }));
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Resolve the materials for a deck row. Merges backend-fetched materials
    // with local storage items across all matching deck keys to ensure all mapped materials display reliably.
    const materialsForDeck = (deck: MappedSection): DeckMaterial[] => {
        const backendList = (vesselId && materialsByDeck[deck.id]) ? materialsByDeck[deck.id] : [];
        let localList: DeckMaterial[] = [];

        try {
            const keysToTry = [
                `inventory_${vesselName}_${deck.title}`,
                `inventory_${vesselName}_${deck.sectionId}`,
                `inventory_${vesselName}_${deck.id}`,
            ];

            for (const k of keysToTry) {
                const stored = localStorage.getItem(k);
                if (stored) {
                    const parsed = JSON.parse(stored) as DeckMaterial[];
                    if (Array.isArray(parsed)) localList.push(...parsed);
                }
            }

            // Also check all inventory keys in localStorage matching vesselName
            const prefix = `inventory_${vesselName}_`;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix) && !keysToTry.includes(k)) {
                    const stored = localStorage.getItem(k);
                    if (stored) {
                        const items = JSON.parse(stored) as any[];
                        if (Array.isArray(items)) {
                            const matching = items.filter((m) => {
                                const p = (m.deckPlan || m.deckAreaName || m.compartment || '').toLowerCase();
                                return p.includes(deck.title.toLowerCase()) || p.includes(deck.sectionId.toLowerCase());
                            });
                            localList.push(...matching);
                        }
                    }
                }
            }
        } catch {}

        const map = new Map<string, DeckMaterial>();
        for (const item of [...localList, ...backendList]) {
            const key = item.id || `${item.name}_${item.ihmPart || ''}_${item.material || ''}`;
            if (!map.has(key) || backendList.includes(item)) {
                map.set(key, item);
            }
        }
        return Array.from(map.values());
    };

    // Mapped item count helper. Used by the deck row header. Returns
    // the live count from whichever source `materialsForDeck` resolved.
    const getFreshItemCount = (deck: MappedSection): number => materialsForDeck(deck).length;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);
        setCurrentStage(0);

        // Backend-backed upload when we have a real vessel. Falls back to
        // the simulated client-only flow for the static demo vessels.
        const realUpload = async () => {
            if (!vesselId) return null;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', file.name);
            const res = await api.upload<{ success: boolean; data: Record<string, unknown> }>(
                ENDPOINTS.GA_PLANS.LIST(vesselId),
                fd,
            );
            return res.data;
        };

        // Drive the progress bar UI while the upload is on the wire.
        let progress = 0;
        const interval = setInterval(() => {
            progress = Math.min(95, progress + Math.floor(Math.random() * 12) + 4);
            setUploadProgress(progress);
            if (progress < 33) setCurrentStage(0);
            else if (progress < 66) setCurrentStage(1);
            else setCurrentStage(2);
        }, 250);

        const finish = (newPlan: UploadedPlan) => {
            clearInterval(interval);
            setUploadProgress(100);
            setCurrentStage(2);
            setTimeout(() => {
                setIsUploading(false);
                setUploadedPlans(prev => [...prev, newPlan]);
                setActivePlanId(newPlan.id);
            }, 400);
        };

        const fail = (err: unknown) => {
            clearInterval(interval);
            setIsUploading(false);
            console.error('GA Plan upload failed:', err);
        };

        if (vesselId) {
            realUpload()
                .then((data) => {
                    if (!data) {
                        fail(new Error('No data returned from upload'));
                        return;
                    }
                    finish({
                        id: String(data.id),
                        name: String(data.name ?? data.fileName ?? file.name),
                        url: resolveBackendFileUrl(String(data.filePath ?? '')),
                        date: typeof data.createdAt === 'string'
                            ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    });
                })
                .catch(fail);
        } else {
            // Demo / no-backend path: simulate the upload as before.
            const url = URL.createObjectURL(file);
            const newId = Math.random().toString(36).substr(2, 9);
            setTimeout(() => {
                finish({
                    id: newId,
                    name: file.name,
                    url,
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                });
            }, 1500);
        }
    };

    const removePlan = (id: string) => {
        setPlanToDeleteId(id);
    };

    const confirmRemovePlan = (id: string) => {
        if (vesselId) {
            api.delete(ENDPOINTS.GA_PLANS.DETAIL(vesselId, id)).catch((err) => {
                console.error('GA Plan delete failed:', err);
            });
        }

        setUploadedPlans(prev => {
            const planToRemove = prev.find(p => p.id === id);
            if (planToRemove && planToRemove.url.startsWith('blob:')) {
                URL.revokeObjectURL(planToRemove.url);
            }
            const remaining = prev.filter(p => p.id !== id);

            if (activePlanId === id) {
                setActivePlanId(remaining.length > 0 ? remaining[0].id : null);
            }

            return remaining;
        });

        // Also remove all sections associated with this specific plan
        setMappedSections(prev => prev.filter(section => section.planId !== id));
        setPlanToDeleteId(null);
    };

    const removeDeck = (deckId: string, planId: string) => {
        setDeckToDelete({ id: deckId, planId });
    };

    const confirmRemoveDeck = async () => {
        if (!deckToDelete) return;
        const { id: deckId, planId } = deckToDelete;
        if (vesselId && planId) {
            try {
                await api.delete(ENDPOINTS.DECK_AREAS.DETAIL(vesselId, planId, deckId));
            } catch (err) {
                console.error('Failed to delete deck from backend:', err);
            }
        }
        const newSections = mappedSections.filter(s => s.id !== deckId);
        localStorage.setItem(`vessel_sections_${vesselName}`, JSON.stringify(newSections));
        setMappedSections(newSections);
        setDeckToDelete(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedDeckId(expandedDeckId === id ? null : id);
        setShowAllMaterials(false);
    };

    const handleAddNewDeck = () => {
        const plan = uploadedPlans.find(p => p.id === activePlanId) || uploadedPlans[0];
        if (!plan) return;
        const ids = vesselId ? `&vesselId=${encodeURIComponent(vesselId)}&planId=${encodeURIComponent(plan.id)}` : '';
        window.open(`/viewer?url=${encodeURIComponent(plan.url)}&name=${encodeURIComponent(plan.name)}&vessel=${encodeURIComponent(vesselName)}${ids}&isolated=false&showAll=true`, '_blank');
    };

    // Component to show a technical cropped preview of the deck
    const DeckPreview = ({ rect, fileUrl, highlightPin }: { rect: Rect, fileUrl: string, highlightPin?: { x: number, y: number } | null }) => {
        const displayWidth = 180;
        const displayHeight = 126;

        const demoVesselsPreviews: Record<string, string> = {
            'MV Ocean Pioneer': PLAN_OCEAN_PIONEER,
            'ACOSTA': PLAN_ACOSTA,
            'AFIF': PLAN_AFIF,
            'PACIFIC HORIZON': PLAN_PACIFIC_HORIZON
        };

        // PRIORITIZE USER UPLOADS:
        // 1. If we have a fileUrl and it's NOT the broken one, use it. This covers user uploads (blobs).
        // 2. If no valid fileUrl, check if it's a known demo vessel and use its plan.
        // 3. Last fallback to generic.

        let displayUrl = (fileUrl && !fileUrl.includes('ga_plan_')) ? fileUrl : null;

        if (!displayUrl && vesselName && demoVesselsPreviews[vesselName]) {
            displayUrl = demoVesselsPreviews[vesselName];
        }

        if (!displayUrl) {
            displayUrl = PLAN_GENERIC;
        }

        const uniformScale = Math.min(displayWidth / rect.width, displayHeight / rect.height);
        const actualWidth = rect.width * uniformScale;
        const actualHeight = rect.height * uniformScale;

        return (
            <div className="deck-technical-preview-outer" style={{
                width: `${actualWidth}px`,
                height: `${actualHeight}px`,
                background: '#F2F4F7',
                borderRadius: '4px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <img
                    src={displayUrl}
                    alt="Deck Preview"
                    style={{
                        position: 'absolute',
                        left: `${-rect.x * uniformScale}px`,
                        top: `${-rect.y * uniformScale}px`,
                        width: `${1000 * uniformScale}px`,
                        height: 'auto',
                        maxWidth: 'none',
                        pointerEvents: 'none',
                        display: 'block',
                        filter: 'contrast(1.1) brightness(1.02)'
                    }}
                />

                {/* Hover Highlight Marker */}
                {highlightPin && (
                    <div
                        className="material-highlight-pulse-mini"
                        style={{
                            position: 'absolute',
                            left: `${(highlightPin.x - rect.x) * uniformScale}px`,
                            top: `${(highlightPin.y - rect.y) * uniformScale}px`,
                            width: '12px',
                            height: '12px',
                            background: '#00B0FA',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 0 4px rgba(0, 176, 250, 0.3)',
                            zIndex: 2,
                            animation: 'pulseHighlight 1.5s infinite'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '2px solid #00B0FA',
                            animation: 'rippleHighlight 1.5s infinite'
                        }}></div>
                    </div>
                )}
            </div>
        );
    };

    const activePlan = uploadedPlans.find(p => p.id === activePlanId) || (uploadedPlans.length > 0 ? uploadedPlans[0] : null);

    if (isViewerOpen && activePlan) {
        return (
            <GAPlanViewer
                filename={activePlan.name}
                fileUrl={activePlan.url}
                onClose={() => {
                    setIsViewerOpen(false);
                    if (vesselId) {
                        reloadFromBackend();
                    } else {
                        // Reload sections from localStorage when viewer closes
                        const savedSections = localStorage.getItem(`vessel_sections_${vesselName}`);
                        if (savedSections) {
                            try {
                                const parsed = JSON.parse(savedSections);
                                setMappedSections(parsed);
                            } catch (e) {
                                console.error('Failed to parse saved sections:', e);
                            }
                        }
                    }
                }}
                mappedSections={mappedSections}
                onUpdateSections={setMappedSections as any}
                vesselName={vesselName}
                vesselId={vesselId}
                gaPlanId={activePlanId || undefined}
                allPlans={uploadedPlans}
                showAllPlansMode={true}
            />
        );
    }

    const openMapping = (deck: any, action?: string, materialId?: string) => {
        const title = deck.title || deck.name || 'Deck Area';
        const deckId = deck.id || '';
        const params: Record<string, string> = {
            vessel: vesselName,
            name: title,
            deckTitle: title,
            deckId: deckId,
            deckAreaId: deckId,
            url: activePlan?.url || '',
            planUrl: activePlan?.url || '',
            vesselId: vesselId || ''
        };
        if (action) params.action = action;
        if (materialId) params.materialId = materialId;
        if (isOwnerOrManager) params.readOnly = 'true';
        const urlParams = new URLSearchParams(params);
        window.open(`/mapping?${urlParams.toString()}`, '_blank');
    };

    const visibleDecks = activePlanId
        ? mappedSections.filter(deck => deck.planId === activePlanId)
        : mappedSections;

    return (
        <div className={`decks-view-container ${uploadedPlans.length === 0 ? 'no-scroll' : ''}`}>
            {/* GA Plans Upload Section */}
            <div className="ga-upload-card-refined">
                {!isOwnerOrManager && (
                    <div className="ga-upload-initial-row">
                        <div className="ga-upload-label clickable" onClick={() => fileInputRef.current?.click()}>
                            <Upload size={18} color="#00B0FA" />
                            <span>GA Plans Upload</span>
                        </div>
                        {isUploading ? (
                            <div className="ga-progress-container">
                                <div className="ga-progress-bar-bg">
                                    <div className="ga-progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                                    <div className="ga-progress-text-overlay">
                                        <span>Uploading: <strong>Plan_Section.pdf</strong></span>
                                    </div>
                                </div>
                                <span className="ga-progress-percentage">{uploadProgress}%</span>
                            </div>
                        ) : (
                            <div className="ga-upload-dropzone-right" onClick={() => fileInputRef.current?.click()}>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} />
                                <span className="dropzone-text">Choose file or drag & drop GA Plans here (PDF, PNG, JPEG up to 50MB)</span>
                                <Upload size={16} className="dropzone-icon" />
                            </div>
                        )}
                    </div>
                )}

                {(uploadedPlans.length > 0) && (
                    <div className="uploaded-plans-container">
                        <div className="uploaded-plans-list">
                            {uploadedPlans.map(plan => {
                                const isPdfPlan = plan.url.toLowerCase().endsWith('.pdf') || plan.name.toLowerCase().endsWith('.pdf');
                                return (
                                    <div
                                        key={plan.id}
                                        className={`plan-preview-card ${activePlanId === plan.id ? 'active' : ''}`}
                                        onClick={() => setActivePlanId(activePlanId === plan.id ? null : plan.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="plan-preview-thumbnail-box">
                                            {isPdfPlan ? (
                                                <div className="pdf-thumbnail-placeholder">
                                                    <FileText size={32} color="#94A3B8" />
                                                    <span className="pdf-label-txt">PDF Document</span>
                                                </div>
                                            ) : (
                                                <img src={plan.url} alt={plan.name} className="plan-thumbnail-image" />
                                            )}
                                        </div>
                                        <div className="plan-card-footer">
                                            <div className="plan-card-meta">
                                                <span className="plan-card-name" title={plan.name}>{plan.name}</span>
                                                <span className="plan-card-date">Uploaded on {plan.date}</span>
                                            </div>
                                            <div className="plan-card-actions">
                                                <button
                                                    className="open-full-viewer-btn-premium"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const ids = vesselId ? `&vesselId=${encodeURIComponent(vesselId)}&planId=${encodeURIComponent(plan.id)}` : '';
                                                        window.open(`/viewer?url=${encodeURIComponent(plan.url)}&name=${encodeURIComponent(plan.name)}&vessel=${encodeURIComponent(vesselName)}${ids}&isolated=false`, '_blank');
                                                    }}
                                                >
                                                    <ExternalLink size={14} />
                                                    <span>VIEW PLAN</span>
                                                </button>
                                                {!isOwnerOrManager && (
                                                    <button
                                                        className="plan-action-btn-refined delete"
                                                        onClick={(e) => { e.stopPropagation(); removePlan(plan.id); }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Active Decks Section Card */}
            <div className="active-decks-section-card">
                <div className="active-decks-header">
                    <div className="active-decks-title">
                        <h3>Active Decks</h3>
                        <span className="deck-count-badge">{visibleDecks.length}</span>
                    </div>
                    {!isOwnerOrManager && (
                        <button
                            className={`add-deck-btn ${(uploadedPlans.length === 0 || isUploading) ? 'disabled' : ''}`}
                            disabled={uploadedPlans.length === 0 || isUploading}
                            onClick={handleAddNewDeck}
                        >
                            <Plus size={18} />
                            Add New Deck
                        </button>
                    )}
                </div>

                <div className="decks-list-content">
                    {/* 
                            Logic: 
                            1. If not uploading AND no decks AND no plans -> Show large empty state
                            2. If uploading AND no plans -> Show large uploading animation
                            3. Otherwise -> Show the list (which captures: has decks, or has plans, or uploading while having plans)
                        */}
                    {!isUploading && visibleDecks.length === 0 && uploadedPlans.length === 0 ? (
                        <div className="no-decks-centered-state">
                            <div className="deck-empty-visual-canvas">
                                <div className="deck-blueprint-illustration-premium">
                                    <div className="blueprint-canvas">
                                        <div className="tech-lines-system">
                                            <div className="tech-line-group left">
                                                <div className="line-segment long"></div>
                                                <div className="line-segment short"></div>
                                            </div>
                                            <div className="tech-line-group center">
                                                <div className="line-segment medium"></div>
                                                <div className="line-segment short"></div>
                                                <div className="line-segment medium"></div>
                                            </div>
                                            <div className="tech-line-group right">
                                                <div className="line-segment short"></div>
                                                <div className="line-segment long"></div>
                                            </div>
                                        </div>
                                        <div className="divider-tool-v3">
                                            <div className="divider-head-box">
                                                <div className="divider-handle"></div>
                                                <div className="divider-circle-v3">
                                                </div>
                                            </div>
                                            <div className="divider-legs-v3">
                                                <div className="leg-v3 left"></div>
                                                <div className="leg-v3 right"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="plus-floating-mini">
                                        <Plus size={14} />
                                    </div>
                                </div>
                            </div>
                            <h4 className="empty-state-title-large">No Active Decks for {vesselName}</h4>
                            <p className="empty-state-subtitle-large">
                                {isOwnerOrManager 
                                  ? `No GA plans or deck areas have been mapped for ${vesselName} yet.`
                                  : `Upload a GA Plan for ${vesselName} to start mapping vessel decks and material logs.`
                                }
                            </p>
                            {!isOwnerOrManager && (
                                <button className="upload-first-plan-btn-premium" onClick={() => fileInputRef.current?.click()}>
                                    <FileText size={18} />
                                    Upload First Plan
                                </button>
                            )}
                        </div>
                    ) : isUploading && uploadedPlans.length === 0 ? (
                        <div className="no-decks-centered-state">
                            <div className="deck-empty-visual-canvas">
                                <div className="deck-blueprint-illustration-premium">
                                    <div className="blueprint-canvas is-uploading">
                                        <div className="divider-tool-uploading">
                                            <div className="upload-pulse-ring"></div>
                                            <Upload size={32} />
                                        </div>
                                    </div>
                                    <div className="plus-floating-mini">
                                        <Plus size={14} />
                                    </div>
                                </div>
                            </div>
                            <h4 className="empty-state-title-large">Uploading Plan...</h4>
                            <div className="stage-messages-container">
                                {currentStage === 0 && (
                                    <div className="stage-message active" key="stage-0">
                                        Three decks identified
                                    </div>
                                )}
                                {currentStage === 1 && (
                                    <div className="stage-message active" key="stage-1">
                                        Structure layout detected
                                    </div>
                                )}
                                {currentStage === 2 && (
                                    <div className="stage-message active" key="stage-2">
                                        Preparing workspace
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="decks-scroll-wrapper">
                            {/* Subtle upload indicator for subsequent uploads */}
                            {isUploading && uploadedPlans.length > 0 && (
                                <div className="compact-upload-status">
                                    <div className="spinner-mini"></div>
                                    <span>Updating GA Plans & Decks... {uploadProgress}%</span>
                                </div>
                            )}

                             {visibleDecks.length === 0 ? (
                                 <div className="no-decks-centered-state">
                                    <div className="empty-compass-container">
                                        <div className="compass-icon-refined">
                                            <Compass size={32} />
                                        </div>
                                    </div>
                                    <h4 className="empty-state-title">No Decks Mapped Yet</h4>
                                    <p className="empty-state-subtitle">
                                        You have uploaded the GA Plan. Now use the <strong>Viewer tool</strong> to create decks and material logs.
                                    </p>
                                </div>
                            ) : (
                                <>
                                     {visibleDecks.map((deck) => (
                                         <div key={deck.id} className="deck-row-card">
                                            <div className="deck-row-header" onClick={() => toggleExpand(deck.id)}>
                                                <div className="deck-row-icon-box" onClick={(e) => { e.stopPropagation(); openMapping(deck); }}>
                                                    {(() => {
                                                        const deckPlan = uploadedPlans.find(p => p.id === deck.planId) || activePlan || (uploadedPlans.length > 0 ? uploadedPlans[0] : null);
                                                        return deckPlan ? (
                                                            <DeckPreview
                                                                rect={deck.rect}
                                                                fileUrl={deckPlan.url}
                                                                highlightPin={hoveredMaterial?.deckId === deck.id ? hoveredMaterial.pin : null}
                                                            />
                                                        ) : (
                                                            <div className="deck-row-icon-placeholder">
                                                                {deck.title.toLowerCase().includes('tank') ? <Layers size={21} /> : <Compass size={21} />}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="deck-info-primary">
                                                    <div className="deck-title-row">
                                                        <span className="deck-name-txt">{deck.title}</span>
                                                        <span className="deck-id-tag">{deck.sectionId}</span>
                                                    </div>
                                                    <div className="deck-meta-row">
                                                        <Compass size={12} />
                                                        <span>{Math.max(deck.itemsCount || 0, getFreshItemCount(deck))} Mapped Items</span>
                                                        <span className="meta-dot"></span>
                                                        <span>Ready for Inspection</span>
                                                    </div>
                                                </div>
                                                <div className="deck-row-actions-group">
                                                    {!isOwnerOrManager && (
                                                        <>
                                                            <button className="deck-action-icn-btn" onClick={(e) => { e.stopPropagation(); openMapping(deck, 'edit'); }} title="Edit Mapping">
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button className="deck-action-icn-btn" onClick={(e) => { e.stopPropagation(); removeDeck(deck.id, deck.planId || activePlanId || ''); }} title="Delete Deck">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <div className="action-icon-btn" onClick={() => toggleExpand(deck.id)}>
                                                        {expandedDeckId === deck.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </div>
                                                </div>
                                            </div>

                                            {expandedDeckId === deck.id && (
                                                <div className="deck-log-expanded">
                                                    <div className="log-title-row">
                                                        <div className="log-header-left">
                                                            <FileText size={16} color="#00B0FA" />
                                                            <span className="log-title-text">MATERIAL LOG FOR {deck.title.toUpperCase()}</span>
                                                        </div>
                                                        {(() => {
                                                            const items = materialsForDeck(deck);
                                                            return items.length > 3 && (
                                                                <button
                                                                    className="show-more-materials-btn"
                                                                    style={{
                                                                        color: '#00B0FA',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        fontSize: '13px',
                                                                        fontWeight: 600
                                                                    }}
                                                                    onClick={(e) => { e.stopPropagation(); setShowAllMaterials(!showAllMaterials); }}
                                                                >
                                                                    {showAllMaterials ? (
                                                                        <>Show Less <ChevronUp size={16} /></>
                                                                    ) : (
                                                                        <>Show More <ChevronDown size={16} /></>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="materials-grid-v2">
                                                        {(() => {
                                                            const items = materialsForDeck(deck);
                                                            if (items.length === 0) return (
                                                                <div className="no-materials-placeholder-v2">
                                                                    <p>No materials mapped yet.</p>
                                                                    {!isOwnerOrManager && (
                                                                        <button className="add-material-btn-primary" onClick={() => openMapping(deck, 'add')}>
                                                                            <Plus size={16} /> Add Material
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );

                                                            const itemsToShow = showAllMaterials ? items : items.slice(0, 3);

                                                            return (
                                                                <>
                                                                    {itemsToShow.map((item: any) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="mat-card-v2"
                                                                            onClick={() => openMapping(deck, undefined, item.id)}
                                                                            onMouseEnter={() => setHoveredMaterial({ id: item.id, pin: item.pin, deckId: deck.id })}
                                                                            onMouseLeave={() => setHoveredMaterial(null)}
                                                                            style={{ cursor: 'pointer', position: 'relative' }}
                                                                        >
                                                                            <div className="mat-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <div className="mat-dot-indicator" style={{
                                                                                        background: (item.hmStatus || '').toUpperCase() === 'CHM' ? '#DC2626' : (item.hmStatus || '').toUpperCase() === 'PCHM' ? '#D97706' : '#059669'
                                                                                    }} />
                                                                                    <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{item.name}</h5>
                                                                                </div>
                                                                                <span style={{
                                                                                    fontSize: '10px',
                                                                                    fontWeight: 'bold',
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: '12px',
                                                                                    background: (item.hmStatus || '').toUpperCase() === 'CHM' ? '#FEF2F2' : (item.hmStatus || '').toUpperCase() === 'PCHM' ? '#FFFBEB' : '#ECFDF5',
                                                                                    color: (item.hmStatus || '').toUpperCase() === 'CHM' ? '#DC2626' : (item.hmStatus || '').toUpperCase() === 'PCHM' ? '#D97706' : '#059669',
                                                                                    border: `1px solid ${(item.hmStatus || '').toUpperCase() === 'CHM' ? '#FECACA' : (item.hmStatus || '').toUpperCase() === 'PCHM' ? '#FDE68A' : '#A7F3D0'}`
                                                                                }}>
                                                                                    {(item.hmStatus || 'CHM').toUpperCase()}
                                                                                </span>
                                                                            </div>

                                                                            <p className="mat-card-desc" style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 10px 0' }}>
                                                                                {item.description || item.material || (item.hazMaterials && item.hazMaterials[0]) || 'Mapped onboard material.'}
                                                                            </p>

                                                                            <div className="mat-card-meta" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                                                                                <div className="meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                    <span className="meta-label" style={{ color: '#64748B', fontWeight: '500' }}>Compartment / Loc:</span>
                                                                                    <span className="meta-val" style={{ color: '#1E293B', fontWeight: '600' }}>{item.compartment || item.position || 'Deck Area'}</span>
                                                                                </div>
                                                                                <div className="meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                    <span className="meta-label" style={{ color: '#64748B', fontWeight: '500' }}>IHM Part:</span>
                                                                                    <span className="meta-val" style={{ color: '#1E293B', fontWeight: '600' }}>{item.ihmPart || 'Part I'}</span>
                                                                                </div>
                                                                                {item.shipPO && (
                                                                                    <div className="meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                        <span className="meta-label" style={{ color: '#64748B', fontWeight: '500' }}>PO Number:</span>
                                                                                        <span className="meta-val" style={{ color: '#0284C7', fontWeight: '600' }}>{item.shipPO}</span>
                                                                                    </div>
                                                                                )}
                                                                                {item.quantity && (
                                                                                    <div className="meta-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                        <span className="meta-label" style={{ color: '#64748B', fontWeight: '500' }}>Quantity:</span>
                                                                                        <span className="meta-val" style={{ color: '#1E293B', fontWeight: '600' }}>{item.quantity} {item.unit || 'kg'} {item.noOfPieces ? `(${item.noOfPieces} PCS)` : ''}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                    {/* Removed bottom button */}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {visibleDecks.length > 0 && (
                                        <div className="add-plan-section-container">
                                            <button
                                                className="add-plan-section-dashed-refined"
                                                onClick={handleAddNewDeck}
                                            >
                                                <Plus size={20} />
                                                Add New Plan Section
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {planToDeleteId && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-card">
                        <div className="custom-confirm-icon delete">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="custom-confirm-title">Delete GA Plan</h3>
                        <p className="custom-confirm-message">
                            Should we delete the GA plan? If you delete this GA plan, the entire active deck that you have been marked will be deleted.
                        </p>
                        <div className="custom-confirm-actions">
                            <button className="custom-confirm-btn cancel" onClick={() => setPlanToDeleteId(null)}>
                                CANCEL
                            </button>
                            <button className="custom-confirm-btn delete" onClick={() => confirmRemovePlan(planToDeleteId)}>
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {deckToDelete && (
                <div className="custom-confirm-overlay">
                    <div className="custom-confirm-card">
                        <div className="custom-confirm-icon delete">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="custom-confirm-title">Delete Active Deck</h3>
                        <p className="custom-confirm-message">
                            Are you sure you want to delete this deck? This will delete all material logs associated with this deck.
                        </p>
                        <div className="custom-confirm-actions">
                            <button className="custom-confirm-btn cancel" onClick={() => setDeckToDelete(null)}>
                                CANCEL
                            </button>
                            <button className="custom-confirm-btn delete" onClick={confirmRemoveDeck}>
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
