const axios = require("axios");

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token) {
  console.warn(
    "[hubspot] WARNING: HUBSPOT_PRIVATE_APP_TOKEN is not set. Requests to HubSpot will fail. " +
    "Copy .env.example to .env and add your private app token."
  );
}

const client = axios.create({
  baseURL: "https://api.hubapi.com",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Surface HubSpot's actual error message instead of a generic axios error.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.response?.data || err.message;
    const wrapped = new Error(`HubSpot API error (${err.response?.status || "?"}): ${JSON.stringify(msg)}`);
    wrapped.status = err.response?.status;
    throw wrapped;
  }
);

const APP_URL_BASE = "https://app.hubspot.com/contacts"; // portal id is appended by caller when known

/** Build a clickable HubSpot record URL. objectTypeId: 0-1 contact, 0-2 company, 0-3 deal */
function recordUrl(portalId, objectTypeId, recordId) {
  return `${APP_URL_BASE}/${portalId}/record/${objectTypeId}/${recordId}`;
}

async function getPortalId() {
  const res = await client.get("/account-info/v3/details");
  return res.data.portalId;
}

async function getDealPipelines() {
  const res = await client.get("/crm/v3/pipelines/deals");
  return res.data.results;
}

async function listDeals() {
  const res = await client.get("/crm/v3/objects/deals", {
    params: {
      limit: 100,
      properties: "dealname,amount,dealstage,pipeline,closedate,hubspot_owner_id",
      associations: "contacts,companies",
    },
  });
  return res.data.results;
}

async function batchReadContacts(ids) {
  if (ids.length === 0) return [];
  const res = await client.post("/crm/v3/objects/contacts/batch/read", {
    properties: ["firstname", "lastname", "email", "phone"],
    inputs: ids.map((id) => ({ id })),
  });
  return res.data.results;
}

async function batchReadCompanies(ids) {
  if (ids.length === 0) return [];
  const res = await client.post("/crm/v3/objects/companies/batch/read", {
    properties: ["name"],
    inputs: ids.map((id) => ({ id })),
  });
  return res.data.results;
}

async function updateDealStage(dealId, dealstage) {
  const res = await client.patch(`/crm/v3/objects/deals/${dealId}`, {
    properties: { dealstage },
  });
  return res.data;
}

async function listContacts(query) {
  if (query) {
    const res = await client.post("/crm/v3/objects/contacts/search", {
      query,
      properties: ["firstname", "lastname", "email", "phone"],
      limit: 50,
    });
    return res.data.results;
  }
  const res = await client.get("/crm/v3/objects/contacts", {
    params: { limit: 100, properties: "firstname,lastname,email,phone" },
  });
  return res.data.results;
}

async function findContactByEmail(email) {
  if (!email) return null;
  const res = await client.post("/crm/v3/objects/contacts/search", {
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
    properties: ["firstname", "lastname", "email", "phone"],
    limit: 1,
  });
  return res.data.results[0] || null;
}

async function createContact(properties) {
  const res = await client.post("/crm/v3/objects/contacts", { properties });
  return res.data;
}

async function createCompany(properties) {
  const res = await client.post("/crm/v3/objects/companies", { properties });
  return res.data;
}

async function createDeal(properties) {
  const res = await client.post("/crm/v3/objects/deals", { properties });
  return res.data;
}

async function createNote(properties) {
  const res = await client.post("/crm/v3/objects/notes", { properties });
  return res.data;
}

/** Default (unlabeled) association between two existing records. Object type names are singular: contact, company, deal, note */
async function associateDefault(fromType, fromId, toType, toId) {
  await client.put(`/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`);
}

/** Find a deal already associated with a given contact (used to avoid duplicate deals on repeat audits) */
async function findDealForContact(contactId) {
  const res = await client.get(`/crm/v4/objects/contact/${contactId}/associations/deal`);
  const first = res.data.results[0];
  if (!first) return null;
  const dealRes = await client.get(`/crm/v3/objects/deals/${first.toObjectId}`, {
    params: { properties: "dealname,dealstage,pipeline" },
  });
  return dealRes.data;
}

module.exports = {
  client,
  recordUrl,
  getPortalId,
  getDealPipelines,
  listDeals,
  batchReadContacts,
  batchReadCompanies,
  updateDealStage,
  listContacts,
  findContactByEmail,
  createContact,
  createCompany,
  createDeal,
  createNote,
  associateDefault,
  findDealForContact,
};
