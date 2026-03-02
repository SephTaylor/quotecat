#!/usr/bin/env node
/**
 * Send email notification after X-Byte sync
 * Uses Resend API
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

const status = process.argv[2]; // 'success' or 'failure'

async function main() {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
    console.error('Missing RESEND_API_KEY or NOTIFY_EMAIL');
    process.exit(1);
  }

  let subject, html;

  if (status === 'success') {
    // Try to read stats from sync script
    let stats = null;
    try {
      const fs = await import('fs');
      const data = fs.readFileSync('/tmp/sync-stats.json', 'utf8');
      stats = JSON.parse(data);
    } catch (e) {
      console.log('Could not read sync stats:', e.message);
    }

    subject = '✅ QuoteCat X-Byte Sync Completed';

    if (stats) {
      html = `
        <h2>X-Byte Price Sync Completed Successfully</h2>
        <p><strong>Date:</strong> ${stats.date}</p>
        <p><strong>Week of:</strong> ${stats.weekOf}</p>
        <p><strong>Products upserted:</strong> ${stats.stats.productsUpserted.toLocaleString()}</p>
        <p><strong>Prices inserted:</strong> ${stats.stats.pricesInserted.toLocaleString()}</p>
        <h3>By Supplier:</h3>
        <ul>
          ${Object.entries(stats.stats.bySupplier).map(([supplier, count]) =>
            `<li>${supplier}: ${count.toLocaleString()}</li>`
          ).join('')}
        </ul>
        ${stats.stats.errors.length > 0 ? `
          <h3>Warnings:</h3>
          <ul>
            ${stats.stats.errors.map(err => `<li>${err}</li>`).join('')}
          </ul>
        ` : ''}
        <p style="color: #666; font-size: 12px;">Timestamp: ${stats.timestamp}</p>
      `;
    } else {
      html = `
        <h2>X-Byte Price Sync Completed Successfully</h2>
        <p>The sync completed but detailed stats were not available.</p>
      `;
    }
  } else {
    subject = '❌ QuoteCat X-Byte Sync FAILED';
    html = `
      <h2>X-Byte Price Sync Failed</h2>
      <p>The weekly price sync from X-Byte encountered an error.</p>
      <p>Please check the <a href="https://github.com/sephtaylor/quotecat/actions">GitHub Actions logs</a> for details.</p>
    `;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'QuoteCat <notifications@quotecat.ai>',
      to: NOTIFY_EMAIL,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Failed to send email:', response.status, text);
    process.exit(1);
  }

  console.log(`Notification email sent to ${NOTIFY_EMAIL}`);
}

main().catch(err => {
  console.error('Error sending notification:', err);
  process.exit(1);
});
