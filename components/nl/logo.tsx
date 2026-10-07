import Image from "next/image";
import Link from "next/link";

type Props = {
  size?: number;
  showTitle?: boolean;
  href?: string;
};

export function NlLogo({ size = 48, showTitle = true, href = "/feed" }: Props) {
  const mark = (
    <span
      className="nl-logo-mark"
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "var(--ring-logo)",
        flexShrink: 0,
        background: "var(--bg)",
      }}
    >
      <Image
        src="/brand/nochnaya-liga-logo.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="nl-logo-mark__img"
        priority
      />
    </span>
  );

  const content = (
    <>
      {mark}
      {showTitle ? (
        <span className="nl-logo__text">
          <span className="nl-display nl-logo__title">Ночная лига</span>
        </span>
      ) : null}
    </>
  );

  return (
    <Link href={href} className="nl-header__brand">
      {content}
    </Link>
  );
}
