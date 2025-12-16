/**
 * Brevo Email Integration for Quote Submissions
 * 
 * Sends:
 * 1. Confirmation email to customer
 * 2. Notification emails to internal sales/marketing teams
 */

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Sender email - must be verified in Brevo dashboard
// Update this to match your verified sender in Brevo
const SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "timm.mcvaigh@opiegroup.com.au";
const SENDER_NAME = "Boscotek Configurator";

// Internal notification recipients
const INTERNAL_RECIPIENTS = [
  { email: "marketing@opiegroup.com.au", name: "Opie Marketing" },
  { email: "sales@opiegroup.com.au", name: "Opie Sales" },
  { email: "sales@boscotek.com.au", name: "Boscotek Sales" }
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

interface QuoteItem {
  productName: string;
  referenceCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  configuration?: any;
}

interface CustomerDetails {
  name: string;
  email: string;
  company?: string;
  phone?: string;
}

interface EmailSettings {
  testMode?: boolean;
  testEmail?: string;
  sendToCustomer?: boolean;
  sendToMarketing?: boolean;
  sendToOpieGroupSales?: boolean;
  sendToBoscotekSales?: boolean;
}

interface QuoteEmailPayload {
  quoteReference: string;
  customer: CustomerDetails;
  items: QuoteItem[];
  totals: {
    subtotal: number;
    gst: number;
    total: number;
  };
  emailSettings?: EmailSettings;
}

// Format currency for display
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD'
  }).format(amount);
};

// Generate customer confirmation email HTML
const generateCustomerEmailHtml = (data: QuoteEmailPayload): string => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: #1f2937;">${item.productName}</strong><br>
        <span style="font-size: 12px; color: #6b7280; font-family: monospace;">${item.referenceCode}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.totalPrice)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Confirmation - ${data.quoteReference}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">BOSCOTEK</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Industrial Storage Solutions</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 24px;">Thank You for Your Quote Request!</h2>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px;">
                Hi ${data.customer.name},<br><br>
                We've received your configuration and quote request. Our team will review your requirements and be in touch shortly.
              </p>
              
              <!-- Quote Reference Box -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 32px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Quote Reference</p>
                <p style="margin: 4px 0 0 0; color: #78350f; font-size: 24px; font-weight: 700; font-family: monospace;">${data.quoteReference}</p>
              </div>
              
              <!-- Items Table -->
              <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">Your Configuration</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Product</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Subtotal (ex GST)</td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937;">${formatCurrency(data.totals.subtotal)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">GST (10%)</td>
                        <td style="padding: 8px 0; text-align: right; color: #1f2937;">${formatCurrency(data.totals.gst)}</td>
                      </tr>
                      <tr style="border-top: 2px solid #1f2937;">
                        <td style="padding: 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">Total (inc GST)</td>
                        <td style="padding: 12px 0; text-align: right; color: #f59e0b; font-size: 24px; font-weight: 700;">${formatCurrency(data.totals.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps -->
              <div style="margin-top: 32px; padding: 24px; background-color: #f9fafb; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">What Happens Next?</h3>
                <ol style="margin: 0; padding-left: 20px; color: #6b7280; line-height: 1.8;">
                  <li>Our sales team will review your configuration</li>
                  <li>We'll confirm pricing and lead times</li>
                  <li>You'll receive a formal quote within 1-2 business days</li>
                </ol>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Boscotek - A Division of Opie Manufacturing Group</p>
              <p style="margin: 0 0 16px 0; color: #9ca3af; font-size: 13px;">
                Australian Made Industrial Storage Solutions
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <a href="https://boscotek.com.au" style="color: #f59e0b; text-decoration: none;">boscotek.com.au</a> &nbsp;|&nbsp;
                <a href="mailto:sales@boscotek.com.au" style="color: #f59e0b; text-decoration: none;">sales@boscotek.com.au</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// Generate internal notification email HTML
const generateInternalEmailHtml = (data: QuoteEmailPayload): string => {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #374151; color: #e5e7eb;">
        <strong>${item.productName}</strong><br>
        <code style="font-size: 11px; color: #f59e0b;">${item.referenceCode}</code>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #374151; text-align: center; color: #e5e7eb;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #374151; text-align: right; color: #10b981; font-weight: 600;">${formatCurrency(item.totalPrice)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Quote Submission - ${data.quoteReference}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1f2937; border-radius: 8px; overflow: hidden; border: 1px solid #374151;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">🔔 NEW QUOTE SUBMISSION</h1>
            </td>
          </tr>
          
          <!-- Alert Box -->
          <tr>
            <td style="padding: 24px;">
              <div style="background-color: #065f46; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #6ee7b7; font-size: 14px;">Quote Reference</p>
                <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700; font-family: monospace;">${data.quoteReference}</p>
                <p style="margin: 12px 0 0 0; color: #10b981; font-size: 24px; font-weight: 700;">${formatCurrency(data.totals.total)}</p>
                <p style="margin: 4px 0 0 0; color: #6ee7b7; font-size: 12px;">inc GST</p>
              </div>
            </td>
          </tr>
          
          <!-- Customer Details -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <h3 style="margin: 0 0 12px 0; color: #f59e0b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Customer Details</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; color: #9ca3af; width: 100px;">Name</td>
                  <td style="padding: 12px 16px; color: #ffffff; font-weight: 600;">${data.customer.name}</td>
                </tr>
                <tr style="background-color: #3f4a5c;">
                  <td style="padding: 12px 16px; color: #9ca3af;">Email</td>
                  <td style="padding: 12px 16px;"><a href="mailto:${data.customer.email}" style="color: #60a5fa; text-decoration: none;">${data.customer.email}</a></td>
                </tr>
                ${data.customer.company ? `
                <tr>
                  <td style="padding: 12px 16px; color: #9ca3af;">Company</td>
                  <td style="padding: 12px 16px; color: #ffffff;">${data.customer.company}</td>
                </tr>
                ` : ''}
                ${data.customer.phone ? `
                <tr style="background-color: #3f4a5c;">
                  <td style="padding: 12px 16px; color: #9ca3af;">Phone</td>
                  <td style="padding: 12px 16px;"><a href="tel:${data.customer.phone}" style="color: #60a5fa; text-decoration: none;">${data.customer.phone}</a></td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- Items -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <h3 style="margin: 0 0 12px 0; color: #f59e0b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Configured Products</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #4b5563;">
                    <th style="padding: 10px; text-align: left; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Product</th>
                    <th style="padding: 10px; text-align: center; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Qty</th>
                    <th style="padding: 10px; text-align: right; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>
          
          <!-- Totals Summary -->
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #374151; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; color: #9ca3af;">Subtotal (ex GST)</td>
                  <td style="padding: 12px 16px; text-align: right; color: #e5e7eb;">${formatCurrency(data.totals.subtotal)}</td>
                </tr>
                <tr style="background-color: #3f4a5c;">
                  <td style="padding: 12px 16px; color: #9ca3af;">GST</td>
                  <td style="padding: 12px 16px; text-align: right; color: #e5e7eb;">${formatCurrency(data.totals.gst)}</td>
                </tr>
                <tr style="background-color: #065f46;">
                  <td style="padding: 16px; color: #ffffff; font-weight: 700; font-size: 16px;">TOTAL</td>
                  <td style="padding: 16px; text-align: right; color: #10b981; font-weight: 700; font-size: 20px;">${formatCurrency(data.totals.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 20px; text-align: center; border-top: 1px solid #374151;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Boscotek Configurator | Automated Quote Notification
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// Send email via Brevo API
const sendEmail = async (
  to: { email: string; name: string }[],
  subject: string,
  htmlContent: string,
  replyTo?: { email: string; name: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  // Log API key prefix for debugging (safe - only shows first 10 chars)
  console.log("Using Brevo API key starting with:", BREVO_API_KEY.substring(0, 10) + "...");

  try {
    const emailPayload: any = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to,
      subject,
      htmlContent
    };

    if (replyTo) {
      emailPayload.replyTo = replyTo;
    }

    console.log("Sending email to:", to.map(t => t.email).join(", "));
    console.log("Subject:", subject);

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    const responseText = await response.text();
    console.log("Brevo response status:", response.status);
    console.log("Brevo response body:", responseText);

    if (!response.ok) {
      // Parse error for more details
      let errorDetail = `Brevo API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.message) {
          errorDetail += ` - ${errorJson.message}`;
        }
        if (errorJson.code) {
          errorDetail += ` (code: ${errorJson.code})`;
        }
      } catch {
        errorDetail += ` - ${responseText}`;
      }
      console.error(errorDetail);
      return { success: false, error: errorDetail };
    }

    const result = JSON.parse(responseText);
    return { success: true, messageId: result.messageId };

  } catch (error: any) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: QuoteEmailPayload = await req.json();

    if (!payload.quoteReference || !payload.customer || !payload.items) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Apply email settings with defaults
    const settings: EmailSettings = {
      testMode: false,
      testEmail: '',
      sendToCustomer: true,
      sendToMarketing: true,
      sendToOpieGroupSales: true,
      sendToBoscotekSales: true,
      ...payload.emailSettings
    };

    console.log("Email settings:", JSON.stringify(settings));

    const results = {
      customerEmail: { success: false, error: "", skipped: false },
      internalEmail: { success: false, error: "", skipped: false }
    };

    // Handle test mode - redirect all emails to test address
    if (settings.testMode && settings.testEmail) {
      console.log("TEST MODE: Redirecting all emails to", settings.testEmail);
      
      const testRecipient = [{ email: settings.testEmail, name: "Test Recipient" }];
      
      // Send customer email to test address
      const customerEmailHtml = generateCustomerEmailHtml(payload);
      const customerResult = await sendEmail(
        testRecipient,
        `[TEST - Customer] Quote Confirmation - ${payload.quoteReference} | Boscotek`,
        customerEmailHtml
      );
      results.customerEmail = { ...customerResult, skipped: false };

      // Send internal email to test address  
      const internalEmailHtml = generateInternalEmailHtml(payload);
      const internalResult = await sendEmail(
        testRecipient,
        `[TEST - Internal] 🔔 New Quote: ${payload.quoteReference} - ${formatCurrency(payload.totals.total)}`,
        internalEmailHtml
      );
      results.internalEmail = { ...internalResult, skipped: false };

    } else {
      // Production mode - use settings to determine recipients

      // 1. Send confirmation email to customer (if enabled)
      if (settings.sendToCustomer) {
        const customerEmailHtml = generateCustomerEmailHtml(payload);
        const customerResult = await sendEmail(
          [{ email: payload.customer.email, name: payload.customer.name }],
          `Quote Confirmation - ${payload.quoteReference} | Boscotek`,
          customerEmailHtml,
          { email: "sales@boscotek.com.au", name: "Boscotek Sales" }
        );
        results.customerEmail = { ...customerResult, skipped: false };
      } else {
        results.customerEmail = { success: true, skipped: true, error: "" };
        console.log("Customer email skipped (disabled in settings)");
      }

      // 2. Build internal recipients list based on settings
      const internalRecipients: { email: string; name: string }[] = [];
      
      if (settings.sendToMarketing) {
        internalRecipients.push({ email: "marketing@opiegroup.com.au", name: "Opie Marketing" });
      }
      if (settings.sendToOpieGroupSales) {
        internalRecipients.push({ email: "sales@opiegroup.com.au", name: "Opie Sales" });
      }
      if (settings.sendToBoscotekSales) {
        internalRecipients.push({ email: "sales@boscotek.com.au", name: "Boscotek Sales" });
      }

      // Send internal notifications if any recipients enabled
      if (internalRecipients.length > 0) {
        const internalEmailHtml = generateInternalEmailHtml(payload);
        const internalResult = await sendEmail(
          internalRecipients,
          `🔔 New Quote: ${payload.quoteReference} - ${formatCurrency(payload.totals.total)} | ${payload.customer.company || payload.customer.name}`,
          internalEmailHtml,
          { email: payload.customer.email, name: payload.customer.name }
        );
        results.internalEmail = { ...internalResult, skipped: false };
        console.log("Internal emails sent to:", internalRecipients.map(r => r.email).join(", "));
      } else {
        results.internalEmail = { success: true, skipped: true, error: "" };
        console.log("Internal emails skipped (all recipients disabled)");
      }
    }

    console.log("Email results:", JSON.stringify(results));

    return new Response(JSON.stringify({
      success: true,
      testMode: settings.testMode,
      results
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err: any) {
    console.error("Unhandled email error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

if (import.meta.main) {
  Deno.serve(handler);
}

