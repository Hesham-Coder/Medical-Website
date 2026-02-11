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

module.exports = {
  validateContact,
};

