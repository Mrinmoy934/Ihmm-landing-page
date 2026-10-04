// Document Audit page
// -----------------------------------------------------------------------------
// Opens when the manager clicks REVIEW on the MD SDoC Audit Pending registry.
// Lists every clarification item for the IMO with its uploaded MD / SDoC, and
// gives two per-row actions:
//   - Accept              → POST /clarifications/:clarId/items/:idx/review
//                            (flips the item into Reviewed Mds in the PO viewer)
//   - Request Clarification → opens the mail composer; Send fires a reminder
//                              (POST /clarifications/:clarId/items/:idx/remind)
//
// No mock data — everything is fetched from the audit's clarifications.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import './DocumentAudit.css';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import {
    Search,
    ShoppingCart,
    FileText,
    MessageSquare,
    CheckCircle2,
    FileSpreadsheet,
    X,
    Mail,
    Send,
    Loader2,
    Download,
    AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/apiClient';
import { ENDPOINTS, API_CONFIG } from '../../config/api.config';
import { useAuth } from '../../contexts/AuthContext';

interface ClarificationItemRow {
    clarification_id: string;
    item_index: number;
    mds_status: string | null;
    mds_file_path: string | null;
    mds_file_name: string | null;
    mds_received_at: string | null;
    sdoc_status: string | null;
    sdoc_file_path: string | null;
    sdoc_file_name: string | null;
    sdoc_received_at: string | null;
    reminder_count: number | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
}

interface ClarificationRow {
    id: string;
    imo_number: string;
    vessel_name: string | null;
    recipient_emails: string;
    cc_emails: string | null;
    subject: string;
    suspected_items: unknown;
    created_at: string;
    items: ClarificationItemRow[];
}

interface FlatItem {
    key: string;
    clarificationId: string;
    itemIndex: number;
    poNumber: string;
    itemDescription: string;
    supplierEmails: string;
    vendorEmail: string;
    vendorName: string;
    mdFilePath: string | null;
    mdFileName: string | null;
    sdocFilePath: string | null;
    sdocFileName: string | null;
    dateReceived: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    classificationChoice?: string | null;
    /** 'reviewed' wins over 'received' wins over 'pending'. */
    status: 'pending' | 'received' | 'reviewed';
    /** Original subject — used to prefill the clarification mail. */
    clarificationSubject: string;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return iso.split('T')[0] ?? iso;
    }
}

export default function DocumentAudit() {
    const { user } = useAuth();
    const { imo } = useParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [clarifications, setClarifications] = useState<ClarificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastData, setToastData] = useState({ title: '', message: '', tone: 'success' as 'success' | 'error' });

    // Accept & Push Modal State
    const [acceptModalItem, setAcceptModalItem] = useState<FlatItem | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<'Below Threshold' | 'Contain HM' | 'Non CHM'>('Below Threshold');

    // Rejection state & Modal
    const [rejectedKeys, setRejectedKeys] = useState<Set<string>>(new Set());
    const [rejectModalItem, setRejectModalItem] = useState<FlatItem | null>(null);

    // Clarification mail modal state
    const [mailItem, setMailItem] = useState<FlatItem | null>(null);
    const [mailTo, setMailTo] = useState('');
    const [mailSubject, setMailSubject] = useState('');
    const [mailBody, setMailBody] = useState('');
    const [sendingMail, setSendingMail] = useState(false);

    // Document preview modal state
    const [viewingDoc, setViewingDoc] = useState<{
        item: FlatItem;
        kind: 'md' | 'sdoc';
        url: string;
        rawUrl: string;
        fileName: string;
        mimeType: string;
    } | null>(null);
    const [openingPreview, setOpeningPreview] = useState<string | null>(null);

    const closeDocPreview = () => {
        if (viewingDoc && viewingDoc.url && viewingDoc.url.startsWith('blob:')) {
            URL.revokeObjectURL(viewingDoc.url);
        }
        setViewingDoc(null);
    };

    /** Open inline preview modal using JS Blob fetching to bypass browser attachment downloads. */
    const openDocPreview = async (item: FlatItem, kind: 'md' | 'sdoc') => {
        const rawUrl = kind === 'md' ? item.mdFilePath : item.sdocFilePath;
        const rawName = kind === 'md' ? item.mdFileName : item.sdocFileName;
        if (!rawUrl) return;
        const slot = `${item.key}-${kind}`;
        setOpeningPreview(slot);
        try {
            const absoluteUrl = rawUrl.startsWith('http')
                ? rawUrl
                : `${API_CONFIG.BASE_URL.replace('/api/v1', '')}${rawUrl}`;

            const res = await fetch(absoluteUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();

            let mimeType = blob.type;
            const lowerName = (rawName || rawUrl).toLowerCase();
            if (!mimeType || mimeType === 'application/octet-stream') {
                if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
                else if (lowerName.endsWith('.png')) mimeType = 'image/png';
                else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
                else if (lowerName.endsWith('.gif')) mimeType = 'image/gif';
                else mimeType = 'application/pdf';
            }

            const safeBlob = new Blob([blob], { type: mimeType });
            const blobUrl = URL.createObjectURL(safeBlob);

            setViewingDoc({
                item,
                kind,
                url: blobUrl,
                rawUrl: absoluteUrl,
                fileName: rawName ?? 'document',
                mimeType,
            });
        } catch (err) {
            console.error('Blob preview fetch failed, using Google Docs Viewer fallback:', err);
            const absoluteUrl = rawUrl.startsWith('http')
                ? rawUrl
                : `${API_CONFIG.BASE_URL.replace('/api/v1', '')}${rawUrl}`;
            const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
            setViewingDoc({
                item,
                kind,
                url: googleDocsUrl,
                rawUrl: absoluteUrl,
                fileName: rawName ?? 'document',
                mimeType: 'application/pdf',
            });
        } finally {
            setOpeningPreview(null);
        }
    };

    /** Force-download a remote file using its real (original) filename.
     *  We can't just use <a href={url} download={name}> because the
     *  HTML5 `download` attribute is silently ignored on cross-origin
     *  URLs (browser falls back to the URL's last path segment, which
     *  for our storage layout is the random hash key). Fetching first
     *  and creating a blob URL sidesteps that — the blob is same-origin
     *  so `download` is respected. */
    const downloadAs = async (url: string, fileName: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Download failed (${res.status})`);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Free the blob after the click has been processed.
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        } catch (err) {
            console.error('Download failed:', err);
            // Last-resort fallback: open the raw URL so the user at
            // least gets the file (with the wrong filename).
            window.open(url, '_blank', 'noopener');
        }
    };

    const loadClarifications = useCallback(() => {
        if (!imo) return;
        setLoading(true);
        api.get<{ success: boolean; data: ClarificationRow[] }>(ENDPOINTS.AUDITS.CLARIFICATIONS(imo))
            .then((res) => {
                setClarifications(res.data || []);
                setError(null);
            })
            .catch((err) => {
                setClarifications([]);
                setError(err instanceof Error ? err.message : 'Failed to load clarifications');
            })
            .finally(() => setLoading(false));
    }, [imo]);

    useEffect(loadClarifications, [loadClarifications]);

    useEffect(() => {
        if (!showToast) return;
        const t = setTimeout(() => setShowToast(false), 4000);
        return () => clearTimeout(t);
    }, [showToast]);

    const vesselName = clarifications[0]?.vessel_name ?? `Vessel ${imo ?? ''}`;

    /** Flatten clarifications into one row per (clarification_id, item_index). */
    const flatItems: FlatItem[] = useMemo(() => {
        const out: FlatItem[] = [];
        for (const c of clarifications) {
            const suspected = Array.isArray(c.suspected_items)
                ? (c.suspected_items as unknown[][])
                : [];
            for (const it of c.items) {
                const row = Array.isArray(suspected[it.item_index]) ? suspected[it.item_index] as unknown[] : [];
                const poNumber = String(row[2] ?? '');
                const itemDescription = String(row[6] ?? '');
                const vendorEmail = String(row[18] ?? '');
                const vendorName = String(row[19] ?? '');

                const status: FlatItem['status'] = it.reviewed_at
                    ? 'reviewed'
                    : (it.mds_status === 'received' || it.sdoc_status === 'received' || Boolean(it.mds_file_path) || Boolean(it.sdoc_file_path))
                        ? 'received'
                        : 'pending';

                out.push({
                    key: `${it.clarification_id}-${it.item_index}`,
                    clarificationId: it.clarification_id,
                    itemIndex: it.item_index,
                    poNumber,
                    itemDescription,
                    supplierEmails: c.recipient_emails || '',
                    vendorEmail,
                    vendorName,
                    mdFilePath: it.mds_file_path,
                    mdFileName: it.mds_file_name,
                    sdocFilePath: it.sdoc_file_path,
                    sdocFileName: it.sdoc_file_name,
                    dateReceived: formatDate(it.mds_received_at || it.sdoc_received_at),
                    reviewedAt: it.reviewed_at,
                    reviewedBy: it.reviewed_by,
                    status,
                    clarificationSubject: c.subject || '',
                });
            }
        }
        return out;
    }, [clarifications]);

    const filteredItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return flatItems;
        return flatItems.filter((i) =>
            i.poNumber.toLowerCase().includes(q)
            || i.itemDescription.toLowerCase().includes(q)
            || i.supplierEmails.toLowerCase().includes(q)
            || i.vendorName.toLowerCase().includes(q),
        );
    }, [flatItems, searchQuery]);

    const stats = useMemo(() => {
        let pending = 0, received = 0, reviewed = 0;
        for (const i of flatItems) {
            if (i.status === 'reviewed') reviewed++;
            else if (i.status === 'received') received++;
            else pending++;
        }
        return { total: flatItems.length, pending, received, reviewed };
    }, [flatItems]);

    const handleAcceptClick = (item: FlatItem) => {
        if (item.status === 'reviewed' || item.status === 'pending') return;
        setAcceptModalItem(item);
        setSelectedCategory('Below Threshold');
    };

    const handlePushAccept = async () => {
        if (!acceptModalItem) return;
        setAcceptingKey(acceptModalItem.key);
        const consultantName = user?.name || user?.email?.split('@')[0] || 'Consultant';
        try {
            await api.post(
                ENDPOINTS.AUDITS.CLARIFICATION_ITEM_REVIEW(acceptModalItem.clarificationId, acceptModalItem.itemIndex),
                { classification: selectedCategory, reviewedBy: consultantName },
            );
            setToastData({
                title: 'Accepted & Pushed',
                message: `Item PO ${acceptModalItem.poNumber} accepted by ${consultantName} as "${selectedCategory}" and pushed to records.`,
                tone: 'success',
            });
            setShowToast(true);
            setAcceptModalItem(null);
            loadClarifications();
        } catch (err) {
            setToastData({
                title: 'Accept Failed',
                message: err instanceof Error ? err.message : 'Could not mark this item reviewed.',
                tone: 'error',
            });
            setShowToast(true);
        } finally {
            setAcceptingKey(null);
        }
    };

    const openClarificationMail = (item: FlatItem) => {
        const reminderNumber = 1;
        setMailItem(item);
        setMailTo(item.vendorEmail || (item.supplierEmails.split(/[,;]/)[0] || '').trim());
        setMailSubject(`Clarification needed: ${item.clarificationSubject || `PO ${item.poNumber}`}`);
        setMailBody(
`Dear ${item.vendorName || 'Supplier'},

We have reviewed your submission for PO ${item.poNumber} (${item.itemDescription}) and need additional clarification on the uploaded MD / SDoC documents.

Please review the documents and re-submit corrected versions via the secure link from our previous email at your earliest convenience.

This is reminder ${reminderNumber}.

Best regards,
IHM Audit Team`,
        );
    };

    const sendClarificationMail = async () => {
        if (!mailItem) return;
        if (!mailTo.trim()) {
            setToastData({ title: 'Missing recipient', message: 'Please add a recipient email.', tone: 'error' });
            setShowToast(true);
            return;
        }
        setSendingMail(true);
        try {
            await api.post(
                ENDPOINTS.AUDITS.CLARIFICATION_ITEM_REMIND(mailItem.clarificationId, mailItem.itemIndex),
                { to: mailTo, subject: mailSubject, body: mailBody },
            );
            setToastData({
                title: 'Clarification Sent',
                message: `Mail dispatched to ${mailTo}.`,
                tone: 'success',
            });
            setShowToast(true);
            setMailItem(null);
            loadClarifications();
        } catch (err) {
            setToastData({
                title: 'Send Failed',
                message: err instanceof Error ? err.message : 'Could not send the clarification mail.',
                tone: 'error',
            });
            setShowToast(true);
        } finally {
            setSendingMail(false);
        }
    };

    return (
        <div className="doc-audit-container">
            <Sidebar />
            <main className="doc-audit-main">
                <Header />

                {showToast && (
                    <div className="audit-success-toast">
                        <div className="toast-content-wrapper">
                            <div className="toast-icon-green" style={{ background: toastData.tone === 'error' ? '#EF4444' : '#10B981' }}>
                                <CheckCircle2 size={24} fill={toastData.tone === 'error' ? '#EF4444' : '#10B981'} color="white" />
                            </div>
                            <div className="toast-text-area">
                                <h3>{toastData.title}</h3>
                                <p>{toastData.message}</p>
                            </div>
                        </div>
                        <button className="undo-action-btn" onClick={() => setShowToast(false)}>CLOSE</button>
                    </div>
                )}

                <div className="doc-audit-content">
                    <div className="audit-sub-header">
                        <div className="audit-header-main">
                            <div className="header-title-section" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div>
                                    <h1>Document Audit{vesselName ? ` - ${vesselName}` : ''}</h1>
                                    <div className="imo-badge">IMO: <span>{imo || '—'}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="audit-scroll-area">
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-info">
                                    <span className="metric-label">TOTAL ITEMS</span>
                                    <span className="metric-number">{stats.total}</span>
                                </div>
                                <div className="metric-icon-box cart"><ShoppingCart size={20} /></div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-info">
                                    <span className="metric-label">PENDING</span>
                                    <span className="metric-number">{stats.pending}</span>
                                </div>
                                <div className="metric-icon-box doc"><FileText size={20} /></div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-info">
                                    <span className="metric-label">RECEIVED</span>
                                    <span className="metric-number">{stats.received}</span>
                                </div>
                                <div className="metric-icon-box sdoc"><FileSpreadsheet size={20} /></div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-info">
                                    <span className="metric-label">REVIEWED</span>
                                    <span className="metric-number highlight">{stats.reviewed}</span>
                                </div>
                                <div className="metric-icon-box msg"><CheckCircle2 size={20} /></div>
                            </div>
                        </div>

                        <div className="audit-table-card">
                            <div className="card-header">
                                <h2>Audit Queue</h2>
                                <div className="search-wrapper">
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search PO numbers, items, or suppliers..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="table-container">
                                <table className="audit-table">
                                    <thead>
                                        <tr>
                                            <th>PO ID</th>
                                            <th>ITEM</th>
                                            <th>SUPPLIER</th>
                                            <th>MD</th>
                                            <th>SDOC</th>
                                            <th>RECEIVED</th>
                                            <th>STATUS</th>
                                            <th>ACCEPTED BY</th>
                                            <th style={{ textAlign: 'center' }}>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && (
                                            <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                                                <Loader2 size={20} className="spin" style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                                Loading clarifications…
                                            </td></tr>
                                        )}
                                        {!loading && error && (
                                            <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#DC2626' }}>{error}</td></tr>
                                        )}
                                        {!loading && !error && filteredItems.length === 0 && (
                                            <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                                                No clarification items yet. Send a clarification email from the Pending Reviews step to populate this queue.
                                            </td></tr>
                                        )}
                                        {!loading && filteredItems.map((item) => (
                                            <tr key={item.key}>
                                                <td className="po-ident">{item.poNumber || '—'}</td>
                                                <td className="supplier-name" style={{ maxWidth: 280 }}>{item.itemDescription || '—'}</td>
                                                <td className="supplier-name">{item.vendorName || item.supplierEmails || '—'}</td>
                                                <td>
                                                    {item.mdFilePath ? (
                                                        <button
                                                            type="button"
                                                            className="file-link-v3"
                                                            title={`View MD — ${item.mdFileName || 'document'}`}
                                                            onClick={() => openDocPreview(item, 'md')}
                                                            disabled={openingPreview === `${item.key}-md`}
                                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', opacity: openingPreview === `${item.key}-md` ? 0.6 : 1 }}
                                                        >
                                                            {openingPreview === `${item.key}-md` ? (
                                                                <><Loader2 size={16} className="spin" /> Opening…</>
                                                            ) : (
                                                                <><FileText size={16} className="pdf-icon-v3" /> View</>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="not-available">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.sdocFilePath ? (
                                                        <button
                                                            type="button"
                                                            className="file-link-v3"
                                                            title={`View SDoC — ${item.sdocFileName || 'document'}`}
                                                            onClick={() => openDocPreview(item, 'sdoc')}
                                                            disabled={openingPreview === `${item.key}-sdoc`}
                                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', opacity: openingPreview === `${item.key}-sdoc` ? 0.6 : 1 }}
                                                        >
                                                            {openingPreview === `${item.key}-sdoc` ? (
                                                                <><Loader2 size={16} className="spin" /> Opening…</>
                                                            ) : (
                                                                <><FileText size={16} className="pdf-icon-v3" /> View</>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="not-available">—</span>
                                                    )}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{item.dateReceived}</td>
                                                <td>
                                                    <span className={`status-pill-v3 ${item.status === 'reviewed' ? 'resolved' : item.status === 'received' ? 'awaiting-clarification' : 'not-started'}`}>
                                                        {item.status === 'reviewed' ? 'REVIEWED' : item.status === 'received' ? 'RECEIVED' : 'PENDING'}
                                                    </span>
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                                    {item.status === 'reviewed' ? (
                                                        <span style={{ color: '#059669', background: '#ECFDF5', padding: '4px 8px', borderRadius: '4px' }}>
                                                            Accepted by {item.reviewedBy || user?.name || 'Consultant'}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#94A3B8' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="da-action-cell">
                                                        {item.status === 'reviewed' ? (
                                                            <span
                                                                className="da-reviewed-badge"
                                                                title={item.reviewedBy ? `Accepted by ${item.reviewedBy}` : 'Accepted'}
                                                            >
                                                                <CheckCircle2 size={12} /> Accepted &amp; Pushed
                                                            </span>
                                                        ) : item.status === 'received' && !rejectedKeys.has(item.key) ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="da-accept-btn"
                                                                    onClick={() => handleAcceptClick(item)}
                                                                    disabled={acceptingKey === item.key}
                                                                    title="Accept & Push — review and classify this item"
                                                                    style={{ opacity: acceptingKey === item.key ? 0.7 : 1 }}
                                                                >
                                                                    {acceptingKey === item.key ? (
                                                                        <><Loader2 size={12} className="spin" /> Processing…</>
                                                                    ) : (
                                                                        <><CheckCircle2 size={12} /> Accept</>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="da-reject-btn"
                                                                    onClick={() => setRejectModalItem(item)}
                                                                    title="Reject submitted documents and request clarification"
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        border: '1px solid #FECACA',
                                                                        background: '#FEF2F2',
                                                                        color: '#DC2626',
                                                                        borderRadius: 6,
                                                                        fontWeight: 600,
                                                                        fontSize: 12,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 4
                                                                    }}
                                                                >
                                                                    <X size={12} /> Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="da-clarify-btn"
                                                                onClick={() => openClarificationMail(item)}
                                                                title="Request clarification — send a follow-up email to the supplier"
                                                            >
                                                                <MessageSquare size={12} /> Request Clarification
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Document preview modal — embeds the MD/SDoC inline so the
                    auditor can review without triggering a download. Footer
                    has Download (always) and Approve (only when both docs
                    have arrived for this item, mirroring the row-level
                    Accept rule). */}
                {viewingDoc && (
                    <div className="doc-modal-overlay" onClick={closeDocPreview}>
                        <div className="doc-modal-container" onClick={(e) => e.stopPropagation()}>
                            <div className="doc-modal-header">
                                <div className="header-doc-info">
                                    <div className="pdf-icon-box">
                                        <FileText size={20} color="#EF4444" />
                                    </div>
                                    <div className="doc-meta">
                                        <h3>{viewingDoc.fileName}</h3>
                                        <p>
                                            {viewingDoc.kind === 'md' ? 'Material Declaration (MD)' : 'Supplier Declaration of Conformity (SDoC)'}
                                            {' · PO '}{viewingDoc.item.poNumber}
                                        </p>
                                    </div>
                                </div>
                                <button className="close-modal-btn" onClick={closeDocPreview}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="doc-modal-body" style={{ padding: 0, height: '75vh', overflow: 'hidden', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {viewingDoc.mimeType.startsWith('image/') ? (
                                    <img
                                        src={viewingDoc.url}
                                        alt={viewingDoc.fileName}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                ) : (
                                    <object
                                        data={viewingDoc.url.startsWith('blob:') ? `${viewingDoc.url}#toolbar=1` : viewingDoc.url}
                                        type="application/pdf"
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                    >
                                        <iframe
                                            src={viewingDoc.url.startsWith('blob:') ? viewingDoc.url : `https://docs.google.com/viewer?url=${encodeURIComponent(viewingDoc.rawUrl)}&embedded=true`}
                                            title={viewingDoc.fileName}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                        />
                                    </object>
                                )}
                            </div>

                            <div className="doc-modal-footer">
                                <div className="footer-left">
                                    <button
                                        type="button"
                                        className="btn-accept"
                                        disabled={viewingDoc.item.status !== 'received' || acceptingKey === viewingDoc.item.key}
                                        title={
                                            viewingDoc.item.status === 'reviewed' ? 'Already reviewed.'
                                                : viewingDoc.item.status !== 'received'
                                                    ? 'Both MD and SDoC must be uploaded before this item can be approved.'
                                                    : 'Approve — mark this item reviewed'
                                        }
                                        onClick={() => {
                                            const item = viewingDoc.item;
                                            setViewingDoc(null);
                                            handleAcceptClick(item);
                                        }}
                                        style={{
                                            opacity: viewingDoc.item.status !== 'received' || acceptingKey === viewingDoc.item.key ? 0.6 : 1,
                                            cursor: viewingDoc.item.status !== 'received' ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {acceptingKey === viewingDoc.item.key ? (
                                            <><Loader2 size={18} className="spin" /> Approving…</>
                                        ) : (
                                            <><CheckCircle2 size={18} /> Approve</>
                                        )}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => downloadAs(viewingDoc.rawUrl, viewingDoc.fileName)}
                                    className="btn-download"
                                >
                                    <Download size={18} />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clarification mail modal */}
                {mailItem && (
                    <div className="doc-modal-overlay">
                        <div className="clarification-modal-container">
                            <div className="doc-modal-header">
                                <div className="header-doc-info">
                                    <div className="mail-icon-box">
                                        <Mail size={20} color="#00A3FF" />
                                    </div>
                                    <div className="doc-meta">
                                        <h3>Request Clarification</h3>
                                        <p>Re-send a clarification email for {mailItem.poNumber}</p>
                                    </div>
                                </div>
                                <button className="close-modal-btn" onClick={() => setMailItem(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="clarification-body">
                                <div className="mail-field">
                                    <span className="field-label">TO</span>
                                    <input
                                        type="text"
                                        value={mailTo}
                                        onChange={(e) => setMailTo(e.target.value)}
                                        className="mail-input-premium"
                                        placeholder="supplier@example.com"
                                    />
                                </div>
                                <div className="mail-field">
                                    <span className="field-label">SUBJECT</span>
                                    <input
                                        type="text"
                                        value={mailSubject}
                                        onChange={(e) => setMailSubject(e.target.value)}
                                        className="mail-input-premium subject"
                                    />
                                </div>
                                <div className="mail-editor-area">
                                    <textarea
                                        value={mailBody}
                                        onChange={(e) => setMailBody(e.target.value)}
                                        className="mail-textarea-premium"
                                        placeholder="Type your clarification request here..."
                                    />
                                </div>
                            </div>

                            <div className="doc-modal-footer">
                                <div className="footer-left">
                                    <button
                                        className="btn-send-request"
                                        onClick={sendClarificationMail}
                                        disabled={sendingMail}
                                        style={{ opacity: sendingMail ? 0.7 : 1, cursor: sendingMail ? 'wait' : 'pointer' }}
                                    >
                                        {sendingMail ? (
                                            <><Loader2 size={18} className="spin" /> Sending…</>
                                        ) : (
                                            <><Send size={18} /> Send Request</>
                                        )}
                                    </button>
                                    <button className="btn-discard" onClick={() => setMailItem(null)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Accept & Push Categorization Modal */}
                {acceptModalItem && (
                    <div className="doc-modal-overlay">
                        <div className="clarification-modal-container" style={{ maxWidth: '520px' }}>
                            <div className="doc-modal-header">
                                <div className="header-doc-info">
                                    <div className="pdf-icon-box" style={{ background: '#ECFDF5', color: '#10B981' }}>
                                        <CheckCircle2 size={20} color="#10B981" />
                                    </div>
                                    <div className="doc-meta">
                                        <h3>Accept &amp; Classify Material Record</h3>
                                        <p>PO {acceptModalItem.poNumber} — {acceptModalItem.itemDescription}</p>
                                    </div>
                                </div>
                                <button className="close-modal-btn" onClick={() => setAcceptModalItem(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="clarification-body" style={{ padding: '20px' }}>
                                <div style={{ marginBottom: '16px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                                    Consultant selection based on reviewing MD &amp; SDoC documents:
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { id: 'Below Threshold', title: 'Below Threshold', desc: 'Material present but below regulatory reporting threshold.' },
                                        { id: 'Contain HM', title: 'Contain HM', desc: 'Contains Hazardous Material requiring active inventory tracking.' },
                                        { id: 'Non CHM', title: 'Non CHM', desc: 'Non-Hazardous Material — compliant with safety limits.' }
                                    ].map((opt) => (
                                        <label
                                            key={opt.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                padding: '12px 14px',
                                                borderRadius: '8px',
                                                border: selectedCategory === opt.id ? '2px solid #00A3FF' : '1px solid #E2E8F0',
                                                background: selectedCategory === opt.id ? '#F0F9FF' : '#FFFFFF',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onClick={() => setSelectedCategory(opt.id as any)}
                                        >
                                            <input
                                                type="radio"
                                                name="materialClassification"
                                                checked={selectedCategory === opt.id}
                                                onChange={() => setSelectedCategory(opt.id as any)}
                                                style={{ marginTop: '2px' }}
                                            />
                                            <div>
                                                <strong style={{ fontSize: '14px', color: '#1E293B', display: 'block' }}>{opt.title}</strong>
                                                <span style={{ fontSize: '12px', color: '#64748B' }}>{opt.desc}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="doc-modal-footer">
                                <div className="footer-left">
                                    <button
                                        type="button"
                                        className="btn-send-request"
                                        onClick={handlePushAccept}
                                        disabled={acceptingKey === acceptModalItem.key}
                                        style={{ background: '#10B981', opacity: acceptingKey === acceptModalItem.key ? 0.7 : 1 }}
                                    >
                                        {acceptingKey === acceptModalItem.key ? (
                                            <><Loader2 size={18} className="spin" /> Pushing…</>
                                        ) : (
                                            <><CheckCircle2 size={18} /> Push Record</>
                                        )}
                                    </button>
                                    <button type="button" className="btn-discard" onClick={() => setAcceptModalItem(null)}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reject Confirmation Modal */}
                {rejectModalItem && (
                    <div className="doc-modal-overlay" onClick={() => setRejectModalItem(null)}>
                        <div className="doc-modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertTriangle size={24} color="#DC2626" />
                            </div>
                            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#0F172A', fontWeight: 700 }}>Reject Submission?</h3>
                            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                                Are you sure you want to reject the submitted documents for PO <strong>{rejectModalItem.poNumber}</strong> ({rejectModalItem.itemDescription})?
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setRejectModalItem(null)}
                                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const item = rejectModalItem;
                                        setRejectedKeys(prev => new Set(prev).add(item.key));
                                        setRejectModalItem(null);
                                        openClarificationMail(item);
                                    }}
                                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#DC2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Yes, Reject &amp; Request Clarification
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <style>{`.spin { animation: doc-audit-spin 0.8s linear infinite } @keyframes doc-audit-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
