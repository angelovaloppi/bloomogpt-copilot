(function () {
  // ------- CONFIG -------
  // If your Vercel URL ever changes, update this:
  const API_BASE = "https://bloomogpt-copilot.vercel.app";
  const API = {
    chat: API_BASE + "/api/chat",
    sugg: API_BASE + "/api/suggestions",
    lead: API_BASE + "/api/lead"
  };

  // ------- LANGUAGE SETUP -------
  const SUPPORTED_LANGS = ["en", "it", "fr", "de", "es"];
  function detectLang() {
    const raw = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    const short = raw.split("-")[0];
    return SUPPORTED_LANGS.includes(short) ? short : "en";
  }

  const I18N = {
    en: {
      title: "BloomoGPT – Business Copilot",
      subtitle: "Tell us who you are to personalize your experience.",
      name: "Your name",
      email: "you@company.com",
      sector: "e.g., premium wine, organic snacks, SaaS analytics...",
      continue: "Continue",
      suggestionsTitle: "Suggestions",
      yourRequest: "Your request",
      requestPlaceholder: "Type your request...",
      ask: "Ask",
      welcomePrefix: "Welcome",
      sectorLabel: "Sector",
      suggestedTasks: "Suggested tasks",
      formError: "Please fill name, email and sector.",
      emailError: "Please enter a valid email address.",
      saveError: "Could not save your info. Details:\n"
    },
    it: {
      title: "BloomoGPT – Business Copilot",
      subtitle: "Dicci chi sei per personalizzare l'esperienza.",
      name: "Il tuo nome",
      email: "tu@azienda.com",
      sector: "es. vino premium, snack biologici, SaaS analytics...",
      continue: "Continua",
      suggestionsTitle: "Suggerimenti",
      yourRequest: "La tua richiesta",
      requestPlaceholder: "Scrivi la tua richiesta...",
      ask: "Chiedi",
      welcomePrefix: "Benvenuto/a",
      sectorLabel: "Settore",
      suggestedTasks: "Attività suggerite",
      formError: "Compila nome, email e settore.",
      emailError: "Inserisci un indirizzo email valido.",
      saveError: "Non è stato possibile salvare i dati. Dettagli:\n"
    }
  };

  function t(key) {
    const pack = I18N[state.lang] || I18N.en;
    return pack[key] || (I18N.en[key] || key);
  }

  // ------- STATE -------
  const el = document.getElementById("bloomogpt");
  const state = {
    sessionId: crypto.randomUUID(),
    lead: null,
    lang: detectLang(),
    suggestions: [],
    history: []
  };
  // Expose for quick debugging in console
  window.state = state;

  // ------- UI -------
  function ui() {
    el.innerHTML = `
      <style>
        .wrap { max-width: 820px; margin: 6vh auto; padding: 20px; }
        .card { background: #0f0f10; border: 1px solid #242424; border-radius: 14px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        h2 { margin: 0 0 16px 0; font-size: 28px; line-height: 1.2; letter-spacing: .3px; }
        .row { margin: 14px 0; }
        label { display:block; font-size: 13px; opacity:.9; margin-bottom:6px; }
        input, textarea, select { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #2b2b2b; background:#121214; color:#fff; }
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
          <h2>${t("title")}</h2>

          ${!state.lead ? `
            <div class="subtitle">${t("subtitle")}</div>

            <div class="row flex">
              <div style="flex:1">
                <label>${t("name")}</label>
                <input id="lead-name" placeholder="${t("name")}" />
              </div>
              <div style="flex:1">
                <label>Email</label>
                <input id="lead-email" placeholder="${t("email")}" />
              </div>
            </div>

            <div class="row">
              <label>${t("sectorLabel")}</label>
              <input id="lead-sector" placeholder="${t("sector")}" />
            </div>

            <div class="row">
              <button id="lead-save" class="primary">${t("continue")}</button>
            </div>
          ` : `
            <div class="subtitle">${t("welcomePrefix")}, ${escapeHTML(state.lead.name)} — ${t("sectorLabel").toLowerCase()}: ${escapeHTML(state.lead.sector)}</div>

            <div class="row">
              <label>${t("suggestedTasks")}</label>
              <div id="sugg" class="chips"></div>
            </div>

            <div class="row">
              <label>${t("yourRequest")}</label>
              <div class="flex">
                <input id="prompt" placeholder="${t("requestPlaceholder")}" />
                <button id="ask" class="primary">${t("ask")}</button>
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

  // ------- ACTIONS -------
  async function saveLead() {
    const name = el.querySelector("#lead-name").value.trim();
    const email = el.querySelector("#lead-email").value.trim();
    const sector = el.querySelector("#lead-sector").value.trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !email || !sector) { alert(t("formError")); return; }
    if (!emailOk) { alert(t("emailError")); return; }

    const lead = { name, email, sector, sessionId: state.sessionId, ts: Date.now(), lang: state.lang };

    try {
      const res = await fetch(API.lead, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(lead)
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(t("saveError") + txt);
        return;
      }
    } catch (e) {
      alert(t("saveError") + (e?.message || e));
      return;
    }

    state.lead = lead;
    await refreshSuggestions(sector);
    ui();
  }

  async function refreshSuggestions(sectorText) {
    try {
      const r = await fetch(API.sugg + `?sector=${encodeURIComponent(sectorText||"")}&lang=${state.lang}`);
      const j = await r.json();
      // Combine with a small local starter set (optional, language-aware)
      const starters = starterTasks(state.lang, sectorText);
      state.suggestions = (j.suggestions || starters || []).slice(0, 8);
    } catch {
      state.suggestions = starterTasks(state.lang, sectorText);
    }
  }

  function renderSuggestions() {
    const box = el.querySelector("#sugg");
    if (!box) return;
    box.innerHTML = "";
    (state.suggestions || []).forEach(t => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      span.onclick = () => { const p = el.querySelector("#prompt"); if (p) p.value = t; };
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
        lang: state.lang,                           // ensure language is sent
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

  // ------- HELPERS -------
  function escapeHTML(s){ return (s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

  function starterTasks(lang, sector) {
    const pack = I18N[lang] || I18N.en;
    // could tailor by sector later; keeping simple now
    return [
      pack.suggestionsTitle === "Suggerimenti" ? "Norme export per i tuoi prodotti" : "Export regulations for your products",
      pack.suggestionsTitle === "Suggerimenti" ? "Lista prospect (distributori/retail)" : "Prospect list (distributors/retailers)",
      pack.suggestionsTitle === "Suggerimenti" ? "Mappatura prezzi competitor" : "Competitor price mapping",
      pack.suggestionsTitle === "Suggerimenti" ? "Strategia canali & margini" : "Channel strategy & margin model",
      pack.suggestionsTitle === "Suggerimenti" ? "Piano promo trimestrale" : "Quarterly promo plan"
    ];
  }

  // initial render
  ui();
})();
