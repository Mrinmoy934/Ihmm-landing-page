import { useState, useEffect, useCallback } from 'react';
import './PendingAudits.css';
// Reuse the Pending Reviews registry layout (registry-header,
// registry-table-card, header-actions, search-wrapper, export-btn,
// table-footer) so both administration pages share one compact pattern
// instead of the audits page using a wider, looser top-bar shape.
import './PendingReviews.css';
import './AuditEditor.css';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { Search, Download, Edit2, Send, Trash2, X, CheckCircle2, XCircle } from 'lucide-react';

import type { AuditSummary } from '../../types';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';

// Canonical indices in the 20-column line-items layout the backend stores.
const COL = {
    NAME: 0, VESSEL_NAME: 1, PO_NUMBER: 2, IMO_NUMBER: 3,
    PO_SENT_DATE: 4, MD_REQUESTED_DATE: 5, ITEM_DESCRIPTION: 6, IS_SUSPECTED: 7,
    IMPA_CODE: 8, ISSA_CODE: 9, EQUIPMENT_CODE: 10, EQUIPMENT_NAME: 11,
    MAKER: 12, MODEL: 13, PART_NUMBER: 14, UNIT: 15, QUANTITY: 16,
    VENDOR_REMARK: 17, VENDOR_EMAIL: 18, VENDOR_NAME: 19,
};

function auditFromApi(a: Record<string, unknown>): AuditSummary {
    return {
        id: a.id as string | undefined,
        vesselName: String(a.vesselName ?? ''),
        imoNumber: String(a.imoNumber ?? ''),
        totalPO: Number(a.totalPO ?? 0),
        totalItems: Number(a.totalItems ?? 0),
        duplicatePO: Number(a.duplicatePO ?? 0),
        duplicateSupplierCode: Number(a.duplicateSupplierCode ?? 0),
        duplicateProduct: Number(a.duplicateProduct ?? 0),
        createDate: typeof a.createdAt === 'string' ? a.createdAt.split('T')[0] : '',
        status: a.status as AuditSummary['status'],
    };
}

interface AuditEditorProps {
    imo: string;
    vesselName: string;
    onClose: () => void;
    onSave: (newSummary: Partial<AuditSummary>) => void;
}

const AuditEditorOverlay = ({ imo, vesselName, onClose, onSave }: AuditEditorProps) => {
    const [data, setData] = useState<any[][]>([]);
    const [visibleColumns, setVisibleColumns] = useState<boolean[]>([]);
    const [poColIdx, setPoColIdx] = useState<number | null>(null);
    const [itemDescColIdx, setItemDescColIdx] = useState<number | null>(null);
    const [qtyColIdx, setQtyColIdx] = useState<number | null>(null);
    const [supplierColIdx, setSupplierColIdx] = useState<number | null>(null);
    const [sentDateColIdx, setSentDateColIdx] = useState<number | null>(null);
    const [impaColIdx, setImpaColIdx] = useState<number | null>(null);
    const [unitColIdx, setUnitColIdx] = useState<number | null>(null);
    const [rowActions, setRowActions] = useState<Record<number, string>>({});
    const [currentDupGroupIdx, setCurrentDupGroupIdx] = useState(0);
    const [, setHistory] = useState<{ data: any[][]; actions: Record<number, string> }[]>([]);

    useEffect(() => {
        if (!imo) return;
        api.get<{ success: boolean; data: { header: string[]; rows: unknown[][] } }>(ENDPOINTS.AUDITS.LINE_ITEMS(imo))
            .then((res) => {
                const header = res.data.header || [];
                const rows = res.data.rows || [];
                const full = [header, ...rows];
                setData(full);

                // Standard 20-column layout — map by index constants.
                setPoColIdx(COL.PO_NUMBER);
                setItemDescColIdx(COL.ITEM_DESCRIPTION);
                setQtyColIdx(COL.QUANTITY);
                setSupplierColIdx(COL.VENDOR_NAME);
                setSentDateColIdx(COL.PO_SENT_DATE);
                setImpaColIdx(COL.IMPA_CODE);
                setUnitColIdx(COL.UNIT);

                // Column visibility is a UI-only preference, keep it in localStorage.
                const savedVisibility = localStorage.getItem(`audit_visible_cols_${imo}`);
                if (savedVisibility) {
                    const parsedVis = JSON.parse(savedVisibility);
                    if (parsedVis.length === header.length) {
                        setVisibleColumns(parsedVis);
                        return;
                    }
                }
                setVisibleColumns(new Array(header.length).fill(true));
            })
            .catch(() => {
                setData([]);
                setVisibleColumns([]);
            });
    }, [imo]);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStartValue, setDragStartValue] = useState('');
    const [dragStartCi, setDragStartCi] = useState<number | null>(null);

    // Robust Undo Logic
    const performUndo = useCallback(() => {
        setHistory(prevHistory => {
            if (prevHistory.length === 0) return prevHistory;
            const lastState = prevHistory[prevHistory.length - 1];
            setData(lastState.data);
            setRowActions(lastState.actions);
            return prevHistory.slice(0, -1);
        });
    }, []);

    // Global Key Listener for Ctrl+Z
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                performUndo();
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [performUndo]);

    // Handle Global Mouse Up for Dragging
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setDragStartCi(null);
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isDragging]);

    const duplicateGroups = (() => {
        if (poColIdx === null || data.length <= 1) return [];
        const counts: Record<string, number[]> = {};
        data.slice(1).forEach((row, idx) => {
            const originalIdx = idx + 1;
            const action = rowActions[originalIdx];
            if (action === 'D' || action === 'R') return;

            const po = String(row[poColIdx!] || '').trim();
            if (!po) return;

            const itemDesc = itemDescColIdx !== null ? String(row[itemDescColIdx] || '').trim().toLowerCase() : '';
            // Normalize Quantity
            const rawQty = qtyColIdx !== null ? String(row[qtyColIdx] || '').replace(/[^0-9.-]+/g, '') : '';
            const qtyStr = rawQty ? parseFloat(rawQty).toString() : '';
            const supplier = supplierColIdx !== null ? String(row[supplierColIdx] || '').trim().toLowerCase() : '';
            const poSentDate = sentDateColIdx !== null ? String(row[sentDateColIdx] || '').trim() : '';
            const impaCode = impaColIdx !== null ? String(row[impaColIdx] || '').trim() : '';
            const unit = unitColIdx !== null ? String(row[unitColIdx] || '').trim().toLowerCase() : '';

            const key = `${po}|${itemDesc}|${qtyStr}|${supplier}|${poSentDate}|${impaCode}|${unit}`;

            if (!counts[key]) counts[key] = [];
            counts[key].push(originalIdx);
        });

        return Object.values(counts)
            .filter(indices => indices.length > 1)
            .map(indices => indices.map(i => ({ row: data[i], originalIdx: i })));
    })();

    const pushToHistory = useCallback(() => {
        setHistory(prev => {
            const snapshot = {
                data: JSON.parse(JSON.stringify(data)),
                actions: { ...rowActions }
            };
            return [...prev.slice(-49), snapshot];
        });
    }, [data, rowActions]);

    const handleUpdateCell = (originalIdx: number, ci: number, val: string) => {
        setData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData));
            newData[originalIdx][ci] = val;
            return newData;
        });
    };

    // --- Drag-to-Fill Logic ---
    const handleCellMouseDown = (val: string, ci: number) => {
        pushToHistory();
        setIsDragging(true);
        setDragStartValue(val);
        setDragStartCi(ci);
    };

    const handleCellMouseEnter = (originalIdx: number, ci: number) => {
        if (isDragging && dragStartCi === ci) {
            setData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                newData[originalIdx][ci] = dragStartValue;
                return newData;
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, ri: number, ci: number) => {
        if ((e.ctrlKey || e.metaKey) && ['v', 'c', 'a', 'V', 'C', 'A'].includes(e.key)) {
            return;
        }

        const rowCount = currentGroup.length;
        const colIndices = visibleColumns.map((v, i) => v ? i : -1).filter(v => v !== -1);
        const colPos = colIndices.indexOf(ci);

        let nextRi = ri;
        let nextCiPos = colPos;

        if (e.key === 'ArrowDown') {
            nextRi = Math.min(ri + 1, rowCount - 1);
        } else if (e.key === 'ArrowUp') {
            nextRi = Math.max(ri - 1, 0);
        } else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionEnd === (e.target as HTMLInputElement).value.length) {
            nextCiPos = Math.min(colPos + 1, colIndices.length - 1);
        } else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) {
            nextCiPos = Math.max(colPos - 1, 0);
        } else if (e.key === 'Enter') {
            nextRi = Math.min(ri + 1, rowCount - 1);
        } else if (e.key === 'Tab') {
            if (e.shiftKey) {
                nextCiPos = Math.max(colPos - 1, 0);
            } else {
                nextCiPos = Math.min(colPos + 1, colIndices.length - 1);
            }
        } else {
            return;
        }

        if (nextRi !== ri || nextCiPos !== colPos) {
            e.preventDefault();
            const nextCi = colIndices[nextCiPos];
            const nextInput = document.querySelector(`input[data-ri="${nextRi}"][data-ci="${nextCi}"]`) as HTMLInputElement;
            if (nextInput) {
                nextInput.focus();
                setTimeout(() => nextInput.select(), 0);
            }
        }
    };

    const setRowAction = (originalIdx: number, action: string) => {
        pushToHistory();
        setRowActions(prev => ({ ...prev, [originalIdx]: action }));
    };

    const applyActionToGroup = (action: string) => {
        const group = duplicateGroups[currentDupGroupIdx];
        if (!group) return;

        pushToHistory();
        setRowActions(prevActions => {
            const updates = { ...prevActions };
            if (action === 'DI') {
                group.forEach((item, idx) => {
                    updates[item.originalIdx] = idx === 0 ? 'DI' : 'D';
                });
                if (currentDupGroupIdx >= duplicateGroups.length - 1 && currentDupGroupIdx > 0) {
                    setCurrentDupGroupIdx(p => p - 1);
                }
            } else {
                group.forEach(item => {
                    updates[item.originalIdx] = action;
                });
            }
            return updates;
        });
    };

    const handleSave = async () => {
        // Filter out rows marked as D (Delete) or R (Reject)
        const filteredData = [data[0], ...data.slice(1).filter((_, i) => {
            const status = rowActions[i + 1];
            return status !== 'D' && status !== 'R';
        })];

        // Column visibility is a UI preference — still local.
        localStorage.setItem(`audit_visible_cols_${imo}`, JSON.stringify(visibleColumns));

        // Persist the edited rows to the backend (bulk replace).
        try {
            await api.patch(ENDPOINTS.AUDITS.LINE_ITEMS(imo), { rows: filteredData.slice(1) });
        } catch (err) {
            console.error('Failed to save line items:', err);
            // Still close the editor; list will re-fetch from backend.
        }

        // Recalculate summary
        let poD = 0;
        let totalPO = 0;
        if (poColIdx !== null && filteredData.length > 1) {
            const pos = filteredData.slice(1).map(r => String(r[poColIdx] || '').trim()).filter(p => p !== '');
            totalPO = new Set(pos).size;

            const counts: Record<string, number> = {};
            filteredData.slice(1).forEach(r => {
                const po = String(r[poColIdx] || '').trim();

                if (po) {
                    const itemDesc = itemDescColIdx !== null ? String(r[itemDescColIdx] || '').trim().toLowerCase() : '';
                    const rawQty = qtyColIdx !== null ? String(r[qtyColIdx] || '').replace(/[^0-9.-]+/g, '') : '';
                    const qtyStr = rawQty ? parseFloat(rawQty).toString() : '';
                    const supplier = supplierColIdx !== null ? String(r[supplierColIdx] || '').trim().toLowerCase() : '';
                    const poSentDate = sentDateColIdx !== null ? String(r[sentDateColIdx] || '').trim() : '';
                    const impaCode = impaColIdx !== null ? String(r[impaColIdx] || '').trim() : '';
                    const unit = unitColIdx !== null ? String(r[unitColIdx] || '').trim().toLowerCase() : '';

                    const key = `${po}|${itemDesc}|${qtyStr}|${supplier}|${poSentDate}|${impaCode}|${unit}`;
                    counts[key] = (counts[key] || 0) + 1;
                }
            });
            poD = Object.values(counts).filter(c => c > 1).length;
        }

        onSave({
            totalPO,
            duplicatePO: poD,
            totalItems: filteredData.length - 1
        });
        onClose();
    };

    if (data.length === 0) return null;

    if (duplicateGroups.length === 0) {
        return (
            <div className="audit-editor-overlay" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="audit-editor-modal" style={{ height: 'auto', width: 'auto', padding: '60px', alignItems: 'center', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                    <div style={{ padding: '24px', background: '#ecfdf5', borderRadius: '50%', color: '#10b981', marginBottom: '16px' }}>
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800, color: '#0F172A', textAlign: 'center' }}>All Clear!</h2>
                    <p style={{ margin: '0 0 32px 0', color: '#64748B', textAlign: 'center', fontSize: '15px', maxWidth: '320px', lineHeight: 1.6 }}>
                        No duplicate purchase orders or conflicts were found in this file.
                    </p>
                    <button className="v3-dup-btn save-close" onClick={handleSave} style={{ margin: '0 auto' }}>
                        Close & Update Registry
                    </button>
                </div>
            </div>
        );
    }

    const currentGroup = duplicateGroups[currentDupGroupIdx] || [];

    return (
        <div className="audit-editor-overlay">
            <div className="audit-editor-modal">
                {/* Header */}
                <div className="editor-header">
                    <div className="editor-header-left">
                        <h2>Audit Editor</h2>
                        <p>{vesselName} &bull; {imo}</p>
                    </div>
                    <button className="close-editor-btn" onClick={onClose} title="Close Editor">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="v3-dup-toolbar">
                    <div className="v3-dup-columns">
                        <label>Visible Columns</label>
                        <div className="v3-dup-checkboxes">
                            {data[0]?.map((col, i) => {
                                // Skip internal columns in the editor view (first 8 columns)
                                if (i < 8) return null;
                                return (
                                    <label key={i}>
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns[i]}
                                            onChange={() => {
                                                const next = [...visibleColumns];
                                                next[i] = !next[i];
                                                setVisibleColumns(next);
                                            }}
                                        />
                                        {String(col || `Field ${i + 1}`)}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="v3-dup-nav">
                        <button
                            className="v3-dup-nav-btn"
                            onClick={() => setCurrentDupGroupIdx(p => Math.max(0, p - 1))}
                            disabled={currentDupGroupIdx === 0}
                        >
                            Previous Conflict
                        </button>
                        <span className="v3-dup-count">
                            {currentDupGroupIdx + 1} / {duplicateGroups.length}
                        </span>
                        <button
                            className="v3-dup-nav-btn"
                            onClick={() => setCurrentDupGroupIdx(p => Math.min(duplicateGroups.length - 1, p + 1))}
                            disabled={currentDupGroupIdx === duplicateGroups.length - 1}
                        >
                            Next Conflict
                        </button>
                    </div>
                </div>

                {/* Subtitle */}
                <div className="v3-dup-subtitle">
                    DETECTED DUPLICATES FOR PO #{String(currentGroup[0]?.row[poColIdx!] || 'UNKNOWN')}
                </div>

                {/* Table */}
                <div className="editor-table-container">
                    <table className="editor-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '280px' }}>Resolution Action</th>
                                {data[0].map((col, i) => {
                                    if (i < 8) return null;
                                    return visibleColumns[i] && (
                                        <th key={`header_${i}`}>{String(col)}</th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {currentGroup.map(({ row, originalIdx }, ri) => (
                                <tr key={originalIdx}>
                                    <td>
                                        <div className="v3-action-chips">
                                            {[
                                                { code: 'U', label: 'U' },
                                                { code: 'A', label: 'A' },
                                                { code: 'DI', label: 'D&I' },
                                                { code: 'D', label: 'D' },
                                                { code: 'R', label: 'R' },
                                                { code: 'H', label: 'H' }
                                            ].map(chip => (
                                                <div
                                                    key={chip.code}
                                                    className={`chip ${rowActions[originalIdx] === chip.code ? `active-${chip.code.toLowerCase()}` : ''}`}
                                                    onClick={() => setRowAction(originalIdx, chip.code)}
                                                    title={chip.label}
                                                >
                                                    {chip.code}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    {row.map((cell: any, ci: number) => {
                                        if (ci < 8) return null;
                                        return visibleColumns[ci] && (
                                            <td key={ci}>
                                                {String(data[0][ci]) === 'Is Suspected' ? (
                                                    <select
                                                        className="suspicious-select"
                                                        value={String(cell || 'No')}
                                                        onChange={(e) => handleUpdateCell(originalIdx, ci, e.target.value)}
                                                        onFocus={() => pushToHistory()}
                                                    >
                                                        <option value="No">No</option>
                                                        <option value="Yes">Yes</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        className={`v3-dup-table-input ${isDragging && dragStartCi === ci ? 'is-dragging-cell' : ''}`}
                                                        value={String(cell || '')}
                                                        onChange={(e) => handleUpdateCell(originalIdx, ci, e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                                                        onMouseDown={() => handleCellMouseDown(String(cell || ''), ci)}
                                                        onMouseEnter={() => handleCellMouseEnter(originalIdx, ci)}
                                                        onFocus={() => pushToHistory()}
                                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                                        data-ri={ri}
                                                        data-ci={ci}
                                                        title={String(cell || '')}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="v3-dup-footer">
                    <div className="v3-dup-footer-left">
                        <button className="v3-dup-btn" onClick={() => applyActionToGroup('U')}>Update All (U)</button>
                        <button className="v3-dup-btn" onClick={() => applyActionToGroup('DI')}>Delete & Insert (D&I)</button>
                        <button className="v3-dup-btn reject" onClick={() => applyActionToGroup('R')}>Reject All (R)</button>
                        <button className="v3-dup-btn" onClick={() => applyActionToGroup('H')}>Hold All (H)</button>
                    </div>
                    <button className="v3-dup-btn save-close" onClick={handleSave}>
                        SAVE CHANGES & EXIT
                    </button>
                </div>
            </div>
        </div>
    );

};

export default function PendingAudits() {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;
    const [allRecords, setAllRecords] = useState<AuditSummary[]>([]);


    const loadRecords = useCallback(() => {
        // Backend already filters by status — returns audits with status
        // 'In Progress' / 'Pending', excluding those sent for review.
        api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(ENDPOINTS.AUDITS.PENDING)
            .then((res) => {
                const audits = (res.data || []).map(auditFromApi);
                setAllRecords(audits);
            })
            .catch((err) => {
                console.error('Failed to load pending audits:', err);
                setAllRecords([]);
            });
    }, []);

    useEffect(() => {
        loadRecords();
        // Re-read whenever the tab becomes visible again (e.g. after navigating from UploadPO)
        const handleVisibility = () => { if (document.visibilityState === 'visible') loadRecords(); };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', loadRecords);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', loadRecords);
        };
    }, [loadRecords]);

    // Filtering
    const filteredRecords = allRecords.filter(r =>
        r.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.imoNumber.includes(searchQuery)
    );

    // Sort newest first by create date — matches the Pending Reviews
    // page (which doesn't expose a sort dropdown either).
    const sortedRecords = [...filteredRecords].sort((a, b) =>
        b.createDate.localeCompare(a.createDate),
    );

    // Pagination Logic
    const totalPages = Math.ceil(sortedRecords.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const currentRecords = sortedRecords.slice(startIndex, startIndex + recordsPerPage);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedVessel, setSelectedVessel] = useState<AuditSummary | null>(null);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [showDuplicateToast, setShowDuplicateToast] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState<AuditSummary | null>(null);
    const [editingVessel, setEditingVessel] = useState<AuditSummary | null>(null);

    const handleEdit = (imoNumber: string) => {
        const record = allRecords.find(r => r.imoNumber === imoNumber);
        if (record) setEditingVessel(record);
    };

    const handleSend = (imoNumber: string) => {
        const record = allRecords.find(r => r.imoNumber === imoNumber);
        if (!record) return;

        // Check for duplicates
        if ((record.duplicatePO ?? 0) > 0 || (record.duplicateSupplierCode ?? 0) > 0 || (record.duplicateProduct ?? 0) > 0) {
            setShowDuplicateToast(true);
            setTimeout(() => setShowDuplicateToast(false), 5000);
            return;
        }

        setSelectedVessel(record);
        setShowReviewModal(true);
    };

    const confirmSendReview = async () => {
        if (selectedVessel?.id) {
            try {
                await api.patch(`/audits/${selectedVessel.id}/send-for-review`, {});
                // Drop the audit from the pending list — backend now has it as 'Pending Review'.
                setAllRecords(prev => prev.filter(r => r.imoNumber !== selectedVessel.imoNumber));
            } catch (err) {
                console.error('Send for review failed:', err);
            }
        }
        setShowReviewModal(false);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
    };

    const handleUndo = async () => {
        if (selectedVessel?.id) {
            try {
                // Reject endpoint moves 'Pending Review' back to 'In Progress'.
                await api.patch(`/audits/reviews/${selectedVessel.id}/reject`, {});
                // Re-fetch list so the audit reappears under pending.
                loadRecords();
            } catch (err) {
                console.error('Undo failed:', err);
            }
        }
        setShowSuccessToast(false);
    };
    const handleDelete = (record: AuditSummary) => {
        setDeletingRecord(record);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (deletingRecord?.id) {
            const id = deletingRecord.id;
            try {
                await api.delete(ENDPOINTS.AUDITS.DELETE(id));
            } catch (err) {
                console.error('Delete audit failed:', err);
            }
            // Remove only the row with this exact id — avoids wiping every row
            // that happens to share the same IMO (legacy duplicates).
            setAllRecords(prev => prev.filter(r => r.id !== id));
        }
        setShowDeleteModal(false);
        setDeletingRecord(null);
    };

    return (
        <div className="pending-audits-container">
            <Sidebar />
            <main className="pending-audits-main">
                <Header />

                <div className="pending-audits-content">
                    {/* Same registry-header shape used by Pending Reviews —
                        title left, search + Export List inline on the right. */}
                    <div className="registry-header">
                        <div className="header-title-area" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div>
                                <h1>Pending Audits Registry</h1>
                                <p>Manage and review the latest audits before sending for final review.</p>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="search-wrapper">
                                <Search size={24} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search Vessel Name or IMO..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <button className="export-btn">
                                <Download size={18} />
                                EXPORT LIST
                            </button>
                        </div>
                    </div>

                    {/* Single registry card containing table + pagination
                        footer — collapses the empty whitespace the looser
                        layout used to leave behind. */}
                    <div className="registry-table-card" style={{ width: '100%', maxWidth: 'none' }}>
                        <div className="table-wrapper">
                            <table className="audits-table">
                                <thead>
                                    <tr>
                                        <th>VESSEL NAME</th>
                                        <th>TOTAL PO</th>
                                        <th>TOTAL ITEMS</th>
                                        <th>DUPLICATE PO</th>
                                        <th>DUP. SUPPLIER CODE</th>
                                        <th>DUP. PRODUCT CODE</th>
                                        <th>CREATE DATE</th>
                                        <th>REVIEW STATUS</th>
                                        <th className="action-column">ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentRecords.map((record, index) => (
                                        <tr key={record.imoNumber + index}>
                                            <td className="vessel-name">{record.vesselName}</td>
                                            <td>{record.totalPO}</td>
                                            <td>{record.totalItems.toLocaleString()}</td>
                                            <td>
                                                <span className={`duplicate-badge ${(record.duplicatePO ?? 0) > 0 ? 'error' : 'success'}`}>
                                                    {record.duplicatePO}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`duplicate-badge ${(record.duplicateSupplierCode ?? 0) > 0 ? 'error' : 'success'}`}>
                                                    {record.duplicateSupplierCode ?? 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`duplicate-badge ${(record.duplicateProduct ?? 0) > 0 ? 'error' : 'success'}`}>
                                                    {record.duplicateProduct ?? 0}
                                                </span>
                                            </td>
                                            <td>{record.createDate}</td>
                                            <td>
                                                {record.status === 'PENDING REVIEW' ? (
                                                    <div className="v3-status-badge pending">
                                                        <div className="status-dot-pulse" />
                                                        PENDING REVIEW
                                                    </div>
                                                ) : (
                                                    <span className="status-dash">-</span>
                                                )}
                                            </td>
                                            <td className="action-column">
                                                <div className="action-buttons">
                                                    {(record.duplicatePO ?? 0) > 0 && (
                                                        <button className="action-btn edit-btn" onClick={() => handleEdit(record.imoNumber)} title="Edit"><Edit2 size={16} /></button>
                                                    )}
                                                    <button className="action-btn send-btn" onClick={() => handleSend(record.imoNumber)} title="Send to Review"><Send size={16} /></button>
                                                    <button className="action-btn delete-btn" onClick={() => handleDelete(record)} title="Delete"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="table-footer">
                            <span className="pagination-info">
                                Showing {startIndex + 1} to {Math.min(startIndex + recordsPerPage, sortedRecords.length)} of {sortedRecords.length} vessel records
                            </span>
                            <div className="pagination-buttons">
                                <button className="page-btn" style={{ width: 'auto', padding: '0 12px' }} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                {[...Array(totalPages)].map((_, idx) => {
                                    const pageNum = idx + 1;
                                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                                        return (
                                            <button key={pageNum} className={`page-btn ${currentPage === pageNum ? 'active' : ''}`} onClick={() => setCurrentPage(pageNum)}>{pageNum}</button>
                                        );
                                    }
                                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <span key={pageNum} className="pagination-dots">...</span>;
                                    return null;
                                })}
                                <button className="page-btn" style={{ width: 'auto', padding: '0 12px' }} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Send for Review Confirmation Modal */}
                {showReviewModal && (
                    <>
                        <div className="modal-backdrop-blur" onClick={() => setShowReviewModal(false)} />
                        <div className="send-review-modal">
                            <div className="send-review-header">
                                <h2>SEND FOR REVIEW</h2>
                                <button className="close-btn-white" onClick={() => setShowReviewModal(false)}><X size={18} /></button>
                            </div>
                            <div className="send-review-body">
                                <h3>Send <span className="vessel-highlight">{selectedVessel?.vesselName}</span> for final review?</h3>
                                <p>This action will lock the current audit logs and notify the Reviewing Officer.</p>
                            </div>
                            <div className="send-review-footer">
                                <button className="btn-text-cancel" onClick={() => setShowReviewModal(false)}>CANCEL</button>
                                <button className="btn-primary-send" onClick={confirmSendReview}>
                                    YES, SEND REVIEW
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Success Notification with Undo */}
                {showSuccessToast && (
                    <div className="audit-success-toast">
                        <div className="toast-content">
                            <CheckCircle2 size={18} color="#10B981" />
                            <span>Review sent successfully.</span>
                        </div>
                        <button className="undo-btn" onClick={handleUndo}>UNDO</button>
                    </div>
                )}

                {/* Duplicate Alert Notification */}
                {showDuplicateToast && (
                    <div className="audit-error-toast">
                        <div className="toast-content">
                            <XCircle size={18} color="#EF4444" />
                            <span>Cannot send for review: Duplicates detected in high priority fields.</span>
                        </div>
                        <button className="close-toast-btn" onClick={() => setShowDuplicateToast(false)}><X size={16} /></button>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <>
                        <div className="modal-backdrop-blur" onClick={() => setShowDeleteModal(false)} />
                        <div className="send-review-modal">
                            <div className="send-review-header" style={{ background: '#EF4444' }}>
                                <h2>DELETE RECORD</h2>
                                <button className="close-btn-white" onClick={() => setShowDeleteModal(false)}><X size={18} /></button>
                            </div>
                            <div className="send-review-body">
                                <h3>Delete this audit record?</h3>
                                <p>This action cannot be undone. All data associated with this vessel audit will be permanently removed.</p>
                            </div>
                            <div className="send-review-footer">
                                <button className="btn-text-cancel" onClick={() => setShowDeleteModal(false)}>CANCEL</button>
                                <button className="btn-primary-send" style={{ background: '#EF4444' }} onClick={confirmDelete}>
                                    YES, DELETE
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {editingVessel && (
                    <AuditEditorOverlay
                        imo={editingVessel.imoNumber}
                        vesselName={editingVessel.vesselName}
                        onClose={() => setEditingVessel(null)}
                        onSave={() => {
                            // Editor already PATCHed the backend — reload from source of truth.
                            loadRecords();
                        }}
                    />
                )}
            </main>
        </div>
    );
}
