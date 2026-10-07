# Payments (фаза 2)

## Модель

- `payments` — один платёж на запись (`registration_id` unique)
- `payment_webhook_deliveries` — идемпотентность webhook (`id` = `{provider}:{event_id}`)
- Статусы: registration `pending_payment` → `paid` при `payment.status = succeeded`

## Провайдер

`PAYMENT_PROVIDER=mock` (default). Реальный эквайринг — позже, тот же webhook контракт.

## Mock в dev

Пользователь: `/cabinet/pay/[registrationId]` — инструкция, без self-serve «оплачено».

Admin: раздел «Оплата» `/admin/payments` (или карточка тренировки → «Участники») → **Оплачено**. Возврат и перенос оплаты — там же (статусы записи `refunded` / `transferred`).

## Webhook

`POST /api/webhooks/payment/{provider}`

Headers: `Authorization: Bearer $PAYMENT_WEBHOOK_SECRET` или `X-Payment-Webhook-Secret`.

```json
{
  "event_id": "unique-event-1",
  "payment_id": "<uuid>",
  "status": "succeeded",
  "external_id": "optional-provider-ref"
}
```

Повтор того же `event_id` → `alreadyProcessed: true`.

Пример:

```bash
curl -X POST http://localhost:3000/api/webhooks/payment/mock \
  -H "Authorization: Bearer dev-webhook-secret" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"test-1","payment_id":"<id>","status":"succeeded"}'
```

## Env

- `PAYMENT_PROVIDER` — `mock`
- `PAYMENT_WEBHOOK_SECRET` — обязателен для webhook route
