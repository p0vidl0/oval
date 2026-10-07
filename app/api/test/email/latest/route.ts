import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/email";
import { getLatestEmailOtp } from "@/lib/email/recording-store";
import { isTestApiEnabled } from "@/lib/test-api";

export async function GET(request: Request) {
  if (!isTestApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const emailRaw = url.searchParams.get("email");
  if (!emailRaw) {
    return NextResponse.json(
      { error: "email query required" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(emailRaw) ?? emailRaw.trim().toLowerCase();
  const record = getLatestEmailOtp(email);
  if (!record) {
    return NextResponse.json({ error: "no otp" }, { status: 404 });
  }

  return NextResponse.json({
    email: record.email,
    code: record.code,
  });
}
