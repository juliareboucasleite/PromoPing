(function () {
  "use strict";

  if (window.location.pathname.includes("loading-screen.html")) {
    return;
  }

  const RELOAD_COOLDOWN_MS = 5 * 60 * 1000;
  const MIN_TIME_ON_PAGE_MS = 45 * 1000;
  const CHECK_INTERVAL_MS = 12 * 1000;
  const REQUIRED_BAD_CHECKS = 3;

  function getDeviceMemoryGb() {
    return Number(navigator.deviceMemory) || 4;
  }

  function getThresholds() {
    const deviceMem = getDeviceMemoryGb();
    if (deviceMem <= 2) {
      return { heapRatio: 0.72, absoluteBytes: 140 * 1024 * 1024, frameLagMs: 40 };
    }
    if (deviceMem <= 4) {
      return { heapRatio: 0.8, absoluteBytes: 280 * 1024 * 1024, frameLagMs: 50 };
    }
    return { heapRatio: 0.88, absoluteBytes: 480 * 1024 * 1024, frameLagMs: 60 };
  }

  function readMemoryStats() {
    const memory = performance.memory;
    if (memory && memory.jsHeapSizeLimit > 0) {
      return {
        supported: true,
        used: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        ratio: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        domNodes: document.getElementsByTagName("*").length,
      };
    }

    return {
      supported: false,
      domNodes: document.getElementsByTagName("*").length,
    };
  }

  function isHighMemoryPressure(stats, thresholds) {
    if (stats.supported) {
      return stats.ratio >= thresholds.heapRatio || stats.used >= thresholds.absoluteBytes;
    }
    return stats.domNodes >= 12000;
  }

  function measureFrameLag() {
    return new Promise((resolve) => {
      const start = performance.now();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve(performance.now() - start);
        });
      });
    });
  }

  const guard = {
    pageStart: Date.now(),
    badChecks: 0,
    longTaskHits: 0,
    reloading: false,
    thresholds: getThresholds(),
    lastReloadAt: Number(sessionStorage.getItem("pp_memory_reload_at") || 0),
  };

  function canTriggerReload() {
    if (guard.reloading) return false;
    if (Date.now() - guard.pageStart < MIN_TIME_ON_PAGE_MS) return false;
    if (guard.lastReloadAt && Date.now() - guard.lastReloadAt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    return true;
  }

  function triggerMemoryReload(reason) {
    if (!canTriggerReload()) return;

    guard.reloading = true;
    sessionStorage.setItem("pp_memory_reload_at", String(Date.now()));
    sessionStorage.setItem("pp_memory_reload_reason", reason);

    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    const target =
      "/loading-screen.html?returnTo=" +
      encodeURIComponent(returnTo || "/index.html");

    console.warn("[MemoryGuard] Memória elevada detetada. A recarregar para libertar RAM.", reason);
    window.location.replace(target);
  }

  async function runCheck() {
    if (!canTriggerReload()) return;

    const stats = readMemoryStats();
    const frameLag = await measureFrameLag();
    const highMemory = isHighMemoryPressure(stats, guard.thresholds);
    const slowUi = frameLag >= guard.thresholds.frameLagMs || guard.longTaskHits >= 2;

    if (highMemory && slowUi) {
      guard.badChecks += 1;
    } else if (highMemory || slowUi) {
      guard.badChecks += 0.5;
    } else {
      guard.badChecks = Math.max(0, guard.badChecks - 1);
    }

    guard.longTaskHits = Math.max(0, guard.longTaskHits - 1);

    if (guard.badChecks >= REQUIRED_BAD_CHECKS) {
      const reason = highMemory
        ? `heap=${stats.supported ? Math.round(stats.ratio * 100) + "%" : "dom:" + stats.domNodes}`
        : `lag=${Math.round(frameLag)}ms`;
      triggerMemoryReload(reason);
    }
  }

  if ("PerformanceObserver" in window) {
    const supportsLongTask =
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("longtask");

    if (supportsLongTask) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration >= 200) {
              guard.longTaskHits += 1;
            }
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch (_) {
        // Browser sem suporte a longtask
      }
    }
  }

  window.ppMemoryGuard = {
    getStats() {
      const stats = readMemoryStats();
      return {
        ...stats,
        badChecks: guard.badChecks,
        longTaskHits: guard.longTaskHits,
        thresholds: guard.thresholds,
        canReload: canTriggerReload(),
      };
    },
    forceReload: () => triggerMemoryReload("manual"),
  };

  setInterval(runCheck, CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runCheck();
    }
  });

  console.log("[MemoryGuard] Monitor de memória ativo");
})();
