import { el, clear } from "../dom.js";
import { getLang, i18n } from "../i18n.js";

async function postJson(url, body, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

export function renderContact({ content }) {
  const heading = i18n(content?.contactSection?.heading, getLang() === "ar" ? "تواصل معنا" : "Contact");
  const sub = i18n(
    content?.contactSection?.subheading,
    getLang() === "ar"
      ? "اكتب بيانات بسيطة وسنتواصل معك."
      : "Share a few details and our team will call you back."
  );

  const phone = i18n(content?.contact?.phone, "");
  const email = i18n(content?.contact?.email, "");
  const addr = i18n(content?.contact?.address, "");

  const status = el("div");

  const firstName = el("input", { class: "input", autocomplete: "given-name", required: "true" });
  const lastName = el("input", { class: "input", autocomplete: "family-name", required: "true" });
  const emailEl = el("input", { class: "input", type: "email", autocomplete: "email", required: "true" });
  const phoneEl = el("input", { class: "input", inputmode: "tel", autocomplete: "tel", required: "true" });
  const concern = el(
    "select",
    { class: "select" },
    [
      el("option", { value: "" , text: getLang() === "ar" ? "اختر" : "Select" }),
      el("option", { value: "diagnosis", text: getLang() === "ar" ? "تشخيص" : "Diagnosis" }),
      el("option", { value: "treatment", text: getLang() === "ar" ? "علاج" : "Treatment" }),
      el("option", { value: "genetic", text: getLang() === "ar" ? "استشارة جينية" : "Genetic counseling" }),
      el("option", { value: "support", text: getLang() === "ar" ? "دعم" : "Support" }),
    ]
  );
  const msg = el("textarea", { class: "textarea" });

  const submit = el("button", { class: "btn btn--primary", type: "button", text: getLang() === "ar" ? "إرسال" : "Submit" });

  const setStatus = (kind, text) => {
    clear(status);
    status.appendChild(el("div", { class: `alert ${kind === "error" ? "alert--error" : "alert--ok"}`, text }));
  };

  submit.addEventListener("click", async () => {
    submit.disabled = true;
    clear(status);
    try {
      const payload = {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        email: emailEl.value.trim(),
        phone: phoneEl.value.trim(),
        concern: concern.value,
        message: msg.value.trim(),
      };
      if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || !payload.concern) {
        throw new Error(getLang() === "ar" ? "برجاء ملء الحقول المطلوبة." : "Please fill the required fields.");
      }
      await postJson("/api/contacts", payload, { timeoutMs: 15000 });
      setStatus("ok", getLang() === "ar" ? "تم الإرسال. سنتواصل خلال 24 ساعة." : "Submitted. We will contact you within 24 hours.");
      firstName.value = "";
      lastName.value = "";
      emailEl.value = "";
      phoneEl.value = "";
      concern.value = "";
      msg.value = "";
    } catch (e) {
      setStatus("error", e?.message || (getLang() === "ar" ? "خطأ في الإرسال" : "Submission failed"));
    } finally {
      submit.disabled = false;
    }
  });

  return el("section", { class: "section" }, [
    el("div", { class: "panel view" }, [el("h1", { class: "view__title", text: heading }), el("p", { class: "view__subtitle", text: sub })]),
    el("div", { class: "grid grid--2" }, [
      el("div", { class: "panel view" }, [
        el("h2", { class: "view__title", text: getLang() === "ar" ? "معلومات التواصل" : "Contact details" }),
        phone ? el("p", { class: "view__subtitle", text: `${getLang() === "ar" ? "هاتف" : "Phone"}: ${phone}` }) : null,
        email ? el("p", { class: "view__subtitle", text: `${getLang() === "ar" ? "بريد" : "Email"}: ${email}` }) : null,
        addr ? el("p", { class: "view__subtitle", text: `${getLang() === "ar" ? "عنوان" : "Address"}: ${addr}` }) : null,
      ]),
      el("div", { class: "panel view" }, [
        el("h2", { class: "view__title", text: getLang() === "ar" ? "نموذج" : "Form" }),
        el("div", { class: "grid" }, [
          el("div", { class: "grid grid--2" }, [
            el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "الاسم" : "First name" }), firstName]),
            el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "اللقب" : "Last name" }), lastName]),
          ]),
          el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "البريد الإلكتروني" : "Email" }), emailEl]),
          el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "الهاتف" : "Phone" }), phoneEl]),
          el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "سبب التواصل" : "Primary concern" }), concern]),
          el("div", { class: "field" }, [el("label", { text: getLang() === "ar" ? "رسالة" : "Message" }), msg]),
          el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center" }, [submit]),
          status,
        ]),
      ]),
    ]),
  ]);
}
