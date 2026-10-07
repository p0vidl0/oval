import {
  checkOtpSendAllowed,
  otpSendLimitsEnabled,
  recordOtpSend,
} from "@/lib/email/otp-send-limits";
import { recordEmailOtp } from "@/lib/email/recording-store";

function authEmailContent(otp: string): { subject: string; text: string } {
  return {
    subject: "Код входа в Ночную Лигу",
    text: `Ваш персональный код: ${otp}\n\nЕсли вы не запрашивали код, проигнорируйте это письмо.`,
  };
}

/** Deliver sign-in OTP by email (stub / recording / SMTP). */
export async function sendAuthEmailOtp(
  email: string,
  otp: string,
): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER?.trim() || "stub";
  const { subject, text } = authEmailContent(otp);

  if (provider === "recording") {
    recordEmailOtp(email, otp);
    return;
  }

  if (provider === "smtp") {
    if (otpSendLimitsEnabled()) {
      const gate = await checkOtpSendAllowed(email);
      if (!gate.allowed) {
        console.warn(
          `[email otp limit] blocked send reason=${gate.reason} email=${email}`,
        );
        return;
      }
    }
    const { sendViaSmtp } = await import("@/lib/email/send-via-smtp");
    await sendViaSmtp(email, subject, text);
    if (otpSendLimitsEnabled()) {
      await recordOtpSend(email);
    }
    return;
  }

  if (provider === "stub" || process.env.NODE_ENV === "development") {
    console.info(`[email stub] ${email} → OTP ${otp}`);
    return;
  }

  throw new Error(
    "Email provider is not configured (set EMAIL_PROVIDER=smtp or use development)",
  );
}
