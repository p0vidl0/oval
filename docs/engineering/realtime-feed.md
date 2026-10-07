# Real-time лента (SSE + EventEmitter)

## Обзор

Лента `/feed` обновляется без полной перезагрузки страницы:

- **Запись** — client action, локальный патч карточки инициатора.
- **Счётчик мест и новые публикации** — Server-Sent Events [`GET /api/feed/events`](/app/api/feed/events/route.ts), шина [`lib/realtime/feed-event-bus.ts`](/lib/realtime/feed-event-bus.ts) (in-process `EventEmitter` на одном процессе Next.js).

Postgres **не** используется как pub/sub.

## События

| `type` | Когда emit | Payload |
|--------|------------|---------|
| `session.registrations_changed` | запись, отмена, оплата, отмена тренировки админом | `sessionId`, `activeCount` |
| `feed.post_published` | новая опубликованная публикация | `postId` |
| `feed.post_updated` | правка опубликованного поста | `postId` |
| `session.changed` | перенос/отмена тренировки, правка анонса | `sessionId` |

Публичный поток **без PII**. «Вы записаны» — только в ответе action пользователю.

## Writers (обязательный `publishFeedEvent`)

- [`lib/training/register-action.ts`](/lib/training/register-action.ts)
- [`lib/training/cancel-action.ts`](/lib/training/cancel-action.ts)
- [`lib/payments/confirm-payment.ts`](/lib/payments/confirm-payment.ts)
- [`lib/admin/feed-actions.ts`](/lib/admin/feed-actions.ts) — create/update/publish, cancel/reschedule session

Новый код, меняющий ленту или записи, должен вызывать bus после успешного commit.

## Клиент

[`components/nl/feed-live-list.tsx`](/components/nl/feed-live-list.tsx) — `EventSource`, reconnect с backoff, patch state.

Карточка по событию: [`GET /api/feed/card/[postId]`](/app/api/feed/card/[postId]/route.ts).

## Ограничения

- **Один инстанс** Next.js (типичный Docker Compose на VPS). Несколько реплик без sticky sessions: emit на одной реплике не дойдёт до SSE на другой — нужен Redis pub/sub или один replica.
- **Dev HMR** может пересоздать модуль bus; клиент переподключает SSE автоматически.

## Проверка вручную

1. Два браузера на `/feed`, одна тренировка с лимитом мест.
2. Запись в одном — в другом за 1–2 с меняется «осталось N мест».
3. Публикация в админке — новая карточка появляется в ленте без reload.
