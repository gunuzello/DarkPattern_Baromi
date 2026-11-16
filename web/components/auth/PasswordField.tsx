"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Password input with a show/hide toggle and an optional rule hint. */
export function PasswordField({ label = "비밀번호", value, onChange, autoComplete, hint, invalid, aside }: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  invalid?: boolean;
  aside?: React.ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <div className="auth-field__row">
        <label htmlFor={id} className="field__label">{label}</label>
        {aside}
      </div>
      <div className="auth-password">
        <input
          id={id}
          className="input input--lg"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          required
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="auth-password__toggle" aria-pressed={visible} aria-controls={id} onClick={() => setVisible(!visible)}>
          <Icon name="eye" size={16} />{visible ? "숨기기" : "보기"}
        </button>
      </div>
      {hint ? <span id={`${id}-hint`} className="field__help">{hint}</span> : null}
    </div>
  );
}
