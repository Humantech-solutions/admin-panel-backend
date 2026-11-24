/**
 * Sahaj CRM Universal Zero-Code Form Interceptor & Lead Sync Engine
 * -----------------------------------------------------------------
 * Automatically scans and connects ALL existing forms on the website
 * (Contact, Careers/Job Applications, Newsletter Subscriptions, Sales/Quotes)
 * directly to the SahajCRM API without creating any new forms or floating buttons.
 *
 * Usage:
 * <script 
 *   src="https://apis.admin.hutechsolutions.in/crm-embed.js" 
 *   data-website="your-website-slug" 
 *   async>
 * </script>
 */
(function (window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.__SAHAJ_CRM_INITIALIZED__) return;
  window.__SAHAJ_CRM_INITIALIZED__ = true;

  // Locate the current script tag and extract configuration
  const scriptTag = document.currentScript || 
    document.querySelector('script[src*="crm-embed.js"]') ||
    document.querySelector('script[data-website]') ||
    document.querySelector('script[data-crm-website]');

  const websiteSlug = scriptTag ? (
    scriptTag.getAttribute('data-website') ||
    scriptTag.getAttribute('data-crm-website') ||
    scriptTag.getAttribute('data-slug') ||
    ''
  ) : '';

  // Determine API base URL dynamically
  let apiUrl = scriptTag ? (scriptTag.getAttribute('data-api-url') || '') : '';
  if (!apiUrl && scriptTag && scriptTag.src) {
    try {
      const parsed = new URL(scriptTag.src);
      apiUrl = parsed.origin;
    } catch (e) {
      apiUrl = '';
    }
  }
  if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    apiUrl = 'https://apis.admin.hutechsolutions.in';
  }

  // Page context capture
  const getContext = () => ({
    pageUrl: window.location.href,
    pageTitle: document.title || 'Website',
    referrer: document.referrer || '',
    websiteSlug: websiteSlug
  });

  // Inject Subtle Toast Notification Styles
  function ensureToastStyles() {
    if (document.getElementById('sahaj-crm-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'sahaj-crm-toast-styles';
    style.textContent = `
      .sahaj-crm-toast {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 2147483647;
        padding: 14px 22px;
        background: #11253e;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(17, 37, 62, 0.25);
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      }
      .sahaj-crm-toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      .sahaj-crm-toast-success {
        border-left: 4px solid #10b981;
      }
      .sahaj-crm-toast-error {
        border-left: 4px solid #ef4444;
      }
      .sahaj-crm-toast-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // Show a clean, non-intrusive toast message
  function showToast(message, type = 'success') {
    ensureToastStyles();
    const existing = document.querySelector('.sahaj-crm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `sahaj-crm-toast sahaj-crm-toast-${type}`;
    const iconSvg = type === 'success' 
      ? '<svg class="sahaj-crm-toast-icon" viewBox="0 0 20 20" fill="#10b981"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'
      : '<svg class="sahaj-crm-toast-icon" viewBox="0 0 20 20" fill="#ef4444"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  // Detect form purpose intelligently
  function detectFormType(form) {
    // 1. Explicit developer override via data attribute
    const explicit = form.getAttribute('data-crm') || form.getAttribute('data-crm-type');
    if (explicit) {
      const lower = explicit.toLowerCase();
      if (lower.includes('career') || lower.includes('job') || lower.includes('apply')) return 'career';
      if (lower.includes('sub') || lower.includes('newsletter')) return 'subscription';
      if (lower.includes('sale') || lower.includes('quote') || lower.includes('brochure')) return 'sales';
      return 'contact';
    }

    // 2. Identify forms that should NEVER be intercepted (login, password reset, search)
    if (form.getAttribute('data-crm-ignore') !== null) return null;
    if (form.querySelector('input[type="password"]')) return null;
    if (form.getAttribute('role') === 'search') return null;

    const action = (form.getAttribute('action') || '').toLowerCase();
    const id = (form.id || '').toLowerCase();
    const className = (form.className || '').toLowerCase();
    const combinedMeta = `${action} ${id} ${className}`;

    if (combinedMeta.includes('search') || combinedMeta.includes('login') || combinedMeta.includes('auth')) {
      return null;
    }

    // 3. Career / Job Application detection
    const hasFileInput = Boolean(form.querySelector('input[type="file"]'));
    const isCareerContext = combinedMeta.includes('career') || combinedMeta.includes('job') || combinedMeta.includes('apply') || combinedMeta.includes('resume') || combinedMeta.includes('vacancy');
    if (hasFileInput || isCareerContext) {
      return 'career';
    }

    // 4. Newsletter / Subscription detection
    const textInputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
    const isNewsletterContext = combinedMeta.includes('newsletter') || combinedMeta.includes('subscribe') || combinedMeta.includes('signup') || combinedMeta.includes('mailchimp');
    if (isNewsletterContext || (textInputs.length <= 2 && form.querySelector('input[type="email"]'))) {
      return 'subscription';
    }

    // 5. Sales / Quote / Brochure detection
    if (combinedMeta.includes('sale') || combinedMeta.includes('quote') || combinedMeta.includes('brochure') || combinedMeta.includes('demo') || combinedMeta.includes('pricing')) {
      return 'sales';
    }

    // 6. Default to Contact Inquiry if form contains email or name input
    if (form.querySelector('input[type="email"]') || form.querySelector('input[name*="name"]') || form.querySelector('textarea')) {
      return 'contact';
    }

    return null;
  }

  // Extract common field values from any form layout
  function extractFormFields(form) {
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        data[key] = value.trim();
      }
    });

    const getField = (patterns) => {
      for (const pattern of patterns) {
        for (const [k, v] of Object.entries(data)) {
          if (k.toLowerCase().includes(pattern) && v) return v;
        }
      }
      return '';
    };

    return {
      rawFormData: formData,
      rawObj: data,
      name: getField(['name', 'author']) || '',
      email: getField(['email', 'mail']) || '',
      phone: getField(['phone', 'mobile', 'tel', 'whatsapp']) || '',
      message: getField(['message', 'comment', 'msg', 'inquiry', 'body', 'note']) || '',
      subject: getField(['subject', 'topic', 'title']) || '',
      company: getField(['company', 'organization', 'org', 'business']) || '',
      position: getField(['position', 'role', 'job', 'designation']) || '',
      experience: getField(['experience', 'exp']) || ''
    };
  }

  // Handle interception for a single form
  function wireForm(form) {
    if (form.hasAttribute('data-crm-attached')) return;

    const formType = detectFormType(form);
    if (!formType) return; // Ignore non-CRM forms (search, login, etc.)

    form.setAttribute('data-crm-attached', formType);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = form.querySelector('[type="submit"]') || form.querySelector('button:not([type="button"])');
      const origBtnText = submitBtn ? submitBtn.innerHTML : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('data-orig-text', origBtnText);
        submitBtn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> Submitting...';
      }

      const extracted = extractFormFields(form);
      const context = getContext();

      try {
        let endpoint = `${apiUrl}/api/contact/submit`;
        let requestOptions = {};

        if (formType === 'career') {
          endpoint = `${apiUrl}/api/career/apply`;
          // Career application uses multipart FormData to upload resume
          const payload = new FormData();
          payload.append('name', extracted.name || 'Applicant');
          payload.append('email', extracted.email);
          payload.append('phone', extracted.phone);
          payload.append('position', extracted.position || 'General Application');
          payload.append('experience', extracted.experience || 'Not Specified');
          payload.append('websiteSlug', context.websiteSlug);
          payload.append('pageUrl', context.pageUrl);
          payload.append('pageTitle', context.pageTitle);

          // Find file input
          const fileInput = form.querySelector('input[type="file"]');
          if (fileInput && fileInput.files && fileInput.files[0]) {
            payload.append('resume', fileInput.files[0]);
          }

          requestOptions = {
            method: 'POST',
            body: payload
          };
        } else if (formType === 'subscription') {
          endpoint = `${apiUrl}/api/subscriptions/subscribe`;
          requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: extracted.email,
              ...context
            })
          };
        } else if (formType === 'sales') {
          endpoint = `${apiUrl}/api/sales/brochure`;
          requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: extracted.name,
              email: extracted.email,
              phone: extracted.phone,
              companyName: extracted.company,
              ...context
            })
          };
        } else {
          // Contact Inquiry (Default)
          endpoint = `${apiUrl}/api/contact/submit`;
          requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: extracted.name,
              email: extracted.email,
              phone: extracted.phone,
              subject: extracted.subject,
              message: extracted.message,
              ...context
            })
          };
        }

        const res = await fetch(endpoint, requestOptions);
        const data = await res.json();

        if (data.success) {
          const successMsg = formType === 'career' 
            ? 'Application submitted successfully!' 
            : formType === 'subscription' 
              ? 'Thank you for subscribing!' 
              : 'Thank you! Your inquiry has been submitted.';

          showToast(successMsg, 'success');
          form.reset();

          // Dispatch DOM event for custom client-side analytics / Google Tag Manager
          window.dispatchEvent(new CustomEvent('sahajcrm:success', {
            detail: { form, formType, data }
          }));
        } else {
          showToast(data.message || 'Submission failed. Please check your fields.', 'error');
        }
      } catch (err) {
        console.error('[SahajCRM] Submission error:', err);
        showToast('Unable to connect. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.getAttribute('data-orig-text') || origBtnText;
        }
      }
    });
  }

  // Scan all forms in the document
  function scanAndWireForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(wireForm);
  }

  // Set up MutationObserver to detect dynamically added forms (e.g. Next.js, React modals, SPAs)
  function initDynamicObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          scanAndWireForms();
          break;
        }
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Initialize immediately on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndWireForms();
      initDynamicObserver();
    });
  } else {
    scanAndWireForms();
    initDynamicObserver();
  }

  // Public JavaScript API exposed to host application
  window.SahajCRM = {
    version: '2.0.0',
    websiteSlug: websiteSlug,
    apiUrl: apiUrl,
    scan: scanAndWireForms,
    submitContact: async function (data) {
      const res = await fetch(`${apiUrl}/api/contact/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...getContext() })
      });
      return res.json();
    },
    submitCareer: async function (formData) {
      const context = getContext();
      if (formData instanceof FormData) {
        formData.append('websiteSlug', context.websiteSlug);
        formData.append('pageUrl', context.pageUrl);
        formData.append('pageTitle', context.pageTitle);
      }
      const res = await fetch(`${apiUrl}/api/career/apply`, {
        method: 'POST',
        body: formData
      });
      return res.json();
    },
    submitSubscription: async function (email) {
      const res = await fetch(`${apiUrl}/api/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...getContext() })
      });
      return res.json();
    }
  };

})(window, document);
