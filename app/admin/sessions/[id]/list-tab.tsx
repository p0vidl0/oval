import { ParticipantsSearch } from "@/components/admin/participants-search";
import { RestNoShowButton } from "@/components/admin/rest-no-show-button";
import {
  RefundAllForm,
  TransferAllDialog,
} from "@/components/admin/session-dialogs";
import { SessionParticipantsList } from "@/components/admin/session-participants-list";
import { WalkInDialog } from "@/components/admin/walk-in-dialog";
import { FilterNav } from "@/components/nl/filter-nav";
import {
  refundAllPaidAction,
  transferAllPaidAction,
} from "@/lib/admin/session-actions";
import { canMarkAttendance } from "@/lib/domain/attendance/rules";
import type { DescribeRegistrationInput } from "@/lib/domain/registration/describe";
import { formatShortListDate, formatTimeHm } from "@/lib/format/datetime";
import {
  listSessionRegistrationsAdmin,
  listTransferTargets,
  PARTICIPANTS_FILTERS,
  type ParticipantsFilter,
} from "@/lib/training/admin-queries";
import { tabHref } from "./tabs";

export type ParticipantsSession = DescribeRegistrationInput["session"] & {
  id: string;
  currency: string;
};

type Counts = {
  taken: number;
  marked: number;
  attended: number;
  paidMoney: number;
};

export async function ListTab({
  session,
  isCancelled,
  counts,
  filter,
  attendanceLate,
}: {
  session: ParticipantsSession;
  isCancelled: boolean;
  counts: Counts;
  filter: ParticipantsFilter;
  attendanceLate: boolean;
}) {
  const paidCount = counts.paidMoney;
  const now = new Date();
  const markingOpen = canMarkAttendance({
    registration: { status: "active" },
    session,
    now,
    late: attendanceLate,
  }).ok;
  const unmarked = counts.taken - counts.marked;
  const sessionId = session.id;
  const [rows, targets] = await Promise.all([
    listSessionRegistrationsAdmin(sessionId, filter),
    listTransferTargets(sessionId),
  ]);
  const filterHref = (key: ParticipantsFilter) =>
    tabHref(sessionId, "list", key === "active" ? {} : { filter: key });
  const transferTargets = targets.map((t) => ({
    sessionId: t.id,
    label: `${formatShortListDate(t.startsAt)} · ${formatTimeHm(t.startsAt)} — ${t.title}`,
  }));

  return (
    <section>
      <FilterNav
        label="Фильтр участников"
        value={filterHref(filter)}
        options={PARTICIPANTS_FILTERS.map((f) => ({
          href: filterHref(f.key),
          label: f.label,
        }))}
      />

      <div className="nl-participants-toolbar">
        <span className="nl-mono data-sm">
          {markingOpen || counts.marked > 0
            ? `отмечено ${counts.marked} из ${counts.taken} · пришли ${counts.attended}`
            : `записано ${counts.taken}`}
          {session.priceCents > 0 ? ` · оплатили ${counts.paidMoney}` : ""}
        </span>
        {markingOpen ? (
          <div className="nl-participants-toolbar__actions">
            {now >= session.startsAt && unmarked > 0 ? (
              <RestNoShowButton sessionId={sessionId} count={unmarked} />
            ) : null}
            <WalkInDialog sessionId={sessionId} />
          </div>
        ) : null}
      </div>

      {isCancelled && paidCount > 0 ? (
        <div className="nl-admin-callout nl-admin-callout--row">
          <p className="caption">
            Тренировка отменена, оплатили {paidCount}. Оформите возврат или
            перенесите оплату на другую тренировку.
          </p>
          <div className="nl-admin-callout__actions">
            <RefundAllForm
              sessionId={sessionId}
              paidCount={paidCount}
              action={refundAllPaidAction}
            />
            <TransferAllDialog
              sessionId={sessionId}
              paidCount={paidCount}
              targets={transferTargets}
              action={transferAllPaidAction}
            />
          </div>
        </div>
      ) : null}

      <ParticipantsSearch>
        <SessionParticipantsList
          sessionId={sessionId}
          session={session}
          rows={rows}
          transferTargets={transferTargets}
          attendanceLate={attendanceLate}
        />
      </ParticipantsSearch>
    </section>
  );
}
