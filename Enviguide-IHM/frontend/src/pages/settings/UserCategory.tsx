import { useState } from 'react';
import { 
    Search, Plus, Edit2, 
    Trash2, Filter, Download,
    Tag, Archive,
    ChevronRight
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import './UserCategory.css';

interface CategoryData {
    id: string;
    name: string;
    count: number;
    status: 'Active' | 'Archived';
}

const MOCK_CATEGORIES: CategoryData[] = [
    { id: '1', name: 'Ship Owner', count: 42, status: 'Active' },
    { id: '2', name: 'Ship Builder', count: 18, status: 'Active' },
    { id: '3', name: 'Manufacturers', count: 125, status: 'Active' },
    { id: '4', name: 'Suppliers', count: 86, status: 'Active' },
    { id: '5', name: 'Ship Recycling Yard', count: 12, status: 'Active' },
    { id: '6', name: 'Banks', count: 24, status: 'Active' },
    { id: '7', name: 'Insurers', count: 15, status: 'Active' },
    { id: '8', name: 'Vessel Agent', count: 33, status: 'Active' },
    { id: '9', name: 'Charterers', count: 29, status: 'Active' },
    { id: '10', name: 'Port State Controls (PSCs)', count: 54, status: 'Active' }
];

export default function UserCategory() {
    const [searchTerm, setSearchTerm] = useState('');
    const [categories] = useState<CategoryData[]>(MOCK_CATEGORIES);

    const filteredCategories = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="category-page-container">
            <Sidebar />
            <main className="category-page-main">
                <Header notificationCount={2} />
                
                <div className="category-content-wrapper">
                    <div className="category-page-header">
                        <div className="header-info">
                            <div className="breadcrumb">SECURITY / USER CATEGORY</div>
                            <h1>User Categories</h1>
                            <p>Manage and organize different types of user groups within the maritime ecosystem.</p>
                        </div>
                        <div className="header-actions">
                            <button className="btn-secondary-outline">
                                <Archive size={18} />
                                <span>Archived Categories</span>
                            </button>
                            <button className="btn-primary-gradient">
                                <Plus size={20} />
                                <span>Add New Category</span>
                            </button>
                        </div>
                    </div>

                    <div className="category-main-card">
                        <div className="category-toolbar">
                            <div className="search-box-unified">
                                <Search size={18} className="search-icon" />
                                <input 
                                    type="text" 
                                    placeholder="Search categories by name..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <div className="toolbar-actions">
                                <button className="btn-icon-square">
                                    <Filter size={18} />
                                </button>
                                <button className="btn-icon-square">
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="table-wrapper">
                            <table className="category-table">
                                <thead>
                                    <tr>
                                        <th className="action-col">Action</th>
                                        <th>Category Name</th>
                                        <th>Associated Users</th>
                                        <th>Status</th>
                                        <th className="text-right">Manage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCategories.map(cat => (
                                        <tr key={cat.id}>
                                            <td className="action-col">
                                                <div className="btn-group-mini">
                                                    <button className="btn-table-action edit" title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className="btn-table-action delete" title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="name-cell">
                                                    <div className="tag-icon-wrapper">
                                                        <Tag size={14} />
                                                    </div>
                                                    <span className="category-name-text">{cat.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="count-pill">
                                                    {cat.count} Users
                                                </div>
                                            </td>
                                            <td>
                                                <span className="status-indicator active">Active</span>
                                            </td>
                                            <td className="text-right">
                                                <button className="btn-arrow-link">
                                                    <ChevronRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="category-footer">
                            <span className="total-summary">Total <b>{categories.length}</b> user categories identified</span>
                            <div className="mini-pagination">
                                <button disabled>Back</button>
                                <span className="active-page">1</span>
                                <button disabled>Next</button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section seen in screenshot */}
                    <div className="archived-section-teaser">
                        <div className="teaser-content">
                            <Archive size={20} className="teaser-icon" />
                            <div className="teaser-text">
                                <h3>Archived User Categories</h3>
                                <p>View and restore categories that are no longer in active use.</p>
                            </div>
                        </div>
                        <button className="btn-view-archive">View Archive List</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
