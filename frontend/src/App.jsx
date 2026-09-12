import React from "react";
import { Link, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AlertsPage from "./pages/AlertsPage";
import AnalysisPage from "./pages/AnalysisPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BudgetPage from "./pages/BudgetPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import CasesPage from "./pages/CasesPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import ModelPage from "./pages/ModelPage";
import PriorityPage from "./pages/PriorityPage";
import RegisterPage from "./pages/RegisterPage";
import SimulatorPage from "./pages/SimulatorPage";
import SurveyForm from "./pages/SurveyForm";

function NotFound() {
  return (
    <div className="error-page">
      <h2>Page not found</h2>
      <p>The page you requested does not exist.</p>
      <Link className="primary-button" to="/">
        Go to home
      </Link>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/cases/:caseId" element={<CaseDetailPage />} />
          <Route path="/priority" element={<PriorityPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/assessment" element={<SurveyForm />} />
          <Route path="/assessment/result" element={<AnalysisPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
