function setResponseCacheHeaders(res, options = {}) {
  const {
    etag,
    lastModified,
    maxAgeSeconds = 60,
    staleWhileRevalidateSeconds = 300,
    isPrivate = false,
  } = options;

  const scope = isPrivate ? 'private' : 'public';
  const cacheControl = staleWhileRevalidateSeconds > 0
    ? `${scope}, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
    : `${scope}, max-age=${maxAgeSeconds}`;

  res.setHeader('Cache-Control', cacheControl);
  if (etag) {
    res.setHeader('ETag', etag);
  }
  if (lastModified) {
    res.setHeader('Last-Modified', lastModified);
  }
}

function requestIsFresh(req, metadata = {}) {
  const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
  if (ifNoneMatch && metadata.etag) {
    if (ifNoneMatch === metadata.etag || ifNoneMatch === '*') {
      return true;
    }
  }

  const ifModifiedSince = String(req.headers['if-modified-since'] || '').trim();
  if (ifModifiedSince && metadata.lastModified) {
    const sinceTime = Date.parse(ifModifiedSince);
    const modifiedTime = Date.parse(metadata.lastModified);
    if (!Number.isNaN(sinceTime) && !Number.isNaN(modifiedTime) && sinceTime >= modifiedTime) {
      return true;
    }
  }

  return false;
}

module.exports = {
  setResponseCacheHeaders,
  requestIsFresh,
};
