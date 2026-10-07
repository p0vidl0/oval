import nodemailer from "nodemailer";

function smtpTransportOptions() {
  const host = process.env.SMTP_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT ?? "1025");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || "oval@localhost.localdomain";

  const secureExplicit = process.env.SMTP_SECURE?.trim();
  const secure =
    secureExplicit === "1"
      ? true
      : secureExplicit === "0"
        ? false
        : port === 465;

  const localDevRelay = host === "127.0.0.1" && port === 1025;

  return {
    from,
    options: {
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      ...(localDevRelay ? { tls: { rejectUnauthorized: false } } : {}),
    },
  };
}

export async function sendViaSmtp(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const { from, options } = smtpTransportOptions();
  const transporter = nodemailer.createTransport(options);
  await transporter.sendMail({ from, to, subject, text });
}
