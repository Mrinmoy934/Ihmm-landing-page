import { useState } from 'react';
import { User, Building2, Globe2, Mail, Phone, MessageSquare, ShieldCheck, Edit3, Save, ChevronDown, Check } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { useEffect, useRef } from 'react';
import './UserProfile.css';

const COUNTRIES = [
    'India', 'Singapore', 'United Arab Emirates', 'Norway', 'United Kingdom', 
    'United States', 'Denmark', 'Germany', 'Greece', 'Netherlands', 
    'Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'China',
    'Japan', 'South Korea', 'Singapore', 'Cyprus', 'Malta'
].sort();

export default function UserProfile() {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        companyName: 'Varuna Sentinels BV',
        country: 'India',
        contactPerson: 'Vishnu',
        email: 'vishnusimhadri2003@gmail.com',
        phone: '7795715495',
        isActive: true,
        isUnpaid: false,
        isLimitedShips: true,
        message: 'Administrator account for Varuna Sentinels global operations.'
    });

    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const countryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
                setIsCountryOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="profile-page-container">
            <Sidebar />
            <main className="profile-page-main">
                <Header />
                <div className="profile-page-content">
                    <div className="page-header-standard">
                        <div className="header-title-area">
                            <div className="breadcrumb-mini">SECURITY / USER PROFILE</div>
                            <h1>Business Profile</h1>
                            <p>Manage your company information and account settings.</p>
                        </div>
                        <div className="header-actions">
                            {!isEditing ? (
                                <button className="btn-primary-standard" onClick={() => setIsEditing(true)}>
                                    <Edit3 size={18} /> Edit Profile
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-secondary-standard" onClick={() => setIsEditing(false)}>Cancel</button>
                                    <button className="btn-primary-standard" onClick={() => setIsEditing(false)}>
                                        <Save size={18} /> Save Changes
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="profile-cards-grid">
                        <div className="profile-main-card">
                            <div className="card-section-header">
                                <Building2 size={20} color="#00B0FA" />
                                <h3>Company Information</h3>
                            </div>
                            
                            <div className="form-grid-premium">
                                <div className="form-item-premium">
                                    <label>Name of the company</label>
                                    <div className="input-with-icon">
                                        <Building2 size={16} />
                                        <input 
                                            type="text" 
                                            value={profileData.companyName} 
                                            onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                                            readOnly={!isEditing}
                                            className={!isEditing ? 'readonly-input' : ''}
                                        />
                                    </div>
                                </div>

                                <div className="form-item-premium">
                                    <label>Country of Registration</label>
                                    <div className="custom-select-wrapper" ref={countryRef}>
                                        <div 
                                            className={`input-with-icon select-trigger ${!isEditing ? 'readonly-input' : ''} ${isCountryOpen ? 'active' : ''}`}
                                            onClick={() => isEditing && setIsCountryOpen(!isCountryOpen)}
                                        >
                                            <Globe2 size={16} />
                                            <span className="select-value">{profileData.country}</span>
                                            <ChevronDown size={16} className={`select-chevron ${isCountryOpen ? 'rotate' : ''}`} />
                                        </div>
                                        
                                        {isCountryOpen && (
                                            <div className="custom-dropdown-menu country-dropdown">
                                                {COUNTRIES.map(country => (
                                                    <div 
                                                        key={country}
                                                        className={`custom-dropdown-item ${profileData.country === country ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setProfileData({ ...profileData, country });
                                                            setIsCountryOpen(false);
                                                        }}
                                                    >
                                                        <span>{country}</span>
                                                        {profileData.country === country && <Check size={14} />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="card-section-header" style={{ marginTop: '40px' }}>
                                <User size={20} color="#00B0FA" />
                                <h3>Contact Details</h3>
                            </div>

                            <div className="form-grid-premium">
                                <div className="form-item-premium">
                                    <label>Name of contact person</label>
                                    <div className="input-with-icon">
                                        <User size={16} />
                                        <input 
                                            type="text" 
                                            value={profileData.contactPerson} 
                                            onChange={(e) => setProfileData({ ...profileData, contactPerson: e.target.value })}
                                            readOnly={!isEditing}
                                            className={!isEditing ? 'readonly-input' : ''}
                                        />
                                    </div>
                                </div>

                                <div className="form-item-premium">
                                    <label>Email of contact person</label>
                                    <div className="input-with-icon">
                                        <Mail size={16} />
                                        <input 
                                            type="email" 
                                            value={profileData.email} 
                                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                            readOnly={!isEditing}
                                            className={!isEditing ? 'readonly-input' : ''}
                                        />
                                    </div>
                                </div>

                                <div className="form-item-premium">
                                    <label>Phone of contact person</label>
                                    <div className="input-with-icon">
                                        <Phone size={16} />
                                        <input 
                                            type="text" 
                                            value={profileData.phone} 
                                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                            readOnly={!isEditing}
                                            className={!isEditing ? 'readonly-input' : ''}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="profile-side-grid">
                            <div className="status-control-card">
                                <div className="card-section-header">
                                    <ShieldCheck size={20} color="#00B0FA" />
                                    <h3>Account Status</h3>
                                </div>

                                <div className="toggle-list-premium">
                                    <div className="toggle-item-premium">
                                        <label htmlFor="toggle-active" className="toggle-info" style={{ cursor: 'pointer' }}>
                                            <span className="toggle-label">Active Status</span>
                                            <span className="toggle-desc">Account is currently enabled</span>
                                        </label>
                                        <label className="switch-premium">
                                            <input 
                                                id="toggle-active"
                                                type="checkbox" 
                                                checked={profileData.isActive} 
                                                onChange={(e) => setProfileData({ ...profileData, isActive: e.target.checked })}
                                            />
                                            <span className="slider-premium round"></span>
                                        </label>
                                    </div>

                                    <div className="toggle-item-premium">
                                        <label htmlFor="toggle-unpaid" className="toggle-info" style={{ cursor: 'pointer' }}>
                                            <span className="toggle-label">Unpaid Account</span>
                                            <span className="toggle-desc">Payment status indicator</span>
                                        </label>
                                        <label className="switch-premium">
                                            <input 
                                                id="toggle-unpaid"
                                                type="checkbox" 
                                                checked={profileData.isUnpaid} 
                                                onChange={(e) => setProfileData({ ...profileData, isUnpaid: e.target.checked })}
                                            />
                                            <span className="slider-premium round"></span>
                                        </label>
                                    </div>

                                    <div className="toggle-item-premium">
                                        <label htmlFor="toggle-limited" className="toggle-info" style={{ cursor: 'pointer' }}>
                                            <span className="toggle-label">Limited Ships</span>
                                            <span className="toggle-desc">Access restricted to selected vessels</span>
                                        </label>
                                        <label className="switch-premium">
                                            <input 
                                                id="toggle-limited"
                                                type="checkbox" 
                                                checked={profileData.isLimitedShips} 
                                                onChange={(e) => setProfileData({ ...profileData, isLimitedShips: e.target.checked })}
                                            />
                                            <span className="slider-premium round"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="message-box-card">
                                <div className="card-section-header">
                                    <MessageSquare size={20} color="#00B0FA" />
                                    <h3>System Message</h3>
                                </div>
                                <textarea 
                                    className="premium-textarea"
                                    placeholder="Enter administrative notes..."
                                    value={profileData.message}
                                    onChange={(e) => setProfileData({ ...profileData, message: e.target.value })}
                                    readOnly={!isEditing}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <footer className="contact-footer">
                        <div className="copyright">
                            <ShieldCheck size={16} />
                            <span>&copy; 2026 IHM Platform. Corporate Fleet Security.</span>
                        </div>
                        <nav className="footer-nav">
                            <a href="#">Privacy Policy</a>
                            <a href="#">Security Terms</a>
                            <a href="#">Audit Logs</a>
                        </nav>
                    </footer>
                </div>
            </main>
        </div>
    );
}
