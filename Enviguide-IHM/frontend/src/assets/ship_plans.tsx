
// Detailed Technical GA Plan SVGs to replace PNGs and avoid File Locking Issues

const BASE_GRID = `
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" stroke-width="1"/>
    </pattern>
    <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#cbd5e1" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="2000" height="1400" fill="white"/>
  <rect width="2000" height="1400" fill="url(#grid)"/>
`;

const SHIP_OUTLINE = `
  <!-- Main Hull Outline -->
  <path d="M 100 400 L 1800 400 Q 1950 400 1980 700 Q 1950 1000 1800 1000 L 100 1000 Z" 
        fill="#f8fafc" stroke="#334155" stroke-width="4"/>
  
  <!-- Waterline / Lower Deck dividing line -->
  <line x1="100" y1="700" x2="1980" y2="700" stroke="#94a3b8" stroke-width="2" stroke-dasharray="10,5"/>
`;

const BRIDGE_SECTION = `
  <!-- Bridge / Superstructure Area (Matches x:410, y:442) -->
  <rect x="400" y="440" width="160" height="100" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2"/>
  <text x="480" y="490" text-anchor="middle" font-family="monospace" font-size="24" fill="#0369a1">BRIDGE</text>
  <line x1="410" y1="460" x2="550" y2="460" stroke="#0ea5e9" stroke-width="1"/>
  <rect x="420" y="450" width="20" height="10" fill="#0ea5e9"/>
  <rect x="520" y="450" width="20" height="10" fill="#0ea5e9"/>
`;

const CARGO_HOLDS = `
  <!-- Cargo Hold 1 (Matches roughly x:675 y:555) -->
  <rect x="670" y="550" width="130" height="100" fill="url(#hatch)" stroke="#64748b" stroke-width="2"/>
  <text x="735" y="605" text-anchor="middle" font-family="monospace" font-size="24" fill="#475569">HOLD 1</text>

  <!-- Cargo Hold 2 -->
  <rect x="850" y="550" width="130" height="100" fill="url(#hatch)" fill-opacity="0.5" stroke="#64748b" stroke-width="2"/>
  <text x="915" y="605" text-anchor="middle" font-family="monospace" font-size="24" fill="#64748b">HOLD 2</text>
`;

const ENGINE_ROOM = `
  <!-- Engine Room / Aft (Matches x:105, y:555) -->
  <rect x="100" y="550" width="200" height="120" fill="#f1f5f9" stroke="#475569" stroke-width="2"/>
  <text x="200" y="600" text-anchor="middle" font-family="monospace" font-size="24" fill="#334155">ENGINE</text>
  <circle cx="150" cy="610" r="20" fill="none" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="250" cy="610" r="20" fill="none" stroke="#94a3b8" stroke-width="2"/>
`;

const MAIN_DECK_DETAILS = `
  <!-- Mid Area Details (Matches x:375 y:555) -->
  <rect x="375" y="555" width="100" height="100" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5,5"/>
  <text x="425" y="605" text-anchor="middle" font-family="monospace" font-size="16" fill="#64748b">ACCOM</text>

  <!-- Main Hull Structure Bottom (Matches x:105 y:749) -->
  <rect x="105" y="750" width="600" height="150" fill="none" stroke="#ef4444" stroke-width="2" stroke-opacity="0.3"/>
  <text x="405" y="830" text-anchor="middle" font-family="monospace" font-size="32" fill="#ef4444" fill-opacity="0.3">DOUBLE BOTTOM</text>
`;

// Combine into full SVGs with slight color variations for different ships

const HEADER_TEMPLATE = (title: string, color: string) => `
  <rect x="50" y="50" width="400" height="80" fill="white" stroke="${color}" stroke-width="2"/>
  <text x="70" y="90" font-family="Arial" font-weight="bold" font-size="24" fill="${color}">${title}</text>
  <text x="70" y="115" font-family="Arial" font-size="14" fill="#64748b">TECHNICAL ARRANGEMENT PLAN</text>
`;

export const PLAN_OCEAN_PIONEER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1400">${BASE_GRID}${SHIP_OUTLINE}${BRIDGE_SECTION}${CARGO_HOLDS}${ENGINE_ROOM}${MAIN_DECK_DETAILS}${HEADER_TEMPLATE('MV OCEAN PIONEER', '#0ea5e9')}</svg>`;

export const PLAN_ACOSTA = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1400">${BASE_GRID}${SHIP_OUTLINE}${BRIDGE_SECTION}${CARGO_HOLDS}${ENGINE_ROOM}${MAIN_DECK_DETAILS}${HEADER_TEMPLATE('ACOSTA', '#f59e0b')}<rect x="1200" y="550" width="400" height="100" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/><text x="1400" y="605" text-anchor="middle" font-family="monospace" font-size="24" fill="#d97706">LNG TANKS</text></svg>`;

export const PLAN_AFIF = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1400">${BASE_GRID}${SHIP_OUTLINE}${BRIDGE_SECTION}${CARGO_HOLDS}${ENGINE_ROOM}${MAIN_DECK_DETAILS}${HEADER_TEMPLATE('AFIF', '#10b981')}<circle cx="1400" cy="700" r="80" fill="none" stroke="#10b981" stroke-width="4"/><text x="1400" y="700" text-anchor="middle" font-family="monospace" font-size="20" fill="#059669">HELIDECK</text></svg>`;

export const PLAN_PACIFIC_HORIZON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1400">${BASE_GRID}${SHIP_OUTLINE}${BRIDGE_SECTION}${CARGO_HOLDS}${ENGINE_ROOM}${MAIN_DECK_DETAILS}${HEADER_TEMPLATE('PACIFIC HORIZON', '#6366f1')}</svg>`;

export const PLAN_GENERIC = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1400">${BASE_GRID}${SHIP_OUTLINE}${BRIDGE_SECTION}${CARGO_HOLDS}${ENGINE_ROOM}${MAIN_DECK_DETAILS}${HEADER_TEMPLATE('GENERAL ARRANGEMENT', '#64748b')}</svg>`;
