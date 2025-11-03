# QuoteCat Email Setup

## Current Configuration

**Domain:** quotecat.ai
**DNS Host:** Netlify
**Email Host:** GoDaddy
**Email Addresses:** @quotecat.ai

---

## How It's Set Up

### Domain & DNS
- Domain registered with GoDaddy
- DNS managed by Netlify (nameservers pointed to Netlify)
- Website hosted on Netlify

### Email Hosting
- Email hosted by GoDaddy (Workspace/Email & Office)
- MX records in Netlify point to GoDaddy's mail servers

---

## DNS Records in Netlify (for GoDaddy Email)

These records must be configured in Netlify DNS for email to work:

### MX Records (Required)
```
Type: MX
Name: @ (or quotecat.ai)
Value: mailstore1.secureserver.net
Priority: 0 or 10

Type: MX
Name: @ (or quotecat.ai)
Value: smtp.secureserver.net
Priority: 10 or 20
```

### SPF Record (Recommended for deliverability)
```
Type: TXT
Name: @ (or quotecat.ai)
Value: v=spf1 include:secureserver.net ~all
```

### DKIM Records (If provided by GoDaddy)
```
Type: TXT
Name: [provided by GoDaddy]
Value: [provided by GoDaddy]
```

---

## How to Access Email

### Webmail
- URL: https://email.godaddy.com
- Login with full email address (e.g., hello@quotecat.ai)

### Email Client Setup (Outlook, Apple Mail, Gmail, etc.)

**Incoming Mail (IMAP):**
- Server: `imap.secureserver.net`
- Port: `993`
- Security: SSL/TLS
- Username: Full email address (e.g., hello@quotecat.ai)
- Password: Your email password

**Outgoing Mail (SMTP):**
- Server: `smtpout.secureserver.net`
- Port: `465` (SSL) or `587` (TLS)
- Security: SSL/TLS
- Username: Full email address
- Password: Your email password
- Authentication: Required

---

## Creating New Email Addresses

1. Log into GoDaddy account
2. Go to **Email & Office** → **Manage**
3. Select your workspace
4. Click **Create Email Address**
5. Enter the name (e.g., "support" for support@quotecat.ai)
6. Set password
7. Done! Email is immediately active

---

## Checking If Email Is Working

### Quick Test
1. Send an email to your @quotecat.ai address from a personal email
2. Check if it arrives in GoDaddy webmail or your email client
3. Reply from @quotecat.ai to confirm sending works

### DNS Check
Use online tools to verify MX records:
- https://mxtoolbox.com/SuperTool.aspx
- Enter: quotecat.ai
- Should show GoDaddy mail servers

---

## Troubleshooting

### Email Not Receiving
- Check MX records are set up in Netlify DNS
- Wait 24-48 hours for DNS propagation after changes
- Verify email account exists in GoDaddy

### Email Not Sending
- Check SMTP settings in email client
- Verify authentication is enabled
- Try both port 465 (SSL) and 587 (TLS)
- Check GoDaddy account is active and paid

### DNS Not Propagating
- DNS changes can take 24-48 hours
- Use `nslookup -type=mx quotecat.ai` to check
- Clear your local DNS cache

---

## Important Notes

**Domain Transfer:**
- Domain can stay registered with GoDaddy
- DNS managed by Netlify (for faster website updates)
- Email stays with GoDaddy (no need to move)

**Email Migration:**
If you ever want to move email away from GoDaddy:
- Consider Google Workspace, Microsoft 365, or Fastmail
- Update MX records in Netlify to point to new provider
- Export emails from GoDaddy before canceling

**Costs:**
- GoDaddy email: ~$6-12/month per mailbox
- Domain registration: ~$15-20/year (with GoDaddy)
- Netlify hosting: Free (for current usage)

---

## Email Addresses to Create (Recommended)

- **hello@quotecat.ai** - General inquiries
- **support@quotecat.ai** - Customer support
- **noreply@quotecat.ai** - Automated emails (if needed)
- Your personal email (e.g., kelli@quotecat.ai)

---

## Future: Email Automation

When you're ready to send automated emails (welcome emails, invoice reminders, etc.):

**Options:**
- **SendGrid** - Email API for transactional emails
- **Mailgun** - Similar to SendGrid
- **AWS SES** - Cost-effective but more technical
- **Resend** - Developer-friendly, modern

You'll need to:
1. Set up SPF/DKIM/DMARC records
2. Add API service to your backend
3. Verify domain with email service
4. Update DNS records in Netlify

---

Last Updated: November 3, 2025
