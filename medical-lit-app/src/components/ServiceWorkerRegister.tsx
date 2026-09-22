"use client";

import { useEffect } from "react";

// PWAとして動かすための Service Worker 登録。
// これによりホーム画面に追加したアイコンから、アプリのように起動できる。
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // オフラインキャッシュが使えなくても検索機能自体には影響しないため無視する
      });
    }
  }, []);

  return null;
}
