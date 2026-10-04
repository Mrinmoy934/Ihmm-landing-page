import { useState } from 'react';
import { 
    Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, 
    Layout, Archive, RotateCcw
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import './UserMenu.css';

interface MenuItem {
    id: number;
    title: string;
    description: string;
    path: string;
    icon?: string;
}

const INITIAL_MENU_ITEMS: MenuItem[] = [
    { id: 1, title: 'Admin Dashboard', description: 'Access administrative analytics and controls', path: '/admin/dashboard' },
    { id: 2, title: 'Owner Dashboard', description: 'Specific view for ship owners and partners', path: '/owner/dashboard' },
    { id: 3, title: 'Vessel', description: 'Manage fleet and individual vessel data', path: '/vessels' },
    { id: 4, title: 'Administration', description: 'System-wide administrative settings', path: '/administration' },
    { id: 5, title: 'Security', description: 'User roles, rights and system security', path: '/security' },
    { id: 6, title: 'Menu', description: 'Configure dynamic navigation paths', path: '/menu' },
    { id: 7, title: 'Ship', description: 'Detailed ship specifications and history', path: '/ship' },
    { id: 8, title: 'Fleet', description: 'Fleet-wide monitoring and reporting', path: '/fleet' },
    { id: 9, title: 'Sub Fleet', description: 'Organizational sub-groups for vessels', path: '/sub-fleet' },
    { id: 10, title: 'Upload Purchase Orders', description: 'Bulk import PO documentation', path: '/upload-po' }
];

const ARCHIVED_MENU_ITEMS: MenuItem[] = [
    { id: 99, title: 'Legacy Reporting', description: 'V1 system reports', path: '/legacy/reports' },
    { id: 98, title: 'Old Fleet View', description: 'Deprecated list view', path: '/old/fleet' }
];

export default function UserMenu() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
    const [archivedItems, setArchivedItems] = useState<MenuItem[]>(ARCHIVED_MENU_ITEMS);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const filteredItems = menuItems.filter((item: MenuItem) => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

    const handleDelete = (id: number) => {
        if (window.confirm('Are you sure you want to archive this menu item?')) {
            const itemToArchive = menuItems.find((item: MenuItem) => item.id === id);
            if (itemToArchive) {
                setMenuItems(menuItems.filter((item: MenuItem) => item.id !== id));
                setArchivedItems([...archivedItems, itemToArchive]);
            }
        }
    };

    const handleRestore = (id: number) => {
        const itemToRestore = archivedItems.find((item: MenuItem) => item.id === id);
        if (itemToRestore) {
            setArchivedItems(archivedItems.filter((item: MenuItem) => item.id !== id));
            setMenuItems([...menuItems, itemToRestore]);
        }
    };

    return (
        <div className="usermenu-page-container">
            <Sidebar />
            <div className="usermenu-page-main">
                <Header notificationCount={3} />
                
                <div className="usermenu-content-wrapper">
                    {/* Header Section */}
                    <div className="usermenu-header-section">
                        <div className="header-titles">
                            <h1>User Menu</h1>
                            <p>Configure and manage dynamic navigation items across the platform.</p>
                        </div>
                        <div className="header-actions">
                            <div className="premium-search-bar">
                                <Search size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search menu items..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="add-menu-btn-premium">
                                <Plus size={20} />
                                <span>Create Menu Item</span>
                            </button>
                        </div>
                    </div>

                    {/* Active Menu Card */}
                    <div className="usermenu-glass-card">
                        <div className="card-header-premium">
                            <div className="indicator-group">
                                <Layout size={18} color="#00B0FA" />
                                <h3>Active Navigation Items ({menuItems.length})</h3>
                            </div>
                        </div>

                        <div className="premium-table-container">
                            <table className="usermenu-table-premium">
                                <thead>
                                    <tr>
                                        <th className="th-action">ACTION</th>
                                        <th className="th-title">TITLE</th>
                                        <th className="th-desc">DESCRIPTION / PATH</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedItems.map((item: MenuItem) => (
                                        <tr key={item.id} className="row-hover-premium">
                                            <td className="action-column">
                                                <div className="action-btn-group">
                                                    <button className="icon-btn-edit" title="Edit">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        className="icon-btn-delete" 
                                                        title="Archive"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="title-column">
                                                <div className="title-with-icon">
                                                    <span className="title-text">{item.title}</span>
                                                </div>
                                            </td>
                                            <td className="path-column">
                                                <div className="path-text-group">
                                                    <span className="path-val">{item.path}</span>
                                                    <span className="desc-val">{item.description}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination-footer-premium">
                            <span className="total-items">Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} total</span>
                            <div className="pagination-controls">
                                <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p: number) => p - 1)}
                                    className="page-btn"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="page-numbers">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`page-num-btn ${currentPage === i + 1 ? 'active' : ''}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p: number) => p + 1)}
                                    className="page-btn"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Archived Menu Card */}
                    <div className="usermenu-glass-card archived-section">
                        <div className="card-header-premium">
                            <div className="indicator-group">
                                <Archive size={18} color="#64748B" />
                                <h3>Archived User Menu ({archivedItems.length})</h3>
                            </div>
                        </div>
                        {archivedItems.length > 0 ? (
                            <div className="premium-table-container">
                                <table className="usermenu-table-premium archived">
                                    <tbody>
                                        {archivedItems.map((item: MenuItem) => (
                                            <tr key={item.id} className="archived-row">
                                                <td className="action-column">
                                                    <button 
                                                        className="icon-btn-restore" 
                                                        title="Restore"
                                                        onClick={() => handleRestore(item.id)}
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                </td>
                                                <td className="title-column">
                                                    <span className="title-text archived">{item.title}</span>
                                                </td>
                                                <td className="path-column">
                                                    <span className="path-val">{item.path}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-archive">
                                <span className="empty-text">No archived items found.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
