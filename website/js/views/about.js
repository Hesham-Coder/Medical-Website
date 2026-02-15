import { el, clear } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

function toEmbedSrc(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";

  // YouTube
  if (/youtube\.com\/watch\?v=/i.test(url)) {
    const id = (url.split("v=")[1] || "").split("&")[0];
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }
  if (/youtu\.be\//i.test(url)) {
    const id = (url.split("youtu.be/")[1] || "").split(/[?&]/)[0];
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/i);
  if (vm && vm[1]) return `https://player.vimeo.com/video/${vm[1]}`;

  // Facebook: use plugin wrapper (iframe-friendly).
  if (/facebook\.com\//i.test(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }

  // Already an embed src
  if (/youtube\.com\/embed\//i.test(url) || /youtube-nocookie\.com\/embed\//i.test(url) || /player\.vimeo\.com\/video\//i.test(url) || /facebook\.com\/plugins\/video\.php/i.test(url)) {
    return url;
  }

  return "";
}

export function renderAbout({ content }) {
  const heading = i18n(content?.aboutSection?.heading, getLang() === "ar" ? "عن المركز" : "About");
  const whyHeading = i18n(content?.aboutSection?.highlightsHeading, getLang() === "ar" ? "لماذا نحن" : "Why choose us");
  const paras = Array.isArray(content?.aboutSection?.paragraphs) ? content.aboutSection.paragraphs : [];
  const highlights = Array.isArray(content?.aboutSection?.highlights) ? content.aboutSection.highlights : [];
  const videoUrl = i18n(content?.aboutSection?.videoUrl, "");
  const embed = toEmbedSrc(videoUrl);

  const videoHost = el("div", { class: "panel view" }, [
    el("h2", { class: "view__title", text: getLang() === "ar" ? "فيديو تعريفي" : "Intro Video" }),
  ]);

  if (embed) {
    const btn = el("button", { class: "btn btn--primary", type: "button", text: getLang() === "ar" ? "تشغيل الفيديو" : "Play video" });
    const note = el("p", { class: "view__subtitle", text: getLang() === "ar" ? "سيتم تحميل الفيديو عند التشغيل فقط." : "Video loads only when you press play." });
    const frameWrap = el("div", { style: "margin-top:12px;display:none" });

    btn.addEventListener("click", () => {
      if (frameWrap.dataset.loaded === "1") {
        frameWrap.style.display = "";
        return;
      }
      frameWrap.dataset.loaded = "1";
      frameWrap.style.display = "";
      clear(frameWrap);
      frameWrap.appendChild(
        el("iframe", {
          src: embed,
          title: "About video",
          width: "560",
          height: "314",
          style: "border:0;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden",
          allow:
            "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
          allowfullscreen: "true",
          loading: "lazy",
          referrerpolicy: "no-referrer-when-downgrade",
        })
      );
    });

    videoHost.appendChild(el("div", { style: "margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center" }, [btn]));
    videoHost.appendChild(note);
    videoHost.appendChild(frameWrap);
  } else {
    videoHost.appendChild(el("div", { class: "alert", text: getLang() === "ar" ? "لا يوجد فيديو حالياً." : "No video configured." }));
  }

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [
      el("h1", { class: "view__title", text: heading }),
      el(
        "div",
        { class: "grid", style: "margin-top:12px" },
        paras.map((p) => el("p", { class: "view__subtitle", text: i18n(p, "") }))
      ),
    ]),
    el("div", { class: "panel view" }, [
      el("h2", { class: "view__title", text: whyHeading }),
      highlights.length
        ? el(
            "div",
            { class: "grid grid--2", style: "margin-top:12px" },
            highlights.map((h) => el("div", { class: "listcard" }, [el("h3", { text: i18n(h, "") })]))
          )
        : el("div", { class: "alert", text: getLang() === "ar" ? "لا يوجد تفاصيل." : "No highlights yet." }),
    ]),
    videoHost,
  ]);
}

