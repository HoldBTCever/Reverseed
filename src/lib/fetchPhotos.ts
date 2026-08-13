import "server-only";
import dns from "node:dns/promises";
import * as cheerio from "cheerio";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000;
const MAX_PHOTOS = 30;
const SKIP_KEYWORDS = ["logo", "icon", "favicon", "sprite", "avatar", "pixel"];

export class FetchPhotosError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("169.254."))
    return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80"))
    return true;
  return false;
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchPhotosError("Só são aceitos links http:// ou https://.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new FetchPhotosError("Esse endereço não pode ser acessado.");
  }
  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new FetchPhotosError("Não foi possível resolver esse endereço.");
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new FetchPhotosError("Esse endereço não pode ser acessado.");
  }
}

function isLikelyIcon(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function largestFromSrcset(srcset: string): string | null {
  const candidates = srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter((parts) => parts.length > 0 && parts[0]);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const widthA = parseInt(a[1] ?? "0", 10) || 0;
    const widthB = parseInt(b[1] ?? "0", 10) || 0;
    return widthB - widthA;
  });
  return candidates[0][0];
}

export function parsePhotoUrlsFromHtml(html: string, baseUrl: URL): string[] {
  const $ = cheerio.load(html);
  const found: string[] = [];

  const addCandidate = (raw: string | undefined | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:")) return;
    let absolute: string;
    try {
      absolute = new URL(trimmed, baseUrl).toString();
    } catch {
      return;
    }
    if (isLikelyIcon(absolute)) return;
    if (!found.includes(absolute)) found.push(absolute);
  };

  addCandidate($('meta[property="og:image"]').attr("content"));
  addCandidate($('meta[name="twitter:image"]').attr("content"));

  $("img").each((_, el) => {
    const node = $(el);
    addCandidate(node.attr("src"));
    addCandidate(node.attr("data-src"));
    addCandidate(node.attr("data-lazy-src"));
    const srcset = node.attr("srcset");
    if (srcset) addCandidate(largestFromSrcset(srcset));
  });

  $("source[srcset]").each((_, el) => {
    addCandidate(largestFromSrcset($(el).attr("srcset") ?? ""));
  });

  return found.slice(0, MAX_PHOTOS);
}

export async function extractPhotoUrlsFromPage(pageUrl: string): Promise<string[]> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    throw new FetchPhotosError("Link inválido.");
  }

  await assertPublicUrl(parsedUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ReverseedImoveisBot/1.0; +https://reverseed.com.py)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new FetchPhotosError(
        `Não foi possível abrir esse link (status ${response.status}).`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new FetchPhotosError("Esse link não parece ser uma página web.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new FetchPhotosError("Não foi possível ler essa página.");
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    html = Buffer.concat(chunks).toString("utf-8");
  } catch (err) {
    if (err instanceof FetchPhotosError) throw err;
    throw new FetchPhotosError("Não foi possível abrir esse link.");
  } finally {
    clearTimeout(timeout);
  }

  return parsePhotoUrlsFromHtml(html, parsedUrl);
}
