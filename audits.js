const express = require("express");
const hubspot = require("../lib/hubspot");

const router = express.Router();

function splitName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return { firstname: "", lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

function buildSummary(audit) {
  const photoLines = (audit.photos || [])
    .map((p) => `- ${p.label}: ${p.checked ? "captured" : "not captured"}${p.note ? " — " + p.note : ""}`)
    .join("\n");
  return [
    `FIELD SOLAR AUDIT — ${audit.homeowner || "Unnamed homeowner"}`,
    `Date: ${audit.date || "n/a"}   Rep: ${audit.rep || "n/a"}`,
    `Address: ${audit.address || "n/a"}`,
    ``,
    `Electrical & Equipment Photos:`,
    photoLines || "(none recorded)",
    ``,
    `System & Installer Information:`,
    `- Installing company: ${audit.installerName || "not recorded"}`,
    `- Monitoring: ${audit.monitoringChoice || "not asked"}${audit.monitoringPlatform ? " — platform: " + audit.monitoringPlatform : ""}`,
    ``,
    `Rep notes: ${audit.notes || "(none)"}`,
  ].join("\n");
}

// POST /api/audits
router.post("/", async (req, res) => {
  const audit = req.body;
  try {
    const portalId = await hubspot.getPortalId();

    // 1. Find or create the contact
    let contact = audit.homeownerEmail ? await hubspot.findContactByEmail(audit.homeownerEmail) : null;
    if (!contact) {
      const { firstname, lastname } = splitName(audit.homeowner);
      contact = await hubspot.createContact({
        firstname,
        lastname,
        email: audit.homeownerEmail || "",
        phone: audit.homeownerPhone || "",
      });
    }

    // 2. Find an existing deal for this contact, otherwise create a new one + company
    let deal = await hubspot.findDealForContact(contact.id);
    let company = null;

    if (!deal) {
      company = await hubspot.createCompany({
        name: audit.address ? `${audit.address}` : `${audit.homeowner || "Unknown"} Residence`,
      });
      deal = await hubspot.createDeal({
        dealname: `${audit.homeowner || audit.address || "New Lead"} — Solar Audit`,
        dealstage: "appointmentscheduled",
        pipeline: "default",
      });
      await hubspot.associateDefault("deal", deal.id, "contact", contact.id);
      await hubspot.associateDefault("deal", deal.id, "company", company.id);
    }

    // 3. Log the audit as a note on the deal
    const note = await hubspot.createNote({
      hs_note_body: buildSummary(audit),
      hs_timestamp: Date.now(),
    });
    await hubspot.associateDefault("note", note.id, "deal", deal.id);

    res.status(201).json({
      status: "success",
      contactUrl: hubspot.recordUrl(portalId, "0-1", contact.id),
      companyUrl: company ? hubspot.recordUrl(portalId, "0-2", company.id) : null,
      dealUrl: hubspot.recordUrl(portalId, "0-3", deal.id),
      dealStage: deal.properties?.dealstage || "appointmentscheduled",
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
