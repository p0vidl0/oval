import { parseInitDataQuery } from "@/lib/auth/telegram/parse-init-data-query";
import { resolveStartParamRoute } from "@/lib/telegram/mini-app-start-param";

/** Snapshot of `location.hash` taken before the client router can drop it. */
export const TELEGRAM_LAUNCH_HASH_KEY = "tg-launch-hash";

/** Raw initData extracted from that snapshot, used after a deep-link navigation. */
export const TELEGRAM_LAUNCH_INIT_DATA_KEY = "tg-launch-init-data";

export const TELEGRAM_WEB_APP_SDK_SRC = "/telegram-web-app.js";

export type TelegramLaunchSnapshot = {
  isTelegram: boolean;
  /** Signed initData string. Live hash wins over the SDK, which can stay stale. */
  initData: string;
  /**
   * Start param from this launch (live hash, query, or SDK).
   * Empty when this launch has no start param — even if an older one is stored.
   */
  startParam: string | null;
  /**
   * Start param from the stored hash only. Use it after the live hash was
   * stripped and never reappeared. Ignore it while a live Telegram hash exists.
   */
  storedStartParam: string | null;
};

function hashHasTelegram(hash: string): boolean {
  return hash.includes("tgWebApp");
}

export function parseTelegramLaunchHash(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

export function initDataFromLaunchHash(hash: string): string {
  return parseTelegramLaunchHash(hash).get("tgWebAppData")?.trim() ?? "";
}

function startParamFromInitData(initData: string): string | null {
  if (!initData) return null;
  const value = parseInitDataQuery(initData).get("start_param")?.trim();
  return value || null;
}

export function startParamFromLaunchHash(hash: string): string | null {
  if (!hash) return null;
  const params = parseTelegramLaunchHash(hash);
  const direct = params.get("tgWebAppStartParam")?.trim();
  if (direct) return direct;
  return startParamFromInitData(params.get("tgWebAppData")?.trim() ?? "");
}

function startParamFromSearch(search: string): string | null {
  if (!search) return null;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(raw).get("tgWebAppStartParam")?.trim();
  return value || null;
}

export function readTelegramLaunchSnapshot(input: {
  liveHash: string;
  storedHash: string;
  storedInitData: string;
  search: string;
  sdkInitData?: string;
  sdkPlatform?: string;
  sdkStartParam?: string | null;
}): TelegramLaunchSnapshot {
  const liveHash = input.liveHash ?? "";
  const storedHash = input.storedHash ?? "";
  const liveTelegram = hashHasTelegram(liveHash);
  const sdkInitData = input.sdkInitData?.trim() ?? "";
  const sdkPlatform = input.sdkPlatform?.trim() ?? "";
  const sdkTelegram = sdkPlatform !== "" && sdkPlatform !== "unknown";

  const liveInitData = initDataFromLaunchHash(liveHash);
  const storedInitData =
    input.storedInitData.trim() || initDataFromLaunchHash(storedHash);
  const initData = liveInitData || sdkInitData || storedInitData;

  const liveStart = startParamFromLaunchHash(liveHash);
  const searchStart = startParamFromSearch(input.search);
  const sdkStart = input.sdkStartParam?.trim() || null;
  const startParam =
    liveStart || searchStart || (liveTelegram ? null : sdkStart);

  const storedStartParam = liveTelegram
    ? null
    : startParamFromLaunchHash(storedHash);

  const isTelegram =
    liveTelegram ||
    hashHasTelegram(storedHash) ||
    sdkTelegram ||
    Boolean(sdkInitData) ||
    Boolean(storedInitData);

  return {
    isTelegram,
    initData,
    startParam,
    storedStartParam,
  };
}

export function launchPathForStartParam(
  startParam: string | null | undefined,
): string | null {
  return resolveStartParamRoute(startParam)?.path ?? null;
}

/**
 * Runs before hydration: keep the launch hash, then open the post immediately.
 * Channel buttons reuse one WebView; routing only inside React was losing the race
 * with `router.refresh()` and a one-shot sessionStorage flag.
 */
export function telegramLaunchCaptureScript(): string {
  const hashKey = JSON.stringify(TELEGRAM_LAUNCH_HASH_KEY);
  const initKey = JSON.stringify(TELEGRAM_LAUNCH_INIT_DATA_KEY);
  const sdkSrc = JSON.stringify(TELEGRAM_WEB_APP_SDK_SRC);
  const sdkSelector = JSON.stringify(
    `script[src="${TELEGRAM_WEB_APP_SDK_SRC}"]`,
  );
  return `(function(){try{
var h=location.hash||"";
if(h.indexOf("tgWebApp")!==-1){
sessionStorage.setItem(${hashKey},h);
var params=new URLSearchParams(h.charAt(0)==="#" ? h.slice(1) : h);
var data=params.get("tgWebAppData");
if(data)sessionStorage.setItem(${initKey},data);
var start=params.get("tgWebAppStartParam");
if(!start&&data){
var parts=data.split("&");
for(var i=0;i<parts.length;i++){
if(parts[i].indexOf("start_param=")===0){
start=decodeURIComponent(parts[i].slice(12));
break;
}
}
}
if(start&&start.indexOf("login_")!==0){
var path="";
if(start.indexOf("pay_")===0){
var payId=start.slice(4);
if(/^[A-Za-z0-9_-]{1,128}$/.test(payId))path="/cabinet/pay/"+payId;
}else if(start.indexOf("p_")===0){
var postId=start.slice(2);
if(/^[A-Za-z0-9_-]{1,128}$/.test(postId))path="/feed/"+postId;
}
if(path&&location.pathname!==path){location.replace(path);return;}
}
}
var stored="";
try{stored=sessionStorage.getItem(${hashKey})||"";}catch(e){}
if(h.indexOf("tgWebApp")===-1&&stored.indexOf("tgWebApp")===-1)return;
if(typeof document==="undefined"||!document.head)return;
if(document.querySelector(${sdkSelector}))return;
var s=document.createElement("script");
s.src=${sdkSrc};
s.async=false;
document.head.appendChild(s);
}catch(e){}})();`;
}
