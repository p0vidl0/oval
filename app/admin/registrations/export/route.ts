import { NextResponse } from "next/server";
import {
  participantsCsv,
  participantsExportFilename,
} from "@/lib/admin/participants-export";
import { can } from "@/lib/auth/capabilities";
import { getServerSession } from "@/lib/auth/session";
import { listParticipantsForExport } from "@/lib/training/admin-queries";

export async function GET() {
  const session = await getServerSession();
  if (
    !session ||
    !can(session.user.role as string | undefined, "admin.access")
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rows = await listParticipantsForExport();
  const filename = participantsExportFilename(new Date());
  return new NextResponse(participantsCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
