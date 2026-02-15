const cache = {
  content: null,
  postsPages: new Map(), // key -> response
  postBySlug: new Map(),
};

async function fetchJson(url, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = text && text.length < 280 ? text : "";
      throw new Error(`Request failed (${res.status})${msg ? `: ${msg}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function getContent() {
  if (cache.content) return cache.content;
  const data = await fetchJson("/api/public/content", { timeoutMs: 12000 });
  cache.content = data;
  return data;
}

function qs(params) {
  const u = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === "") return;
    u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

export async function getPostsPage({ type, page = 1, limit = 6, search = "" }) {
  const key = JSON.stringify({ type, page, limit, search });
  if (cache.postsPages.has(key)) return cache.postsPages.get(key);

  const url = `/api/posts${qs({ type, page, limit, search })}`;
  const data = await fetchJson(url, { timeoutMs: 12000 });
  cache.postsPages.set(key, data);
  return data;
}

export async function getPostBySlug(slug) {
  const safe = String(slug || "").trim().toLowerCase();
  if (!safe) throw new Error("Missing post slug");
  if (cache.postBySlug.has(safe)) return cache.postBySlug.get(safe);
  const data = await fetchJson(`/api/posts/${encodeURIComponent(safe)}`, { timeoutMs: 12000 });
  cache.postBySlug.set(safe, data);
  return data;
}

