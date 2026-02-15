import { el } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

export function renderHome({ content }) {
  const title = i18n(content?.siteInfo?.heroHeading, i18n(content?.siteInfo?.title, "Comprehensive Cancer Center"));
  const sub = i18n(content?.siteInfo?.heroSubheading, "");
  const lead = i18n(content?.siteInfo?.heroDescription, i18n(content?.siteInfo?.tagline, ""));

  const primary = i18n(content?.siteInfo?.heroCtaPrimary, getLang() === "ar" ? "احجز استشارة" : "Schedule a Consultation");
  const secondary = i18n(content?.siteInfo?.heroCtaSecondary, getLang() === "ar" ? "اعرف المزيد" : "Learn More");

  const hero = el("section", { class: "hero panel" }, [
    el("div", { class: "hero__kicker", text: i18n(content?.siteInfo?.tagline, getLang() === "ar" ? "رعاية تثق بها" : "Care you can trust") }),
    el("h1", { class: "hero__title", text: [title, sub].filter(Boolean).join(" ") }),
    el("p", { class: "hero__lead", text: lead }),
    el("div", { class: "hero__cta" }, [
      el("a", { class: "btn btn--primary", href: "/contact", text: primary }),
      el("a", { class: "btn", href: "/services", text: secondary }),
    ]),
    el("div", { class: "value", "aria-label": "Value proposition" }, [
      el("div", { class: "value__item" }, [
        el("h3", { text: getLang() === "ar" ? "تشخيص دقيق" : "Advanced diagnostics" }),
        el("p", { text: getLang() === "ar" ? "تصوير واختبارات تساعد على اختيار العلاج الأنسب." : "Imaging and testing to guide the right plan." }),
      ]),
      el("div", { class: "value__item" }, [
        el("h3", { text: getLang() === "ar" ? "فريق متعدد التخصصات" : "Multidisciplinary team" }),
        el("p", { text: getLang() === "ar" ? "أطباء من تخصصات مختلفة في مسار واحد." : "Coordinated specialists in one care path." }),
      ]),
      el("div", { class: "value__item" }, [
        el("h3", { text: getLang() === "ar" ? "دعم شامل" : "Supportive care" }),
        el("p", { text: getLang() === "ar" ? "تغذية وصحة نفسية ومتابعة بعد العلاج." : "Nutrition, mental health, survivorship." }),
      ]),
    ]),
  ]);

  return el("div", { class: "section" }, [hero]);
}

