import { el } from "../dom.js";
import { getLang } from "../i18n.js";

export function renderNotFound() {
  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("h1", { class: "view__title", text: getLang() === "ar" ? "الصفحة غير موجودة" : "Page not found" }),
      el("p", { class: "view__subtitle", text: getLang() === "ar" ? "تحقق من الرابط أو ارجع للصفحة الرئيسية." : "Check the URL or return to the homepage." }),
      el("a", { class: "btn btn--primary", href: "/", text: getLang() === "ar" ? "الصفحة الرئيسية" : "Home" }),
    ]),
  ]);
}

