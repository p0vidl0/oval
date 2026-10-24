---
name: backup-oval-db
description: >-
  Снимает custom-дамп production-базы oval с p0vidl0.info и сохраняет его в
  backup/. Use when the user asks to back up, dump, or download the oval
  production database (бэкап бд, дамп oval, скачать базу с сервера).
---

# Бэкап production-базы oval

Снимает только базу `oval` с VPS `p0vidl0.info` и кладёт дамп в `backup/` репозитория. На сервере файл не оставлять.

## Запуск

Из корня репозитория, с сетевым доступом вне sandbox (`full_network` или `all` — SSH не входит в allowlist):

```bash
.skills/backup-oval-db/scripts/backup-oval-db.sh
```

Скрипт сам:

1. Ходит по SSH на хост `p0vidl0.info` из `~/.ssh/config` (`BatchMode`, без пароля в команде).
2. Делает `docker exec postgres pg_dump -U postgres -Fc -d oval` (контейнер `postgres`, Postgres 13). Без `-t`: TTY портит бинарный дамп.
3. Пишет поток в `backup/oval-YYYYMMDD-HHMMSS.dump`. Каталог `backup/` в `.gitignore`.
4. Проверяет, что файл не пустой и начинается с `PGDMP`. При ошибке частичный файл удаляется.
5. Если локально есть `pg_restore`, печатает начало оглавления.

Переопределение (не нужно, если пользователь не просил другой хост или базу): `OVAL_SSH_HOST`, `OVAL_PG_CONTAINER`, `OVAL_PG_DATABASE`, `OVAL_PG_USER`, `OVAL_BACKUP_DIR`.

## После запуска

Сообщить путь, размер и что это PostgreSQL custom dump. Не печатать `DATABASE_URL`, `secrets.env` и содержимое других баз на том же Postgres (`cp_backend_dev`, `frige-dev`, `keycloak`). Дамп не коммитить.
