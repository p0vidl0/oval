import { describe, expect, it } from "vitest";
import {
  launchPathForStartParam,
  readTelegramLaunchSnapshot,
  TELEGRAM_LAUNCH_HASH_KEY,
  TELEGRAM_LAUNCH_INIT_DATA_KEY,
  telegramLaunchCaptureScript,
} from "@/lib/telegram/mini-app-launch";

function hashWithInitData(initData: string): string {
  return `#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppPlatform=ios`;
}

describe("readTelegramLaunchSnapshot", () => {
  it("reads start_param from the live hash and ignores a stored launch", () => {
    const initData = "auth_date=1&start_param=p_abc-123";
    const snap = readTelegramLaunchSnapshot({
      liveHash: hashWithInitData(initData),
      storedHash: "#tgWebAppStartParam=p_old&tgWebAppPlatform=ios",
      storedInitData: "stored-init",
      search: "",
      sdkInitData: "sdk-init",
      sdkStartParam: "p_stale",
    });
    expect(snap.isTelegram).toBe(true);
    expect(snap.startParam).toBe("p_abc-123");
    expect(snap.storedStartParam).toBeNull();
    expect(snap.initData).toBe(initData);
  });

  it("prefers tgWebAppStartParam over initData and the SDK", () => {
    const snap = readTelegramLaunchSnapshot({
      liveHash: `#tgWebAppStartParam=p_new&tgWebAppData=${encodeURIComponent("start_param=p_inside")}&tgWebAppPlatform=ios`,
      storedHash: "",
      storedInitData: "",
      search: "?tgWebAppStartParam=p_query",
      sdkStartParam: "p_sdk",
    });
    expect(snap.startParam).toBe("p_new");
  });

  it("does not reuse a previous start param when this launch has none", () => {
    const snap = readTelegramLaunchSnapshot({
      liveHash: hashWithInitData("auth_date=1"),
      storedHash: "#tgWebAppStartParam=p_old&tgWebAppPlatform=ios",
      storedInitData: "",
      search: "",
      sdkStartParam: "p_stale",
    });
    expect(snap.startParam).toBeNull();
    expect(snap.storedStartParam).toBeNull();
  });

  it("keeps a stored start param when the live hash was stripped", () => {
    const snap = readTelegramLaunchSnapshot({
      liveHash: "",
      storedHash: "#tgWebAppStartParam=p_kept&tgWebAppPlatform=android",
      storedInitData: "saved-init",
      search: "",
    });
    expect(snap.isTelegram).toBe(true);
    expect(snap.startParam).toBeNull();
    expect(snap.storedStartParam).toBe("p_kept");
    expect(snap.initData).toBe("saved-init");
  });

  it("uses the SDK when the page has no hash", () => {
    const snap = readTelegramLaunchSnapshot({
      liveHash: "",
      storedHash: "",
      storedInitData: "",
      search: "",
      sdkPlatform: "tdesktop",
      sdkInitData: "auth_date=1&start_param=p_desk",
      sdkStartParam: "p_desk",
    });
    expect(snap.isTelegram).toBe(true);
    expect(snap.startParam).toBe("p_desk");
    expect(snap.initData).toBe("auth_date=1&start_param=p_desk");
  });

  it("is not a Mini App on a normal visit", () => {
    const snap = readTelegramLaunchSnapshot({
      liveHash: "",
      storedHash: "",
      storedInitData: "",
      search: "",
      sdkPlatform: "unknown",
    });
    expect(snap.isTelegram).toBe(false);
    expect(snap.startParam).toBeNull();
    expect(snap.initData).toBe("");
  });
});

describe("launchPathForStartParam", () => {
  it("maps posts and payments", () => {
    expect(launchPathForStartParam("p_abc")).toBe("/feed/abc");
    expect(launchPathForStartParam("pay_reg_1")).toBe("/cabinet/pay/reg_1");
    expect(launchPathForStartParam("login_x")).toBeNull();
    expect(launchPathForStartParam("p_../admin")).toBeNull();
  });
});

describe("telegramLaunchCaptureScript", () => {
  function run(
    hash: string,
    pathname: string,
    storage = new Map<string, string>(),
  ) {
    const replaced: string[] = [];
    const location = {
      hash,
      pathname,
      replace(path: string) {
        replaced.push(path);
      },
    };
    const sessionStorage = {
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
    };
    const fn = new Function(
      "location",
      "sessionStorage",
      telegramLaunchCaptureScript(),
    );
    fn(location, sessionStorage);
    return { replaced, storage };
  }

  it("opens the post from start_param before hydration", () => {
    const initData = "auth_date=1&start_param=p_abc-123";
    const { replaced, storage } = run(hashWithInitData(initData), "/feed");
    expect(replaced).toEqual(["/feed/abc-123"]);
    expect(storage.get(TELEGRAM_LAUNCH_INIT_DATA_KEY)).toBe(initData);
    expect(storage.get(TELEGRAM_LAUNCH_HASH_KEY)).toContain("tgWebAppData");
  });

  it("opens a news post from tgWebAppStartParam", () => {
    const { replaced } = run(
      "#tgWebAppStartParam=p_news1&tgWebAppPlatform=ios",
      "/feed",
    );
    expect(replaced).toEqual(["/feed/news1"]);
  });

  it("opens the payment screen", () => {
    const { replaced } = run(
      "#tgWebAppStartParam=pay_reg_1&tgWebAppPlatform=ios",
      "/feed",
    );
    expect(replaced).toEqual(["/cabinet/pay/reg_1"]);
  });

  it("does not redirect when already on the target", () => {
    const { replaced } = run(
      "#tgWebAppStartParam=p_news1&tgWebAppPlatform=ios",
      "/feed/news1",
    );
    expect(replaced).toEqual([]);
  });

  it("ignores a normal page", () => {
    const { replaced, storage } = run("", "/feed");
    expect(replaced).toEqual([]);
    expect(storage.size).toBe(0);
  });

  it("does not follow a stored start param when this launch has none", () => {
    const storage = new Map<string, string>([
      [
        TELEGRAM_LAUNCH_HASH_KEY,
        "#tgWebAppStartParam=p_old&tgWebAppPlatform=ios",
      ],
    ]);
    const { replaced } = run(
      "#tgWebAppPlatform=ios&tgWebAppData=auth_date%3D1",
      "/feed",
      storage,
    );
    expect(replaced).toEqual([]);
  });
});
