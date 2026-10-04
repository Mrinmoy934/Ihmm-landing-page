import { useState, useMemo, useEffect } from 'react';
import {
    ChevronDown, Search, Edit2, Trash2,
    FileText, Filter, Mail, X, Send, Paperclip,
    Link as LinkIcon, Smile, Image, CheckCircle2, Check
} from 'lucide-react';
import './PurchaseOrderView.css';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import { useAuth } from '../../contexts/AuthContext';

interface PurchaseOrderItem {
    id: string;
    emailStatus: string;
    ihmProductCode: string;
    poNumber: string;
    mdsReq: string;
    mdsRec: string;
    itemDescription: string;
    orderDate: string;
    quantityTotal: string;
    unit: string;
    selected?: boolean;
    isSuspected?: boolean;
    // Clarification-item identifiers (needed to upload the MDS doc).
    clarificationId?: string;
    itemIndex?: number;
    // Combined MDS status — 'received' iff both MD and SDoC are in.
    mdsStatus?: 'pending' | 'received' | string;
    // Per-doc state. mdStatus / sdocStatus default to 'pending' when an
    // item has a clarification but the slot hasn't been uploaded yet.
    mdStatus?: 'pending' | 'received' | string;
    mdFilePath?: string;
    mdFileName?: string;
    sdocStatus?: 'pending' | 'received' | string;
    sdocFilePath?: string;
    sdocFileName?: string;
    reminderCount?: number;
    // 'red' | 'green' | 'pchm' | null — set by the HM categorization flow.
    hmStatus?: string | null;
    // Set when the admin has marked this item reviewed. Drives the
    // 'Reviewed Mds' filter pill and the Reviewed badge.
    reviewedAt?: string | null;
    reviewedBy?: string | null;
    vendorName?: string;
    vendorEmail?: string;
    updatedAt?: string | null;
}

const FILTER_TAGS = [
    'All', 'Pending Mds', 'Received Mds', 'Reviewed Mds', 'Tracked Items', 'Non Tracked Items',
    'Request Pending', 'Reminder 1', 'Reminder 2', 'Non-Responsive Supplier',
    'HM Red', 'HM Green', 'PCHM'
];

// Real items now come from GET /audits/:imo/clarifications. Mock data removed.
const initializeData = (): PurchaseOrderItem[] => [];

function getDaysSince(dateStr: string | null | undefined): number {
    if (!dateStr) return 0;
    const now = new Date();
    const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const actionDate = new Date(dateStr);
    const d2 = new Date(actionDate.getFullYear(), actionDate.getMonth(), actionDate.getDate());
    const diffTime = d1.getTime() - d2.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

interface PurchaseOrderViewProps {
    imo: string;
    vesselId?: string;
    vesselName?: string;
}

export default function PurchaseOrderView({ imo, vesselId, vesselName }: PurchaseOrderViewProps) {
    const { user } = useAuth();
    const isOwnerOrManager = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || '').toLowerCase();
        return role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role === 'vessel' || role.includes('owner') || role.includes('manager') || role.includes('vessel');
    }, [user]);

    const [activeFilter, setActiveFilter] = useState('All');
    const [openSuppliers, setOpenSuppliers] = useState<string[]>(['s1']);
    const [allItems, setAllItems] = useState<PurchaseOrderItem[]>(initializeData);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [inlineEditForm, setInlineEditForm] = useState({
        itemDescription: '',
        poNumber: '',
        ihmProductCode: '',
        quantity: '1',
        unit: 'PCS',
        vendorEmail: '',
        vendorName: '',
        isSuspected: false
    });

    // Fetch clarification history for this IMO from the backend. Each clarification
    // email may reference many suspected POs; we flatten them into one row per item
    // and merge in per-item MDS state from clarification_items.
    // Fetch every line item for the vessel's active audit. The backend already
    // joins clarification state per PO, so non-suspected items show with
    // mds_status='none' and suspected items carry real pending/received status.
    const loadClarifications = () => {
        if (!vesselId) { setAllItems([]); return; }
        api.get<{ success: boolean; data: { items: Array<Record<string, unknown>> } }>(
            ENDPOINTS.AUDITS.VESSEL_PO_ITEMS(vesselId),
        )
            .then((res) => {
                const rows = res.data?.items || [];
                const items: PurchaseOrderItem[] = rows.map((r) => {
                    const mdsStatus = String(r.mds_status ?? 'none');
                    const isSuspected = String(r.is_suspected ?? 'No') === 'Yes';
                    const mdStatus = String(r.md_status ?? r.mds_status ?? 'none');
                    const mdFilePath = r.md_file_path ? String(r.md_file_path) : (r.mds_file_path ? String(r.mds_file_path) : undefined);
                    const mdFileName = r.md_file_name ? String(r.md_file_name) : (r.mds_file_name ? String(r.mds_file_name) : undefined);
                    const sdocStatus = String(r.sdoc_status ?? 'none');
                    const sdocFilePath = r.sdoc_file_path ? String(r.sdoc_file_path) : undefined;
                    const sdocFileName = r.sdoc_file_name ? String(r.sdoc_file_name) : undefined;
                    const mdsReceivedAt = typeof r.mds_received_at === 'string' ? r.mds_received_at.split('T')[0] : '';
                    const poSentDate = typeof r.po_sent_date === 'string' ? r.po_sent_date.split('T')[0] : String(r.po_sent_date ?? '');
                    const mdReqDate = typeof r.md_requested_date === 'string' ? r.md_requested_date.split('T')[0] : String(r.md_requested_date ?? '');
                    const reminderCount = Number(r.reminder_count ?? 0);
                    const hmStatusRaw = r.hm_status ? String(r.hm_status).toLowerCase() : null;
                    const reviewedAt = r.reviewed_at ? String(r.reviewed_at) : null;
                    const reviewedBy = r.reviewed_by ? String(r.reviewed_by) : null;
                    const updatedAt = r.updated_at ? String(r.updated_at) : null;

                    let emailStatus: string;
                    if (!isSuspected) emailStatus = 'NOT SENT';
                    else if (!r.clarification_id) emailStatus = 'NOT SENT';
                    else if (reviewedAt) emailStatus = 'REVIEWED';
                    else if (mdsStatus === 'received') emailStatus = 'REPLIED';
                    else if (reminderCount >= 3) emailStatus = 'NON-RESPONSIVE';
                    else if (reminderCount >= 1) emailStatus = `REMINDER ${reminderCount}`;
                    else emailStatus = 'SENT';

                    return {
                        id: String(r.id),
                        clarificationId: r.clarification_id ? String(r.clarification_id) : undefined,
                        itemIndex: r.clarification_item_index != null ? Number(r.clarification_item_index) : undefined,
                        emailStatus,
                        ihmProductCode: String(r.impa_code ?? r.issa_code ?? 'N/A'),
                        poNumber: String(r.po_number ?? ''),
                        mdsReq: mdReqDate || poSentDate,
                        mdsRec: mdsReceivedAt,
                        itemDescription: String(r.item_description ?? ''),
                        orderDate: poSentDate,
                        quantityTotal: `${r.quantity ?? '0'} | ${mdsStatus === 'received' ? (r.quantity ?? '0') : '0'} | ${r.quantity ?? '0'}`,
                        unit: String(r.unit ?? 'PCS'),
                        isSuspected,
                        selected: false,
                        mdsStatus,
                        mdStatus,
                        mdFilePath,
                        mdFileName,
                        sdocStatus,
                        sdocFilePath,
                        sdocFileName,
                        reminderCount,
                        hmStatus: hmStatusRaw,
                        reviewedAt,
                        reviewedBy,
                        vendorName: String(r.vendor_name ?? ''),
                        vendorEmail: String(r.vendor_email ?? ''),
                        updatedAt,
                    };
                });
                setAllItems(items);
            })
            .catch(() => setAllItems([]));
    };

    useEffect(loadClarifications, [vesselId]);

    const handleEditClick = (item: PurchaseOrderItem) => {
        setEditingRowId(item.id);
        setInlineEditForm({
            itemDescription: item.itemDescription,
            poNumber: item.poNumber,
            ihmProductCode: item.ihmProductCode === 'N/A' ? '' : item.ihmProductCode,
            quantity: item.quantityTotal.split('|')[0]?.trim() || '1',
            unit: item.unit,
            vendorEmail: item.vendorEmail || '',
            vendorName: item.vendorName || '',
            isSuspected: item.isSuspected || false
        });
    };

    const handleInlineSave = async (id: string) => {
        try {
            const res = await api.put<{ success: boolean; data: any }>(
                `/audits/line-items/${id}`,
                {
                    poNumber: inlineEditForm.poNumber,
                    itemDescription: inlineEditForm.itemDescription,
                    impaCode: inlineEditForm.ihmProductCode,
                    quantity: Number(inlineEditForm.quantity) || 1,
                    unit: inlineEditForm.unit,
                    vendorEmail: inlineEditForm.vendorEmail,
                    vendorName: inlineEditForm.vendorName,
                    isSuspected: inlineEditForm.isSuspected
                }
            );
            if (res.success) {
                loadClarifications();
                setEditingRowId(null);
            }
        } catch (err: any) {
            alert(err.message || 'Failed to update item');
        }
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this purchase order line item?')) return;
        try {
            await api.delete(`/audits/line-items/${id}`);
            loadClarifications();
            alert('Item deleted successfully.');
        } catch (err: any) {
            alert(err.message || 'Failed to delete item');
        }
    };

    // Admin is view-only on supplier documents — uploads happen exclusively
    // through the public supplier link (handled by the public controller).

    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);

    // Mail & Doc View State
    const [showMailView, setShowMailView] = useState(false);
    const [selectedMail, setSelectedMail] = useState<{ subject: string; body: string; to: string } | null>(null);
    const [reminderItem, setReminderItem] = useState<PurchaseOrderItem | null>(null);
    const [sendingReminder, setSendingReminder] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState({
        title: 'Mail Sent Successfully',
        body: 'Your clarification/reminder has been dispatched to the supplier.',
    });

    const toggleSupplier = (id: string) => {
        setOpenSuppliers(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };



    const currentSuppliersData = useMemo(() => {
        // One predicate per filter pill. Each rule is documented in the
        // workflow spec; HM Red / HM Green / PCHM key off `hm_status` from
        // clarification_items, which is currently set only via the audit
        // categorization wizard — those tabs return zero until that flow is
        // wired to persist hm_status.
        const matchesFilter = (item: PurchaseOrderItem): boolean => {
            if (activeFilter === 'All') return true;
            const isReceived = item.mdsStatus === 'received';
            const reminders = item.reminderCount ?? 0;
            const hasClar = !!item.clarificationId;
            const hm = (item.hmStatus ?? '').toLowerCase();

            switch (activeFilter) {
                case 'Request Pending':
                    return item.isSuspected === true && !hasClar && !isReceived;
                case 'Pending Mds':
                    return item.isSuspected === true && !isReceived && !item.reviewedAt &&
                        (!hasClar || (reminders === 0 && getDaysSince(item.mdsReq) < 7));
                case 'Reminder 1':
                    return item.isSuspected === true && !isReceived && !item.reviewedAt &&
                        hasClar && reminders === 0 && getDaysSince(item.mdsReq) >= 7;
                case 'Reminder 2':
                    return item.isSuspected === true && !isReceived && !item.reviewedAt &&
                        hasClar && reminders === 1 && getDaysSince(item.updatedAt) >= 7;
                case 'Non-Responsive Supplier':
                    return item.isSuspected === true && !isReceived && !item.reviewedAt &&
                        hasClar && (reminders >= 3 || (reminders === 2 && getDaysSince(item.updatedAt) >= 7));
                case 'Received Mds':
                    return isReceived && !item.reviewedAt;
                case 'Reviewed Mds':
                    return Boolean(item.reviewedAt);
                case 'Tracked Items':
                    return hasClar;
                case 'Non Tracked Items':
                    return !hasClar;
                case 'HM Red':
                    return hm === 'red';
                case 'HM Green':
                    return hm === 'green';
                case 'PCHM':
                    return hm === 'pchm';
                default:
                    return false;
            }
        };

        const filteredItems = allItems.filter(item => {
            // Supplier list displays only suspected items; all PO items retained internally in allItems
            if (item.isSuspected !== true) return false;
            if (!matchesFilter(item)) return false;
            if (searchTerm && !item.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) && !item.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });

        // Group by real vendor name. If there are no items yet, show a single
        // placeholder group named after the vessel so the column template stays
        // on screen with an empty state.
        type Supplier = {
            id: string;
            name: string;
            ref: string;
            totalItems: string;
            mds: string;
            hm: string;
            items: PurchaseOrderItem[];
        };

        const byVendor = new Map<string, PurchaseOrderItem[]>();
        for (const item of filteredItems) {
            const vendor = ((item as unknown as { vendorName?: string }).vendorName || '').trim() || 'Unknown Supplier';
            if (!byVendor.has(vendor)) byVendor.set(vendor, []);
            byVendor.get(vendor)!.push(item);
        }

        const suppliers: Supplier[] = [];
        let idx = 0;
        for (const [vendor, items] of byVendor.entries()) {
            suppliers.push({
                id: `v-${idx++}`,
                name: vendor,
                ref: imo ? `( IMO ${imo} )` : '',
                totalItems: `${items.length}`,
                mds: `${items.filter(i => i.mdsRec).length} / ${items.length}`,
                hm: `0 | 0`,
                items,
            });
        }

        // No real items yet — emit a single empty group so the column template
        // is still visible. Don't label it with the vessel name (that reads as
        // a fake supplier); show a clear empty-state heading instead.
        if (suppliers.length === 0) {
            suppliers.push({
                id: 'placeholder',
                name: 'No suppliers yet',
                ref: imo ? `( IMO ${imo} )` : '',
                totalItems: '0',
                mds: '0 / 0',
                hm: '0 | 0',
                items: [],
            });
        }

        return suppliers;
    }, [activeFilter, searchTerm, allItems, imo, vesselName]);

    const selectedCount = allItems.filter(i => i.selected).length;

    const toggleItemSelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAllItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    const toggleAllInSupplier = (items: PurchaseOrderItem[], checked: boolean) => {
        const ids = items.map(i => i.id);
        setAllItems(prev => prev.map(item => ids.includes(item.id) ? { ...item, selected: checked } : item));
    };



    // Open the compose modal prefilled with a reminder. The supplier can
    // edit the subject/body before sending. Send → POST /remind which
    // re-sends the email via the existing public link and increments
    // reminder_count on the item.
    const handleOpenReminder = (item: PurchaseOrderItem) => {
        const nextReminder = (item.reminderCount ?? 0) + 1;
        setReminderItem(item);
        setSelectedMail({
            to: item.vendorEmail || '',
            subject: `Clarification Request (Reminder ${nextReminder}): MD & SDoC required for PO ${item.poNumber || 'Order'}`,
            body: `Dear ${item.vendorName || 'Supplier'},\n\nWe require MD (Material Declaration) and SDoC (Supplier's Declaration of Conformity) documentation for the following item under PO ${item.poNumber || 'N/A'}:\n\n- Description: ${item.itemDescription || 'Material'}\n- Quantity: ${item.quantityTotal || '1'} ${item.unit || 'PCS'}\n\nPlease submit the required documents at your earliest convenience.\n\nBest regards,\nIHM Platform Team`,
        });
        setShowMailView(true);
    };

    const handleSendMail = async () => {
        if (!selectedMail) {
            setShowMailView(false);
            return;
        }

        if (!selectedMail.to || !selectedMail.to.includes('@')) {
            setToastMessage({
                title: 'Invalid Email Address',
                body: 'Please enter a valid supplier email address before sending.',
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            return;
        }

        // ── Single-row reminder (per-row mail icon) ────────────────
        if (reminderItem && reminderItem.clarificationId && reminderItem.itemIndex !== undefined) {
            setSendingReminder(true);
            try {
                await api.post(
                    ENDPOINTS.AUDITS.CLARIFICATION_ITEM_REMIND(
                        reminderItem.clarificationId,
                        reminderItem.itemIndex,
                    ),
                    {
                        to: selectedMail.to,
                        subject: selectedMail.subject,
                        body: selectedMail.body,
                    },
                );
                setToastMessage({
                    title: 'Email Sent Successfully',
                    body: `Clarification request delivered to ${selectedMail.to}.`,
                });
                setShowMailView(false);
                setReminderItem(null);
                loadClarifications();
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            } catch (err) {
                console.error('Reminder send failed:', err);
                try {
                    await api.post('/emails/send', {
                        to: selectedMail.to,
                        subject: selectedMail.subject,
                        body: selectedMail.body
                    });
                    setToastMessage({
                        title: 'Email Sent Successfully',
                        body: `Email delivered to ${selectedMail.to}.`,
                    });
                    setShowMailView(false);
                    setReminderItem(null);
                    setShowToast(true);
                    setTimeout(() => setShowToast(false), 3000);
                } catch {
                    setToastMessage({
                        title: 'Sending Failed',
                        body: err instanceof Error ? err.message : 'Could not send email to supplier.',
                    });
                    setShowToast(true);
                    setTimeout(() => setShowToast(false), 4000);
                }
            } finally {
                setSendingReminder(false);
            }
            return;
        }

        // ── Direct Email fallback if no clarification batch ID ──────
        setSendingReminder(true);
        try {
            await api.post('/emails/send', {
                to: selectedMail.to,
                subject: selectedMail.subject,
                body: selectedMail.body
            });
            setToastMessage({
                title: 'Email Request Sent',
                body: `Clarification request email sent to ${selectedMail.to}.`,
            });
            setShowMailView(false);
            setReminderItem(null);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (err) {
            console.error('Direct email failed:', err);
            setToastMessage({
                title: 'Email Failed',
                body: err instanceof Error ? err.message : 'Could not send email to supplier. Please check recipient address.',
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 4000);
        } finally {
            setSendingReminder(false);
        }

        // ── Bulk reminder (toolbar mail icon, multiple rows) ───────
        // Group selected items by clarificationId so each vendor gets
        // exactly ONE email regardless of how many of their rows are
        // pending. reminder_count bumps on every selected item, so the
        // Reminder 1 / 2 / Non-Responsive ladder progresses correctly.
        const selected = allItems.filter(
            (i) => i.selected && i.clarificationId && i.itemIndex !== undefined,
        );
        if (selected.length === 0) {
            setShowMailView(false);
            return;
        }
        const byClar = new Map<string, number[]>();
        for (const item of selected) {
            if (!byClar.has(item.clarificationId!)) byClar.set(item.clarificationId!, []);
            byClar.get(item.clarificationId!)!.push(item.itemIndex!);
        }

        setSendingReminder(true);
        try {
            const results = await Promise.allSettled(
                Array.from(byClar.entries()).map(([clarId, indices]) =>
                    api.post(
                        ENDPOINTS.AUDITS.CLARIFICATION_REMIND_BULK(clarId),
                        {
                            itemIndices: indices,
                            to: selectedMail.to,
                            subject: selectedMail.subject,
                            body: selectedMail.body,
                        },
                    ),
                ),
            );
            const ok = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.length - ok;
            setToastMessage({
                title: failed === 0 ? 'Reminders Sent' : `${ok} sent, ${failed} failed`,
                body: `${selected.length} item${selected.length > 1 ? 's' : ''} across ${byClar.size} vendor${byClar.size > 1 ? 's' : ''} updated.`,
            });
            setShowMailView(false);
            // Deselect everything so the toolbar collapses.
            setAllItems((prev) => prev.map((i) => ({ ...i, selected: false })));
            loadClarifications();
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3500);
        } catch (err) {
            console.error('Bulk reminder send failed:', err);
            setToastMessage({
                title: 'Bulk Send Failed',
                body: err instanceof Error ? err.message : 'Could not send reminders. Please try again.',
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 4000);
        } finally {
            setSendingReminder(false);
        }
    };

    const handleBulkEmail = () => {
        const selected = allItems.filter(i => i.selected);
        if (selected.length === 0) return;

        // Pick the highest reminder count among the selection so the subject
        // reflects how aggressive this batch should look. Note: this modal
        // currently doesn't post to the reminder endpoint per row — the
        // per-row mail icon is the supported path. This is left as a UI
        // composer until we wire bulk reminders server-side.
        const maxReminder = Math.max(0, ...selected.map((i) => i.reminderCount ?? 0));
        const subject = maxReminder >= 2
            ? `URGENT: FINAL REMINDER - Documentation Overdue for ${imo}`
            : `Reminder: Documentation Required for POs on ${imo}`;

        const body = maxReminder >= 2
            ? `Dear Partners,\n\nThis is an URGENT FINAL REMINDER regarding ${selected.length} items on ${imo}. Outstanding MDs/SDoCs have NOT been received despite previous requests.\n\nItems:\n${selected.map(s => `- PO: ${s.poNumber}`).join('\n')}\n\nFailure to provide documentation within 24 hours will result in the supplier being marked as NON-RESPONSIVE in our system.\n\nBest Regards,\nIHM Audit Team`
            : `Dear Partners,\n\nWe are sending a follow-up reminder regarding ${selected.length} items on ${imo}. We have not yet received the requested MDs/SDoCs.\n\nItems:\n${selected.map(s => `- PO: ${s.poNumber}`).join('\n')}\n\nPlease update these records immediately.\n\nBest Regards,\nIHM Audit Team`;

        setSelectedMail({
            to: selected[0].vendorEmail || 'multiple-suppliers@example.com',
            subject,
            body,
        });
        setShowMailView(true);
    };

    return (
        <div className="po-v4-main-wrapper">
            <div className="po-v4-top-controls-p">
                <div className="po-v4-top-strip-clean">
                    <button className="po-v4-filter-trigger-btn" onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}>
                        <Filter size={18} />
                        Filter
                    </button>
                    <div className="po-v4-soft-search-box-premium">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search PO numbers or descriptions..."
                            className="po-v4-soft-search-input-premium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {isFilterBarOpen && (
                    <div className="po-v4-tags-container-premium">
                        {FILTER_TAGS.map(tag => (
                            <div
                                key={tag}
                                className={`po-v4-tag-item-premium ${activeFilter === tag ? 'active' : ''}`}
                                onClick={() => setActiveFilter(tag)}
                            >
                                {tag}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="po-v4-scroll-content">
                <div className="po-v4-details-section-premium">
                    <div className="po-v4-details-section-title">
                        <span>Details</span>
                    </div>
                    <div className="po-v4-suppliers-list-structured">
                        {currentSuppliersData.map(supplier => (
                            <div key={supplier.id} className={`po-v4-supplier-item-v4 ${openSuppliers.includes(supplier.id) ? 'is-open' : ''}`}>
                                <div className="po-v4-supplier-header-v4" onClick={() => toggleSupplier(supplier.id)}>
                                    <div className="po-v4-sup-info-v4">
                                        <div className="po-v4-sup-ref-tag">{supplier.ref}</div>
                                        <div className="po-v4-sup-name-title">{supplier.name}</div>
                                    </div>
                                    <div className="po-v4-sup-metrics-v4">
                                        <ChevronDown size={20} className={`po-v4-arrow-icon ${openSuppliers.includes(supplier.id) ? 'up' : ''}`} />
                                    </div>
                                </div>

                                {openSuppliers.includes(supplier.id) && (
                                    <div className="po-v4-supplier-details-v4">
                                        {!isOwnerOrManager && (
                                            <div className="po-v4-table-toolbar-localized">
                                                <div className="po-v4-action-icons-localized">
                                                    {selectedCount > 0 && (
                                                        <div className="po-v4-action-item-local tooltip-p" onClick={handleBulkEmail}>
                                                            <div className="po-v4-circle-btn-v4 mail-bulk">
                                                                <Mail size={18} />
                                                            </div>
                                                            <span className="po-v4-tooltip-text">Send Reminders</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="po-v4-table-master-wrapper">
                                            <table className="po-v4-table-styled-premium">
                                                <thead>
                                                    <tr>
                                                        {!isOwnerOrManager && (
                                                            <th className="ch-col">
                                                                <input
                                                                    type="checkbox"
                                                                    className="po-v4-header-checkbox-v4"
                                                                    checked={supplier.items.length > 0 && supplier.items.every(i => i.selected)}
                                                                    onChange={(e) => toggleAllInSupplier(supplier.items, e.target.checked)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </th>
                                                        )}
                                                        <th className="ac-col">Options Channel</th>
                                                        <th className="doc-col">Documents</th>
                                                        <th className="em-col">Email Status</th>
                                                        <th className="ihm-col">IHM Product Code</th>
                                                        <th className="po-col">PO Number</th>
                                                        <th className="mdr-col">MDs SDoCs Req</th>
                                                        <th className="mdc-col">MDs SDoCs Rec</th>
                                                        <th className="it-col">Item Description</th>
                                                        <th className="da-col">Order Date</th>
                                                        <th className="qt-col">
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <span>Quantity</span>
                                                                <span style={{ fontSize: '9px', fontWeight: 500, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: '#EF4444' }}>Ord</span>{' | '}<span style={{ color: '#10B981' }}>Rec</span>{' | '}<span style={{ color: '#3B82F6' }}>Pend</span>
                                                                </span>
                                                            </div>
                                                        </th>
                                                        <th className="un-col">Unit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {supplier.items.length === 0 && (
                                                        <tr>
                                                            <td colSpan={isOwnerOrManager ? 13 : 14} style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontStyle: 'italic' }}>
                                                                {supplier.id === 'placeholder'
                                                                    ? 'Upload a purchase order to see vendors and items here.'
                                                                    : 'No items yet for this supplier.'}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {supplier.items.map(item => {
                                                        const isEditing = editingRowId === item.id;
                                                        return (
                                                            <tr key={item.id} className={item.selected ? 'row-is-selected' : ''}>
                                                                {!isOwnerOrManager && (
                                                                    <td className="ch-col">
                                                                        <div className={`po-v4-row-action-checkbox-styled ${item.selected ? 'checked' : ''}`} onClick={(e) => toggleItemSelection(item.id, e)}>
                                                                            {item.selected && <Check size={14} strokeWidth={3} className="check-icon-v4" />}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="ac-col">
                                                                    {!isOwnerOrManager && (
                                                                        isEditing ? (
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                                                <button
                                                                                    type="button"
                                                                                    className="po-v4-action-icon-btn-v4 view"
                                                                                    title="Save changes"
                                                                                    onClick={() => handleInlineSave(item.id)}
                                                                                    style={{ color: '#10B981', borderColor: '#10B981', background: '#ECFDF5' }}
                                                                                >
                                                                                    <Check size={14} />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="po-v4-action-icon-btn-v4 delete"
                                                                                    title="Cancel editing"
                                                                                    onClick={() => setEditingRowId(null)}
                                                                                    style={{ color: '#EF4444', borderColor: '#EF4444', background: '#FEF2F2' }}
                                                                                >
                                                                                    <X size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="po-v4-row-action-btns-premium">
                                                                                <button
                                                                                    type="button"
                                                                                    className="po-v4-action-icon-btn-v4 view"
                                                                                    title="Send clarification email to supplier"
                                                                                    onClick={() => handleOpenReminder(item)}
                                                                                    disabled={item.mdsStatus === 'received'}
                                                                                    style={{
                                                                                        visibility: 'visible',
                                                                                        opacity: item.mdsStatus === 'received' ? 0.4 : 1,
                                                                                        cursor: item.mdsStatus === 'received' ? 'not-allowed' : 'pointer',
                                                                                    }}
                                                                                >
                                                                                    <Mail size={14} />
                                                                                </button>
                                                                                {item.reviewedAt && (
                                                                                    <span
                                                                                        title={item.reviewedBy ? `Reviewed by ${item.reviewedBy}` : 'Reviewed'}
                                                                                        style={{
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: 4,
                                                                                            padding: '2px 8px',
                                                                                            background: '#ECFDF5',
                                                                                            color: '#065F46',
                                                                                            border: '1px solid #A7F3D0',
                                                                                            borderRadius: 999,
                                                                                            fontSize: 10,
                                                                                            fontWeight: 700,
                                                                                            letterSpacing: '0.04em',
                                                                                            textTransform: 'uppercase',
                                                                                        }}
                                                                                    >
                                                                                        <CheckCircle2 size={12} />
                                                                                        Reviewed
                                                                                    </span>
                                                                                )}
                                                                                <button type="button" className="po-v4-action-icon-btn-v4 edit" title="Edit Item" onClick={() => handleEditClick(item)}><Edit2 size={14} /></button>
                                                                                <button type="button" className="po-v4-action-icon-btn-v4 delete" title="Delete Item" onClick={() => handleDeleteClick(item.id)}><Trash2 size={14} /></button>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </td>
                                                                <td className="doc-col">
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                                        {(['md', 'sdoc'] as const).map((kind) => {
                                                                            const filePath = kind === 'md' ? item.mdFilePath : item.sdocFilePath;
                                                                            const fileName = kind === 'md' ? item.mdFileName : item.sdocFileName;
                                                                            const label = kind.toUpperCase();
                                                                            return filePath ? (
                                                                                <a
                                                                                    key={kind}
                                                                                    href={filePath}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="po-v4-action-icon-btn-v4 doc"
                                                                                    title={`View ${label} — ${fileName || 'document'}`}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#10B981', fontSize: 10, fontWeight: 700 }}
                                                                                >
                                                                                    <FileText size={14} />
                                                                                    {label}
                                                                                </a>
                                                                            ) : (
                                                                                <span
                                                                                    key={kind}
                                                                                    className="po-v4-action-icon-btn-v4 doc"
                                                                                    title={`Awaiting supplier ${label} upload`}
                                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#CBD5E1', fontSize: 10, fontWeight: 700, cursor: 'not-allowed', opacity: 0.6 }}
                                                                                >
                                                                                    <FileText size={14} />
                                                                                    {label}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </td>
                                                                <td className="em-col">{item.emailStatus}</td>
                                                                <td className="ihm-col">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={inlineEditForm.ihmProductCode}
                                                                            style={{ width: '80px', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' }}
                                                                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, ihmProductCode: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        item.ihmProductCode
                                                                    )}
                                                                </td>
                                                                <td className="po-col">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={inlineEditForm.poNumber}
                                                                            style={{ width: '100px', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' }}
                                                                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, poNumber: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        item.poNumber
                                                                    )}
                                                                </td>
                                                                <td className="mdr-col">{item.mdsReq}</td>
                                                                <td className="mdc-col">{item.mdsRec}</td>
                                                                <td className="it-col">
                                                                    {isEditing ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                                                                            <textarea
                                                                                value={inlineEditForm.itemDescription}
                                                                                placeholder="Item Description *"
                                                                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px', resize: 'vertical', minHeight: '50px' }}
                                                                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, itemDescription: e.target.value })}
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Supplier Contact Name"
                                                                                value={inlineEditForm.vendorName}
                                                                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
                                                                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, vendorName: e.target.value })}
                                                                            />
                                                                            <input
                                                                                type="email"
                                                                                placeholder="Supplier Contact Email"
                                                                                value={inlineEditForm.vendorEmail}
                                                                                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
                                                                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, vendorEmail: e.target.value })}
                                                                            />
                                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={inlineEditForm.isSuspected}
                                                                                    style={{ width: '14px', height: '14px', accentColor: '#00B0FA', cursor: 'pointer' }}
                                                                                    onChange={(e) => setInlineEditForm({ ...inlineEditForm, isSuspected: e.target.checked })}
                                                                                />
                                                                                Suspected (triggers clarification)
                                                                            </label>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            <span>{item.itemDescription}</span>
                                                                            {item.isSuspected && (
                                                                                <span style={{
                                                                                    fontSize: '10px',
                                                                                    fontWeight: 700,
                                                                                    color: '#F97316',
                                                                                    background: '#FFF7ED',
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    border: '1px solid #FFEDD5',
                                                                                    width: 'fit-content'
                                                                                }}>
                                                                                    SUSPECTED
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="da-col">{item.orderDate}</td>
                                                                <td className="qt-col">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="number"
                                                                            value={inlineEditForm.quantity}
                                                                            style={{ width: '60px', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' }}
                                                                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, quantity: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <>
                                                                            <span className="q-p red">{item.quantityTotal.split('|')[0]}</span>
                                                                            <span className="q-s">|</span>
                                                                            <span className="q-p green">{item.quantityTotal.split('|')[1]}</span>
                                                                            <span className="q-s">|</span>
                                                                            <span className="q-p blue">{item.quantityTotal.split('|')[2]}</span>
                                                                        </>
                                                                    )}
                                                                </td>
                                                                <td className="un-col">
                                                                    {isEditing ? (
                                                                        <input
                                                                            type="text"
                                                                            value={inlineEditForm.unit}
                                                                            style={{ width: '50px', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '12px' }}
                                                                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, unit: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        item.unit
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="po-v4-supplier-footer-v4">
                                            {supplier.items.filter(i => i.selected).length} selected / {supplier.items.length} total
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Premium Gmail-Style Mail Modal */}
            {showMailView && selectedMail && (
                <div className="gmail-overlay">
                    <div className="gmail-compose">
                        <div className="gmail-header">
                            <span className="gmail-title">Outgoing Clarification Mail</span>
                            <div className="gmail-header-actions">
                                <X size={20} className="close-icon" onClick={() => setShowMailView(false)} />
                            </div>
                        </div>

                        <div className="gmail-body">
                            <div className="gmail-row">
                                <span className="gmail-label">To</span>
                                <input
                                    className="gmail-input"
                                    value={selectedMail.to}
                                    onChange={(e) => setSelectedMail({ ...selectedMail, to: e.target.value })}
                                />
                            </div>
                            <div className="gmail-row">
                                <span className="gmail-label">Subject</span>
                                <input
                                    className="gmail-input"
                                    value={selectedMail.subject}
                                    onChange={(e) => setSelectedMail({ ...selectedMail, subject: e.target.value })}
                                />
                            </div>

                            <div className="gmail-body" style={{ flex: 1, padding: 0 }}>
                                <textarea
                                    className="gmail-content"
                                    value={selectedMail.body}
                                    onChange={(e) => setSelectedMail({ ...selectedMail, body: e.target.value })}
                                    style={{ width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', padding: '16px', fontSize: '14px', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>

                        <div className="gmail-footer">
                            <div className="footer-left">
                                <button
                                    className="gmail-send-btn"
                                    onClick={handleSendMail}
                                    disabled={sendingReminder}
                                    style={{ opacity: sendingReminder ? 0.6 : 1, cursor: sendingReminder ? 'wait' : 'pointer' }}
                                >
                                    <Send size={15} style={{ marginRight: 8 }} />
                                    {sendingReminder ? 'Sending…' : 'Send'}
                                </button>
                                <div className="gmail-tool-icons">
                                    <span className="tool-icon-btn"><Paperclip size={20} /></span>
                                    <span className="tool-icon-btn"><LinkIcon size={20} /></span>
                                    <span className="tool-icon-btn"><Smile size={20} /></span>
                                    <span className="tool-icon-btn"><Image size={20} /></span>
                                    <span className="tool-icon-btn"><Mail size={20} /></span>
                                </div>
                            </div>
                            <div className="footer-right">
                                <span className="tool-icon-btn trash-icon" onClick={() => setShowMailView(false)}><Trash2 size={20} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Toast */}
            {showToast && (
                <div className="audit-success-toast">
                    <div className="toast-content-wrapper">
                        <div className="toast-icon-green">
                            <CheckCircle2 size={24} fill="#10B981" color="white" />
                        </div>
                        <div className="toast-text-area">
                            <h3>{toastMessage.title}</h3>
                            <p>{toastMessage.body}</p>
                        </div>
                    </div>
                    <button className="undo-action-btn" onClick={() => setShowToast(false)}>CLOSE</button>
                </div>
            )}

        </div>
    );
}
