import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const feedPostTypeEnum = pgEnum("feed_post_type", [
  "training_announcement",
  "training_cancelled",
  "training_rescheduled",
  "news",
  "race",
]);

export const feedPostStatusEnum = pgEnum("feed_post_status", [
  "draft",
  "published",
  "unpublished",
]);

export const feedPosts = pgTable(
  "feed_posts",
  {
    id: text("id").primaryKey(),
    type: feedPostTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    status: feedPostStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    relatedSessionId: text("related_session_id").references(
      () => trainingSessions.id,
      { onDelete: "restrict" },
    ),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    publishToTelegram: boolean("publish_to_telegram").notNull().default(false),
    publishToMax: boolean("publish_to_max").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("feed_posts_status_published_at_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("feed_posts_type_idx").on(table.type),
    index("feed_posts_related_session_idx").on(table.relatedSessionId),
    uniqueIndex("feed_posts_session_announcement_uidx")
      .on(table.relatedSessionId)
      .where(sql`${table.type} = 'training_announcement'`),
  ],
);

export const trainingSessionStatusEnum = pgEnum("training_session_status", [
  "scheduled",
  "cancelled",
]);

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("RUB"),
    capacity: integer("capacity").default(25),
    registrationOpensAt: timestamp("registration_opens_at", {
      withTimezone: true,
    }),
    registrationClosesAt: timestamp("registration_closes_at", {
      withTimezone: true,
    }),
    status: trainingSessionStatusEnum("status").notNull().default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    registrationEnabled: boolean("registration_enabled")
      .notNull()
      .default(true),
    onlinePaymentEnabled: boolean("online_payment_enabled")
      .notNull()
      .default(true),
    gatherAt: timestamp("gather_at", { withTimezone: true }),
    coachName: text("coach_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("training_sessions_starts_at_idx").on(table.startsAt)],
);

export const registrationStatusEnum = pgEnum("registration_status", [
  "pending_payment",
  "paid",
  "cancelled",
  "refunded",
  "transferred",
]);

/** Кто снял запись (для `status = cancelled`). */
export const registrationCancelSourceEnum = pgEnum(
  "registration_cancel_source",
  ["user", "admin", "session_cancelled"],
);

export const registrations = pgTable(
  "registrations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    trainingSessionId: text("training_session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "restrict" }),
    status: registrationStatusEnum("status")
      .notNull()
      .default("pending_payment"),
    cancelledBy: registrationCancelSourceEnum("cancelled_by"),
    transferredFromRegistrationId: text("transferred_from_registration_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("registrations_session_idx").on(table.trainingSessionId),
    index("registrations_user_idx").on(table.userId),
    uniqueIndex("registrations_user_session_active_uidx").on(
      table.userId,
      table.trainingSessionId,
    ),
  ],
);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "restrict" })
      .unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("RUB"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    externalId: text("external_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payments_user_idx").on(table.userId),
    index("payments_status_idx").on(table.status),
    index("payments_external_id_idx").on(table.externalId),
  ],
);

export const postImages = pgTable(
  "post_images",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => feedPosts.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull(),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Фото снято с поста; строку и файл не удаляем. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("post_images_post_id_idx").on(table.postId),
    index("post_images_storage_key_idx").on(table.storageKey),
  ],
);

export const paymentWebhookDeliveries = pgTable(
  "payment_webhook_deliveries",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    paymentId: text("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payment_webhook_deliveries_provider_idx").on(table.provider),
  ],
);

export const trainingSessionEventKindEnum = pgEnum(
  "training_session_event_kind",
  ["created", "updated", "rescheduled", "cancelled"],
);

/** Журнал изменений тренировки (независимо от того, опубликован ли пост). */
export const trainingSessionEvents = pgTable(
  "training_session_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "restrict" }),
    kind: trainingSessionEventKindEnum("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    postId: text("post_id").references(() => feedPosts.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("training_session_events_session_idx").on(
      table.sessionId,
      table.createdAt,
    ),
  ],
);

/** Audit of OTP emails sent via SMTP (rate-limit / quota protection). */
export const emailOtpSendLog = pgTable(
  "email_otp_send_log",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("email_otp_send_log_email_sent_at_idx").on(table.email, table.sentAt),
    index("email_otp_send_log_sent_at_idx").on(table.sentAt),
  ],
);
