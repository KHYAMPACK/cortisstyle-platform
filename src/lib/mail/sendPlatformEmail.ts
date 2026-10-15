import { Resend } from "resend";

const DEFAULT_FROM = "Cortisstyle <noreply@cortisstyle.com>";

function getResendApiKey(): string | null {
  return (
    process.env.RESEND_API_KEY?.trim() ||
    // Legacy/local alias some envs used during setup
    process.env.RESEND_API_KEY_PERVIN_SOYSAL_BUTIK?.trim() ||
    null
  );
}

export function isPlatformMailConfigured(): boolean {
  return Boolean(getResendApiKey());
}

export function getAuthEmailFrom(): string {
  return (
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_FROM
  );
}

export async function sendPlatformEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional From display name; address stays on the platform domain. */
  fromName?: string;
  /** Where a reply goes — a store's own support address, since the sender is the platform's. */
  replyTo?: string;
}): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Add it to send branded auth emails.",
    );
  }

  const baseFrom = getAuthEmailFrom();
  const emailMatch = baseFrom.match(/<([^>]+)>/);
  const address = emailMatch?.[1]?.trim() || baseFrom.replace(/^.*\s+/, "").trim();
  const from =
    input.fromName?.trim()
      ? `${input.fromName.trim()} <${address}>`
      : baseFrom;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo?.trim() ? { replyTo: input.replyTo.trim() } : {}),
  });

  if (error) {
    throw new Error(error.message || "Failed to send email.");
  }
}
