# Шрифты портала

Vendored `.woff2` из [@fontsource](https://fontsource.org) (Google Fonts). Лицензия OFL — `OFL.txt` в каждой подпапке семейства. Только кириллица и латиница.

Подключение: `lib/fonts.ts` → `next/font/local`, без CDN в рантайме. Токены `--font-display/-text/-mono` в `app/tokens.css` ссылаются на переменные next/font.

| Папка | Где используется | Начертания |
|---|---|---|
| `raleway/` | крупные заголовки (`--font-display`) и текст интерфейса (`--font-text`) | вариативный 100–900, только прямой (`@fontsource-variable/raleway`) |
| `poiret-one/` | только название «Ночная лига» в шапке (`.nl-logo__title`) | 400 |
| `jetbrains-mono/` | время, даты, числа (`--font-mono`, `.nl-mono`) | 400, 500, 700 |

Аудит 2026-10-07: неиспользуемые семейства (Sofia Sans Extra Condensed, Onest) и курсив Raleway удалены. Перед добавлением начертания проверьте, что оно реально запрашивается в CSS.
