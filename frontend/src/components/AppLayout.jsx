import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  ClipboardList,
  FlaskConical,
  IndianRupee,
  LayoutDashboard,
  ListOrdered,
  Map,
  FilePlus2
} from "lucide-react";

import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cases", label: "Cases", icon: ClipboardList },
  { to: "/priority", label: "Priority Review", icon: ListOrdered },
  { to: "/map", label: "GIS Map", icon: Map },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/budget", label: "Budget & Cost", icon: IndianRupee },
  { to: "/simulator", label: "What-If", icon: FlaskConical },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/assessment", label: "New Assessment", icon: FilePlus2 },
  { to: "/model", label: "Model", icon: BrainCircuit }
];

function AppLayout() {
  const { business, logout } = useAuth();

  return (
    <div className="app-page">
      <Navbar business={business} onLogout={() => logout()} />
      <nav className="app-tabs" aria-label="Main navigation">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `app-tab${isActive ? " active" : ""}`}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <AlertTriangle size={13} />
        Prototype decision-support system · Risk scores come from the trained ML model · All data is SYNTHETIC
      </footer>
    </div>
  );
}

export default AppLayout;
