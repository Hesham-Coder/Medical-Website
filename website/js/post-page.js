(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setMetaTag(selector, value) {
    var node = document.querySelector(selector);
    if (node) node.setAttribute('content', value || '');
  }

  function formatDate(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getSlug() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
  }

  function labelType(type) {
    if (type === 'update') return "What's New";
    if (type === 'article') return 'Article';
    return 'News';
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

  function render(post) {
    var loading = document.getElementById('loadingState');
    var article = document.getElementById('postArticle');
    var meta = document.getElementById('postMeta');
    var title = document.getElementById('postTitle');
    var excerpt = document.getElementById('postExcerpt');
    var image = document.getElementById('postImage');
    var video = document.getElementById('postVideo');
    var videoEmbed = document.getElementById('postVideoEmbed');
    var content = document.getElementById('postContent');
    var tags = document.getElementById('postTags');
    var typeLink = document.getElementById('postTypeLink');

    loading.classList.add('hidden');
    article.classList.remove('hidden');

    var typeLabel = labelType(post.type);
    var dateLabel = formatDate(post.createdAt);
    meta.textContent = typeLabel + (dateLabel ? ' • ' + dateLabel : '') + (post.author ? ' • ' + post.author : '');
    title.textContent = post.title || '';
    excerpt.textContent = post.excerpt || '';
    content.innerHTML = post.content || '';

    if (post.videoUrl) {
      if (isDirectVideoUrl(post.videoUrl)) {
        video.src = post.videoUrl;
        video.classList.remove('hidden');
        videoEmbed.classList.add('hidden');
        videoEmbed.removeAttribute('src');
      } else {
        var embedUrl = toEmbedUrl(post.videoUrl);
        if (embedUrl) {
          videoEmbed.src = embedUrl;
          videoEmbed.classList.remove('hidden');
          video.classList.add('hidden');
          video.removeAttribute('src');
        }
      }
      image.classList.add('hidden');
    } else if (post.featuredImage) {
      image.src = post.featuredImage;
      image.alt = post.title || 'Post image';
      image.classList.remove('hidden');
      video.classList.add('hidden');
      video.removeAttribute('src');
      videoEmbed.classList.add('hidden');
      videoEmbed.removeAttribute('src');
    }

    tags.innerHTML = (post.tags || []).map(function (tag) {
      return '<span class="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">#' + escapeHtml(tag) + '</span>';
    }).join('');

    typeLink.textContent = typeLabel;
    typeLink.href = '/#' + (post.type === 'article' ? 'articles' : post.type === 'update' ? 'updates' : 'news');

    var metaTitle = post.seoTitle || post.title || 'Article';
    var metaDescription = post.seoDescription || post.excerpt || '';
    document.title = metaTitle;
    setMetaTag('meta[name="description"]', metaDescription);
    setMetaTag('meta[property="og:title"]', metaTitle);
    setMetaTag('meta[property="og:description"]', metaDescription);
    setMetaTag('meta[name="twitter:title"]', metaTitle);
    setMetaTag('meta[name="twitter:description"]', metaDescription);
    if (post.featuredImage) {
      setMetaTag('meta[property="og:image"]', post.featuredImage);
      setMetaTag('meta[name="twitter:image"]', post.featuredImage);
    }
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', window.location.origin + '/posts/' + encodeURIComponent(post.slug));
  }

  function showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    var box = document.getElementById('errorState');
    box.classList.remove('hidden');
    box.textContent = message || 'Failed to load this post.';
  }

  var slug = getSlug();
  if (!slug) {
    showError('Post slug is missing.');
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var isPreview = params.get('preview') === '1';
  var previewId = params.get('id') || '';
  var endpoint = isPreview && previewId
    ? '/api/admin/posts/id/' + encodeURIComponent(previewId)
    : '/api/posts/' + encodeURIComponent(slug);

  fetch(endpoint, { credentials: 'same-origin' })
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Post not found');
        return data;
      });
    })
    .then(render)
    .catch(function (err) {
      showError(err.message);
    });
})();
