import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/auth/Login';
import ProtectedRoute from '../components/ProtectedRoute';
import Dashboard from '../pages/vessels/Dashboard';
import Vessels from '../pages/vessels/Vessels';
import Fleet from '../pages/vessels/Fleet';
import SubFleet from '../pages/vessels/SubFleet';
import FullPlanViewer from '../pages/viewer/FullPlanViewer';
import HazardousMaterialMapping from '../pages/mapping/HazardousMaterialMapping';
import UploadPurchaseOrder from '../pages/audits/UploadPurchaseOrder';
import PendingAudits from '../pages/audits/PendingAudits';
import PendingReviews from '../pages/audits/PendingReviews';
import MDSdocAudit from '../pages/audits/MDSdocAudit';
import DocumentAudit from '../pages/audits/DocumentAudit';
import AuditReviewDetail from '../pages/audits/AuditReviewDetail';
import DocTab from '../pages/audits/DocTab';
import Registered from '../pages/auth/Registered';
import Ownership from '../pages/vessels/Ownership';
import OwnershipManager from '../pages/vessels/OwnershipManager';
import Supplier from '../pages/inventory/Supplier';
import Equipment from '../pages/inventory/Equipment';
import SuspectedKeyword from '../pages/inventory/SuspectedKeyword';
import Suspended from '../pages/vessels/Suspended';
import UserProfile from '../pages/settings/UserProfile';
import UserMenu from '../pages/settings/UserMenu';
import UserRights from '../pages/settings/UserRights';
import Users from '../pages/settings/Users';
import UserRoleRights from '../pages/settings/UserRoleRights';
import UserCategory from '../pages/settings/UserCategory';
import Authorizations from '../pages/security/Authorizations';
import Contact from '../pages/cms/Contact';
import SupplierUpload from '../pages/public/SupplierUpload';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* Public supplier upload page — no auth, token in URL */}
      <Route path="/upload/:token" element={<SupplierUpload />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Vessels group: requires vessels_read */}
        <Route element={<ProtectedRoute requiredPermission="vessels_read" />}>
          <Route path="/vessels" element={<Vessels />} />
          <Route path="/vessels/ship" element={<Vessels />} />
          <Route path="/vessels/fleet" element={<Fleet />} />
          <Route path="/vessels/sub-fleet" element={<SubFleet />} />
          <Route path="/vessels/:id" element={<Vessels />} />
          <Route path="/decks" element={<Vessels />} />
          <Route path="/viewer" element={<FullPlanViewer />} />
          <Route path="/menu/registered" element={<Registered />} />
          <Route path="/menu/ownership" element={<Ownership />} />
          <Route path="/menu/ownership-manager" element={<OwnershipManager />} />
        </Route>

        {/* Materials Record group: requires materials_read */}
        <Route element={<ProtectedRoute requiredPermission="materials_read" />}>
          <Route path="/mapping" element={<HazardousMaterialMapping />} />
          <Route path="/materials" element={<Dashboard />} />
        </Route>

        {/* Purchase Orders: requires purchase_orders_read */}
        <Route element={<ProtectedRoute requiredPermission="purchase_orders_read" />}>
          <Route path="/purchase-orders" element={<Dashboard />} />
        </Route>

        {/* Purchase Orders Creation: requires purchase_orders_create */}
        <Route element={<ProtectedRoute requiredPermission="purchase_orders_create" />}>
          <Route path="/administration/upload-po" element={<UploadPurchaseOrder />} />
        </Route>

        {/* Audits/Administration: requires audits_read */}
        <Route element={<ProtectedRoute requiredPermission="audits_read" />}>
          <Route path="/administration" element={<Dashboard />} />
          <Route path="/administration/pending-audits" element={<PendingAudits />} />
          <Route path="/administration/pending-reviews" element={<PendingReviews />} />
          <Route path="/administration/review-detail/:imo" element={<AuditReviewDetail />} />
          <Route path="/administration/md-sdoc-audit" element={<MDSdocAudit />} />
          <Route path="/administration/document-audit/:imo" element={<DocumentAudit />} />
          <Route path="/menu/suspended" element={<Suspended />} />
        </Route>

        {/* Documents Upload: requires documents_read */}
        <Route element={<ProtectedRoute requiredPermission="documents_read" />}>
          <Route path="/administration/upload-docs" element={<DocTab />} />
        </Route>

        {/* Security / User management: requires security_read */}
        <Route element={<ProtectedRoute requiredPermission="security_read" />}>
          <Route path="/security" element={<Dashboard />} />
          <Route path="/security/users" element={<Users />} />
          <Route path="/security/user-profile" element={<UserProfile />} />
          <Route path="/security/user-menu" element={<UserMenu />} />
          <Route path="/security/user-rights" element={<UserRights />} />
          <Route path="/security/user-role-rights" element={<UserRoleRights />} />
          <Route path="/security/user-category" element={<UserCategory />} />
        </Route>

        {/* Security authorizations edit: requires security_update */}
        <Route element={<ProtectedRoute requiredPermission="security_update" />}>
          <Route path="/security/authorizations" element={<Authorizations />} />
        </Route>

        {/* Settings / Inventory: requires settings_read */}
        <Route element={<ProtectedRoute requiredPermission="settings_read" />}>
          <Route path="/menu/supplier" element={<Supplier />} />
          <Route path="/menu/equipment" element={<Equipment />} />
          <Route path="/menu/suspected-keyword" element={<SuspectedKeyword />} />
        </Route>

        {/* Master Data and Inventory stubs */}
        <Route path="/master-data" element={<Dashboard />} />
        <Route path="/inventory" element={<Dashboard />} />

        {/* Public contact form */}
        <Route path="/contact" element={<Contact />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
