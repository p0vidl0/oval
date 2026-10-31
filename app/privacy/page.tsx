import type { Metadata } from "next";
import { NlShell } from "@/components/nl/shell";
import { BackLink } from "@/components/nl/ui";
import {
  getPrivacyContactEmail,
  getPrivacyOperatorName,
} from "@/lib/analytics/config";
import { getPublicSiteOrigin, siteName } from "@/lib/site/public-origin";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: `Обработка персональных данных на сайте ${siteName}.`,
};

export default function PrivacyPage() {
  const operator = getPrivacyOperatorName();
  const contactEmail = getPrivacyContactEmail();
  const siteOrigin = getPublicSiteOrigin() || "https://velodrom55.ru";

  return (
    <NlShell tab="feed">
      <main className="nl-page nl-privacy" style={{ maxWidth: 720 }}>
        <BackLink href="/">На главную</BackLink>
        <h1
          className="nl-display"
          style={{ marginTop: "var(--space-4)", fontSize: 36 }}
        >
          Политика конфиденциальности
        </h1>
        <p
          className="body-sm"
          style={{
            color: "var(--on-page-fg, var(--ink-2))",
            marginTop: "var(--space-4)",
          }}
        >
          Настоящий документ описывает порядок обработки персональных данных
          посетителей сайта {siteOrigin} (далее — «Сайт»), оператор — {operator}
          . Текст подготовлен как шаблон; уточните реквизиты оператора у юриста.
        </p>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">
            1. Какие данные мы обрабатываем
          </h2>
          <ul className="nl-privacy__list body-sm">
            <li>
              Данные аккаунта: email, имя (при указании), идентификатор Telegram
              при входе через Telegram.
            </li>
            <li>
              Данные записи на тренировки: выбранная сессия, статус оплаты,
              история регистраций.
            </li>
            <li>
              Публичный список записавшихся на тренировку: имя из профиля (если
              вы не отключили показ в личном кабинете и указали имя); иначе в
              списке отображается псевдоним «Темная Лошадка».
            </li>
            <li>
              Технические cookie сессии для входа и работы личного кабинета (не
              используются для рекламного профилирования).
            </li>
            <li>
              При вашем отдельном согласии («Согласен с аналитикой»):
              обезличенный идентификатор посетителя, просмотренные страницы,
              источник перехода, UTM-метки, тип устройства, признак Telegram
              Mini App; данные могут передаваться в Яндекс.Метрику (ООО
              «Яндекс», РФ) и обрабатываться в нашей собственной статистике на
              серверах в РФ.
            </li>
          </ul>
        </section>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">2. Цели обработки</h2>
          <ul className="nl-privacy__list body-sm">
            <li>Регистрация и проведение тренировок, оплата, уведомления.</li>
            <li>Авторизация на Сайте.</li>
            <li>
              Статистика посещений и улучшение сервиса — только после согласия
              на аналитику.
            </li>
          </ul>
        </section>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">3. Согласие на аналитику</h2>
          <p className="body-sm">
            До нажатия «Согласен с аналитикой» счётчики Яндекс.Метрики и
            first-party статистика не активируются. Вы можете выбрать «Только
            необходимое» — тогда используются лишь cookie, нужные для входа и
            записи.
          </p>
        </section>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">4. Срок хранения</h2>
          <p className="body-sm">
            Данные аккаунта и записей хранятся пока действует отношения с
            пользователем и в сроки, установленные законом. События аналитики
            хранятся до 90 дней (агрегированная статистика может сохраняться
            дольше без идентификаторов).
          </p>
        </section>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">5. Ваши права</h2>
          <p className="body-sm">
            Вы вправе запросить уточнение, блокирование или уничтожение
            персональных данных, отозвать согласие на аналитику (очистите данные
            сайта в браузере или отключите аналитику при следующем визите).
            Обращения:{" "}
            <a href={`mailto:${contactEmail}`} className="nl-privacy__link">
              {contactEmail}
            </a>
            .
          </p>
        </section>

        <section className="nl-privacy__section">
          <h2 className="nl-privacy__heading">6. Яндекс.Метрика</h2>
          <p className="body-sm">
            Политика обработки данных Яндекса:{" "}
            <a
              href="https://yandex.ru/legal/confidential/"
              className="nl-privacy__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              yandex.ru/legal/confidential
            </a>
            .
          </p>
        </section>
      </main>
    </NlShell>
  );
}
