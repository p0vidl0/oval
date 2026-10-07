"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { PhotoPicker } from "@/components/admin/photo-picker";
import {
  PREVIEW_CARD_WIDTH,
  ScaledPreview,
} from "@/components/admin/scaled-preview";
import { TrainingFields } from "@/components/admin/training-fields";
import { NlFeedPostCard } from "@/components/nl/feed-card";
import type { FeedCardProps } from "@/components/nl/feed-card/types";
import type { GalleryImage } from "@/components/nl/photo-gallery";
import {
  type PreviewTrainingValues,
  type PublicationPreviewExistingImage,
  readPublicationFormSnapshot,
  snapshotToFeedCardProps,
} from "@/lib/admin/publication-preview";
import { maxImagesForPostType } from "@/lib/feed/post-image-limits";
import {
  FEED_POST_TYPE_LABELS,
  type FeedPostStatus,
  type FeedPostType,
} from "@/lib/feed/types";
import {
  formatDateInput,
  formatDateTimeRu,
  formatTimeInput,
} from "@/lib/format/datetime";

type PostSlice = {
  id: string;
  type: FeedPostType;
  title: string;
  body: string;
  status: FeedPostStatus;
  /** Время выхода, если публикация отложена (вычисляется на сервере). */
  scheduledAt: Date | null;
  pinned: boolean;
};

/** Тренировка для превью анонса (поля тренировки в форме не редактируются). */
export type EditorTraining = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  gatherAt: Date | null;
  capacity: number | null;
  priceCents: number;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
};

/**
 * - `news` — новость (создание) или любой пост без полей тренировки (правка);
 * - `announcement` — анонс к существующей тренировке;
 * - `training` — создание тренировки вместе с анонсом.
 */
export type PublicationEditorMode = "news" | "announcement" | "training";

type Props = {
  action: (formData: FormData) => Promise<void>;
  mode: PublicationEditorMode;
  post?: PostSlice;
  training?: EditorTraining | null;
  existingImages?: PublicationPreviewExistingImage[];
};

type Viewport = "desktop" | "mobile";

const EMPTY_EXISTING_IMAGES: PublicationPreviewExistingImage[] = [];

type SubmitAction = "save" | "publish" | "schedule" | "draft" | "unpublish";

const CONFIRM_PUBLISH =
  "Опубликовать запись в ленте? Участники увидят её после публикации.";
const CONFIRM_UNPUBLISH =
  "Снять с публикации? Запись исчезнет из ленты, но останется в админке.";
const CONFIRM_UNSCHEDULE =
  "Отменить отложенную публикацию? Запись станет черновиком.";

const DEFAULT_PUBLISH_TIME = "10:00";

/** Поля даты/времени обязательны только для кнопки «Запланировать». */
function setScheduleRequired(form: HTMLFormElement | null, required: boolean) {
  for (const name of ["publish_date", "publish_time"]) {
    const el = form?.elements.namedItem(name);
    if (el instanceof HTMLInputElement) el.required = required;
  }
}

function PublicationEditorActions({
  mode,
  postStatus,
  scheduledAt,
  canSchedule,
}: {
  mode: PublicationEditorMode;
  postStatus?: FeedPostStatus;
  /** Время отложенной публикации, если пост запланирован. */
  scheduledAt: Date | null;
  /** Показывать блок «Отложенная публикация». */
  canSchedule: boolean;
}) {
  const { pending } = useFormStatus();
  const [activeAction, setActiveAction] = useState<SubmitAction | null>(null);

  useEffect(() => {
    if (!pending) setActiveAction(null);
  }, [pending]);

  const renderButton = (
    action: SubmitAction,
    label: ReactNode,
    pendingLabel: string,
    className: string,
    confirmMessage?: string,
  ) => {
    const isActive = pending && activeAction === action;
    return (
      <button
        key={action}
        type="submit"
        name="submit_action"
        value={action}
        className={`${className}${isActive ? " nl-button--pending" : ""}`.trim()}
        disabled={pending}
        aria-busy={isActive}
        onClick={(e) => {
          setScheduleRequired(e.currentTarget.form, action === "schedule");
          if (confirmMessage && !window.confirm(confirmMessage)) {
            e.preventDefault();
            return;
          }
          setActiveAction(action);
        }}
      >
        {isActive ? (
          <>
            <span className="nl-button__spinner" aria-hidden="true" />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </button>
    );
  };

  const isScheduled = postStatus === "published" && scheduledAt !== null;
  const isLive = postStatus === "published" && !isScheduled;

  const buttons: ReactNode[] = [];
  if (postStatus) {
    buttons.push(
      renderButton(
        "save",
        "Сохранить",
        "Сохраняем…",
        "nl-button nl-button--primary",
      ),
    );
    if (isLive) {
      buttons.push(
        renderButton(
          "unpublish",
          "Снять с публикации",
          "Сохраняем…",
          "nl-button",
          CONFIRM_UNPUBLISH,
        ),
      );
    } else if (isScheduled) {
      buttons.push(
        renderButton(
          "publish",
          "Опубликовать сейчас",
          "Публикуем…",
          "nl-button",
          CONFIRM_PUBLISH,
        ),
        renderButton(
          "draft",
          "Отменить публикацию",
          "Сохраняем…",
          "nl-button",
          CONFIRM_UNSCHEDULE,
        ),
      );
    } else {
      buttons.push(
        renderButton(
          "publish",
          postStatus === "unpublished"
            ? "Вернуть в публикацию"
            : "Опубликовать",
          "Публикуем…",
          "nl-button",
          CONFIRM_PUBLISH,
        ),
      );
    }
  } else if (mode === "training") {
    buttons.push(
      renderButton(
        "publish",
        "Создать и опубликовать анонс",
        "Создаём…",
        "nl-button nl-button--primary",
      ),
      renderButton(
        "draft",
        "Создать, анонс — черновиком",
        "Создаём…",
        "nl-button",
      ),
    );
  } else {
    buttons.push(
      renderButton(
        "publish",
        "Опубликовать",
        "Публикуем…",
        "nl-button nl-button--primary",
      ),
      renderButton("draft", "Сохранить черновик", "Сохраняем…", "nl-button"),
    );
  }

  const showSchedule = canSchedule && !isLive;

  return (
    <>
      {showSchedule ? (
        <fieldset className="nl-admin-schedule">
          <legend className="nl-label">Отложенная публикация</legend>
          {isScheduled && scheduledAt ? (
            <p className="caption" style={{ margin: 0 }}>
              Выйдет в ленту {formatDateTimeRu(scheduledAt)}.
            </p>
          ) : null}
          <div className="nl-admin-schedule__row">
            <label className="nl-label" htmlFor="publish_date">
              Дата
              <input
                id="publish_date"
                name="publish_date"
                type="date"
                className="nl-input nl-input--mono"
                defaultValue={scheduledAt ? formatDateInput(scheduledAt) : ""}
              />
            </label>
            <label className="nl-label" htmlFor="publish_time">
              Время
              <input
                id="publish_time"
                name="publish_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={
                  scheduledAt
                    ? formatTimeInput(scheduledAt)
                    : DEFAULT_PUBLISH_TIME
                }
              />
            </label>
            {renderButton(
              "schedule",
              isScheduled
                ? "Изменить время"
                : mode === "training" && !postStatus
                  ? "Создать и запланировать анонс"
                  : "Запланировать",
              "Сохраняем…",
              "nl-button",
            )}
          </div>
        </fieldset>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        {buttons}
      </div>
    </>
  );
}

function trainingPreviewValues(
  training: EditorTraining,
): PreviewTrainingValues {
  return {
    startsAt: training.startsAt,
    endsAt: training.endsAt,
    gatherAt: training.gatherAt,
    capacity: training.capacity,
    priceRub: Math.round(training.priceCents / 100),
    registrationEnabled: training.registrationEnabled,
    onlinePaymentEnabled: training.onlinePaymentEnabled,
  };
}

export function PublicationEditor({
  action,
  mode,
  post,
  training,
  existingImages = EMPTY_EXISTING_IMAGES,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [withAnnouncement, setWithAnnouncement] = useState(true);
  const [pendingUploads, setPendingUploads] = useState<GalleryImage[]>([]);

  const effectiveType: FeedPostType =
    post?.type ?? (mode === "news" ? "news" : "training_announcement");
  const maxImages = maxImagesForPostType(effectiveType);
  const fixedTraining = useMemo(
    () =>
      mode !== "training" && training ? trainingPreviewValues(training) : null,
    [mode, training],
  );

  const initialPreview = useMemo((): FeedCardProps => {
    return snapshotToFeedCardProps({
      postType: effectiveType,
      title: post?.title ?? "",
      body: post?.body ?? "",
      pinned: post?.pinned ?? false,
      startsAt: null,
      endsAt: null,
      gatherAt: null,
      capacity: null,
      priceRub: 0,
      registrationEnabled: false,
      onlinePaymentEnabled: false,
      ...fixedTraining,
      images: existingImages.map((img) => ({ src: img.src, alt: img.alt })),
    });
  }, [effectiveType, post, fixedTraining, existingImages]);

  const [previewProps, setPreviewProps] =
    useState<FeedCardProps>(initialPreview);

  const syncPreview = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const snapshot = readPublicationFormSnapshot(form, {
      postType: effectiveType,
      existingImages,
      pendingUploads,
      fixedTraining,
    });
    setPreviewProps(snapshotToFeedCardProps(snapshot));
  }, [effectiveType, existingImages, pendingUploads, fixedTraining]);

  useEffect(() => {
    syncPreview();
  }, [syncPreview]);

  const showPostFields = mode !== "training" || withAnnouncement;

  return (
    <div className="nl-admin-editor">
      <form
        ref={formRef}
        action={action}
        className="nl-field"
        style={{ gap: "var(--space-4)" }}
        onInput={syncPreview}
        onChange={(e) => {
          if (
            e.target instanceof HTMLInputElement &&
            e.target.name === "create_announcement"
          ) {
            setWithAnnouncement(e.target.checked);
          }
          syncPreview();
        }}
      >
        {post ? (
          <>
            <input type="hidden" name="post_id" value={post.id} />
            <p className="caption" style={{ color: "var(--ink-muted)" }}>
              Тип: {FEED_POST_TYPE_LABELS[post.type]}
            </p>
          </>
        ) : null}
        {!post && mode === "announcement" && training ? (
          <input type="hidden" name="session_id" value={training.id} />
        ) : null}

        {mode === "training" ? (
          <>
            <TrainingFields />
            <label className="nl-check">
              <input
                name="create_announcement"
                type="checkbox"
                defaultChecked
              />
              Создать анонс в ленте
            </label>
          </>
        ) : null}

        {showPostFields ? (
          <>
            <label className="nl-label" htmlFor="title">
              {mode === "training" ? "Заголовок анонса" : "Заголовок"}
              <input
                id="title"
                name="title"
                required={mode !== "training"}
                className="nl-input"
                defaultValue={post?.title ?? ""}
                placeholder={
                  mode === "training"
                    ? "По умолчанию — название тренировки"
                    : ""
                }
              />
            </label>
            <label className="nl-label" htmlFor="body">
              Текст
              <textarea
                id="body"
                name="body"
                rows={5}
                className="nl-input"
                defaultValue={post?.body ?? ""}
              />
            </label>

            <label className="nl-check">
              <input
                name="pinned"
                type="checkbox"
                defaultChecked={post?.pinned ?? false}
              />
              Закрепить вверху ленты
            </label>

            <PhotoPicker
              // После сохранения набор фото меняется — сбрасываем выбранные файлы.
              key={`photos-${effectiveType}-${existingImages.map((i) => i.id).join(",")}`}
              existing={existingImages}
              maxImages={maxImages}
              onChange={setPendingUploads}
            />
          </>
        ) : null}

        <PublicationEditorActions
          mode={mode}
          postStatus={post?.status}
          scheduledAt={post?.scheduledAt ?? null}
          canSchedule={
            showPostFields &&
            (effectiveType === "news" ||
              effectiveType === "training_announcement")
          }
        />
      </form>

      <aside className="nl-admin-editor__preview">
        <h2 className="nl-label" style={{ marginBottom: "var(--space-3)" }}>
          Так увидят в ленте
        </h2>
        <fieldset
          className="nl-chip-row"
          style={{
            border: 0,
            margin: "0 0 var(--space-4)",
            padding: 0,
          }}
        >
          <legend
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            Ширина preview
          </legend>
          <button
            type="button"
            className="nl-chip"
            aria-pressed={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
          >
            Десктоп
          </button>
          <button
            type="button"
            className="nl-chip"
            aria-pressed={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
          >
            Мобильный
          </button>
        </fieldset>
        <ScaledPreview width={PREVIEW_CARD_WIDTH[viewport]}>
          <NlFeedPostCard {...previewProps} />
        </ScaledPreview>
      </aside>
    </div>
  );
}
