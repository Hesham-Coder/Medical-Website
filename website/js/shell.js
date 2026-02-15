import { el, clear } from "./dom.js";
import { getLang, i18n } from "./i18n.js";

function menuIcon() {
  const svg =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return el("span", { class: "icon", html: svg });
}

function closeIcon() {
  const svg =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return el("span", { class: "icon", html: svg });
}

function globeIcon() {
  const svg =
    '<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" stroke-width="2"/><path d="M2 12h20" stroke="currentColor" stroke-width="2"/><path d="M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22c-3-3-4.5-6.5-4.5-10S9 5 12 2Z" stroke="currentColor" stroke-width="2"/></svg>';
  return el("span", { class: "icon", html: svg });
}

const NAV = [
  { path: "/", key: "Home", hintKey: "Hero" },
  { path: "/services", key: "Services", hintKey: "Care" },
  { path: "/team", key: "Team", hintKey: "Experts" },
  { path: "/stories", key: "Stories", hintKey: "Testimonials" },
  { path: "/news", key: "News", hintKey: "Updates" },
  { path: "/articles", key: "Articles", hintKey: "Learn" },
  { path: "/about", key: "About", hintKey: "Center" },
  { path: "/contact", key: "Contact", hintKey: "Form" },
];

export function createShell({ onNavigate, onToggleLang }) {
  let activePath = "/";

  const brandTitle = el("div", { class: "brand__title", text: "Comprehensive Cancer Center" });
  const brandTagline = el("div", { class: "brand__tagline", text: "" });

  const brand = el(
    "a",
    {
      class: "brand",
      href: "/",
      onClick: (e) => {
        e.preventDefault();
        onNavigate("/");
        closeDrawer();
      },
    },
    [
      el("div", { class: "brand__mark", "aria-hidden": "true" }),
      el("div", { class: "brand__text" }, [brandTitle, brandTagline]),
    ]
  );

  const menuBtn = el(
    "button",
    {
      class: "btn btn--icon",
      type: "button",
      "aria-label": "Open menu",
      onClick: () => openDrawer(),
    },
    [menuIcon()]
  );

  const langBtn = el(
    "button",
    {
      class: "btn",
      type: "button",
      onClick: () => onToggleLang(),
      "aria-label": "Change language",
    },
    [globeIcon(), el("span", { text: getLang() === "ar" ? "AR" : "EN" })]
  );

  const primaryCta = el(
    "a",
    {
      class: "btn btn--primary",
      href: "/contact",
      onClick: (e) => {
        e.preventDefault();
        onNavigate("/contact");
        closeDrawer();
      },
    },
    [el("span", { text: "Book" })]
  );

  const topbar = el("header", { class: "topbar" }, [
    el("div", { class: "topbar__inner" }, [el("div", { style: "display:flex;gap:8px;align-items:center" }, [menuBtn, brand]), el("div", { class: "topbar__actions" }, [langBtn, primaryCta])]),
  ]);

  const main = el("main", { class: "main", id: "app-main", tabindex: "-1" }, [
    el("div", { class: "container" }, [el("div", { class: "panel" }, [el("div", { class: "view", text: "" })])]),
  ]);
  const viewHost = main.querySelector(".view");

  // Drawer
  const drawerTitle = el("div", { class: "brand__title", text: "Menu" });
  const drawerClose = el(
    "button",
    { class: "btn btn--icon", type: "button", "aria-label": "Close menu", onClick: () => closeDrawer() },
    [closeIcon()]
  );

  const navList = el("nav", { class: "navlist", "aria-label": "Site navigation" });
  function renderNav() {
    clear(navList);
    NAV.forEach((item) => {
      const a = el(
        "a",
        {
          class: "navitem",
          href: item.path,
          "aria-current": item.path === activePath ? "page" : null,
          onClick: (e) => {
            e.preventDefault();
            onNavigate(item.path);
            closeDrawer();
          },
        },
        [
          el("span", { text: item.key }),
          el("span", { class: "navitem__hint", text: item.hintKey }),
        ]
      );
      navList.appendChild(a);
    });
  }
  renderNav();

  const drawer = el("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Menu" }, [
    el("div", { class: "drawer__header" }, [drawerTitle, drawerClose]),
    navList,
  ]);
  const backdrop = el("div", { class: "drawer-backdrop", onClick: () => closeDrawer() });

  let drawerOpen = false;
  function openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    drawer.style.left = document.documentElement.dir === "rtl" ? "auto" : "0";
    drawer.style.right = document.documentElement.dir === "rtl" ? "0" : "auto";
    drawerClose.focus();
  }
  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    backdrop.remove();
    drawer.remove();
    menuBtn.focus();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Root
  const root = el("div", { class: "app" }, [topbar, main]);

  function setActivePath(path) {
    activePath = path || "/";
    renderNav();
  }

  function setBrand({ title, tagline }) {
    brandTitle.textContent = title || "Comprehensive Cancer Center";
    brandTagline.textContent = tagline || "";
  }

  function setView(node) {
    clear(viewHost);
    viewHost.appendChild(node);
    // Move focus to content for screen readers and keyboard users.
    main.focus();
  }

  function setMainBusy(isBusy) {
    main.setAttribute("aria-busy", isBusy ? "true" : "false");
  }

  // Update language label on button
  window.addEventListener("app:lang-changed", () => {
    langBtn.querySelector("span:last-child").textContent = getLang() === "ar" ? "AR" : "EN";
  });

  // Allow views to use localized labels without pulling a separate dictionary now.
  // Keeps the refactor structural/perf-focused (no redesign / no heavy i18n framework).
  primaryCta.querySelector("span").textContent = getLang() === "ar" ? "احجز" : "Book";
  window.addEventListener("app:lang-changed", () => {
    primaryCta.querySelector("span").textContent = getLang() === "ar" ? "احجز" : "Book";
  });

  return {
    el: root,
    setActivePath,
    setBrand,
    setView,
    setMainBusy,
    openDrawer,
    closeDrawer,
  };
}

