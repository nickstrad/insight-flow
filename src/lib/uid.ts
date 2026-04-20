"use client";

import { useEffect, useState } from "react";

const KEY = "insight-flow:uid";

export function getOrCreateUid(): string {
  if (typeof window === "undefined") return "";
  let uid = window.localStorage.getItem(KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    window.localStorage.setItem(KEY, uid);
  }
  return uid;
}

export function useUid(): string {
  const [uid, setUid] = useState<string>("");
  useEffect(() => {
    setUid(getOrCreateUid());
  }, []);
  return uid;
}
