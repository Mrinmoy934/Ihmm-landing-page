import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { api } from '../../lib/apiClient';
import './Fleet.css';

interface FleetItem {
    id: string;
    name: string;
    owner: string;
    manager: string;
}

export default function Fleet() {
    const [fleets, setFleets] = useState<FleetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    // Modal forms state
    const [showModal, setShowModal] = useState(false);
    const [editingFleet, setEditingFleet] = useState<FleetItem | null>(null);
    const [formData, setFormData] = useState({ name: '', owner: '', manager: '' });
    const [formError, setFormError] = useState<string | null>(null);

    // Delete confirm modal state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [fleetToDelete, setFleetToDelete] = useState<FleetItem | null>(null);

    const fetchFleets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const offset = (page - 1) * limit;
            const res = await api.get<{ data: FleetItem[]; total: number }>(
                `/fleets?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`
            );
            setFleets(res.data || []);
            setTotal(res.total || 0);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch fleets');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => {
        fetchFleets();
    }, [fetchFleets]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1); // Reset to page 1 on new search
    };

    const handleOpenAddModal = () => {
        setEditingFleet(null);
        setFormData({ name: '', owner: '', manager: '' });
        setFormError(null);
        setShowModal(true);
    };

    const handleOpenEditModal = (fleet: FleetItem) => {
        setEditingFleet(fleet);
        setFormData({ name: fleet.name, owner: fleet.owner, manager: fleet.manager });
        setFormError(null);
        setShowModal(true);
    };

    const handleSaveFleet = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!formData.name.trim()) {
            setFormError('Fleet Name is required.');
            return;
        }

        try {
            if (editingFleet) {
                // Edit
                await api.put(`/fleets/${editingFleet.id}`, formData);
            } else {
                // Add
                await api.post('/fleets', formData);
            }
            setShowModal(false);
            fetchFleets();
        } catch (err: any) {
            setFormError(err.message || 'Failed to save fleet');
        }
    };

    const handleOpenDeleteConfirm = (fleet: FleetItem) => {
        setFleetToDelete(fleet);
        setShowDeleteConfirm(true);
    };

    const handleDeleteFleet = async () => {
        if (!fleetToDelete) return;
        try {
            await api.delete(`/fleets/${fleetToDelete.id}`);
            setShowDeleteConfirm(false);
            setFleetToDelete(null);
            fetchFleets();
        } catch (err: any) {
            alert(err.message || 'Failed to delete fleet');
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
                            <h1>Fleet Management</h1>
                            <p>Manage and organize your vessel fleets and ownership records.</p>
                        </div>
                    </div>

                    <div className="audits-top-bar">
                        <div className="search-box">
                            <Search size={24} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search Fleets by Name, Owner or Manager..."
                                value={search}
                                onChange={handleSearchChange}
                            />
                        </div>

                        <div className="top-bar-right">
                            <button className="add-fleet-btn" onClick={handleOpenAddModal}>
                                <Plus size={18} /> ADD NEW FLEET
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            Loading fleets...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
                            {error}
                        </div>
                    ) : fleets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            No fleets found.
                        </div>
                    ) : (
                        <div className="table-container">
                            <div className="table-scroll-wrapper">
                                <table className="audits-table">
                                    <thead>
                                        <tr>
                                            <th className="th-action">ACTION</th>
                                            <th>NAME</th>
                                            <th>OWNER</th>
                                            <th>MANAGER</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fleets.map((fleet) => (
                                            <tr key={fleet.id}>
                                                <td className="action-column">
                                                    <div className="action-buttons">
                                                        <button 
                                                            className="action-btn edit-btn" 
                                                            title="Edit"
                                                            onClick={() => handleOpenEditModal(fleet)}
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button 
                                                            className="action-btn delete-btn" 
                                                            title="Delete"
                                                            onClick={() => handleOpenDeleteConfirm(fleet)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="vessel-name">{fleet.name}</td>
                                                <td>{fleet.owner}</td>
                                                <td>{fleet.manager}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="pagination">
                        <span className="pagination-info">
                            Showing {Math.min(total, (page - 1) * limit + 1)} to {Math.min(total, page * limit)} of {total} fleet records
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
                            <h2>{editingFleet ? 'Edit Fleet' : 'Add New Fleet'}</h2>
                            <button className="close-btn-white" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveFleet}>
                            <div className="send-review-body">
                                {formError && (
                                    <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>
                                        {formError}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label htmlFor="fleet-name">Fleet Name *</label>
                                    <input
                                        id="fleet-name"
                                        type="text"
                                        placeholder="e.g. Ice Class"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />

                                    <label htmlFor="fleet-owner">Owner</label>
                                    <input
                                        id="fleet-owner"
                                        type="text"
                                        placeholder="e.g. Thor Shipping Limited"
                                        value={formData.owner}
                                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                    />

                                    <label htmlFor="fleet-manager">Manager</label>
                                    <input
                                        id="fleet-manager"
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
                                    {editingFleet ? 'Save Changes' : 'Create Fleet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Delete Confirmation Modal Overlay */}
            {showDeleteConfirm && fleetToDelete && (
                <>
                    <div className="modal-backdrop-blur" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="send-review-modal danger-modal">
                        <div className="send-review-header">
                            <h2>Delete Fleet</h2>
                            <button className="close-btn-white" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="send-review-body">
                            <h3>Are you absolutely sure?</h3>
                            <p>
                                You are about to delete the fleet <strong style={{ color: '#0f172a' }}>{fleetToDelete.name}</strong>. 
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="send-review-footer">
                            <button type="button" className="btn-text-cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-danger-send" onClick={handleDeleteFleet}>
                                Delete Fleet
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
