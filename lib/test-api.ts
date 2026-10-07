/** Gate for /api/test/* helpers (integration / e2e only). */
export function isTestApiEnabled(): boolean {
  return (
    process.env.OVAL_TEST_API === "1" || process.env.OVAL_TEST_SMS_API === "1"
  );
}
