require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const pipelineRoutes = require("./routes/pipeline");
const contactsRoutes = require("./routes/contacts");
const auditsRoutes = require("./routes/audits");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/pipeline", pipelineRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/audits", auditsRoutes);

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SolarTech CRM server running on port ${PORT}`);
  if (!process.env.HUBSPOT_PRIVATE_APP_TOKEN) {
    console.warn("Set HUBSPOT_PRIVATE_APP_TOKEN in your .env file — see .env.example");
  }
});
