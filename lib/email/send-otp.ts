import {
  checkOtpSendAllowed,
  otpSendLimitsEnabled,
  recordOtpSend,
} from "@/lib/email/otp-send-limits";
import { recordEmailOtp } from "@/lib/email/recording-store";
import { persistTestEmailOtp } from "@/lib/email/test-otp-persist";

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

  if (provider === "recording" || process.env.OVAL_TEST_API === "1") {
    recordEmailOtp(email, otp);
    await persistTestEmailOtp(email, otp);
    if (provider === "recording") {
      return;
    }
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
    const limitsOn = otpSendLimitsEnabled();
    void sendViaSmtp(email, subject, text)
      .then(async () => {
        if (limitsOn) await recordOtpSend(email);
      })
      .catch((error: unknown) => {
        console.error("[email smtp] send failed", error);
      });
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
