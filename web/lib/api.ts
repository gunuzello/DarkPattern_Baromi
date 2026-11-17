import type {
  CancelResponse, CreateScanResponse, CreateShopResponse, FindingDetail, HistoryItem, OperatorLabel, PurchasePath, Report,
  ScanProfile, ScanState, Shop, ShopListResponse, Stage, VerifyResponse, Viewport,
} from "./types";
import { normalizeReport, normalizeScan, normalizeStatus } from "./normalize";
import { supabaseBrowser } from "./supabase/client";
import * as demo from "./demo";

/**
 * Client for the Baromi public API v1 (same-origin `/api/v1`).
 * Supabase Auth owns the user session; the current access token is attached to
 * every protected API request. The browser never reads the server's legacy owner cookie.
 */
export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** The public sample report (`/report/sample`) always uses built-in data, with or without a backend. */
export const SAMPLE_ID = "sample";
export const usesSample = (scanId?: string) => isDemo || scanId === SAMPLE_ID || Boolean(scanId?.startsWith("sample-"));

const fallback: Record<number, string> = {
  401: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  404: "찾을 수 없어요. 삭제됐거나 다른 계정의 항목일 수 있어요.",
  409: "지금 상태에서는 처리할 수 없어요.",
  429: "요청이 많아 잠시 막혔어요. 잠시 후 다시 시도해 주세요.",
  503: "저장소나 점검 작업기에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
  /** Supabase login missing or expired. A 404 is a real "not found" and is shown in place. */
  get sessionLost() {
    return this.status === 401;
  }
}

export function errorMessage(cause: unknown, otherwise: string): string {
  if (cause instanceof ApiError) {
    if (cause.status === 503 || cause.status === 429) return fallback[cause.status];
    return cause.message || fallback[cause.status] || otherwise;
  }
  return otherwise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    if (!isDemo && typeof window !== "undefined") {
      const { data } = await supabaseBrowser().auth.getSession();
      if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    response = await fetch("/api/v1/" + path, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 네트워크를 확인해 주세요.", 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error ?? fallback[response.status] ?? "요청을 처리하지 못했어요.", response.status);
  return body as T;
}

async function requestDownload(path: string): Promise<Blob> {
  let response: Response;
  try {
    const headers = new Headers();
    if (!isDemo && typeof window !== "undefined") {
      const { data } = await supabaseBrowser().auth.getSession();
      if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    response = await fetch(`/api/v1/${path}`, {
      headers,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 네트워크를 확인해 주세요.", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? fallback[response.status] ?? "파일을 내려받지 못했어요.", response.status);
  }
  return response.blob();
}

/** Plain authenticated request, used by the draft AI 정밀 점검 client (lib/aiDiagnosis.ts). */
export const aiDiagnosisFetch = <T>(path: string, init?: RequestInit) => request<T>(path, init);

const post = <T>(path: string, body: object) => request<T>(path, { method: "POST", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });
const seg = encodeURIComponent;

export type ScanRequest = {
  shopId: string;
  baselineScanId?: string;
  profile: ScanProfile;
  viewport: Viewport;
  purchasePath: PurchasePath;
  credentials?: { username: string; password: string };
};

/** Body of `POST /scans`: one product, purchase flow only; credentials only for DYNAMIC. */
function scanBody({ credentials, baselineScanId, ...rest }: ScanRequest) {
  return {
    ...rest,
    flows: ["PURCHASE"],
    productLimit: 1,
    ...(baselineScanId ? { baselineScanId } : {}),
    ...(rest.profile === "DYNAMIC" && credentials ? { credentials } : {}),
  };
}

export const api = {
  listShops: (limit = 50) =>
    isDemo ? demo.listShops() : request<ShopListResponse>(`shops?limit=${Math.max(1, Math.min(100, limit))}`),
  createShop: (url: string, consent: boolean, nickname?: string) =>
    isDemo ? demo.createShop(url, nickname) : post<CreateShopResponse>("shops", { url, consent, ...(nickname?.trim() ? { nickname: nickname.trim() } : {}) }),
  renameShop: (shopId: string, nickname: string) =>
    isDemo ? demo.renameShop(shopId, nickname) : request<Shop>(`shops/${seg(shopId)}`, { method: "PATCH", body: JSON.stringify({ nickname }) }),
  getShop: (shopId: string) =>
    isDemo ? demo.getShop(shopId) : request<Shop>(`shops/${seg(shopId)}`),
  verifyShop: (shopId: string) =>
    isDemo ? demo.verifyShop() : post<VerifyResponse>(`shops/${seg(shopId)}/verify`, {}),
  deleteShop: (shopId: string) =>
    isDemo ? demo.ok() : del<unknown>(`shops/${seg(shopId)}`),
  getShopScans: async (shopId: string) => {
    const items = isDemo ? await demo.getShopScans() : await request<HistoryItem[]>(`shops/${seg(shopId)}/scans`);
    return items.map((item) => ({ ...item, status: normalizeStatus(item.status) }));
  },

  createScan: (input: ScanRequest) =>
    isDemo ? demo.createScan(input) : post<CreateScanResponse>("scans", scanBody(input)),
  getScan: async (scanId: string) =>
    normalizeScan(isDemo ? await demo.getScan(scanId) : await request<ScanState>(`scans/${seg(scanId)}`)),
  cancelScan: async (scanId: string) => {
    const result = isDemo ? await demo.cancelScan(scanId) : await post<CancelResponse>(`scans/${seg(scanId)}/cancel`, {});
    return { status: normalizeStatus(result.status), cancelRequested: Boolean(result.cancelRequested) };
  },
  deleteScan: (scanId: string) =>
    isDemo ? demo.ok() : del<unknown>(`scans/${seg(scanId)}`),

  getReport: async (scanId: string) =>
    normalizeReport(usesSample(scanId) ? await demo.getReport(scanId) : await request<Report>(`scans/${seg(scanId)}/report`)),
  getFinding: (findingId: string, scanId?: string) =>
    usesSample(scanId) ? demo.getFinding(findingId) : request<FindingDetail>(`findings/${seg(findingId)}`),
  requestAiReview: (scanId: string) =>
    usesSample(scanId) ? demo.requestAiReview(scanId) : post<{ id: string; status: string }>(`scans/${seg(scanId)}/ai-review`, {}),
  saveLabels: (scanId: string, labels: { candidateId: string; label: OperatorLabel }[]) =>
    usesSample(scanId) ? demo.ok() : post<unknown>(`scans/${seg(scanId)}/ai-review-labels`, { labels }),

  downloadReport: (scanId: string) => requestDownload(`scans/${seg(scanId)}/report?download=1`),
  evidenceUrl: (scanId: string, stage: Stage) => `/api/v1/evidences/${seg(scanId)}-${stage}`,
  /** Screenshot as a blob, fetched with the login token (an <img> request cannot send it). */
  evidenceBlob: (scanId: string, stage: Stage) => requestDownload(`evidences/${seg(scanId)}-${stage}`),
};
