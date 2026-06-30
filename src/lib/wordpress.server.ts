// Server-only helpers for WordPress + crypto + audit.
// Never import from client modules.
import { parse } from "node-html-parser";
import { createHash } from "crypto";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  let s = url.toString();
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function basicAuthHeader(user: string, pass: string): string {
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<{ ok: boolean; status: number; data?: T; text?: string; headers: Headers }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init?.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const headers = res.headers;
    const ct = headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as T;
      return { ok: res.ok, status: res.status, data, headers };
    }
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers };
  } finally {
    clearTimeout(t);
  }
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ---- WordPress parsing ----
export type WpItem = {
  id: number;
  slug: string;
  status: string;
  type: string;
  link: string;
  modified_gmt: string;
  title: { rendered: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string };
  yoast_head_json?: { description?: string; title?: string };
  rank_math_description?: string;
  meta?: Record<string, unknown>;
};

export type ExtractedPage = {
  word_count: number;
  headings: { level: number; text: string }[];
  internal_links: string[];
  outbound_links: string[];
  images: { src: string; alt: string }[];
  schema_jsonld: unknown[];
  affiliate_links: string[];
};

const AFFILIATE_HOST_PATTERNS = [
  /amazon\.[a-z.]+\/dp\//i,
  /amzn\.to/i,
  /go\.skimresources/i,
  /shareasale\.com/i,
  /awin1\.com/i,
  /impact\.com/i,
  /cj\.com/i,
  /linksynergy/i,
  /\?tag=/i,
  /[?&]aff(_id|iliate)?=/i,
];

export function extractFromHtml(html: string, baseUrl: string): ExtractedPage {
  if (!html) {
    return {
      word_count: 0,
      headings: [],
      internal_links: [],
      outbound_links: [],
      images: [],
      schema_jsonld: [],
      affiliate_links: [],
    };
  }
  const root = parse(html);
  const baseHost = safeHost(baseUrl);

  const headings = root.querySelectorAll("h1,h2,h3").map((h) => ({
    level: Number(h.tagName.replace(/\D/g, "")) || 0,
    text: h.text.trim().slice(0, 240),
  }));

  const internal: string[] = [];
  const outbound: string[] = [];
  const affiliates: string[] = [];
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    let abs = href;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const host = safeHost(abs);
    if (host === baseHost) internal.push(abs);
    else {
      outbound.push(abs);
      if (AFFILIATE_HOST_PATTERNS.some((re) => re.test(abs))) affiliates.push(abs);
    }
  }

  const images = root.querySelectorAll("img").map((i) => ({
    src: i.getAttribute("src") || "",
    alt: i.getAttribute("alt") || "",
  }));

  const schemas: unknown[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      schemas.push(JSON.parse(s.text));
    } catch {
      /* ignore */
    }
  }

  const text = root.text.replace(/\s+/g, " ").trim();
  const word_count = text ? text.split(" ").length : 0;

  return {
    word_count,
    headings,
    internal_links: dedupe(internal),
    outbound_links: dedupe(outbound),
    images,
    schema_jsonld: schemas,
    affiliate_links: dedupe(affiliates),
  };
}

function dedupe<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}

function safeHost(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}
