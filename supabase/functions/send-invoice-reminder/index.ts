// Send Invoice Reminder - Edge Function
// Sends payment reminder emails to clients (Pro/Premium feature)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvoiceReminderRequest {
  invoiceId: string;
  channel?: "email" | "sms"; // Default: email
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (bypasses RLS for queries)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token and verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[send-invoice-reminder] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { invoiceId, channel = "email" } = (await req.json()) as InvoiceReminderRequest;
    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Missing invoiceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice and profile in parallel
    const [invoiceResult, profileResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("profiles")
        .select("tier, company_name, company_email, company_phone, sms_phone")
        .eq("id", user.id)
        .single(),
    ]);

    if (invoiceResult.error || !invoiceResult.data) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoice = invoiceResult.data;
    const profile = profileResult.data;

    // Check tier - must be Pro or Premium
    if (!profile?.tier || profile.tier === "free") {
      return new Response(
        JSON.stringify({ error: "Upgrade to Pro to send reminders" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMS requires Premium tier
    if (channel === "sms" && profile.tier !== "premium") {
      return new Response(
        JSON.stringify({ error: "Upgrade to Premium to send SMS reminders" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMS requires contractor to have sms_phone configured
    if (channel === "sms" && !profile.sms_phone) {
      return new Response(
        JSON.stringify({ error: "SMS not configured. Set up your QuoteCat phone number first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for client contact info based on channel
    if (channel === "email" && !invoice.client_email) {
      return new Response(
        JSON.stringify({ error: "No client email on invoice" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (channel === "sms" && !invoice.client_phone) {
      return new Response(
        JSON.stringify({ error: "No client phone on invoice" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Invoice is already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate amount and days overdue
    const amount = calculateInvoiceTotal(invoice);
    const daysOverdue = calculateDaysOverdue(invoice.due_date);

    // Generate invoice link
    const invoiceLink = `https://portal.quotecat.ai/pay/${invoiceId}`;

    // Generate email subject based on status
    let subject: string;
    if (daysOverdue > 0) {
      subject = `Payment overdue: Invoice ${invoice.invoice_number} - ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past due`;
    } else if (daysOverdue === 0) {
      subject = `Payment due today: Invoice ${invoice.invoice_number}`;
    } else {
      subject = `Payment reminder: Invoice ${invoice.invoice_number} due ${formatDateShort(invoice.due_date)}`;
    }

    // Generate email HTML
    const emailHtml = generateReminderEmailHtml({
      clientName: invoice.client_name || "there",
      invoiceNumber: invoice.invoice_number,
      projectName: invoice.name,
      amount: formatCurrency(amount, invoice.currency || "USD"),
      dueDate: invoice.due_date,
      daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
      invoiceLink,
      companyName: profile.company_name || "Your contractor",
      companyPhone: profile.company_phone,
      companyEmail: profile.company_email,
    });

    // Send reminder based on channel
    if (channel === "email") {
      // Send email via Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Email service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "QuoteCat <noreply@quotecat.ai>",
          to: [invoice.client_email],
          subject,
          html: emailHtml,
          reply_to: profile.company_email || undefined,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("[send-invoice-reminder] Resend API error:", errorText);

        // Log failure
        await supabase.from("invoice_reminders").insert({
          invoice_id: invoiceId,
          user_id: user.id,
          reminder_type: "email",
          remind_at: new Date().toISOString(),
          status: "failed",
          sent_at: new Date().toISOString(),
          error: errorText,
          reminder_number: (invoice.reminder_count || 0) + 1,
        });

        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Send SMS via Twilio
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        return new Response(
          JSON.stringify({ error: "SMS service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate SMS message
      const smsMessage = generateReminderSmsMessage({
        invoiceNumber: invoice.invoice_number,
        amount: formatCurrency(amount, invoice.currency || "USD"),
        daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
        invoiceLink,
        companyName: profile.company_name || "Your contractor",
      });

      // Format phone number to E.164
      const toPhone = formatPhoneE164(invoice.client_phone);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const smsResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: profile.sms_phone,
          To: toPhone,
          Body: smsMessage,
        }),
      });

      if (!smsResponse.ok) {
        const errorData = await smsResponse.json();
        console.error("[send-invoice-reminder] Twilio API error:", errorData);

        // Log failure
        await supabase.from("invoice_reminders").insert({
          invoice_id: invoiceId,
          user_id: user.id,
          reminder_type: "sms",
          remind_at: new Date().toISOString(),
          status: "failed",
          sent_at: new Date().toISOString(),
          error: errorData.message || "SMS failed",
          reminder_number: (invoice.reminder_count || 0) + 1,
        });

        return new Response(
          JSON.stringify({ error: errorData.message || "Failed to send SMS" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update invoice reminder tracking
    const newReminderCount = (invoice.reminder_count || 0) + 1;
    await supabase
      .from("invoices")
      .update({
        reminder_sent_at: new Date().toISOString(),
        reminder_count: newReminderCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    // Create reminder record
    await supabase.from("invoice_reminders").insert({
      invoice_id: invoiceId,
      user_id: user.id,
      reminder_type: channel,
      remind_at: new Date().toISOString(),
      status: "sent",
      sent_at: new Date().toISOString(),
      reminder_number: newReminderCount,
    });

    const recipient = channel === "email" ? invoice.client_email : invoice.client_phone;
    console.log(`[send-invoice-reminder] Sent ${channel} reminder for invoice ${invoiceId} to ${recipient}`);

    return new Response(
      JSON.stringify({
        success: true,
        channel,
        sentAt: new Date().toISOString(),
        reminderCount: newReminderCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-invoice-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper functions

function calculateInvoiceTotal(invoice: {
  items?: { unitPrice?: number; qty?: number }[];
  labor?: number;
  markup_percent?: number;
  tax_percent?: number;
  percentage?: number;
  paid_amount?: number;
}): number {
  const items = invoice.items || [];
  const materialsCost = items.reduce((sum, item) => {
    return sum + ((item.unitPrice || 0) * (item.qty || 0));
  }, 0);

  const labor = invoice.labor || 0;
  const markupPercent = invoice.markup_percent || 0;
  const taxPercent = invoice.tax_percent || 0;
  const percentage = invoice.percentage || 100;

  const subtotal = materialsCost + labor;
  const markup = subtotal * (markupPercent / 100);
  const beforeTax = subtotal + markup;
  const tax = beforeTax * (taxPercent / 100);
  const total = (beforeTax + tax) * (percentage / 100);

  const paidAmount = invoice.paid_amount || 0;
  return Math.max(0, total - paidAmount);
}

function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function generateReminderEmailHtml(params: {
  clientName: string;
  invoiceNumber: string;
  projectName: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
  invoiceLink: string;
  companyName: string;
  companyPhone?: string;
  companyEmail?: string;
}): string {
  const {
    clientName,
    invoiceNumber,
    projectName,
    amount,
    dueDate,
    daysOverdue,
    invoiceLink,
    companyName,
    companyPhone,
    companyEmail,
  } = params;

  const formattedDueDate = new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgencyMessage = daysOverdue
    ? `<p style="color: #dc2626; font-weight: 600; margin-bottom: 16px;">This invoice is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past due.</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Reminder</h1>
  </div>

  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi ${clientName},</p>

    <p>This is a friendly reminder about your outstanding invoice from <strong>${companyName}</strong>.</p>

    ${urgencyMessage}

    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Invoice</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Project</td>
          <td style="padding: 8px 0; text-align: right;">${projectName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Amount Due</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 18px; color: #f97316;">${amount}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Due Date</td>
          <td style="padding: 8px 0; text-align: right;">${formattedDueDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${invoiceLink}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View & Pay Invoice</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">If you've already sent payment, please disregard this reminder. Thank you for your business!</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      <strong>${companyName}</strong><br>
      ${companyEmail ? `${companyEmail}<br>` : ""}
      ${companyPhone ? companyPhone : ""}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function generateReminderSmsMessage(params: {
  invoiceNumber: string;
  amount: string;
  daysOverdue?: number;
  invoiceLink: string;
  companyName: string;
}): string {
  const { invoiceNumber, amount, daysOverdue, invoiceLink, companyName } = params;

  if (daysOverdue && daysOverdue > 0) {
    return `Payment reminder from ${companyName}: Invoice ${invoiceNumber} for ${amount} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue. View & pay: ${invoiceLink}`;
  }

  return `Payment reminder from ${companyName}: Invoice ${invoiceNumber} for ${amount} is due. View & pay: ${invoiceLink}`;
}

function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  // Already has country code or other format
  if (phone.startsWith("+")) {
    return phone;
  }
  return `+${cleaned}`;
}
