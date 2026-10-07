import Link from "next/link";
import { NlHeaderUserIcon } from "@/components/nl/header-user-icon";
import { NlLogo } from "@/components/nl/logo";
import {
  NlTabIconAdmin,
  NlTabIconCabinet,
  NlTabIconFeed,
} from "@/components/nl/tab-icons";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { userHeaderDisplay } from "@/lib/auth/user-display";

export async function NlShell({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab?: "feed" | "cabinet" | "admin";
}) {
  const session = await getServerSession();
  const role = session?.user.role as string | undefined;
  const isAdmin = canAccessAdmin(role);
  const { initials, label, isEmail } = userHeaderDisplay({
    name: session?.user.name,
    email: session?.user.email,
  });

  const showFeedLink =
    Boolean(session) && (tab === "cabinet" || tab === "admin");
  const showAdminLink =
    Boolean(session) && isAdmin && (tab === "feed" || tab === "cabinet");

  const userPill = session ? (
    <Link
      href="/cabinet"
      className="nl-header__user-pill"
      aria-current={tab === "cabinet" ? "page" : undefined}
      title={session.user.email}
    >
      <span className="nl-header__user-pill-avatar nl-mono">{initials}</span>
      <span
        className={`nl-header__user-pill-name${isEmail ? " nl-header__user-pill-name--email" : ""}`}
      >
        {label}
      </span>
    </Link>
  ) : null;

  return (
    <>
      <header className="nl-header">
        <div className="nl-header__inner">
          <div className="nl-header__brand-group">
            <NlLogo />
          </div>
          <nav className="nl-header__nav" aria-label="Основное">
            {!session ? (
              <Link
                href="/login"
                className="nl-button nl-button--sm nl-header__sign-in"
              >
                <NlHeaderUserIcon />
                <span>Войти</span>
              </Link>
            ) : (
              <>
                {showFeedLink ? (
                  <Link href="/feed" className="nl-header__nav-link">
                    Лента
                  </Link>
                ) : null}
                {showAdminLink ? (
                  <Link href="/admin/posts" className="nl-header__nav-link">
                    Админ
                  </Link>
                ) : null}
                {userPill}
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="nl-tabbar-desktop-hide flex flex-1 flex-col">
        {children}
      </div>
      <nav className="nl-tabbar" aria-label="Разделы">
        <Link
          href="/feed"
          className="nl-tab"
          aria-current={tab === "feed" ? "page" : undefined}
        >
          <NlTabIconFeed />
          <span>Лента</span>
        </Link>
        <Link
          href={session ? "/cabinet" : "/login?next=/cabinet"}
          className="nl-tab"
          aria-current={tab === "cabinet" ? "page" : undefined}
        >
          <NlTabIconCabinet />
          <span>Кабинет</span>
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/posts"
            className="nl-tab"
            aria-current={tab === "admin" ? "page" : undefined}
          >
            <NlTabIconAdmin />
            <span>Админ</span>
          </Link>
        ) : null}
      </nav>
    </>
  );
}
