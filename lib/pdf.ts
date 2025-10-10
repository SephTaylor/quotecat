// lib/pdf.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Quote } from './quotes';

function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function quoteToHTML(q: Quote) {
  const created = new Date(q.createdAt).toLocaleDateString();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Quote - ${q.clientName}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 0; }
    .wrap { padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .brand { font-size: 20px; font-weight: 800; }
    .muted { color: #666; font-size: 12px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; background: #fff; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; }
    .label { color: #555; }
    .value { font-weight: 700; }
    .total { font-size: 18px; font-weight: 900; }
    hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
    .footer { margin-top: 18px; color: #777; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">QuoteCat</div>
      <div class="muted">Created ${created}</div>
    </div>

    <div class="card">
      <div class="row"><div class="label">Client</div><div class="value">${q.clientName}</div></div>
      <div class="row"><div class="label">Project</div><div class="value">${q.projectName}</div></div>
      <hr/>
      <div class="row"><div class="label">Labor</div><div class="value">${formatMoney(q.labor)}</div></div>
      <div class="row"><div class="label">Material</div><div class="value">${formatMoney(q.material)}</div></div>
      <hr/>
      <div class="row"><div class="label total">Total</div><div class="value total">${formatMoney(q.total)}</div></div>
    </div>

    <div class="footer">
      Generated with QuoteCat — thank you!
    </div>
  </div>
</body>
</html>`;
}

export async function createQuotePDF(quote: Quote) {
  const html = quoteToHTML(quote);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri; // local file path to the PDF
}

export async function shareQuotePDF(quote: Quote) {
  const uri = await createQuotePDF(quote);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Quote - ${quote.clientName}`,
      UTI: 'com.adobe.pdf',
    });
    return 'shared';
  }
  // If sharing isn't available (e.g., web), return path so you can show it
  return uri;
}
