// lib/pdf.ts
// PDF generation utility using expo-print

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Quote, Invoice, ChangeOrder } from './types';
import type { CompanyDetails, PaymentMethods } from './preferences';
import { trackEvent, AnalyticsEvents } from './app-analytics';

export type PDFOptions = {
  includeBranding: boolean; // true for free tier, false for pro
  companyDetails?: CompanyDetails;
  logoBase64?: string; // Base64 encoded logo image
  paymentMethods?: PaymentMethods; // Payment options to display on invoices
};

/**
 * Generate HTML for the quote PDF
 */
function generateQuoteHTML(quote: Quote, options: PDFOptions): string {
  const { includeBranding, companyDetails, logoBase64 } = options;

  // Calculate totals
  const materialsFromItems = quote.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;

  const materialEstimate = quote.materialEstimate ?? 0;
  const labor = quote.labor ?? 0;
  const overhead = quote.overhead ?? 0;
  const taxPercent = quote.taxPercent ?? 0;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = subtotal + taxAmount;

  const dateString = new Date(quote.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate line items HTML
  const lineItemsHTML = quote.items && quote.items.length > 0
    ? quote.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.qty}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">$${(item.unitPrice * item.qty).toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #999;">No materials</td></tr>';

  // QuoteCat branding for free tier - at top
  const brandingHeader = includeBranding ? `
    <div style="margin-bottom: 20px; padding: 16px; border-bottom: 3px solid #333; text-align: center; background: #FFF9F0;">
      <div style="font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 800;">
        Powered by QuoteCat
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        Create professional quotes in seconds • https://www.quotecat.ai
      </div>
      <div style="font-size: 10px; color: #666;">
        Subscribe to personalize
      </div>
    </div>
  ` : '';

  const brandingFooter = '';

  // Company header with logo on left, details on right
  const companyHeader = `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 4px; display: flex; align-items: center; gap: 16px;">
      ${logoBase64 ? `
        <div style="flex-shrink: 0;">
          <img src="data:image/png;base64,${logoBase64}" style="max-width: 80px; max-height: 60px; object-fit: contain;" />
        </div>
      ` : ''}
      <div style="flex: 1;">
        ${companyDetails?.companyName ? `<div style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #000;">${companyDetails.companyName}</div>` : ''}
        ${companyDetails?.email ? `<div style="font-size: 12px; color: #666;">${companyDetails.email}</div>` : ''}
        ${companyDetails?.phone ? `<div style="font-size: 12px; color: #666;">${companyDetails.phone}</div>` : ''}
        ${companyDetails?.website ? `<div style="font-size: 12px; color: #666;">${companyDetails.website}</div>` : ''}
        ${companyDetails?.address ? `<div style="font-size: 12px; color: #666;">${companyDetails.address}</div>` : ''}
      </div>
    </div>
  `;

  // No separate logo HTML needed - it's now inline
  const logoHTML = '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          margin: 15mm 15mm 15mm 15mm;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 0;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .page-content {
          padding: 24px;
          position: relative;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 3px solid #333;
        }
        .project-name {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 8px;
          color: #000;
        }
        .client-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #333;
        }
        .date {
          font-size: 14px;
          color: #666;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 16px;
          color: #000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        th {
          background: #f9f9f9;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #e5e5e5;
          font-size: 14px;
        }

        tr {
          page-break-inside: avoid;
        }

        .section {
          page-break-inside: avoid;
        }
        .totals-table {
          margin-left: auto;
          width: 400px;
          border: none;
        }
        .totals-table td {
          padding: 8px 12px;
          border: none;
          border-bottom: 1px solid #f0f0f0;
        }
        .totals-table .label {
          color: #666;
          font-size: 14px;
        }
        .totals-table .value {
          text-align: right;
          font-weight: 600;
          font-size: 14px;
        }
        .totals-table .subtotal-row td {
          padding-top: 12px;
          border-top: 2px solid #e5e5e5;
          font-weight: 700;
          font-size: 15px;
        }
        .totals-table .total-row td {
          padding-top: 12px;
          border-top: 3px solid #333;
          font-weight: 800;
          font-size: 18px;
        }
        .totals-table .total-row .value {
          color: #333;
          font-size: 22px;
        }
      </style>
    </head>
    <body>
      <div class="page-content">
      ${logoHTML}

      ${brandingHeader}

      ${companyHeader}

      <div class="header">
        <div class="project-name">${quote.name || 'Untitled Quote'}</div>
        ${quote.clientName ? `<div class="client-name">For: ${quote.clientName}</div>` : ''}
        ${quote.clientEmail ? `<div class="date">Email: ${quote.clientEmail}</div>` : ''}
        ${quote.clientPhone ? `<div class="date">Phone: ${quote.clientPhone}</div>` : ''}
        ${quote.clientAddress ? `<div class="date">${quote.clientAddress.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="date">${dateString}</div>
      </div>

      <div class="section">
        <div class="section-title">Cost Summary</div>
        <table class="totals-table">
          <tbody>
            ${materialsFromItems > 0 ? `
              <tr>
                <td class="label">Materials</td>
                <td class="value">$${materialsFromItems.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${materialEstimate > 0 ? `
              <tr>
                <td class="label">Materials (Estimate)</td>
                <td class="value">$${materialEstimate.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${labor > 0 ? `
              <tr>
                <td class="label">Labor</td>
                <td class="value">$${labor.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${overhead > 0 ? `
              <tr>
                <td class="label">Overhead</td>
                <td class="value">$${overhead.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${taxPercent > 0 ? `
              <tr>
                <td class="label">Tax (${taxPercent}%)</td>
                <td class="value">$${taxAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="total-row">
              <td class="label">Total</td>
              <td class="value">$${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${quote.notes ? `
        <div class="section">
          <div class="section-title">Notes</div>
          <div style="padding: 16px; background: #f9f9f9; border-radius: 6px; color: #333; line-height: 1.6;">
            ${quote.notes.replace(/\n/g, '<br>')}
          </div>
        </div>
      ` : ''}

      ${quote.items && quote.items.length > 0 ? `
        <div class="section" style="page-break-before: auto;">
          <div class="section-title">Materials Detail</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center; width: 80px;">Qty</th>
                <th style="text-align: right; width: 120px;">Unit Price</th>
                <th style="text-align: right; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${brandingFooter}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate and share a PDF of the quote
 */
export async function generateAndSharePDF(
  quote: Quote,
  options: PDFOptions
): Promise<void> {
  try {
    // Generate HTML
    const html = generateQuoteHTML(quote, options);

    // Generate PDF (creates temp file with UUID name)
    const { uri } = await Print.printToFileAsync({ html });

    // Track PDF generation
    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      quoteId: quote.id,
      itemCount: quote.items?.length || 0,
      total: quote.total,
      includedBranding: options.includeBranding,
      hasCompanyDetails: !!options.companyDetails,
    });

    // Create descriptive filename: "ProjectName - ClientName - YYYY-MM-DD-HHMMSS.pdf"
    const sanitize = (str: string) => str.replace(/[^a-z0-9_\-\s]/gi, '_');
    const projectPart = sanitize(quote.name || 'Quote');
    const clientPart = quote.clientName ? ` - ${sanitize(quote.clientName)}` : '';
    const now = new Date();
    const datePart = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    const fileName = `${projectPart}${clientPart} - ${datePart}-${timePart}.pdf`;

    // Rename file to descriptive name for sharing
    // On iOS, this sets the actual filename when shared
    // On Android, we'll copy to a persistent location
    const renamedPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: renamedPath,
    });

    // Android fix: Copy to document directory for email attachment support
    let shareUri = renamedPath;
    if (Platform.OS === 'android') {
      const persistentPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: renamedPath,
        to: persistentPath,
      });
      shareUri = persistentPath;
    }

    // Share PDF
    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: fileName,
          UTI: 'com.adobe.pdf',
        });

        // Track PDF sharing
        trackEvent(AnalyticsEvents.PDF_SHARED, {
          quoteId: quote.id,
        });
      } finally {
        // Clean up temporary files regardless of share success/cancel
        try {
          // Delete the original UUID file from printToFileAsync
          await FileSystem.deleteAsync(uri, { idempotent: true });

          // Delete the renamed file in cache
          await FileSystem.deleteAsync(renamedPath, { idempotent: true });

          // On Android, also delete the persistent copy in document directory
          if (Platform.OS === 'android') {
            await FileSystem.deleteAsync(shareUri, { idempotent: true });
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up PDF files:', cleanupError);
          // Don't throw - cleanup errors shouldn't affect user experience
        }
      }
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
      context: 'pdf_generation',
      error: String(error),
    });
    throw error;
  }
}

/**
 * Generate HTML for the invoice PDF
 */
function generateInvoiceHTML(invoice: Invoice, options: PDFOptions): string {
  const { includeBranding, companyDetails, logoBase64, paymentMethods } = options;

  // Calculate totals
  const materialsFromItems = invoice.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;

  const materialEstimate = invoice.materialEstimate ?? 0;
  const labor = invoice.labor ?? 0;
  const overhead = invoice.overhead ?? 0;
  const taxPercent = invoice.taxPercent ?? 0;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = subtotal + taxAmount;

  const invoiceDateString = new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const dueDateString = new Date(invoice.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Status badge color
  const statusColors: Record<string, string> = {
    unpaid: '#FF9500',
    partial: '#5856D6',
    paid: '#34C759',
    overdue: '#FF3B30',
  };
  const statusColor = statusColors[invoice.status] || '#8E8E93';

  // Generate line items HTML
  const lineItemsHTML = invoice.items && invoice.items.length > 0
    ? invoice.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.qty}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">$${(item.unitPrice * item.qty).toFixed(2)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #999;">No materials</td></tr>';

  // QuoteCat branding for free tier - at top
  const brandingHeader = includeBranding ? `
    <div style="margin-bottom: 20px; padding: 16px; border-bottom: 3px solid #333; text-align: center; background: #FFF9F0;">
      <div style="font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 800;">
        Powered by QuoteCat
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        Create professional quotes in seconds • https://www.quotecat.ai
      </div>
      <div style="font-size: 10px; color: #666;">
        Subscribe to personalize
      </div>
    </div>
  ` : '';

  const brandingFooter = '';

  // Company header with logo on left, details on right
  const companyHeader = `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 4px; display: flex; align-items: center; gap: 16px;">
      ${logoBase64 ? `
        <div style="flex-shrink: 0;">
          <img src="data:image/png;base64,${logoBase64}" style="max-width: 80px; max-height: 60px; object-fit: contain;" />
        </div>
      ` : ''}
      <div style="flex: 1;">
        ${companyDetails?.companyName ? `<div style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #000;">${companyDetails.companyName}</div>` : ''}
        ${companyDetails?.email ? `<div style="font-size: 12px; color: #666;">${companyDetails.email}</div>` : ''}
        ${companyDetails?.phone ? `<div style="font-size: 12px; color: #666;">${companyDetails.phone}</div>` : ''}
        ${companyDetails?.website ? `<div style="font-size: 12px; color: #666;">${companyDetails.website}</div>` : ''}
        ${companyDetails?.address ? `<div style="font-size: 12px; color: #666;">${companyDetails.address}</div>` : ''}
      </div>
    </div>
  `;

  // No separate logo HTML needed - it's now inline
  const logoHTML = '';

  // Partial invoice badge
  const partialBadge = invoice.isPartialInvoice ? `
    <div style="display: inline-block; background: #FFF3CD; color: #856404; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-left: 12px;">
      ${invoice.percentage}% Down Payment
    </div>
  ` : '';

  // Notes section
  const notesSection = invoice.notes ? `
    <div class="section">
      <div class="section-title">Notes</div>
      <div style="padding: 16px; background: #f9f9f9; border-radius: 6px; color: #333; line-height: 1.6;">
        ${invoice.notes.replace(/\n/g, '<br>')}
      </div>
    </div>
  ` : '';

  // Payment methods section - only for Premium users with configured methods
  const paymentMethodsLabels: Record<string, { label: string; icon: string }> = {
    zelle: { label: 'Zelle', icon: '💵' },
    venmo: { label: 'Venmo', icon: '📱' },
    cashApp: { label: 'Cash App', icon: '💲' },
    paypal: { label: 'PayPal', icon: '🅿️' },
    check: { label: 'Check', icon: '📝' },
    wire: { label: 'Wire/ACH', icon: '🏦' },
    other: { label: 'Other', icon: '📋' },
  };

  const enabledPaymentMethods = paymentMethods
    ? Object.entries(paymentMethods)
        .filter(([_, method]) => method.enabled && method.value)
        .map(([key, method]) => ({
          key,
          ...paymentMethodsLabels[key],
          value: method.value,
        }))
    : [];

  const paymentMethodsSection = enabledPaymentMethods.length > 0 ? `
    <div class="section" style="margin-top: 24px;">
      <div class="section-title" style="color: #22C55E;">Payment Options</div>
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px;">
        <div style="margin-bottom: 8px; font-size: 13px; color: #166534;">
          Please include invoice number <strong>${invoice.invoiceNumber}</strong> with your payment.
        </div>
        <div style="display: grid; gap: 12px;">
          ${enabledPaymentMethods.map(method => `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 18px;">${method.icon}</span>
              <div>
                <div style="font-weight: 600; color: #166534; font-size: 14px;">${method.label}</div>
                <div style="color: #333; font-size: 13px; white-space: pre-line;">${method.value}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        @page {
          margin: 15mm 15mm 15mm 15mm;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 0;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .page-content {
          padding: 24px;
          position: relative;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 3px solid #333;
        }
        .invoice-number {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 8px;
          color: #333;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .project-name {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
          color: #000;
        }
        .client-name {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #333;
        }
        .date-row {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e5e5;
        }
        .date-item {
          flex: 1;
        }
        .date-label {
          font-size: 12px;
          color: #999;
          margin-bottom: 4px;
        }
        .date-value {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 16px;
          color: #000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        th {
          background: #f9f9f9;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #e5e5e5;
          font-size: 14px;
        }

        tr {
          page-break-inside: avoid;
        }

        .section {
          page-break-inside: avoid;
        }
        .totals-table {
          margin-left: auto;
          width: 400px;
          border: none;
        }
        .totals-table td {
          padding: 8px 12px;
          border: none;
          border-bottom: 1px solid #f0f0f0;
        }
        .totals-table .label {
          color: #666;
          font-size: 14px;
        }
        .totals-table .value {
          text-align: right;
          font-weight: 600;
          font-size: 14px;
        }
        .totals-table .subtotal-row td {
          padding-top: 12px;
          border-top: 2px solid #e5e5e5;
          font-weight: 700;
          font-size: 15px;
        }
        .totals-table .total-row td {
          padding-top: 12px;
          border-top: 3px solid #333;
          font-weight: 800;
          font-size: 18px;
        }
        .totals-table .total-row .value {
          color: #333;
          font-size: 22px;
        }
      </style>
    </head>
    <body>
      <div class="page-content">
      ${logoHTML}

      ${brandingHeader}

      ${companyHeader}

      <div class="header">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div class="invoice-number">${invoice.invoiceNumber}</div>
          ${partialBadge}
        </div>
        <div class="status-badge" style="background: ${statusColor}20; color: ${statusColor};">
          ${invoice.status.toUpperCase()}
        </div>
        <div class="project-name">${invoice.name || 'Untitled Invoice'}</div>
        ${invoice.clientName ? `<div class="client-name">Bill To: ${invoice.clientName}</div>` : ''}
        ${invoice.clientEmail ? `<div style="font-size: 14px; color: #666; margin-bottom: 4px;">Email: ${invoice.clientEmail}</div>` : ''}
        ${invoice.clientPhone ? `<div style="font-size: 14px; color: #666; margin-bottom: 4px;">Phone: ${invoice.clientPhone}</div>` : ''}
        ${invoice.clientAddress ? `<div style="font-size: 14px; color: #666; margin-bottom: 8px;">${invoice.clientAddress.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="date-row">
          <div class="date-item">
            <div class="date-label">Invoice Date</div>
            <div class="date-value">${invoiceDateString}</div>
          </div>
          <div class="date-item" style="text-align: right;">
            <div class="date-label">Due Date</div>
            <div class="date-value">${dueDateString}</div>
          </div>
        </div>
      </div>

      ${invoice.items && invoice.items.length > 0 ? `
        <div class="section">
          <div class="section-title">Line Items</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center; width: 80px;">Qty</th>
                <th style="text-align: right; width: 120px;">Unit Price</th>
                <th style="text-align: right; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHTML}
            </tbody>
          </table>
        </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Amount Due</div>
        <table class="totals-table">
          <tbody>
            ${materialsFromItems > 0 ? `
              <tr>
                <td class="label">Materials</td>
                <td class="value">$${materialsFromItems.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${materialEstimate > 0 ? `
              <tr>
                <td class="label">Materials (Estimate)</td>
                <td class="value">$${materialEstimate.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${labor > 0 ? `
              <tr>
                <td class="label">Labor</td>
                <td class="value">$${labor.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${overhead > 0 ? `
              <tr>
                <td class="label">Overhead</td>
                <td class="value">$${overhead.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${taxPercent > 0 ? `
              <tr>
                <td class="label">Tax (${taxPercent}%)</td>
                <td class="value">$${taxAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="total-row">
              <td class="label">Total Amount Due</td>
              <td class="value">$${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${notesSection}

      ${paymentMethodsSection}

      ${brandingFooter}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate and share a PDF of the invoice
 */
export async function generateAndShareInvoicePDF(
  invoice: Invoice,
  options: PDFOptions
): Promise<void> {
  try {
    // Generate HTML
    const html = generateInvoiceHTML(invoice, options);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });

    // Track PDF generation
    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      invoiceId: invoice.id,
      itemCount: invoice.items?.length || 0,
      total: (invoice.items?.reduce((sum, item) => sum + item.unitPrice * item.qty, 0) ?? 0) + invoice.labor,
      includedBranding: options.includeBranding,
      hasCompanyDetails: !!options.companyDetails,
      isPartialInvoice: invoice.isPartialInvoice,
    });

    // Create descriptive filename: "INV-001 - ProjectName - ClientName - YYYY-MM-DD.pdf"
    const sanitize = (str: string) => str.replace(/[^a-z0-9_\-\s]/gi, '_');
    const invoiceNumberPart = sanitize(invoice.invoiceNumber);
    const projectPart = sanitize(invoice.name || 'Invoice');
    const clientPart = invoice.clientName ? ` - ${sanitize(invoice.clientName)}` : '';
    const datePart = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${invoiceNumberPart} - ${projectPart}${clientPart} - ${datePart}.pdf`;

    // Rename file to descriptive name for sharing
    const renamedPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: renamedPath,
    });

    // Android fix: Copy to document directory for email attachment support
    let shareUri = renamedPath;
    if (Platform.OS === 'android') {
      const persistentPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: renamedPath,
        to: persistentPath,
      });
      shareUri = persistentPath;
    }

    // Share PDF
    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: fileName,
          UTI: 'com.adobe.pdf',
        });

        // Track PDF sharing
        trackEvent(AnalyticsEvents.PDF_SHARED, {
          invoiceId: invoice.id,
        });
      } finally {
        // Clean up temporary files
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          await FileSystem.deleteAsync(renamedPath, { idempotent: true });
          if (Platform.OS === 'android') {
            await FileSystem.deleteAsync(shareUri, { idempotent: true });
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up PDF files:', cleanupError);
        }
      }
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
      context: 'invoice_pdf_generation',
      error: String(error),
    });
    throw error;
  }
}

/**
 * Generate HTML for a combined multi-tier quote PDF
 * Shows all linked quotes as options on separate pages
 */
function generateMultiTierQuoteHTML(quotes: Quote[], options: PDFOptions): string {
  const { includeBranding, companyDetails, logoBase64 } = options;

  // Sort by tier name (alphabetically) or creation date
  const sortedQuotes = [...quotes].sort((a, b) => {
    if (a.tier && b.tier) return a.tier.localeCompare(b.tier);
    if (a.tier) return -1;
    if (b.tier) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Use first quote for project/client info
  const primaryQuote = sortedQuotes[0];
  const dateString = new Date(primaryQuote.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate HTML for each quote option
  const optionPages = sortedQuotes.map((quote, index) => {
    const materialsFromItems = quote.items?.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    ) ?? 0;
    const materialEstimate = quote.materialEstimate ?? 0;
    const labor = quote.labor ?? 0;
    const overhead = quote.overhead ?? 0;
    const taxPercent = quote.taxPercent ?? 0;
    const subtotal = materialsFromItems + materialEstimate + labor + overhead;
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;

    const lineItemsHTML = quote.items && quote.items.length > 0
      ? quote.items.map(item => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.qty}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">$${(item.unitPrice * item.qty).toFixed(2)}</td>
          </tr>
        `).join('')
      : '';

    const tierLabel = quote.tier || `Option ${index + 1}`;

    return `
      <div class="option-page" style="${index > 0 ? 'page-break-before: always;' : ''}">
        <div class="option-header">
          <div class="option-tier-badge">${tierLabel}</div>
          <div class="option-total">$${grandTotal.toFixed(2)}</div>
        </div>

        ${quote.items && quote.items.length > 0 ? `
          <div class="section">
            <div class="section-title">Materials</div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center; width: 70px;">Qty</th>
                  <th style="text-align: right; width: 100px;">Unit</th>
                  <th style="text-align: right; width: 100px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHTML}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="section">
          <table class="totals-table">
            <tbody>
              ${materialsFromItems > 0 ? `
                <tr>
                  <td class="label">Materials</td>
                  <td class="value">$${materialsFromItems.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${materialEstimate > 0 ? `
                <tr>
                  <td class="label">Materials (Est.)</td>
                  <td class="value">$${materialEstimate.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${labor > 0 ? `
                <tr>
                  <td class="label">Labor</td>
                  <td class="value">$${labor.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${overhead > 0 ? `
                <tr>
                  <td class="label">Overhead</td>
                  <td class="value">$${overhead.toFixed(2)}</td>
                </tr>
              ` : ''}
              ${taxPercent > 0 ? `
                <tr>
                  <td class="label">Tax (${taxPercent}%)</td>
                  <td class="value">$${taxAmount.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td class="label">Total</td>
                <td class="value">$${grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${quote.notes ? `
          <div class="section">
            <div class="section-title">Notes</div>
            <div style="padding: 12px; background: #f9f9f9; border-radius: 6px; color: #333; font-size: 13px; line-height: 1.5;">
              ${quote.notes.replace(/\n/g, '<br>')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Generate comparison summary
  const comparisonRows = sortedQuotes.map(quote => {
    const materialsFromItems = quote.items?.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    ) ?? 0;
    const materialEstimate = quote.materialEstimate ?? 0;
    const labor = quote.labor ?? 0;
    const overhead = quote.overhead ?? 0;
    const taxPercent = quote.taxPercent ?? 0;
    const subtotal = materialsFromItems + materialEstimate + labor + overhead;
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">${quote.tier || 'Base'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${materialsFromItems.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">$${labor.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 700; color: #333;">$${grandTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // QuoteCat branding for free tier - at top
  const brandingHeader = includeBranding ? `
    <div style="margin-bottom: 20px; padding: 16px; border-bottom: 3px solid #333; text-align: center; background: #FFF9F0;">
      <div style="font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 800;">
        Powered by QuoteCat
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        Create professional quotes in seconds • https://www.quotecat.ai
      </div>
      <div style="font-size: 10px; color: #666;">
        Subscribe to personalize
      </div>
    </div>
  ` : '';

  const brandingFooter = '';

  // Company header with logo on left, details on right
  const companyHeader = `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 4px; display: flex; align-items: center; gap: 16px;">
      ${logoBase64 ? `
        <div style="flex-shrink: 0;">
          <img src="data:image/png;base64,${logoBase64}" style="max-width: 80px; max-height: 60px; object-fit: contain;" />
        </div>
      ` : ''}
      <div style="flex: 1;">
        ${companyDetails?.companyName ? `<div style="font-size: 18px; font-weight: 700; color: #000;">${companyDetails.companyName}</div>` : ''}
        ${companyDetails?.email ? `<div style="font-size: 12px; color: #666;">${companyDetails.email}</div>` : ''}
        ${companyDetails?.phone ? `<div style="font-size: 12px; color: #666;">${companyDetails.phone}</div>` : ''}
      </div>
    </div>
  `;

  // No separate logo HTML needed - it's now inline
  const logoHTML = '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 40mm 15mm 20mm 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 14px;
        }
        .page-content { padding: 20px; position: relative; }
        .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #333; }
        .project-name { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
        .client-name { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 4px; }
        .date { font-size: 13px; color: #666; }
        .options-count { font-size: 14px; color: #333; font-weight: 700; margin-top: 8px; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e5e5; border-radius: 6px; }
        th { background: #f9f9f9; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e5e5; font-size: 13px; }
        .totals-table { margin-left: auto; width: 320px; border: none; }
        .totals-table td { padding: 6px 10px; border: none; border-bottom: 1px solid #f0f0f0; }
        .totals-table .label { color: #666; font-size: 13px; }
        .totals-table .value { text-align: right; font-weight: 600; font-size: 13px; }
        .totals-table .total-row td { padding-top: 10px; border-top: 2px solid #333; font-weight: 800; }
        .totals-table .total-row .value { color: #333; font-size: 18px; }
        .option-page { margin-top: 24px; }
        .option-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #f9f9f9 0%, #fff 100%);
          border-radius: 8px;
          border: 2px solid #333;
        }
        .option-tier-badge {
          font-size: 20px;
          font-weight: 800;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .option-total {
          font-size: 28px;
          font-weight: 800;
          color: #000;
        }
        .comparison-section { margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="page-content">
        ${logoHTML}
        ${brandingHeader}
        ${companyHeader}

        <div class="header">
          <div class="project-name">${primaryQuote.name || 'Quote Options'}</div>
          ${primaryQuote.clientName ? `<div class="client-name">For: ${primaryQuote.clientName}</div>` : ''}
          ${primaryQuote.clientEmail ? `<div class="date">Email: ${primaryQuote.clientEmail}</div>` : ''}
          ${primaryQuote.clientPhone ? `<div class="date">Phone: ${primaryQuote.clientPhone}</div>` : ''}
          <div class="date">${dateString}</div>
          <div class="options-count">${sortedQuotes.length} Options Included</div>
        </div>

        <div class="comparison-section">
          <div class="section-title">Options Comparison</div>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th style="text-align: right;">Materials</th>
                <th style="text-align: right;">Labor</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${comparisonRows}
            </tbody>
          </table>
        </div>

        ${optionPages}

        ${brandingFooter}
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate and share a combined PDF for linked (multi-tier) quotes
 */
export async function generateAndShareMultiTierPDF(
  quotes: Quote[],
  options: PDFOptions
): Promise<void> {
  if (quotes.length === 0) {
    throw new Error('No quotes to export');
  }

  try {
    // Generate HTML
    const html = generateMultiTierQuoteHTML(quotes, options);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });

    // Track PDF generation
    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      quoteCount: quotes.length,
      type: 'multi_tier',
      includedBranding: options.includeBranding,
      hasCompanyDetails: !!options.companyDetails,
    });

    // Create descriptive filename
    const sanitize = (str: string) => str.replace(/[^a-z0-9_\-\s]/gi, '_');
    const primaryQuote = quotes[0];
    const projectPart = sanitize(primaryQuote.name || 'Quote');
    const clientPart = primaryQuote.clientName ? ` - ${sanitize(primaryQuote.clientName)}` : '';
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const fileName = `${projectPart}${clientPart} - Options - ${datePart}.pdf`;

    // Rename and share
    const renamedPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: renamedPath });

    let shareUri = renamedPath;
    if (Platform.OS === 'android') {
      const persistentPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: renamedPath, to: persistentPath });
      shareUri = persistentPath;
    }

    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: fileName,
          UTI: 'com.adobe.pdf',
        });

        trackEvent(AnalyticsEvents.PDF_SHARED, {
          type: 'multi_tier',
          quoteCount: quotes.length,
        });
      } finally {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          await FileSystem.deleteAsync(renamedPath, { idempotent: true });
          if (Platform.OS === 'android') {
            await FileSystem.deleteAsync(shareUri, { idempotent: true });
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up PDF files:', cleanupError);
        }
      }
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating multi-tier PDF:', error);
    trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
      context: 'multi_tier_pdf_generation',
      error: String(error),
    });
    throw error;
  }
}

/**
 * Generate HTML for a change order PDF
 */
function generateChangeOrderHTML(
  changeOrder: ChangeOrder,
  quote: Quote,
  options: PDFOptions
): string {
  const { includeBranding, companyDetails, logoBase64 } = options;

  const dateString = new Date(changeOrder.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatMoney = (amount: number) => {
    const prefix = amount > 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  };

  // Group items by type
  const addedItems = changeOrder.items.filter(i => i.qtyBefore === 0);
  const removedItems = changeOrder.items.filter(i => i.qtyAfter === 0);
  const modifiedItems = changeOrder.items.filter(i => i.qtyBefore > 0 && i.qtyAfter > 0);

  // Generate items HTML
  const generateItemsTable = (items: typeof changeOrder.items, label: string, color: string) => {
    if (items.length === 0) return '';
    return `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: ${color}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
          ${label}
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd;">Item</th>
              <th style="padding: 10px; text-align: center; font-weight: 600; border-bottom: 2px solid #ddd;">Qty Change</th>
              <th style="padding: 10px; text-align: right; font-weight: 600; border-bottom: 2px solid #ddd;">Unit Price</th>
              <th style="padding: 10px; text-align: right; font-weight: 600; border-bottom: 2px solid #ddd;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">
                  ${item.qtyBefore} → ${item.qtyAfter} ${item.unit}
                </td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${item.unitPrice.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee; font-weight: 600; color: ${item.lineDelta >= 0 ? '#22C55E' : '#EF4444'};">
                  ${formatMoney(item.lineDelta)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Company header
  const companyHeader = companyDetails ? `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 4px; display: flex; align-items: center; gap: 16px;">
      ${logoBase64 ? `
        <div style="flex-shrink: 0;">
          <img src="data:image/png;base64,${logoBase64}" style="max-width: 80px; max-height: 60px; object-fit: contain;" />
        </div>
      ` : ''}
      <div style="flex: 1;">
        ${companyDetails?.companyName ? `<div style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #000;">${companyDetails.companyName}</div>` : ''}
        ${companyDetails?.email ? `<div style="font-size: 12px; color: #666;">${companyDetails.email}</div>` : ''}
        ${companyDetails?.phone ? `<div style="font-size: 12px; color: #666;">${companyDetails.phone}</div>` : ''}
      </div>
    </div>
  ` : '';

  // Branding for free tier
  const brandingFooter = includeBranding ? `
    <div style="margin-top: 32px; padding: 16px; border-top: 3px solid #333; text-align: center; background: #FFF9F0;">
      <div style="font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 800;">
        Powered by QuoteCat
      </div>
      <div style="font-size: 12px; color: #666;">
        Create professional quotes in seconds • https://www.quotecat.ai
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 32px;
          color: #333;
          line-height: 1.5;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      ${companyHeader}

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <div>
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 800; color: #000;">
            Change Order #${changeOrder.number}
          </h1>
          <div style="font-size: 14px; color: #666; margin-bottom: 4px;">
            For: ${quote.name || 'Untitled Quote'}
          </div>
          ${quote.clientName ? `<div style="font-size: 14px; color: #666;">Client: ${quote.clientName}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; color: #666;">${dateString}</div>
          <div style="margin-top: 8px; padding: 6px 12px; background: ${changeOrder.status === 'approved' ? '#22C55E' : changeOrder.status === 'cancelled' ? '#EF4444' : '#F59E0B'}20; color: ${changeOrder.status === 'approved' ? '#22C55E' : changeOrder.status === 'cancelled' ? '#EF4444' : '#F59E0B'}; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 12px;">
            ${changeOrder.status}
          </div>
        </div>
      </div>

      ${changeOrder.note ? `
        <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 8px;">
          <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Reason for Change</div>
          <div style="font-size: 14px; color: #333;">${changeOrder.note}</div>
        </div>
      ` : ''}

      ${generateItemsTable(addedItems, 'Items Added', '#22C55E')}
      ${generateItemsTable(removedItems, 'Items Removed', '#EF4444')}
      ${generateItemsTable(modifiedItems, 'Items Modified', '#F59E0B')}

      ${changeOrder.laborDelta !== 0 ? `
        <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #333;">Labor Adjustment</div>
            <div style="font-size: 12px; color: #666;">$${changeOrder.laborBefore.toFixed(2)} → $${changeOrder.laborAfter.toFixed(2)}</div>
          </div>
          <div style="font-size: 18px; font-weight: 700; color: ${changeOrder.laborDelta >= 0 ? '#22C55E' : '#EF4444'};">
            ${formatMoney(changeOrder.laborDelta)}
          </div>
        </div>
      ` : ''}

      <!-- Summary -->
      <div style="background: #1a1a1a; color: white; padding: 24px; border-radius: 8px; margin-top: 32px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #999;">Original Quote Total</span>
          <span>$${changeOrder.quoteTotalBefore.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #333;">
          <span style="color: #999;">Change Amount</span>
          <span style="color: ${changeOrder.netChange >= 0 ? '#22C55E' : '#EF4444'}; font-weight: 600;">
            ${formatMoney(changeOrder.netChange)}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 18px; font-weight: 700;">New Quote Total</span>
          <span style="font-size: 24px; font-weight: 800; color: #333;">
            $${changeOrder.quoteTotalAfter.toFixed(2)}
          </span>
        </div>
      </div>

      <!-- Signature Lines -->
      <div style="margin-top: 48px; display: flex; gap: 32px;">
        <div style="flex: 1;">
          <div style="border-bottom: 1px solid #999; height: 40px;"></div>
          <div style="font-size: 12px; color: #666; margin-top: 8px;">Contractor Signature / Date</div>
        </div>
        <div style="flex: 1;">
          <div style="border-bottom: 1px solid #999; height: 40px;"></div>
          <div style="font-size: 12px; color: #666; margin-top: 8px;">Client Signature / Date</div>
        </div>
      </div>

      ${brandingFooter}
    </body>
    </html>
  `;
}

/**
 * Generate and share a change order PDF
 */
export async function generateAndShareChangeOrderPDF(
  changeOrder: ChangeOrder,
  quote: Quote,
  options: PDFOptions
): Promise<void> {
  try {
    // Generate HTML
    const html = generateChangeOrderHTML(changeOrder, quote, options);

    // Generate PDF
    const { uri } = await Print.printToFileAsync({ html });

    // Track generation
    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      type: 'change_order',
      coNumber: changeOrder.number,
      netChange: changeOrder.netChange,
      includedBranding: options.includeBranding,
    });

    // Create descriptive filename
    const sanitize = (str: string) => str.replace(/[^a-z0-9_\-\s]/gi, '_');
    const projectPart = sanitize(quote.name || 'Quote');
    const clientPart = quote.clientName ? ` - ${sanitize(quote.clientName)}` : '';
    const coPart = `CO${changeOrder.number}`;
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const fileName = `${projectPart}${clientPart} - ${coPart} - ${datePart}.pdf`;

    // Rename and share
    const renamedPath = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: renamedPath });

    let shareUri = renamedPath;
    if (Platform.OS === 'android') {
      const persistentPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: renamedPath, to: persistentPath });
      shareUri = persistentPath;
    }

    if (await Sharing.isAvailableAsync()) {
      try {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: fileName,
          UTI: 'com.adobe.pdf',
        });

        trackEvent(AnalyticsEvents.PDF_SHARED, {
          type: 'change_order',
          coNumber: changeOrder.number,
        });
      } finally {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          await FileSystem.deleteAsync(renamedPath, { idempotent: true });
          if (Platform.OS === 'android') {
            await FileSystem.deleteAsync(shareUri, { idempotent: true });
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up PDF files:', cleanupError);
        }
      }
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error generating change order PDF:', error);
    trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
      context: 'change_order_pdf_generation',
      error: String(error),
    });
    throw error;
  }
}
