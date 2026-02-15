/**
 * Validation helpers for public inputs.
 * Keep logic conservative and NEVER trust client-side validation alone.
 */

/**
 * Validate and normalize a contact form submission.
 * Returns: { success: true, data } or { success: false, error }
 */
function validateContact(payload) {
  const data = payload || {};

  function cleanString(value, field, max) {
    if (value == null) return '';
    const v = String(value).trim();
    if (!v) return '';
    if (v.length > max) {
      throw new Error(`${field} is too long`);
    }
    return v;
  }

  try {
    const firstName = cleanString(data.firstName, 'First name', 80);
    const lastName = cleanString(data.lastName, 'Last name', 80);
    const email = cleanString(data.email, 'Email', 160);
    const phone = cleanString(data.phone, 'Phone', 40);
    const concern = cleanString(data.concern, 'Primary concern', 120);
    const message = data.message ? cleanString(data.message, 'Message', 4000) : '';

    if (!firstName || !lastName) {
      return { success: false, error: 'Please provide your first and last name.' };
    }

    if (!email) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    // Simple, conservative email check (server-side; client may be stricter)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(email)) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    if (!phone) {
      return { success: false, error: 'Please provide a contact phone number.' };
    }

    const allowedConcerns = ['diagnosis', 'treatment', 'genetic', 'support'];
    if (!allowedConcerns.includes(concern)) {
      return { success: false, error: 'Please select a valid primary concern.' };
    }

    return {
      success: true,
      data: {
        firstName,
        lastName,
        email,
        phone,
        concern,
        message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: 'Please review the form fields and try again.',
    };
  }
}

function sanitizeText(value, max) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > max) {
    throw new Error('Value too long');
  }
  return text;
}

function sanitizeCredentialText(value, max) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  if (text.length > max) throw new Error('Value too long');
  return text;
}

function sanitizeRichText(value, max) {
  let html = String(value == null ? '' : value);
  if (html.length > max) {
    throw new Error('Content is too long');
  }
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"');
  return html.trim();
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => sanitizeText(item, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => sanitizeText(item, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}

function validatePostsQuery(query) {
  const type = query.type ? String(query.type).toLowerCase().trim() : '';
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 6, 1), 24);
  const search = query.search ? String(query.search).trim().slice(0, 80) : '';
  return {
    type,
    page,
    limit,
    search,
  };
}

function validatePostPayload(payload, existingPost) {
  try {
    const body = payload || {};
    const title = sanitizeText(body.title, 180);
    if (!title) return { success: false, error: 'Title is required.' };
    const type = sanitizeText(body.type || 'news', 20).toLowerCase();
    if (!['news', 'update', 'article'].includes(type)) {
      return { success: false, error: 'Invalid post type.' };
    }

    const slugSource = sanitizeText(body.slug || '', 180) || title;
    const slug = slugify(slugSource);
    if (!slug) return { success: false, error: 'Unable to generate slug.' };

    const next = {
      id: existingPost ? existingPost.id : null,
      title,
      slug,
      type,
      excerpt: sanitizeText(body.excerpt, 500),
      content: sanitizeRichText(body.content, 50000),
      featuredImage: sanitizeText(body.featuredImage, 1000),
      videoUrl: sanitizeText(body.videoUrl, 1000),
      author: sanitizeText(body.author, 120),
      tags: normalizeTags(body.tags),
      isPublished: Boolean(body.isPublished),
      isFeatured: Boolean(body.isFeatured),
      seoTitle: sanitizeText(body.seoTitle, 180),
      seoDescription: sanitizeText(body.seoDescription, 300),
    };

    if (!next.excerpt) {
      next.excerpt = next.content.replace(/<[^>]*>/g, '').slice(0, 220);
    }
    if (!next.seoTitle) next.seoTitle = next.title;
    if (!next.seoDescription) next.seoDescription = next.excerpt;

    return { success: true, data: next };
  } catch (err) {
    return { success: false, error: 'Invalid post payload.' };
  }
}

function validateCredentialUpdatePayload(payload) {
  try {
    const body = payload || {};
    const currentPassword = String(body.currentPassword || '');
    const newUsername = sanitizeCredentialText(body.newUsername || '', 64);
    const newPassword = String(body.newPassword || '');
    const confirmNewPassword = String(body.confirmNewPassword || '');

    if (!currentPassword) {
      return { success: false, status: 400, error: 'Current password is required.' };
    }

    if (!newUsername && !newPassword) {
      return { success: false, status: 400, error: 'Provide a new username or new password.' };
    }

    if (newUsername && !/^[A-Za-z0-9._-]{3,64}$/.test(newUsername)) {
      return { success: false, status: 400, error: 'Username must be 3-64 characters and only include letters, numbers, dot, underscore, or hyphen.' };
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return { success: false, status: 400, error: 'New password must be at least 8 characters.' };
      }
      if (newPassword !== confirmNewPassword) {
        return { success: false, status: 400, error: 'New password and confirmation do not match.' };
      }
    }

    return {
      success: true,
      data: {
        currentPassword,
        newUsername: newUsername || null,
        newPassword: newPassword || null,
      },
    };
  } catch (err) {
    return { success: false, status: 400, error: 'Invalid credentials payload.' };
  }
}

module.exports = {
  validateContact,
  validatePostsQuery,
  validatePostPayload,
  validateCredentialUpdatePayload,
  sanitizeCredentialText,
  slugify,
};
