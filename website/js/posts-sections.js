(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function isDirectVideoUrl(url) {
    return /(\.mp4|\.webm|\.ogv|\.ogg|\.mov|\.m4v)(\?|#|$)/i.test(url || '') || /^\/uploads\/vid-/i.test(url || '');
  }

  function toEmbedUrl(url) {
    var rawUrl = String(url || '').trim();
    if (!rawUrl) return '';
    if (/youtube\.com\/watch\?v=/i.test(rawUrl)) {
      var videoId = (rawUrl.split('v=')[1] || '').split('&')[0];
      return videoId ? 'https://www.youtube.com/embed/' + videoId : '';
    }
    if (/youtu\.be\//i.test(rawUrl)) {
      var shortId = rawUrl.split('youtu.be/')[1].split(/[?&]/)[0];
      return shortId ? 'https://www.youtube.com/embed/' + shortId : '';
    }
    if (/facebook\.com\/.*\/videos\//i.test(rawUrl) || /facebook\.com\/reel\//i.test(rawUrl)) {
      return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(rawUrl) + '&show_text=false';
    }
    if (/vimeo\.com\/\d+/i.test(rawUrl)) {
      var vmId = (rawUrl.match(/vimeo\.com\/(\d+)/i) || [])[1];
      return vmId ? 'https://player.vimeo.com/video/' + vmId : '';
    }
    if (/youtube\.com\/embed\//i.test(rawUrl) || /youtube-nocookie\.com\/embed\//i.test(rawUrl) || /player\.vimeo\.com\/video\//i.test(rawUrl) || /facebook\.com\/plugins\/video\.php/i.test(rawUrl)) {
      return rawUrl;
    }
    return '';
  }

  function renderCard(post) {
    var media = post.videoUrl
      ? (isDirectVideoUrl(post.videoUrl)
        ? '<video src="' + escapeHtml(post.videoUrl) + '" class="w-full h-48 object-cover bg-black" muted playsinline loop preload="metadata"></video>'
        : (toEmbedUrl(post.videoUrl)
          ? '<iframe src="' + escapeHtml(toEmbedUrl(post.videoUrl)) + '" class="w-full h-48 border-0 bg-black" loading="lazy" allowfullscreen></iframe>'
          : '<div class="w-full h-48 bg-slate-200"></div>'))
      : post.featuredImage
        ? '<img src="' + escapeHtml(post.featuredImage) + '" alt="' + escapeHtml(post.title) + '" class="w-full h-48 object-cover">'
        : '<div class="w-full h-48 bg-slate-200"></div>';
    var date = formatDate(post.createdAt);
    return '<article class="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300">' +
      media +
      '<div class="p-5">' +
      '<p class="text-xs text-slate-500 mb-2">' + escapeHtml(date) + (post.author ? ' • ' + escapeHtml(post.author) : '') + '</p>' +
      '<h3 class="text-xl font-bold text-slate-900 mb-2 leading-tight">' + escapeHtml(post.title) + '</h3>' +
      '<p class="text-sm text-slate-600 mb-4">' + escapeHtml(post.excerpt || '') + '</p>' +
      '<a href="/posts/' + encodeURIComponent(post.slug) + '" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue-dark">Read more<span class="material-symbols-outlined text-base">arrow_forward</span></a>' +
      '</div></article>';
  }

  function renderFeatured(post) {
    if (!post) return '';
    var media = post.videoUrl
      ? (isDirectVideoUrl(post.videoUrl)
        ? '<video src="' + escapeHtml(post.videoUrl) + '" class="absolute inset-0 w-full h-full object-cover bg-black" muted autoplay playsinline loop preload="metadata"></video>'
        : (toEmbedUrl(post.videoUrl)
          ? '<iframe src="' + escapeHtml(toEmbedUrl(post.videoUrl)) + '" class="absolute inset-0 w-full h-full border-0 bg-black" loading="lazy" allowfullscreen></iframe>'
          : '<div class="absolute inset-0 bg-gradient-to-br from-brand-blue-light/45 to-brand-blue-dark/65"></div>'))
      : post.featuredImage
        ? '<img src="' + escapeHtml(post.featuredImage) + '" alt="' + escapeHtml(post.title) + '" class="absolute inset-0 w-full h-full object-cover">'
        : '<div class="absolute inset-0 bg-gradient-to-br from-brand-blue-light/45 to-brand-blue-dark/65"></div>';
    return '<article class="relative overflow-hidden rounded-3xl bg-brand-blue-dark text-white min-h-[260px]">' +
      media +
      '<div class="absolute inset-0 bg-gradient-to-r from-slate-950/70 to-slate-900/30"></div>' +
      '<div class="relative z-10 p-7 sm:p-10 max-w-2xl">' +
      '<p class="text-xs uppercase tracking-[0.18em] font-bold text-blue-100 mb-3">Featured</p>' +
      '<h3 class="text-2xl sm:text-3xl lg:text-4xl font-black mb-3 leading-tight">' + escapeHtml(post.title) + '</h3>' +
      '<p class="text-sm sm:text-base text-blue-100 mb-5">' + escapeHtml(post.excerpt || '') + '</p>' +
      '<a href="/posts/' + encodeURIComponent(post.slug) + '" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-brand-blue-dark font-semibold">Read featured<span class="material-symbols-outlined text-base">arrow_forward</span></a>' +
      '</div></article>';
  }

  function createSectionController(config) {
    var state = {
      page: 1,
      limit: 6,
      hasNext: false,
      loading: false,
      items: [],
      featuredSlug: ''
    };

    var grid = document.getElementById(config.gridId);
    var status = document.getElementById(config.stateId);
    var featured = document.getElementById(config.featuredId);
    var loadMore = document.getElementById(config.loadMoreId);
    if (!grid || !status || !featured || !loadMore) return null;

    function setState(text) {
      status.textContent = text;
    }

    function render() {
      if (!state.items.length) {
        grid.innerHTML = '';
        if (!state.loading) setState('No items yet.');
      } else {
        grid.innerHTML = state.items.map(renderCard).join('');
        setState('');
      }
      loadMore.classList.toggle('hidden', !state.hasNext);
    }

    function request(url) {
      return fetch(url).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Unable to load');
          return data;
        });
      });
    }

    function load(reset) {
      if (state.loading) return Promise.resolve();
      state.loading = true;
      if (reset) {
        state.page = 1;
        state.items = [];
        state.hasNext = false;
      }
      setState('Loading...');
      var listUrl = '/api/posts?type=' + encodeURIComponent(config.type) + '&page=' + state.page + '&limit=' + state.limit;
      var featuredUrl = '/api/posts?type=' + encodeURIComponent(config.type) + '&page=1&limit=24';
      return Promise.all([
        request(listUrl),
        request(featuredUrl)
      ]).then(function (results) {
        var listRes = results[0];
        var featuredRes = results[1];
        var featuredPost = (featuredRes.items || []).find(function (p) { return p.isFeatured; }) || featuredRes.items[0];
        featured.innerHTML = renderFeatured(featuredPost);
        state.featuredSlug = featuredPost ? featuredPost.slug : '';
        var nextItems = (listRes.items || []).filter(function (item) { return item.slug !== state.featuredSlug; });
        state.items = reset ? nextItems : state.items.concat(nextItems);
        state.hasNext = Boolean(listRes.pagination && listRes.pagination.hasNext);
        render();
      }).catch(function (err) {
        setState(err.message || 'Failed to load items.');
      }).finally(function () {
        state.loading = false;
      });
    }

    loadMore.addEventListener('click', function () {
      if (!state.hasNext) return;
      state.page += 1;
      load(false);
    });

    return {
      init: function () {
        return load(true);
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sections = [
      createSectionController({
        type: 'news',
        featuredId: 'newsFeatured',
        stateId: 'newsState',
        gridId: 'newsGrid',
        loadMoreId: 'newsLoadMore'
      }),
      createSectionController({
        type: 'update',
        featuredId: 'updatesFeatured',
        stateId: 'updatesState',
        gridId: 'updatesGrid',
        loadMoreId: 'updatesLoadMore'
      }),
      createSectionController({
        type: 'article',
        featuredId: 'articlesFeatured',
        stateId: 'articlesState',
        gridId: 'articlesGrid',
        loadMoreId: 'articlesLoadMore'
      })
    ].filter(Boolean);

    sections.forEach(function (section) { section.init(); });
  });
})();
