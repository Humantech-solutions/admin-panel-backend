/**
 * Utility to generate standardized embed script snippets and installation instructions
 */
function generateEmbedDetails(websiteSlug, req) {
  let backendUrl = process.env.BACKEND_URL;
  if (!backendUrl || backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    backendUrl = 'https://apis.admin.hutechsolutions.in';
  }

  const scriptUrl = `${backendUrl}/crm-embed.js`;
  const embedCode = `<script src="${scriptUrl}" data-website="${websiteSlug}" async></script>`;

  let frontendUrl = process.env.ADMIN_URL;
  if (!frontendUrl || frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
    frontendUrl = 'https://admin.hutechsolutions.in';
  }

  return {
    websiteSlug,
    backendUrl,
    scriptUrl,
    embedCode,
    installationInstructions: {
      quickSnippet: embedCode,
      htmlGuide: `Place this script tag immediately before the closing </body> tag:\n${embedCode}`,
      formCaptureTip: `All existing forms (Contact, Careers, Subscriptions, Quotes) are automatically scanned and connected. No HTML changes needed.`,
      documentationUrl: `${frontendUrl}/docs`
    }
  };
}

module.exports = { generateEmbedDetails };
