import localFont from "next/font/local";

/*
 * next/font регистрирует шрифты под своими именами и отдаёт их через эти
 * переменные. Токены `--font-display/-text/-mono` в app/tokens.css ссылаются
 * на них — имена вроде "Poiret One" напрямую не сработают.
 */

/** Только название «Ночная лига» в шапке. Одно начертание (400). */
const poiretOne = localFont({
  src: [
    {
      path: "../assets/fonts/poiret-one/poiret-one-cyrillic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/poiret-one/poiret-one-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-poiret-one",
  display: "swap",
});

/** Крупные заголовки и основной текст интерфейса. Вариативный: 100–900 (курсив не используется). */
const raleway = localFont({
  src: [
    {
      path: "../assets/fonts/raleway/raleway-cyrillic-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../assets/fonts/raleway/raleway-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-raleway",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    {
      // 400 — таблицы админки, 500 — время и даты, 700 — аватар и новое время в переносе.
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-cyrillic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-cyrillic-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-cyrillic-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = [
  poiretOne.variable,
  raleway.variable,
  jetbrainsMono.variable,
].join(" ");
