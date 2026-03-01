import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Ensure these env vars are set in .env:
// SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { interviewId } = req.body || {};

    if (!interviewId) {
        return res.status(400).json({ error: 'Provide interviewId in body' });
    }

    try {
        const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            include: { candidate: true },
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

        const subject = `Interview Scheduled: ${start}`;
        const text = `Hello ${candidate.name || ''},\n\nYour interview is scheduled from ${start} to ${end}.\n\nPlease be on time.\n\nBest regards.`;
        const html = `<p>Hello ${candidate.name || ''},</p>
      <p>Your interview is scheduled from <strong>${start}</strong> to <strong>${end}</strong>.</p>
      <p>Please be on time.</p>
      <p>Best regards.</p>`;

        // Configure SMTP transporter
        const transportOptions = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            secure: false, // IMPORTANT: false for STARTTLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },                         
        };

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            transportOptions.auth = {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            };
        }

        const transporter = nodemailer.createTransport(transportOptions);

        await transporter.verify();

        const info = await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
            to: candidate.email,
            subject,
            text,
            html,
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('send-email error:', err);
        return res.status(500).json({ error: 'Failed to send email', details: err.message });
    } finally {
        await prisma.$disconnect();
    }
}
