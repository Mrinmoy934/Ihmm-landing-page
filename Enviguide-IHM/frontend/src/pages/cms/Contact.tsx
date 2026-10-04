import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { Mail, Phone, MapPin, Send, Ship, MessageCircle } from 'lucide-react';
import './Contact.css';

export default function Contact() {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
    };

    return (
        <div className="contact-premium-container">
            <Sidebar />
            <main className="contact-viewport">
                <Header />
                <div className="contact-frame">
                    <section className="contact-intro">
                        <div className="maritime-badge">
                            <MessageCircle size={14} />
                            <span>We&rsquo;re Here to Help</span>
                        </div>
                        <h1>Contact Us</h1>
                        <p>
                            Have questions about how Enviguide can help your organization
                            achieve its sustainability goals? Our team is ready to assist
                            you; whether you&rsquo;re looking for a demo, need technical
                            support, or want to explore partnership opportunities.
                        </p>
                    </section>

                    <div className="contact-layout-grid">
                        <div className="form-column">
                            <form onSubmit={handleSubmit} className="minimal-blueprint-form">
                                <div className="input-row">
                                    <div className="minimal-group">
                                        <label>Full Name</label>
                                        <input type="text" placeholder="Your full name" required />
                                    </div>
                                    <div className="minimal-group">
                                        <label>Company</label>
                                        <input type="text" placeholder="Your organization" />
                                    </div>
                                </div>
                                <div className="minimal-group">
                                    <label>Email Address</label>
                                    <input type="email" placeholder="you@company.com" required />
                                </div>
                                <div className="minimal-group">
                                    <label>Message</label>
                                    <textarea rows={4} placeholder="How can we help you?" required></textarea>
                                </div>
                                <button type="submit" className="ship-command-btn">
                                    <span>Send Message</span>
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>

                        <div className="contact-details-column">
                            <div className="detail-item">
                                <div className="detail-icon"><Mail size={20} /></div>
                                <div className="detail-content">
                                    <h3>Send Us Mail</h3>
                                    <p>info@enviguide.com</p>
                                </div>
                            </div>
                            <div className="detail-item">
                                <div className="detail-icon"><Phone size={20} /></div>
                                <div className="detail-content">
                                    <h3>Call Us Anytime</h3>
                                    <p>+91 9986331158</p>
                                </div>
                            </div>
                            <div className="detail-item">
                                <div className="detail-icon"><MapPin size={20} /></div>
                                <div className="detail-content">
                                    <h3>Visit Our Office</h3>
                                    <p>Hyderabad, Telangana, India - 500049.</p>
                                </div>
                            </div>
                            <div className="nautical-seal">
                                <Ship size={18} className="seal-icon" />
                                <span>EnviGuide IHM</span>
                            </div>
                        </div>
                    </div>

                    <footer className="contact-footer">
                        <div className="copyright">
                            <Ship size={16} />
                            <span>&copy; 2026 EnviGuide IHM. All rights reserved.</span>
                        </div>
                        <nav className="footer-nav">
                            <a href="#">Privacy Policy</a>
                            <a href="#">Terms of Service</a>
                            <a href="https://enviguide.com" target="_blank" rel="noopener noreferrer">enviguide.com</a>
                        </nav>
                    </footer>
                </div>
            </main>
        </div>
    );
}
