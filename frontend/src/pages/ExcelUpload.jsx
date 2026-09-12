import React, { useState } from "react";
import axios from "axios";

function ExcelUpload() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post("http://localhost:5000/api/survey/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    setResult(res.data);
  };

  return (
    <div style={{ backgroundColor: "#fff", padding: "40px", maxWidth: "600px", margin: "auto", borderRadius: "8px", boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ color: "#1976D2", marginBottom: "20px" }}>Upload Survey Data</h2>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} style={{ marginTop: "15px", backgroundColor: "#1976D2", color: "#fff", padding: "10px", border: "none", borderRadius: "4px" }}>
        Upload
      </button>

      {result && (
        <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "20px", borderRadius: "6px" }}>
          <h3>Survey Data Processed</h3>
          <pre>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default ExcelUpload;
