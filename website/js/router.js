function parseQuery(search) {
  const out = {};
  const s = (search || "").replace(/^\?/, "");
  if (!s) return out;
  s.split("&").forEach((pair) => {
    const [k, v] = pair.split("=");
    const key = decodeURIComponent(k || "").trim();
    if (!key) return;
    out[key] = decodeURIComponent(v || "").trim();
  });
  return out;
}

function normalizePath(path) {
  if (!path) return "/";
  const u = String(path);
  const q = u.indexOf("?");
  const p = q >= 0 ? u.slice(0, q) : u;
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

function matchRoute(pathname, search) {
  const path = normalizePath(pathname);
  const query = parseQuery(search || "");

  const postMatch = path.match(/^\/posts\/([^/]+)$/);
  if (postMatch) {
    return { name: "post", path, params: { slug: decodeURIComponent(postMatch[1]) }, query };
  }

  const table = {
    "/": "home",
    "/services": "services",
    "/team": "team",
    "/stories": "stories",
    "/news": "news",
    "/updates": "updates",
    "/articles": "articles",
    "/about": "about",
    "/contact": "contact",
  };

  return { name: table[path] || "notfound", path, params: {}, query };
}

export function createRouter({ onRoute }) {
  if (typeof onRoute !== "function") throw new Error("Router requires onRoute(route)");

  let last = null;

  async function run() {
    const route = matchRoute(window.location.pathname, window.location.search);
    last = route;
    await onRoute(route);
  }

  function go(to) {
    const nextPath = normalizePath(to);
    if (nextPath === normalizePath(window.location.pathname) && !String(to || "").includes("?")) return;
    window.history.pushState({}, "", to);
    run();
  }

  function refresh() {
    if (!last) return run();
    return onRoute(last);
  }

  function start() {
    window.addEventListener("popstate", run);

    // Intercept internal nav clicks (no anchor scroll).
    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/")) return;
      if (href.startsWith("/api/") || href.startsWith("/uploads/") || href.startsWith("/assets/")) return;
      e.preventDefault();
      go(href);
    });

    run();
  }

  return { start, go, refresh };
}

