"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { joinStudent, type JoinState } from "@/app/actions/student-auth";

const initialState: JoinState = {};

export function JoinForm() {
  const [state, action, pending] = useActionState(joinStudent, initialState);
  return (
    <form action={action} style={{ display: "grid", gap: "1rem" }}>
      {state.error ? <div className="error-box" role="alert">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="code">Class code</label>
        <input className="input" id="code" name="code" autoCapitalize="characters" autoComplete="off" defaultValue={state.values?.code ?? "OAK-724"} placeholder="ABC-123" required />
      </div>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input className="input" id="username" name="username" autoComplete="username" defaultValue={state.values?.username ?? "AveryFox"} placeholder="Your classroom username" required />
      </div>
      <div className="field">
        <label htmlFor="pin">PIN</label>
        <input className="input" id="pin" name="pin" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,8}" defaultValue="2468" placeholder="4–8 digits" required type="password" />
      </div>
      <button className="button-primary focus-ring" disabled={pending} type="submit">
        {pending ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {pending ? "Opening your portfolio…" : "Enter Market Lab"}
      </button>
      <p className="muted" style={{ fontSize: ".76rem", lineHeight: 1.55, textAlign: "center" }}>
        Your teacher creates this account. Students do not need to share an email address or full legal name.
      </p>
    </form>
  );
}
