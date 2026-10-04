// ============================================================
// IHM Platform - API Configuration
// ============================================================
// This file is the single source of truth for backend endpoints.
// Switch from mock → real API by updating BASE_URL and USE_MOCK.

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://enviguide.duckdns.org/api/v1',
  // Mock mode is OFF by default when deploying with a backend.
  // Set VITE_USE_MOCK=true to override and use mock mode locally.
  USE_MOCK: import.meta.env.VITE_USE_MOCK === 'true',
  TIMEOUT: 15000, // ms
};

export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },

  // Vessels
  VESSELS: {
    LIST: '/vessels',
    DETAIL: (id: string) => `/vessels/${id}`,
    IMAGE_UPLOAD: (id: string) => `/vessels/${id}/image`,
    DECKS: (id: string) => `/vessels/${id}/decks`,
    MATERIALS: (id: string) => `/vessels/${id}/materials`,
    CERTIFICATES: (id: string) => `/vessels/${id}/certificates`,
    DOCUMENTS: (id: string) => `/vessels/${id}/documents`,
    DOCUMENT_DETAIL: (id: string, docId: string) => `/vessels/${id}/documents/${docId}`,
    DOCUMENT_STREAM: (id: string, docId: string) => `/vessels/${id}/documents/${docId}/stream`,
  },

  // GA Plans (nested under a vessel)
  GA_PLANS: {
    LIST: (vesselId: string) => `/vessels/${vesselId}/ga-plans`,
    DETAIL: (vesselId: string, planId: string) => `/vessels/${vesselId}/ga-plans/${planId}`,
  },

  // Deck Areas (nested under a GA Plan)
  DECK_AREAS: {
    LIST: (vesselId: string, planId: string) =>
      `/vessels/${vesselId}/ga-plans/${planId}/deck-areas`,
    DETAIL: (vesselId: string, planId: string, areaId: string) =>
      `/vessels/${vesselId}/ga-plans/${planId}/deck-areas/${areaId}`,
  },

  // Purchase Orders
  PURCHASE_ORDERS: {
    LIST: '/purchase-orders',
    DETAIL: (id: string) => `/purchase-orders/${id}`,
    UPLOAD: '/purchase-orders/upload',
    UPLOAD_BULK: '/purchase-orders/upload-bulk',
  },

  // Reports (nested under a vessel)
  REPORTS: {
    LIST: (vesselId: string) => `/vessels/${vesselId}/reports`,
    DOWNLOAD: (vesselId: string, type: string) =>
      `/vessels/${vesselId}/reports/${type}/download`,
    FILE: (vesselId: string, reportId: string) =>
      `/vessels/${vesselId}/reports/file/${reportId}`,
  },

  // Materials / IHM (nested under a vessel)
  MATERIALS: {
    LIST: (vesselId: string) => `/vessels/${vesselId}/materials`,
    DETAIL: (vesselId: string, materialId: string) =>
      `/vessels/${vesselId}/materials/${materialId}`,
    MAPPING: (vesselId: string) => `/vessels/${vesselId}/materials/mapping`,
    SUMMARY: (vesselId: string) => `/vessels/${vesselId}/materials/summary`,
    TRANSFER: (vesselId: string, materialId: string) =>
      `/vessels/${vesselId}/materials/${materialId}/transfer`,
    REMAP: (vesselId: string, materialId: string) =>
      `/vessels/${vesselId}/materials/${materialId}/remap`,
  },

  // Administration / Audits
  AUDITS: {
    PENDING: '/audits/pending',
    ACTIVE: '/audits/active',
    DETAIL: (imo: string) => `/audits/${imo}`,
    REVIEWS: '/audits/reviews',
    REVIEW_DETAIL: (imo: string) => `/audits/reviews/${imo}`,
    MDS_DOC: '/audits/mds-doc',
    MDS_PENDING: '/audits/mds-pending',
    VESSEL_PO_ITEMS: (vesselId: string) => `/audits/vessels/${vesselId}/po-items`,
    DOCUMENTS: (imo: string) => `/audits/${imo}/documents`,
    CLARIFICATION_EMAIL: '/audits/clarification-email',
    LINE_ITEMS: (imo: string) => `/audits/${imo}/line-items`,
    LINE_ITEMS_BY_ID: (auditId: string) => `/audits/by-id/${auditId}/line-items`,
    CLARIFICATIONS: (imo: string) => `/audits/${imo}/clarifications`,
    CLARIFICATION_ITEM_DOC: (clarId: string, idx: number | string, kind: 'md' | 'sdoc') =>
      `/audits/clarifications/${clarId}/items/${idx}/document/${kind}`,
    CLARIFICATION_ITEM_DOC_PREVIEW: (clarId: string, idx: number | string, kind: 'md' | 'sdoc') =>
      `/audits/clarifications/${clarId}/items/${idx}/document/${kind}/preview-url`,
    CLARIFICATION_ITEM_REMIND: (clarId: string, idx: number | string) =>
      `/audits/clarifications/${clarId}/items/${idx}/remind`,
    CLARIFICATION_REMIND_BULK: (clarId: string) =>
      `/audits/clarifications/${clarId}/remind-bulk`,
    CLARIFICATION_ITEM_REVIEW: (clarId: string, idx: number | string) =>
      `/audits/clarifications/${clarId}/items/${idx}/review`,
    DELETE: (id: string) => `/audits/${id}`,
  },

  // Security / Users
  SECURITY: {
    USERS: '/security/users',
    USER_DETAIL: (id: string) => `/security/users/${id}`,
    USER_RIGHTS: '/security/user-rights',
    USER_ROLE_RIGHTS: '/security/user-role-rights',
    USER_CATEGORIES: '/security/user-categories',
    USER_MENU: '/security/user-menu',
  },

  // Users (admin) — what the Authorizations page reads to populate the
  // user picker. The /security/* aliases above are stubs; this is the
  // real list endpoint backed by the users table.
  USERS: {
    LIST: '/users',
    DETAIL: (id: string) => `/users/${id}`,
  },

  // Permissions / Authorizations
  PERMISSIONS: {
    NODES: '/permissions/nodes',
    ROLES: '/permissions/roles',
    ROLE: (name: string) => `/permissions/roles/${encodeURIComponent(name)}`,
    USER: (id: string) => `/permissions/users/${id}`,
  },

  // Master Data
  MASTER: {
    SUPPLIERS: '/master/suppliers',
    EQUIPMENT: '/master/equipment',
    SUSPECTED_KEYWORDS: '/master/suspected-keywords',
    REGISTERED: '/master/registered',
    OWNERSHIP: '/master/ownership',
  },

  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    OVERVIEW: '/dashboard/overview',
    INVENTORY: '/dashboard/inventory',
    SOC_ALERTS: '/dashboard/soc-alerts',
  },
};
