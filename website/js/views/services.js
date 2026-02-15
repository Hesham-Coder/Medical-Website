import { el } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

export function renderServices({ content }) {
  const list = Array.isArray(content?.services) ? content.services : [];
  const heading = getLang() === "ar" ? "الخدمات" : "Services";
  const sub = getLang() === "ar" ? "نقدم رعاية منظمة عبر تخصصات متعددة." : "Coordinated care across key specialties.";

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("h1", { class: "view__title", text: heading }),
      el("p", { class: "view__subtitle", text: sub }),
    ]),
    el(
      "div",
      { class: "grid grid--2" },
      list.map((s) =>
        el("article", { class: "listcard" }, [
          el("h3", { text: i18n(s?.title, "") }),
          el("p", { text: i18n(s?.description, "") }),
        ])
      )
    ),
  ]);
}

