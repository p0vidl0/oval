/** Общие примитивы разметки страниц: вместо повторяющихся inline-стилей. */
import Link from "next/link";
import type { ReactNode } from "react";

/** «← Раздел» над заголовком страницы. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="caption nl-back-link">
      ← {children}
    </Link>
  );
}

/** Вторичный текст (`--ink-muted`). */
export function Muted({
  as: Tag = "span",
  className,
  children,
}: {
  as?: "span" | "p" | "div";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className ? `nl-muted ${className}` : "nl-muted"}>
      {children}
    </Tag>
  );
}

/** Ожидаемая ошибка рядом с формой или действием. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="caption nl-error-text" role="alert">
      {children}
    </p>
  );
}

/** Заголовок страницы: ссылка назад, h1, строка мета и действия справа. */
export function PageHeader({
  title,
  back,
  meta,
  actions,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      <header className="nl-page-header">
        <div className="nl-page-header__main">
          <h1 className="nl-page-title nl-page-title--admin nl-page-header__title">
            {title}
          </h1>
          {meta ? <div className="nl-page-header__meta">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="nl-page-header__actions">{actions}</div>
        ) : null}
      </header>
    </>
  );
}

/** Блок страницы с подписью. */
export function Section({
  title,
  aside,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="nl-section">
      {title || aside ? (
        <div className="nl-section__head">
          {title ? <h2 className="nl-label">{title}</h2> : null}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Строка списка: заголовок и мета слева, статус и действия справа. */
export function ListRow({
  title,
  meta,
  aside,
  muted,
  searchText,
}: {
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  /** Закрытая / неактивная строка. */
  muted?: boolean;
  /** Текст для клиентского поиска (`ParticipantsSearch`), в нижнем регистре. */
  searchText?: string;
}) {
  return (
    <li
      className={muted ? "nl-list-row nl-list-row--muted" : "nl-list-row"}
      data-search={searchText}
    >
      <div className="nl-list-row__main">
        <div className="nl-list-row__title">{title}</div>
        {meta ? <div className="nl-list-row__meta">{meta}</div> : null}
      </div>
      {aside ? <div className="nl-list-row__aside">{aside}</div> : null}
    </li>
  );
}

export function ListRows({ children }: { children: ReactNode }) {
  return <ul className="nl-list-rows">{children}</ul>;
}
