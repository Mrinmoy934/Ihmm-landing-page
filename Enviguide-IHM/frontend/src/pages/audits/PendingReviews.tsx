import { useState, useEffect, useCallback } from 'react';
import './PendingReviews.css';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { Download, Eye, Edit2, Trash2, Ship, X, Search } from 'lucide-react';
import ReviewWizard from './ReviewWizard';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';

import type { AuditSummary } from '../../types';

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
        reviewStatus: 'Pending',
        assignedTo: a.reviewAssignedTo
            ? { name: String(a.reviewAssignedTo), avatar: '' }
            : undefined,
    };
}

// ReviewEditor removed as per new multi-step wizard requirement

export default function PendingReviews() {
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;
    const [allRecords, setAllRecords] = useState<AuditSummary[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState<AuditSummary | null>(null);
    const [editingRecord, setEditingRecord] = useState<AuditSummary | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadRecords = useCallback(() => {
        api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(ENDPOINTS.AUDITS.REVIEWS)
            .then((res) => {
                setAllRecords((res.data || []).map(auditFromApi));
            })
            .catch(() => setAllRecords([]));
    }, []);

    useEffect(() => {
        loadRecords();
        // Re-fetch when the tab regains focus (e.g. after sending an audit for review).
        const onFocus = () => loadRecords();
        const onVis = () => { if (document.visibilityState === 'visible') loadRecords(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [loadRecords]);

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
            // Remove only the exact row by its unique ID — not every row
            // sharing the same IMO (legacy duplicates).
            setAllRecords(prev => prev.filter(r => r.id !== id));
        }
        setShowDeleteModal(false);
        setDeletingRecord(null);
    };

    const handleWizardComplete = () => {
        setEditingRecord(null);
        // Review wizard may have marked the audit completed — re-fetch.
        loadRecords();
    };

    // Sorting and Filtering logic
    const filteredRecords = [...allRecords]
        .sort((a, b) => {
            // Sort by createDate descending (newest first)
            // If dates are available, otherwise fall back to array order
            const dateA = a.createDate || '';
            const dateB = b.createDate || '';
            return dateB.localeCompare(dateA);
        })
        .filter(record =>
            record.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.imoNumber.includes(searchQuery)
        );

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Pagination logic
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const currentRecords = filteredRecords.slice(startIndex, startIndex + recordsPerPage);

    return (
        <div className="pending-reviews-container">
            <Sidebar />
            <main className="pending-reviews-main">
                <Header />

                <div className="pending-reviews-content">
                    {/* Header Section */}
                    <div className="registry-header">
                        <div className="header-title-area" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div>
                                <h1>Pending Reviews Registry</h1>
                                <p>Audit submissions awaiting administrative verification and quality review.</p>
                            </div>
                        </div>
                        <div className="header-actions">
                            <div className="search-wrapper">
                                <Search size={24} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search Vessel Name or IMO..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button className="export-btn">
                                <Download size={18} />
                                EXPORT LIST
                            </button>
                        </div>
                    </div>

                    {/* Registry Table Card - Full Width */}
                    <div className="registry-table-card" style={{ width: '100%', maxWidth: 'none' }}>
                        <div className="table-wrapper">
                            <table className="registry-table">
                                <thead>
                                    <tr>
                                        <th>IMO NUMBER</th>
                                        <th>VESSEL NAME</th>
                                        <th>TOTAL PO</th>
                                        <th>TOTAL ITEMS</th>
                                        <th>REVIEW STATUS</th>
                                        <th>REVIEW ASSIGNED TO</th>
                                        <th style={{ textAlign: 'center' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentRecords.map((record, idx) => (
                                        <tr key={record.imoNumber + idx}>
                                            <td className="imo-cell">{record.imoNumber}</td>
                                            <td className="vessel-cell">
                                                <div className="vessel-icon-wrapper">
                                                    <Ship size={16} />
                                                </div>
                                                <span className="vessel-name">{record.vesselName}</span>
                                            </td>
                                            <td>{record.totalPO}</td>
                                            <td>{record.totalItems.toLocaleString()}</td>
                                            <td>
                                                <span className={`status-badge ${record.reviewStatus?.toLowerCase().replace(' ', '-') || 'pending'}`}>
                                                    {record.reviewStatus || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="assigned-cell">
                                                <img src={record.assignedTo?.avatar || 'https://i.pravatar.cc/150?u=unassigned'} alt="" className="reviewer-avatar" />
                                                <span className="reviewer-name">{record.assignedTo?.name || 'Unassigned'}</span>
                                            </td>
                                            <td className="action-cell">
                                                <div className="action-group">
                                                    <button
                                                        className="action-btn"
                                                        title="View"
                                                        onClick={() => setEditingRecord(record)}
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        className="action-btn"
                                                        title="Edit"
                                                        onClick={() => setEditingRecord(record)}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn delete"
                                                        title="Delete"
                                                        onClick={() => handleDelete(record)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Card Pagination Footer - Unified Style with Labels */}
                        <div className="table-footer">
                            <span className="pagination-info">
                                Showing {startIndex + 1} to {Math.min(startIndex + recordsPerPage, filteredRecords.length)} of {filteredRecords.length} pending reviews
                            </span>
                            <div className="pagination-buttons">
                                <button className="page-btn" style={{ width: 'auto', padding: '0 12px' }} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
                                {[...Array(totalPages)].map((_, idx) => {
                                    const pageNum = idx + 1;
                                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                                        return (
                                            <button
                                                key={pageNum}
                                                className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </button>
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

            </main>

            {/* Modals & Overlays */}
            {editingRecord && (
                <ReviewWizard
                    imo={editingRecord.imoNumber}
                    vesselName={editingRecord.vesselName}
                    auditId={editingRecord.id}
                    onClose={() => setEditingRecord(null)}
                    onComplete={handleWizardComplete}
                />
            )}

            {showDeleteModal && (
                <>
                    <div className="modal-backdrop-blur" onClick={() => setShowDeleteModal(false)} />
                    <div className="send-review-modal">
                        <div className="send-review-header" style={{ background: '#EF4444' }}>
                            <h2>DELETE RECORD</h2>
                            <button className="close-btn-white" onClick={() => setShowDeleteModal(false)}><X size={18} /></button>
                        </div>
                        <div className="send-review-body">
                            <h3>Permanently delete this review record?</h3>
                            <p>This action will remove all audit data for this vessel from the review registry. This cannot be undone.</p>
                        </div>
                        <div className="send-review-footer">
                            <button className="btn-text-cancel" onClick={() => setShowDeleteModal(false)}>CANCEL</button>
                            <button className="btn-primary-send" style={{ background: '#EF4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }} onClick={confirmDelete}>
                                YES, DELETE
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
