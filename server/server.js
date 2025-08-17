import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import Groq from 'groq-sdk';

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- LLM client (Groq only) ---
if (!process.env.GROQ_API_KEY) {
  throw new Error('Missing GROQ_API_KEY – set it in your environment variables.');
}
const llmClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.MODEL || 'llama-3.1-70b-versatile';

const systemPrompt = `You are a world-class meeting-notes summarizer. Given a raw transcript and a user instruction, produce a structured, factual summary. Always include:
- Title
- Participants (if present)
- Date (if present)
- TL;DR (3–5 bullets)
- Key Points (bulleted)
- Decisions
- Action Items (with owner and due date if available)
- Risks/Notes
Keep it concise, neutral, and do not invent facts.`;

// --- Summarization Endpoint ---
app.post('/api/summarize', async (req, res) => {
  try {
    const schema = z.object({
      transcript: z.string().min(1),
      instruction: z.string().default('Summarize clearly with decisions and action items.')
    });
    const { transcript, instruction } = schema.parse(req.body);

    const userPrompt = `Instruction: ${instruction}\n\nTranscript:\n${transcript}`;

    const resp = await llmClient.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = resp.choices?.[0]?.message?.content || '';
    res.json({ summary: content });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to summarize' });
  }
});

// --- Email Endpoint ---
app.post('/api/send-email', async (req, res) => {
  try {
    const schema = z.object({
      recipients: z.array(z.string().email()).min(1),
      subject: z.string().default('Meeting Summary'),
      html: z.string().min(1),
      text: z.string().optional()
    });
    const { recipients, subject, html, text } = schema.parse(req.body);

    let transporter;
    const provider = (process.env.MAIL_PROVIDER || 'ethereal').toLowerCase();

    if (provider === 'gmail') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
    } else if (provider === 'mailtrap') {
      transporter = nodemailer.createTransport({
        host: 'smtp.mailtrap.io',
        port: 587,
        auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
    }

    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'no-reply@summarizer.local',
      to: recipients.join(','),
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    res.json({ ok: true, messageId: info.messageId, previewUrl });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to send email' });
  }
});

// --- Serve frontend build (AFTER APIs) ---
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
