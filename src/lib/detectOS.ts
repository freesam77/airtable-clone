export type OSName = "Windows" | "macOS" | "iOS" | "Android" | "Linux" | "Unknown";

export function detectOS(): OSName {
  if (typeof window === "undefined") return "Unknown";

  const ua =
    window.navigator.userAgent ||
    window.navigator.vendor ||
    (window as any).opera ||
    "";

  if (/windows nt/i.test(ua)) {
    return "Windows";
  }

  if (/macintosh|mac os x/i.test(ua)) {
    // iPhones/iPads also contain "Mac OS X" in UA, so check separately
    if (/iphone|ipad|ipod/i.test(ua)) {
      return "iOS";
    }
    return "macOS";
  }

  if (/android/i.test(ua)) {
    return "Android";
  }

  if (/linux/i.test(ua)) {
    return "Linux";
  }

  return "Unknown";
}

