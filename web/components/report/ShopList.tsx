"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { hostOf } from "@/lib/format";
import { useBackToLogin } from "@/lib/session";
import type { ShopListResponse } from "@/lib/types";

type ShopRow = ShopListResponse["shops"][number];

/** `GET /shops`: every shop registered in this browser session. */
export function ShopList() {
  const toast = useToast();
  const [shops, setShops] = useState<ShopRow[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<ShopRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const backToLogin = useBackToLogin();

  useEffect(() => {
    let alive = true;
    setError("");
    api.listShops()
      .then((result) => { if (alive) setShops(result.shops); })
      .catch((cause) => {
        if (!alive) return;
        if (cause instanceof ApiError && cause.sessionLost) backToLogin();
        else setError(errorMessage(cause, "쇼핑몰 목록을 불러오지 못했어요."));
      });
    return () => { alive = false; };
  }, [attempt, backToLogin]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setRemoveError("");
    try {
      await api.deleteShop(removing.shopId);
      setShops((current) => current?.filter((shop) => shop.shopId !== removing.shopId));
      toast.show("쇼핑몰과 점검 기록을 삭제했어요");
      setRemoving(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToLogin();
      else setRemoveError(errorMessage(cause, "쇼핑몰을 삭제하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>, shop: ShopRow) {
    event.preventDefault();
    const nickname = nicknameDraft.trim();
    if (!nickname || nickname.length > 80) {
      setRenameError("쇼핑몰 이름을 1~80자로 입력해 주세요.");
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      await api.renameShop(shop.shopId, nickname);
      setShops((current) => current?.map((item) => item.shopId === shop.shopId ? { ...item, nickname } : item));
      setEditingId(null);
      toast.show("쇼핑몰 이름을 저장했어요");
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToLogin();
      else setRenameError(errorMessage(cause, "쇼핑몰 이름을 저장하지 못했어요."));
    } finally {
      setRenaming(false);
    }
  }

  return (
    <>
      <PageHead
        title="내 쇼핑몰"
        meta={<span>계정에 등록한 쇼핑몰이에요. 쇼핑몰을 고르면 점검 기록을 볼 수 있어요.</span>}
        actions={<ButtonLink href="/scan/new" icon="plus">새 점검</ButtonLink>}
      />
      {error ? (
        <Alert kind="error" title="쇼핑몰 목록을 불러오지 못했어요" actions={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>다시 불러오기</Button>}>{error}</Alert>
      ) : !shops ? (
        <div className="panel pulse" aria-busy="true" aria-label="쇼핑몰 목록을 불러오는 중" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 14, width: `${60 - n * 12}%` }} />)}
        </div>
      ) : !shops.length ? (
        <section className="panel" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <h2 className="t-title" style={{ fontSize: 20 }}>첫 쇼핑몰을 등록해 주세요</h2>
          <p className="muted">주소를 등록하면 구매 흐름 점검을 시작할 수 있어요.</p>
          <ButtonLink href="/scan/new" icon="plus">쇼핑몰 등록하고 점검하기</ButtonLink>
        </section>
      ) : (
        <ul className="shop-cards">
          {shops.map((shop) => (
            <li key={shop.shopId} className="shop-card">
              <Link href={`/shop/${encodeURIComponent(shop.shopId)}`} className="shop-card__main">
                <span className="shop-card__icon" aria-hidden><Icon name="shop" size={20} /></span>
                <span className="shop-card__text">
                  <b>{shop.nickname?.trim() || hostOf(shop.url)}</b>
                  <span>{shop.url}</span>
                </span>
                <Icon name="chevron" size={16} color="var(--ink-3)" />
              </Link>
              <div className="shop-card__foot">
                <span className="shop-card__actions">
                  <ButtonLink variant="secondary" size="sm" href={`/shop/${encodeURIComponent(shop.shopId)}`}>점검 기록 보기</ButtonLink>
                  <Button variant="tertiary" size="sm" onClick={() => { setEditingId(shop.shopId); setNicknameDraft(shop.nickname ?? ""); setRenameError(""); }}>이름 수정</Button>
                </span>
                <Button variant="tertiary" size="sm" onClick={() => { setRemoveError(""); setRemoving(shop); }} aria-label={`${hostOf(shop.url)} 삭제`}>삭제</Button>
              </div>
              {editingId === shop.shopId ? (
                <form onSubmit={(event) => void rename(event, shop)} style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <label htmlFor={`shop-name-${shop.shopId}`} className="sr-only">쇼핑몰 이름</label>
                  <input id={`shop-name-${shop.shopId}`} className="input" autoFocus maxLength={80} value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} placeholder="쇼핑몰 이름" style={{ flex: "1 1 220px" }} />
                  <Button type="submit" size="sm" loading={renaming} loadingText="저장 중">저장</Button>
                  <Button type="button" variant="tertiary" size="sm" disabled={renaming} onClick={() => { setEditingId(null); setRenameError(""); }}>취소</Button>
                  {renameError ? <span role="alert" style={{ flexBasis: "100%", color: "var(--risk-ink)", fontSize: 13 }}>{renameError}</span> : null}
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {removing ? (
        <ConfirmDialog title="쇼핑몰을 삭제할까요?" confirmLabel="쇼핑몰 삭제" onCancel={() => setRemoving(null)} onConfirm={remove} busy={busy}>
          <p>{hostOf(removing.url)}의 점검 기록과 확인 화면도 함께 지워져요. 되돌릴 수 없어요.</p>
          {removeError ? <p style={{ marginTop: 8, color: "var(--risk-ink)" }}>{removeError}</p> : null}
        </ConfirmDialog>
      ) : null}
      {toast.node}
    </>
  );
}
