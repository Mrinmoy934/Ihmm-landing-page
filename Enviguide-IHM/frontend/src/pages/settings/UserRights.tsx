import { useState, useEffect, useRef } from 'react';
import { 
    ChevronDown, ChevronRight, Save, X, Shield, 
    Check, Minus
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import './UserRights.css';

interface PermissionNode {
    id: string;
    label: string;
    children?: PermissionNode[];
}

const PERMISSIONS_DATA: PermissionNode[] = [
    { id: 'admin_dashboard', label: 'Admin Dashboard' },
    { id: 'owner_dashboard', label: 'Owner Dashboard' },
    {
        id: 'vessel',
        label: 'Vessel',
        children: [
            {
                id: 'ship',
                label: 'Ship',
                children: [
                    { id: 'ship_view', label: 'View Record' },
                    { id: 'ship_add', label: 'Add Record' },
                    { id: 'ship_edit', label: 'Edit Record' },
                    { id: 'ship_delete', label: 'Delete Record' },
                    { id: 'ship_restore', label: 'Restore Record' },
                ]
            },
            {
                id: 'fleet',
                label: 'Fleet',
                children: [
                    { id: 'fleet_view', label: 'View Record' },
                    { id: 'fleet_add', label: 'Add Record' },
                    { id: 'fleet_edit', label: 'Edit Record' },
                    { id: 'fleet_delete', label: 'Delete Record' },
                    { id: 'fleet_restore', label: 'Restore Record' },
                ]
            },
            {
                id: 'sub_fleet',
                label: 'Sub Fleet',
                children: [
                    { id: 'subfleet_view', label: 'View Record' },
                    { id: 'subfleet_add', label: 'Add Record' },
                    { id: 'subfleet_edit', label: 'Edit Record' },
                    { id: 'subfleet_delete', label: 'Delete Record' },
                    { id: 'subfleet_restore', label: 'Restore Record' },
                ]
            }
        ]
    },
    {
        id: 'administration',
        label: 'Administration',
        children: [
            {
                id: 'upload_po',
                label: 'Upload Purchase Orders',
                children: [
                    { id: 'upo_view', label: 'View Record' },
                    { id: 'upo_add', label: 'Add Record' },
                    { id: 'upo_edit', label: 'Edit Record' },
                    { id: 'upo_delete', label: 'Delete Record' },
                    { id: 'upo_restore', label: 'Restore Record' },
                ]
            },
            {
                id: 'pending_audits',
                label: 'Pending Audits',
                children: [
                    { id: 'pa_view', label: 'View Record' },
                    { id: 'pa_add', label: 'Add Record' },
                    { id: 'pa_edit', label: 'Edit Record' },
                    { id: 'pa_delete', label: 'Delete Record' },
                    { id: 'pa_restore', label: 'Restore Record' },
                ]
            },
            {
                id: 'pending_review',
                label: 'Pending Review',
                children: [
                    { id: 'pr_view', label: 'View Record' },
                    { id: 'pr_add', label: 'Add Record' }
                ]
            }
        ]
    }
];

const USERS = [
    { id: 1, name: 'John Administrator', role: 'Admin', email: 'john.admin@enviguide.com' },
    { id: 2, name: 'Vishnu', role: 'Premium User', email: 'vishnu@example.com' },
    { id: 3, name: 'Sarah Marine', role: 'Viewer', email: 'sarah.m@example.com' }
];

export default function UserRights() {
    const [selectedUser, setSelectedUser] = useState(USERS[0]);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['vessel', 'administration', 'ship', 'fleet', 'sub_fleet', 'upload_po', 'pending_audits', 'pending_review']));
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getAllChildIds = (node: PermissionNode): string[] => {
        let ids = [node.id];
        if (node.children) {
            node.children.forEach(child => {
                ids = [...ids, ...getAllChildIds(child)];
            });
        }
        return ids;
    };

    const togglePermission = (node: PermissionNode) => {
        const idsToToggle = getAllChildIds(node);
        const newCheckedIds = new Set(checkedIds);
        const allChecked = idsToToggle.every(id => checkedIds.has(id));

        if (allChecked) {
            idsToToggle.forEach(id => newCheckedIds.delete(id));
        } else {
            idsToToggle.forEach(id => newCheckedIds.add(id));
        }
        setCheckedIds(newCheckedIds);
    };

    const toggleExpansion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpandedIds = new Set(expandedIds);
        if (newExpandedIds.has(id)) {
            newExpandedIds.delete(id);
        } else {
            newExpandedIds.add(id);
        }
        setExpandedIds(newExpandedIds);
    };

    const isNodeSemiChecked = (node: PermissionNode): boolean => {
        if (!node.children || node.children.length === 0) return false;
        const childIds = getAllChildIds(node).filter(id => id !== node.id);
        const checkedChildren = childIds.filter(id => checkedIds.has(id));
        return checkedChildren.length > 0 && checkedChildren.length < childIds.length;
    };

    const handleAllToggle = () => {
        const allIds: string[] = [];
        const flatGet = (nodes: PermissionNode[]) => {
            nodes.forEach(n => {
                allIds.push(n.id);
                if (n.children) flatGet(n.children);
            });
        };
        flatGet(PERMISSIONS_DATA);

        if (checkedIds.size === allIds.length && allIds.length > 0) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(allIds));
        }
    };

    const renderPermissionNode = (node: PermissionNode, level: number = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isChecked = checkedIds.has(node.id) || (hasChildren && getAllChildIds(node).every(id => checkedIds.has(id)));
        const isSemi = isNodeSemiChecked(node);

        return (
            <div key={node.id} className={`permission-node-wrapper level-${level}`}>
                <div className="permission-node-row" onClick={() => togglePermission(node)}>
                    <div className="node-expander" onClick={(e) => { e.stopPropagation(); hasChildren && toggleExpansion(node.id, e); }}>
                        {hasChildren ? (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : null}
                    </div>
                    
                    <div className={`checkbox-custom ${isChecked ? 'checked' : ''} ${isSemi ? 'semi' : ''}`}>
                        {isChecked && <Check size={12} />}
                        {isSemi && !isChecked && <Minus size={12} />}
                    </div>
                    <span className="node-label">{node.label}</span>
                </div>

                {hasChildren && isExpanded && (
                    <div className="node-children">
                        {node.children!.map(child => renderPermissionNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const allIdsList: string[] = [];
    const flatGet = (nodes: PermissionNode[]) => {
        nodes.forEach(n => {
            allIdsList.push(n.id);
            if (n.children) flatGet(n.children);
        });
    };
    flatGet(PERMISSIONS_DATA);
    const isMasterAllChecked = checkedIds.size === allIdsList.length && allIdsList.length > 0;
    const isMasterAllSemi = checkedIds.size > 0 && checkedIds.size < allIdsList.length;

    return (
        <div className="userrights-page-container">
            <Sidebar />
            <div className="userrights-page-main">
                <Header notificationCount={3} />
                
                <div className="userrights-content-wrapper">
                    <div className="userrights-header">
                        <div className="header-titles">
                            <h1>User Rights</h1>
                            <p>Configure granular access control and functional permissions for users.</p>
                        </div>
                        <div className="header-actions">
                            <button className="userrights-action-btn cancel">
                                <X size={20} />
                                <span>Cancel Changes</span>
                            </button>
                            <button className="userrights-action-btn save">
                                <Save size={20} />
                                <span>Save Permissions</span>
                            </button>
                        </div>
                    </div>

                    <div className="userrights-grid">
                        {/* Left Card */}
                        <div className="userrights-card">
                            <label className="selector-label">SELECT USER</label>
                            <div className="selector-group" ref={dropdownRef} style={{ position: 'relative' }}>
                                <div 
                                    className={`premium-user-dropdown ${isUserDropdownOpen ? 'active' : ''}`}
                                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                >
                                    <div className="user-meta">
                                        <span className="user-name-val-top">{selectedUser.name}</span>
                                        <span className="user-role-val-mini">{selectedUser.role}</span>
                                    </div>
                                    <ChevronDown size={18} className={`select-chevron ${isUserDropdownOpen ? 'rotate' : ''}`} />
                                </div>

                                {isUserDropdownOpen && (
                                    <div className="user-dropdown-menu-absolute">
                                        {USERS.map(user => (
                                            <div 
                                                key={user.id} 
                                                className={`user-dropdown-item-premium ${selectedUser.id === user.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setIsUserDropdownOpen(false);
                                                }}
                                            >
                                                <div className="item-details">
                                                    <span className="item-name">{user.name}</span>
                                                    <span className="item-role">{user.role}</span>
                                                </div>
                                                {selectedUser.id === user.id && <Check size={14} color="#00B2FF" />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="user-access-summary">
                                <div className="summary-title">Access Status</div>
                                <div className="status-badge-active">
                                    <Shield size={20} color="#334E68" />
                                    <span>Authenticated Account</span>
                                </div>
                                <div className="summary-desc">
                                    Granting permissions below will take effect immediately upon saving.
                                </div>
                            </div>
                        </div>

                        {/* Right Card */}
                        <div className="userrights-card">
                            <div className="tree-header">
                                <div className="tree-title-group">
                                    <Shield size={20} color="#00B2FF" />
                                    <h3>Permission Hierarchy</h3>
                                </div>
                                <button className="select-all-btn" onClick={handleAllToggle}>
                                    Select All
                                </button>
                            </div>

                            <div className="permissions-tree-container">
                                <div className="tree-scroll-area">
                                    <div className="permission-node-wrapper level-0 master-all">
                                        <div className="permission-node-row" onClick={handleAllToggle}>
                                            <div className="node-expander"></div>
                                            <div className={`checkbox-custom ${isMasterAllChecked ? 'checked' : (isMasterAllSemi ? 'semi' : '')}`}>
                                                {isMasterAllChecked && <Check size={12} />}
                                                {isMasterAllSemi && <Minus size={12} />}
                                            </div>
                                            <span className="node-label">All</span>
                                        </div>
                                    </div>
                                    {PERMISSIONS_DATA.map(node => renderPermissionNode(node))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
