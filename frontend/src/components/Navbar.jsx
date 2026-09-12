import React from "react";
import { Link } from "react-router-dom";

import {
  BrainCircuit,
  LogOut
} from "lucide-react";

function Navbar({
  business,
  onLogout
}) {
  return (
    <nav className="navbar">

      <Link className="brand" to="/dashboard">

        <div className="brand-icon">
          <BrainCircuit size={23} />
        </div>

        <div>
          <div className="brand-name">
            LandAI
          </div>

          <div className="brand-subtitle">
            Acquisition Intelligence
          </div>
        </div>

      </Link>

      <div className="nav-right">

        {business && (
          <div className="business-name">
            {business.name} · {business.business_id}
          </div>
        )}

        <button
          className="logout-button"
          onClick={onLogout}
        >
          <LogOut size={17} />
          Logout
        </button>

      </div>

    </nav>
  );
}

export default Navbar;
