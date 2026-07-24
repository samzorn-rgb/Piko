const express = require("express");
const hubspot = require("../lib/hubspot");

const router = express.Router();

// GET /api/contacts?q=search
router.get("/", async (req, res) => {
  try {
    const [contacts, portalId] = await Promise.all([
      hubspot.listContacts(req.query.q),
      hubspot.getPortalId(),
    ]);
    res.json(
      contacts.map((c) => ({
        id: c.id,
        firstName: c.properties.firstname,
        lastName: c.properties.lastname,
        email: c.properties.email,
        phone: c.properties.phone,
        url: hubspot.recordUrl(portalId, "0-1", c.id),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/contacts  { firstName, lastName, email, phone }
router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    if (!firstName && !email) {
      return res.status(400).json({ error: "firstName or email is required" });
    }
    const created = await hubspot.createContact({
      firstname: firstName || "",
      lastname: lastName || "",
      email: email || "",
      phone: phone || "",
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
