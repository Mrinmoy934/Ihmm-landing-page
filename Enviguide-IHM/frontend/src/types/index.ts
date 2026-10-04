// ========================================
// IHM Platform - Type Definitions
// ========================================

export interface Vessel {
    id?: string;
    name: string;
    imoNumber: string;
    vesselType: string;
    registrationNumber?: string;
    signalLetters?: string;
    grossTonnage?: string;
    deadweightTonnage?: string;
    teuUnits?: string;

    // Ownership
    registeredOwner?: string;
    shipOwner?: string;
    shipManager?: string;
    fleet?: string;
    subFleet?: string;

    // Classification
    vesselClass?: string;
    vesselIhmClass?: string;
    classIdNo?: string;
    ihmClass?: string;
    flagState?: string;
    portOfRegistry?: string;

    // Construction
    nameOfYard?: string;
    shipyardLocation?: string;
    buildersUniqueId?: string;
    keelLaidDate?: string;
    deliveryDate?: string;

    // IHM & SOC
    ihmMethod?: string;
    mdStandard?: string;
    ihmReference?: string;
    socReference?: string;
    socExpiryDate?: string;

    // Status
    complianceStatus?: 'compliant' | 'warning' | 'expired';
    image?: string;
}

export interface PurchaseOrder {
    id: string;
    poNumber: string;
    vesselId: string;
    supplierId: string;
    orderDate: string;
    totalLineItems: number;
    pendingMDs: number;
    receivedMDs: number;
    hmRed: number;
    hmGreen: number;
    status: 'responsive' | 'non-responsive' | 'pending';
}

export interface Material {
    id: string;
    name: string;
    vesselId?: string; // Optional for mock data flexibility
    ihmPart: string; // Changed to string to match 'PART I', 'PART II' usage or mapping
    category: 'hazard' | 'safe' | 'warning';
    completion: number;
    status: string; // Generalized status
    thresholdMessage?: string;
    thresholdType?: 'limit-exceeded' | 'safe' | 'trace';
    thresholdValue?: number;
    zone?: string;
    deckCoordinates?: { x: number; y: number };

    // Legacy/Back-end fields (keeping them optional/available)
    hazardType?: string;
    quantity?: number;
    unit?: string;
    deckId?: string;
    compartment?: string;
    equipment?: string;
    mdStatus?: 'pending' | 'received' | 'approved';
    poNo?: string;
    component?: string;
    materialName?: string;
}

export interface Deck {
    id: string;
    vesselId: string;
    name: string;
    level: number;
    gaPlanUrl?: string;
    materials: Material[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    country?: string;
    status: 'active' | 'inactive';
    category: 'admin' | 'manager' | 'viewer';
    lastActivity?: string;
}

export interface Supplier {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    country?: string;
    status: 'active' | 'inactive';
}

export interface ShipOwner {
    id: string;
    name: string;
    code: string;
    vessels: Vessel[];
}

export interface DashboardStats {
    users: {
        newRegistrations: number;
        ihmRegistrations: number;
        inactiveUsers: number;
        trend: number;
    };
    purchaseOrders: {
        totalLineItems: number;
        pendingMDs: number;
        receivedMDs: number;
        hmRed: number;
        hmGreen: number;
        trend: number;
    };
    vessels: {
        newOnboarded: number;
        itemsMovedFromDeck: number;
        itemsMovedAshore: number;
        socExpired: number;
    };
}

export interface SOCAlert {
    vesselId: string;
    vesselName: string;
    imoNumber: string;
    expiryDate: string;
    daysUntilExpiry: number;
    status: 'expired' | 'expiring-soon';
}

export interface DashboardFilters {
    yearly: string;
    shipOwner: string;
    shipManager: string;
    supplier: string;
    vessel: string;
}

export interface Project {
    id: string;
    vesselId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    status: 'active' | 'completed' | 'on-hold';
}

export interface Document {
    id: string;
    vesselId: string;
    name: string;
    type: 'certificate' | 'md' | 'sdoc' | 'report' | 'other';
    uploadDate: string;
    fileUrl: string;
    status: 'valid' | 'expired' | 'pending-review';
}

export interface Certificate {
    id: string;
    vesselId: string;
    type: 'IHM' | 'SOC' | 'other';
    reference: string;
    issueDate: string;
    expiryDate: string;
    issuingAuthority: string;
    status: 'valid' | 'expired' | 'expiring-soon';
}

export interface AuditSummary {
    id?: string;
    vesselName: string;
    imoNumber: string;
    auditName?: string;
    totalPO: number;
    totalItems: number;
    duplicatePO?: number;
    duplicateSupplierCode?: number;
    duplicateProduct?: number;
    createDate: string;
    status?: 'Pending Review' | 'Completed' | 'In Progress' | 'PENDING REVIEW';
    reviewStatus?: 'In Review' | 'Pending';
    assignedTo?: {
        name: string;
        avatar: string;
    };
}

export interface HazmatMaterialCount {
    key: string;
    color: string;
    count: number;
    shipsCount?: number;
    redCount: number;
}

export interface DashboardLineItem {
    id: string;
    ship: string;
    flag: string;
    vclass: string;
    supplier: string;
    desc: string;
    hm: string;
    qty: string;
    part: string;
    cat: string;
    status: 'HM Red' | 'HM Green' | 'Non HM' | string;
    po: string;
    vs: string;
    created: string;
    updated: string;
    md: boolean;
    sdoc: boolean;
    deck: string;
    equip: string;
    position: string;
    component: string;
    material: string;
    remarks: string;
}

export interface DashboardOverviewData {
    userRole: 'admin' | 'vessel' | 'ship_owner' | 'ship_manager';
    vessels: Array<{
        id: string;
        name: string;
        imoNumber: string;
        flagState: string;
        shipOwner: string;
        shipManager: string;
        vesselClass: string;
        keelLaidDate: string;
        complianceStatus: string;
    }>;
    options: {
        shipOwners: string[];
        shipManagers: string[];
        flagStates: string[];
        suppliers: string[];
        vessels: Array<{ id: string; name: string }>;
    };
    kpi: {
        totalVessels: number;
        totalPOs: number;
        totalTrackedItems: number;
        hmRedCount: number;
        hmGreenCount: number;
        nonHmCount: number;
        mdReceived: number;
        mdPending: number;
        sdocReceived: number;
        sdocPending: number;
    };
    hazmatBreakdown: HazmatMaterialCount[];
    poMetrics: Array<{ label: string; a: number; b: number; color: string }>;
    mdDonut: Array<{ name: string; value: number; color: string }>;
    supplierDonut: Array<{ name: string; value: number; color: string }>;
    recentActivity: Array<{
        id: string;
        title: string;
        vesselName: string;
        description: string;
        createDate: string;
        status: string;
    }>;
}

