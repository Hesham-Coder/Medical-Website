import { el } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

export function renderStories({ content }) {
  const heading = i18n(content?.testimonialsSection?.heading, getLang() === "ar" ? "تجارب المرضى" : "Patient Stories");
  const sub = i18n(
    content?.testimonialsSection?.subheading,
    getLang() === "ar" ? "آراء من مرضى وعائلات تلقوا الرعاية." : "Feedback from patients and families we've supported."
  );
  const list = Array.isArray(content?.testimonials) ? content.testimonials.filter((t) => t && t.visible !== false) : [];

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [el("h1", { class: "view__title", text: heading }), el("p", { class: "view__subtitle", text: sub })]),
    el(
      "div",
      { class: "grid grid--2" },
      list.map((t) =>
        el("article", { class: "listcard" }, [
          el("p", { text: i18n(t?.quote, "") }),
          el("div", { class: "listcard__meta" }, [
            el("span", { text: i18n(t?.author, getLang() === "ar" ? "مريض" : "Patient") }),
            t?.role ? el("span", { text: i18n(t.role, "") }) : null,
          ]),
        ])
      )
    ),
  ]);
}

