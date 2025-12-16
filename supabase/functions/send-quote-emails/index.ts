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
  configurationCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  configuration?: any;
  specsSummary?: string[];
  breakdown?: { code: string; label: string; price: number }[];
}

// Boscotek logo URL (hosted on Supabase storage or CDN)
const BOSCOTEK_LOGO_URL = "https://svzfendhhixkddejwzxh.supabase.co/storage/v1/object/public/assets/boscotek-logo.png";

// Product descriptions for email content
const PRODUCT_DESCRIPTIONS: Record<string, { intro: string; features: string[] }> = {
  'Mobile Tool Cart Station': {
    intro: 'The Boscotek Mobile Tool Cart Station is a premium Australian-made mobile workstation designed for demanding industrial environments. Built with heavy-duty steel construction and featuring our signature XT Shield powder coating, this versatile cart combines maximum storage capacity with excellent mobility.',
    features: [
      'Heavy-duty anti-tilt castor system for safe mobility',
      'Dual bay configuration for flexible storage options',
      'Premium drawer slides rated to 200kg per drawer',
      'Integrated worktop with optional materials',
      'Modular rear accessory system for tools and parts',
      'XT Shield powder coating for superior durability'
    ]
  },
  'High Density Cabinet': {
    intro: 'The Boscotek High Density Storage Cabinet maximizes storage efficiency with our patented drawer configuration system. Engineered for parts storage, tool organization, and industrial applications, each cabinet features precision-manufactured drawer slides and robust steel construction.',
    features: [
      'Configurable drawer heights (75mm to 300mm)',
      'High-capacity drawer slides rated to 200kg',
      'Anti-tilt safety mechanism',
      'XT Shield powder coating finish',
      'Optional partition and bin systems',
      'Available in S-Series (605mm) or D-Series (755mm) depths'
    ]
  },
  'Heavy Duty Workbench': {
    intro: 'The Boscotek Heavy Duty Workbench is built to handle the toughest industrial tasks. With a robust steel frame construction and multiple worktop options, this workbench provides a stable, durable work surface backed by Australian manufacturing quality.',
    features: [
      'Steel frame rated to 500kg UDL',
      'Multiple worktop material options',
      'Adjustable or fixed leg heights',
      'Under-bench storage configurations',
      'Optional above-bench shelving and panels',
      'Modular design for flexible layouts'
    ]
  },
  'Industrial Workbench': {
    intro: 'The Boscotek Industrial Workbench combines versatility with heavy-duty construction. Designed for assembly lines, workshops, and production facilities, it offers exceptional stability and adaptability for various industrial applications.',
    features: [
      'Industrial-grade steel construction',
      'Multiple worktop surfaces available',
      'Height-adjustable options',
      'Under-bench cabinet integration',
      'Above-bench accessory mounting',
      'Castors or fixed feet options'
    ]
  }
};

// Get product description or generate a generic one
const getProductDescription = (productName: string): { intro: string; features: string[] } => {
  return PRODUCT_DESCRIPTIONS[productName] || {
    intro: `The ${productName} is precision-engineered by Boscotek, Australia's leading manufacturer of industrial storage and workstation solutions. Built with premium materials and backed by our commitment to quality, this product delivers exceptional performance for demanding environments.`,
    features: [
      'Australian designed and manufactured',
      'Premium XT Shield powder coating',
      'Heavy-duty steel construction',
      'Customizable configuration options',
      'Industry-leading warranty coverage'
    ]
  };
};

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

// Generate detailed product section for customer email
const generateProductDetailHtml = (item: QuoteItem): string => {
  const productDesc = getProductDescription(item.productName);
  const configCode = item.configurationCode || item.referenceCode;
  
  // Generate specs list from specsSummary or breakdown
  let specsHtml = '';
  if (item.specsSummary && item.specsSummary.length > 0) {
    specsHtml = item.specsSummary.map(spec => 
      `<li style="margin: 4px 0; color: #374151;">${spec}</li>`
    ).join('');
  } else if (item.breakdown && item.breakdown.length > 0) {
    specsHtml = item.breakdown
      .filter(b => b.code !== 'SUBTOTAL' && b.price >= 0)
      .slice(0, 10)
      .map(b => `<li style="margin: 4px 0; color: #374151;">${b.label}</li>`)
      .join('');
  }

  return `
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <!-- Product Header -->
      <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 20px;">
        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px;">${item.productName}</h3>
        <div style="font-family: monospace; font-size: 14px; color: #f59e0b; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; display: inline-block;">
          ${configCode}
        </div>
      </div>
      
      <!-- Product Description -->
      <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
          ${productDesc.intro}
        </p>
      </div>
      
      <!-- Features & Specifications -->
      <div style="padding: 20px; background-color: #f9fafb;">
        <div style="display: flex; gap: 20px;">
          <!-- Key Features -->
          <div style="flex: 1;">
            <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Key Features</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
              ${productDesc.features.slice(0, 4).map(f => `<li style="margin: 4px 0; color: #4b5563;">${f}</li>`).join('')}
            </ul>
          </div>
          
          <!-- Your Configuration -->
          ${specsHtml ? `
          <div style="flex: 1;">
            <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Your Configuration</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
              ${specsHtml}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Pricing -->
      <div style="padding: 16px 20px; background-color: #1f2937; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #9ca3af; font-size: 14px;">Quantity: ${item.quantity}</span>
        <span style="color: #f59e0b; font-size: 24px; font-weight: 700;">${formatCurrency(item.totalPrice)}</span>
      </div>
    </div>
  `;
};

// Generate customer confirmation email HTML
const generateCustomerEmailHtml = (data: QuoteEmailPayload): string => {
  // Generate detailed product sections
  const productsHtml = data.items.map(item => generateProductDetailHtml(item)).join('');
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: #1f2937;">${item.productName}</strong><br>
        <span style="font-size: 12px; color: #6b7280; font-family: monospace;">${item.configurationCode || item.referenceCode}</span>
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
        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px; text-align: center;">
              <img src="https://boscotek.com.au/wp-content/uploads/2021/03/boscotek-logo-white.png" alt="Boscotek" style="height: 50px; margin-bottom: 16px;" onerror="this.style.display='none'">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Quote Confirmation</h1>
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Australian Made Industrial Storage Solutions</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Personal Greeting -->
              <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 12px 0; color: #1f2937; font-size: 24px;">Hi ${data.customer.name},</h2>
                <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Thank you for configuring your custom Boscotek solution. We've received your quote request and our team is ready to help bring your workspace to life.
                </p>
              </div>
              
              <!-- Quote Reference Box -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 5px solid #f59e0b; padding: 20px 24px; margin-bottom: 40px; border-radius: 0 12px 12px 0;">
                <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Quote Reference</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 28px; font-weight: 700; font-family: monospace;">${data.quoteReference}</p>
                <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">Please reference this number in all communications</p>
              </div>
              
              <!-- About Boscotek -->
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px; display: flex; align-items: center;">
                  <span style="color: #f59e0b; margin-right: 8px;">★</span> Why Choose Boscotek?
                </h3>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.7;">
                  For over 30 years, Boscotek has been Australia's trusted manufacturer of premium industrial storage and workstation solutions. Every product is designed, engineered, and manufactured in Australia using high-grade steel and our exclusive XT Shield powder coating technology for exceptional durability and longevity.
                </p>
              </div>
              
              <!-- Product Details Section -->
              <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; border-bottom: 2px solid #f59e0b; padding-bottom: 12px;">Your Configured Products</h3>
              
              ${productsHtml}
              
              <!-- Pricing Summary -->
              <div style="background-color: #1f2937; border-radius: 12px; padding: 24px; margin-top: 32px;">
                <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em;">Quote Summary</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 15px;">Subtotal (ex GST)</td>
                    <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 15px;">${formatCurrency(data.totals.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #9ca3af; font-size: 15px;">GST (10%)</td>
                    <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 15px;">${formatCurrency(data.totals.gst)}</td>
                  </tr>
                  <tr style="border-top: 1px solid #374151;">
                    <td style="padding: 16px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700;">Total (inc GST)</td>
                    <td style="padding: 16px 0 0 0; text-align: right; color: #f59e0b; font-size: 28px; font-weight: 700;">${formatCurrency(data.totals.total)}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Next Steps -->
              <div style="margin-top: 32px; padding: 24px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border-left: 5px solid #10b981;">
                <h3 style="margin: 0 0 16px 0; color: #065f46; font-size: 18px;">What Happens Next?</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top; width: 32px;">
                      <div style="width: 24px; height: 24px; background-color: #10b981; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">1</div>
                    </td>
                    <td style="padding: 8px 0 8px 12px; color: #065f46; font-size: 14px;">Our sales team will review your configuration within 24 hours</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <div style="width: 24px; height: 24px; background-color: #10b981; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">2</div>
                    </td>
                    <td style="padding: 8px 0 8px 12px; color: #065f46; font-size: 14px;">We'll confirm final pricing, any customizations, and lead times</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <div style="width: 24px; height: 24px; background-color: #10b981; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">3</div>
                    </td>
                    <td style="padding: 8px 0 8px 12px; color: #065f46; font-size: 14px;">You'll receive a formal quote ready for approval</td>
                  </tr>
                </table>
              </div>
              
              <!-- Contact CTA -->
              <div style="margin-top: 32px; text-align: center; padding: 24px; background-color: #f9fafb; border-radius: 12px;">
                <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 15px;">Have questions about your configuration?</p>
                <a href="mailto:sales@boscotek.com.au" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Contact Our Team</a>
                <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 13px;">Or call us: <a href="tel:1300267268" style="color: #f59e0b; text-decoration: none;">1300 BOSCOTEK</a></p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 40px; text-align: center;">
              <img src="https://boscotek.com.au/wp-content/uploads/2021/03/boscotek-logo-white.png" alt="Boscotek" style="height: 36px; margin-bottom: 20px;" onerror="this.style.display='none'">
              <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Boscotek - A Division of Opie Manufacturing Group</p>
              <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 14px;">
                Premium Australian Made Industrial Storage Solutions
              </p>
              <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 13px;">
                <a href="https://boscotek.com.au" style="color: #f59e0b; text-decoration: none;">boscotek.com.au</a> &nbsp;|&nbsp;
                <a href="mailto:sales@boscotek.com.au" style="color: #f59e0b; text-decoration: none;">sales@boscotek.com.au</a> &nbsp;|&nbsp;
                <a href="tel:1300267268" style="color: #f59e0b; text-decoration: none;">1300 BOSCOTEK</a>
              </p>
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 11px;">
                This quote is valid for 30 days. Prices are subject to confirmation.<br>
                © ${new Date().getFullYear()} Opie Manufacturing Group. All rights reserved.
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
  // Generate detailed items with specs for internal team
  const itemsHtml = data.items.map(item => {
    const configCode = item.configurationCode || item.referenceCode;
    
    // Build specs list from available data
    let specsHtml = '';
    if (item.specsSummary && item.specsSummary.length > 0) {
      specsHtml = `<div style="margin-top: 8px; font-size: 11px; color: #9ca3af;">${item.specsSummary.slice(0, 5).join(' • ')}</div>`;
    } else if (item.breakdown && item.breakdown.length > 0) {
      const specs = item.breakdown
        .filter(b => b.code !== 'SUBTOTAL' && !b.label.includes('Base'))
        .slice(0, 5)
        .map(b => b.label.replace(/^[^:]+:\s*/, ''))
        .join(' • ');
      if (specs) {
        specsHtml = `<div style="margin-top: 8px; font-size: 11px; color: #9ca3af;">${specs}</div>`;
      }
    }

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #374151; color: #e5e7eb;">
          <strong style="font-size: 14px;">${item.productName}</strong><br>
          <code style="font-size: 12px; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 2px 6px; border-radius: 4px;">${configCode}</code>
          ${specsHtml}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #374151; text-align: center; color: #e5e7eb; font-size: 16px; font-weight: 600;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #374151; text-align: right; color: #10b981; font-weight: 700; font-size: 16px;">${formatCurrency(item.totalPrice)}</td>
      </tr>
    `;
  }).join('');

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

