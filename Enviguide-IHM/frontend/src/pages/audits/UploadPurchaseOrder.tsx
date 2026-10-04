import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import './UploadPurchaseOrder.css';
import MappingDropdown from '../../components/MappingDropdown';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import {
    ArrowUp,
    Upload,
    X,
    ChevronDown,
    FileText,
    Wand2,
    CheckCircle2,
    ArrowLeft,
    Download
} from 'lucide-react';
import { INITIAL_VESSELS } from '../../data/vesselData';
import type { Vessel } from '../../types';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';

type ExcelData = any[][];

const getShipManagersFromVessels = (vessels: Vessel[]) => {
    const managersMap: Record<string, { name: string; vessels: { name: string; imo: string }[] }> = {};

    vessels.forEach(v => {
        const managerName = v.shipManager || 'Unassigned';
        if (!managersMap[managerName]) {
            managersMap[managerName] = { name: managerName, vessels: [] };
        }
        managersMap[managerName].vessels.push({ name: v.name, imo: v.imoNumber });
    });

    return Object.values(managersMap);
};

const ALL_MAPPING_FIELDS = [
    { id: 'vesselName', label: 'VESSEL NAME', req: true },
    { id: 'poNumber', label: 'PO NUMBER', req: true },
    { id: 'itemDescription', label: 'ITEM DESCRIPTION', req: true },
    { id: 'poSentDate', label: 'PO SENT DATE', req: true },
    { id: 'impaCode', label: 'IMPA CODE', req: true },
    { id: 'issaCode', label: 'ISSA CODE', req: true },
    { id: 'equipmentCode', label: 'EQUIPMENT CODE', req: true },
    { id: 'equipmentName', label: 'EQUIPMENT NAME', req: true },
    { id: 'maker', label: 'MAKER', req: true },
    { id: 'model', label: 'MODEL', req: true },
    { id: 'partNumber', label: 'PART NUMBER', req: true },
    { id: 'unit', label: 'UNIT', req: true },
    { id: 'quantity', label: 'QUANTITY', req: true },
    { id: 'vendorRemark', label: 'VENDOR REMARK', req: true },
    { id: 'vendorEmail', label: 'VENDOR EMAIL', req: true },
    { id: 'vendorName', label: 'VENDOR NAME', req: true },
    { id: 'mdRequestedDate', label: 'MD REQUESTED DATE', req: true },
];

export default function UploadPurchaseOrder() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<'upload' | 'config' | 'mapping'>('upload');
    const [source, setSource] = useState('Excel');
    const [shipManager, setShipManager] = useState('');
    const [shipName, setShipName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [excelData, setExcelData] = useState<ExcelData>([]);
    const [toast, setToast] = useState<{ title: string; subtitle: string; visible: boolean; type: 'success' | 'error' }>({
        title: '',
        subtitle: '',
        visible: false,
        type: 'success'
    });


    const [showManagerDropdown, setShowManagerDropdown] = useState(false);
    const [showVesselDropdown, setShowVesselDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const isAllowedFile = (file: File) => {
        const name = file.name.toLowerCase();
        if (source === 'Excel') return name.endsWith('.xlsx') || name.endsWith('.xls');
        if (source === 'PDF') return name.endsWith('.pdf');
        if (source === 'CSV') return name.endsWith('.csv');
        return false;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragActive) setIsDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        if (!isAllowedFile(file)) {
            showToast('Unsupported file', `This source only accepts ${getAcceptedFileTypes()}.`, 'error');
            return;
        }
        setSelectedFile(file);
    };

    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
    const [showMappingErrors, setShowMappingErrors] = useState(false);
    const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const [vessels, setVessels] = useState<Vessel[]>([]);

    useEffect(() => {
        api.get<{ success: boolean; data: Vessel[] }>(ENDPOINTS.VESSELS.LIST)
            .then((res) => setVessels(res.data))
            .catch(() => setVessels(INITIAL_VESSELS));
    }, []);

    const shipManagersData = useMemo(
        () => getShipManagersFromVessels(vessels),
        [vessels],
    );

    const filteredManagers = useMemo(() =>
        shipManagersData.filter(m => m.name.toLowerCase().includes(shipManager.toLowerCase())),
        [shipManager, shipManagersData]);

    const filteredVessels = useMemo(() => {
        const manager = shipManagersData.find(m => m.name === shipManager);
        if (!manager) return [];
        return manager.vessels.filter(v => v.name.toLowerCase().includes(shipName.toLowerCase()));
    }, [shipManager, shipName, shipManagersData]);

    const showToast = (title: string, subtitle: string, type: 'success' | 'error' = 'success') => {
        setToast({ title, subtitle, visible: true, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const getAcceptedFileTypes = () => source === 'Excel' ? '.xlsx, .xls' : (source === 'PDF' ? '.pdf' : '.csv');

    const parseExcelFile = (file: File): Promise<ExcelData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    // Do NOT use cellDates:true - it causes off-by-one timezone bugs.
                    // Instead, use raw:false in sheet_to_json so SheetJS outputs the
                    // formatted string exactly as Excel displays it (e.g. "03-06-2026").
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    // raw:false → SheetJS honours Excel's own cell format (dates, numbers, etc.)
                    // header:1  → first row becomes header array
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,
                        raw: false,
                        dateNF: 'DD-MM-YYYY'   // fallback format for date cells
                    }) as ExcelData;
                    resolve(jsonData);
                } catch (err) { reject(err); }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    };

    // Keyword map: for each field ID, list all lowercase keywords that indicate a match
    const FIELD_KEYWORDS: Record<string, string[]> = {
        vesselName: ['vessel name', 'vessel', 'ship', 'ship name', 'shipname', 'vesselname'],
        poNumber: ['po number', 'po no', 'po#', 'purchase order', 'order number', 'orderno', 'ponumber'],
        itemDescription: ['item description', 'description', 'details', 'desc', 'particulars', 'item desc'],
        poSentDate: ['po sent date', 'sent date', 'date sent', 'delivery date', 'ship date', 'shipment date', 'deliverydate', 'sentdate'],
        impaCode: ['impa code', 'impa', 'impa no', 'impacode'],
        issaCode: ['issa code', 'issa', 'issa no', 'issacode'],
        equipmentCode: ['equipment code', 'equipment no', 'equip code', 'equipmentcode'],
        equipmentName: ['equipment name', 'equipment', 'equip name', 'equipmentname'],
        maker: ['maker', 'manufacturer', 'brand'],
        model: ['model', 'model no', 'model name'],
        partNumber: ['part number', 'part no', 'part#', 'partnumber'],
        unit: ['unit', 'uom', 'measure'],
        quantity: ['quantity', 'qty', 'amount'],
        vendorRemark: ['vendor remark', 'vendor note', 'remarks', 'vendorremark'],
        vendorEmail: ['vendor email', 'email', 'vendoremail'],
        vendorName: ['vendor name', 'vendor', 'supplier', 'vendorname'],
        mdRequestedDate: ['md requested date', 'requested date', 'md request date', 'mds requested', 'po date', 'order date', 'podate'],
    };


    const autoMapHeaders = (headers: any[], existingMappings: Record<string, string> = {}) => {
        const newMappings: Record<string, string> = { ...existingMappings };
        // Track which column indices are already taken
        const usedCols = new Set(Object.values(newMappings));
        ALL_MAPPING_FIELDS.forEach(field => {
            if (newMappings[field.id]) return;
            const keywords = FIELD_KEYWORDS[field.id] || [];
            const idx = headers.findIndex((h, i) => {
                if (usedCols.has(i.toString())) return false; // skip already-mapped cols
                // Replace underscores with spaces to support both e.g. "MD_REQUESTED_DATE" and "MD REQUESTED DATE"
                const header = String(h || '').toLowerCase().replace(/_/g, ' ').trim();
                return keywords.some(kw => header === kw || header.includes(kw) || kw.includes(header));
            });
            if (idx !== -1) {
                newMappings[field.id] = idx.toString();
                usedCols.add(idx.toString()); // reserve this column
            }
        });
        return newMappings;
    };

    const handleStartImport = async () => {
        if (!selectedFile || !shipManager || !shipName) return;
        try {
            const parsedData = await parseExcelFile(selectedFile);
            setExcelData(parsedData);
            setCurrentStep('mapping');

            setFieldMappings({});
        } catch (error) {
            showToast("Parsing Failed", "There was an error reading the Excel file. Please ensure it is not corrupted.", "error");
        }
    };

    const handleMapAll = () => {
        const headers = excelData[0] || [];
        setFieldMappings(autoMapHeaders(headers, fieldMappings));
    };

    const handleManualMappingChange = (fieldId: string, colIdx: string) => {
        setFieldMappings(prev => ({ ...prev, [fieldId]: colIdx }));
    };

    const requiredFields = ALL_MAPPING_FIELDS.filter(f => f.req);
    const mappedRequired = requiredFields.filter(f => !!fieldMappings[f.id]);
    const allRequiredMapped = mappedRequired.length === requiredFields.length;

    const handleConfirmMapping = () => {
        const unmappedRequired = ALL_MAPPING_FIELDS.filter(f => f.req && !fieldMappings[f.id]);
        if (unmappedRequired.length > 0) {
            setShowMappingErrors(true);
            return;
        }
        // All required fields mapped - run the full import immediately
        finalizeImport();
    };

    const finalizeImport = async () => {
        const unmappedRequired = ALL_MAPPING_FIELDS.filter(f => f.req && !fieldMappings[f.id]);
        if (unmappedRequired.length > 0) {
            setShowMappingErrors(true);
            return;
        }

        if (!shipName || !shipManager) {
            showToast("Missing Information", "Please select a Ship Manager and Vessel before finalizing.", "error");
            return;
        }

        const selectedVessel = filteredVessels.find(v => v.name === shipName);
        const imo = selectedVessel?.imo || 'UNKNOWN';

        // Find the full Vessel record (with id) from the API-fetched list for the backend upload.
        const vesselRecord = vessels.find(v => v.name === shipName && v.imoNumber === imo);
        if (!vesselRecord?.id) {
            showToast("Vessel Not Found", "Could not resolve vessel ID. Please re-select the vessel.", "error");
            return;
        }

        if (!selectedFile) {
            showToast("Missing File", "The uploaded file is no longer available. Please re-select it.", "error");
            return;
        }

        // 1. Mark recently added vessel
        localStorage.setItem('recentlyAddedAudit', JSON.stringify({ imo, timestamp: Date.now() }));

        // 2. Transform raw data to enforce exact column order requested
        const header = excelData[0];
        const bodyRows = excelData.slice(1).filter(row =>
            row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
        );
        const dataToProcess = [header, ...bodyRows];

        const mappedIndices = new Set(Object.values(fieldMappings).map(Number));
        const transformedData = dataToProcess.map((row, rIdx) => {
            if (rIdx === 0) {
                const newHeader = [
                    'Name', 'Vessel Name', 'PO Number', 'IMO Number',
                    'PO Sent Date', 'MD Requested Date', 'Item Description', 'Is Suspected',
                    'IMPA Code', 'ISSA Code', 'Equipment Code', 'Equipment Name',
                    'Maker', 'Model', 'Part Number', 'Unit', 'Quantity',
                    'Vendor Remark', 'Vendor Email', 'Vendor Name'
                ];
                // Append all remaining columns that were not mapped
                row.forEach((colStr, cIdx) => {
                    if (!mappedIndices.has(cIdx)) newHeader.push(String(colStr || `Column ${cIdx}`));
                });
                return newHeader;
            } else {
                const rowVesselName = fieldMappings.vesselName ? String(row[Number(fieldMappings.vesselName)] || '').trim() : '';
                const finalVesselName = rowVesselName || shipName;
                const rowItemName = fieldMappings.equipmentName 
                    ? String(row[Number(fieldMappings.equipmentName)] || '').trim() 
                    : (fieldMappings.itemDescription ? String(row[Number(fieldMappings.itemDescription)] || '').trim() : '');
                const finalItemName = rowItemName || 'Item';

                const newRow = [
                    finalItemName, // Name (Product Name)
                    finalVesselName, // Vessel Name
                    fieldMappings.poNumber ? String(row[Number(fieldMappings.poNumber)] || '') : '',
                    imo, // IMO Number (from selected vessel)
                    fieldMappings.poSentDate ? String(row[Number(fieldMappings.poSentDate)] || '') : '',
                    fieldMappings.mdRequestedDate ? String(row[Number(fieldMappings.mdRequestedDate)] || '') : '',
                    fieldMappings.itemDescription ? String(row[Number(fieldMappings.itemDescription)] || '') : '',
                    'No', // Is Suspected default
                    fieldMappings.impaCode ? String(row[Number(fieldMappings.impaCode)] || '') : '',
                    fieldMappings.issaCode ? String(row[Number(fieldMappings.issaCode)] || '') : '',
                    fieldMappings.equipmentCode ? String(row[Number(fieldMappings.equipmentCode)] || '') : '',
                    fieldMappings.equipmentName ? String(row[Number(fieldMappings.equipmentName)] || '') : '',
                    fieldMappings.maker ? String(row[Number(fieldMappings.maker)] || '') : '',
                    fieldMappings.model ? String(row[Number(fieldMappings.model)] || '') : '',
                    fieldMappings.partNumber ? String(row[Number(fieldMappings.partNumber)] || '') : '',
                    fieldMappings.unit ? String(row[Number(fieldMappings.unit)] || '') : '',
                    fieldMappings.quantity ? String(row[Number(fieldMappings.quantity)] || '') : '',
                    fieldMappings.vendorRemark ? String(row[Number(fieldMappings.vendorRemark)] || '') : '',
                    fieldMappings.vendorEmail ? String(row[Number(fieldMappings.vendorEmail)] || '') : '',
                    fieldMappings.vendorName ? String(row[Number(fieldMappings.vendorName)] || '') : '',
                ];
                // Append all remaining unmapped cell values
                row.forEach((colVal, cIdx) => {
                    if (!mappedIndices.has(cIdx)) newRow.push(String(colVal || ''));
                });
                return newRow;
            }
        });

        // Clear any stale per-audit UI preferences from a previous upload of
        // the same IMO. Rows/mapping are no longer kept in localStorage.
        localStorage.removeItem(`audit_visible_cols_${imo}`);

        // 4. Compute statistics from original data for metrics
        const rows = excelData.slice(1); // skip header row
        const poColIdx = fieldMappings.poNumber ? parseInt(fieldMappings.poNumber) : -1;
        const supColIdx = fieldMappings.supplierCode ? parseInt(fieldMappings.supplierCode) : -1;
        const prodColIdx = fieldMappings.productCode ? parseInt(fieldMappings.productCode) : -1;

        const vesselNameColIdx = fieldMappings.vesselName ? parseInt(fieldMappings.vesselName) : -1;
        const itemDescColIdx = fieldMappings.itemDescription ? parseInt(fieldMappings.itemDescription) : -1;
        const qtyColIdx = fieldMappings.quantity ? parseInt(fieldMappings.quantity) : -1;
        const poSentDateColIdx = fieldMappings.poSentDate ? parseInt(fieldMappings.poSentDate) : -1;
        const impaCodeColIdx = fieldMappings.impaCode ? parseInt(fieldMappings.impaCode) : -1;
        const vendorEmailColIdx = fieldMappings.vendorEmail ? parseInt(fieldMappings.vendorEmail) : -1;
        const vendorNameColIdx = fieldMappings.vendorName ? parseInt(fieldMappings.vendorName) : -1;
        const mdReqDateColIdx = fieldMappings.mdRequestedDate ? parseInt(fieldMappings.mdRequestedDate) : -1;

        let totalPO = 0, duplicatePO = 0, duplicateSupplierCode = 0, duplicateProduct = 0;

        if (poColIdx !== -1) {
            const poValues = rows.map(r => String(r[poColIdx] || '').trim()).filter(v => v !== '');
            const poSet = new Set<string>();
            poValues.forEach(v => poSet.add(v));
            totalPO = poSet.size;

            // Strict Duplicate matching based on user requested fields:
            // Vessel Name, PO Number, Item Description, PO Sent Date, IMPA Code, Quantity, Vendor Email, Vendor Name, MD Requested Date
            const counts: Record<string, number> = {};
            rows.forEach(r => {
                const po = String(r[poColIdx] || '').trim();
                if (!po) return;

                const vName = vesselNameColIdx !== -1 ? String(r[vesselNameColIdx] || '').trim().toLowerCase() : '';
                const itemDesc = itemDescColIdx !== -1 ? String(r[itemDescColIdx] || '').trim().toLowerCase() : '';
                const poSentDate = poSentDateColIdx !== -1 ? String(r[poSentDateColIdx] || '').trim() : '';
                const impaCode = impaCodeColIdx !== -1 ? String(r[impaCodeColIdx] || '').trim() : '';
                const rawQty = qtyColIdx !== -1 ? String(r[qtyColIdx] || '').replace(/[^0-9.-]+/g, '') : '';
                const qty = rawQty ? parseFloat(rawQty).toString() : '';
                const vEmail = vendorEmailColIdx !== -1 ? String(r[vendorEmailColIdx] || '').trim().toLowerCase() : '';
                const vNameVendor = vendorNameColIdx !== -1 ? String(r[vendorNameColIdx] || '').trim().toLowerCase() : '';
                const mdReqDate = mdReqDateColIdx !== -1 ? String(r[mdReqDateColIdx] || '').trim() : '';

                // Composite key for strict matching
                const key = `${vName}|${po}|${itemDesc}|${poSentDate}|${impaCode}|${qty}|${vEmail}|${vNameVendor}|${mdReqDate}`;
                counts[key] = (counts[key] || 0) + 1;
            });

            // Count unique combinations that appear more than once
            duplicatePO = Object.values(counts).filter(count => count > 1).length;
        }
        if (supColIdx !== -1) {
            const vals = rows.map(r => String(r[supColIdx] || '').trim()).filter(v => v !== '');
            const seen = new Set<string>(), dups = new Set<string>();
            vals.forEach(v => { if (seen.has(v)) dups.add(v); else seen.add(v); });
            duplicateSupplierCode = dups.size;
        }
        if (prodColIdx !== -1) {
            const vals = rows.map(r => String(r[prodColIdx] || '').trim()).filter(v => v !== '');
            const seen = new Set<string>(), dups = new Set<string>();
            vals.forEach(v => { if (seen.has(v)) dups.add(v); else seen.add(v); });
            duplicateProduct = dups.size;
        }

        // 5. POST to backend (file + line items + stats). Only persist localStorage
        //    + notify + navigate if the backend call succeeds.
        const lineItems = transformedData.slice(1); // drop header row
        const statsPayload = {
            totalPO,
            totalItems: rows.length,
            duplicatePO,
            duplicateSupplierCode,
            duplicateProduct,
        };

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('vesselId', vesselRecord.id);
        formData.append('stats', JSON.stringify(statsPayload));
        formData.append('lineItems', JSON.stringify(lineItems));

        try {
            await api.upload(ENDPOINTS.PURCHASE_ORDERS.UPLOAD_BULK, formData);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            showToast("Upload Failed", msg, "error");
            return;
        }

        // Audit registry is now in the backend — Pending Audits re-fetches on mount.

        // 6. Add notification
        const newNotif = {
            id: Date.now(),
            type: 'PO IMPORT',
            title: 'Purchase Order Uploaded',
            description: `Successfully imported ${totalPO} POs for ${shipName}.`,
            time: 'Just now',
            color: '#10B981',
            unread: true
        };
        const currentNotifs = JSON.parse(localStorage.getItem('user_notifications') || '[]');
        localStorage.setItem('user_notifications', JSON.stringify([newNotif, ...currentNotifs]));

        showToast("Import Successful", "Navigating to Pending Audits...", "success");
        setTimeout(() => {
            navigate('/administration/pending-audits');
        }, 2000);
    };


    return (
        <div className="upload-po-container">
            <Sidebar />
            <main className="upload-po-main">
                <Header />
                <div className="upload-po-content">
                    {currentStep === 'upload' && (
                        <div className="step-container-animated">
                            <div className="po-header-section no-breadcrumb">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                    <div>
                                        <h1>Upload Purchase Order</h1>
                                        <p>Manage and initiate the compliance review process for your maritime purchase orders.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="upload-area-card">
                                <div className="upload-icon-wrapper-v2">
                                    <div className="icon-inner-box-v2">
                                        <svg width="80" height="80" viewBox="0 0 24 24" className="upload-cloud-pulse" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.5 19C20.5376 19 23 16.5376 23 13.5C23 10.4624 20.5376 8 17.5 8C17.4431 8 17.3867 8.0008 17.3308 8.0024C16.8906 4.5884 13.9749 2 10.5 2C7.3093 2 4.6436 4.1956 3.7915 7.1581C1.6163 7.8596 0 9.8973 0 12.5C0 16.0899 2.9101 19 6.5 19H17.5Z" fill="#00B0FA" />
                                        </svg>
                                        <ArrowUp size={40} className="upload-arrow-bounce" color="white" strokeWidth={3} style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                                    </div>
                                </div>

                                <h2 className="upload-title">Upload Your Purchase Orders</h2>
                                <p className="upload-desc">
                                    Hey, now you can upload your purchase orders here to <br />
                                    begin the compliance review process.
                                </p>

                                <button className="select-files-btn" onClick={() => setCurrentStep('config')} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                    <Upload size={20} strokeWidth={2.5} />
                                    SELECT FILE
                                </button>

                                <div className="supports-text">
                                    SUPPORTS PDF, XLS, CSV FILES
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'config' && (
                        <div className="step-container-animated">
                            <div className="po-header-section no-breadcrumb">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                    <button
                                        onClick={() => setCurrentStep('upload')}
                                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                        onMouseOut={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h1>Configure Upload</h1>
                                        <p>Assign the ship manager and vessel for the imported data.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="upload-area-card" style={{ padding: '40px' }}>
                                <div style={{ width: '100%', maxWidth: '800px' }}>
                                    <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>SOURCE*</label>
                                            <div style={{ position: 'relative' }}>
                                                <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', appearance: 'none', background: 'white', fontSize: '14px' }}>
                                                    <option value="Excel">Excel</option><option value="PDF">PDF</option><option value="CSV">CSV</option>
                                                </select>
                                                <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94A3B8' }} />
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>SHIP MANAGER*</label>
                                            <div style={{ position: 'relative' }}>
                                                <input type="text" value={shipManager} onChange={(e) => { setShipManager(e.target.value); setShowManagerDropdown(true); setShipName(''); }} onFocus={() => setShowManagerDropdown(true)} placeholder="Search ship manager..." style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px' }} />
                                                {showManagerDropdown && filteredManagers.length > 0 && (
                                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                                                        {filteredManagers.map((m, idx) => <div key={idx} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px' }} onClick={() => { setShipManager(m.name); setShowManagerDropdown(false); }}>{m.name}</div>)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>SHIP NAME*</label>
                                            <div style={{ position: 'relative' }}>
                                                <input type="text" value={shipName} onChange={(e) => { setShipName(e.target.value); setShowVesselDropdown(true); }} onFocus={() => setShowVesselDropdown(true)} placeholder="Search ship name..." disabled={!shipManager} style={{ width: '100%', padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', opacity: shipManager ? 1 : 0.6 }} />
                                                {showVesselDropdown && filteredVessels.length > 0 && (
                                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                                                        {filteredVessels.map((v, idx) => <div key={idx} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px' }} onClick={() => { setShipName(v.name); setShowVesselDropdown(false); }}>{v.name}</div>)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '8px' }}>DOCUMENT*</label>
                                            <div
                                                onDragOver={handleDragOver}
                                                onDragEnter={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                                onClick={() => !selectedFile && fileInputRef.current?.click()}
                                                style={{
                                                    padding: selectedFile ? '14px' : '24px 14px',
                                                    background: isDragActive ? '#E0F2FE' : '#F0F9FF',
                                                    border: `1.5px dashed ${isDragActive ? '#0284C7' : '#00B0FA'}`,
                                                    borderRadius: '10px',
                                                    color: '#0369A1',
                                                    fontSize: '13px',
                                                    fontWeight: 700,
                                                    cursor: selectedFile ? 'default' : 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'background 0.15s, border-color 0.15s',
                                                }}
                                            >
                                                {selectedFile ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                            <FileText size={16} color="#00B0FA" />
                                                            <span style={{ color: '#0F172A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                            style={{ background: 'white', border: '1px solid #BAE6FD', borderRadius: '6px', color: '#0369A1', padding: '6px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            CHANGE
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                        <Upload size={18} />
                                                        <div>{isDragActive ? 'DROP FILE HERE' : 'DRAG & DROP OR CLICK TO SELECT'}</div>
                                                        <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>Accepts {getAcceptedFileTypes()}</div>
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept={getAcceptedFileTypes()} style={{ display: 'none' }} />
                                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                                                <a 
                                                    href="/sample_purchase_order.csv" 
                                                    download="sample_purchase_order.csv"
                                                    style={{ 
                                                        fontSize: '11px', 
                                                        color: '#00B0FA', 
                                                        fontWeight: 700, 
                                                        textDecoration: 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        cursor: 'pointer',
                                                        transition: 'color 0.2s'
                                                    }}
                                                    onMouseOver={(e) => (e.currentTarget.style.color = '#008AC5')}
                                                    onMouseOut={(e) => (e.currentTarget.style.color = '#00B0FA')}
                                                >
                                                    <Download size={12} /> DOWNLOAD SAMPLE CSV FILE
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '48px' }}>
                                    <button style={{ padding: '14px 28px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', fontWeight: 700, cursor: 'pointer', color: '#64748B' }} onClick={() => setCurrentStep('upload')}>BACK</button>
                                    <button style={{ padding: '14px 32px', borderRadius: '10px', border: 'none', background: (!selectedFile || !shipManager || !shipName) ? '#CBD5E1' : '#00B0FA', color: 'white', fontWeight: 700, cursor: 'pointer' }} onClick={handleStartImport} disabled={!selectedFile || !shipManager || !shipName}>PARSE & MAP DATA</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'mapping' && (() => {
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', paddingTop: 'calc(var(--header-height) + 16px)', position: 'relative' }}>
                                {/* Banner removed - CONFIRM MAPPING now calls finalizeImport directly */}
                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px 20px 0', borderBottom: '1px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                                        <span style={{ color: '#94A3B8', fontWeight: 500 }}>Administration</span>
                                        <span style={{ color: '#E2E8F0' }}>/</span>
                                        <span style={{ color: '#94A3B8', fontWeight: 500 }}>Upload PO</span>
                                        <span style={{ color: '#E2E8F0' }}>/</span>
                                        <span style={{ color: '#0F172A', fontWeight: 700 }}>Data Mapping</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                        <div style={{ background: '#F0FDF4', color: '#16A34A', padding: '8px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px', border: '1px solid #DCFCE7' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }}></div>
                                            FILE: {selectedFile?.name.toUpperCase() || 'NO FILE'}
                                        </div>
                                        <button onClick={() => setCurrentStep('config')} style={{ background: 'none', border: 'none', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.2s' }}>
                                            CLOSE VIEW <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: '40px', flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: '0' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>File Content Preview</h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>Showing 1-{Math.min(100, excelData.length - 1)} of {excelData.length - 1} records</span>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: '16px', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', height: '100%' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                                                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F8FAFC' }}>
                                                    <tr style={{ background: '#F8FAFC' }}>
                                                        {excelData[0]?.map((h, i) => (
                                                            <th key={i} style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '120px', fontSize: '12px' }}>
                                                                {String(h || '')}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {excelData.slice(1, 100).map((row, ri) => (
                                                        <tr key={ri} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                            {excelData[0]?.map((_h, ci) => (
                                                                <td key={ci} style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {String(row[ci] ?? '')}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
                                        <div className="mapping-fields-scrollable" style={{ padding: '24px 24px 200px', flex: 1, overflowY: 'auto' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Field Mapping</h3>
                                                <button style={{ background: '#F0F9FF', border: 'none', color: '#00B0FA', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', textTransform: 'uppercase' }} onClick={handleMapAll}><Wand2 size={14} /> MAP ALL</button>
                                            </div>
                                            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '32px', lineHeight: 1.5 }}>Assign Excel columns to the required platform data fields.</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {ALL_MAPPING_FIELDS.map(f => (
                                                    <div key={f.id} ref={el => { fieldRefs.current[f.id] = el; }} className="mapping-field-item">
                                                        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>{f.label}{f.req ? '*' : ''}</label>
                                                            {fieldMappings[f.id] ? (
                                                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#10B981', background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '4px', padding: '2px 7px', letterSpacing: '0.05em' }}>
                                                                    {f.id === 'poNumber' || f.id === 'supplierName' || f.id === 'itemDescription' ? 'AUTO-MATCHED' : 'MAPPED'}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <MappingDropdown
                                                            value={fieldMappings[f.id] || ''}
                                                            isMapped={!!fieldMappings[f.id]}
                                                            isRequired={f.req}
                                                            onChange={(val) => handleManualMappingChange(f.id, val)}
                                                            options={
                                                                (excelData[0] ?? []).reduce<Array<{ value: string; label: string; subLabel?: string }>>((acc, h, i) => {
                                                                    const mappedByOthers = Object.entries(fieldMappings).some(([key, val]) => key !== f.id && val === i.toString());
                                                                    if (!mappedByOthers) {
                                                                        acc.push({
                                                                            value: i.toString(),
                                                                            label: String(h) || ("Column " + (i + 1))
                                                                        });
                                                                    }
                                                                    return acc;
                                                                }, [])
                                                            }
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>


                                        <div style={{ padding: '20px 24px', borderTop: '1px solid #E2E8F0', background: 'white', borderRadius: '0 0 24px 24px', flexShrink: 0 }}>
                                            <button
                                                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: allRequiredMapped ? '#00B0FA' : '#94A3B8', color: 'white', fontWeight: 700, fontSize: '14px', cursor: allRequiredMapped ? 'pointer' : 'not-allowed', transition: 'all 0.3s', boxShadow: allRequiredMapped ? '0 4px 6px -1px rgba(0, 176, 250, 0.2)' : 'none', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                                onClick={handleConfirmMapping}
                                            >
                                                CONFIRM MAPPING
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Mapping Errors Modal */}
                {
                    showMappingErrors && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: 'white', borderRadius: '16px', width: '520px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', animation: 'fadeInSection 0.25s ease-out' }}>
                                {/* Modal Header */}
                                <div style={{ padding: '28px 32px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <X size={18} color="#EF4444" />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Review Mapping Errors</h3>
                                    <button onClick={() => setShowMappingErrors(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                                {/* Modal Body */}
                                <div style={{ padding: '0 32px 28px' }}>
                                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
                                        There are <strong style={{ color: '#0F172A' }}>{ALL_MAPPING_FIELDS.filter(f => f.req && !fieldMappings[f.id]).length} unmapped mandatory fields</strong> that must be corrected before you can finalize the import.
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto', marginBottom: '20px' }}>
                                        {ALL_MAPPING_FIELDS.filter(f => f.req && !fieldMappings[f.id]).map(f => (
                                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '10px', cursor: 'pointer', transition: 'transform 0.15s' }}
                                                onClick={() => { setShowMappingErrors(false); fieldRefs.current[f.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span style={{ fontSize: '14px' }}>âš ï¸</span>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#991B1B', letterSpacing: '0.04em' }}>{f.label}*</div>
                                                        <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>REQUIRED FIELD</div>
                                                    </div>
                                                </div>
                                                <span style={{ color: '#F87171', fontSize: '18px' }}>→</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ background: '#EFF6FF', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '28px' }}>
                                        <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>â„¹ï¸</span>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#3B82F6', lineHeight: 1.5 }}>Mandatory fields must be assigned to a column from your source file. Click any field above to jump to it.</p>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button onClick={() => { setShowMappingErrors(false); setCurrentStep('config'); }} style={{ background: 'none', border: 'none', fontSize: '13px', fontWeight: 700, color: '#64748B', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CANCEL IMPORT</button>
                                        <button onClick={() => setShowMappingErrors(false)} style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
                                            BACK TO MAPPING â†©
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    toast.visible && (!allRequiredMapped || currentStep !== 'mapping') && (
                        <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1E293B', color: 'white', padding: '12px 24px', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 10000, boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideInDown 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: toast.type === 'success' ? '#10B981' : '#EF4444' }}>
                                {toast.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700 }}>{toast.title}</div>
                                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{toast.subtitle}</div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
}
