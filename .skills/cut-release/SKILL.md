---
name: cut-release
description: >-
  Готовит релиз oval: сгруппировать коммиты в фичи, обновить lib/site/releases.ts,
  bump package.json, сгенерировать CHANGELOG.md. Use when the user asks to cut a
  release, bump version, or update the changelog (релиз, версия, changelog).
---

# Релиз oval (changelog + semver)

Канон версий — [lib/site/releases.ts](../../lib/site/releases.ts) (массив `releases` от новых к старым). Технический текст — [CHANGELOG.md](../../CHANGELOG.md) через `pnpm run changelog`. Публичные фразы — поле `publicNotes`; пустой массив — релиз только в CHANGELOG, не на `/updates`. Страница `/updates` и ссылка в подвале — только для `admin.access`; версия в подвале видна всем.

## Правила текста

- Окно релиза — **не длиннее пары дней**. Коммиты сворачивать в **готовые фичи**, не в список сообщений git.
- Нет пользы для продукта — не писать и не заводить версию (CI, стили, Lefthook).
- Польза только для эксплуатации — пункт в `added`/`changed`/`fixed`, `publicNotes: []`.
- SemVer: новая заметная фича — **minor**, починка без новой фичи — **patch**. Major после **1.0.0** — только по явной просьбе.

## Шаги

1. Дата последнего релиза — `releases[0].date`. Сырьё: `git log --since=…` и при необходимости diff.
2. Сгруппировать изменения в фичи внутри окна (≤2 дней). Написать `publicNotes` (простой язык) и секции `added` / `changed` / `fixed` (технический язык, один пункт на фичу).
3. Вставить новый объект **в начало** массива `releases`. Обновить `version` в [package.json](../../package.json) — он должен совпадать с `releases[0].version`.
4. Очистить или дополнить `unreleased`, если накопилось до релиза.
5. Из корня репозитория:

```bash
pnpm run changelog
pnpm run test:unit -- tests/unit/changelog.test.ts
pnpm run task -- validate
```

6. Коммит и git-тег `vX.Y.Z` — **только если пользователь явно просит**. Деплой идёт с `master`, тег не обязателен.

## Подвал сайта

Версия в подвале берётся из `package.json`, хеш — из `GIT_COMMIT` в prod-образе (CI передаёт `github.sha`). Локально — `git rev-parse --short=7 HEAD`.
