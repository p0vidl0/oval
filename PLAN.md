# Ночная Лига — план реализации

Упрощённый продукт: сайт вечерних тренировок на велотреке. **Сначала функционал**, дизайн — позже.

Документ живой. Статусы: `[ ]` todo · `[~]` в работе · `[x]` готово.

---

## 1. Цели продукта

- **Лента новостей** — единая точка входа: анонсы тренировок, отмены, переносы, прочие новости.
- Из **анонса тренировки** — запись на занятие и **оплата** (на сайте).
- **Вход по email:** одноразовый код на почту (без пароля).
- Заложить расширение auth: email OTP, Telegram / Max / VK и др. (как в общем подходе bike-portal).
- Заложить **ботов Telegram и Max:** автопубликация анонсов в канал; запись и оплата через бота (после MVP сайта или параллельно по приоритету).

---

## 2. Наследие решений (из bike-portal / Омсквело)

| Тема | Решение для oval |
|---|---|
| Стек | **Next.js + TypeScript + PostgreSQL** (монолит) |
| Запросы / миграции | **Drizzle** + `drizzle-kit` |
| Auth-библиотека | **Better Auth** (self-hosted, не облачный IdP) |
| Сессии | **httpOnly cookie**, серверная сессия (не JWT как основа) |
| Lint / format | **Biome** |
| RBAC | Простая модель ролей в своей БД |
| Хостинг | **VPS + Docker Compose** (Traefik + GHCR — по аналогии с omsk-bike) |
| Дизайн | **TBD** — отдельная фаза |

---

## 3. Auth: сейчас и дальше

### MVP (фаза 1)

- Идентификатор пользователя — **номер телефона** (нормализация E.164 / +7).
- Вход: запрос кода → email → проверка → сессия.
- Пароль **не создаём и не храним**.
- Rate-limit по IP (Better Auth) + per-email / global cap при `EMAIL_PROVIDER=smtp` (`lib/email/otp-send-limits.ts`); TTL кода ~10 мин; одноразовость.

Better Auth: плагин **email OTP**; доставка через `lib/email/send-otp.ts`. Prod: [`docs/engineering/email.md`](docs/engineering/email.md).

### Дорожная карта auth (не MVP, но учесть в модели)

| Этап | Способ |
|---|---|
| 1 | Email OTP (Postbox / Mailpit / stub) |
| 2 | SMS OTP (опционально позже) |
| 3 | OAuth: VK (built-in), Yandex (`genericOAuth`) |
| 4 | Telegram Login Widget / deep link |
| 5 | Max (бот / webhook, не классический OAuth сайта) |

- Таблица **`accounts`**: `provider` + `external_id`; один `user` — несколько способов входа.
- Email — primary для входа; телефон в профиле — позже (уведомления).

### Email (prod)

- Транзакционная почта: **Postbox** или SMTP (локально **Mailpit**).
- Env: `EMAIL_PROVIDER=stub|recording|smtp`, `SMTP_*`.

---

## 4. Лента и типы материалов

Единая **лента** (хронология, новые сверху). Тип записи задаёт поведение UI и фильтры.

| Тип | Назначение | Действия пользователя |
|---|---|---|
| `training_announcement` | Анонс тренировки (дата/время, трек, цена, лимит мест) | Записаться, оплатить |
| `training_cancelled` | Отмена (ссылка на исходный анонс / session) | Только читать |
| `training_rescheduled` | Перенос (старое → новое время, ссылка на session) | Записаться заново при необходимости |
| `news` | Общая новость | Только читать |

### Поля анонса тренировки (черновик)

- заголовок, текст (markdown/plain)
- `starts_at`, `ends_at` (или только start + duration)
- место / «велотрек» (строка или справочник — позже)
- **цена** (копейки + валюта RUB)
- **лимит мест** (опц.; `null` = без лимита)
- **окно записи:** `registration_opens_at`, `registration_closes_at`
- статус публикации: черновик / опубликовано
- флаги для ботов: «отправить в Telegram», «отправить в Max» (после подключения)

Отмена и перенос — отдельные посты в ленте + связь с `training_session_id` для истории.

---

## 5. Запись на тренировку и оплата

### Запись

- Требуется **вход** (email OTP) для привязки записи к `user_id`.
- Одна активная запись на пользователя на одну тренировку (уточнить: гость без входа — **нет** на MVP).
- Статусы записи: `pending_payment` → `paid` / `cancelled` / `refunded` (refund — позже).

### Оплата

- После записи — переход к оплате (сумма из анонса).
- Провайдер эквайринга — **TBD** (ЮKassa, CloudPayments, банк — выбрать позже).
- Архитектура с первого дня:
  - `payments`: id, user_id, registration_id, amount, status, provider, external_id, metadata
  - webhook endpoint для подтверждения оплаты
  - идемпотентность webhook
- До подключения провайдера: **mock-оплата** в dev (кнопка «оплачено» только admin).

### Связь с лентой

- Карточка анонса показывает: мест осталось, запись открыта/закрыта, «Вы записаны» / «Оплатить».

---

## 6. Боты Telegram и Max (заложить в архитектуру)

Не обязательно в MVP-1, но **модель и API** проектируем сразу.

### Общие принципы

- **Источник правды** — Postgres (лента, sessions, registrations, payments).
- Боты — **клиенты** того же домена: не дублировать бизнес-логику в боте, вызывать сервисный слой / internal API.
- События: «пост опубликован» → job публикует в канал; «оплата успешна» → обновить запись + (опц.) сообщение пользователю.

### Telegram

- Бот + канал для анонсов.
- Autopublish: при `published` + флаг → форматированное сообщение + кнопка «Записаться» (deep link / start payload).
- Запись/оплата в боте: сценарий идентификации по `telegram_user_id` → привязка к `accounts` (provider `telegram`).

### Max

- Аналогично: webhook бота, публикация в канал/чат партнёра, deep link на запись.
- Отдельный adapter (как в bike-portal), не OIDC.

### Таблицы / сущности (черновик)

- `bot_channels` — platform (`telegram` \| `max`), channel_id, credentials ref
- `bot_publications` — post_id, platform, external_message_id, status
- `accounts` — уже для auth linkage

Internal API (пример): `POST /api/internal/bot/register`, webhook payments — с секретом / mTLS позже.

---

## 7. Роли

| Роль | Назначение |
|---|---|
| `user` | Лента, запись, оплата, свои записи |
| `editor` | Публикация ленты, анонсы, отмены, переносы |
| `admin` | Пользователи, роли, настройки ботов, платежи, экспорт |

---

## 8. Модули продукта

- [x] **Лента** — список, фильтр по типу, детальная страница поста
- [x] **Тренировки** — session из анонса, лимиты, окно записи
- [x] **Auth email OTP** — OTP, сессии, профиль (имя — опц.)
- [x] **Запись + оплата** — регистрация, checkout, mock/webhook; эквайринг TBD
- [x] **Личный кабинет** — предстоящие / прошедшие, статус «ожидает оплаты»
- [~] **Админка** — лента, анонсы, отмена/перенос (фаза 1); экспорт CSV — позже
- [ ] **Интеграции ботов** — autopublish + register/pay (фаза 2+)
- [~] **Расширение auth** — Telegram OIDC + bot login (email optional для TG); VK, link email — позже

---

## 9. Черновик сущностей БД

```
users
accounts          -- provider: phone | telegram | max | vk | email, ...
sessions          -- Better Auth
phone_verifications / verification -- OTP (если не только Better Auth)

training_sessions -- самостоятельная сущность: title, starts_at, price_cents, capacity, registration window, status (scheduled|cancelled)
training_session_events -- журнал: created / updated / rescheduled / cancelled
feed_posts        -- type, title, body, published_at, status (draft|published|unpublished), meta JSON, related_session_id → training_sessions

registrations     -- user_id, training_session_id, status (pending_payment|paid|cancelled|refunded|transferred), cancelled_by, created_at
payments          -- registration_id, amount, status, provider_ref

bot_channels
bot_publications
```

---

## 10. Технический скелет (когда начнём код)

```
oval/
  PLAN.md
  AGENTS.md              -- точка входа для агентов (@-ссылки на always-on rules)
  .agents/
    rules/               -- канонические .mdc (редактировать здесь)
    skills/              -- по необходимости (SKILL.md)
  .cursor/
    rules/               -- симлинки на .agents/rules/ (discovery Cursor)
    settings.json        -- плагины Cursor (по необходимости)
  app/
    (public)/       -- лента, пост, login
    cabinet/        -- мои записи
    admin/          -- редактор + admin
    api/
      auth/         -- Better Auth handler
      webhooks/     -- payment, telegram, max
  lib/
    auth/
    db/             -- Drizzle schema
    feed/
    training/
    payments/
    bots/           -- adapters telegram, max
  ...
```

---

## 11. Дорожная карта

### Фаза 0 — каркас

- [x] Next.js (App Router, TS), Biome, Drizzle, Postgres, `.env.example`
- [x] Better Auth + email OTP (stub / Mailpit / recording)
- [x] Базовые роли, защита `/admin`, `/cabinet`
- [x] **Правила для AI-агентов** (как в `~/dev/tl/platform/tl-platform-core`: `.agents/` + `AGENTS.md` + адаптер `.cursor/`)
  - [x] Канон: `.agents/rules/*.mdc` с frontmatter (`description`, `alwaysApply`, при необходимости `globs`)
  - [x] Корневой `AGENTS.md` (и при желании `CLAUDE.md`) — подключение always-on правил через `@.agents/rules/…`
  - [x] `.cursor/rules/` — **симлинки** на `.agents/rules/` (не дублировать текст; см. `.cursor/README.md` в reference-репо)
  - [x] Стартовый набор (адаптировать под oval, не копировать Makefile tl-platform-core):
    - `maintain-rules.mdc` — при смене паттерна/воркфлоу **обновлять соответствующее правило в той же задаче**
    - `verify-before-done.mdc` — codegen/lint/test перед «готово» (Biome, `drizzle-kit`, vitest/playwright — по мере появления)
    - `shell-long-commands.mdc` — длинные команды (docker compose, e2e): лог-файл, `block_until_ms`, terminal file
    - scoped: `app-workflow.mdc`; дальше — `admin-workflow`, `payments-workflow` по мере фаз
  - [x] **Поддержка в процессе разработки:** любая фаза 1+ — при новом повторяющемся шаге (auth, webhook, миграции, деплой) дополнять checklist в `.agents/rules/`; не откладывать «на потом»

### Фаза 1 — лента и тренировки (без оплаты или mock)

- [x] Модель `feed_posts` + `training_sessions` + `registrations`
- [x] Админ: создать анонс, отмена, перенос, новость
- [x] Публичная лента + страница анонса
- [x] Запись на тренировку (после входа), лимит мест

### Фаза 2 — оплата

- [x] `payments` + провайдер + webhook
- [x] Статусы registration ↔ payment
- [x] Кабинет: история и чеки (минимум — статус «оплачено»)

### Фаза 3 — боты

- [ ] Telegram: publish в канал, запись (deep link), статус оплаты в боте
- [ ] Max: то же по возможностям API
- [ ] Привязка telegram/max к аккаунту

### Фаза 4 — расширение auth и полировка

- [ ] Magic link (доп. к OTP)
- [ ] VK / Yandex OAuth
- [ ] Уведомления (SMS / мессенджер) об отмене и переносе
- [ ] Docker Compose prod, мониторинг, бэкапы

### Фаза 5 — дизайн

- [ ] Визуальная система, мобильная вёрстка ленты и checkout

---

## 12. Открытые вопросы

- [ ] SMS-провайдер (prod)
- [ ] Платёжный провайдер
- [ ] Нужно ли имя/фамилия при записи или достаточно телефона из профиля
- [ ] Политика отмены записи и возврата
- [ ] Часовой пояс (предположительно `+06:00` Омск — подтвердить)

---

## 13. Лог решений

| Дата | Решение |
|---|---|
| 2026-10-02 | Проект **Ночная Лига**, каталог `~/dev/my/oval` |
| 2026-10-02 | Стек: Next.js + TS + Postgres + Drizzle + Better Auth + Biome |
| 2026-10-02 | MVP auth: SMS OTP; далее email / Telegram / Max / VK |
| 2026-10-02 | Ядро: лента + запись на тренировку + оплата; боты TG/Max в архитектуре с первого дня |
| 2026-10-02 | Дизайн отложен; план только по функционалу |
| 2026-10-02 | Фаза 0: структура `.agents/` + `AGENTS.md` + `.cursor/rules` (симлинки), поддержка правил по образцу tl-platform-core |
| 2026-10-02 | Фаза 0 реализована: Next.js каркас, Better Auth SMS OTP, RBAC middleware, Drizzle + docker Postgres |
| 2026-10-03 | Фаза 1: лента, training_sessions, админка, запись без оплаты |
| 2026-10-03 | Фаза 2: payments, webhook, mock admin confirm, кабинет/квитанции |
