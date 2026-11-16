"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useBackToLogin } from "@/lib/session";
import type { ExecutionMode, PurchasePath, Viewport } from "@/lib/types";

type Target = { shopId: string; executionMode?: ExecutionMode; viewport: Viewport; purchasePath: PurchasePath; baselineScanId?: string };

/**
 * Start the same scan again. A full purchase-flow scan of a shop whose ownership was never
 * verified ran on a test account; the password is deleted after each scan, so ask for it again.
 */
export function useRescan(onError: (message: string) => void) {
  const router = useRouter();
  const backToLogin = useBackToLogin();
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<Target | null>(null);

  async function launch(target: Target, credentials?: { username: string; password: string }) {
    const next = await api.createScan({
      shopId: target.shopId,
      baselineScanId: target.baselineScanId,
      profile: target.executionMode === "DYNAMIC" ? "DYNAMIC" : "CONTEST",
      viewport: target.viewport,
      purchasePath: target.purchasePath,
      credentials,
    });
    router.push(`/scan/${encodeURIComponent(next.scanId)}${next.deduplicated ? "?dedup=1" : ""}`);
  }

  async function start(target: Target) {
    setPending(true);
    try {
      if (target.executionMode === "DYNAMIC") {
        const shop = await api.getShop(target.shopId);
        if (!shop.verifiedAt) { setAsking(target); setPending(false); return; }
      }
      await launch(target);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToLogin();
      else { onError(errorMessage(cause, "다시 점검을 시작하지 못했어요.")); setPending(false); }
    }
  }

  const dialog = (
    <AccountDialog
      open={Boolean(asking)}
      onClose={() => setAsking(null)}
      onSubmit={async (credentials) => {
        if (!asking) return;
        await launch(asking, credentials);
      }}
    />
  );
  return { start, pending, dialog };
}

function AccountDialog({ open, onClose, onSubmit }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (credentials: { username: string; password: string }) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); firstField.current?.focus(); }
    if (!open && dialog.open) dialog.close();
    if (!open) { setPassword(""); setError(""); }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ username: username.trim(), password });
    } catch (cause) {
      setError(errorMessage(cause, "다시 점검을 시작하지 못했어요."));
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="rv-dialog" aria-labelledby="rescan-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="rv-dialog__inner" onSubmit={submit}>
        <span className="rv-dialog__grip" aria-hidden />
        <h2 id="rescan-title" className="rv-dialog__title">테스트 계정을 다시 넣어 주세요</h2>
        <p className="muted">이 쇼핑몰은 소유 확인 없이 테스트 계정으로 점검했어요. 비밀번호는 점검이 끝나면 지우기 때문에, 같은 조건으로 다시 점검하려면 한 번 더 입력해야 해요.</p>
        <div className="field">
          <label htmlFor="rescan-id" className="field__label">아이디</label>
          <input ref={firstField} id="rescan-id" className="input input--lg" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rescan-pw" className="field__label">비밀번호</label>
          <input id="rescan-pw" className="input input--lg" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <p className="faint" style={{ fontSize: 13 }}>소유 확인을 마치면 다음부터는 계정 없이도 다시 점검할 수 있어요. <Link href="/scan/new">소유 확인하러 가기</Link></p>
        {error ? <Alert kind="error" title={error} /> : null}
        <div className="rv-dialog__actions">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit" loading={busy} loadingText="요청 중">다시 점검하기</Button>
        </div>
      </form>
    </dialog>
  );
}
