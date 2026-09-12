import React from "react";

function DashboardCard({
  icon,
  title,
  value,
  description,
  type = "default"
}) {
  return (
    <div className={`dashboard-card ${type}`}>

      <div className="card-icon">
        {icon}
      </div>

      <div className="card-content">

        <div className="card-title">
          {title}
        </div>

        <div className="card-value">
          {value}
        </div>

        {description && (
          <div className="card-description">
            {description}
          </div>
        )}

      </div>

    </div>
  );
}

export default DashboardCard;