const express = require("express");
const hubspot = require("../lib/hubspot");

const router = express.Router();

// GET /api/pipeline -> { stages, deals, portalId }
router.get("/", async (req, res) => {
  try {
    const [pipelines, deals, portalId] = await Promise.all([
      hubspot.getDealPipelines(),
      hubspot.listDeals(),
      hubspot.getPortalId(),
    ]);

    const pipeline = pipelines.find((p) => p.id === "default") || pipelines[0];
    const stages = (pipeline?.stages || []).map((s) => ({
      id: s.id,
      label: s.label,
      order: s.displayOrder,
    }));

    const contactIds = new Set();
    const companyIds = new Set();
    for (const d of deals) {
      (d.associations?.contacts?.results || []).forEach((r) => contactIds.add(r.id));
      (d.associations?.companies?.results || []).forEach((r) => companyIds.add(r.id));
    }

    const [contacts, companies] = await Promise.all([
      hubspot.batchReadContacts([...contactIds]),
      hubspot.batchReadCompanies([...companyIds]),
    ]);
    const contactMap = Object.fromEntries(contacts.map((c) => [c.id, c.properties]));
    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.properties]));

    const enrichedDeals = deals.map((d) => {
      const contactId = d.associations?.contacts?.results?.[0]?.id;
      const companyId = d.associations?.companies?.results?.[0]?.id;
      const contact = contactId ? contactMap[contactId] : null;
      const company = companyId ? companyMap[companyId] : null;
      return {
        id: d.id,
        name: d.properties.dealname,
        amount: d.properties.amount,
        stage: d.properties.dealstage,
        closeDate: d.properties.closedate,
        contactName: contact ? `${contact.firstname || ""} ${contact.lastname || ""}`.trim() : null,
        contactId: contactId || null,
        companyName: company?.name || null,
        url: hubspot.recordUrl(portalId, "0-3", d.id),
      };
    });

    res.json({ stages, deals: enrichedDeals, portalId });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/pipeline/deals/:id  { stage }
router.patch("/deals/:id", async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ error: "stage is required" });
    const updated = await hubspot.updateDealStage(req.params.id, stage);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
