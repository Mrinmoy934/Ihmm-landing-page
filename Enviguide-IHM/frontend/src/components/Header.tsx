import { Search, User, Bell, BellOff, FileText, AlertTriangle, Pin, Check, CheckCircle2, LogOut, Settings, HelpCircle, Shield, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

interface HeaderProps {
    notificationCount?: number;
    userName?: string;
    userRole?: string;
    selectedVessel?: {
        name: string;
        imo: string;
    };
}

export default function Header({
    notificationCount,
    userName: userNameProp,
    userRole: userRoleProp
}: HeaderProps) {
    const navigate = useNavigate();
    const auth = useAuth();
    const userName = userNameProp || auth.user?.name || 'User';
    const userRole = userRoleProp || auth.user?.role || '';
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const getIcon = (type: string) => {
        switch (type) {
            case 'PO IMPORT': return <CheckCircle2 size={18} />;
            case 'NEW DOCUMENT': return <FileText size={18} />;
            case 'COMPLIANCE WARNING': return <AlertTriangle size={18} />;
            case 'MATERIAL UPDATE': return <Pin size={18} />;
            default: return <Bell size={18} />;
        }
    };

    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('user_notifications');
        const parsedSaved = saved ? JSON.parse(saved) : [];

        // Add icons to saved notifications
        const processedSaved = parsedSaved.map((n: any) => ({
            ...n,
            icon: getIcon(n.type)
        }));

        const defaults = [
            {
                id: 1,
                type: 'NEW DOCUMENT',
                title: 'GA Plan Uploaded',
                description: 'The General Arrangement Plan Rev. 04 has been successfully uploaded and processed.',
                time: '2 mins ago',
                icon: <FileText size={18} />,
                color: '#3B82F6',
                unread: true
            },
            {
                id: 2,
                type: 'COMPLIANCE WARNING',
                title: 'Expiring Certificate',
                description: 'The IHM Statement of Compliance for MV Ocean Pioneer expires in 15 days.',
                time: '1 hour ago',
                icon: <AlertTriangle size={18} />,
                color: '#F59E0B',
                unread: true
            },
            {
                id: 3,
                type: 'MATERIAL UPDATE',
                title: 'Bridge Proof Deck',
                description: "New material logs were pinned to the 'Bridge Proof' deck section by John Administra.",
                time: '3 hours ago',
                icon: <Pin size={18} />,
                color: '#8B5CF6',
                unread: true
            }
        ];

        return [...processedSaved, ...defaults];
    });

    const unreadCount = notifications.filter(n => n.unread).length;

    const handleMenuClick = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        navigate(path);
        setShowProfile(false);
    };

    const handleLogout = (e: React.MouseEvent) => {
        e.stopPropagation();
        auth.logout();
        navigate('/', { replace: true });
        setShowProfile(false);
    };

    const handleMarkAsRead = (id: number) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, unread: false } : n
        ));
    };

    const handleClearAll = () => {
        setNotifications([]);
    };

    return (
        <header className={`dashboard-header ${showNotifications || showProfile ? 'notifications-open' : ''}`}>
            <div className="header-background" />

            {/* Backdrop Overlay - Positions globally via CSS */}
            {(showNotifications || showProfile) && (
                <div
                    className="notification-backdrop"
                    onClick={() => {
                        setShowNotifications(false);
                        setShowProfile(false);
                    }}
                />
            )}

            <div className="header-left">
                <div className="search-bar">
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search vessels, materials, POs..."
                        className="search-input"
                    />
                </div>
            </div>

            <div className="header-right">
                <div className="notification-container">
                    <button
                        className={`notification-btn ${showNotifications ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowNotifications(!showNotifications);
                        }}
                    >
                        <Bell size={20} />
                        {(notificationCount ?? unreadCount) > 0 && (
                            <span className="notification-badge">{notificationCount ?? unreadCount}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div
                            className="notification-card-dropdown"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="notification-card-header">
                                <div className="header-title-row">
                                    <h3 className="notification-card-title">Recent Notifications</h3>
                                    {unreadCount > 0 && <span className="new-badge">{unreadCount} NEW</span>}
                                </div>
                                {notifications.length > 0 && (
                                    <button className="clear-all-btn" onClick={handleClearAll}>
                                        Clear all
                                    </button>
                                )}
                            </div>

                            <div className="notification-card-content">
                                {notifications.length === 0 ? (
                                    <div className="no-notifications">
                                        <div className="no-notifications-icon">
                                            <BellOff size={48} color="#94A3B8" />
                                        </div>
                                        <h4 className="no-notifications-title">No New Notifications</h4>
                                        <p className="no-notifications-text">
                                            You are all caught up! Check back later for vessel updates.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="notifications-list">
                                        {notifications.map((notif) => (
                                            <div key={notif.id} className="notification-item">
                                                <div className="notif-icon-wrapper" style={{ backgroundColor: `${notif.color}15`, color: notif.color }}>
                                                    {notif.icon}
                                                </div>
                                                <div className="notif-content">
                                                    <div className="notif-header">
                                                        <span className="notif-type" style={{ color: notif.color }}>
                                                            {notif.type}
                                                        </span>
                                                        <span className="notif-time">{notif.time}</span>
                                                    </div>
                                                    <h4 className="notif-title">{notif.title}</h4>
                                                    <p className="notif-description">{notif.description}</p>
                                                    {notif.unread && (
                                                        <button
                                                            className="mark-read-btn"
                                                            onClick={() => handleMarkAsRead(notif.id)}
                                                        >
                                                            MARK AS READ <Check size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {notifications.length > 0 && (
                                <div className="notification-card-footer">
                                    <button className="view-all-btn">VIEW ALL NOTIFICATIONS</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="user-profile-container">
                    <div 
                        className={`user-profile-trigger ${showProfile ? 'active' : ''}`}
                        onClick={() => {
                            setShowProfile(!showProfile);
                            setShowNotifications(false);
                        }}
                    >
                        <div className="user-profile-info">
                            <div className="user-profile-name">{userName}</div>
                            <div className="user-profile-role">{userRole}</div>
                        </div>
                        <div className="user-profile-avatar">
                            <User size={20} color={showProfile ? "#fff" : "#64748B"} />
                        </div>
                    </div>

                    {showProfile && (
                        <div className="profile-dropdown-card">
                            <div className="profile-dropdown-header">
                                <div className="user-big-avatar">
                                    <User size={32} color="#00B0FA" />
                                </div>
                                <div className="user-details-box">
                                    <h4 className="user-display-name">{userName}</h4>
                                    <p className="user-display-email">{auth.user?.email || ''}</p>
                                    <span className="user-badge-premium">{userRole}</span>
                                </div>
                            </div>
                            
                            <div className="profile-dropdown-menu">
                                <button className="profile-menu-item" onClick={(e) => handleMenuClick(e, '/security/user-profile')}>
                                    <UserCircle size={18} />
                                    <span>My Profile</span>
                                </button>
                                <button className="profile-menu-item" onClick={(e) => { e.stopPropagation(); setShowProfile(false); }}>
                                    <Settings size={18} />
                                    <span>Account Settings</span>
                                </button>
                                <button className="profile-menu-item" onClick={(e) => handleMenuClick(e, '/security/user-rights')}>
                                    <Shield size={18} />
                                    <span>Security & Privacy</span>
                                </button>
                                <button className="profile-menu-item" onClick={(e) => handleMenuClick(e, '/contact')}>
                                    <HelpCircle size={18} />
                                    <span>Help Center</span>
                                </button>
                            </div>

                            <div className="profile-dropdown-footer">
                                <button className="logout-button" onClick={(e) => handleLogout(e)}>
                                    <LogOut size={18} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
