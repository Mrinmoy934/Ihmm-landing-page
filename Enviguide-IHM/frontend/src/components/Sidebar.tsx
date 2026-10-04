import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Ship,
    Layers,
    FileText,
    Settings,
    Upload,
    Mail,
    ChevronDown,
    ChevronLeft,
    Menu as MenuIcon,
    Lock,
    ClipboardCheck,
    Building2,
    UserCog,
    Package,
    AlertOctagon,
    KeyRound,
    Users,
    ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ihmLogo from '../assets/ihm_logo.webp';
import './Sidebar.css';

interface MenuChild {
    path: string;
    label: string;
    icon?: any;
    /** Permission node id required to see this child. Omit for public items. */
    requires?: string;
}

interface MenuItem {
    path: string;
    icon: any;
    label: string;
    /** Permission required to see a leaf menu item. Parents with children
     *  inherit visibility from their children — they show up if any child
     *  is visible to the user, regardless of this field. */
    requires?: string;
    children?: MenuChild[];
}

/**
 * Detail / wizard pages don't have their own sidebar entry, but they
 * logically belong to one of the existing sub-items. When the user is
 * on one of these routes, we keep the parent menu expanded and the
 * matching sub-item highlighted as if they were on the list page.
 *
 *   key   = the sub-item path that should light up
 *   value = predicate run against the current pathname
 */
const CHILD_ROUTE_ALIASES: Record<string, (path: string) => boolean> = {
    '/administration/md-sdoc-audit': (p) => p.startsWith('/administration/document-audit/'),
    '/administration/pending-reviews': (p) => p.startsWith('/administration/review-detail/'),
};

function matchesChildRoute(childPath: string, currentPath: string): boolean {
    if (currentPath === childPath) return true;
    const alias = CHILD_ROUTE_ALIASES[childPath];
    return alias ? alias(currentPath) : false;
}

// Permission map — every gated route below points at one of the node ids
// seeded by the backend migration (vessels_read, audits_read, etc.).
// Items without `requires` are visible to everyone (e.g. Dashboard, Contact).
const menuItems: MenuItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Admin Dashboard' },
    {
        path: '/vessels',
        icon: Ship,
        label: 'Vessel',
        children: [
            { path: '/vessels/ship', icon: Ship, label: 'Ship', requires: 'vessels_read' },
            { path: '/vessels/fleet', icon: Layers, label: 'Fleet', requires: 'vessels_read' },
            { path: '/vessels/sub-fleet', icon: Layers, label: 'Sub Fleet', requires: 'vessels_read' },
        ]
    },
    {
        path: '/menu',
        icon: MenuIcon,
        label: 'Menu',
        children: [
            { path: '/menu/registered', icon: ClipboardCheck, label: 'Registered', requires: 'vessels_read' },
            { path: '/menu/ownership', icon: Building2, label: 'Registered Owner', requires: 'vessels_read' },
            { path: '/menu/ownership-manager', icon: UserCog, label: 'Ship Manager', requires: 'vessels_read' },
            { path: '/menu/supplier', icon: Package, label: 'Supplier', requires: 'settings_read' },
            { path: '/menu/suspended', icon: AlertOctagon, label: 'Suspended', requires: 'audits_read' },
            { path: '/menu/suspected-keyword', icon: KeyRound, label: 'Suspected Keyword', requires: 'settings_read' },
        ]
    },
    {
        path: '/administration',
        icon: Settings,
        label: 'Administration',
        children: [
            { path: '/administration/upload-po', icon: Upload, label: 'Upload Purchase Order', requires: 'purchase_orders_create' },
            { path: '/administration/pending-audits', icon: FileText, label: 'Pending Audits', requires: 'audits_read' },
            { path: '/administration/pending-reviews', icon: FileText, label: 'Pending Reviews', requires: 'audits_read' },
            { path: '/administration/md-sdoc-audit', icon: FileText, label: 'MD SDOC Audit Pending', requires: 'audits_read' },
        ]
    },
    {
        path: '/security',
        icon: Lock,
        label: 'Security',
        children: [
            { path: '/security/users', icon: Users, label: 'Users', requires: 'security_read' },
            { path: '/security/authorizations', icon: ShieldCheck, label: 'Authorizations', requires: 'security_update' },
        ]
    },
    { path: '/contact', icon: Mail, label: 'Contact Us' },
];

export default function Sidebar() {
    const location = useLocation();
    const { hasPermission, user } = useAuth();
    const [expandedItem, setExpandedItem] = useState<string>('');
    const [activeFocus, setActiveFocus] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // Filter the menu against the current user's permissions.
    //
    // Three bypass cases — when ANY of them holds, show the full menu:
    //   1. No user yet (initial render, or auth still loading).
    //   2. user.isAdmin === true (admin / superadmin / manager).
    //   3. user.permissions is empty — this is the "legacy" state for
    //      every account that pre-dates the Authorizations feature, or
    //      whose grants haven't been edited yet. Filtering them would
    //      hide the entire app on first login, which is wrong.
    //
    // The matrix only takes effect once an admin has explicitly clicked
    // Save with a non-empty permission set, which is the natural moment
    // a user becomes "scoped". Until then, behaviour matches what
    // existed before this feature shipped.
    const visibleMenu = useMemo<MenuItem[]>(() => {
        if (!user) return menuItems;
        
        const role = (user.roleName || user.role || '').toLowerCase();
        const isOwnerOrManager = role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role.includes('owner') || role.includes('manager');
        const isVessel = role === 'vessel' || role.includes('vessel');

        if (isOwnerOrManager || isVessel) {
            const out: MenuItem[] = [];
            for (const item of menuItems) {
                if (item.path === '/dashboard') {
                    out.push({ ...item, label: 'Dashboard' });
                } else if (item.path === '/vessels') {
                    out.push({ 
                        path: '/vessels/ship', 
                        icon: item.icon, 
                        label: 'Vessel' 
                    });
                } else if (item.path === '/contact') {
                    out.push(item);
                }
            }
            return out;
        }

        if (user.isAdmin) return menuItems;
        const out: MenuItem[] = [];
        for (const item of menuItems) {
            if (item.children && item.children.length > 0) {
                const kids = item.children.filter((c) => !c.requires || hasPermission(c.requires));
                if (kids.length > 0) out.push({ ...item, children: kids });
            } else if (!item.requires || hasPermission(item.requires)) {
                out.push(item);
            }
        }
        return out;
    }, [user, hasPermission]);

    useEffect(() => {
        const currentPath = location.pathname;
        const parentItem = visibleMenu.find(item =>
            item.children?.some(child => matchesChildRoute(child.path, currentPath)),
        );
        if (parentItem) {
            setExpandedItem(parentItem.label);
        }
    }, [location.pathname, visibleMenu]);

    const toggleSubmenu = (label: string) => {
        if (isCollapsed) {
            setIsCollapsed(false);
            setExpandedItem(label);
            setActiveFocus(label);
            return;
        }

        if (expandedItem === label) {
            setExpandedItem('');
            setActiveFocus(null);
        } else {
            setExpandedItem(label);
            setActiveFocus(label);
        }
    };

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isLocked ? 'locked' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <img src={ihmLogo} alt="IHM Logo" className="sidebar-brand-logo" />
                </div>
                <button
                    className="sidebar-toggle-btn"
                    onClick={() => {
                        if (!isCollapsed) {
                            setIsLocked(true);
                            setTimeout(() => setIsLocked(false), 500);
                        }
                        setIsCollapsed(!isCollapsed);
                    }}
                >
                    <ChevronLeft size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {visibleMenu.map((item) => {
                    const isExpanded = expandedItem === item.label;
                    const hasChildren = !!(item.children && item.children.length > 0);
                    const isOnChildRoute = hasChildren && item.children?.some(child => matchesChildRoute(child.path, location.pathname));
                    const isActive = !hasChildren && location.pathname === item.path && activeFocus === null;
                    const isCategoryBlue = hasChildren && (activeFocus === item.label || isOnChildRoute);

                    return (
                        <div key={item.path} className="nav-item-container">
                            {hasChildren ? (
                                <div
                                    className={`nav-item ${isCategoryBlue ? 'active' : ''}`}
                                    onClick={() => toggleSubmenu(item.label)}
                                >
                                    <item.icon size={20} className="nav-icon" />
                                    <span className="nav-label">{item.label}</span>
                                    <ChevronDown
                                        size={16}
                                        className={`nav-chevron ${isExpanded ? 'rotate' : ''}`}
                                    />
                                </div>
                            ) : (
                                <Link
                                    to={item.path}
                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveFocus(null);
                                        if (isCollapsed) setIsCollapsed(false);
                                    }}
                                >
                                    <item.icon size={20} className="nav-icon" />
                                    <span className="nav-label">{item.label}</span>
                                </Link>
                            )}

                            {hasChildren && isExpanded && (
                                <div className="submenu">
                                    {item.children?.map((child) => (
                                        <Link
                                            key={child.path}
                                            to={child.path}
                                            className={`nav-item sub-item ${matchesChildRoute(child.path, location.pathname) || (child.label === 'Ship' && location.pathname === '/vessels') ? 'sub-active' : ''}`}
                                            onClick={() => {
                                                setActiveFocus(null);
                                                if (isCollapsed) setIsCollapsed(false);
                                            }}
                                        >
                                            {child.icon ? (
                                                <child.icon size={18} className="nav-icon" />
                                            ) : (
                                                <div className="nav-icon-placeholder" />
                                            )}
                                            <span className="nav-label">{child.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
