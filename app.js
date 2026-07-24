const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Tabs ---------- */
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + tab.dataset.tab).classList.add("active");
    if(tab.dataset.tab === "pipeline") loadPipeline();
    if(tab.dataset.tab === "contacts") loadContacts();
  });
});

/* ---------- Pipeline ---------- */
let pipelineData = { stages: [], deals: [] };

async function loadPipeline(){
  const board = $("#board");
  board.innerHTML = `<div class="board-empty">Loading pipeline…</div>`;
  try{
    const res = await fetch("/api/pipeline");
    if(!res.ok) throw new Error((await res.json()).error || "Failed to load pipeline");
    pipelineData = await res.json();
    renderBoard();
  }catch(err){
    console.error(err);
    board.innerHTML = `<div class="board-empty">Couldn't load pipeline: ${escapeHtml(err.message)}<br><br>Check that HUBSPOT_PRIVATE_APP_TOKEN is set on the server.</div>`;
  }
}

function renderBoard(){
  const board = $("#board");
  const { stages, deals } = pipelineData;
  if(!stages.length){
    board.innerHTML = `<div class="board-empty">No pipeline stages found.</div>`;
    return;
  }
  board.innerHTML = stages.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage.id);
    return `
      <div class="column" data-stage="${stage.id}">
        <div class="column-head">
          <span>${escapeHtml(stage.label)}</span>
          <span class="column-count">${stageDeals.length}</span>
        </div>
        <div class="column-cards" data-stage-cards="${stage.id}">
          ${stageDeals.map(dealCardHtml).join("") || ""}
        </div>
      </div>
    `;
  }).join("");

  attachDragHandlers();
}

function dealCardHtml(d){
  return `
    <div class="deal-card" draggable="true" data-deal-id="${d.id}">
      <div class="dname">${escapeHtml(d.name || "Untitled deal")}</div>
      <div class="dmeta">
        ${d.contactName ? escapeHtml(d.contactName) : "No contact"}
        ${d.amount ? ` · <span class="damount">$${Number(d.amount).toLocaleString()}</span>` : ""}
      </div>
    </div>
  `;
}

function attachDragHandlers(){
  $$(".deal-card").forEach(card => {
    card.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", card.dataset.dealId);
      setTimeout(() => card.style.opacity = "0.4", 0);
    });
    card.addEventListener("dragend", () => card.style.opacity = "1");
    card.addEventListener("click", () => openDealModal(card.dataset.dealId));
  });

  $$(".column").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("dragover"); });
    col.addEventListener("dragleave", () => col.classList.remove("dragover"));
    col.addEventListener("drop", async e => {
      e.preventDefault();
      col.classList.remove("dragover");
      const dealId = e.dataTransfer.getData("text/plain");
      const newStage = col.dataset.stage;
      const deal = pipelineData.deals.find(d => d.id === dealId);
      if(!deal || deal.stage === newStage) return;
      const prevStage = deal.stage;
      deal.stage = newStage; // optimistic
      renderBoard();
      try{
        const res = await fetch(`/api/pipeline/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: newStage })
        });
        if(!res.ok) throw new Error((await res.json()).error || "Update failed");
        toast("Deal moved ✓");
      }catch(err){
        console.error(err);
        deal.stage = prevStage; // revert
        renderBoard();
        toast("Couldn't move deal — try again");
      }
    });
  });
}

function openDealModal(dealId){
  const d = pipelineData.deals.find(x => x.id === dealId);
  if(!d) return;
  const stageLabel = pipelineData.stages.find(s => s.id === d.stage)?.label || d.stage;
  $("#dealModal").innerHTML = `
    <h3>${escapeHtml(d.name || "Untitled deal")}</h3>
    <div class="detail-row"><span>Stage</span><span>${escapeHtml(stageLabel)}</span></div>
    <div class="detail-row"><span>Contact</span><span>${escapeHtml(d.contactName || "—")}</span></div>
    <div class="detail-row"><span>Company</span><span>${escapeHtml(d.companyName || "—")}</span></div>
    <div class="detail-row"><span>Amount</span><span>${d.amount ? "$" + Number(d.amount).toLocaleString() : "—"}</span></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="closeDealModal">Close</button>
      <a class="btn-primary" style="text-decoration:none;display:inline-block;" href="${d.url}" target="_blank" rel="noopener">Open in HubSpot</a>
    </div>
  `;
  $("#dealModalOverlay").classList.add("open");
  $("#closeDealModal").addEventListener("click", () => $("#dealModalOverlay").classList.remove("open"));
}
$("#dealModalOverlay").addEventListener("click", e => {
  if(e.target.id === "dealModalOverlay") $("#dealModalOverlay").classList.remove("open");
});

$("#refreshPipeline").addEventListener("click", loadPipeline);

/* ---------- Contacts ---------- */
async function loadContacts(query){
  const list = $("#contactList");
  list.innerHTML = `<div class="board-empty">Loading contacts…</div>`;
  try{
    const url = query ? `/api/contacts?q=${encodeURIComponent(query)}` : "/api/contacts";
    const res = await fetch(url);
    if(!res.ok) throw new Error((await res.json()).error || "Failed to load contacts");
    const contacts = await res.json();
    if(contacts.length === 0){
      list.innerHTML = `<div class="board-empty">No contacts yet.</div>`;
      return;
    }
    list.innerHTML = contacts.map(c => `
      <div class="contact-row">
        <div>
          <div class="cname">${escapeHtml(`${c.firstName||""} ${c.lastName||""}`.trim() || "Unnamed contact")}</div>
          <div class="cmeta">${escapeHtml(c.email || "")}${c.phone ? " · " + escapeHtml(c.phone) : ""}</div>
        </div>
        <a href="${c.url}" target="_blank" rel="noopener">View in HubSpot →</a>
      </div>
    `).join("");
  }catch(err){
    console.error(err);
    list.innerHTML = `<div class="board-empty">Couldn't load contacts: ${escapeHtml(err.message)}</div>`;
  }
}

let searchTimer;
$("#contactSearch").addEventListener("input", e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadContacts(e.target.value.trim()), 350);
});

$("#addContactBtn").addEventListener("click", () => $("#contactModalOverlay").classList.add("open"));
$("#cancelContact").addEventListener("click", () => $("#contactModalOverlay").classList.remove("open"));
$("#contactModalOverlay").addEventListener("click", e => {
  if(e.target.id === "contactModalOverlay") $("#contactModalOverlay").classList.remove("open");
});
$("#saveContact").addEventListener("click", async () => {
  const body = {
    firstName: $("#nc_first").value.trim(),
    lastName: $("#nc_last").value.trim(),
    email: $("#nc_email").value.trim(),
    phone: $("#nc_phone").value.trim(),
  };
  if(!body.firstName && !body.email){ toast("Enter at least a name or email"); return; }
  try{
    const res = await fetch("/api/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error((await res.json()).error || "Failed to create contact");
    toast("Contact added ✓");
    $("#contactModalOverlay").classList.remove("open");
    ["nc_first","nc_last","nc_email","nc_phone"].forEach(id => $("#"+id).value = "");
    loadContacts();
  }catch(err){
    console.error(err);
    toast("Couldn't add contact — try again");
  }
});

/* ---------- New Audit ---------- */
const PHOTO_ITEMS = [
  {id:"inverter", label:"Photograph inverter(s) — side of home", note:"Capture make/model label clearly."},
  {id:"panel", label:"Photograph main electrical panel", note:"Interior view, breaker labels visible."},
  {id:"meter", label:"Photograph utility meter", note:""},
  {id:"array", label:"Photograph roof-mounted panels / racking", note:"Wide shot showing all arrays."},
  {id:"conduit", label:"Photograph conduit, disconnects, or junction boxes", note:""},
];

function renderPhotoItems(){
  $("#photoItems").innerHTML = PHOTO_ITEMS.map(p => `
    <div class="item">
      <label class="check-row"><input type="checkbox" data-photo-check="${p.id}"><span>${escapeHtml(p.label)}</span></label>
      ${p.note ? `<div class="item-note">${escapeHtml(p.note)}</div>` : ``}
      <input class="writein" data-photo-note="${p.id}" placeholder="Notes for this item">
    </div>
  `).join("");
}
renderPhotoItems();

$("#a_date").value = new Date().toISOString().slice(0,10);

$("#monitoringChoices").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if(!chip) return;
  $$("#monitoringChoices .chip").forEach(c => c.classList.remove("selected"));
  chip.classList.add("selected");
  $("#a_monitoringChecked").checked = true;
});

$("#submitAudit").addEventListener("click", async () => {
  const photos = PHOTO_ITEMS.map(p => ({
    label: p.label,
    checked: $(`[data-photo-check="${p.id}"]`).checked,
    note: $(`[data-photo-note="${p.id}"]`).value.trim(),
  }));
  const monitoringChoice = $("#monitoringChoices .chip.selected")?.dataset.val || "";

  const audit = {
    homeowner: $("#a_homeowner").value.trim(),
    homeownerEmail: $("#a_email").value.trim(),
    homeownerPhone: $("#a_phone").value.trim(),
    rep: $("#a_rep").value.trim(),
    date: $("#a_date").value,
    address: $("#a_address").value.trim(),
    photos,
    installerName: $("#a_installerName").value.trim(),
    monitoringChoice,
    monitoringPlatform: $("#a_monitoringPlatform").value.trim(),
    notes: $("#a_notes").value.trim(),
  };

  if(!audit.homeowner && !audit.homeownerEmail){
    toast("Add a homeowner name or email first");
    return;
  }

  const btn = $("#submitAudit");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Syncing…";
  try{
    const res = await fetch("/api/audits", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(audit)
    });
    const result = await res.json();
    if(!res.ok || result.status !== "success") throw new Error(result.message || "Sync failed");
    toast("Audit synced to HubSpot ✓");
    clearAuditForm();
  }catch(err){
    console.error(err);
    toast("Couldn't sync — " + err.message);
  }
  btn.disabled = false; btn.textContent = original;
});

function clearAuditForm(){
  ["a_homeowner","a_email","a_phone","a_address","a_installerName","a_monitoringPlatform","a_notes"].forEach(id => $("#"+id).value = "");
  $("#a_installerChecked").checked = false;
  $("#a_monitoringChecked").checked = false;
  $$("#monitoringChoices .chip").forEach(c => c.classList.remove("selected"));
  renderPhotoItems();
  $("#a_date").value = new Date().toISOString().slice(0,10);
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

/* Initial load */
loadPipeline();
