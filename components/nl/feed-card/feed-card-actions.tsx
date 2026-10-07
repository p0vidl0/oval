import Link from "next/link";
import type { FeedCardActions } from "@/components/nl/feed-card/types";

type Props = {
  actions: FeedCardActions;
  previewMode?: boolean;
};

export function FeedCardActionsBlock({ actions, previewMode }: Props) {
  const onPreviewClick = previewMode
    ? (e: React.MouseEvent) => e.preventDefault()
    : undefined;

  return (
    <div className="nl-card__actions">
      {actions.registerForm}
      {actions.registerHref ? (
        <Link
          href={actions.registerHref}
          className="nl-button nl-button--primary"
          onClick={onPreviewClick}
          aria-disabled={previewMode ? true : undefined}
        >
          Записаться
        </Link>
      ) : null}
      {actions.payHref ? (
        <Link
          href={actions.payHref}
          className="nl-button"
          onClick={onPreviewClick}
          aria-disabled={previewMode ? true : undefined}
        >
          {actions.payLabel ?? "Оплатить"}
        </Link>
      ) : null}
      {actions.externalHref ? (
        <a
          href={actions.externalHref}
          className="nl-button nl-button--primary"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onPreviewClick}
        >
          {actions.externalLabel ?? "Регламент и регистрация"}
        </a>
      ) : null}
      {actions.trainingHref ? (
        <Link
          href={actions.trainingHref}
          className="nl-button"
          onClick={onPreviewClick}
        >
          К тренировке
        </Link>
      ) : null}
      {actions.cancelForm}
    </div>
  );
}
