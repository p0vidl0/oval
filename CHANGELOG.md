# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]


## [1.5.0] - 2026-10-31

### Добавлено

- Публичные URL постов на slug (`lib/feed/slug`, маршруты `/`, `/news/`, `/sessions/`).
- Баннер согласия на аналитику и хранение выбора (`components/analytics/analytics-consent-banner.tsx`).

## [1.4.0] - 2026-10-26

### Добавлено

- Состояния публикации постов: черновик и снятие с ленты (`lib/feed/publication.ts`, админ-редактор).

## [1.3.0] - 2026-10-24

### Добавлено

- Посещаемость: отметки attended / no_show / excused, окно и late-mark для super_admin (`lib/domain/attendance/`, `lib/admin/attendance-actions.ts`).

## [1.2.0] - 2026-10-20

### Добавлено

- Управление ролями пользователей в админке (`/admin/users`, capabilities).

## [1.1.0] - 2026-10-17

### Добавлено

- Форма профиля с in-place feedback (`components/cabinet/profile-form.tsx`).

## [1.0.0] - 2026-10-15

### Добавлено

- Раздел пользователей в админке, merge пользователей (`lib/auth/merge-users.ts`).
- Legacy adoption для Telegram OIDC.
- Фильтрация удалённых пользователей в составе тренировки.

### Исправлено

- Security headers; усиление обработки payment webhooks.

## [0.5.0] - 2026-10-14

### Добавлено

- Очередь и повторы публикации постов в Telegram-канал (`lib/feed/social-publish-jobs.ts`, rate limit, in-flight lock).
- Подписи путей в админ-аналитике (`lib/analytics/path-labels.ts`).
- JSON-логирование; доработки Telegram OIDC.

## [0.4.0] - 2026-10-12

### Добавлено

- VK ID OAuth (`/vk/oauth/start`, callback).
- Segmented control видимости в составе (`roster visibility`).

### Изменено

- Страница входа и поток email OTP.

## [0.3.0] - 2026-10-09

### Добавлено

- Интеграция Яндекс.Метрики (`lib/analytics/`).

## [0.2.0] - 2026-10-08

### Добавлено

- Telegram Mini App и bot/OIDC вход (`lib/bots/telegram/`, webhooks).
- Автопубликация ленты в канал (`publish_to_telegram`, `feed_post_social_publishes`).

### Изменено

- Next.js standalone и миграции при старте контейнера (`.deploy/`).

## [0.1.0] - 2026-10-07

### Добавлено

- Лента, тренировки, регистрации и оплаты (`lib/training/`, `lib/payments/`).
- Better Auth + email OTP, кабинет и админка.
- Картинки в постах (`NlContentImage`, volume uploads).
- Docker dev/prod, CI deploy на VPS.
