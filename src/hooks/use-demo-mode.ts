import { useEffect, useState } from "react";

const KEY = "autotraffic.demoMode";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function useDemoMode(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(false);
  useEffect(() => {
    setV(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setV(read());
    };
    const onCustom = () => setV(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("autotraffic:demo-mode", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("autotraffic:demo-mode", onCustom);
    };
  }, []);
  const set = (next: boolean) => {
    window.localStorage.setItem(KEY, next ? "1" : "0");
    window.dispatchEvent(new Event("autotraffic:demo-mode"));
    setV(next);
  };
  return [v, set];
}

export function isDemoMode(): boolean {
  return read();
}
