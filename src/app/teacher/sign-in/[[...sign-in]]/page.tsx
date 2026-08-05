import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Brand } from "@/components/brand";

export default function TeacherSignInPage() {
  return <main id="main-content" style={{ minHeight: "100vh", background: "var(--paper-2)", display: "grid", placeItems: "center", padding: "2rem" }}><div style={{ display: "grid", gap: "1.2rem", justifyItems: "center" }}><Brand /><SignIn routing="path" path="/teacher/sign-in" forceRedirectUrl="/teacher/games" /><Link className="button-quiet" href="/"><ArrowLeft size={16} /> Back to Market Lab</Link></div></main>;
}
