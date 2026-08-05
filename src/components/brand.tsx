import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className="brand-mark focus-ring" href="/" aria-label="Market Lab home">
      <span className="brand-icon" aria-hidden="true">
        <TrendingUp size={19} strokeWidth={2.8} color="#153d34" />
      </span>
      <span style={{ color: inverse ? "white" : undefined }}>Market Lab</span>
    </Link>
  );
}
