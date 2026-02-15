import { el } from "../dom.js";
import { getLang } from "../i18n.js";

function titleFor(type) {
  const ar = { news: "الأخبار", update: "التحديثات", article: "المقالات" };
  const en = { news: "News", update: "Updates", article: "Articles" };
  return (getLang() === "ar" ? ar : en)[type] || (getLang() === "ar" ? "المنشورات" : "Posts");
}

function buildHref(basePath, q) {
  const u = new URLSearchParams();
  if (q?.q) u.set("q", q.q);
  if (q?.page) u.set("page", q.page);
  const s = u.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function renderPostsIndex({ content, type, data, query }) {
  const heading = titleFor(type);
  const items = Array.isArray(data?.items) ? data.items : [];
  const page = data?.pagination?.page || 1;
  const pages = data?.pagination?.pages || 1;
  const hasNext = Boolean(data?.pagination?.hasNext);

  const basePath = type === "news" ? "/news" : type === "update" ? "/updates" : "/articles";
  const q = String(query?.q || "");

  const searchInput = el("input", { class: "input", type: "search", value: q, placeholder: getLang() === "ar" ? "بحث" : "Search" });
  const searchBtn = el("button", { class: "btn", type: "button", text: getLang() === "ar" ? "بحث" : "Search" });

  const onSearch = () => {
    const nextQ = searchInput.value.trim();
    const href = buildHref(basePath, { q: nextQ, page: 1 });
    if (typeof window.appNavigate === "function") window.appNavigate(href);
    else window.location.assign(href);
  };
  searchBtn.addEventListener("click", onSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch();
  });

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("h1", { class: "view__title", text: heading }),
      el("p", { class: "view__subtitle", text: getLang() === "ar" ? "اخر المنشورات" : "Latest posts" }),
      el("div", { class: "grid", style: "margin-top:12px" }, [
        el("div", { class: "grid grid--2" }, [
          el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "بحث" : "Search" }), searchInput]),
          el("div", { class: "field", style: "align-content:end" }, [el("label", { text: "\u00A0" }), searchBtn]),
        ]),
      ]),
    ]),
    items.length
      ? el(
          "div",
          { class: "grid grid--2" },
          items.map((p) =>
            el("article", { class: "listcard" }, [
              el("h3", { text: p?.title || "" }),
              el("p", { text: p?.excerpt || "" }),
              el("div", { class: "listcard__meta" }, [
                p?.createdAt ? el("span", { text: new Date(p.createdAt).toLocaleDateString() }) : null,
                p?.author ? el("span", { text: p.author }) : null,
                el("a", { href: `/posts/${encodeURIComponent(p.slug)}`, class: "btn", style: "margin-left:auto" }, [
                  el("span", { text: getLang() === "ar" ? "اقرأ" : "Read" }),
                ]),
              ]),
            ])
          )
        )
      : el("div", { class: "panel view" }, [el("div", { class: "alert", text: getLang() === "ar" ? "لا يوجد محتوى بعد." : "No posts yet." })]),
    el("div", { class: "panel view" }, [
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap" }, [
        el(
          "a",
          {
            class: "btn",
            href: buildHref(basePath, { q, page: Math.max(1, page - 1) }),
            "aria-disabled": page <= 1 ? "true" : null,
            style: page <= 1 ? "pointer-events:none;opacity:.6" : "",
            text: getLang() === "ar" ? "السابق" : "Previous",
          },
          []
        ),
        el("div", { class: "view__subtitle", text: `${page} / ${pages}` }),
        el(
          "a",
          {
            class: "btn",
            href: buildHref(basePath, { q, page: page + 1 }),
            "aria-disabled": !hasNext ? "true" : null,
            style: !hasNext ? "pointer-events:none;opacity:.6" : "",
            text: getLang() === "ar" ? "التالي" : "Next",
          },
          []
        ),
      ]),
    ]),
  ]);
}
