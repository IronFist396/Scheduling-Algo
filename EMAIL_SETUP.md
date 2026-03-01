# Email Notification Setup

This document explains how to configure the **Send Email** functionality used by the Interview Scheduler to notify candidates about their scheduled interviews.

---

## Overview

The API endpoint `POST /api/send-email` sends an interview confirmation email to a candidate. It uses [Nodemailer](https://nodemailer.com/) with SMTP transport.

---

## Environment Variables

Add the following variables to your `.env` file in the project root:

```env
# ── SMTP Email Configuration ──

SMTP_HOST=smtp.example.com       # SMTP server hostname
SMTP_PORT=587                    # SMTP port (587 for STARTTLS, 465 for SSL)
SMTP_USER=your-email@example.com # SMTP login username (usually your email)
SMTP_PASS="your-password"        # SMTP login password (wrap in quotes if it contains special chars like #)
FROM_EMAIL=your-email@example.com # "From" address shown to recipients
```

> **Important:** If your password contains `#`, `$`, or other special characters, **wrap it in double quotes** in the `.env` file. The `#` character is treated as a comment delimiter otherwise.

---

## Provider-Specific Setup

### Gmail

1. Enable **2-Step Verification** on your Google account: https://myaccount.google.com/security
2. Generate an **App Password**: https://myaccount.google.com/apppasswords
   - Select app: **Mail**, device: **Other** (enter any name)
   - Copy the 16-character password
3. Set your `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop   # 16-char app password (no quotes needed)
FROM_EMAIL=your.email@gmail.com
```

### Outlook / Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your.email@outlook.com
SMTP_PASS="your-password"
FROM_EMAIL=your.email@outlook.com
```

### IITB (smtp-auth.iitb.ac.in)

> **Requirement:** You must be on the **IITB campus network** or connected via **IITB VPN** for authentication to succeed.

```env
SMTP_HOST=smtp-auth.iitb.ac.in
SMTP_PORT=587
SMTP_USER=your_ldap_id@iitb.ac.in
SMTP_PASS="your-ldap-password"
FROM_EMAIL=your_ldap_id@iitb.ac.in
```

### Custom / Self-Hosted SMTP

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=user@yourdomain.com
SMTP_PASS="your-password"
FROM_EMAIL=noreply@yourdomain.com
```

---

## API Usage

### Endpoint

```
POST /api/send-email
```

### Request Body

```json
{
  "interviewId": 42
}
```

| Field          | Type     | Required | Description                          |
|----------------|----------|----------|--------------------------------------|
| `interviewId`  | `number` | Yes      | ID of the interview record in the DB |

### Responses

| Status | Body                                                        | Description                        |
|--------|-------------------------------------------------------------|------------------------------------|
| 200    | `{ "success": true, "messageId": "<id>" }`                 | Email sent successfully            |
| 400    | `{ "error": "Provide interviewId in body" }`               | Missing `interviewId`              |
| 400    | `{ "error": "Candidate email not available" }`             | Candidate has no email in DB       |
| 404    | `{ "error": "Interview not found" }`                       | No interview with that ID          |
| 405    | `{ "error": "Method not allowed" }`                        | Non-POST request                   |
| 500    | `{ "error": "Failed to send email", "details": "..." }`   | SMTP or server error               |

### Example (cURL)

```bash
curl -X POST http://localhost:3000/api/send-email \
  -H "Content-Type: application/json" \
  -d '{"interviewId": 42}'
```

---

## Verifying Your Setup

Run this quick test from the project root to check if your SMTP credentials work:

```bash
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config();
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
t.verify()
  .then(() => console.log('✅ SMTP authentication successful'))
  .catch(e => console.error('❌ SMTP auth failed:', e.message));
"
```

---

## Troubleshooting

| Error                                        | Cause & Fix                                                                                                    |
|----------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `535 5.7.8 authentication failure`           | Wrong username/password, or network restriction (e.g., IITB requires campus network / VPN)                     |
| `ECONNREFUSED`                               | Wrong `SMTP_HOST` or `SMTP_PORT`, or firewall blocking the connection                                          |
| `ESOCKET` / `ECONNRESET`                     | Try changing `SMTP_PORT` (587 vs 465) or check if your network blocks outbound SMTP                           |
| `Invalid login` with Gmail                   | You must use an **App Password**, not your regular Google password                                              |
| Password with `#` not working                | Wrap the value in double quotes in `.env`: `SMTP_PASS="pass#word"`                                             |
| `self signed certificate`                    | Add `tls: { rejectUnauthorized: false }` to transport options (not recommended for production)                 |

---

## Security Notes

- **Never commit** your `.env` file to version control. Ensure `.env` is listed in `.gitignore`.
- Use **App Passwords** or **OAuth2** instead of your primary account password when possible.
- Limit SMTP credentials to a dedicated service account for production deployments.
