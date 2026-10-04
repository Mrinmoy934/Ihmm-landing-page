import React, { useState } from 'react';
import {
    CheckCircle2, X
} from 'lucide-react';
import './IHMCertificateView.css';

interface IHMCertificateViewProps {
    vesselName: string;
    onCertificateSubmit?: () => void;
}

const IHMCertificateView: React.FC<IHMCertificateViewProps> = ({ vesselName }) => {
    const [showToast, setShowToast] = useState(false);
    const [genFormData, setGenFormData] = useState({
        certType: 'Annual Certificate',
        fromDate: '2025-01-01',
        toDate: '2025-12-31'
    });

    const safeVesselName = vesselName || 'Unknown Vessel';

    return (
        <div className="ihm-certificate-container generation-view">
            <div className="cert-generation-layout">
                {/* Center Card: Generate Certificate */}
                <div className="cert-generation-card">
                    <div className="card-header-clean">
                        <h3>Generate Certificate</h3>
                    </div>
                    <div className="generation-form-body">
                        {/* Certificate Type */}
                        <div className="gen-input-group">
                            <label>Certificate Type</label>
                            <select
                                className="gen-select"
                                value={genFormData.certType}
                                onChange={(e) => setGenFormData({ ...genFormData, certType: e.target.value })}
                            >
                                <option>Quarterly Certificate-Q2</option>
                                <option>Quarterly Certificate-Q3</option>
                                <option>Quarterly Certificate-Q4</option>
                                <option>Quarterly Certificate in advance</option>
                                <option>Annual Certificate</option>
                                <option>Adhoc Certificate</option>
                            </select>
                        </div>

                        {/* From Date */}
                        <div className="gen-input-group">
                            <label>From Date</label>
                            <div className="date-input-container">
                                <input
                                    type="date"
                                    className="gen-date-input"
                                    value={genFormData.fromDate}
                                    onChange={(e) => setGenFormData({ ...genFormData, fromDate: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* To Date */}
                        <div className="gen-input-group">
                            <label>To Date</label>
                            <div className="date-input-container">
                                <input
                                    type="date"
                                    className="gen-date-input"
                                    value={genFormData.toDate}
                                    onChange={(e) => setGenFormData({ ...genFormData, toDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="generation-footer">
                            <button className="generate-cert-btn" onClick={() => setShowToast(true)}>
                                Generate Certificate
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification */}
            {showToast && (
                <div className="toast-notification show">
                    <div className="toast-icon-box">
                        <CheckCircle2 size={24} color="white" />
                    </div>
                    <div className="toast-content">
                        <div className="toast-title">Certificate Generated</div>
                        <div className="toast-message">{genFormData.certType} for {safeVesselName} is being prepared.</div>
                    </div>
                    <button className="toast-close" onClick={() => setShowToast(false)}>
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default IHMCertificateView;
