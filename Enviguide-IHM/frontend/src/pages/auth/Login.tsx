import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, X, HelpCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

// Import moody slide images
import slide1 from '../../assets/login-slide-1.png';
import slide2 from '../../assets/login-slide-2.png';
import slide3 from '../../assets/login-slide-3.png';
import ihmLogo from '../../assets/ihm-logo.webp';

export default function Login() {
    const navigate = useNavigate();
    const auth = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForgotMsg, setShowForgotMsg] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [rememberMe, setRememberMe] = useState(false);

    const slides = [
        { image: slide1, caption: 'Maritime Compliance', subtitle: 'Real-time Hazardous Materials Tracking' },
        { image: slide2, caption: 'Vessel Fleet Oversight', subtitle: 'Automated IHM Part I, II & III Maintenance' },
        { image: slide3, caption: 'Audit Readiness', subtitle: 'Instant IMO & EU SRR Certification Reports' }
    ];

    // Redirect if already authenticated
    useEffect(() => {
        if (auth.isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [auth.isAuthenticated, navigate]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await auth.login(email, password, rememberMe);
            navigate('/dashboard');
        } catch (err) {
            setError((err as Error).message || 'Invalid credentials. Please check your username and password.');
        }
    };

    return (
        <div className="login-viewport">
            {/* Left Panel: Moody Slideshow with Interactive Dots */}
            <div className="visual-side">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`slide-v2 ${index === currentSlide ? 'active' : ''}`}
                        style={{ backgroundImage: `url(${slide.image})` }}
                        aria-hidden={index !== currentSlide}
                    ></div>
                ))}
                <div className="visual-overlay"></div>
                <div className="visual-caption">
                    <span className="tiny-label">{slides[currentSlide].caption}</span>
                    <h3 className="slide-hero-title">{slides[currentSlide].subtitle}</h3>
                    <div className="slide-dots">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`slide-dot ${i === currentSlide ? 'active' : ''}`}
                                onClick={() => setCurrentSlide(i)}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Clean, User-Friendly Auth Portal */}
            <div className="form-side">
                <div className="auth-content">
                    <div className="auth-header-v2">
                        <div className="login-logo-wrap">
                            <img src={ihmLogo} alt="OceanLedger IHM Logo" className="login-logo-img" />
                        </div>
                        <h2>Welcome Back</h2>
                        <p>Access your secure maritime compliance dashboard</p>
                    </div>

                    {error && (
                        <div className="login-alert login-alert-error" role="alert">
                            <AlertCircle size={18} className="alert-icon" />
                            <div className="alert-content">
                                <strong>Sign in failed</strong>
                                <span>{error}</span>
                            </div>
                            <button type="button" className="alert-close-btn" onClick={() => setError(null)} aria-label="Dismiss error">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {showForgotMsg && (
                        <div className="login-alert login-alert-info">
                            <HelpCircle size={18} className="alert-icon" />
                            <div className="alert-content">
                                <strong>Need Password Assistance?</strong>
                                <span>Please contact your system administrator or email <a href="mailto:support@oceanledger.com">support@oceanledger.com</a> for an access reset link.</span>
                            </div>
                            <button type="button" className="alert-close-btn" onClick={() => setShowForgotMsg(false)} aria-label="Close message">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="premium-form" noValidate>
                        <div className="form-group-v2">
                            <label htmlFor="login-email">Portal Email / Username</label>
                            <div className="input-row-v2">
                                <Mail size={16} className="icon-v2" aria-hidden="true" />
                                <input
                                    id="login-email"
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    placeholder="e.g. captain@maritime.com or username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group-v2">
                            <label htmlFor="login-password">Access Key / Password</label>
                            <div className="input-row-v2">
                                <Lock size={16} className="icon-v2" aria-hidden="true" />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    autoComplete="current-password"
                                    placeholder="Enter your access key"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Hide password" : "Show password"}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-utils-v2">
                            <label className="remember-v2">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="mark"></span>
                                <span>Remember my login</span>
                            </label>
                            <button
                                type="button"
                                className="forgot-v2-btn"
                                onClick={() => setShowForgotMsg(true)}
                            >
                                Forgot Password?
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="btn-blocker"
                            disabled={auth.isLoading}
                        >
                            {auth.isLoading ? (
                                <div className="dot-loading-container">
                                    <div className="dot-v2"></div>
                                    <div className="dot-v2"></div>
                                    <div className="dot-v2"></div>
                                    <span style={{ marginLeft: 8 }}>Signing In...</span>
                                </div>
                            ) : (
                                <span className="btn-inner-content">
                                    Sign In <ArrowRight size={16} className="btn-arrow-icon" />
                                </span>
                            )}
                        </button>
                    </form>

                    <div className="security-assurance">
                        <ShieldCheck size={14} className="security-shield-icon" />
                        <span>256-Bit SSL Encrypted &bull; ISO 27001 Certified Maritime Portal</span>
                    </div>
                </div>

                <footer className="auth-footer-v2">
                    <p>&copy; 2026 OceanLedger &bull; All Rights Reserved</p>
                </footer>
            </div>
        </div>
    );
}


