import { prisma } from '../../lib/prisma';
import nodemailer from 'nodemailer';

// Ensure these env vars are set in .env:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { interviewId } = req.body || {};

    if (!interviewId) {
        return res.status(400).json({ error: 'Provide interviewId in body' });
    }

    // Guard: fail fast with a clear message if SMTP is not configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({
            error: 'SMTP not configured',
            details: 'Set SMTP_HOST, SMTP_USER and SMTP_PASS in your .env file',
        });
    }

    try {
        const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            include: {
                candidate: true,
                oc1: { select: { name: true } },
                reviewer1: { select: { name: true } },
                oc2: { select: { name: true } },
            },
        });

        if (!interview) return res.status(404).json({ error: 'Interview not found' });

        const candidate = interview.candidate;
        if (!candidate || !candidate.email) {
            return res.status(400).json({ error: 'Candidate email not available' });
        }

        // Build email content using startTime and endTime from Prisma schema
        const startDate = interview.startTime ? new Date(interview.startTime) : null;
        const endDate = interview.endTime ? new Date(interview.endTime) : null;

        const start = startDate ? startDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'TBD';
        const end = endDate ? endDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'TBD';

        const panelPartner = interview.reviewer1?.name || interview.oc2?.name || '';
        const panel = panelPartner ? `${interview.oc1.name} & ${panelPartner}` : interview.oc1.name;

        const subject = `ISMP Interview Confirmation`;
        const text = `Hello ${candidate.name || ''},\n\nYour ISMP interview has been scheduled.\n\nDate & Time: ${start} – ${end}\nPanel: ${panel}\n\nPlease be on time.\n\nBest regards,\nISMP Team`;
        const html = `<p>Hello ${candidate.name || ''},</p>
      <p>Your ISMP interview has been scheduled.</p>
      <ul>
        <li><strong>From:</strong> ${start}</li>
        <li><strong>To:</strong> ${end}</li>
        <li><strong>Panel:</strong> ${panel}</li>
      </ul>
      <p>Please be on time.</p>
      <p>Best regards,<br/>ISMP Team</p>`;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: candidate.email,
            subject,
            text,
            html,
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('send-email error:', err);
        return res.status(500).json({ error: 'Failed to send email', details: err.message });
    }
}
