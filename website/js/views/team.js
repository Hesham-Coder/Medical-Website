import { el } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

export function renderTeam({ content }) {
  const experts = Array.isArray(content?.experts) ? content.experts.filter((x) => x && x.visible !== false) : [];
  const heading = i18n(content?.teamSection?.heading, getLang() === "ar" ? "الفريق" : "Our Team");
  const sub = i18n(content?.teamSection?.subheading, getLang() === "ar" ? "خبرات متعددة في مكان واحد." : "Specialists working together for you.");

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [el("h1", { class: "view__title", text: heading }), el("p", { class: "view__subtitle", text: sub })]),
    el(
      "div",
      { class: "grid grid--2" },
      experts.map((ex) =>
        el("article", { class: "listcard" }, [
          el("h3", { text: ex?.name || "" }),
          el("p", { text: ex?.title || "" }),
          ex?.bio ? el("p", { text: ex.bio }) : null,
        ])
      )
    ),
  ]);
}

