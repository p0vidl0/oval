# Сверка UI с макетом «Ночная лига — портал клуба»

## Источники

| Слой | Путь |
|------|------|
| Токены и `.nl-*` стили | [`app/tokens.css`](../../app/tokens.css), [`app/nl-bundle.css`](../../app/nl-bundle.css), [`app/nl-shell.css`](../../app/nl-shell.css) |
| React-компоненты | [`components/nl/`](../../components/nl/) |
| Страницы | `app/*` |

Канон UI — в коде приложения (классы `.nl-*`, `components/nl/*`). Архив HTML-макетов из репозитория убран. Вход — **email OTP**; SMS — только roadmap в [`PLAN.md`](../../PLAN.md). Демо-контакты — **email** (`aleksey@example.com` и др.).

## Матрица экранов

| Экран макета | Маршрут oval | Статус |
|--------------|--------------|--------|
| Лента — телефон / десктоп | `/feed` | oval + DS Header/TabBar |
| Тренировка — запись и оплата | `/feed/[id]` | aligned |
| Вход / Вход перед записью | `/login` | email OTP (DS + oval) |
| Личный кабинет | `/cabinet` | email в профиле |
| Админ — публикации / записи / новая | `/admin/*` | Email в таблицах; admin header partial |
| Admin publication preview | `/admin/posts/*` | oval partial |

## Канон входа

**Email + код из письма** — в [`app/login/`](../../app/login/) и [`components/nl/`](../../components/nl/). SMS — только roadmap в [`PLAN.md`](../../PLAN.md).
