import { TrainingFields } from "@/components/admin/training-fields";
import { updateTrainingSettingsAction } from "@/lib/admin/session-actions";
import { formatDateTimeRu } from "@/lib/format/datetime";
import type { getAdminSession } from "@/lib/training/admin-queries";
import { canEditScheduleDirectly } from "@/lib/training/session-service";

export async function SettingsTab({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>["session"];
}) {
  const scheduleEditable = await canEditScheduleDirectly(session.id);
  return (
    <section className="nl-admin-settings">
      <form action={updateTrainingSettingsAction} className="nl-field">
        <input type="hidden" name="session_id" value={session.id} />
        <TrainingFields values={session} scheduleEditable={scheduleEditable} />
        {!scheduleEditable ? (
          <p className="caption nl-muted">
            Дата и время: {formatDateTimeRu(session.startsAt)}. Чтобы изменить —
            «Перенести…» (участники увидят пост о переносе).
          </p>
        ) : null}
        <button type="submit" className="nl-button nl-button--primary">
          Сохранить параметры
        </button>
      </form>
    </section>
  );
}
