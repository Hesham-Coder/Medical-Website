import { el } from "../dom.js";
import { getLang } from "../i18n.js";

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function renderPost({ content, post }) {
  const title = post?.title || "";
  const excerpt = post?.excerpt || stripHtml(post?.content || "").slice(0, 220);

  // Server-side already sanitizes rich text (scripts/events stripped). Keep formatting.
  const bodyHtml = String(post?.content || "");

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("a", { class: "btn btn--ghost", href: "/news", text: getLang() === "ar" ? "رجوع" : "Back" }),
      el("h1", { class: "view__title", text: title }),
      excerpt ? el("p", { class: "view__subtitle", text: excerpt }) : null,
      el("div", { class: "listcard__meta" }, [
        post?.createdAt ? el("span", { text: new Date(post.createdAt).toLocaleDateString() }) : null,
        post?.author ? el("span", { text: post.author }) : null,
      ]),
    ]),
    el("div", { class: "panel view" }, [
      el("div", { style: "margin:0;color:var(--text);line-height:1.8;font-size:15px", html: bodyHtml || "" }),
    ]),
  ]);
}
