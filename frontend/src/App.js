import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import CableFunctions from "@/pages/CableFunctions";
import MachinePrograms from "@/pages/MachinePrograms";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import BundleDetail from "@/pages/BundleDetail";
import Compare from "@/pages/Compare";
import TrainingMatrix from "@/pages/TrainingMatrix";
import Users from "@/pages/Users";
import CuttingSheetPrint from "@/pages/print/CuttingSheetPrint";
import BundleLabelsPrint from "@/pages/print/BundleLabelsPrint";
import QcChecklistPrint from "@/pages/print/QcChecklistPrint";
import PinMapPrint from "@/pages/print/PinMapPrint";
import OperatorWorkOrder from "@/pages/operator/OperatorWorkOrder";
import OperatorBundle from "@/pages/operator/OperatorBundle";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Memuat...</div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/work-orders/:woNumber/print/cutting-sheet" element={<Protected><CuttingSheetPrint /></Protected>} />
          <Route path="/work-orders/:woNumber/print/bundle-labels" element={<Protected><BundleLabelsPrint /></Protected>} />
          <Route path="/work-orders/:woNumber/print/qc-checklist" element={<Protected><QcChecklistPrint /></Protected>} />
          <Route path="/work-orders/:woNumber/print/pin-map" element={<Protected><PinMapPrint /></Protected>} />
          <Route path="/operator/work-orders/:woNumber" element={<Protected><OperatorWorkOrder /></Protected>} />
          <Route path="/operator/work-orders/:woNumber/bundles/:bundleCode" element={<Protected><OperatorBundle /></Protected>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:sku" element={<ProductDetail />} />
            <Route path="/products/:sku/compare/:sourceSku" element={<Compare />} />
            <Route path="/cable-functions" element={<CableFunctions />} />
            <Route path="/machine-programs" element={<MachinePrograms />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/work-orders/:woNumber" element={<WorkOrderDetail />} />
            <Route path="/work-orders/:woNumber/bundles/:bundleCode" element={<BundleDetail />} />
            <Route path="/training" element={<TrainingMatrix />} />
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
