export type ReleaseChangeSections = {
  added?: readonly string[];
  changed?: readonly string[];
  fixed?: readonly string[];
};

export type SiteRelease = {
  version: string;
  date: string;
  /** Пустой массив — релиз не показывается на /updates */
  publicNotes: readonly string[];
} & ReleaseChangeSections;

export type UnreleasedChanges = ReleaseChangeSections;

/** Следующий релиз; на сайт не попадает */
export const unreleased: UnreleasedChanges = {};

/** От новых к старым; [0].version совпадает с package.json */
export const releases: readonly SiteRelease[] = [
  {
    version: "1.5.0",
    date: "2026-10-31",
    publicNotes: [
      "Посты в ленте открываются по коротким адресам вместо длинных технических ссылок.",
      "Перед подключением аналитики можно выбрать «Согласен с аналитикой» или «Только необходимое».",
    ],
    added: [
      "Публичные URL постов на slug (`lib/feed/slug`, маршруты `/`, `/news/`, `/sessions/`).",
      "Баннер согласия на аналитику и хранение выбора (`components/analytics/analytics-consent-banner.tsx`).",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-26",
    publicNotes: [
      "В админке можно сохранить пост как черновик или снять его с ленты, не удаляя.",
    ],
    added: [
      "Состояния публикации постов: черновик и снятие с ленты (`lib/feed/publication.ts`, админ-редактор).",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-24",
    publicNotes: ["Тренеры отмечают, кто был на тренировке и кто пропустил."],
    added: [
      "Посещаемость: отметки attended / no_show / excused, окно и late-mark для super_admin (`lib/domain/attendance/`, `lib/admin/attendance-actions.ts`).",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-20",
    publicNotes: [],
    added: [
      "Управление ролями пользователей в админке (`/admin/users`, capabilities).",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-17",
    publicNotes: [
      "В личном кабинете можно изменить имя; кнопка «Сохранить» показывает, что данные записались.",
    ],
    added: [
      "Форма профиля с in-place feedback (`components/cabinet/profile-form.tsx`).",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-15",
    publicNotes: [
      "Администраторы ищут участников и управляют доступом с сайта.",
      "Старые аккаунты Telegram можно привязать к новому входу.",
      "В списках на тренировку не показываются удалённые пользователи.",
    ],
    added: [
      "Раздел пользователей в админке, merge пользователей (`lib/auth/merge-users.ts`).",
      "Legacy adoption для Telegram OIDC.",
      "Фильтрация удалённых пользователей в составе тренировки.",
    ],
    fixed: ["Security headers; усиление обработки payment webhooks."],
  },
  {
    version: "0.5.0",
    date: "2026-10-14",
    publicNotes: [],
    added: [
      "Очередь и повторы публикации постов в Telegram-канал (`lib/feed/social-publish-jobs.ts`, rate limit, in-flight lock).",
      "Подписи путей в админ-аналитике (`lib/analytics/path-labels.ts`).",
      "JSON-логирование; доработки Telegram OIDC.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-12",
    publicNotes: [
      "Можно войти через VK.",
      "В кабинете выбирается, показывать ли вас в публичном составе тренировки.",
    ],
    added: [
      "VK ID OAuth (`/vk/oauth/start`, callback).",
      "Segmented control видимости в составе (`roster visibility`).",
    ],
    changed: ["Страница входа и поток email OTP."],
  },
  {
    version: "0.3.0",
    date: "2026-10-09",
    publicNotes: [],
    added: ["Интеграция Яндекс.Метрики (`lib/analytics/`)."],
  },
  {
    version: "0.2.0",
    date: "2026-10-08",
    publicNotes: [
      "Вход через Telegram — в том числе из Mini App.",
      "Новые посты в ленте автоматически публикуются в Telegram-канал.",
    ],
    added: [
      "Telegram Mini App и bot/OIDC вход (`lib/bots/telegram/`, webhooks).",
      "Автопубликация ленты в канал (`publish_to_telegram`, `feed_post_social_publishes`).",
    ],
    changed: [
      "Next.js standalone и миграции при старте контейнера (`.deploy/`).",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-07",
    publicNotes: [
      "Запуск сайта «Ночная Лига»: лента анонсов и новостей.",
      "Запись на тренировку и оплата.",
      "Вход по коду на email без пароля.",
    ],
    added: [
      "Лента, тренировки, регистрации и оплаты (`lib/training/`, `lib/payments/`).",
      "Better Auth + email OTP, кабинет и админка.",
      "Картинки в постах (`NlContentImage`, volume uploads).",
      "Docker dev/prod, CI deploy на VPS.",
    ],
  },
];

export function releasesForPublicUpdates(): SiteRelease[] {
  return releases.filter((r) => r.publicNotes.length > 0);
}
