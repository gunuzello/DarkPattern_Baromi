"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge, Mark, ScanStatusBadge } from "@/components/ui/Status";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useBackToLogin } from "@/lib/session";
import { formatDateTime, formatDuration, formatLongDate, hostOf, pathLabel, viewportLabel } from "@/lib/format";
import type { HistoryItem, Shop } from "@/lib/types";

type Tab = "all" | "active" | "done" | "stopped";
const group = (item: HistoryItem): Tab =>
  item.status === "QUEUED" || item.status === "RUNNING" ? "active" : item.status === "COMPLETED" || item.status === "PARTIAL" ? "done" : "stopped";

function action(item: HistoryItem) {
  const scan = encodeURIComponent(item.scanId);
  if (group(item) === "active") return { label: "진행 보기", href: `/scan/${scan}` };
  if (group(item) === "done") return { label: "결과 보기", href: `/report/${scan}` };
  return { label: item.status === "FAILED" ? "원인 보기" : "진행 기록", href: `/scan/${scan}` };
}

export function ShopHistory({ shopId }: { shopId: string }) {
  const [shop, setShop] = useState<Shop>();
  const [items, setItems] = useState<HistoryItem[]>();
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<"new" | "risk">("new");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const toast = useToast();
  const backToLogin = useBackToLogin();
  const [removeScan, setRemoveScan] = useState<HistoryItem | null>(null);
  const [removeShop, setRemoveShop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  useEffect(() => {
    let alive = true;
    setError(false);
    Promise.all([api.getShop(shopId), api.getShopScans(shopId)])
      .then(([shopInfo, scans]) => { if (alive) { setShop(shopInfo); setItems(scans); } })
      .catch((cause) => {
        if (!alive) return;
        if (cause instanceof ApiError && cause.sessionLost) backToLogin();
        else setError(true);
      });
    return () => { alive = false; };
  }, [shopId, attempt, backToLogin]);

  const hasActive = (items ?? []).some((item) => group(item) === "active");

  async function confirmRemoveScan() {
    if (!removeScan) return;
    setBusy(true);
    setDialogError("");
    try {
      await api.deleteScan(removeScan.scanId);
      setItems((current) => current?.filter((item) => item.scanId !== removeScan.scanId));
      toast.show("점검과 증거를 삭제했어요");
      setRemoveScan(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToLogin();
      else setDialogError(cause instanceof ApiError && cause.status === 409 ? "진행 중인 점검은 삭제할 수 없어요. 끝난 뒤 다시 시도해 주세요." : errorMessage(cause, "점검을 삭제하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveShop() {
    setBusy(true);
    setDialogError("");
    try {
      await api.deleteShop(shopId);
      router.replace("/shops");
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToLogin();
      else setDialogError(cause instanceof ApiError && cause.status === 409 ? "진행 중인 점검이 있어 삭제할 수 없어요. 끝나거나 중단한 뒤 다시 시도해 주세요." : errorMessage(cause, "쇼핑몰을 삭제하지 못했어요."));
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const list = items ?? [];
    return { all: list.length, active: list.filter((i) => group(i) === "active").length, done: list.filter((i) => group(i) === "done").length, stopped: list.filter((i) => group(i) === "stopped").length };
  }, [items]);

  const rows = useMemo(() => {
    const list = (items ?? []).filter((item) => tab === "all" || group(item) === tab);
    return sort === "risk"
      ? [...list].sort((a, b) => b.summary.suspected - a.summary.suspected || +new Date(b.createdAt) - +new Date(a.createdAt))
      : [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [items, tab, sort]);

  const tabs: [Tab, string][] = [["all", "전체"], ["active", "진행 중"], ["done", "완료"], ["stopped", "실패와 중단"]];

  return (
    <>
      <PageHead
        title="점검 기록"
        crumbs={[{ label: "내 쇼핑몰", href: "/shops" }, { label: shop ? shop.nickname?.trim() || hostOf(shop.url) : "쇼핑몰" }]}
        meta={shop ? <>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{shop.nickname?.trim() || hostOf(shop.url)}</span>{shop.nickname?.trim() ? <span className="faint">{hostOf(shop.url)}</span> : null}
          {shop.verifiedAt ? <Badge kind="clear">소유 확인됨</Badge> : <Badge kind="none">소유 확인 전</Badge>}
          {items?.length ? <span>첫 점검 {formatLongDate(items[items.length - 1].createdAt)}</span> : null}
        </> : undefined}
        actions={<>
          <Button variant="tertiary" onClick={() => { setDialogError(""); setRemoveShop(true); }} disabled={!items || hasActive} title={hasActive ? "진행 중인 점검이 끝나면 삭제할 수 있어요" : undefined}>쇼핑몰 삭제</Button>
          <ButtonLink href="/scan/new" icon="plus">새 점검</ButtonLink>
        </>}
      />
      {hasActive ? <p className="faint" style={{ fontSize: 13, marginTop: -16 }}>진행 중인 점검이 끝나면 쇼핑몰을 삭제할 수 있어요.</p> : null}

      {error ? (
        <Alert kind="error" title="점검 기록을 불러오지 못했어요" actions={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>다시 불러오기</Button>}>
          잠시 후 다시 시도해 주세요. 진행 중인 점검은 그대로 계속돼요.
        </Alert>
      ) : !items ? (
        <div className="panel pulse" aria-busy="true" aria-label="점검 기록을 불러오는 중" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((n) => <div key={n} style={{ display: "flex", gap: 12 }}><div className="skeleton" style={{ height: 12, width: "40%" }} /><div className="skeleton" style={{ height: 12, width: "20%" }} /></div>)}
        </div>
      ) : !items.length ? (
        <section className="panel" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <h2 className="t-title" style={{ fontSize: 20 }}>아직 점검 기록이 없어요</h2>
          <p className="muted">이 쇼핑몰의 첫 점검을 시작해 보세요.</p>
          <ButtonLink href="/scan/new" icon="plus">새 점검</ButtonLink>
        </section>
      ) : (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px", borderBottom: "1px solid var(--line)" }}>
            <div role="tablist" aria-label="상태로 거르기" className="tabs" style={{ borderBottom: 0 }}>
              {tabs.map(([key, label]) => (
                <button key={key} type="button" role="tab" className="tab" aria-selected={tab === key} onClick={() => setTab(key)} style={{ height: 52 }}>
                  {label}<span className="tab__count">{counts[key]}</span>
                </button>
              ))}
            </div>
            <span className="select" style={{ padding: "10px 0" }}>
              <label htmlFor="history-sort" className="sr-only">정렬</label>
              <select id="history-sort" className="input" style={{ width: 172 }} value={sort} onChange={(event) => setSort(event.target.value as "new" | "risk")}>
                <option value="new">최신순</option>
                <option value="risk">고쳐야 할 신호 많은 순</option>
              </select>
              <Icon name="down" color="var(--ink-2)" />
            </span>
          </div>
          <div className="table-wrap">
            <table className="table history-table">
              <thead>
                <tr><th scope="col">점검 일시</th><th scope="col">상태</th><th scope="col">범위</th><th scope="col">환경과 경로</th><th scope="col">결과</th><th scope="col" className="num">소요 시간</th><th scope="col"><span className="sr-only">동작</span></th></tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const next = action(item);
                  const hasResult = group(item) === "done";
                  return (
                    <tr key={item.scanId}>
                      <td className="tnum history-table__date" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatDateTime(item.createdAt)}</td>
                      <td data-label="상태"><ScanStatusBadge status={item.status} /></td>
                      <td data-label="범위">{item.executionMode === "DYNAMIC" ? "전체 구매 흐름" : "공개 화면"}</td>
                      <td data-label="환경과 경로" className="muted">{viewportLabel(item.viewport)}, {pathLabel(item.purchasePath)}</td>
                      <td data-label="결과">
                        {hasResult ? (
                          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                            <span className="verdict verdict--risk" title="찾은 신호 건수"><Mark kind="risk" />고쳐야 할 신호 <span className="tnum">{item.summary.suspected}</span>건</span>
                            <span className="verdict verdict--review" title="찾은 신호 건수"><Mark kind="review" />확인할 신호 <span className="tnum">{item.summary.reviewNeeded}</span>건</span>
                          </span>
                        ) : <span className="faint">—</span>}
                      </td>
                      <td data-label="소요 시간" className="num muted">{formatDuration(item.durationMs)}</td>
                      <td className="history-table__actions" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link href={next.href} className="btn btn--tertiary btn--sm">{next.label}<Icon name="chevron" size={14} /></Link>
                        {group(item) !== "active" ? (
                          <button type="button" className="btn btn--tertiary btn--sm" style={{ color: "var(--ink-2)" }} onClick={() => { setDialogError(""); setRemoveScan(item); }} aria-label={`${formatDateTime(item.createdAt)} 점검 삭제`}>삭제</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p style={{ padding: "32px 24px", textAlign: "center" }} className="muted">이 조건에 맞는 점검이 없어요.</p> : null}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, padding: "12px 16px", fontSize: 13 }} className="faint">
            <span>{rows.length}건 표시</span>
            <span>다시 점검 비교는 같은 상품, 같은 페이지, 같은 범위끼리만 해요</span>
          </div>
        </div>
      )}
      {removeScan ? (
        <ConfirmDialog title="이 점검을 삭제할까요?" confirmLabel="점검 삭제" onCancel={() => setRemoveScan(null)} onConfirm={confirmRemoveScan} busy={busy}>
          <p>{formatDateTime(removeScan.createdAt)} 점검의 결과와 확인 화면이 지워져요. 되돌릴 수 없어요.</p>
          {dialogError ? <p style={{ marginTop: 8, color: "var(--risk-ink)" }}>{dialogError}</p> : null}
        </ConfirmDialog>
      ) : null}
      {removeShop ? (
        <ConfirmDialog title="쇼핑몰을 삭제할까요?" confirmLabel="쇼핑몰 삭제" onCancel={() => setRemoveShop(false)} onConfirm={confirmRemoveShop} busy={busy}>
          <p>{shop ? shop.nickname?.trim() || hostOf(shop.url) : "이 쇼핑몰"}의 모든 점검 기록, 확인 화면이 지워져요. 되돌릴 수 없어요.</p>
          {dialogError ? <p style={{ marginTop: 8, color: "var(--risk-ink)" }}>{dialogError}</p> : null}
        </ConfirmDialog>
      ) : null}
      {toast.node}
    </>
  );
}
