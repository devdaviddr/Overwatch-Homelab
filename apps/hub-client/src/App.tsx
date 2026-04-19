import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { DashboardLayout } from "./components/DashboardLayout.tsx";
import { OverviewPage } from "./pages/OverviewPage.tsx";
import { HomeLabPage } from "./pages/HomeLabPage.tsx";

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="labs/:labId" element={<HomeLabPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
