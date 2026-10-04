import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import './SubFleet.css';

interface SubFleetItem {
    id: string;
    name: string;
    parentFleetId: string;
    parentFleetName: string;
    owner: string;
    manager: string;
}

interface FleetOption {
    id: string;
    name: string;
    owner: string;
    manager: string;
}

export default function SubFleet() {
    const [subFleets, setSubFleets] = useState<SubFleetItem[]>([]);
    const [parentFleets, setParentFleets] = useState<FleetOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    // Modals forms state
    const [showModal, setShowModal] = useState(false);
    const [editingSubFleet, setEditingSubFleet] = useState<SubFleetItem | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        parentFleetId: '',
        parentFleetName: '',
        owner: '',
        manager: ''
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Delete confirm modal state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [subFleetToDelete, setSubFleetToDelete] = useState<SubFleetItem | null>(null);

    const fetchSubFleets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const offset = (page - 1) * limit;
            const res = await api.get<{ data: SubFleetItem[]; total: number }>(
                `/sub-fleets?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`
            );
            setSubFleets(res.data || []);
            setTotal(res.total || 0);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch sub-fleets');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    const fetchParentFleets = async () => {
        try {
            const res = await api.get<{ data: FleetOption[] }>('/fleets?limit=100');
            setParentFleets(res.data || []);
        } catch (err) {
            console.error('Failed to load parent fleets for dropdown selection:', err);
        }
    };

    useEffect(() => {
        fetchSubFleets();
    }, [fetchSubFleets]);

    useEffect(() => {
        fetchParentFleets();
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1); // Reset to page 1 on new search
    };

    const handleOpenAddModal = () => {
        setEditingSubFleet(null);
        setFormData({ name: '', parentFleetId: '', parentFleetName: '', owner: '', manager: '' });
        setFormError(null);
        setShowModal(true);
    };

    const handleOpenEditModal = (item: SubFleetItem) => {
        setEditingSubFleet(item);
        setFormData({
            name: item.name,
            parentFleetId: item.parentFleetId,
            parentFleetName: item.parentFleetName,
            owner: item.owner,
            manager: item.manager
        });
        setFormError(null);
        setShowModal(true);
    };

    const handleParentFleetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const selected = parentFleets.find(x => x.id === id);
        if (selected) {
            setFormData({
                ...formData,
                parentFleetId: id,
                parentFleetName: selected.name,
                owner: selected.owner !== '-' ? selected.owner : formData.owner,
                manager: selected.manager !== '-' ? selected.manager : formData.manager
            });
        } else {
            setFormData({
                ...formData,
                parentFleetId: '',
                parentFleetName: ''
            });
        }
    };

    const handleSaveSubFleet = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!formData.name.trim()) {
            setFormError('Sub-fleet Name is required.');
            return;
        }
        if (!formData.parentFleetId) {
            setFormError('Parent Fleet is required.');
            return;
        }

        try {
            if (editingSubFleet) {
                // Edit
                await api.put(`/sub-fleets/${editingSubFleet.id}`, formData);
            } else {
                // Add
                await api.post('/sub-fleets', formData);
            }
            setShowModal(false);
            fetchSubFleets();
        } catch (err: any) {
            setFormError(err.message || 'Failed to save sub-fleet');
        }
    };

    const handleOpenDeleteConfirm = (item: SubFleetItem) => {
        setSubFleetToDelete(item);
        setShowDeleteConfirm(true);
    };

    const handleDeleteSubFleet = async () => {
        if (!subFleetToDelete) return;
        try {
            await api.delete(`/sub-fleets/${subFleetToDelete.id}`);
            setShowDeleteConfirm(false);
            setSubFleetToDelete(null);
            fetchSubFleets();
        } catch (err: any) {
            alert(err.message || 'Failed to delete sub-fleet');
        }
    };

    const totalPages = Math.ceil(total / limit) || 1;

    return (
        <div className="pending-audits-container">
            <Sidebar />
            <main className="pending-audits-main">
                <Header />
                <div className="pending-audits-content">
                    <div className="md-header">
                        <div className="md-title-area">
                            <h1>Sub-Fleet Management</h1>
                            <p>Organize your vessels into specialized sub-fleets for better reporting and tracking.</p>
                        </div>
                    </div>

                    <div className="audits-top-bar">
                        <div className="search-box">
                            <Search size={24} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search Sub-fleets by Name, Fleet, Owner or Manager..."
                                value={search}
                                onChange={handleSearchChange}
                            />
                        </div>

                        <div className="top-bar-right">
                            <button className="add-fleet-btn" onClick={handleOpenAddModal}>
                                <Plus size={18} /> ADD SUB-FLEET
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            Loading sub-fleets...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
                            {error}
                        </div>
                    ) : subFleets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            No sub-fleets found.
                        </div>
                    ) : (
                        <div className="table-container">
                            <div className="table-scroll-wrapper">
                                <table className="audits-table">
                                    <thead>
                                        <tr>
                                            <th className="sf-th-action">Action</th>
                                            <th>Name</th>
                                            <th>Parent Fleet</th>
                                            <th>Owner</th>
                                            <th>Manager</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subFleets.map((item) => (
                                            <tr key={item.id}>
                                                <td className="sf-action-column">
                                                    <div className="sf-action-buttons">
                                                        <button 
                                                            className="sf-action-btn sf-edit-btn" 
                                                            title="Edit"
                                                            onClick={() => handleOpenEditModal(item)}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button 
                                                            className="sf-action-btn sf-delete-btn" 
                                                            title="Delete"
                                                            onClick={() => handleOpenDeleteConfirm(item)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="vessel-name">{item.name}</td>
                                                <td>{item.parentFleetName}</td>
                                                <td>{item.owner}</td>
                                                <td>{item.manager}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="pagination" style={{ flexShrink: 0 }}>
                        <span className="pagination-info">
                            Showing {Math.min(total, (page - 1) * limit + 1)} to {Math.min(total, page * limit)} of {total} sub-fleet records
                        </span>
                        {totalPages > 1 && (
                            <div className="pagination-buttons">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <button 
                                        key={p} 
                                        className={`page-btn ${page === p ? 'active' : ''}`}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Add / Edit Modal Overlay */}
            {showModal && (
                <>
                    <div className="modal-backdrop-blur" onClick={() => setShowModal(false)} />
                    <div className="send-review-modal">
                        <div className="send-review-header">
                            <h2>{editingSubFleet ? 'Edit Sub-Fleet' : 'Add New Sub-Fleet'}</h2>
                            <button className="close-btn-white" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSubFleet}>
                            <div className="send-review-body">
                                {formError && (
                                    <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
                                        {formError}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label htmlFor="sf-name">Sub-Fleet Name *</label>
                                    <input
                                        id="sf-name"
                                        type="text"
                                        placeholder="e.g. FS Class 211"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />

                                    <label htmlFor="sf-parent">Parent Fleet *</label>
                                    <select
                                        id="sf-parent"
                                        value={formData.parentFleetId}
                                        onChange={handleParentFleetChange}
                                        required
                                    >
                                        <option value="">— Select Parent Fleet —</option>
                                        {parentFleets.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>

                                    <label htmlFor="sf-owner">Owner</label>
                                    <input
                                        id="sf-owner"
                                        type="text"
                                        placeholder="e.g. Thor Shipping Limited"
                                        value={formData.owner}
                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                    />

                                    <label htmlFor="sf-manager">Manager</label>
                                    <input
                                        id="sf-manager"
                                        type="text"
                                        placeholder="e.g. Bernhard Schulte Shipmanagement"
                                        value={formData.manager}
                                        onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="send-review-footer">
                                <button type="button" className="btn-text-cancel" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary-send">
                                    {editingSubFleet ? 'Save Changes' : 'Create Sub-Fleet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Delete Confirmation Modal Overlay */}
            {showDeleteConfirm && subFleetToDelete && (
                <>
                    <div className="modal-backdrop-blur" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="send-review-modal danger-modal">
                        <div className="send-review-header">
                            <h2>Delete Sub-Fleet</h2>
                            <button className="close-btn-white" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="send-review-body">
                            <h3>Are you absolutely sure?</h3>
                            <p>
                                You are about to delete the sub-fleet <strong style={{ color: '#0f172a' }}>{subFleetToDelete.name}</strong>. 
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="send-review-footer">
                            <button type="button" className="btn-text-cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-danger-send" onClick={handleDeleteSubFleet}>
                                Delete Sub-Fleet
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
