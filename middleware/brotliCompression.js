const zlib = require('zlib');

const MIN_BROTLI_BYTES = 860;

function acceptsBrotli(req) {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  return /(^|,|\s)br(\s|,|$)/i.test(acceptEncoding);
}

function brotliApiCompression() {
  return (req, res, next) => {
    if (!req.path.startsWith('/api/') || !acceptsBrotli(req)) {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = function jsonWithBrotli(payload) {
      if (res.headersSent || res.getHeader('Content-Encoding')) {
        return originalJson(payload);
      }

      try {
        const body = Buffer.from(JSON.stringify(payload));

        if (body.length < MIN_BROTLI_BYTES) {
          return originalJson(payload);
        }

        const compressed = zlib.brotliCompressSync(body, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: process.env.NODE_ENV === 'production' ? 9 : 5,
          },
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Content-Length', compressed.length);
        res.setHeader('Vary', 'Accept-Encoding');
        return res.send(compressed);
      } catch (error) {
        return originalJson(payload);
      }
    };

    return next();
  };
}

module.exports = {
  brotliApiCompression,
};
