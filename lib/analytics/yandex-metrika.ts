/** Публичный id счётчика (не секрет). Читается на сервере в runtime из env деплоя. */
export function getYandexMetrikaCounterId(): string | null {
  const raw = process.env.YANDEX_METRIKA_COUNTER_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  return raw;
}

export function yandexMetrikaTagJsUrl(counterId: string): string {
  return `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
}

export function yandexMetrikaWatchPixelUrl(counterId: string): string {
  return `https://mc.yandex.ru/watch/${counterId}`;
}

/** Inline bootstrap для next/script (счётчик уже проверен на цифры). */
export function yandexMetrikaInitScript(counterId: string): string {
  const tagUrl = yandexMetrikaTagJsUrl(counterId);
  return `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','${tagUrl}', 'ym');
window.dataLayer = window.dataLayer || [];
ym(${counterId}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
`.trim();
}
