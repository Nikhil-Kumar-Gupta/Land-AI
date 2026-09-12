const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const surveyRoutes = require("./routes/survey");
const analysisRoutes = require("./routes/analysis");

const app = express();

const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Land AI Platform Backend is running",
    status: "success"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/survey", surveyRoutes);
app.use("/api/analysis", analysisRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "API endpoint not found"
  });
});

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Land AI Backend`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`=================================`);
});