const mailslurperApiBaseUrl =
  process.env.MAILSLURPER_API_BASE_URL ??
  `http://localhost:${process.env.MAILSLURPER_API_HOST_PORT ?? "14437"}`;

type MailslurperMailItem = {
  id: string;
  dateSent?: string;
  subject?: string;
  body?: string;
  toAddresses?: string[];
};

type MailslurperMailListResponse = {
  mailItems?: MailslurperMailItem[];
};

async function fetchMailItems(email: string): Promise<MailslurperMailItem[]> {
  const query = new URLSearchParams({
    to: email,
    pageNumber: "1",
  });
  const response = await fetch(
    `${mailslurperApiBaseUrl}/mail?${query.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      `MailSlurper API ${response.status} at ${mailslurperApiBaseUrl}`,
    );
  }
  const data = (await response.json()) as MailslurperMailListResponse;
  return [...(data.mailItems ?? [])].sort((a, b) =>
    (b.dateSent ?? "").localeCompare(a.dateSent ?? ""),
  );
}

function extractCodeFromMail(item: MailslurperMailItem): string | null {
  const subject = item.subject ?? "";
  const subjectMatch = subject.match(/\b(\d{6})\b/);
  if (subjectMatch) return subjectMatch[1];
  const body = item.body ?? "";
  const bodyMatch = body.match(/\b(\d{6})\b/);
  return bodyMatch?.[1] ?? null;
}

async function fetchLatestCodeBySubject(
  email: string,
  subjectIncludes: string,
  options?: { timeoutMs?: number; baselineCount?: number },
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  const subjectNeedle = subjectIncludes.toLowerCase();
  const baselineCount = options?.baselineCount ?? 0;

  while (Date.now() < deadline) {
    const items = await fetchMailItems(email);
    const matching = items.filter((item) => {
      const subject = item.subject ?? "";
      return (
        subject.toLowerCase().includes(subjectNeedle) &&
        extractCodeFromMail(item) !== null
      );
    });
    if (matching.length > baselineCount) {
      const code = extractCodeFromMail(matching[0]);
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`OTP email not received for ${email}`);
}

/** Oval auth OTP subject: «Код входа в Ночную Лигу». */
export async function fetchLatestAuthOtp(
  email: string,
  options?: { timeoutMs?: number; baselineCount?: number },
): Promise<string> {
  return fetchLatestCodeBySubject(email, "ночную", options);
}

/** Count matching auth OTP messages already in the inbox (skip on resend). */
export async function countAuthOtpMails(email: string): Promise<number> {
  const items = await fetchMailItems(email);
  return items.filter((item) =>
    (item.subject ?? "").toLowerCase().includes("ночную"),
  ).length;
}
