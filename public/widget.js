(function () {
  // Update if your Vercel URL differs:
  const API_BASE = "https://bloomogpt-copilot.vercel.app";
  const API = {
    chat: API_BASE + "/api/chat",
    sugg: API_BASE + "/api/suggestions",
    lead: API_BASE + "/api/lead"
  };

  const el = document.getElementById("bloomogpt");
  // --- LANGUAGE SETUP (insert this at the very top of widget.js) ---

// Supported languages
const SUPPORTED_LANGS = ["en", "it", "fr", "de", "es"];

// Auto-detect from browser
function detectLang() {
  const raw = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  const short = raw.split("-")[0];
  return SUPPORTED_LANGS.includes(short) ? short : "en";
}

// Translation dictionary
const I18N = {
  en: {
    title: "BloomoGPT – Business Copilot",
    name: "Your name",
    email: "you@company.com",
    sector: "e.g., premium wine, organic snacks, SaaS analytics...",
    continue: "Continue",
    langLabel: "Language",
    suggestionsTitle: "Suggestions",
    starterTasks(sector) {
      return [
        "Export regulations for your products",
        "Prospect list of distributors/retailers",
        "Competitor price mapping in target markets",
        "Channel strategy & margin model",
        "Quarterly promo plan"
      ];
    }
  },
  it: {
    title: "BloomoGPT – Business Copilot",
    name: "Il tuo nome",
    email: "tu@azienda.com",
    sector: "es. vino premium, snack biologici, SaaS analytics...",
    continue: "Continua",
    langLabel: "Lingua",
    suggestionsTitle: "Suggerimenti",
    starterTasks(sector) {
      return [
        "Norme export per i tuoi prodotti",
        "Lista prospect di distributori/retail",
        "Mappatura prezzi competitor nei mercati target",
        "Strategia canali e modello margini",
        "Piano promo per il prossimo trimestre"
      ];
    }
  }
};

// Translation helper
function t(key) {
  const pack = I18N[state.lang] || I18N.en;
  return pack[key] || (I18N.en[key] || key);
}

// --- END OF LANGUAGE SETUP ---

 const state = {
  sessionId: crypto.randomUUID(),
  lead: null,
  lang: detectLang(),   // <— this line auto-detects user’s language
  suggestions: []
};
window.state = state;

  function ui() {
    el.innerHTML = `
      <style>
        .wrap { max-width: 820px; margin: 6vh auto; padding: 20px; }
        .card { background: #0f0f10; border: 1px solid #242424; border-radius: 14px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        h2 { margin: 0 0 16px 0; font-size: 28px; line-height: 1.2; letter-spacing: .3px; }
        .row { margin: 14px 0; }
        label { display:block; font-size: 13px; opacity:.9; margin-bottom:6px; }
        input, textarea { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #2b2b2b; background:#121214; color:#fff; }
        button { padding:12px 16px; border-radius:10px; border:1px solid #2b2b2b; background:#1b1b1e; color:#fff; cursor:pointer; }
        button.primary { background:#1f2937; }
        .chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .chip{ padding:8px 12px; border-radius:999px; border:1px solid #2b2b2b; background:#141416; cursor:pointer; font-size:13px; }
        .msg{ white-space:pre-wrap; line-height:1.6; border-top:1px solid #1d1d1f; padding-top:12px; margin-top:12px; }
        .mt8{ margin-top:8px } .mt12{ margin-top:12px } .mt16{ margin-top:16px }
        .subtitle { opacity:.85; font-size:14px; }
        .flex { display:flex; gap:8px; }
        @media (max-width: 640px){ .flex { flex-direction:column; } }
      </style>

      <div class="wrap">
        <div class="card">
          <h2>BloomoGPT – Business Copilot</h2>

          ${!state.lead ? `
            <div class="subtitle">Tell us who you are to personalize your experience.</div>
            <div class="row flex">
              <div style="flex:1">
                <label>Name</label>
                <input id="lead-name" placeholder="Your name" />
              </div>
              <div style="flex:1">
                <label>Email</label>
                <input id="lead-email" placeholder="you@company.com" />
              </div>
            </div>
            <div class="row">
              <label>Sector</label>
              <input id="lead-sector" placeholder="e.g., premium wine, organic snacks, SaaS analytics..." />
            </div>
            <div class="row">
              <button id="lead-save" class="primary">Continue</button>
            </div>
          ` : `
            <div class="subtitle">Welcome, ${escapeHTML(state.lead.name)} — sector: ${escapeHTML(state.lead.sector)}</div>
            <div class="row">
              <label>Suggested tasks</label>
              <div id="sugg" class="chips"></div>
            </div>

            <div class="row">
              <label>Your request</label>
              <div class="flex">
                <input id="prompt" placeholder="Type your request..." />
                <button id="ask" class="primary">Ask</button>
              </div>
            </div>

            <div id="chat" class="row"></div>
          `}
        </div>
      </div>
    `;

    if (!state.lead) {
      el.querySelector("#lead-save").onclick = saveLead;
    } else {
      el.querySelector("#ask").onclick = ask;
      el.querySelector("#prompt").onkeydown = (e)=>{ if(e.key==="Enter") ask(); };
      renderSuggestions();
    }
  }

  async function saveLead() {
    const name = el.querySelector("#lead-name").value.trim();
    const email = el.querySelector("#lead-email").value.trim();
    const sector = el.querySelector("#lead-sector").value.trim();
    if (!name || !email || !sector) { alert("Please fill name, email and sector."); return; }

    const lead = { name, email, sector, sessionId: state.sessionId, ts: Date.now() };
    // Store server-side (MVP: logs). Later we'll wire to Supabase/CRM.
    try { await fetch(API.lead, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(lead) }); } catch(e){}

    state.lead = lead;
    // Fetch tailored suggestions
    await refreshSuggestions(sector);
    ui();
  }

  async function refreshSuggestions(sectorText) {
    const r = await fetch(API.sugg + `?sector=${encodeURIComponent(sectorText||"")}`);
    const j = await r.json();
    state.suggestions = j.suggestions || [];
  }

  function renderSuggestions() {
    const box = el.querySelector("#sugg");
    if (!box) return;
    box.innerHTML = "";
    (state.suggestions || []).forEach(t => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      span.onclick = () => { el.querySelector("#prompt").value = t; };
      box.appendChild(span);
    });
  }

  async function ask() {
    const input = el.querySelector("#prompt");
    const prompt = input.value.trim();
    if (!prompt) { input.focus(); return; }

    const chat = el.querySelector("#chat");
    const uid = state.history.length;
    chat.insertAdjacentHTML("beforeend",
      `<div class=msg><strong>You:</strong> ${escapeHTML(prompt)}</div><div class=msg><strong>Copilot:</strong> <span id="stream-${uid}"></span></div>`
    );

    const res = await fetch(API.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sector: state.lead?.sector || "general",
        prompt,
        history: state.history,
        lead: state.lead
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let all = "";
    const spanId = `#stream-${uid}`;
    while(true){
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      all += chunk;
      const span = el.querySelector(spanId);
      if (span) span.textContent = all;
    }
    state.history.push({ role:"user", content: prompt }, { role:"assistant", content: all });
    input.value = "";
  }

  function escapeHTML(s){ return (s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

  ui();
})();
