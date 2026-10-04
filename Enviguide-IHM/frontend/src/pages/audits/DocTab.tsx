import { useState, useRef } from 'react';
import './DocTab.css';
import {
    CloudUpload,
    FileText,
    File,
    X,
    CheckCircle2,
    Download,
    ShieldCheck,
    Trash2
} from 'lucide-react';

interface UploadingFile {
    id: string;
    name: string;
    size: string;
    progress: number;
    status: 'UPLOADING' | 'SUCCESSFULLY UPLOADED';
}

export default function DocTab() {
    const [files, setFiles] = useState<UploadingFile[]>([]);
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                name: f.name,
                size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                progress: 0,
                status: 'UPLOADING' as const
            }));
            setFiles(prev => [...prev, ...newFiles]);
            startSimulatedUpload(newFiles);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                name: f.name,
                size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                progress: 0,
                status: 'UPLOADING' as const
            }));
            setFiles(prev => [...prev, ...newFiles]);
            startSimulatedUpload(newFiles);
        }
    };

    const startSimulatedUpload = (newFiles: UploadingFile[]) => {
        setUploadState('uploading');
        newFiles.forEach(file => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.floor(Math.random() * 20) + 5;
                if (progress >= 100) {
                    progress = 100;
                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress: 100, status: 'SUCCESSFULLY UPLOADED' } : f));
                    clearInterval(interval);
                } else {
                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress } : f));
                }
            }, 500);
        });
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleSubmit = () => {
        if (files.length === 0 || files.some(f => f.status === 'UPLOADING')) return;
        setUploadState('success');
    };

    const uploadedCount = files.filter(f => f.status === 'SUCCESSFULLY UPLOADED').length;

    if (uploadState === 'success') {
        return (
            <div className="doc-portal-wrapper">
                <header className="portal-header">
                    <div className="header-left">
                        <div className="portal-logo">
                            <ShieldCheck size={28} color="white" fill="#00529C" />
                        </div>
                        <div className="portal-title-meta">
                            <h1>Pacific Venture Compliance</h1>
                            <span className="ref-text">Reference: <strong>PO-2023-8842</strong></span>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="supplier-info">
                            <span className="supplier-name">Global Maritime Supplies Ltd</span>
                            <span className="portal-label">SUPPLIER PORTAL</span>
                        </div>
                        <div className="user-avatar-circle">
                            <div className="avatar-placeholder"></div>
                        </div>
                    </div>
                </header>

                <main className="portal-main success-view">
                    <div className="success-content">
                        <div className="success-icon-wrapper">
                            <div className="shield-icon-outer">
                                <FileText size={60} color="#10B981" />
                                <div className="check-badge">
                                    <CheckCircle2 size={24} color="white" fill="#10B981" />
                                </div>
                            </div>
                        </div>

                        <h2 className="success-title">Documents Submitted Successfully</h2>
                        <p className="success-desc">
                            Your compliance documents for <strong>Pacific Venture (PO-2023-8842)</strong> have been received. The IHM administrator will review them shortly.
                        </p>

                        <div className="submission-receipt-card">
                            <div className="receipt-header">
                                <div className="receipt-title">
                                    <FileText size={18} color="#00529C" />
                                    <span>SUBMISSION RECEIPT</span>
                                </div>
                                <span className="conf-id">CONF. ID: TRK-99284-AX</span>
                            </div>
                            <div className="receipt-body">
                                <div className="receipt-meta-grid">
                                    <div className="meta-item">
                                        <label>TRACKING ID</label>
                                        <strong>SUB-PV-2023-8842-X9</strong>
                                    </div>
                                    <div className="meta-item">
                                        <label>TIMESTAMP</label>
                                        <strong>Oct 24, 2023 &bull; 14:32 UTC</strong>
                                    </div>
                                </div>

                                <div className="submitted-files-list">
                                    <label>SUBMITTED FILES ({files.length})</label>
                                    <div className="files-scroll">
                                        {files.map((file, i) => (
                                            <div key={i} className="receipt-file-item">
                                                <FileText size={16} color="#00529C" />
                                                <span>{file.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="receipt-footer">
                                <p className="email-info">A confirmation email has been sent to your registered address.</p>
                                <button className="download-receipt-btn">
                                    <Download size={16} />
                                    DOWNLOAD RECEIPT
                                </button>
                            </div>
                        </div>

                        <button className="close-portal-btn" onClick={() => window.close()}>
                            CLOSE PORTAL
                        </button>
                        <p className="contact-admin">Need to make changes? <a href="#">Contact Administrator</a></p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="doc-portal-wrapper">
            <header className="portal-header">
                <div className="header-left">
                    <div className="portal-logo">
                        <ShieldCheck size={28} color="white" fill="#00529C" />
                    </div>
                    <div className="portal-title-meta">
                        <h1>{uploadState === 'uploading' ? 'Uploading your files...' : 'Upload Documents for Pacific Venture'}</h1>
                        <span className="ref-text">Reference: <strong>PO-2023-8842</strong></span>
                    </div>
                </div>
                <div className="header-right">
                    <div className="supplier-info">
                        <span className="supplier-name">Global Maritime Supplies Ltd</span>
                        <span className="portal-label">SUPPLIER PORTAL</span>
                    </div>
                    <div className="user-avatar-circle">
                        <div className="avatar-placeholder"></div>
                    </div>
                </div>
            </header>

            <main className="portal-main">
                <div
                    className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <div className="upload-icon-box">
                        <CloudUpload size={32} color="#00529C" />
                    </div>
                    <h3>{uploadState === 'uploading' ? 'Uploading your files...' : 'Drop your files here or browse to upload'}</h3>
                    <p>Supported formats: PDF, JPG, PNG (Max 25MB per file)</p>
                </div>

                <div className="selected-files-section">
                    <div className="section-header">
                        <div className="header-title">
                            <File size={18} color="#00529C" />
                            <span>Selected Files ({files.length})</span>
                        </div>
                        <span className="file-count">{uploadedCount} OF {files.length} UPLOADED</span>
                    </div>

                    <div className="files-table-container">
                        <table className="upload-files-table">
                            <thead>
                                <tr>
                                    <th>FILE NAME</th>
                                    <th>PROGRESS</th>
                                    <th>SIZE</th>
                                    <th>STATUS</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="empty-table-cell">
                                            No files selected yet. Drop files above to begin.
                                        </td>
                                    </tr>
                                ) : (
                                    files.map((file) => (
                                        <tr key={file.id} className="upload-file-row">
                                            <td className="file-name-cell">
                                                <div className="file-icon-box">
                                                    <FileText size={18} color="#94A3B8" />
                                                </div>
                                                <span>{file.name}</span>
                                            </td>
                                            <td className="progress-cell">
                                                <div className="progress-container">
                                                    <div className="progress-bar-bg">
                                                        <div
                                                            className={`progress-bar-fill ${file.status === 'SUCCESSFULLY UPLOADED' ? 'completed' : ''}`}
                                                            style={{ width: `${file.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="progress-text">{file.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="size-cell">{file.size}</td>
                                            <td className="status-cell">
                                                <div className={`status-tag ${file.status === 'SUCCESSFULLY UPLOADED' ? 'success' : 'uploading'}`}>
                                                    {file.status === 'SUCCESSFULLY UPLOADED' && <CheckCircle2 size={14} />}
                                                    <span>{file.status}</span>
                                                </div>
                                            </td>
                                            <td className="action-cell">
                                                {file.status === 'SUCCESSFULLY UPLOADED' ? (
                                                    <button className="file-action-btn delete" onClick={() => removeFile(file.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <button className="file-action-btn remove" onClick={() => removeFile(file.id)}>
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="portal-actions">
                    <button
                        className={`submit-all-btn ${files.length === 0 || files.some(f => f.status === 'UPLOADING') ? 'disabled' : ''}`}
                        onClick={handleSubmit}
                        disabled={files.length === 0 || files.some(f => f.status === 'UPLOADING')}
                    >
                        SUBMIT ALL DOCUMENTS
                    </button>
                    <button className="discard-portal-btn" onClick={() => window.close()}>
                        DISCARD
                    </button>
                </div>
            </main>
        </div>
    );
}
