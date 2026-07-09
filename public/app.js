const TOKEN_KEY = "urlShortenerToken";
const LINKS_KEY = "urlShortenerLinks";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  updateAuthUI();
}

function getLinks() {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLink(link) {
  const links = getLinks();
  links.unshift(link);
  localStorage.setItem(LINKS_KEY, JSON.stringify(links.slice(0, 50)));
  renderLinks();
}

function showResponse(el, data, isError) {
  el.classList.remove("hidden", "error", "success");
  el.classList.add(isError ? "error" : "success");
  el.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { ...options, headers });
  let body;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { ok: res.ok, status: res.status, body };
}

function updateAuthUI() {
  const token = getToken();
  const statusEl = $("#auth-status");
  const authed = !!token;

  statusEl.textContent = authed
    ? "Logged in (token saved)"
    : "Not logged in — use Google login or paste a token";
  statusEl.className = `status-bar ${authed ? "logged-in" : "logged-out"}`;

  $("#logout-btn").disabled = !authed;
  $("#me-btn").disabled = !authed;
  $("#delete-account-btn").disabled = !authed;
  $("#shorten-btn").disabled = !authed;
  $("#analytics-alias-btn").disabled = !authed;
  $("#analytics-topic-btn").disabled = !authed;
  $("#analytics-overall-btn").disabled = !authed;
}

function renderLinks() {
  const list = $("#links-list");
  const links = getLinks();
  list.innerHTML = "";

  if (links.length === 0) {
    list.innerHTML = '<li class="hint">No links yet. Shorten a URL above.</li>';
    return;
  }

  const base = window.location.origin;
  links.forEach((link) => {
    const li = document.createElement("li");
    const shortFull = `${base}/api/v1/shorten/${link.shortUrl}`;
    li.innerHTML = `
      <div>
        <a href="${shortFull}" target="_blank" rel="noopener">${link.shortUrl}</a>
        <br><small>${link.longUrl}</small>
        ${link.topic ? `<br><small>topic: ${link.topic}</small>` : ""}
      </div>
      <div class="link-actions">
        <button data-copy="${shortFull}">Copy</button>
        <button data-analytics="${link.shortUrl}">Stats</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    });
  });

  list.querySelectorAll("[data-analytics]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("#analytics-alias").value = btn.dataset.analytics;
      switchTab("alias");
      fetchAliasAnalytics();
    });
  });
}

function switchTab(name) {
  $$(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  $("#tab-alias").classList.toggle("hidden", name !== "alias");
  $("#tab-topic").classList.toggle("hidden", name !== "topic");
  $("#tab-overall").classList.toggle("hidden", name !== "overall");
}

const AUTH_ERRORS = {
  google_not_configured:
    "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_SECRET to .env, or use Dev Login.",
  auth_failed: "Google login failed. Check your OAuth redirect URI in Google Cloud Console.",
  dev_login_failed: "Dev login failed. Make sure MongoDB is running.",
};

function showAuthError(code) {
  const el = $("#auth-error");
  if (!code || !AUTH_ERRORS[code]) {
    el.classList.add("hidden");
    return;
  }
  el.textContent = AUTH_ERRORS[code];
  el.classList.remove("hidden", "info");
}

function captureTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const error = params.get("error");

  if (token) {
    setToken(token);
    window.history.replaceState({}, "", "/");
  } else if (error) {
    showAuthError(error);
    window.history.replaceState({}, "", "/");
  }
}

async function loadAuthStatus() {
  try {
    const res = await fetch("/auth/status");
    const data = await res.json();
    const hint = $("#auth-setup-hint");
    const googleBtn = $("#google-login-btn");
    const devBtn = $("#dev-login-btn");

    if (data.googleConfigured) {
      googleBtn.classList.remove("hidden");
      hint.classList.add("hidden");
    } else {
      googleBtn.classList.add("hidden");
      hint.classList.remove("hidden");
      hint.innerHTML =
        "Google OAuth is not set up. Use <strong>Dev Login</strong> to test, or add credentials to <code>.env</code>.";
    }

    if (data.devLoginEnabled) {
      devBtn.classList.remove("hidden");
    }
  } catch {
    $("#dev-login-btn").classList.remove("hidden");
  }
}

// Auth handlers
$("#save-token-btn").addEventListener("click", () => {
  const val = $("#token-input").value.trim();
  if (val) {
    setToken(val);
    $("#token-input").value = "";
    showResponse($("#auth-response"), { message: "Token saved" }, false);
  }
});

$("#logout-btn").addEventListener("click", async () => {
  const el = $("#auth-response");
  const { ok, status, body } = await apiFetch("/auth/logout");
  setToken(null);
  showResponse(el, body, !ok);
});

$("#me-btn").addEventListener("click", async () => {
  const el = $("#auth-response");
  const { ok, status, body } = await apiFetch("/auth/me");
  showResponse(el, { status, ...body }, !ok);
});

$("#delete-account-btn").addEventListener("click", async () => {
  if (!confirm("Delete your account? This cannot be undone.")) return;
  const el = $("#auth-response");
  const { ok, body } = await apiFetch("/auth/delete-account", {
    method: "DELETE",
  });
  if (ok) setToken(null);
  showResponse(el, body, !ok);
});

// Shorten URL
$("#shorten-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const el = $("#shorten-response");

  const payload = {
    longUrl: $("#long-url").value.trim(),
    topic: $("#topic").value.trim(),
  };

  // Custom Alias
  const alias = $("#custom-alias").value.trim();
  if (alias) {
    payload.customAlias = alias;
  }
  const startDate = $("#start-date").value;
  if (startDate) {
    payload.startDate = new Date(startDate).toISOString();
  }
  
  const endDate = $("#end-date").value;
  if (endDate) {
    payload.endDate = new Date(endDate).toISOString();
  }
  const { ok, status, body } = await apiFetch("/api/v1/shorten", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  showResponse(el, { status, ...body }, !ok);

  if (ok && body.newUrl) {
    saveLink({
      shortUrl: body.newUrl.shortUrl,
      longUrl: body.newUrl.longUrl,
      topic: body.newUrl.topic,
    });

    // Reset form
    $("#long-url").value = "";
    $("#custom-alias").value = "";
    $("#topic").value = "";
    $("#start-date").value = "";
    $("#end-date").value = "";
  }
});

$("#clear-links-btn").addEventListener("click", () => {
  localStorage.removeItem(LINKS_KEY);
  renderLinks();
});

// Analytics
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

async function fetchAliasAnalytics() {
  const alias = $("#analytics-alias").value.trim();
  if (!alias) return;
  const el = $("#analytics-response");
  const { ok, status, body } = await apiFetch(
    `/api/v1/analytics/alias/${encodeURIComponent(alias)}`
  );
  showResponse(el, { status, ...body }, !ok);
}

$("#analytics-alias-btn").addEventListener("click", fetchAliasAnalytics);

$("#analytics-topic-btn").addEventListener("click", async () => {
  const topic = $("#analytics-topic").value.trim();
  if (!topic) return;
  const el = $("#analytics-response");
  const { ok, status, body } = await apiFetch(
    `/api/v1/analytics/topic/${encodeURIComponent(topic)}`
  );
  showResponse(el, { status, ...body }, !ok);
});

$("#analytics-overall-btn").addEventListener("click", async () => {
  const el = $("#analytics-response");
  const { ok, status, body } = await apiFetch("/api/v1/analytics/overall");
  showResponse(el, { status, ...body }, !ok);
});

// Rate limit test
async function sendRateTestRequest(index, container) {
  const { ok, status, body } = await apiFetch("/api/test");
  const item = document.createElement("div");
  item.className = `rate-item ${status === 429 ? "limit" : "ok"}`;
  const msg =
    status === 429
      ? typeof body === "string"
        ? body
        : body.message || JSON.stringify(body)
      : JSON.stringify(body);
  item.textContent = `Request #${index}: ${status} — ${msg}`;
  container.appendChild(item);
  return status;
}

async function runRateTest(count) {
  const container = $("#rate-results");
  container.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    await sendRateTestRequest(i, container);
  }
}

$("#rate-test-btn").addEventListener("click", () => runRateTest(7));
$("#rate-single-btn").addEventListener("click", () => runRateTest(1));

// Init
captureTokenFromUrl();
loadAuthStatus();
updateAuthUI();
renderLinks();
