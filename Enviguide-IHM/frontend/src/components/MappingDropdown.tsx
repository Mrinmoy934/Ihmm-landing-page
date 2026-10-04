import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import './MappingDropdown.css';

export interface DropdownOption {
    value: string;
    label: string;
    subLabel?: string;
}

interface MappingDropdownProps {
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    isMapped?: boolean;
    isRequired?: boolean;
}

export default function MappingDropdown({
    value,
    options,
    onChange,
    placeholder = 'Select column...',
    isMapped = false,
    isRequired = false,
}: MappingDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [open]);

    const selectedLabel = options.find(o => o.value === value)?.label ?? '';
    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (optVal: string) => {
        onChange(optVal);
        setOpen(false);
        setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    };

    return (
        <div
            ref={containerRef}
            className={`mdd-root ${open ? 'mdd-root--open' : ''} ${isMapped ? 'mdd-root--mapped' : ''}`}
        >
            {/* Trigger */}
            <button
                type="button"
                className={`mdd-trigger ${isMapped ? 'mdd-trigger--mapped' : ''} ${isRequired && !isMapped ? 'mdd-trigger--required' : ''}`}
                onClick={() => setOpen(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                {/* Status dot */}
                <span className={`mdd-dot ${isMapped ? 'mdd-dot--mapped' : 'mdd-dot--empty'}`} />

                {/* Label or placeholder */}
                <span className={`mdd-label ${!value ? 'mdd-label--placeholder' : ''}`}>
                    {value ? selectedLabel : placeholder}
                </span>

                {/* Clear button (only when mapped) */}
                {isMapped && (
                    <span
                        role="button"
                        tabIndex={-1}
                        className="mdd-clear"
                        onClick={handleClear}
                        title="Clear mapping"
                    >
                        <X size={12} />
                    </span>
                )}

                {/* Chevron */}
                <ChevronDown
                    size={15}
                    className={`mdd-chevron ${open ? 'mdd-chevron--open' : ''}`}
                />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="mdd-panel" role="listbox">
                    {/* Search */}
                    <div className="mdd-search-wrap">
                        <Search size={13} className="mdd-search-icon" />
                        <input
                            ref={searchRef}
                            type="text"
                            className="mdd-search"
                            placeholder="Search columns..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                        {search && (
                            <button className="mdd-search-clear" onClick={() => setSearch('')}>
                                <X size={11} />
                            </button>
                        )}
                    </div>

                    {/* Clear current */}
                    {value && (
                        <div className="mdd-divider" />
                    )}

                    {/* Options */}
                    <div className="mdd-options">
                        {!search && (
                            <div
                                role="option"
                                aria-selected={!value}
                                className={`mdd-option mdd-option--placeholder ${!value ? 'mdd-option--active' : ''}`}
                                onClick={() => handleSelect('')}
                            >
                                <span className="mdd-option-label">— {placeholder} —</span>
                                {!value && <Check size={13} className="mdd-option-check" />}
                            </div>
                        )}

                        {filtered.length === 0 && (
                            <div className="mdd-empty">No columns match "{search}"</div>
                        )}

                        {filtered.map(opt => {
                            const isSelected = opt.value === value;
                            return (
                                <div
                                    key={opt.value}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`mdd-option ${isSelected ? 'mdd-option--selected' : ''}`}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    <span className="mdd-option-index">{parseInt(opt.value, 10) + 1}</span>
                                    <span className="mdd-option-label" style={{ flex: 1 }}>{opt.label}</span>
                                    {isSelected && (
                                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#00B0FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Check size={11} color="white" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
