"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { readFlag, useBackToRegistration } from "@/lib/session";
import { surfaceKinds, type PurchasePath, type Verification, type Viewport } from "@/lib/types";
import { surfaceLabels } from "@/lib/labels";
import { pathLabel, viewportLabel } from "@/lib/format";

type Mode = "public" | "full";
type Method = "meta" | "file" | "dns";

const methodText: Record<Method, { label: string; hint: string }> = {
  meta: { label: "메타 태그", hint: "쇼핑몰 첫 화면의 <head> 안에 넣어주세요." },
  file: { label: "파일 업로드", hint: "아래 경로에 토큰 값만 담은 파일을 올려주세요." },
  dns: { label: "DNS TXT", hint: "도메인 DNS에 TXT 레코드를 추가해 주세요. 반영까지 시간이 걸릴 수 있어요." },
};

function urlProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "주소 형식을 확인해 주세요. https://로 시작하는 주소를 넣어주세요.";
  }
  if (url.protocol !== "https:") return "https 주소만 진단해요. 주소를 https://로 바꿔서 넣어주세요.";
  return null;
}

export function ScanForm() {
  const router = useRouter();
  const toast = useToast();
  const backToRegistration = useBackToRegistration();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const [viewport, setViewport] = useState<Viewport>("DESKTOP");
  const [path, setPath] = useState<PurchasePath>("CART");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [verification, setVerification] = useState<{ shopId: string } & Verification | null>(null);
  const [method, setMethod] = useState<Method>("meta");
  const [verifying, setVerifying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => setExpired(readFlag("expired")), []);

  const full = mode === "full";
  const hasAccount = Boolean(username && password);
  const problem = urlProblem(url);
  const ready = consent && url.trim().length > 0 && !problem;
  const credentials = hasAccount ? { username, password } : undefined;

  async function startScan(shopId: string, profile: "CONTEST" | "DYNAMIC") {
    const scan = await api.createScan({ shopId, profile, viewport, purchasePath: path, credentials: profile === "DYNAMIC" ? credentials : undefined });
    router.push(`/scan/${encodeURIComponent(scan.scanId)}${scan.deduplicated ? "?dedup=1" : ""}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!ready) return;
    setPending(true);
    setError("");
    setUnavailable(false);
    try {
      const shop = await api.createShop(url.trim(), consent);
      if (!full) return await startScan(shop.shopId, "CONTEST");
      if (hasAccount) return await startScan(shop.shopId, "DYNAMIC");
      if (!shop.verification) {
        setUnavailable(true);
        setPending(false);
        return;
      }
      setVerification({ shopId: shop.shopId, ...shop.verification });
      setPending(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToRegistration();
      else {
        setError(errorMessage(cause, "진단을 시작하지 못했어요. 잠시 후 다시 시도해 주세요."));
        setPending(false);
      }
    }
  }

  async function verifyAndScan() {
    if (!verification) return;
    setVerifying(true);
    setError("");
    try {
      await api.verifyShop(verification.shopId);
      await startScan(verification.shopId, "DYNAMIC");
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToRegistration();
      else {
        setError(errorMessage(cause, "소유 확인에 실패했어요."));
        setVerifying(false);
      }
    }
  }

  const code = verification ? { meta: verification.metaTag, file: verification.filePath, dns: verification.dnsRecord }[method] : "";

  const stagesPreview = [
    { name: "공개 첫 화면", dot: "ok", note: "확인" },
    { name: "상품 상세", dot: full ? "ok" : "partial", note: full ? "확인" : "처음 화면(초기 HTML)만" },
    { name: "장바구니", dot: path === "DIRECT" ? "skip" : full ? "ok" : "none", note: path === "DIRECT" ? "선택 경로에 없음" : full ? "확인" : "미검사" },
    { name: "주문서", dot: full ? "ok" : "none", note: full ? "결제 버튼 앞까지 확인" : "미검사" },
  ];
  const needsAccount = new Set(["AUTH", "SUBSCRIPTION", "CANCELLATION"]);
  const surfacesPreview = surfaceKinds.map((kind) => {
    if (!full) return { name: surfaceLabels[kind], dot: "skip", note: "전체 구매 흐름 진단에서 확인" };
    if (needsAccount.has(kind)) return { name: surfaceLabels[kind], dot: hasAccount ? "ok" : "partial", note: hasAccount ? "테스트 계정으로 읽기 전용 확인" : "후보만 찾기" };
    return { name: surfaceLabels[kind], dot: "ok", note: "공개 링크로 확인" };
  });

  return (
    <div className="split">
      {expired ? (
        <div style={{ flexBasis: "100%" }}>
          <Alert kind="brand" title="로그인이 만료되어 등록 화면으로 돌아왔어요">다시 로그인하면 계정에 저장된 쇼핑몰과 진단 이력을 볼 수 있어요. 진단 요청이 서버에서 계속 진행 중일 수 있습니다.</Alert>
        </div>
      ) : null}
      <form className="panel panel--feature" style={{ flex: "1 1 560px", minWidth: 0 }} onSubmit={submit} noValidate>
        <div className="panel__body" style={{ padding: "28px 32px", gap: 28 }}>
          <div className="field">
            <label htmlFor="scan-url" className="field__label" style={{ fontSize: 15, fontWeight: 700 }}>쇼핑몰 주소</label>
            <input
              id="scan-url" className="input input--lg" type="url" inputMode="url" placeholder="https://your-shop.com"
              value={url} onChange={(event) => setUrl(event.target.value)} onBlur={() => setTouched(true)}
              aria-invalid={touched && problem ? true : undefined} aria-describedby="scan-url-help" autoComplete="url"
            />
            <p id="scan-url-help" className={touched && problem ? "field__help field__help--error" : "field__help"}>
              {touched && problem ? <><Icon name="alert" size={16} /><span>{problem}</span></> : "공개 HTTPS 쇼핑몰 주소나 상품 상세 주소를 넣어주세요."}
            </p>
          </div>

          <fieldset style={{ margin: 0, padding: 0, border: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <legend style={{ padding: 0, marginBottom: 10, fontSize: 15, fontWeight: 700 }}>진단 범위</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <button type="button" className="choice" aria-pressed={!full} onClick={() => { setMode("public"); setVerification(null); }}>
                <span className="choice__title">공개 화면 진단</span>
                <span className="choice__body">주소만으로 바로 시작해요. 첫 화면과 상품 상세의 처음 모습을 확인해요.</span>
              </button>
              <button type="button" className="choice" aria-pressed={full} onClick={() => setMode("full")}>
                <span className="choice__title">전체 구매 흐름 진단</span>
                <span className="choice__body">상점 소유를 확인하고 장바구니와 주문서까지 확인해요. 보통 1분 안팎.</span>
              </button>
            </div>
          </fieldset>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            <div role="group" aria-labelledby="vp-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span id="vp-label" style={{ fontSize: 15, fontWeight: 700 }}>화면 환경</span>
              <div className="segmented">
                <button type="button" aria-pressed={viewport === "DESKTOP"} onClick={() => setViewport("DESKTOP")}>PC</button>
                <button type="button" aria-pressed={viewport === "MOBILE"} onClick={() => setViewport("MOBILE")}>모바일</button>
              </div>
            </div>
            <div role="group" aria-labelledby="path-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span id="path-label" style={{ fontSize: 15, fontWeight: 700 }}>구매 경로</span>
              <div className="segmented">
                <button type="button" aria-pressed={path === "CART"} onClick={() => setPath("CART")}>장바구니 경유</button>
                <button type="button" aria-pressed={path === "DIRECT"} onClick={() => setPath("DIRECT")}>바로구매</button>
              </div>
            </div>
          </div>

          {full ? (
            <fieldset className="rise" style={{ margin: 0, padding: 20, border: "1px solid var(--line)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 14 }}>
              <legend style={{ padding: "0 6px", fontSize: 15, fontWeight: 700 }}>테스트 계정 <span className="faint" style={{ fontWeight: 500 }}>(선택)</span></legend>
              <p className="muted" style={{ fontSize: 14 }}>회원 전용 가격, 로그인 이후 화면, 구독·해지 흐름까지 보려면 운영자가 만든 전용 테스트 계정을 넣어주세요. 비밀번호는 진단이 끝나면 삭제해요.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div className="field"><label htmlFor="acct-id" className="field__label">아이디</label><input id="acct-id" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                <div className="field"><label htmlFor="acct-pw" className="field__label">비밀번호</label><input id="acct-pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              </div>
            </fieldset>
          ) : null}

          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={touched && !consent ? true : undefined} />
            이 대상에 대한 자동 진단 권한이 있으며 검사에 동의합니다.
          </label>

          {unavailable ? (
            <Alert kind="warn" title="이 주소는 전체 구매 흐름 진단 확인 정보를 발급할 수 없어요" actions={<Button variant="secondary" size="sm" onClick={() => { setMode("public"); setUnavailable(false); }}>공개 화면 진단으로 시작</Button>}>
              공개 화면 진단으로 먼저 시작할 수 있어요.
            </Alert>
          ) : null}
          {error && !verification ? <Alert kind="error" title="진단을 시작하지 못했어요">{error}</Alert> : null}

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <Button type="submit" size="lg" disabled={!ready || Boolean(verification)} loading={pending} loadingText="요청 중">
              {full && !hasAccount ? "다음: 상점 소유 확인" : "진단 시작"}
            </Button>
            {!ready ? <span className="faint" style={{ fontSize: 13 }}>주소를 넣고 동의에 체크하면 시작할 수 있어요.</span> : null}
          </div>
        </div>

        {verification ? (
          <div className="rise" style={{ padding: "28px 32px", borderTop: "1px solid var(--line)", background: "#fbfbfc", borderRadius: "0 0 12px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 className="t-title" style={{ fontSize: 20 }}>상점 소유 확인</h2>
              <p className="muted" style={{ fontSize: 14 }}>세 방법 중 하나를 마친 뒤 확인을 눌러주세요. 인증 토큰은 저장하지 않아요.</p>
            </div>
            <div role="tablist" aria-label="확인 방법" className="tabs">
              {(Object.keys(methodText) as Method[]).map((key) => (
                <button key={key} type="button" role="tab" className="tab" aria-selected={method === key} onClick={() => setMethod(key)}>{methodText[key].label}</button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 14 }}>{methodText[method].hint}</p>
            <div className="code-copy">
              <code>{code}</code>
              <button type="button" className="btn btn--secondary btn--md" onClick={() => { void navigator.clipboard?.writeText(method === "file" ? verification.token : code); toast.show("확인 코드를 복사했어요"); }}>복사</button>
            </div>
            {method === "file" ? <p className="faint" style={{ fontSize: 13 }}>파일 내용: <code>{verification.token}</code></p> : null}
            {error ? <Alert kind="error" title="소유 확인에 실패했어요">{error}</Alert> : null}
            <div><Button size="lg" onClick={verifyAndScan} loading={verifying} loadingText="확인 중">소유 확인 후 진단 시작</Button></div>
          </div>
        ) : null}
      </form>

      <aside aria-label="이번 진단 범위" className="panel panel--feature split__rail sticky" style={{ flexBasis: 360, gap: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="t-caption">미리보기</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{full ? "전체 구매 흐름 진단" : "공개 화면 진단"}</span>
          <span className="muted" style={{ fontSize: 14 }}>{full ? "소유 확인 후 별도 브라우저 세션에서 상품 상세, 장바구니, 주문서까지 확인해요." : "주소만으로 바로 시작해요. 장바구니와 주문서는 미검사로 남아요."}</span>
        </div>
        <div aria-live="polite" style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="t-caption" style={{ fontWeight: 600 }}>구매 단계</span>
          <ul className="dot-list">{stagesPreview.map((s) => <li key={s.name}><span className={`dot dot--${s.dot}`} /><span><span className="dot-list__name">{s.name}</span><span className="dot-list__state">{s.note}</span></span></li>)}</ul>
          <span className="t-caption" style={{ fontWeight: 600, paddingTop: 10, borderTop: "1px solid var(--surface-sub)" }}>별도 탐색 영역</span>
          <ul className="dot-list">{surfacesPreview.map((s) => <li key={s.name}><span className={`dot dot--${s.dot}`} /><span><span className="dot-list__name">{s.name}</span><span className="dot-list__state">{s.note}</span></span></li>)}</ul>
          <dl style={{ margin: "8px 0 0", paddingTop: 12, borderTop: "1px solid var(--surface-sub)", display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 12px", fontSize: 14 }}>
            <dt className="faint">환경과 경로</dt><dd style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{viewportLabel(viewport, true)}, {pathLabel(path)}</dd>
            <dt className="faint">테스트 계정</dt><dd style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{full && hasAccount ? "전용 테스트 계정 사용" : "사용 안 함"}</dd>
            <dt className="faint">점검 항목</dt><dd style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>16가지</dd>
          </dl>
        </div>
        <div style={{ padding: "0 24px 22px" }}>
          <Alert title="실행하지 않는 것">결제, 주문 확정, 외부 사이트 이동은 하지 않아요. OTP·CAPTCHA가 나오면 우회하지 않고 미검사로 남겨요.</Alert>
        </div>
      </aside>
      {toast.node}
    </div>
  );
}
