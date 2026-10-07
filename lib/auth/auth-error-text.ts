/** Ошибки Better Auth (email OTP) — на русском для формы входа. */
const MESSAGES: Record<string, string> = {
  INVALID_OTP: "Неверный код. Проверьте письмо и попробуйте ещё раз.",
  OTP_EXPIRED: "Код устарел — запросите новый.",
  TOO_MANY_ATTEMPTS: "Слишком много попыток — запросите новый код.",
  INVALID_EMAIL: "Введите корректный email.",
};

export function authErrorText(
  error: { code?: string; status?: number } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  if (error.status === 429) {
    return "Слишком много запросов. Подождите минуту и попробуйте снова.";
  }
  return (error.code && MESSAGES[error.code]) || fallback;
}
