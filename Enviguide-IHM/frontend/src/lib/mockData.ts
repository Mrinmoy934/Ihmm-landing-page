import type { Vessel, DashboardStats, SOCAlert, PurchaseOrder, Material, Deck } from '../types/index';

// Mock Vessels Data
export const mockVessels: Vessel[] = [
    {
        id: '1',
        name: 'Maersk Sealand',
        imoNumber: '9234567',
        vesselType: 'Container Ship',
        registrationNumber: 'DK-2024-567',
        signalLetters: 'OXDF2',
        grossTonnage: '171,000 GT',
        deadweightTonnage: '195,000 DWT',
        teuUnits: '18,270 TEU',
        registeredOwner: 'Maersk Line A/S',
        shipOwner: 'Maersk Line',
        shipManager: 'Anglo-Eastern Ship Management',
        fleet: 'Maersk Asia-Pacific Fleet',
        vesselClass: 'DNV GL',
        ihmClass: 'Class A - Full Compliance',
        flagState: 'Denmark',
        portOfRegistry: 'Copenhagen',
        nameOfYard: 'Daewoo Shipbuilding & Marine Engineering',
        shipyardLocation: 'Geoje, South Korea',
        buildersUniqueId: 'DSME-2018-042',
        keelLaidDate: '2018-03-15',
        deliveryDate: '2019-11-20',
        ihmMethod: 'EU',
        mdStandard: 'EU',
        ihmReference: 'IHM-MS-2019-001',
        socReference: 'SOC-DNV-2024-567',
        socExpiryDate: '2026-12-15',
        complianceStatus: 'compliant',
        image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&h=300&fit=crop'
    },
    {
        id: '2',
        name: 'Maersk Tigris',
        imoNumber: '9345678',
        vesselType: 'Container Ship',
        registeredOwner: 'Maersk Line A/S',
        shipOwner: 'Maersk Line',
        shipManager: 'V.Ships',
        flagState: 'Denmark',
        ihmMethod: 'EU',
        mdStandard: 'EU',
        socExpiryDate: '2027-03-20',
        complianceStatus: 'compliant'
    },
    {
        id: '3',
        name: 'Maersk Elba',
        imoNumber: '9456789',
        vesselType: 'Container Ship',
        registeredOwner: 'Maersk Line A/S',
        shipOwner: 'Maersk Line',
        shipManager: 'Anglo-Eastern Ship Management',
        flagState: 'Denmark',
        ihmMethod: 'EU',
        mdStandard: 'EU',
        socExpiryDate: '2026-01-06',
        complianceStatus: 'expired'
    },
    {
        id: '4',
        name: 'MSC Gülsün',
        imoNumber: '9839450',
        vesselType: 'Container Ship',
        registeredOwner: 'MSC Mediterranean Shipping',
        shipOwner: 'Mediterranean Shipping Company',
        shipManager: 'Columbia Shipmanagement',
        flagState: 'Panama',
        ihmMethod: 'HKC',
        mdStandard: 'HKC',
        socExpiryDate: '2026-02-02',
        complianceStatus: 'warning'
    },
    {
        id: '5',
        name: 'MSC Mina',
        imoNumber: '9839451',
        vesselType: 'Container Ship',
        registeredOwner: 'MSC Mediterranean Shipping',
        shipOwner: 'Mediterranean Shipping Company',
        shipManager: 'Thome Ship Management',
        flagState: 'Panama',
        ihmMethod: 'HKC',
        mdStandard: 'HKC',
        socExpiryDate: '2027-06-15',
        complianceStatus: 'compliant'
    }
];

// Mock Dashboard Stats
export const mockDashboardStats: DashboardStats = {
    users: {
        newRegistrations: 248,
        ihmRegistrations: 1842,
        inactiveUsers: 127,
        trend: 12
    },
    purchaseOrders: {
        totalLineItems: 3456,
        pendingMDs: 89,
        receivedMDs: 3367,
        hmRed: 142,
        hmGreen: 3225,
        trend: 8
    },
    vessels: {
        newOnboarded: 12,
        itemsMovedFromDeck: 456,
        itemsMovedAshore: 234,
        socExpired: 5
    }
};

// Mock SOC Alerts
export const mockSOCAlerts: SOCAlert[] = [
    {
        vesselId: '3',
        vesselName: 'Maersk Elba',
        imoNumber: 'IMO 9456789',
        expiryDate: '2026-01-06',
        daysUntilExpiry: -15,
        status: 'expired'
    },
    {
        vesselId: '6',
        vesselName: 'CMA CGM Antoine De Saint Exupery',
        imoNumber: 'IMO 9454436',
        expiryDate: '2026-01-13',
        daysUntilExpiry: -8,
        status: 'expired'
    },
    {
        vesselId: '4',
        vesselName: 'MSC Gülsün',
        imoNumber: 'IMO 9839450',
        expiryDate: '2026-02-02',
        daysUntilExpiry: 12,
        status: 'expiring-soon'
    },
    {
        vesselId: '7',
        vesselName: 'Ever Given',
        imoNumber: 'IMO 9811000',
        expiryDate: '2026-02-08',
        daysUntilExpiry: 18,
        status: 'expiring-soon'
    },
    {
        vesselId: '8',
        vesselName: 'OOCL Hong Kong',
        imoNumber: 'IMO 9714335',
        expiryDate: '2026-01-18',
        daysUntilExpiry: -3,
        status: 'expired'
    }
];

// Mock Purchase Orders
export const mockPurchaseOrders: PurchaseOrder[] = [
    {
        id: '1',
        poNumber: 'PO-2024-001',
        vesselId: '1',
        supplierId: 'SUP-001',
        orderDate: '2024-11-15',
        totalLineItems: 342,
        pendingMDs: 12,
        receivedMDs: 330,
        hmRed: 15,
        hmGreen: 327,
        status: 'responsive'
    },
    {
        id: '2',
        poNumber: 'PO-2024-002',
        vesselId: '2',
        supplierId: 'SUP-002',
        orderDate: '2024-12-01',
        totalLineItems: 267,
        pendingMDs: 5,
        receivedMDs: 262,
        hmRed: 8,
        hmGreen: 259,
        status: 'responsive'
    },
    {
        id: '3',
        poNumber: 'PO-2024-003',
        vesselId: '3',
        supplierId: 'SUP-001',
        orderDate: '2024-10-20',
        totalLineItems: 489,
        pendingMDs: 23,
        receivedMDs: 466,
        hmRed: 45,
        hmGreen: 444,
        status: 'non-responsive'
    }
];

export const mockMaterials: Material[] = [
    {
        id: 'HAZ-RECORD-001',
        vesselId: '1',
        name: 'RADIO CORD (x 32 piece)',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'Safe',
        thresholdType: 'safe',
        zone: 'D Deck',
        poNo: '',
        component: 'SOLDER',
        hazardType: 'Lead',
        materialName: 'Lead & Lead compounds',
        equipment: 'RADIO CORD (x 32 piece)'
    },
    {
        id: 'HAZ-RECORD-002',
        vesselId: '1',
        name: 'Scupper Trap (x 2 piece)',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'Safe',
        thresholdType: 'safe',
        zone: 'D Deck',
        poNo: '',
        component: 'Mark:A15 Rose Plate(0.028)',
        hazardType: 'Cadm',
        materialName: 'Cadmium & Cadmium compounds',
        equipment: 'Scupper Trap (x 2 piece)'
    },
    {
        id: 'HAZ-RECORD-003',
        vesselId: '1',
        name: 'Scupper Trap (x 2 piece)',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 65,
        status: 'In Progress',
        thresholdMessage: 'Above Limit',
        thresholdType: 'limit-exceeded',
        zone: 'D Deck',
        poNo: '',
        component: 'Mark:A15 Rose Plate(0.14), A39 Trap(2.34)',
        hazardType: 'Lead',
        materialName: 'Lead & Lead compounds',
        equipment: 'Scupper Trap (x 2 piece)'
    },
    {
        id: 'HAZ-RECORD-004',
        vesselId: '2',
        name: 'LIGHTING DISTRIBUTION BOARD(LB) (X1 piece)',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 10,
        status: 'Review Needed',
        thresholdMessage: 'High Risk',
        thresholdType: 'limit-exceeded',
        zone: 'D Deck',
        poNo: '',
        component: 'SCREW.',
        hazardType: 'Chro',
        materialName: 'Hexavalent chromium and Hexavalent chromium compounds',
        equipment: 'LIGHTING DISTRIBUTION BOARD(LB) (X1 piece)'
    },
    {
        id: 'HAZ-RECORD-005',
        vesselId: '2',
        name: 'ELECTRONIC BUZZER (x2 piece)',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 80,
        status: 'Verified',
        thresholdMessage: 'Trace',
        thresholdType: 'trace',
        zone: 'C Deck',
        poNo: '',
        component: 'Terminal Block/ Screw etc.',
        hazardType: 'Lead',
        materialName: 'Lead & Lead compounds',
        equipment: 'ELECTRONIC BUZZER (x2 piece)'
    },
    {
        id: 'HAZ-RECORD-006',
        vesselId: '3',
        name: 'N.W.T. MULTI SOCKET OUTLET (x1 piece)',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 80,
        status: 'Verified',
        thresholdMessage: 'Trace',
        thresholdType: 'trace',
        zone: 'C Deck',
        poNo: '',
        component: 'Parts of Brass',
        hazardType: 'Lead',
        materialName: 'Lead & Lead compounds',
        equipment: 'N.W.T. MULTI SOCKET OUTLET (x1 piece)'
    },
    {
        id: 'HAZ-442-PB',
        name: 'Lead-based Paint',
        ihmPart: 'PART I',
        category: 'safe',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'Below Limit',
        thresholdType: 'safe',
        zone: 'Hull',
        thresholdValue: 0.02
    },
    {
        id: 'HAZ-105-PCB',
        name: 'PCBs (Lubricants)',
        ihmPart: 'PART II',
        category: 'warning',
        completion: 20,
        status: 'Pending Survey',
        thresholdMessage: 'Trace Amount',
        thresholdType: 'trace',
        zone: 'Pump Room',
        thresholdValue: 0.05
    },
    {
        id: 'HAZ-202-ODS',
        name: 'Ozone Depleting Substances',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 45,
        status: 'Review Needed',
        thresholdMessage: 'POTENTIAL RISK',
        thresholdType: 'limit-exceeded',
        zone: 'Accomodation',
        thresholdValue: 0.8
    },
    {
        id: 'HAZ-550-PFOS',
        name: 'PFOS Connections',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 80,
        status: 'Documentation',
        thresholdMessage: 'Within Range',
        thresholdType: 'trace',
        zone: 'Deck',
        thresholdValue: 0.08
    },
    {
        id: 'MAT-101-GEN',
        name: 'General Insulation',
        ihmPart: 'PART III',
        category: 'safe',
        completion: 100,
        status: 'Verified',
        thresholdMessage: 'Non-Hazardous',
        thresholdType: 'safe',
        zone: 'Engine Room',
        thresholdValue: 0.0
    },
    {
        id: 'HAZ-RECORD-008',
        name: 'FLORESCENT LAMP',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'Safe',
        thresholdType: 'safe',
        zone: 'B Deck',
        poNo: 'PO-778899',
        component: 'Starter Unit',
        hazardType: 'Mercury',
        materialName: 'Mercury & mercury compounds',
        equipment: 'FLORESCENT LAMP'
    },
    {
        id: 'HAZ-RECORD-009',
        name: 'FIRE DETECTOR',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'High Risk',
        thresholdType: 'limit-exceeded',
        zone: 'C Deck',
        poNo: 'PO-112233',
        component: 'Ionization Source',
        hazardType: 'Radio',
        materialName: 'Radioactive substances',
        equipment: 'FIRE DETECTOR'
    },
    {
        id: 'HAZ-RECORD-010',
        name: 'HYDRAULIC PUMP',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 45,
        status: 'In Progress',
        thresholdMessage: 'Trace',
        thresholdType: 'trace',
        zone: 'Engine Room',
        poNo: 'PO-445566',
        component: 'Gasket Seals',
        hazardType: 'Asbestos',
        materialName: 'Asbestos',
        equipment: 'HYDRAULIC PUMP'
    },
    {
        id: 'HAZ-RECORD-011',
        name: 'NAVIGATION LIGHT',
        ihmPart: 'PART I',
        category: 'warning',
        completion: 100,
        status: 'Certified',
        thresholdMessage: 'Safe',
        thresholdType: 'safe',
        zone: 'D Deck',
        poNo: 'PO-990011',
        component: 'Terminal Clamp',
        hazardType: 'Lead',
        materialName: 'Lead compounds',
        equipment: 'NAVIGATION LIGHT'
    },
    {
        id: 'HAZ-RECORD-012',
        name: 'EMERGENCY GENERATOR',
        ihmPart: 'PART I',
        category: 'safe',
        completion: 100,
        status: 'Verified',
        thresholdMessage: 'Safe',
        thresholdType: 'safe',
        zone: 'Main Deck',
        poNo: 'PO-334455',
        component: 'Mounting Screws',
        hazardType: 'Chro',
        materialName: 'Hexavalent chromium',
        equipment: 'EMERGENCY GENERATOR'
    },
    {
        id: 'HAZ-RECORD-013',
        name: 'BATTERY CHARGER',
        ihmPart: 'PART II',
        category: 'hazard',
        completion: 30,
        status: 'Pending',
        thresholdMessage: 'High Risk',
        thresholdType: 'limit-exceeded',
        zone: 'A Deck',
        poNo: 'PO-667788',
        component: 'Circuit Board',
        hazardType: 'Cadm',
        materialName: 'Cadmium compounds',
        equipment: 'BATTERY CHARGER'
    },
    {
        id: 'HAZ-RECORD-014',
        name: 'COOLING UNIT',
        ihmPart: 'PART I',
        category: 'hazard',
        completion: 55,
        status: 'In Progress',
        thresholdMessage: 'Limit Exceeded',
        thresholdType: 'limit-exceeded',
        zone: 'E Deck',
        poNo: 'PO-223344',
        component: 'Refigerant Gas',
        hazardType: 'ODS',
        materialName: 'Ozone Depleting Substances',
        equipment: 'COOLING UNIT'
    },
    { id: 'HAZ-RECORD-015', name: 'FIRE DAMPER', ihmPart: 'PART I', category: 'safe', completion: 100, status: 'Certified', zone: 'D Deck', component: 'Gasket', hazardType: 'Lead', materialName: 'Lead', equipment: 'FIRE DAMPER' },
    { id: 'HAZ-RECORD-016', name: 'BILGE PUMP', ihmPart: 'PART I', category: 'warning', completion: 20, status: 'In Progress', zone: 'Engine Room', component: 'Paint', hazardType: 'Chro', materialName: 'Chromium', equipment: 'BILGE PUMP' },
    { id: 'HAZ-RECORD-017', name: 'FAN MOTOR', ihmPart: 'PART I', category: 'safe', completion: 100, status: 'Verified', zone: 'C Deck', component: 'Bearing', hazardType: 'Cadm', materialName: 'Cadmium', equipment: 'FAN MOTOR' },
    { id: 'HAZ-RECORD-018', name: 'WATER TIGHT DOOR', ihmPart: 'PART I', category: 'hazard', completion: 10, status: 'Review', zone: 'Main Deck', component: 'Sealant', hazardType: 'Lead', materialName: 'Lead', equipment: 'DOOR' },
    { id: 'HAZ-RECORD-019', name: 'VALVE ACTUATOR', ihmPart: 'PART II', category: 'warning', completion: 50, status: 'Survey', zone: 'B Deck', component: 'Coating', hazardType: 'Chro', materialName: 'Hexavalent Chromium', equipment: 'VALVE' },
    { id: 'HAZ-RECORD-020', name: 'WINCH DRIVE', ihmPart: 'PART III', category: 'safe', completion: 100, status: 'Certified', zone: 'Forecastle', component: 'Brake Pad', hazardType: 'Asbestos', materialName: 'Asbestos Free', equipment: 'WINCH' },
    { id: 'HAZ-RECORD-021', name: 'SEA WATER PUMP', ihmPart: 'PART I', category: 'hazard', completion: 85, status: 'Certified', zone: 'Pump Room', component: 'Impeller', hazardType: 'Cadm', materialName: 'Cadmium', equipment: 'PUMP' },
    { id: 'HAZ-RECORD-022', name: 'TRANSFORMER', ihmPart: 'PART I', category: 'hazard', completion: 100, status: 'Certified', zone: 'E Deck', component: 'Coolant', hazardType: 'PCB', materialName: 'PCBs', equipment: 'TRANSFORMER' },
    { id: 'HAZ-RECORD-023', name: 'DECK CRANE', ihmPart: 'PART I', category: 'warning', completion: 40, status: 'In Progress', zone: 'Poop Deck', component: 'Hydraulic Pipe', hazardType: 'Lead', materialName: 'Lead compounds', equipment: 'CRANE' },
    { id: 'HAZ-RECORD-024', name: 'LIFEBOAT ENGINE', ihmPart: 'PART II', category: 'safe', completion: 100, status: 'Verified', zone: 'A Deck', component: 'Exhaust Pipe', hazardType: 'Asbestos', materialName: 'Non-asbestos', equipment: 'ENGINE' }
];

export const mockDecks: Deck[] = [
    {
        id: 'deck-001',
        vesselId: '1',
        name: 'Navigation Bridge Deck',
        level: 5,
        gaPlanUrl: 'https://images.unsplash.com/photo-1597423244036-ef5020e83f3c?auto=format&fit=crop&q=80&w=1600',
        materials: []
    },
    {
        id: 'deck-002',
        vesselId: '1',
        name: 'Upper Deck',
        level: 4,
        gaPlanUrl: 'https://images.unsplash.com/photo-1581093588402-4857474d5f04?auto=format&fit=crop&q=80&w=1600',
        materials: []
    },
    {
        id: 'deck-003',
        vesselId: '1',
        name: 'Main Deck',
        level: 3,
        materials: []
    },
    {
        id: 'deck-004',
        vesselId: '1',
        name: 'Engine Room Top',
        level: 2,
        materials: []
    }
];
