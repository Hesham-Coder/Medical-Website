import { el } from "../dom.js";
import { getLang } from "../i18n.js";

export function renderError({ err }) {
  const msg = (err && err.message) || (getLang() === "ar" ? "حدث خطأ" : "Something went wrong");
  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("h1", { class: "view__title", text: getLang() === "ar" ? "خطأ" : "Error" }),
      el("div", { class: "alert alert--error", text: msg }),
      el("a", { class: "btn", href: "/", text: getLang() === "ar" ? "رجوع" : "Go home" }),
    ]),
  ]);
}

