import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ReviewWizard.css';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import {
    ChevronDown,
    Send,
    X,
    Mail,
    Minus,
    Maximize2,
    Type,
    Paperclip,
    Link as LinkIcon,
    Smile,
    Image,
    Trash2,
    FileUp,
    CheckCircle2,
    Loader2
} from 'lucide-react';

interface ReviewWizardProps {
    imo: string;
    vesselName: string;
    auditId?: string; // Preferred — disambiguates when multiple audits share an IMO
    onClose: () => void;
    onComplete: () => void;
}

const ReviewWizard = ({ imo, vesselName, auditId, onClose, onComplete }: ReviewWizardProps) => {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<any[][]>([]);
    const [visibleCols, setVisibleCols] = useState<boolean[]>([]);
    const [showMailModal, setShowMailModal] = useState(false);
    const [mailContent, setMailContent] = useState({
        to: '',
        subject: '',
        body: ''
    });
    const [suspectedItems, setSuspectedItems] = useState<any[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toInputRef = useRef<HTMLInputElement>(null);

    // Recipient chip state
    const [toChips, setToChips] = useState<string[]>([]);
    const [toInputVal, setToInputVal] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [ccVal, setCcVal] = useState('');
    const [bccVal, setBccVal] = useState('');

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastData, setToastData] = useState({ title: '', message: '' });

    // Send-in-flight state. Prevents double-submit while the clarification
    // email POST is on the wire and feeds the spinner UI on the Send button.
    const [isSending, setIsSending] = useState(false);

    // Parse emails into chips when modal opens
    const initChips = (emailStr: string) => {
        const chips = emailStr.split(',').map(e => e.trim()).filter(Boolean);
        setToChips(chips);
        setToInputVal('');
    };

    const addChip = (val: string) => {
        const trimmed = val.trim();
        if (trimmed) setToChips(prev => [...prev, trimmed]);
        setToInputVal('');
    };

    // Colour palette for avatar circles
    const chipColors = ['#1a73e8', '#0f9d58', '#f29900', '#ea4335', '#9c27b0', '#00acc1', '#e91e63', '#ff5722'];
    const getChipColor = (email: string) => chipColors[email.charCodeAt(0) % chipColors.length];

    // Excel-like Drag selection
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ r: number, c: number } | null>(null);
    const isDragging = useRef(false);

    // Filter state
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [filters, setFilters] = useState<Record<number, string[]>>({});
    const [filterSearch, setFilterSearch] = useState('');

    // Column resizing
    const [columnWidths, setColumnWidths] = useState<number[]>([]);
    const resizingCol = useRef<{ idx: number, startX: number, startWidth: number } | null>(null);

    // Row Selection
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    // Edit state
    const [editingCell, setEditingCell] = useState<{ r: number, c: number } | null>(null);

    const [, setHistory] = useState<any[][][]>([]);

    useEffect(() => {
        if (!imo && !auditId) return;
        // Prefer the by-id endpoint when we have a UUID — fixes ambiguity when
        // the same IMO has multiple audit rows (pending / completed / etc.).
        const endpoint = auditId
            ? ENDPOINTS.AUDITS.LINE_ITEMS_BY_ID(auditId)
            : ENDPOINTS.AUDITS.LINE_ITEMS(imo);
        api.get<{ success: boolean; data: { header: string[]; rows: unknown[][] } }>(endpoint)
            .then((res) => {
                const header = res.data.header || [];
                const rows = res.data.rows || [];
                const full = [header, ...rows];
                setData(full);
                setVisibleCols(new Array(header.length).fill(true));
                setColumnWidths(new Array(header.length).fill(150));
            })
            .catch(() => {
                setData([]);
                setVisibleCols([]);
                setColumnWidths([]);
            });
    }, [imo, auditId]);

    const pushToHistory = useCallback(() => {
        setHistory(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(data))]);
    }, [data]);

    const handleUndo = useCallback(() => {
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setData(last);
            return prev.slice(0, -1);
        });
    }, []);

    useEffect(() => {
        const handleGlobalKeys = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                handleUndo();
            }
            if (e.key === 'Delete' && dragStart && dragEnd && !editingCell) {
                handleClearSelectionData();
            }
        };
        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [handleUndo, dragStart, dragEnd, editingCell]);

    const handleMouseDown = (r: number, c: number) => {
        if (editingCell) return;
        setDragStart({ r, c });
        setDragEnd({ r, c });
        isDragging.current = true;
    };

    const handleMouseEnter = (r: number, c: number) => {
        if (isDragging.current) setDragEnd({ r, c });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        // Persistence is handled by NOT nulling dragStart/dragEnd immediately
        // unless it's a single cell and we want to deselect or something.
        // Actually, let's just keep the last range.
    };

    const getSelectionClass = (r: number, c: number) => {
        if (!dragStart || !dragEnd) return '';
        const startR = Math.min(dragStart.r, dragEnd.r);
        const endR = Math.max(dragStart.r, dragEnd.r);
        const startC = Math.min(dragStart.c, dragEnd.c);
        const endC = Math.max(dragStart.c, dragEnd.c);

        if (r < startR || r > endR || c < startC || c > endC) return '';

        let classes = 'selected';
        if (r === startR) classes += ' sel-top';
        if (r === endR) classes += ' sel-bottom';
        if (c === startC) classes += ' sel-left';
        if (c === endC) classes += ' sel-right';
        if (r === endR && c === endC && isDragging.current) classes += ' sel-handle';

        return classes;
    };

    const handleClearSelectionData = () => {
        if (!dragStart || !dragEnd) return;
        pushToHistory();
        const startR = Math.min(dragStart.r, dragEnd.r);
        const endR = Math.max(dragStart.r, dragEnd.r);
        const startC = Math.min(dragStart.c, dragEnd.c);
        const endC = Math.max(dragStart.c, dragEnd.c);

        const newData = JSON.parse(JSON.stringify(data));
        const visibleIndices = new Set(filteredRows.map(f => f.originalIdx));

        for (let r = startR; r <= endR; r++) {
            if (!visibleIndices.has(r)) continue;
            for (let c = startC; c <= endC; c++) {
                newData[r][c] = '';
            }
        }
        setData(newData);
        setDragStart(null);
        setDragEnd(null);
    };

    const handleDeleteSelectionRows = () => {
        if (!dragStart || !dragEnd) return;
        pushToHistory();
        const startR = Math.min(dragStart.r, dragEnd.r);
        const endR = Math.max(dragStart.r, dragEnd.r);
        const rangeIndices = new Set();
        const visibleIndices = new Set(filteredRows.map(f => f.originalIdx));

        for (let r = startR; r <= endR; r++) {
            if (visibleIndices.has(r)) rangeIndices.add(r);
        }

        if (window.confirm(`Delete all ${rangeIndices.size} rows in current selection?`)) {
            const newData = data.filter((_, idx) => idx === 0 || !rangeIndices.has(idx));
            setData(newData);
            setDragStart(null);
            setDragEnd(null);
        }
    };

    const handleDragFill = () => {
        if (!dragStart || !dragEnd) return;
        pushToHistory();
        const startR = Math.min(dragStart.r, dragEnd.r);
        const endR = Math.max(dragStart.r, dragEnd.r);
        const startC = Math.min(dragStart.c, dragEnd.c);
        const endC = Math.max(dragStart.c, dragEnd.c);

        const sourceValue = data[dragStart.r][dragStart.c];
        const newData = JSON.parse(JSON.stringify(data));
        const visibleIndices = new Set(filteredRows.map(f => f.originalIdx));

        for (let r = startR; r <= endR; r++) {
            if (!visibleIndices.has(r)) continue;
            for (let c = startC; c <= endC; c++) {
                newData[r][c] = sourceValue;
            }
        }
        setData(newData);
    };

    const handleResizeStart = (e: React.MouseEvent, idx: number) => {
        e.preventDefault(); e.stopPropagation();
        resizingCol.current = { idx, startX: e.pageX, startWidth: columnWidths[idx] };
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizingCol.current) return;
        const diff = e.pageX - resizingCol.current.startX;
        const next = [...columnWidths];
        next[resizingCol.current.idx] = Math.max(50, resizingCol.current.startWidth + diff);
        setColumnWidths(next);
    };

    const handleResizeEnd = () => {
        resizingCol.current = null;
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
    };

    const handleCellDoubleClick = (r: number, c: number) => {
        setEditingCell({ r, c });
    };

    const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
        if (e.ctrlKey && e.key === ';') {
            e.preventDefault();
            const dateStr = new Date().toISOString().split('T')[0];
            const nd = [...data]; nd[r][c] = dateStr; setData(nd);
        }
        if (e.key === 'Enter') {
            setEditingCell(null);
        }
    };

    const insertColumn = (colIdx: number, direction: 'left' | 'right') => {
        const insertIdx = direction === 'left' ? colIdx : colIdx + 1;
        setData(prev => prev.map((row, i) => {
            const next = [...row]; next.splice(insertIdx, 0, i === 0 ? 'New Column' : '');
            return next;
        }));
        setVisibleCols(prev => { const next = [...prev]; next.splice(insertIdx, 0, true); return next; });
        setColumnWidths(prev => { const next = [...prev]; next.splice(insertIdx, 0, 150); return next; });
        setActiveMenu(null);
    };

    const filteredRows = useMemo(() => {
        return data.slice(1).map((row, i) => ({ row, originalIdx: i + 1 }))
            .filter(({ row }) =>
                Object.entries(filters).every(([colIdx, activeValues]) => {
                    if (!activeValues || activeValues.length === 0) return true;
                    const cellVal = String(row[parseInt(colIdx)] || '').trim();
                    return activeValues.includes(cellVal);
                })
            );
    }, [data, filters]);

    // Selection handlers
    const toggleRowSelection = (idx: number) => {
        const next = new Set(selectedRows);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedRows(next);
    };

    const toggleAll = () => {
        if (selectedRows.size === filteredRows.length && filteredRows.length > 0) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredRows.map((f: any) => f.originalIdx)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedRows.size === 0) return;
        pushToHistory();
        const newData = data.filter((_, idx) => idx === 0 || !selectedRows.has(idx));
        setData(newData);
        setSelectedRows(new Set());
    };

    const handleDeleteFiltered = () => {
        const count = filteredRows.length;
        if (count === 0) return;
        if (window.confirm(`Are you sure you want to delete all ${count} displayed items?`)) {
            pushToHistory();
            const filteredIndices = new Set(filteredRows.map(f => f.originalIdx));
            const newData = data.filter((_, idx) => idx === 0 || !filteredIndices.has(idx));
            setData(newData);
            setSelectedRows(new Set());
        }
    };

    const handleClearAll = () => {
        if (data.length <= 1) return;
        if (window.confirm("Are you sure you want to delete ALL data in this audit?")) {
            pushToHistory();
            setData([data[0]]);
            setSelectedRows(new Set());
            setFilters({});
        }
    };

    const handleBulkAccept = () => {
        pushToHistory();
        const suspectedIdx = data[0].indexOf('Is Suspected');
        setData(prev => [
            prev[0],
            ...prev.slice(1).map((r, i) => {
                if (selectedRows.size > 0 && !selectedRows.has(i + 1)) return r;
                const next = [...r]; next[suspectedIdx] = 'No'; return next;
            })
        ]);
    };

    const handleBulkReject = () => {
        pushToHistory();
        const suspectedIdx = data[0].indexOf('Is Suspected');
        setData(prev => [
            prev[0],
            ...prev.slice(1).map((r, i) => {
                if (selectedRows.size > 0 && !selectedRows.has(i + 1)) return r;
                const next = [...r]; next[suspectedIdx] = 'Yes'; return next;
            })
        ]);
    };

    const lineItemsEndpoint = auditId
        ? ENDPOINTS.AUDITS.LINE_ITEMS_BY_ID(auditId)
        : ENDPOINTS.AUDITS.LINE_ITEMS(imo);

    const nextStep = async () => {
        // Persist the edited rows to the backend before advancing.
        try {
            await api.patch(lineItemsEndpoint, { rows: data.slice(1) });
        } catch (err) {
            console.error('Failed to save rows before advancing step:', err);
        }
        if (step < 3) setStep(step + 1);
        else handleFinalize();
    };

    const handleFinalize = async () => {
        const header = data[0];
        const suspectedIdx = header.indexOf('Is Suspected');
        const descIdx = header.indexOf('Item Description');
        const poIdx = header.indexOf('PO Number');
        const emailIdx = header.indexOf('Vendor Email');
        const equipNameIdx = header.indexOf('Equipment Name');
        const makerIdx = header.indexOf('Maker');
        const modelIdx = header.indexOf('Model');
        const partNoIdx = header.indexOf('Part Number');
        const qtyIdx = header.indexOf('Quantity');
        const unitIdx = header.indexOf('Unit');
        const impaIdx = header.indexOf('IMPA Code');
        const issaIdx = header.indexOf('ISSA Code');
        const vendorNameIdx = header.indexOf('Vendor Name');
        const mdReqIdx = header.indexOf('MD Requested Date');

        const suspected = data.slice(1).filter(row => row[suspectedIdx] === 'Yes');

        if (suspected.length > 0) {
            setSuspectedItems(suspected);
            const vendorEmails = Array.from(new Set(suspected.map(r => r[emailIdx]).filter(e => e))) as string[];
            const body = `Dear Team,\n\nWe are currently reviewing the IHM documentation for ${vesselName} (IMO: ${imo}). During our audit, we identified some items that require additional clarification or documentation (SDoC/MD).\n\nSuspected Items Details:\n${suspected.map((r, i) => {
                const desc = descIdx !== -1 ? r[descIdx] : '';
                const po = poIdx !== -1 ? r[poIdx] : '';
                const equip = equipNameIdx !== -1 ? r[equipNameIdx] : '';
                const maker = makerIdx !== -1 ? r[makerIdx] : '';
                const model = modelIdx !== -1 ? r[modelIdx] : '';
                const part = partNoIdx !== -1 ? r[partNoIdx] : '';
                const qty = qtyIdx !== -1 ? r[qtyIdx] : '';
                const unit = unitIdx !== -1 ? r[unitIdx] : '';
                const impa = impaIdx !== -1 ? r[impaIdx] : '';
                const issa = issaIdx !== -1 ? r[issaIdx] : '';
                const vName = vendorNameIdx !== -1 ? r[vendorNameIdx] : '';
                const reqDate = mdReqIdx !== -1 ? r[mdReqIdx] : '';

                let itemText = `--------------------------------------------------\n`;
                itemText += `${i + 1}. Item Description: ${desc}\n`;
                if (po) itemText += `   - PO Number: ${po}\n`;
                if (equip) itemText += `   - Equipment Name: ${equip}\n`;
                if (maker || model) itemText += `   - Maker/Model: ${maker || 'N/A'} / ${model || 'N/A'}\n`;
                if (part) itemText += `   - Part Number: ${part}\n`;
                if (impa || issa) itemText += `   - IMPA/ISSA Code: ${impa || 'N/A'} / ${issa || 'N/A'}\n`;
                if (qty) itemText += `   - Quantity: ${qty} ${unit || ''}\n`;
                if (vName) itemText += `   - Supplier: ${vName}\n`;
                if (reqDate) itemText += `   - MD Requested Date: ${reqDate}\n`;
                return itemText;
            }).join('')}\n--------------------------------------------------\n\nPlease provide the requested info at your earliest convenience.\n\nBest Regards,\nIHM Audit Team`;

            setMailContent({
                to: vendorEmails.join(', '),
                subject: `Clarification Needed: IHM Audit - ${vesselName} (${imo})`,
                body: body
            });
            initChips(vendorEmails.join(', '));
            setShowMailModal(true);
        } else {
            try {
                if (auditId) {
                    await api.patch(`/audits/reviews/${auditId}/complete`, {});
                }
            } catch (err) {
                console.error('Failed to complete review on backend:', err);
            }
            onComplete();
        }
    };

    const handleSendMail = async () => {
        if (isSending) return; // prevent double-submit
        if (toChips.length === 0) {
            setToastData({ title: 'Missing recipients', message: 'Please add at least one recipient.' });
            setShowToast(true);
            return;
        }
        if (!mailContent.subject.trim()) {
            setToastData({ title: 'Missing subject', message: 'Please add a subject before sending.' });
            setShowToast(true);
            return;
        }
        if (!mailContent.body.trim()) {
            setToastData({ title: 'Missing body', message: 'Please add a body before sending.' });
            setShowToast(true);
            return;
        }

        const parseList = (s: string): string[] =>
            s.split(/[,;]\s*/).map(x => x.trim()).filter(Boolean);
        const ccList = parseList(ccVal);

        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('imo', imo);
            formData.append('vesselName', vesselName || '');
            formData.append('subject', mailContent.subject);
            formData.append('body', mailContent.body);
            formData.append('suspectedItems', JSON.stringify(suspectedItems));

            toChips.forEach((toEmail) => formData.append('to[]', toEmail));
            ccList.forEach((ccEmail) => formData.append('cc[]', ccEmail));
            attachedFiles.forEach((file) => formData.append('attachments', file));

            // SMTP through Gmail can take 5-10s per recipient, and the
            // backend splits per-vendor — one mail per vendor + an orphan
            // batch. Allow up to 2 minutes before giving up so a clean send
            // through 5+ recipients doesn't trip the default 15s timeout.
            await api.upload(
                ENDPOINTS.AUDITS.CLARIFICATION_EMAIL,
                formData,
                { timeout: 120_000 },
            );

            // Do NOT strip suspected rows from audit_line_items after sending.
            // They need to stay so the PO viewer can show them in Suspected
            // Items / Request Pending / Received MDS filters. Their clarification
            // state is tracked separately via clarification_items and joined by
            // PO number on the backend.

            setToastData({
                title: 'Mail Sent Successfully',
                message: `Clarification request has been sent to ${toChips.join(', ')}. The audit has moved out of Pending Reviews.`
            });
            setShowToast(true);
            setShowMailModal(false);

            // The backend transitions the audit from Pending Review → In Progress
            // when the email succeeds, so calling onComplete reloads the parent
            // list and the row drops off the Pending Reviews registry.
            setTimeout(() => { onComplete(); }, 1500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setToastData({
                title: 'Mail failed to send',
                message: msg,
            });
            setShowToast(true);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="review-wizard-overlay" onMouseUp={handleMouseUp} onMouseLeave={() => isDragging.current = false}>
            <div className="wizard-header">
                <div className={`step - item ${step >= 1 ? 'active' : ''} `} style={{ justifySelf: 'start' }}>
                    <div className="step-number">1</div>
                    <span>Adjust Data or Suppliers</span>
                </div>
                <div className={`step - item ${step >= 2 ? 'active' : ''} `} style={{ justifySelf: 'center' }}>
                    <div className="step-number">2</div>
                    <span>Supplier Product Creation</span>
                </div>
                <div className={`step - item ${step >= 3 ? 'active' : ''} `} style={{ justifySelf: 'end' }}>
                    <div className="step-number">3</div>
                    <span>Finish</span>
                </div>
            </div>

            <div className="wizard-content">
                {step === 1 && (
                    <>
                        <div className="wizard-title-row">
                            <h1>Review & Audit Purchase Orders</h1>
                            <p>{vesselName} &bull; {imo}</p>
                        </div>
                        <div className="toolbar-container">
                            <div className="col-toggles">
                                {data[0]?.map((col, idx) => (
                                    <label key={idx} className="col-toggle">
                                        <input type="checkbox" checked={visibleCols[idx]} onChange={() => {
                                            const next = [...visibleCols]; next[idx] = !next[idx]; setVisibleCols(next);
                                        }} />
                                        {col}
                                    </label>
                                ))}
                            </div>
                            <div className="bulk-actions">
                                {dragStart && dragEnd && (dragStart.r !== dragEnd.r || dragStart.c !== dragEnd.c) ? (
                                    <>
                                        <button className="bulk-btn delete" onClick={handleClearSelectionData}>
                                            <Trash2 size={12} /> Clear Selected Cells
                                        </button>
                                        <button className="bulk-btn delete" style={{ background: '#FEE2E2', color: '#B91C1C' }} onClick={handleDeleteSelectionRows}>
                                            <Trash2 size={12} /> Delete Rows In Range
                                        </button>
                                        <button className="bulk-btn accept" onClick={handleDragFill}>
                                            Fill Selection
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {selectedRows.size > 0 ? (
                                            <button className="bulk-btn delete" onClick={handleDeleteSelected}>
                                                <Trash2 size={12} /> Delete Selected ({selectedRows.size})
                                            </button>
                                        ) : (
                                            Object.keys(filters).length > 0 && filteredRows.length > 0 && (
                                                <button className="bulk-btn delete" onClick={handleDeleteFiltered}>
                                                    <Trash2 size={12} /> Delete Filtered ({filteredRows.length})
                                                </button>
                                            )
                                        )}

                                        <button className="bulk-btn accept" onClick={handleBulkAccept}>
                                            {selectedRows.size > 0 ? 'Accept Selected' : 'Bulk Accept'}
                                        </button>
                                        <button className="bulk-btn reject" onClick={handleBulkReject}>
                                            {selectedRows.size > 0 ? 'Reject Selected' : 'Bulk Reject'}
                                        </button>

                                        {data.length > 1 && !Object.keys(filters).length && !selectedRows.size && (
                                            <button className="bulk-btn delete" style={{ background: '#FFF7ED', color: '#EA580C', borderColor: '#FED7AA' }} onClick={handleClearAll}>
                                                <Trash2 size={12} /> Clear All
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="main-layout">
                            <div className="table-section">
                                <table className="wizard-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, minWidth: 40, padding: '13px 8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        className="col-toggle-input"
                                                        style={{ width: 14, height: 14, cursor: 'pointer' }}
                                                        checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                                                        onChange={toggleAll}
                                                    />
                                                </div>
                                            </th>
                                            {data[0]?.map((col, idx) => visibleCols[idx] && (
                                                <th key={idx} style={{ width: columnWidths[idx] }}>
                                                    <div className="header-content">
                                                        <span>{col}</span>
                                                        <button className="filter-trigger" onClick={() => setActiveMenu(activeMenu === idx ? null : idx)}>
                                                            <ChevronDown size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="resizer" onMouseDown={e => handleResizeStart(e, idx)} />
                                                    {activeMenu === idx && (
                                                        <div className="column-menu">
                                                            <div className="menu-item" onClick={() => {
                                                                const next = [...visibleCols]; next[idx] = false; setVisibleCols(next); setActiveMenu(null);
                                                            }}>Hide Column</div>
                                                            <div className="menu-divider" />
                                                            <div className="menu-item" onClick={() => insertColumn(idx, 'left')}>Insert Left</div>
                                                            <div className="menu-item" onClick={() => insertColumn(idx, 'right')}>Insert Right</div>
                                                            <div className="menu-divider" />
                                                            <div className="menu-filter-section">
                                                                <input className="menu-search-input" placeholder="Filter..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
                                                                <div className="menu-value-list">
                                                                    {(() => {
                                                                        const allValues = Array.from(new Set(data.slice(1).map(r =>
                                                                            String(r[idx] || '').trim()
                                                                        ))).filter(v => v !== '');

                                                                        return allValues
                                                                            .filter(v => v.toLowerCase().includes(filterSearch.toLowerCase()))
                                                                            .sort((a, b) => a.localeCompare(b))
                                                                            .map((val, vi) => (
                                                                                <label key={vi} className="menu-value-item">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={filters[idx]?.includes(val) || false}
                                                                                        onChange={() => {
                                                                                            const current = filters[idx] || [];
                                                                                            const next = current.includes(val)
                                                                                                ? current.filter(v => v !== val)
                                                                                                : [...current, val];
                                                                                            setFilters({ ...filters, [idx]: next });
                                                                                        }}
                                                                                    />
                                                                                    {val}
                                                                                </label>
                                                                            ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.map(({ row, originalIdx }: any) => (
                                            <tr key={originalIdx} className={selectedRows.has(originalIdx) ? 'row-selected' : ''}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRows.has(originalIdx)}
                                                        onChange={() => toggleRowSelection(originalIdx)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                {(row as any[]).map((cell: any, ci: number) => visibleCols[ci] && (
                                                    <td key={ci} onMouseDown={() => handleMouseDown(originalIdx, ci)} onMouseEnter={() => handleMouseEnter(originalIdx, ci)} onDoubleClick={() => handleCellDoubleClick(originalIdx, ci)}>
                                                        <div className={`cell-inner ${getSelectionClass(originalIdx, ci)}`}>
                                                            {editingCell?.r === originalIdx && editingCell?.c === ci ? (
                                                                <input className="cell-input" autoFocus value={cell} onChange={e => {
                                                                    const nd = [...data]; nd[originalIdx][ci] = e.target.value; setData(nd);
                                                                }} onBlur={() => setEditingCell(null)} onKeyDown={e => handleKeyDown(e, originalIdx, ci)} />
                                                            ) : (
                                                                data[0][ci] === 'Is Suspected' ? (
                                                                    <select className={`suspicious-select ${cell === 'Yes' ? 'is-yes' : 'is-no'}`} value={cell} onChange={e => {
                                                                        const newValue = e.target.value;
                                                                        pushToHistory();
                                                                        const nd = JSON.parse(JSON.stringify(data));

                                                                        // If there's a drag selection spanning multiple cells in this column, apply to all
                                                                        if (dragStart && dragEnd) {
                                                                            const startR = Math.min(dragStart.r, dragEnd.r);
                                                                            const endR = Math.max(dragStart.r, dragEnd.r);
                                                                            const startC = Math.min(dragStart.c, dragEnd.c);
                                                                            const endC = Math.max(dragStart.c, dragEnd.c);
                                                                            const visibleIndices = new Set(filteredRows.map((f: any) => f.originalIdx));
                                                                            const cellInSelection = originalIdx >= startR && originalIdx <= endR && ci >= startC && ci <= endC;
                                                                            if (cellInSelection && ci >= startC && ci <= endC) {
                                                                                for (let r = startR; r <= endR; r++) {
                                                                                    if (!visibleIndices.has(r)) continue;
                                                                                    nd[r][ci] = newValue;
                                                                                }
                                                                                setData(nd);
                                                                                return;
                                                                            }
                                                                        }

                                                                        // If row-level checkboxes selected (multiple rows), apply to all selected rows in this column
                                                                        if (selectedRows.size > 1 && selectedRows.has(originalIdx)) {
                                                                            selectedRows.forEach(rowIdx => { nd[rowIdx][ci] = newValue; });
                                                                            setData(nd);
                                                                            return;
                                                                        }

                                                                        // Default: change only this cell
                                                                        nd[originalIdx][ci] = newValue;
                                                                        setData(nd);
                                                                    }}>
                                                                        <option value="No">No</option>
                                                                        <option value="Yes">Yes</option>
                                                                    </select>
                                                                ) : cell
                                                            )}
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="summary-sidebar">
                                <div className="summary-header">Review Summary</div>
                                <div className="summary-body">
                                    <div className="summary-group">
                                        <h4>Suspected Items ({data.slice(1).filter(r => r[data[0]?.indexOf('Is Suspected')] === 'Yes').length})</h4>
                                        <div className="summary-list">
                                            {data.slice(1).filter(r => r[data[0]?.indexOf('Is Suspected')] === 'Yes').map((r, i) => (
                                                <div key={i} className="summary-list-item">
                                                    <div className="dot danger" />
                                                    <span className="item-name">{r[data[0]?.indexOf('Item Description')]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="summary-group">
                                        <h4>Verified Suppliers</h4>
                                        <div className="summary-list">
                                            {Array.from(new Set(data.slice(1).map(r => r[data[0]?.indexOf('Vendor Name')]))).map((v, i) => (
                                                <div key={i} className="summary-list-item">
                                                    <div className="dot" style={{ background: '#10B981' }} />
                                                    <span>{String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h1>Supplier & Product Mapping</h1>
                        <p>This automated phase verifies and creates entries in the global materials library.</p>
                        <div style={{ marginTop: '40px', padding: '20px', background: '#F0F9FF', borderRadius: '12px', display: 'inline-block' }}>
                            <p style={{ fontWeight: 700, color: '#0369A1' }}>{data.length - 1} Items ready for validation</p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h1>Final Review & Confirmation</h1>
                        <p>Please double check the mappings before moving to the audit registry.</p>
                        <button className="footer-btn next" style={{ marginTop: '20px' }} onClick={handleFinalize}>Finalize Review</button>
                    </div>
                )}
            </div>

            {showMailModal && (
                <div className="gmail-overlay">
                    <div className="gmail-compose">
                        {/* Header */}
                        <div className="gmail-header">
                            <span className="gmail-title">New Message</span>
                            <div className="gmail-header-actions">
                                <Minus size={18} />
                                <Maximize2 size={16} />
                                <X size={20} className="close-icon" onClick={() => setShowMailModal(false)} />
                            </div>
                        </div>

                        {/* To - Gmail chip-style recipient row */}
                        <div className="gmail-row gmail-to-row" onClick={() => toInputRef.current?.focus()}>
                            <span className="gmail-label">To</span>
                            <div className="gmail-chips-area">
                                {toChips.map((chip, i) => (
                                    <span key={i} className="recipient-chip">
                                        <span
                                            className="recipient-avatar"
                                            style={{ background: getChipColor(chip) }}
                                        >
                                            {chip[0].toUpperCase()}
                                        </span>
                                        <span className="recipient-label">{chip}</span>
                                        <button
                                            className="recipient-remove"
                                            onClick={e => { e.stopPropagation(); setToChips(prev => prev.filter((_, fi) => fi !== i)); }}
                                        ><X size={12} /></button>
                                    </span>
                                ))}
                                <input
                                    ref={toInputRef}
                                    className="gmail-input chips-input"
                                    value={toInputVal}
                                    placeholder={toChips.length === 0 ? 'Recipients' : ''}
                                    onChange={e => setToInputVal(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            addChip(toInputVal);
                                        } else if (e.key === 'Backspace' && toInputVal === '' && toChips.length > 0) {
                                            setToChips(prev => prev.slice(0, -1));
                                        }
                                    }}
                                    onBlur={() => { if (toInputVal.trim()) addChip(toInputVal); }}
                                />
                            </div>
                            <div className="gmail-cc-bcc-btns">
                                {!showCc && <button className="cc-bcc-btn" onClick={e => { e.stopPropagation(); setShowCc(true); }}>Cc</button>}
                                {!showBcc && <button className="cc-bcc-btn" onClick={e => { e.stopPropagation(); setShowBcc(true); }}>Bcc</button>}
                            </div>
                        </div>

                        {/* Cc */}
                        {showCc && (
                            <div className="gmail-row">
                                <span className="gmail-label">Cc</span>
                                <input className="gmail-input" value={ccVal} onChange={e => setCcVal(e.target.value)} placeholder="" />
                            </div>
                        )}

                        {/* Bcc */}
                        {showBcc && (
                            <div className="gmail-row">
                                <span className="gmail-label">Bcc</span>
                                <input className="gmail-input" value={bccVal} onChange={e => setBccVal(e.target.value)} placeholder="" />
                            </div>
                        )}

                        {/* Subject with label */}
                        <div className="gmail-row">
                            <span className="gmail-label">Subject</span>
                            <input className="gmail-input" value={mailContent.subject} onChange={e => setMailContent({ ...mailContent, subject: e.target.value })} />
                        </div>

                        {/* Body */}
                        <div className="gmail-body">
                            <textarea className="gmail-content" autoFocus value={mailContent.body} onChange={e => setMailContent({ ...mailContent, body: e.target.value })} />

                            {/* Attached files chips */}
                            {attachedFiles.length > 0 && (
                                <div className="gmail-attachments">
                                    {attachedFiles.map((file, i) => (
                                        <div key={i} className="attach-chip">
                                            <Paperclip size={13} />
                                            <span>{file.name}</span>
                                            <button className="chip-remove" onClick={() => setAttachedFiles(prev => prev.filter((_, fi) => fi !== i))}><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Upload CTA */}
                            <div className="gmail-upload-cta">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        if (e.target.files) {
                                            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                        }
                                    }}
                                />
                                <button className="upload-cta-btn" onClick={() => fileInputRef.current?.click()}>
                                    <FileUp size={16} />
                                    Attach Supporting Documents
                                </button>
                                <span className="upload-hint">MD / SDoC / Certificates</span>
                            </div>
                        </div>

                        {/* Footer toolbar */}
                        <div className="gmail-footer">
                            <div className="footer-left">
                                <button
                                    className="gmail-send-btn"
                                    onClick={handleSendMail}
                                    disabled={isSending}
                                    style={{
                                        opacity: isSending ? 0.7 : 1,
                                        cursor: isSending ? 'wait' : 'pointer',
                                    }}
                                >
                                    {isSending ? (
                                        <Loader2 size={15} style={{ marginRight: 6 }} className="rw-spin" />
                                    ) : (
                                        <Send size={15} style={{ marginRight: 6 }} />
                                    )}
                                    {isSending ? 'Sending…' : 'Send'}
                                </button>
                                <button
                                    className="gmail-skip-finalize-btn"
                                    onClick={async () => {
                                        if (isSending) return;
                                        setIsSending(true);
                                        try {
                                            if (auditId) {
                                                await api.patch(`/audits/reviews/${auditId}/complete`, {});
                                            }
                                            setToastData({
                                                title: 'Review Finalized',
                                                message: 'The review was finalized and marked Completed without sending clarification email.'
                                            });
                                            setShowToast(true);
                                            setShowMailModal(false);
                                            setTimeout(() => { onComplete(); }, 1500);
                                        } catch (err) {
                                            const msg = err instanceof Error ? err.message : 'Unknown error';
                                            setToastData({
                                                title: 'Failed to complete review',
                                                message: msg
                                            });
                                            setShowToast(true);
                                        } finally {
                                            setIsSending(false);
                                        }
                                    }}
                                    disabled={isSending}
                                    style={{
                                        background: '#F1F5F9',
                                        color: '#475569',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '8px',
                                        padding: '0 16px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        height: '36px',
                                        marginLeft: '10px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#E2E8F0')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                                >
                                    Skip & Finalize
                                </button>
                                <div className="gmail-tool-icons">
                                    <span className="tool-icon-btn"><Type size={22} /></span>
                                    <span className="tool-icon-btn" onClick={() => fileInputRef.current?.click()}><Paperclip size={22} /></span>
                                    <span className="tool-icon-btn"><LinkIcon size={22} /></span>
                                    <span className="tool-icon-btn"><Smile size={22} /></span>
                                    <span className="tool-icon-btn"><Image size={22} /></span>
                                    <span className="tool-icon-btn"><Mail size={22} /></span>
                                </div>
                            </div>
                            <div className="footer-right">
                                <span className="tool-icon-btn trash-icon" onClick={() => setShowMailModal(false)}><Trash2 size={22} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="wizard-footer">
                <div className="footer-stats">
                    <span>Total Line Items: <strong>{data.length - 1}</strong></span>
                    <span>Verified: <strong>{filteredRows.length}/{data.length - 1}</strong></span>
                </div>
                <div className="footer-btns">
                    <button className="footer-btn discard" onClick={onClose}>Discard Changes</button>
                    <button className="footer-btn next" onClick={nextStep}>{step === 3 ? 'FINALIZE REVIEW' : 'NEXT STEP'}</button>
                </div>
            </div>
            {/* Design-Accurate Notification Toast */}
            {showToast && (
                <div className="audit-success-toast">
                    <div className="toast-content-wrapper">
                        <div className="toast-icon-green">
                            <CheckCircle2 size={24} fill="#10B981" color="white" />
                        </div>
                        <div className="toast-text-area">
                            <h3>{toastData.title}</h3>
                            <p>{toastData.message}</p>
                        </div>
                    </div>
                    <button className="undo-action-btn" onClick={() => setShowToast(false)}>UNDO</button>
                </div>
            )}
        </div>
    );
};

export default ReviewWizard;
