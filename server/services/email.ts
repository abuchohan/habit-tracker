import { Resend } from 'resend';
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.EMAIL_FROM || 'Habits <onboarding@resend.dev>', to,
    subject: 'Reset your Habits password', text: `Reset your password using this link (valid for 15 minutes):\n\n${resetLink}\n\nIf you did not request this, ignore this email.` });
  if (result.error) throw new Error('Email delivery failed');
}
