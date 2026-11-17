"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const CONTACT = "hello@baromi.app";
/**
 * Where sign-ups go. Set NEXT_PUBLIC_WAITLIST_ENDPOINT to a form backend that accepts
 * JSON `{ email }` (e.g. a Formspree form URL). Without it there is nowhere to store the
 * address, so the form says so and offers an e-mail draft instead of faking success.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;

type State = { kind: "idle" | "sending" | "done" | "error" | "manual"; message?: string };

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ENDPOINT) {
      setState({ kind: "manual" });
      return;
    }
    setState({ kind: "sending" });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, source: "pricing:ai-review" }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요." });
    }
  }

  if (state.kind === "done") {
    return (
      <p role="status" className="waitlist__done">
        <Icon name="check" size={16} color="var(--clear-ink)" />
        신청했어요. {email}로 파일럿 안내를 보내 드릴게요.
      </p>
    );
  }

  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent("AI 정밀 점검 파일럿 신청")}&body=${encodeURIComponent(`파일럿 안내 받을 주소: ${email}`)}`;

  return (
    <form className="waitlist" onSubmit={submit} noValidate={false}>
      <label className="field" style={{ minWidth: 0 }}>
        <span className="sr-only">파일럿 신청 이메일</span>
        <input
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder="파일럿 신청 이메일"
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (state.kind !== "idle" && state.kind !== "sending") setState({ kind: "idle" }); }}
        />
      </label>
      <Button type="submit" variant="secondary" loading={state.kind === "sending"} loadingText="보내는 중">파일럿 신청</Button>
      {state.kind === "error" ? <p role="alert" className="waitlist__note waitlist__note--error">{state.message}</p> : null}
      {state.kind === "manual" ? (
        <p role="status" className="waitlist__note">
          아직 온라인 신청을 받지 않아요. <a href={mailto}>메일로 신청하기</a>를 누르거나 {CONTACT}로 주소를 보내 주세요.
        </p>
      ) : null}
    </form>
  );
}
