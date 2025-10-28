// lib/pdf.ts
// PDF generation utility using expo-print

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Quote } from './types';
import type { CompanyDetails } from './preferences';
import { trackEvent, AnalyticsEvents } from './app-analytics';

export type PDFOptions = {
  includeBranding: boolean; // true for free tier, false for pro
  companyDetails?: CompanyDetails;
};

/**
 * Generate HTML for the quote PDF
 */
function generateQuoteHTML(quote: Quote, options: PDFOptions): string {
  const { includeBranding, companyDetails } = options;

  // Calculate totals
  const materialsFromItems = quote.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;

  const materialEstimate = quote.materialEstimate ?? 0;
  const labor = quote.labor ?? 0;
  const overhead = quote.overhead ?? 0;
  const markupPercent = quote.markupPercent ?? 0;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const markupAmount = (subtotal * markupPercent) / 100;
  const grandTotal = subtotal + markupAmount;

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

  // QuoteCat branding for free tier - more prominent
  const brandingHeader = includeBranding ? `
    <div style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); color: white; padding: 12px 20px; text-align: center; margin-bottom: 20px; border-radius: 6px; box-shadow: 0 2px 8px rgba(255, 140, 0, 0.3);">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 4px; letter-spacing: 1px;">
        QuoteCat
      </div>
      <div style="font-size: 11px; font-weight: 500; opacity: 0.9;">
        Professional Quote Generator
      </div>
    </div>
  ` : '';

  const brandingFooter = includeBranding ? `
    <div style="margin-top: 32px; padding: 16px; border-top: 3px solid #FF8C00; text-align: center; background: #FFF9F0;">
      <div style="font-size: 14px; color: #FF8C00; margin-bottom: 6px; font-weight: 800;">
        Powered by QuoteCat
      </div>
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
        Create professional quotes in seconds • https://www.quotecat.ai
      </div>
      <div style="font-size: 10px; color: #999; font-style: italic;">
        Upgrade to QuoteCat Pro to remove this branding and unlock unlimited exports
      </div>
    </div>
  ` : '';

  // Company header with details
  const companyHeader = companyDetails && (companyDetails.companyName || companyDetails.email || companyDetails.phone || companyDetails.website || companyDetails.address) ? `
    <div style="margin-bottom: 24px; padding: 16px; background: #f9f9f9; border-left: 4px solid #FF8C00; border-radius: 4px;">
      ${companyDetails.companyName ? `<div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #000;">${companyDetails.companyName}</div>` : ''}
      ${companyDetails.email ? `<div style="font-size: 13px; color: #666; margin-bottom: 4px;">Email: ${companyDetails.email}</div>` : ''}
      ${companyDetails.phone ? `<div style="font-size: 13px; color: #666; margin-bottom: 4px;">Phone: ${companyDetails.phone}</div>` : ''}
      ${companyDetails.website ? `<div style="font-size: 13px; color: #666; margin-bottom: 4px;">Website: ${companyDetails.website}</div>` : ''}
      ${companyDetails.address ? `<div style="font-size: 13px; color: #666;">${companyDetails.address}</div>` : ''}
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
          margin: 20mm 15mm; /* Standard margins for all platforms */
          size: letter;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 0;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .page-content {
          padding: 24px;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 3px solid #FF8C00;
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
          page-break-inside: auto; /* Allow page breaks in long tables */
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
          page-break-inside: auto; /* Allow page breaks in sections */
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
          border-top: 3px solid #FF8C00;
          font-weight: 800;
          font-size: 18px;
        }
        .totals-table .total-row .value {
          color: #FF8C00;
          font-size: 22px;
        }
      </style>
    </head>
    <body>
      <div class="page-content">
      ${brandingHeader}

      ${companyHeader}

      <div class="header">
        <div class="project-name">${quote.name || 'Untitled Quote'}</div>
        ${quote.clientName ? `<div class="client-name">For: ${quote.clientName}</div>` : ''}
        <div class="date">${dateString}</div>
      </div>

      ${quote.items && quote.items.length > 0 ? `
        <div class="section">
          <div class="section-title">Materials</div>
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
        <div class="section-title">Cost Breakdown</div>
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
            <tr class="total-row">
              <td class="label">Total</td>
              <td class="value">$${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

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
    // Generate PDF using expo-print
    // On web: Opens browser print dialog
    // On mobile: Creates PDF file
    const { uri } = await Print.printToFileAsync({ html });

    // Track PDF generation
    trackEvent(AnalyticsEvents.PDF_GENERATED, {
      quoteId: quote.id,
      itemCount: quote.items?.length || 0,
      total: quote.total,
      includedBranding: options.includeBranding,
      hasCompanyDetails: !!options.companyDetails,
    });

    // Share PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${quote.name || 'Quote'}.pdf`,
        UTI: 'com.adobe.pdf',
      });

      // Track PDF sharing
      trackEvent(AnalyticsEvents.PDF_SHARED, {
        quoteId: quote.id,
      });
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
