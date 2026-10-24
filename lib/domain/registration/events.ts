import type { db } from "@/lib/db/client";
import {
  type registrationEventKindEnum,
  registrationEvents,
} from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RegistrationEventKind =
  (typeof registrationEventKindEnum.enumValues)[number];

export type RegistrationEventInput = {
  registrationId: string;
  sessionId: string;
  kind: RegistrationEventKind;
  payload?: Record<string, unknown>;
  actorUserId: string | null;
};

/** Пишется в той же транзакции, что и изменение записи. */
export async function insertRegistrationEvents(
  tx: Tx,
  events: RegistrationEventInput[],
) {
  if (events.length === 0) return;
  await tx.insert(registrationEvents).values(
    events.map((event) => ({
      id: crypto.randomUUID(),
      registrationId: event.registrationId,
      sessionId: event.sessionId,
      kind: event.kind,
      payload: event.payload ?? {},
      actorUserId: event.actorUserId,
    })),
  );
}
