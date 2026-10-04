import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    Search, Plus, Check, ShieldCheck, BarChart2, ShoppingCart, Layers,
    FolderOpen, Ship as ShipIcon, GripVertical, Book, Paperclip,
    ExternalLink, Download, X, AlertTriangle, Monitor, FileText,
    ChevronDown, Trash2, Edit2, Calendar, ChevronLeft, ChevronRight, Pin, Upload, Eye, EyeOff, RotateCw, ZoomIn, ZoomOut, Maximize2, Send
} from 'lucide-react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import './Vessels.css';
import DecksView from '../viewer/DecksView';
import PurchaseOrderView from '../viewer/PurchaseOrderView';
import MaterialsRecord from '../inventory/MaterialsRecord';
import IHMCertificateView from '../viewer/IHMCertificateView';
import { INITIAL_VESSELS } from '../../data/vesselData';
import { api } from '../../lib/apiClient';
import { ENDPOINTS, API_CONFIG } from '../../config/api.config';
import type { Vessel } from '../../types';



const EMPTY_FORM: Vessel = {
    name: '', shipOwner: '', fleet: '', subFleet: '', vesselClass: '',
    imoNumber: '', registrationNumber: '', deliveryDate: '', deadweightTonnage: '',
    portOfRegistry: '', socExpiryDate: '', vesselType: '', shipManager: '',
    registeredOwner: '', flagState: '', vesselIhmClass: '', classIdNo: '',
    nameOfYard: '', keelLaidDate: '', grossTonnage: '', teuUnits: '',
    ihmReference: '', signalLetters: '', buildersUniqueId: '',
    mdStandard: 'HKC', ihmMethod: 'NB', socReference: '',
    image: ''
};

export default function Vessels() {
    const location = useLocation();
    const { user } = useAuth();
    const [notifCount, setNotifCount] = useState(3);
    const [vesselList, setVesselList] = useState<Vessel[]>([]);
    const [activeVesselName, setActiveVesselName] = useState('');
    const [activeVesselImo, setActiveVesselImo] = useState('');
    const [activeTab, setActiveTab] = useState(location.pathname === '/decks' ? 'decks' : 'project');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [, setApiLoading] = useState(true);

    const isVesselRole = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || '').toLowerCase();
        return role === 'vessel' || role.includes('vessel');
    }, [user]);

    const isOwnerOrManager = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || '').toLowerCase();
        return role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role === 'vessel' || role.includes('owner') || role.includes('manager') || role.includes('vessel');
    }, [user]);

    const myVesselList = useMemo(() => {
        let rawList = vesselList;
        if (!user) rawList = vesselList;
        else {
            const role = (user.roleName || user.role || '').toLowerCase();
            const isOwner = role === 'owner' || role === 'ship_owner' || role.includes('owner');
            const isManager = role === 'ship_manager' || role.includes('manager');
            const isVessel = role === 'vessel' || role.includes('vessel');

            if (isVessel) {
                rawList = vesselList.filter(v => v.id === user.vesselId || (v.name && user.name && String(v.name).toLowerCase() === String(user.name).toLowerCase()));
            } else if (isOwner) {
                rawList = vesselList.filter(v => {
                const ownerStr = String(v.shipOwner || '').toLowerCase();
                const regOwnerStr = String(v.registeredOwner || '').toLowerCase();
                const userNameStr = String(user.name || '').toLowerCase();
                const userEmailStr = String(user.email || '').toLowerCase();
                
                return ownerStr.includes(userNameStr) || 
                       regOwnerStr.includes(userNameStr) || 
                       userNameStr.includes(ownerStr) || 
                       userNameStr.includes(regOwnerStr) ||
                       userEmailStr.includes(ownerStr) ||
                       userEmailStr.includes(regOwnerStr);
            });
        } else if (isManager) {
            return vesselList.filter(v => {
                const managerStr = String(v.shipManager || '').toLowerCase();
                const userNameStr = String(user.name || '').toLowerCase();
                const userEmailStr = String(user.email || '').toLowerCase();
                
                return managerStr.includes(userNameStr) || 
                       userNameStr.includes(managerStr) ||
                       userEmailStr.includes(managerStr);
            });
        }
        rawList = vesselList;
    }

    // Deduplicate vessels by IMO number & vessel name
    const seen = new Set<string>();
    return rawList.filter(v => {
        const key = `${(v.imoNumber || '').trim().toLowerCase()}_${(v.name || '').trim().toLowerCase()}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}, [vesselList, user]);

    // Fetch vessels from API on mount
    useEffect(() => {
        setApiLoading(true);
        api.get<{ success: boolean; data: Vessel[] }>(ENDPOINTS.VESSELS.LIST)
            .then((res) => {
                const vessels = res.data;
                setVesselList(vessels);
                
                let filtered = vessels;
                if (user) {
                    const role = (user.roleName || user.role || '').toLowerCase();
                    const isOwner = role === 'owner' || role === 'ship_owner' || role.includes('owner');
                    const isManager = role === 'ship_manager' || role.includes('manager');
                    const isVessel = role === 'vessel' || role.includes('vessel');
                    
                    if (isVessel) {
                        filtered = vessels.filter(v => v.id === user.vesselId || (v.name && user.name && String(v.name).toLowerCase() === String(user.name).toLowerCase()));
                    } else if (isOwner) {
                        filtered = vessels.filter(v => {
                            const ownerStr = String(v.shipOwner || '').toLowerCase();
                            const regOwnerStr = String(v.registeredOwner || '').toLowerCase();
                            const userNameStr = String(user.name || '').toLowerCase();
                            const userEmailStr = String(user.email || '').toLowerCase();
                            return ownerStr.includes(userNameStr) || regOwnerStr.includes(userNameStr) || userNameStr.includes(ownerStr) || userNameStr.includes(regOwnerStr) || userEmailStr.includes(ownerStr) || userEmailStr.includes(regOwnerStr);
                        });
                    } else if (isManager) {
                        filtered = vessels.filter(v => {
                            const managerStr = String(v.shipManager || '').toLowerCase();
                            const userNameStr = String(user.name || '').toLowerCase();
                            const userEmailStr = String(user.email || '').toLowerCase();
                            return managerStr.includes(userNameStr) || userNameStr.includes(managerStr) || userEmailStr.includes(managerStr);
                        });
                    }
                }

                if (filtered.length > 0 && !activeVesselName) {
                    setActiveVesselName(filtered[0].name);
                    setActiveVesselImo(filtered[0].imoNumber);
                }
            })
            .catch(() => {
                // Fallback to INITIAL_VESSELS if API fails
                setVesselList(INITIAL_VESSELS);
                
                let filtered = INITIAL_VESSELS;
                if (user) {
                    const role = (user.roleName || user.role || '').toLowerCase();
                    const isOwner = role === 'owner' || role === 'ship_owner' || role.includes('owner');
                    const isManager = role === 'ship_manager' || role.includes('manager');
                    const isVessel = role === 'vessel' || role.includes('vessel');
                    
                    if (isVessel) {
                        filtered = INITIAL_VESSELS.filter(v => v.id === user.vesselId || (v.name && user.name && String(v.name).toLowerCase() === String(user.name).toLowerCase()));
                    } else if (isOwner) {
                        filtered = INITIAL_VESSELS.filter(v => {
                            const ownerStr = String(v.shipOwner || '').toLowerCase();
                            const regOwnerStr = String(v.registeredOwner || '').toLowerCase();
                            const userNameStr = String(user.name || '').toLowerCase();
                            const userEmailStr = String(user.email || '').toLowerCase();
                            return ownerStr.includes(userNameStr) || regOwnerStr.includes(userNameStr) || userNameStr.includes(ownerStr) || userNameStr.includes(regOwnerStr) || userEmailStr.includes(ownerStr) || userEmailStr.includes(regOwnerStr);
                        });
                    } else if (isManager) {
                        filtered = INITIAL_VESSELS.filter(v => {
                            const managerStr = String(v.shipManager || '').toLowerCase();
                            const userNameStr = String(user.name || '').toLowerCase();
                            const userEmailStr = String(user.email || '').toLowerCase();
                            return managerStr.includes(userNameStr) || userNameStr.includes(managerStr) || userEmailStr.includes(managerStr);
                        });
                    }
                }

                if (filtered.length > 0) {
                    setActiveVesselName(filtered[0].name);
                    setActiveVesselImo(filtered[0].imoNumber);
                }
            })
            .finally(() => setApiLoading(false));
    }, [user]);

    // Document & Form States
    const [docPage, setDocPage] = useState(1);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [newDocType, setNewDocType] = useState('Select Document Type');
    const docsPerPage = 10;

    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [formData, setFormData] = useState<Vessel>(EMPTY_FORM);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [bannerMessage, setBannerMessage] = useState<{ title: string; body: string; type: 'info' | 'error' } | null>(null);

    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<any>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Reports Flow States
    const [reportStep, setReportStep] = useState(0); // 0: Selection, 1: Configuration, 2: Editor
    const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
    const [selectedReportCategory, setSelectedReportCategory] = useState<string | null>(null);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [hiddenSections, setHiddenSections] = useState<string[]>([]);
    const [reorderedSections, setReorderedSections] = useState<any[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    // New Reports landing — tabs for Standard / Quarterly / Custom
    const [activeReportTab, setActiveReportTab] = useState<'standard' | 'quarterly' | 'custom'>('standard');
    const [reportInclusions, setReportInclusions] = useState<Record<string, { inventory: boolean; positive: boolean; previous: boolean }>>({
        q1: { inventory: true, positive: true, previous: false },
        q2: { inventory: true, positive: true, previous: false },
        q3: { inventory: true, positive: true, previous: false },
        q4: { inventory: true, positive: true, previous: false },
        adhoc: { inventory: true, positive: true, previous: true },
    });

    // Quarterly Archive timeline. Pulled from /reports/quarterly/timeline
    // when the tab opens. One entry per calendar quarter from vessel
    // onboarding through the current quarter; `report` is null when
    // nothing has been generated for that quarter yet.
    interface QuarterlyEntry {
        period: { label: string; start: string; end: string };
        report: {
            id: string; status: string; fileName: string | null;
            fileSize: number | null; generatedBy: string | null; createdAt: string;
        } | null;
    }
    const [quarterlyTimeline, setQuarterlyTimeline] = useState<QuarterlyEntry[]>([]);
    const [quarterlyLoading, setQuarterlyLoading] = useState(false);
    // Track which quarter is currently being generated so the user gets
    // immediate feedback ('Generating…') without us re-fetching after
    // every click.
    const [generatingQuarter, setGeneratingQuarter] = useState<string | null>(null);
    // Standard Reports — tracks which card (by item id: 'overall'|'summary'|...)
    // is currently mid-generation so we can swap the button to a spinner.
    const [generatingStandard, setGeneratingStandard] = useState<string | null>(null);
    // Latest persisted report per backend report_type for the active vessel.
    // Populated from GET /vessels/:id/reports — used to swap the card UI
    // from "Not yet generated / Generate Report" to "Generated <date> /
    // Download + Re-generate" after a run completes.
    interface StandardReportRow {
        id: string;
        reportType: string;
        status: string;
        fileName: string | null;
        fileSize: number | null;
        generatedBy: string | null;
        createdAt: string;
    }
    const [standardLatestByType, setStandardLatestByType] = useState<Record<string, StandardReportRow>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    // Custom Dropdown States & Refs
    const [isDocTypeDropdownOpen, setIsDocTypeDropdownOpen] = useState(false);

    const docTypeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (docTypeRef.current && !docTypeRef.current.contains(event.target as Node)) setIsDocTypeDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);

        // Lock body scroll for this page
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, []);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll effect for report blurred cards (Accordion cards in Step 0)
    useEffect(() => {
        const handleScroll = () => {
            const container = scrollContainerRef.current;
            if (!container) return;

            const cards = container.querySelectorAll('.report-accordion-group');
            const containerRect = container.getBoundingClientRect();
            const containerBottom = containerRect.bottom;
            const scrollHeight = container.scrollHeight;
            const scrollTop = container.scrollTop;
            const clientHeight = container.clientHeight;

            const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 10;

            cards.forEach((card) => {
                const rect = (card as HTMLElement).getBoundingClientRect();
                const cardBottom = rect.bottom;
                const distanceToBottom = containerBottom - cardBottom;

                // If we are at the very bottom, remove all blur
                if (isAtBottom) {
                    (card as HTMLElement).style.filter = 'none';
                    (card as HTMLElement).style.opacity = '1';
                    (card as HTMLElement).style.transform = 'scale(1)';
                    return;
                }

                // Identify the "last few" cards based on proximity to container bottom
                // We want the last 2 visible cards to be blurry
                if (distanceToBottom < 100 && distanceToBottom > -50) {
                    const blurAmount = Math.max(0, (100 - distanceToBottom) / 20);
                    const opacityAmount = Math.max(0.6, distanceToBottom / 100);
                    (card as HTMLElement).style.filter = `blur(${blurAmount}px)`;
                    (card as HTMLElement).style.opacity = `${opacityAmount}`;
                    (card as HTMLElement).style.transform = `scale(${0.98 + (distanceToBottom / 5000)})`;
                } else if (distanceToBottom <= -50) {
                    // Elements below the viewport bottom
                    (card as HTMLElement).style.filter = 'blur(8px)';
                    (card as HTMLElement).style.opacity = '0';
                } else {
                    (card as HTMLElement).style.filter = 'none';
                    (card as HTMLElement).style.opacity = '1';
                    (card as HTMLElement).style.transform = 'scale(1)';
                }
            });
        };

        const container = scrollContainerRef.current;
        if (activeTab === 'reports' && reportStep === 0 && container) {
            container.addEventListener('scroll', handleScroll);
            // Trigger once to set initial state
            handleScroll();
        } else if (container) {
            // Reset all cards if we leave reports or move to config step
            const cards = container.querySelectorAll('.report-accordion-group');
            cards.forEach((card) => {
                (card as HTMLElement).style.filter = 'none';
                (card as HTMLElement).style.opacity = '1';
                (card as HTMLElement).style.transform = 'scale(1)';
            });
        }
        return () => container?.removeEventListener('scroll', handleScroll);
    }, [activeTab, reportStep]);

    const [vesselDocuments, setVesselDocuments] = useState<{ [key: string]: any[] }>({
        'MV Ocean Pioneer': Array.from({ length: 45 }, (_, i) => ({
            id: i + 1,
            name: [
                'International Air Pollution Prevention Cert',
                'Main Engine Maintenance Manual',
                'Upper Deck GA Plan Revision B',
                'Hazardous Materials Declaration - Deck A',
                'Safety Equipment Inventory',
                'Load Line Certificate',
                'Crew List Declaration',
                'Waste Management Plan',
                'Emergency Towing Booklet',
                'Ship Energy Efficiency Management Plan',
                'SOPEP Manual',
                'Stability Booklet'
            ][i % 12] + (i > 11 ? ` - Part ${Math.floor(i / 12) + 1}` : ''),
            type: ['Certificate', 'Manual', 'Drawing', 'Declaration', 'Certificate', 'Certificate', 'Declaration', 'Manual', 'Manual', 'Manual', 'Manual', 'Manual'][i % 12],
            uploadedBy: i % 2 === 0 ? 'John Admin' : 'M. Smith',
            date: 'Oct 12, 2023',
            status: i % 7 === 0 ? 'Expiring' : 'Active',
            initials: i % 2 === 0 ? 'JA' : 'MS'
        })),
        'ACOSTA': Array.from({ length: 32 }, (_, i) => ({
            id: i + 1,
            name: [
                'Registry Certificate Panama',
                'Cargo Handling Manual',
                'Ballast Water Management Plan',
                'Fire Safety Certificate',
                'Ship Security Plan',
                'Navigation Equipment Certificate',
                'Radio License Certificate',
                'Tonnage Certificate',
                'Cargo Securing Manual',
                'Grain Loading Manual',
                'Safety Management System',
                'Technical Specification GA'
            ][i % 12] + (i > 11 ? ` - Rev ${Math.floor(i / 12) + 1}` : ''),
            type: ['Certificate', 'Manual', 'Manual', 'Certificate', 'Manual', 'Certificate', 'Certificate', 'Certificate', 'Manual', 'Manual', 'Manual', 'Drawing'][i % 12],
            uploadedBy: i % 3 === 0 ? 'Admin' : i % 3 === 1 ? 'J. Smith' : 'M. Brown',
            date: ['Jan 10, 2024', 'Feb 15, 2024', 'Mar 20, 2024'][i % 3],
            status: i % 8 === 0 ? 'Expiring' : 'Active',
            initials: i % 3 === 0 ? 'AD' : i % 3 === 1 ? 'JS' : 'MB'
        })),
        'AFIF': Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: [
                'International Oil Pollution Prevention Certificate',
                'Minimum Safe Manning Document',
                'Stability Information Booklet',
                'Cargo Securing Manual',
                'Oil Record Book',
                'Garbage Management Plan',
                'ISPS Security Certificate',
                'Class Certificate',
                'Life Saving Appliance Plan',
                'Engine Log Book'
            ][i % 10] + (i > 9 ? ` - Vol ${Math.floor(i / 10) + 1}` : ''),
            type: ['Certificate', 'Certificate', 'Manual', 'Manual', 'Manual', 'Manual', 'Certificate', 'Certificate', 'Drawing', 'Manual'][i % 10],
            uploadedBy: i % 2 === 0 ? 'K. Wilson' : 'R. Davis',
            date: ['Nov 05, 2023', 'Dec 12, 2023'][i % 2],
            status: i % 9 === 0 ? 'Expiring' : 'Active',
            initials: i % 2 === 0 ? 'KW' : 'RD'
        })),
        'PACIFIC HORIZON': Array.from({ length: 28 }, (_, i) => ({
            id: i + 1,
            name: [
                'Continuous Synopsis Record',
                'Fuel Oil Quality Certificate',
                'Bunker Delivery Notes',
                'Voyage Data Recorder Certificate',
                'Emergency Response Procedures',
                'Maintenance Schedule',
                'Inspection Reports',
                'Training Records',
                'Shipboard Oil Pollution Emergency Plan',
                'Medical Chest Certificate'
            ][i % 10] + (i > 9 ? ` - ${2024 - Math.floor(i / 10)}` : ''),
            type: ['Certificate', 'Certificate', 'Declaration', 'Certificate', 'Manual', 'Manual', 'Drawing', 'Manual', 'Manual', 'Certificate'][i % 10],
            uploadedBy: i % 3 === 0 ? 'S. Anderson' : i % 3 === 1 ? 'T. Martinez' : 'L. Taylor',
            date: ['Aug 22, 2023', 'Sep 18, 2023', 'Oct 30, 2023'][i % 3],
            status: i % 10 === 0 ? 'Expiring' : 'Active',
            initials: i % 3 === 0 ? 'SA' : i % 3 === 1 ? 'TM' : 'LT'
        })),
        'MV NORTH STAR': Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            name: [
                'Ice Class Certificate',
                'Polar Code Compliance Document',
                'Heated Tank Plan',
                'Winterization Manual',
                'Ice Breaker Operational Manual',
                'Registry Norway',
                'Safe Manning Polar',
                'Arctic Navigation Chart List'
            ][i % 8] + (i > 7 ? ` - Part ${Math.floor(i / 8) + 1}` : ''),
            type: ['Certificate', 'Certificate', 'Drawing', 'Manual', 'Manual', 'Certificate', 'Certificate', 'Drawing'][i % 8],
            uploadedBy: i % 2 === 0 ? 'O. Nilsen' : 'E. Johansen',
            date: 'Dec 05, 2023',
            status: 'Active',
            initials: i % 2 === 0 ? 'ON' : 'EJ'
        }))
    });

    // State management handles consolidated above


    const activeVesselData = useMemo(() => {
        // Prefer IMO match (unique), fall back to name for legacy flows
        if (activeVesselImo) {
            const byImo = vesselList.find(v => v.imoNumber === activeVesselImo);
            if (byImo) return byImo;
        }
        return vesselList.find(v => v.name === activeVesselName);
    }, [vesselList, activeVesselName, activeVesselImo]);

    const [docsLoading, setDocsLoading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        if (!activeVesselData?.id) return;
        setDocsLoading(true);
        try {
            const res = await api.get<{ success: boolean; data: any[] }>(
                `/vessels/${activeVesselData.id}/documents`
            );
            const mappedDocs = (res.data || []).map((doc: any) => ({
                id: doc.id || doc._id,
                name: doc.name,
                type: doc.documentType || doc.document_type,
                uploadedBy: doc.uploadedByName || doc.uploaded_by_name || 'System',
                date: new Date(doc.createdAt || doc.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                status: doc.status || 'Active',
                filePath: doc.filePath || doc.file_path,
                initials: (doc.uploadedByName || doc.uploaded_by_name || 'System')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
            }));
            setVesselDocuments(prev => ({
                ...prev,
                [activeVesselName]: mappedDocs
            }));
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        } finally {
            setDocsLoading(false);
        }
    }, [activeVesselData?.id, activeVesselName]);

    useEffect(() => {
        if (activeTab === 'documents') {
            fetchDocuments();
        }
    }, [activeTab, fetchDocuments]);

    // Sync formData with selected vessel when not editing/adding
    useEffect(() => {
        if (!isEditing && !isAdding && activeVesselData) {
            setFormData(activeVesselData);
        }
    }, [activeVesselData, isEditing, isAdding]);

    // Pull the Quarterly Archive timeline whenever the user opens the
    // Quarterly tab on a vessel. One entry per calendar quarter from
    // the vessel's onboarding date through today's quarter, with the
    // matching report row attached when one exists. Must be declared
    // AFTER `activeVesselData` so it can reference it without tripping
    // the temporal-dead-zone — earlier placement white-screened the
    // whole page on first render.
    useEffect(() => {
        if (activeTab !== 'reports' || activeReportTab !== 'quarterly') return;
        const vId = activeVesselData?.id;
        if (!vId) { setQuarterlyTimeline([]); return; }
        let cancelled = false;
        setQuarterlyLoading(true);
        const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
        const token = localStorage.getItem('ihm_token') || '';
        fetch(`${base}/vessels/${vId}/reports/quarterly/timeline`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
            .then((j) => { if (!cancelled && Array.isArray(j?.data)) setQuarterlyTimeline(j.data); })
            .catch(() => { if (!cancelled) setQuarterlyTimeline([]); })
            .finally(() => { if (!cancelled) setQuarterlyLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activeReportTab, activeVesselData?.id, generatingQuarter]);

    // Load the latest persisted Standard Report per backend type so the
    // card swaps from "Not yet generated / Generate Report" to
    // "Generated <date> / Download + Re-generate" once a run finishes.
    // Refetches whenever a generation completes (generatingStandard
    // transitions back to null).
    useEffect(() => {
        if (activeTab !== 'reports' || activeReportTab !== 'standard') return;
        const vId = activeVesselData?.id;
        if (!vId) { setStandardLatestByType({}); return; }
        // Don't refetch while a generation is in flight — let it finish
        // first so the post-generate row is included.
        if (generatingStandard !== null) return;
        let cancelled = false;
        const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
        const token = localStorage.getItem('ihm_token') || '';
        fetch(`${base}/vessels/${vId}/reports`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
            .then((j) => {
                if (cancelled || !Array.isArray(j?.data)) return;
                // Backend orders rows DESC by created_at, so the first
                // row per type is the most recent. Filter out anything
                // that didn't reach status='ready' — partial/failed
                // generations shouldn't be advertised as downloadable.
                const latest: Record<string, StandardReportRow> = {};
                for (const row of j.data as StandardReportRow[]) {
                    if (row.status !== 'ready' || !row.fileName) continue;
                    if (!latest[row.reportType]) latest[row.reportType] = row;
                }
                setStandardLatestByType(latest);
            })
            .catch(() => { if (!cancelled) setStandardLatestByType({}); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, activeReportTab, activeVesselData?.id, generatingStandard]);

    const handleVesselSelect = (vessel: Vessel) => {
        // Switching vessels abandons any in-progress add/edit draft. The
        // explicit Save button still validates required fields, so the
        // only thing dropped here is unsaved typing — that's expected
        // for a side-nav click.
        setActiveVesselName(vessel.name);
        setActiveVesselImo(vessel.imoNumber);
        setFormData(vessel);
        setIsAdding(false);
        setIsEditing(false);
    };

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
    };

    const handleAddClick = () => {
        setIsAdding(true);
        setIsEditing(true);
        setActiveVesselName('');
        setActiveVesselImo('');
        setFormData(EMPTY_FORM);
        setActiveTab('project');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPendingImageFile(file);
            // Show local preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const triggerFileSelect = () => {
        if (!isEditing) return;
        fileInputRef.current?.click();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (isEditing) setIsDraggingFile(true);
    };

    const handleDragLeave = () => {
        setIsDraggingFile(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (!isEditing) return;

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setPendingImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.shipOwner || !formData.imoNumber) {
            setBannerMessage({
                title: 'Required Fields Missing',
                body: 'Please fill all required fields (marked with *) before saving.',
                type: 'error'
            });
            return;
        }

        try {
            if (isAdding) {
                const res = await api.post<{ success: boolean; data: Vessel }>(ENDPOINTS.VESSELS.LIST, formData);
                const newVessel = res.data;

                // Upload image if one was selected (base64)
                if (pendingImageFile) {
                    const fd = new FormData();
                    fd.append('image', pendingImageFile);
                    const imgRes = await api.upload<{ success: boolean; data: Vessel }>(ENDPOINTS.VESSELS.IMAGE_UPLOAD(newVessel.id!), fd);
                    newVessel.image = imgRes.data.image;
                    setPendingImageFile(null);
                }

                setVesselList(prev => [newVessel, ...prev]);
                setIsAdding(false);
                setIsEditing(false);
                setActiveVesselName(newVessel.name);
                setActiveVesselImo(newVessel.imoNumber);
                setModalMessage('New vessel added successfully!');
            } else {
                const vesselId = activeVesselData?.id;
                if (!vesselId) return;

                const res = await api.put<{ success: boolean; data: Vessel }>(ENDPOINTS.VESSELS.DETAIL(vesselId), formData);
                const updated = res.data;

                // Upload image if changed
                if (pendingImageFile) {
                    const fd = new FormData();
                    fd.append('image', pendingImageFile);
                    const imgRes = await api.upload<{ success: boolean; data: Vessel }>(ENDPOINTS.VESSELS.IMAGE_UPLOAD(vesselId), fd);
                    updated.image = imgRes.data.image;
                    setPendingImageFile(null);
                }

                setVesselList(prev => prev.map(v => v.id === vesselId ? updated : v));
                setActiveVesselName(updated.name);
                setActiveVesselImo(updated.imoNumber);
                setIsEditing(false);
                setModalMessage('Vessel data updated successfully!');
            }
            setShowModal(true);
        } catch (err) {
            setBannerMessage({
                title: 'Error Saving Vessel',
                body: (err as Error).message || 'Failed to save vessel',
                type: 'error'
            });
        }
    };

    // Documents Logic
    const handlePreviewDocClick = async (doc: any) => {
        setSelectedDoc(doc);
        setPreviewUrl(null);
        if (!activeVesselData?.id) return;

        try {
            const token = localStorage.getItem('ihm_token') || sessionStorage.getItem('ihm_token') || '';
            const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
            const streamUrl = `${base}/vessels/${activeVesselData.id}/documents/${doc.id}/stream`;

            const response = await fetch(streamUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            setPreviewUrl(blobUrl);
        } catch (err) {
            console.error('Failed to load document preview:', err);
            setPreviewUrl(null);
        }
    };

    const handleDeleteDocClick = (doc: any) => {
        setDocToDelete(doc);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteDoc = () => {
        if (docToDelete && activeVesselData?.id) {
            api.delete(`/vessels/${activeVesselData.id}/documents/${docToDelete.id}`)
                .then(() => {
                    setVesselDocuments(prev => ({
                        ...prev,
                        [activeVesselName]: (prev[activeVesselName] || []).filter(d => d.id !== docToDelete.id)
                    }));
                    setShowDeleteConfirm(false);
                    setDocToDelete(null);
                    setModalMessage('Document deleted successfully!');
                    setShowModal(true);
                })
                .catch((err) => {
                    alert(err.message || 'Failed to delete document');
                });
        }
    };

    const handleDocUpload = () => {
        if (!selectedFile) {
            docInputRef.current?.click();
            return;
        }

        if (newDocType === 'Select Document Type') {
            setBannerMessage({
                title: 'Document Type Required',
                body: 'Please select a document type first',
                type: 'error'
            });
            return;
        }

        if (!activeVesselData?.id) {
            setBannerMessage({
                title: 'No Vessel Selected',
                body: 'Please select or load a vessel first',
                type: 'error'
            });
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentType', newDocType);
        formData.append('category', 'general');

        setBannerMessage(null);
        api.upload<{ success: boolean; data: any }>(
            `/vessels/${activeVesselData.id}/documents`,
            formData
        )
        .then((res) => {
            const rawDoc = res.data;
            const newDoc = {
                id: rawDoc.id || rawDoc._id,
                name: rawDoc.name,
                type: rawDoc.documentType || rawDoc.document_type,
                uploadedBy: rawDoc.uploadedByName || rawDoc.uploaded_by_name || 'System',
                date: new Date(rawDoc.createdAt || rawDoc.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                status: rawDoc.status || 'Active',
                filePath: rawDoc.filePath || rawDoc.file_path,
                initials: (rawDoc.uploadedByName || rawDoc.uploaded_by_name || 'System')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
            };
            setVesselDocuments(prev => ({
                ...prev,
                [activeVesselName]: [newDoc, ...(prev[activeVesselName] || [])]
            }));

            setModalMessage(`'${selectedFile.name}' uploaded successfully!`);
            setShowModal(true);
            setSelectedFile(null); // Reset selection
            setNewDocType('Select Document Type'); // Reset dropdown selection
            if (docInputRef.current) docInputRef.current.value = ''; // Reset input
        })
        .catch((err) => {
            setBannerMessage({
                title: 'Upload Failed',
                body: err.message || 'An error occurred during file upload',
                type: 'error'
            });
        });
    };

    const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleDocDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const tabs = [
        { id: 'project', label: 'Project', icon: FolderOpen },
        { id: 'decks', label: 'Decks', icon: Layers },
        { id: 'documents', label: 'Documents', icon: FileText },
        { id: 'materials', label: 'Materials Record', icon: Layers },
        { id: 'purchase', label: 'Purchase Orders', icon: ShoppingCart },
        { id: 'reports', label: 'Reports', icon: BarChart2 },
        { id: 'certificate', label: 'IHM Certificate', icon: ShieldCheck },
    ];

    const renderContent = () => {
        if (myVesselList.length === 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: '#64748b', padding: '24px', textAlign: 'center' }}>
                    <ShipIcon size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>No Vessels Assigned</h3>
                    <p style={{ maxWidth: '400px', fontSize: '14px', margin: '0 auto', color: '#64748b' }}>There are no vessels matching your credentials in our database. Please contact the administrator if you believe this is in error.</p>
                </div>
            );
        }

        if (activeTab === 'documents') {
            if (docsLoading) {
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: '#64748b' }}>
                        Loading documents...
                    </div>
                );
            }
            const currentDocs = vesselDocuments[activeVesselName] || [];
            const filteredDocs = currentDocs;

            const paginatedDocs = filteredDocs.slice((docPage - 1) * docsPerPage, docPage * docsPerPage);

            return (
                <div className="documents-container">
                    {!isOwnerOrManager && (
                        <div className="doc-upload-banner">
                        <div className="upload-brand">
                            <Upload size={20} color="#00B0FA" />
                            <span className="upload-label">Upload Document</span>
                        </div>
                        <div className="upload-slot">
                            <div
                                className={`upload-dropzone ${selectedFile ? 'file-selected' : ''}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDocDrop}
                                onClick={() => docInputRef.current?.click()}
                            >
                                {selectedFile ? (
                                    <div className="selected-file-display">
                                        <FileText size={18} color="#00B0FA" />
                                        <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                ) : (
                                    <span>Choose file or drag and drop...</span>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={docInputRef}
                                style={{ display: 'none' }}
                                onChange={handleDocFileChange}
                            />
                            <div className="custom-select-wrapper" style={{ position: 'relative' }} ref={docTypeRef}>
                                <div
                                    className={`doc-type-select ${isDocTypeDropdownOpen ? 'active' : ''}`}
                                    onClick={() => setIsDocTypeDropdownOpen(!isDocTypeDropdownOpen)}
                                >
                                    {newDocType}
                                </div>
                                {isDocTypeDropdownOpen && (
                                    <div className="custom-dropdown-menu">
                                        {['Select Document Type', 'Initial IHM Report', 'SOC', 'Ship Particulars', 'Others'].map(option => (
                                            <div
                                                key={option}
                                                className={`custom-dropdown-item ${newDocType === option ? 'active' : ''}`}
                                                onClick={() => {
                                                    setNewDocType(option);
                                                    setIsDocTypeDropdownOpen(false);
                                                }}
                                            >
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button className="upload-exec-btn" onClick={handleDocUpload}>
                                <Upload size={18} /> {selectedFile ? 'Upload Now' : 'Select File'}
                            </button>
                        </div>
                    </div>
                    )}

                    <div className="doc-table-wrapper">
                        <table className="doc-table">
                            <thead>
                                <tr>
                                    <th>DOCUMENT NAME</th>
                                    <th>TYPE</th>
                                    <th>UPLOADED BY</th>
                                    <th>DATE</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDocs.map(doc => (
                                    <tr key={doc.id}>
                                        <td>
                                            <div className="doc-name-cell">
                                                <div className={`doc-type-icon ${doc.type.toLowerCase()}`}>
                                                    {doc.type === 'Certificate' && <FileText size={18} color="#EF4444" />}
                                                    {doc.type === 'Manual' && <FileText size={18} color="#3B82F6" />}
                                                    {doc.type === 'Drawing' && <Pin size={18} color="#00B0FA" />}
                                                    {doc.type === 'Declaration' && <FileText size={18} color="#94A3B8" />}
                                                </div>
                                                <span className="doc-name-txt">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td><span className="doc-type-tag">{doc.type}</span></td>
                                        <td>
                                            <div className="doc-uploader">
                                                <div className="uploader-avatar">{doc.initials}</div>
                                                <span>{doc.uploadedBy}</span>
                                            </div>
                                        </td>
                                        <td><span className="doc-date-txt">{doc.date}</span></td>
                                        <td><span className={`status-pill ${doc.status.toLowerCase()}`}>{doc.status}</span></td>
                                        <td>
                                            <div className="doc-actions">
                                                <button className="action-icn-btn" onClick={() => handlePreviewDocClick(doc)}><Eye size={14} /></button>
                                                {!isOwnerOrManager && (
                                                    <>
                                                        <button className="action-icn-btn"><Send size={14} /></button>
                                                        <button className="action-icn-btn" onClick={() => handleDeleteDocClick(doc)}><Trash2 size={14} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="doc-pagination-bar">
                            <span className="showing-text">SHOWING {paginatedDocs.length} OF {filteredDocs.length} DOCUMENTS</span>
                            <div className="pagination-arrows">
                                <button className="arrow-btn" onClick={() => setDocPage(p => Math.max(1, p - 1))} disabled={docPage === 1 || filteredDocs.length === 0}>
                                    <ChevronLeft size={16} />
                                </button>
                                <button className="arrow-btn" onClick={() => setDocPage(p => Math.min(Math.ceil(filteredDocs.length / docsPerPage), p + 1))} disabled={docPage === Math.ceil(filteredDocs.length / docsPerPage) || filteredDocs.length === 0}>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Document Quick Preview Modal ── */}
                    {selectedDoc && (
                        <div className="doc-preview-modal-overlay" onClick={() => {
                            if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                            setSelectedDoc(null);
                            setPreviewUrl(null);
                        }}>
                            <div className="doc-preview-modal" onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div className="doc-preview-modal-header">
                                    <div className="doc-preview-modal-title">
                                        <Eye size={18} color="#00B0FA" />
                                        <div>
                                            <h2>{selectedDoc.name}</h2>
                                            <span>{selectedDoc.type} · {activeVesselName}</span>
                                        </div>
                                    </div>
                                    <div className="doc-preview-modal-actions">
                                        {/* Download — triggers browser save-as with original filename */}
                                        <button
                                            className="doc-preview-btn secondary"
                                            title="Download"
                                            onClick={() => {
                                                if (!previewUrl) return;
                                                const a = document.createElement('a');
                                                a.href = previewUrl;
                                                a.download = selectedDoc.name || 'document';
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                            }}
                                        >
                                            <Download size={16} /> Download
                                        </button>
                                        {/* Open in Full Viewer — opens blob URL in new tab (renders inline, no download) */}
                                        <button
                                            className="doc-preview-btn primary"
                                            onClick={() => {
                                                if (previewUrl) window.open(previewUrl, '_blank');
                                            }}
                                        >
                                            <ExternalLink size={16} /> Open in Full Viewer
                                        </button>
                                        <button className="doc-preview-close-btn" onClick={() => {
                                            if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                                            setSelectedDoc(null);
                                            setPreviewUrl(null);
                                        }}>
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Document Viewer Area */}
                                <div className="doc-preview-modal-body">
                                    {!previewUrl ? (
                                        <div className="doc-preview-loading">
                                            <div className="doc-preview-spinner" />
                                            <span>Loading document preview…</span>
                                        </div>
                                    ) : (
                                        <iframe
                                            key={previewUrl}
                                            src={previewUrl}
                                            title="Document Preview"
                                            className="doc-preview-iframe"
                                            allow="fullscreen"
                                        />
                                    )}
                                </div>

                                {/* Footer metadata strip */}
                                <div className="doc-preview-modal-footer">
                                    <span><strong>Vessel:</strong> {activeVesselName}</span>
                                    <span><strong>Type:</strong> {selectedDoc.type}</span>
                                    <span><strong>Uploaded by:</strong> {selectedDoc.uploadedBy}</span>
                                    <span><strong>Date:</strong> {selectedDoc.date}</span>
                                    <span className={`status-pill ${selectedDoc.status?.toLowerCase()}`}>{selectedDoc.status}</span>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Delete Confirmation Modal */}
                    {showDeleteConfirm && (
                        <div className="modal-overlay">
                            <div className="modal-content success-card-modal delete">
                                <div className="modal-success-icon delete">
                                    <Trash2 size={40} />
                                </div>
                                <h2 className="modal-title">Confirm Delete</h2>
                                <p className="modal-message">
                                    Are you sure you want to delete '<strong>{docToDelete?.name}</strong>'?
                                    This action cannot be undone.
                                </p>
                                <div className="modal-actions-group">
                                    <button className="modal-action-btn cancel" onClick={() => setShowDeleteConfirm(false)}>
                                        CANCEL
                                    </button>
                                    <button className="modal-action-btn delete" onClick={confirmDeleteDoc}>
                                        DELETE
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'decks') {
            return <DecksView key={activeVesselName} vesselName={activeVesselName} vesselId={activeVesselData?.id} />;
        }

        if (activeTab === 'purchase') {
            return (
                <PurchaseOrderView
                    key={activeVesselName}
                    imo={activeVesselData?.imoNumber || ''}
                    vesselId={activeVesselData?.id || ''}
                    vesselName={activeVesselName}
                />
            );
        }

        if (activeTab === 'materials') {
            return <MaterialsRecord key={activeVesselName} vesselName={activeVesselName} vesselId={activeVesselData?.id} />;
        }

        if (activeTab === 'reports') {
            const vesselDisplayName = activeVesselName.includes(' ') ? activeVesselName.split(' ')[1].toUpperCase() : activeVesselName.toUpperCase();

            // Standard report templates — these are the *types* of reports
            // the user can generate, not historical data. The catalog is part
            // of the product; only the generated history (dates, files,
            // download URLs) is real data and that comes from the backend
            // once the reports table exists. Until then, no fake "Last
            // updated" timestamps and no fake quarterly archive entries.
            const reportCategories: Array<{
                id: string;
                title: string;
                items: Array<{ id: string; name: string; date: string | null }>;
            }> = [
                {
                    id: 'adhoc',
                    title: 'AD HOC REPORT',
                    items: [
                        { id: 'overall', name: 'Ship Overall Report', date: null },
                        { id: 'summary', name: 'Compliance Summary Report', date: null },
                        { id: 'inventory', name: 'Detailed Materials Inventory Report', date: null },
                        { id: 'hazmat', name: 'Global Hazmat Overview Report', date: null },
                    ]
                },
                // Quarterly archive entries are populated from the backend
                // once a generated report is persisted. Empty until then.
            ];

            const SECTIONS_LIST = [
                { id: 'intro', title: 'Introduction', hasView: true },
                { id: 'specs', title: 'Vessel Specifications', hasView: true },
                { id: 'index', title: 'Index', hasView: true },
                { id: 'mov', title: 'IHM Movement', hasView: true },
                { id: 'haz', title: 'Ship Hazmat Overview', hasView: true },
                { id: 'details', title: 'IHM Details', hasView: true },
                { id: 'decks', title: 'HM Marked Decks', hasView: true },
                { id: 'doc', title: 'IHM Document', hasView: true },
                { id: 'f1', title: '9371543_CLODOMIRA_IHM Attestation Letter', hasView: true },
                { id: 'f2', title: 'CLODOMIRA-IHM-002699', hasView: true },
                { id: 'f3', title: '2020-12-01-ihm-report-compressed', hasView: true },
                { id: 'f4', title: 'ACOSTA-IHM-004122_FULL TERM', hasView: true },
                { id: 'f5', title: 'Anti-fouling Certificate', hasView: true },
                { id: 'f6', title: '_ACOSTA-IHM-FULL TERM NEW ISSUED', hasView: true },
                { id: 'other', title: 'Other', hasView: true }
            ];

            const toggleSection = (id: string) => {
                if (selectedSections.includes(id)) {
                    setSelectedSections(selectedSections.filter(s => s !== id));
                } else {
                    setSelectedSections([...selectedSections, id]);
                }
            };

            // ── Step 0: NEW tabbed landing (Standard / Quarterly / Custom) ──
            // Replaces the long stack of collapsed accordions. Step 1 still
            // uses the legacy accordion+form rendering below — but filtered
            // to only the selected category so the screen feels like a
            // single config card instead of 21 stacked sections.
            if (reportStep === 0) {
                const adhocCat = reportCategories.find((c) => c.id === 'adhoc');
                const standardItems = adhocCat?.items ?? [];

                // Group quarterly categories by year, newest year first.
                const quarterlyGrouped: Record<string, typeof reportCategories> = {};
                reportCategories.forEach((cat) => {
                    if (cat.id === 'adhoc') return;
                    const yearMatch = cat.title.match(/(\d{4})/);
                    if (!yearMatch) return;
                    const year = yearMatch[1];
                    if (!quarterlyGrouped[year]) quarterlyGrouped[year] = [];
                    quarterlyGrouped[year].push(cat);
                });
                const quarterlyByYear = Object.keys(quarterlyGrouped)
                    .sort((a, b) => Number(b) - Number(a))
                    .map((year) => ({ year, quarters: quarterlyGrouped[year] }));



                // Map a UI report (Ad Hoc item or Quarterly entry) to the
                // backend report type the generator understands.
                const backendType = (catId: string, itemId: string): string => {
                    if (catId === 'adhoc') {
                        if (itemId === 'overall') return 'overall';
                        if (itemId === 'inventory') return 'inventory';
                        if (itemId === 'hazmat') return 'hazmat';
                        return 'compliance'; // summary or default
                    }
                    return 'quarterly';
                };

                const startGenerate = async (catId: string, itemId: string) => {
                    const vId = activeVesselData?.id;
                    if (!vId) {
                        setBannerMessage({
                            title: 'Database Sync Required',
                            body: 'This vessel is not backed by the database yet — add it first to generate a report.',
                            type: 'error'
                        });
                        return;
                    }
                    if (generatingStandard) return; // already generating something — ignore double-click
                    const type = backendType(catId, itemId);
                    setGeneratingStandard(itemId);
                    try {
                        const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
                        const url = `${base}/vessels/${vId}/reports/${type}/download`;
                        const token = localStorage.getItem('ihm_token') || '';
                        const res = await fetch(url, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                        });
                        if (!res.ok) {
                            const body = await res.text().catch(() => '');
                            throw new Error(`Generate failed (${res.status}) ${body.slice(0, 200)}`);
                        }
                        const blob = await res.blob();
                        const disposition = res.headers.get('Content-Disposition') ?? '';
                        const matched = disposition.match(/filename="([^"]+)"/);
                        const fileName = matched?.[1] ?? `${type}-report.pdf`;
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objectUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    } catch (err) {
                        console.error('Report generation failed:', err);
                        setBannerMessage({
                            title: 'Generation Failed',
                            body: `Could not generate the report.\n\n${(err as Error).message}`,
                            type: 'error'
                        });
                    } finally {
                        setGeneratingStandard(null);
                    }
                };

                // Download the PDF for a *specific* past quarter — passes
                // the period start/end/label as query overrides so the
                // backend renders that quarter instead of "current". Used
                // by the Quarterly Archive cards.
                const generateQuarter = async (entry: QuarterlyEntry) => {
                    const vId = activeVesselData?.id;
                    if (!vId) return;
                    setGeneratingQuarter(entry.period.label);
                    try {
                        const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
                        const params = new URLSearchParams({
                            periodLabel: entry.period.label,
                            periodStart: entry.period.start.slice(0, 10),
                            periodEnd: entry.period.end.slice(0, 10),
                        });
                        const url = `${base}/vessels/${vId}/reports/quarterly/download?${params.toString()}`;
                        const token = localStorage.getItem('ihm_token') || '';
                        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        if (!res.ok) {
                            const body = await res.text().catch(() => '');
                            throw new Error(`Generate failed (${res.status}) ${body.slice(0, 200)}`);
                        }
                        const blob = await res.blob();
                        const disposition = res.headers.get('Content-Disposition') ?? '';
                        const matched = disposition.match(/filename="([^"]+)"/);
                        const fileName = matched?.[1] ?? `quarterly-${entry.period.label.replace(/\s+/g, '-')}.pdf`;
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objectUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    } catch (err) {
                        console.error('Quarterly report generation failed:', err);
                        setBannerMessage({
                            title: 'Generation Failed',
                            body: `Could not generate the quarterly report.\n\n${(err as Error).message}`,
                            type: 'error'
                        });
                    } finally {
                        setGeneratingQuarter(null);
                    }
                };

                // Re-stream a previously-cached PDF straight from the
                // server (no re-render). Cheap.
                const downloadCachedQuarter = async (reportId: string, fileName: string) => {
                    const vId = activeVesselData?.id;
                    if (!vId) return;
                    try {
                        const base = API_CONFIG.BASE_URL.replace(/\/+$/, '');
                        const url = `${base}/vessels/${vId}/reports/file/${reportId}`;
                        const token = localStorage.getItem('ihm_token') || '';
                        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        if (!res.ok) throw new Error(`Download failed (${res.status})`);
                        const blob = await res.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objectUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    } catch (err) {
                        console.error('Cached download failed:', err);
                        setBannerMessage({
                            title: 'Download Failed',
                            body: `Could not download the cached report.\n\n${(err as Error).message}`,
                            type: 'error'
                        });
                    }
                };

                // Quarter month-range label, e.g. 'Apr – Jun 2026'.
                const formatQuarterRange = (start: string, end: string) => {
                    const s = new Date(start);
                    const e = new Date(end);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${months[s.getUTCMonth()]} – ${months[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
                };

                // Group the timeline by year for the Quarterly Archive
                // header ('2026 — 2 reports').
                const timelineByYear: { year: string; entries: QuarterlyEntry[] }[] = (() => {
                    const map = new Map<string, QuarterlyEntry[]>();
                    for (const e of quarterlyTimeline) {
                        const y = e.period.label.split(' ')[1] ?? new Date(e.period.start).getUTCFullYear().toString();
                        if (!map.has(y)) map.set(y, []);
                        map.get(y)!.push(e);
                    }
                    return Array.from(map.entries())
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([year, entries]) => ({ year, entries }));
                })();

                return (
                    <div className="reports-landing-v2">
                        {/* Hero header card */}
                        <div className="reports-hero-card">
                            <div className="reports-hero-icon">
                                <BarChart2 size={26} />
                            </div>
                            <div className="reports-hero-text">
                                <h1>Reports &amp; Analytics</h1>
                                <p>Generate compliance, inventory, and quarterly reports for the selected vessel.</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="reports-tabs">
                            <button
                                type="button"
                                className={activeReportTab === 'standard' ? 'active' : ''}
                                onClick={() => setActiveReportTab('standard')}
                            >
                                Standard Reports
                                <span className="tab-count">{standardItems.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activeReportTab === 'quarterly' ? 'active' : ''}
                                onClick={() => setActiveReportTab('quarterly')}
                            >
                                Quarterly Archive
                                {quarterlyByYear.length > 0 && (
                                    <span className="tab-count">
                                        {quarterlyByYear.reduce((acc, g) => acc + g.quarters.length, 0)}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                className={activeReportTab === 'custom' ? 'active' : ''}
                                onClick={() => setActiveReportTab('custom')}
                            >
                                Custom
                            </button>
                        </div>

                        {/* Standard Reports — card grid (Q1, Q2, Q3, Q4, and Ad Hoc) */}
                        {activeReportTab === 'standard' && (
                            <div className="report-cards-grid">
                                {[
                                    { id: 'q1', name: 'Q1 Report', desc: 'Quarter 1 compliance & inventory audit report.' },
                                    { id: 'q2', name: 'Q2 Report', desc: 'Quarter 2 compliance & inventory audit report.' },
                                    { id: 'q3', name: 'Q3 Report', desc: 'Quarter 3 compliance & inventory audit report.' },
                                    { id: 'q4', name: 'Q4 Report', desc: 'Quarter 4 compliance & inventory audit report.' },
                                    { id: 'adhoc', name: 'Ad Hoc Report', desc: 'Custom ad-hoc material & audit status report.' },
                                ].map((item) => {
                                    const isGenerating = generatingStandard === item.id;
                                    const isDisabled = generatingStandard !== null && !isGenerating;
                                    const latest = standardLatestByType[backendType('adhoc', item.id)];
                                    const hasGenerated = Boolean(latest);
                                    const generatedOnLabel = latest
                                        ? new Date(latest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : null;
                                    const opts = reportInclusions[item.id] || { inventory: true, positive: true, previous: false };

                                    return (
                                        <div
                                            className={`report-card-v2${isGenerating ? ' is-generating' : ''}${hasGenerated ? ' is-ready' : ''}`}
                                            key={item.id}
                                            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                                        >
                                            <div className="report-card-icon">
                                                <FileText size={22} />
                                            </div>
                                            <div className="report-card-body">
                                                <h3>{item.name}</h3>
                                                <p>{item.desc}</p>

                                                {/* Selectable Inclusion Options */}
                                                <div className="report-inclusion-options" style={{ marginTop: '12px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Include in Report:</span>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1E293B', marginBottom: '6px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={opts.inventory}
                                                            onChange={(e) => setReportInclusions(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...opts, inventory: e.target.checked }
                                                            }))}
                                                        />
                                                        IHM Inventory Materials
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1E293B', marginBottom: '6px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={opts.positive}
                                                            onChange={(e) => setReportInclusions(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...opts, positive: e.target.checked }
                                                            }))}
                                                        />
                                                        Positive Materials (MD &amp; SDoC)
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1E293B', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={opts.previous}
                                                            onChange={(e) => setReportInclusions(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...opts, previous: e.target.checked }
                                                            }))}
                                                        />
                                                        Previous reports (SoC, historical IHM reports, and other relevant reports)
                                                    </label>
                                                </div>

                                                {isGenerating ? (
                                                    <span className="report-card-meta muted" style={{ marginTop: '8px', display: 'block' }}>Generating PDF…</span>
                                                ) : hasGenerated ? (
                                                    <span className="report-card-meta ready" style={{ marginTop: '8px', display: 'block' }}>
                                                        Generated {generatedOnLabel}
                                                    </span>
                                                ) : (
                                                    <span className="report-card-meta muted" style={{ marginTop: '8px', display: 'block' }}>Not yet generated</span>
                                                )}
                                            </div>
                                            <div className="report-card-actions" style={{ marginTop: '16px' }}>
                                                {isGenerating ? (
                                                    <button
                                                        type="button"
                                                        className="report-btn-primary full is-loading"
                                                        disabled
                                                    >
                                                        <span className="spinner" aria-hidden="true" /> Generating…
                                                    </button>
                                                ) : hasGenerated && latest ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="report-btn-primary"
                                                            onClick={() => downloadCachedQuarter(latest.id, latest.fileName ?? `${item.id}-report.pdf`)}
                                                            disabled={isDisabled}
                                                            title="Download the most recently generated PDF"
                                                        >
                                                            <Download size={14} /> Download
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="report-btn-secondary"
                                                            onClick={() => startGenerate('adhoc', item.id)}
                                                            disabled={isDisabled}
                                                            title="Re-render with current data and replace the cached PDF"
                                                        >
                                                            <RotateCw size={14} /> Re-generate
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="report-btn-primary full"
                                                        onClick={() => startGenerate('adhoc', item.id)}
                                                        disabled={isDisabled}
                                                    >
                                                        <RotateCw size={14} /> Generate Report
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Quarterly Archive — one card per calendar quarter
                            since the vessel was onboarded. Quarters with a
                            cached report show Download; the rest show
                            Generate (which renders that quarter on demand
                            and downloads the PDF). */}
                        {activeReportTab === 'quarterly' && (
                            quarterlyLoading ? (
                                <div className="reports-empty-state">
                                    <div className="reports-empty-icon"><Calendar size={28} /></div>
                                    <h3>Loading quarters…</h3>
                                </div>
                            ) : timelineByYear.length === 0 ? (
                                <div className="reports-empty-state">
                                    <div className="reports-empty-icon"><Calendar size={28} /></div>
                                    <h3>No quarters yet</h3>
                                    <p>
                                        Quarterly reports become available once the vessel has been
                                        onboarded for at least one calendar quarter. Add a vessel
                                        first or wait until the next quarter starts.
                                    </p>
                                </div>
                            ) : (
                                <div className="quarterly-archive">
                                    {timelineByYear.map(({ year, entries }) => {
                                        const generatedCount = entries.filter((e) => e.report).length;
                                        return (
                                            <div className="year-group" key={year}>
                                                <div className="year-group-header">
                                                    <Calendar size={14} />
                                                    <span className="year-label">{year}</span>
                                                    <span className="year-count">
                                                        {entries.length} {entries.length === 1 ? 'quarter' : 'quarters'} · {generatedCount} generated
                                                    </span>
                                                </div>
                                                <div className="year-quarters">
                                                    {entries.map((entry) => {
                                                        const label = entry.period.label.split(' ')[0]; // 'Q2'
                                                        const range = formatQuarterRange(entry.period.start, entry.period.end);
                                                        const hasReport = !!entry.report;
                                                        const isGenerating = generatingQuarter === entry.period.label;
                                                        const dateMeta = hasReport
                                                            ? `Generated ${new Date(entry.report!.createdAt).toLocaleDateString()}`
                                                            : 'Not generated yet';
                                                        return (
                                                            <div className="quarter-row" key={entry.period.label}>
                                                                <div className="quarter-info">
                                                                    <strong>{label}</strong>
                                                                    <span>{range}</span>
                                                                </div>
                                                                <div className="quarter-meta">{dateMeta}</div>
                                                                <div className="quarter-actions">
                                                                    {hasReport && entry.report?.fileName && (
                                                                        <button
                                                                            type="button"
                                                                            className="report-btn-mini primary"
                                                                            onClick={() => downloadCachedQuarter(entry.report!.id, entry.report!.fileName!)}
                                                                            title="Download the cached PDF"
                                                                        >
                                                                            <Download size={12} /> Download
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className={`report-btn-mini${hasReport ? '' : ' primary'}`}
                                                                        onClick={() => generateQuarter(entry)}
                                                                        disabled={isGenerating}
                                                                        title={hasReport ? 'Re-generate from latest data' : 'Generate this quarter\'s report'}
                                                                    >
                                                                        <RotateCw size={12} /> {isGenerating ? 'Generating…' : (hasReport ? 'Re-generate' : 'Generate')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* Custom — date range builder placeholder */}
                        {activeReportTab === 'custom' && (
                            <div className="custom-report-panel">
                                <div className="custom-report-icon">
                                    <FileText size={28} />
                                </div>
                                <h3>Build a custom report</h3>
                                <p>
                                    Pick a date range, choose the sections you want included, and generate a one-off report
                                    outside the standard quarterly cadence.
                                </p>
                                <button
                                    type="button"
                                    className="report-btn-primary"
                                    onClick={() => startGenerate('adhoc', 'Custom Report')}
                                >
                                    <RotateCw size={14} /> Configure custom report
                                </button>
                            </div>
                        )}
                    </div>
                );
            }

            // ── Step 1: legacy single-accordion config form (filtered) ──
            // Show only the selected category as an expanded card with a
            // back link, so the screen reads as one focused config panel
            // instead of the full landing list.
            if (reportStep === 1) {
                const visibleCategories = reportCategories.filter((c) => c.id === selectedReportCategory);
                return (
                    <div className="reports-accordion-wrapper" ref={scrollContainerRef}>
                        <button
                            type="button"
                            className="reports-back-link"
                            onClick={() => {
                                setReportStep(0);
                                setSelectedReportCategory(null);
                            }}
                        >
                            <ChevronLeft size={16} /> Back to Reports
                        </button>
                        <div className="legacy-accordion-frame">
                        {visibleCategories.map((cat) => {
                            const isCategoryConfiguring = reportStep === 1 && selectedReportCategory === cat.id;
                            // Only expand if it's the selected category. ADHOC is no longer forced open.
                            const isExpanded = selectedReportCategory === cat.id;

                            return (
                                <div key={cat.id} className={`report-accordion-group ${isExpanded ? 'expanded' : ''}`}>
                                    <div
                                        className="report-accordion-header"
                                        onClick={() => {
                                            if (reportStep === 1 && selectedReportCategory === cat.id) {
                                                setReportStep(0);
                                                setSelectedReportCategory(null);
                                            } else {
                                                setSelectedReportCategory(isExpanded ? null : cat.id);
                                            }
                                        }}
                                    >
                                        <Monitor size={18} color="#00B0FA" />
                                        <h3>{cat.title}</h3>
                                        <ChevronDown size={14} className="accordion-arrow" />
                                    </div>
                                    {isExpanded && (
                                        <div className="report-accordion-content">
                                            {isCategoryConfiguring ? (
                                                <div className="designer-report-config-form">
                                                    <div className="config-form-top-row">
                                                        <div className="designer-field-group">
                                                            <label>From Date *</label>
                                                            <div className="designer-input-box">
                                                                <input type="date" defaultValue="2021-05-15" />
                                                            </div>
                                                            <span className="field-helper">MM/DD/YYYY</span>
                                                        </div>
                                                        <div className="designer-field-group">
                                                            <label>To Date *</label>
                                                            <div className="designer-input-box">
                                                                <input type="date" defaultValue="2026-02-04" />
                                                            </div>
                                                            <span className="field-helper">MM/DD/YYYY</span>
                                                        </div>
                                                    </div>

                                                    <div className="designer-file-row">
                                                        <label>Choose file</label>
                                                        <div className="file-selection-bar" onClick={() => docInputRef.current?.click()}>
                                                            <div className="file-display-area">
                                                                <Paperclip size={18} color="#94A3B8" />
                                                                <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>
                                                                    {selectedFile ? selectedFile.name : 'No file selected'}
                                                                </span>
                                                            </div>
                                                            <button className="designer-upload-btn" type="button">
                                                                <Upload size={18} />
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            ref={docInputRef}
                                                            style={{ display: 'none' }}
                                                            onChange={handleDocFileChange}
                                                        />
                                                    </div>

                                                    <div className="designer-sections-table">
                                                        <div className="sections-table-header">
                                                            <span className="col-sections">Sections</span>
                                                            <span className="col-include">INCLUDE</span>
                                                        </div>
                                                        <div className="sections-table-body">
                                                            {SECTIONS_LIST.map(sec => (
                                                                <div key={sec.id} className="section-table-row">
                                                                    <div className="section-name-cell">
                                                                        <span>{sec.title}</span>
                                                                        {sec.hasView && (
                                                                            <button
                                                                                type="button"
                                                                                className="action-icn-btn minimal"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (hiddenSections.includes(sec.id)) {
                                                                                        setHiddenSections(hiddenSections.filter(h => h !== sec.id));
                                                                                    } else {
                                                                                        setHiddenSections([...hiddenSections, sec.id]);
                                                                                    }
                                                                                }}
                                                                                title="Toggle visibility"
                                                                            >
                                                                                {hiddenSections.includes(sec.id) ? <EyeOff size={14} color="#EF4444" /> : <Eye size={14} className="view-icon-dim" />}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="section-checkbox-cell">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedSections.includes(sec.id)}
                                                                            onChange={() => toggleSection(sec.id)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="designer-form-footer">
                                                        <button
                                                            className="preview-btn-designer"
                                                            onClick={() => {
                                                                const currentSections = SECTIONS_LIST.filter(sec =>
                                                                    selectedSections.includes(sec.id) && !hiddenSections.includes(sec.id)
                                                                );
                                                                setReorderedSections(currentSections);
                                                                setReportStep(2);
                                                            }}
                                                        >
                                                            <Eye size={18} />
                                                            PREVIEW REPORT
                                                        </button>
                                                        <button
                                                            className="generate-btn-designer"
                                                            onClick={() => {
                                                                const currentSections = SECTIONS_LIST.filter(sec =>
                                                                    selectedSections.includes(sec.id) && !hiddenSections.includes(sec.id)
                                                                );
                                                                setReorderedSections(currentSections);
                                                                setReportStep(2);
                                                            }}
                                                        >
                                                            <RotateCw size={18} />
                                                            GENERATE REPORT
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="report-items-list">
                                                    {cat.items.length > 0 ? (
                                                        cat.items.map((item) => (
                                                            <div key={item.id} className="report-item-card-premium">
                                                                <div className="report-item-icon-box">
                                                                    <FileText size={24} color="#94A3B8" />
                                                                </div>
                                                                <div className="report-item-info">
                                                                    <div className="report-item-name">{item.name}</div>
                                                                    <div className="report-item-meta">{item.date}</div>
                                                                </div>
                                                                <div className="report-action-btns">
                                                                    <button
                                                                        className="generate-btn-final"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedReportType(item.name);
                                                                            setSelectedReportCategory(cat.id);
                                                                            setReportStep(1);
                                                                        }}
                                                                    >
                                                                        <RotateCw size={16} />
                                                                        GENERATE
                                                                    </button>
                                                                    <button className="download-btn-final" onClick={(e) => e.stopPropagation()}>
                                                                        <Download size={16} />
                                                                        DOWNLOAD
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="empty-category-msg">No reports found for this criteria.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    </div>
                );
            }

            // STEP 2: REPORT PREVIEW (As per user request, reorder structure is hidden for now)
            return (
                <div className="reports-final-output-wrapper">
                    {/* Sub-header with Title - Meta and Edit Config removed as per user request */}
                    <div className="report-sub-header-premium">
                        <div className="sub-title-main">
                            <Book size={24} className="editor-icon" />
                            <h2>Report Structure Editor</h2>
                        </div>
                    </div>

                    <div className="report-editor-layout">
                        {/* Left Sidebar: Draggable Structure */}
                        <div className="report-structure-sidebar">
                            <div className="sidebar-header-row">
                                <h3>DRAG TO REORDER SECTIONS</h3>
                                <button className="add-sec-btn-text">ADD SECTION</button>
                            </div>

                            <div className="draggable-sections-list">
                                {reorderedSections.length > 0 ? (
                                    reorderedSections.map((sec, idx) => (
                                        <div
                                            key={sec.id}
                                            className={`draggable-section-card ${draggedIndex === idx ? 'dragging' : ''}`}
                                            draggable
                                            onDragStart={(e) => {
                                                setDraggedIndex(idx);
                                                e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                if (draggedIndex === null || draggedIndex === idx) return;
                                                const newSections = [...reorderedSections];
                                                const itemToMove = newSections[draggedIndex];
                                                newSections.splice(draggedIndex, 1);
                                                newSections.splice(idx, 0, itemToMove);
                                                setDraggedIndex(idx);
                                                setReorderedSections(newSections);
                                            }}
                                            onDragEnd={() => setDraggedIndex(null)}
                                        >
                                            <div className="card-grab-handle">
                                                <GripVertical size={16} color="#94A3B8" />
                                            </div>
                                            <div className="card-title-txt">{sec.title}</div>
                                            <div
                                                className="card-visibility-icn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newReordered = reorderedSections.filter(s => s.id !== sec.id);
                                                    setReorderedSections(newReordered);
                                                    setHiddenSections([...hiddenSections, sec.id]);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                title="Hide section"
                                            >
                                                <Eye size={16} color="#94A3B8" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-selection-msg">No sections selected for preview.</div>
                                )}
                            </div>

                            <div className="sidebar-footer-actions">
                                <button className="reset-order-btn" onClick={() => {
                                    const original = SECTIONS_LIST.filter(sec =>
                                        selectedSections.includes(sec.id) && !hiddenSections.includes(sec.id)
                                    );
                                    setReorderedSections(original);
                                }}>RESET ORDER</button>
                            </div>
                        </div>

                        {/* Right: Preview Pane */}
                        <div className="report-main-preview-area">
                            {/* Centered Mock Paper Document */}
                            <div className="preview-pane-standalone">
                                <div className="pane-header-actions">
                                    <div className="preview-tag">
                                        <FileText size={18} className="preview-icon-small" />
                                        <h3>Live Preview: {selectedReportType || 'Report Overview'}</h3>
                                    </div>
                                    <div className="preview-controls-overlay">
                                        <span className="page-indicator">Page 1 of 12</span>
                                        <div className="zoom-btns">
                                            <button className="zoom-btn"><ZoomOut size={16} /></button>
                                            <button className="zoom-btn"><ZoomIn size={16} /></button>
                                            <button className="zoom-btn"><Maximize2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="paper-viewer-container">
                                    <div className="mock-paper-document">
                                        <div className="paper-header">
                                            <div className="paper-logo-icon">
                                                <ShipIcon size={32} />
                                            </div>
                                            <div className="confidential-mark">
                                                <span>STRICTLY CONFIDENTIAL</span>
                                                <small>Ref: VS-{vesselDisplayName}-2024-001</small>
                                            </div>
                                        </div>

                                        <h1 className="paper-title">{selectedReportType || 'Ship Hazmat Overview'}</h1>

                                        <p className="paper-intro-text">
                                            The following overview outlines the distribution and concentration of
                                            hazardous materials identified during the most recent IHM survey for the
                                            vessel <strong>{activeVesselName} (IMO: {activeVesselData?.imoNumber || '9371543'})</strong>.
                                        </p>

                                        <div className="summary-boxes-row">
                                            <div className="summary-box">
                                                <span className="box-label">TOTAL ITEMS LOGGED</span>
                                                <span className="box-value">124 Samples</span>
                                            </div>
                                            <div className="summary-box accent">
                                                <span className="box-label">ACTIVE HAZARDS</span>
                                                <span className="box-value">12 Locations</span>
                                            </div>
                                        </div>

                                        <div className="hazmat-table-mock">
                                            <div className="table-header">
                                                <span>HAZMAT CODE</span>
                                                <span>LOCATION</span>
                                                <span>STATUS</span>
                                            </div>
                                            <div className="table-row">
                                                <span>Asbestos (Table A)</span>
                                                <span>Engine Room - Gasket</span>
                                                <span className="status-pos">Positive</span>
                                            </div>
                                            <div className="table-row">
                                                <span>PCBs (Table A)</span>
                                                <span>Main Deck - Paint</span>
                                                <span className="status-neg">Negative</span>
                                            </div>
                                            <div className="table-row">
                                                <span>Ozone Depleting</span>
                                                <span>A/C Plant 2</span>
                                                <span className="status-trace">Trace</span>
                                            </div>
                                        </div>

                                        <div className="paper-footer-note">
                                            Note: All findings are subject to regular quarterly inspections and should be cross-referenced with the Movement Log on page 7.
                                        </div>

                                        <div className="paper-bottom-meta">
                                            <span>Varuna Sentinels | IHM Compliance Report</span>
                                            <span>Page 1 of 12</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pane-footer-actions">
                                    <button className="save-draft-btn-plain">SAVE DRAFT</button>
                                    <button className="finalize-export-btn">
                                        <Layers size={18} /> FINALIZE & EXPORT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="vessel-status-bar">
                        <div className="status-left">
                            <div className="status-dot dot-online"></div>
                            <span>System Online</span>
                        </div>
                        <div className="status-right">
                            <span>&copy; 2024 Varuna Sentinels. All rights reserved.</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'certificate') {
            return (
                <IHMCertificateView
                    key={activeVesselName}
                    vesselName={activeVesselName}
                    onCertificateSubmit={() => setNotifCount(prev => prev + 1)}
                />
            );
        }

        return (
            <div className="form-scroll-area">
                <div className="vessel-form-card-premium">
                    <form onSubmit={handleSave} className="vessel-edit-form-modern">
                        <div className="form-grid-three-col">
                            {/* Column 1 */}
                            <div className="form-column">
                                <FormGroup label="Name" name="name" value={formData.name || ''} onChange={handleInputChange} required readOnly={!isEditing} />
                                <FormGroup label="Ship Owner" name="shipOwner" value={formData.shipOwner || ''} onChange={handleInputChange} required readOnly={!isEditing} />
                                <FormGroup label="Fleet" name="fleet" value={formData.fleet || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Sub Fleet" name="subFleet" value={formData.subFleet || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Vessel Class" name="vesselClass" value={formData.vesselClass || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="IMO No" name="imoNumber" value={formData.imoNumber || ''} onChange={handleInputChange} required readOnly={!isEditing} />
                                <FormGroup label="Registration Number" name="registrationNumber" value={formData.registrationNumber || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <DateGroup label="Delivery Date" name="deliveryDate" value={formData.deliveryDate || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Deadweight Tonnage" name="deadweightTonnage" value={formData.deadweightTonnage || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Port of Registry" name="portOfRegistry" value={formData.portOfRegistry || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <DateGroup label="SOC Expiry Date" name="socExpiryDate" value={formData.socExpiryDate || ''} onChange={handleInputChange} readOnly={!isEditing} />
                            </div>

                            {/* Column 2 */}
                            <div className="form-column">
                                <FormGroup label="Type" name="vesselType" value={formData.vesselType || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Ship Manager" name="shipManager" value={formData.shipManager || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Registered Owner" name="registeredOwner" value={formData.registeredOwner || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Flag State" name="flagState" value={formData.flagState || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Vessel IHM Class" name="vesselIhmClass" value={formData.vesselIhmClass || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Class ID No" name="classIdNo" value={formData.classIdNo || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Name Of Yard" name="nameOfYard" value={formData.nameOfYard || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <DateGroup label="Keel Laid Date" name="keelLaidDate" value={formData.keelLaidDate || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="TEU No of Units" name="teuUnits" value={formData.teuUnits || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Initial IHM Reference" name="ihmReference" value={formData.ihmReference || ''} onChange={handleInputChange} readOnly={!isEditing} />
                            </div>

                            {/* Column 3 */}
                            <div className="form-column">
                                <div className="image-upload-modern">
                                    <label>Vessel Image</label>
                                    <div
                                        className={`image-preview-container-modern ${!formData.image ? 'no-image' : ''} ${isDraggingFile ? 'dragging' : ''}`}
                                        onClick={isEditing ? triggerFileSelect : undefined}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        {formData.image ? (
                                            <>
                                                <img
                                                    key={formData.image || 'empty'}
                                                    src={formData.image?.startsWith('/uploads') ? `${API_CONFIG.BASE_URL.replace('/api/v1', '')}${formData.image}` : formData.image}
                                                    alt="Vessel preview"
                                                />
                                                {isEditing && (
                                                    <div className="upload-overlay-modern">
                                                        <Plus size={24} />
                                                        <span>Change image</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="drag-drop-placeholder">
                                                <div className="custom-upload-animation">
                                                    <div className="animated-circle">
                                                        <div className="inverted-v-divider">
                                                            <div className="v-line left"></div>
                                                            <div className="v-line right"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="upload-text">
                                                    <p className="main-text">Drag and drop file</p>
                                                    <p className="sub-text">or <span className="highlight">browse</span> from computer</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {isEditing && <span className="upload-hint">Note: Image should not exceed 10MB</span>}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                </div>

                                <FormGroup label="Signal Letters" name="signalLetters" value={formData.signalLetters || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Builders unique id of ship" name="buildersUniqueId" value={formData.buildersUniqueId || ''} onChange={handleInputChange} readOnly={!isEditing} />
                                <FormGroup label="Gross Tonnage" name="grossTonnage" value={formData.grossTonnage || ''} onChange={handleInputChange} readOnly={!isEditing} />

                                <div className="radio-row-compact">
                                    <RadioGroup
                                        label="MD Standard"
                                        name="mdStandard"
                                        options={['HKC', 'EU']}
                                        value={formData.mdStandard || ''}
                                        onChange={handleInputChange}
                                        readOnly={!isEditing}
                                    />

                                    <RadioGroup
                                        label="IHM Method"
                                        name="ihmMethod"
                                        options={['NB', 'ES']}
                                        value={formData.ihmMethod || ''}
                                        onChange={handleInputChange}
                                        readOnly={!isEditing}
                                    />
                                </div>

                                <FormGroup label="SOC Reference" name="socReference" value={formData.socReference || ''} onChange={handleInputChange} readOnly={!isEditing} />
                            </div>
                        </div>

                        {!isOwnerOrManager && (
                            <div className="vessel-form-actions-premium">
                                {!isEditing ? (
                                    <button type="button" className="edit-btn-premium" onClick={() => setIsEditing(true)}>
                                        <Edit2 size={18} />
                                        <span>EDIT DETAILS</span>
                                    </button>
                                ) : (
                                    <div className="actions-group-premium">
                                        <button type="button" className="cancel-btn-premium" onClick={() => { setIsEditing(false); setIsAdding(false); setFormData(activeVesselData || INITIAL_VESSELS[0]); }}>
                                            CANCEL
                                        </button>
                                        <button type="submit" className="save-btn-premium">
                                            <Check size={18} />
                                            SAVE CHANGES
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="vessels-page-container">
            <Sidebar />
            <main className="vessel-page-main">
                <Header notificationCount={notifCount} />

                <div className="vessels-layout-wrapper">
                    <div className="vessels-top-nav">
                        <nav className="fleet-tabs-inline">
                            <div className="tabs-scroll-area">
                                {tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        className={`tab-item-inline ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => handleTabClick(tab.id)}
                                    >
                                        <tab.icon size={18} />
                                        <span>{tab.label}</span>
                                    </div>
                                ))}
                            </div>
                        </nav>
                    </div>

                    <div className="vessels-content-layout">
                        {/* Secondary Sidebar - Always visible for context */}
                        {!isVesselRole && (
                            <aside className="secondary-sidebar">
                                <div className="sidebar-section-header">
                                    <span>VESSEL SELECTION</span>
                                </div>
                                <div className="vessel-search-container light-mode">
                                    <div className="vessel-search-box light">
                                        <Search size={16} color="#94A3B8" />
                                        <input
                                            type="text"
                                            placeholder="Search vessels..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="vessel-list light-mode" style={{ flex: 1, overflowY: 'auto' }}>
                                    {myVesselList.filter(v =>
                                        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        v.imoNumber.includes(searchTerm)
                                    ).map((vessel) => (
                                        <div
                                            key={`${vessel.name}-${vessel.imoNumber}`}
                                            className={`vessel-item light ${activeVesselName === vessel.name ? 'active' : ''}`}
                                            onClick={() => handleVesselSelect(vessel)}
                                        >
                                            <div className="vessel-status-dot v-active"></div>
                                            <div className="vessel-info-block">
                                                <h4>{vessel.name}</h4>
                                                <p>IMO {vessel.imoNumber}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!isOwnerOrManager && (
                                    <div className="sidebar-list-footer">
                                        <button className="add-vessel-btn-refined" onClick={handleAddClick}>
                                            <Plus size={18} />
                                            Add Vessel
                                        </button>
                                    </div>
                                )}
                            </aside>
                        )}

                        <div className="vessels-main">
                            <div className={`vessel-tab-content ${(activeTab === 'reports' && reportStep === 2) ? 'no-scroll no-padding' : ''}`}>
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                </div>
                {
                    showModal && (
                        <SuccessModal
                            message={modalMessage}
                            onClose={() => setShowModal(false)}
                        />
                    )
                }
                {bannerMessage && (
                    <div className="custom-banner-overlay">
                        <div className={`custom-banner-card ${bannerMessage.type}`}>
                            <div className={`custom-banner-icon ${bannerMessage.type}`}>
                                {bannerMessage.type === 'info' ? <ShipIcon size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div className="custom-banner-text">
                                <h4 className="custom-banner-title">{bannerMessage.title}</h4>
                                <p className="custom-banner-body">{bannerMessage.body}</p>
                            </div>
                            <button className="custom-banner-close" onClick={() => setBannerMessage(null)}>×</button>
                        </div>
                    </div>
                )}
            </main >
        </div >
    );
}

// Helper Components
function FormGroup({ label, name, value, onChange, required, readOnly }: { label: string, name: string, value: string, onChange: (e: any) => void, required?: boolean, readOnly?: boolean }) {
    return (
        <div className="form-group-modern">
            <label>{label} {required && <span className="required">*</span>}</label>
            <input
                type="text"
                name={name}
                className={`form-control-modern ${readOnly ? 'read-only' : ''}`}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={`Enter ${label.toLowerCase()}`}
                required={required}
            />
        </div>
    );
}

function DateGroup({ label, name, value, onChange, readOnly }: { label: string, name: string, value: string, onChange: (e: any) => void, readOnly?: boolean }) {
    const [showCalendar, setShowCalendar] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Check if browser supports :has(), otherwise we might need global class handling, but inline style works for z-index

    const parseDate = (val: string | null) => {
        if (!val) return null;
        const d = new Date(val);
        return !isNaN(d.getTime()) ? d : null;
    };

    const initialDate = parseDate(value);
    const [viewDate, setViewDate] = useState(initialDate || new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
    const containerRef = useRef<HTMLDivElement>(null);
    const yearsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const parsed = parseDate(value);
        setSelectedDate(parsed);
        if (parsed) {
            setViewDate(parsed);
        }
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowCalendar(false);
                setShowYearPicker(false);
                setShowMonthPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-scroll year picker
    useEffect(() => {
        if (showYearPicker && yearsContainerRef.current) {
            const currentYearEl = yearsContainerRef.current.querySelector('.year-cell.current');
            if (currentYearEl) {
                currentYearEl.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [showYearPicker]);

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!readOnly) {
            setShowCalendar(prev => !prev);
            setShowYearPicker(false);
            setShowMonthPicker(false);
        }
    };

    const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleYearChange = (year: number) => {
        setViewDate(new Date(year, viewDate.getMonth(), 1));
        setShowYearPicker(false);
        // Optional: switch to month picker after year? keeping to day view for efficiency unless requested
        // User asked "Ask user about the month then ask them about the day" - maybe go to Month picker?
        // Let's go to Month picker for better flow
        setShowMonthPicker(true);
    };

    const handleMonthChange = (monthIndex: number) => {
        setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
        setShowMonthPicker(false);
    };

    const handleSelectDate = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        setSelectedDate(newDate);
        setShowCalendar(false);

        const yyyy = newDate.getFullYear();
        const mm = String(newDate.getMonth() + 1).padStart(2, '0');
        const dd = String(newDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        // Simulate full event to prevent crashes in parent handlers
        const syntheticEvent = {
            target: { name, value: dateStr },
            preventDefault: () => { },
            stopPropagation: () => { },
            persist: () => { }
        };

        onChange(syntheticEvent);
    };

    const formatDateDisplay = (date: Date | null) => {
        if (!date) return "";
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd} - ${mm} - ${yyyy}`;
    };

    const renderYearPicker = () => {
        const currentYear = viewDate.getFullYear();
        // Generate years 1900 to 2100
        const years = Array.from({ length: 201 }, (_, i) => 1900 + i);

        return (
            <div className="year-picker-grid">
                <div className="year-picker-header">Select Year</div>
                <div className="years-container" ref={yearsContainerRef}>
                    {years.map(y => (
                        <div
                            key={y}
                            className={`year-cell ${y === currentYear ? 'current' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleYearChange(y); }}
                        >
                            {y}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthPicker = () => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentMonth = viewDate.getMonth();

        return (
            <div className="month-picker-grid">
                <div className="year-picker-header">Select Month</div>
                <div className="months-container">
                    {monthNames.map((m, idx) => (
                        <div
                            key={m}
                            className={`month-cell ${idx === currentMonth ? 'current' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleMonthChange(idx); }}
                        >
                            {m}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCalendar = () => {
        const month = viewDate.getMonth();
        const year = viewDate.getFullYear();
        const days = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const offset = startDayOfMonth(month, year);
        for (let i = 0; i < offset; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        const totalDays = daysInMonth(month, year);
        for (let d = 1; d <= totalDays; d++) {
            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
            const isSelected = selectedDate?.toDateString() === new Date(year, month, d).toDateString();
            days.push(
                <div
                    key={d}
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleSelectDate(d); }}
                >
                    {d}
                </div>
            );
        }

        return (
            <div className="innovative-calendar-popup" onClick={(e) => e.stopPropagation()}>
                {showYearPicker ? renderYearPicker() : showMonthPicker ? renderMonthPicker() : (
                    <>
                        <div className="calendar-header-premium">
                            <button type="button" onClick={(e) => { e.stopPropagation(); handlePrevMonth(); }} className="nav-btn-cal"><ChevronLeft size={16} /></button>
                            <div className="month-year-display">
                                <span
                                    className="cal-month clickable"
                                    onClick={(e) => { e.stopPropagation(); setShowMonthPicker(true); }}
                                    title="Click to change month"
                                >
                                    {monthNames[month]}
                                </span>
                                <div
                                    className="cal-year-badge clickable"
                                    onClick={(e) => { e.stopPropagation(); setShowYearPicker(true); }}
                                    title="Click to change year"
                                >
                                    {year}
                                </div>
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleNextMonth(); }} className="nav-btn-cal"><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(wd => <span key={wd}>{wd}</span>)}
                        </div>
                        <div className="calendar-grid-premium">
                            {days}
                        </div>
                        <div className="calendar-footer-cal">
                            <button
                                type="button"
                                className="today-btn-cal"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const now = new Date();
                                    setViewDate(now);
                                    handleSelectDate(now.getDate());
                                }}
                            >
                                Go to Today
                            </button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div
            className="form-group-modern"
            ref={containerRef}
            style={{ zIndex: showCalendar ? 100 : 'auto', position: 'relative' }} /* Fix overlap */
        >
            <label>{label}</label>
            <div className="date-input-wrapper-modern">
                <div
                    className={`custom-date-field ${readOnly ? 'read-only' : ''} ${showCalendar ? 'active' : ''}`}
                    onClick={handleToggle}
                >
                    <span className={`date-value-text ${!selectedDate ? 'placeholder' : ''}`}>
                        {selectedDate ? formatDateDisplay(selectedDate) : `Select ${label.toLowerCase()}`}
                    </span>
                    <div
                        className="orbital-cal-indicator"
                        onClick={handleToggle}
                    >
                        <Calendar size={16} />
                    </div>
                </div>
                {!readOnly && showCalendar && renderCalendar()}
            </div>
        </div>
    );
}

function RadioGroup({ label, name, options, value, onChange, readOnly }: { label: string, name: string, options: string[], value: string, onChange: (e: any) => void, readOnly?: boolean }) {
    return (
        <div className="form-group-modern">
            <label>{label}</label>
            <div className="radio-group-container">
                {options.map(opt => (
                    <label key={opt} className={`radio-option ${readOnly ? 'disabled' : ''}`}>
                        <input
                            type="radio"
                            name={name}
                            value={opt}
                            checked={value === opt}
                            onChange={onChange}
                            disabled={readOnly}
                        />
                        <span className="radio-custom"></span>
                        <span className="radio-text">{opt}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

function SuccessModal({ message, onClose }: { message: string, onClose: () => void }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content success-card-modal">
                <div className="modal-success-icon">
                    <Check size={40} />
                </div>
                <h2 className="modal-title">Success!</h2>
                <p className="modal-message">{message}</p>
                <button className="modal-action-btn" onClick={onClose}>
                    DONE
                </button>
            </div>
        </div>
    );
}

// Local SuccessModal restored.
