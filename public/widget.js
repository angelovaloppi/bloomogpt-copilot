(function () {
  // Update this after deploy if your Vercel URL is different:
  const API_BASE = "https://bloomogpt-copilot.vercel.app";

  const API = {
    chat: API_BASE + "/api/chat",
    sugg: API_BASE + "/api/suggestions"
  };

  const el = document.getElementById("bloomogpt");
  const state = { sessionId: crypto.randomUUID(), lang: null, sector: null, history: [], suggestions: [] };

  function ui() {
    el.innerHTML = `
      <style>
        .chip{display:inline-block;margin:4px 6px;padding:8px 12px;border:1px solid #333;border-radius:999px;cursor:pointer}
        .chip.active{background:#222}
        .row{margin:12px 0}
        .msg{white-space:pre-wrap;line-height:1.5;border-top:1px solid #222;padding-top:12px;margin-top:12px}
        .input{display:flex;gap:8px;margin-top:12px}
        .input input{flex:1;padding:12px;border-radius:10px;border:1px solid #333;background:#111;color:#fff}
        .input button{padding:12px 16px;border-radius:10px;border:1px solid #333;background:#1a1a1a;color:#fff;cursor:pointer}
        .suggestion{display:inline-block;margin:4px 6px;padding:6px 10px;border:1px dashed #444;border-radius:8px;cursor:pointer;opacity:.9}
      </style>
      <h2 style="margin:0 0 6px 0">BloomoGPT – Business Copilot</h2>
      <div class="row"><strong>1) Language</strong><br>
        ${["it","en","fr","de","es"].map(l=>`<span class="chip ${state.lang===l?'active':''}" data-lang="${l}">${l.toUpperCase()}</span>`).join("")}
      </div>
      <div class="row"><strong>2) Sector</strong><br>
        ${["general","wine","food","spirits","fashion","tech"].map(s=>`<span class="chip ${state.sector===s?'active':''}" data-sector="${s}">${s}</span>`).join("")}
      </div>
      <div class="row" id="sugg"></div>
      <div class="row input">
        <input id="prompt" placeholder="Type your request..." />
        <button id="ask">Ask</button>
      </div>
      <div id="chat" class="row"></div>
    `;

    el.querySelectorAll("[data-lang]").forEach(n => n.onclick = () => { state.lang = n.dataset.lang; refreshSuggestions(); ui(); });
    el.querySelectorAll("[data-sector]").forEach(n => n.onclick = () => { state.sector = n.dataset.sector; refreshSuggestions(); ui(); });

    el.querySelector("#ask").onclick = ask;
    el.querySelector("#prompt").onkeydown = (e) => { if (e.key === "Enter") ask(); };

    renderSugg(state.suggestions);
  }

  async function refreshSuggestions() {
    if (!state.lang) { renderSugg([]); return; }
    const r = await fetch(API.sugg + `?lang=${state.lang}&sector=${state.sector||"general"}`);
    const j = await r.json();
    state.suggestions = j.suggestions || [];
    renderSugg(state.suggestions);
  }

  function renderSugg(list) {
    const box = el.querySelector("#sugg");
    if (!box) return;
    box.innerHTML = `<strong>3) Suggestions</strong>
      <div>${(list||[]).map(t=>`<span class="suggestion" data-t="${t.replace(/\"/g,'&quot;')}">${t}</span>`).join("")}</div>`;
    box.querySelectorAll(".suggestion").forEach(n => n.onclick = () => {
      el.querySelector("#prompt").value = n.dataset.t;
    });
  }

  async function ask() {
    const input = el.querySelector("#prompt");
    const prompt = input.value.trim();
    if (!prompt) { input.focus(); return; }
    const chat = el.querySelector("#chat");
    chat.insertAdjacentHTML("beforeend",
      `<div class=msg><strong>You:</strong> ${prompt}</div><div class=msg><strong>Copilot:</strong> <span id="stream-${state.history.length}"></span></div>`
    );

    const res = await fetch(API.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: state.lang || "en", sector: state.sector || "general", prompt, history: state.history })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let all = "";
    const spanId = `#stream-${state.history.length}`;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      all += chunk;
      const span = el.querySelector(spanId);
      if (span) span.textContent = all;
    }
    state.history.push({ role: "user", content: prompt }, { role: "assistant", content: all });
    input.value = "";
  }

  ui();
})();

