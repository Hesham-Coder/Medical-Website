import { createShell } from "./shell.js";
import { createRouter } from "./router.js";
import { getContent, getPostsPage, getPostBySlug } from "./data.js";
import { i18n, setLang, getLang } from "./i18n.js";

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("Missing #app root");

const shell = createShell({
  onNavigate: (path) => router.go(path),
  onToggleLang: () => setLang(getLang() === "ar" ? "en" : "ar"),
});
appRoot.innerHTML = "";
appRoot.appendChild(shell.el);

const router = createRouter({
  onRoute: async (route) => {
    shell.setActivePath(route.path);
    shell.setMainBusy(true);

    try {
      // Load site content once (used across views).
      const content = await getContent();
      shell.setBrand({
        title: i18n(content?.siteInfo?.title, "Comprehensive Cancer Center"),
        tagline: i18n(content?.siteInfo?.tagline, ""),
      });

      let view;
      if (route.name === "home") {
        const mod = await import("./views/home.js");
        view = mod.renderHome({ content });
      } else if (route.name === "services") {
        const mod = await import("./views/services.js");
        view = mod.renderServices({ content });
      } else if (route.name === "team") {
        const mod = await import("./views/team.js");
        view = mod.renderTeam({ content });
      } else if (route.name === "stories") {
        const mod = await import("./views/stories.js");
        view = mod.renderStories({ content });
      } else if (route.name === "news") {
        const mod = await import("./views/posts.js");
        const page = Number(route.query.page || 1);
        const data = await getPostsPage({ type: "news", page, limit: 6, search: route.query.q || "" });
        view = mod.renderPostsIndex({ content, type: "news", data, query: route.query });
      } else if (route.name === "updates") {
        const mod = await import("./views/posts.js");
        const page = Number(route.query.page || 1);
        const data = await getPostsPage({ type: "update", page, limit: 6, search: route.query.q || "" });
        view = mod.renderPostsIndex({ content, type: "update", data, query: route.query });
      } else if (route.name === "articles") {
        const mod = await import("./views/posts.js");
        const page = Number(route.query.page || 1);
        const data = await getPostsPage({ type: "article", page, limit: 6, search: route.query.q || "" });
        view = mod.renderPostsIndex({ content, type: "article", data, query: route.query });
      } else if (route.name === "post") {
        const mod = await import("./views/post.js");
        const post = await getPostBySlug(route.params.slug);
        view = mod.renderPost({ content, post });
      } else if (route.name === "about") {
        const mod = await import("./views/about.js");
        view = mod.renderAbout({ content });
      } else if (route.name === "contact") {
        const mod = await import("./views/contact.js");
        view = mod.renderContact({ content });
      } else {
        const mod = await import("./views/notfound.js");
        view = mod.renderNotFound();
      }

      shell.setView(view);
      shell.setMainBusy(false);
    } catch (err) {
      shell.setMainBusy(false);
      const mod = await import("./views/error.js");
      shell.setView(mod.renderError({ err }));
    }
  },
});

// Initial route
router.start();

// Keep UI in sync when language changes.
window.addEventListener("app:lang-changed", () => {
  router.refresh();
});

