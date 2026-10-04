import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import GAPlanViewer from './GAPlanViewer';

export default function FullPlanViewer() {
    const location = useLocation();
    const query = new URLSearchParams(location.search);
    let fileUrl = query.get('url') || '';
    // Sanitize URL to avoid EPERM error on locked file
    if (fileUrl.includes('ga_plan_illustration.png')) {
        fileUrl = '/ga_plan_minimal.png';
    }
    const filename = query.get('name') || 'Plan Viewer';

    const vesselName = query.get('vessel') || 'Unknown Vessel';
    // When the parent (DecksView) opened this with real backend IDs, the
    // GA Plan viewer can persist deck areas to the API. Otherwise it falls
    // back to localStorage / demo behaviour.
    const vesselId = query.get('vesselId') || undefined;
    const gaPlanId = query.get('planId') || undefined;

    const [mappedSections, setMappedSections] = useState<any[]>(() => {
        const saved = localStorage.getItem(`vessel_sections_${vesselName}`);
        return saved ? JSON.parse(saved) : [];
    });

    // Save back to localStorage when sections change
    useEffect(() => {
        if (vesselName !== 'Unknown Vessel') {
            localStorage.setItem(`vessel_sections_${vesselName}`, JSON.stringify(mappedSections));
        }
    }, [mappedSections, vesselName]);

    if (!fileUrl) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
                background: '#F9FAFB',
                color: '#667085'
            }}>
                <h3>No Plan Selected</h3>
                <p>Please select a plan from the Decks view to open the viewer.</p>
                <button
                    onClick={() => window.close()}
                    style={{
                        padding: '10px 20px',
                        background: '#00B0FA',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    Close Tab
                </button>
            </div>
        );
    }

    const focusedId = query.get('focusedId');

    const [allPlans] = useState<any[]>(() => {
        const savedPlans = localStorage.getItem(`vessel_plans_${vesselName}`);
        return savedPlans ? JSON.parse(savedPlans) : [];
    });

    const showAll = query.get('showAll') === 'true';

    return (
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <GAPlanViewer
                filename={filename}
                fileUrl={fileUrl}
                onClose={() => window.close()}
                mappedSections={mappedSections}
                onUpdateSections={setMappedSections as any}
                focusedSectionId={focusedId}
                vesselName={vesselName}
                vesselId={vesselId}
                gaPlanId={gaPlanId}
                isIsolationMode={query.get('isolated') === 'true'}
                allPlans={allPlans}
                showAllPlansMode={showAll}
            />
        </div>
    );
}
