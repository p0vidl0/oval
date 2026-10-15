import { NextResponse } from "next/server";
import { isTestApiEnabled } from "@/lib/test-api";
import { type E2eSeedScenario, seedE2eScenario } from "@/lib/test-api/e2e-seed";

const SCENARIOS: E2eSeedScenario[] = [
  "email-merge-victim",
  "admin-payment-conflict",
  "admin-merge-success",
];

export async function POST(request: Request) {
  if (!isTestApiEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { scenario?: string; runId?: string };
  try {
    body = (await request.json()) as { scenario?: string; runId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scenario = body.scenario as E2eSeedScenario | undefined;
  if (!scenario || !SCENARIOS.includes(scenario)) {
    return NextResponse.json(
      { error: "scenario required", allowed: SCENARIOS },
      { status: 400 },
    );
  }

  const runId =
    typeof body.runId === "string" && body.runId.trim()
      ? body.runId.trim()
      : crypto.randomUUID();

  try {
    const result = await seedE2eScenario(scenario, runId);
    return NextResponse.json({ runId, ...result });
  } catch (error) {
    console.error("[test/e2e/seed]", error);
    return NextResponse.json({ error: "seed failed" }, { status: 500 });
  }
}
