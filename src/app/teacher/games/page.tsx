import Link from "next/link";
import { ArrowRight, FlaskConical, Plus } from "lucide-react";

import { Brand } from "@/components/brand";
import { requireTeacher } from "@/lib/auth/teacher";
import { getTeacherOwnedGames } from "@/lib/data/teacher";

export const dynamic = "force-dynamic";

export default async function TeacherGamesPage() {
  const { adult } = await requireTeacher();
  const ownedGames = await getTeacherOwnedGames(adult.id);
  return <><header className="site-header"><div className="container-shell site-header-inner"><Brand /><nav className="site-nav"><Link href="/teacher/demo">Demo console</Link><Link className="button-primary" href="/teacher/games/new"><Plus size={16} /> New season</Link></nav></div></header><main id="main-content" className="container-shell" style={{ padding: "4rem 0 7rem" }}><div className="page-title"><div><span className="eyebrow">Teacher workspace</span><h1>Your seasons</h1><p className="muted" style={{ margin: ".6rem 0 0" }}>Create a classroom simulation, then add students and choose the rules.</p></div></div><div className="lesson-grid"><Link href="/teacher/demo" className="card lesson-card"><div><span className="status-pill"><FlaskConical size={13} /> Seeded demo</span><h2 className="display" style={{ fontSize: "2rem", margin: "1rem 0 .4rem" }}>Fall Market Lab</h2><p className="muted">12 sample students · Live IEX season · OAK-724</p></div><span className="button-secondary">Explore demo <ArrowRight size={16} /></span></Link>{ownedGames.map((game) => <Link href={`/teacher/games/${game.id}`} className="card lesson-card" key={game.id}><div><span className="status-pill">{game.status}</span><h2 className="display" style={{ fontSize: "2rem", margin: "1rem 0 .4rem" }}>{game.name}</h2><p className="muted">{game.joinCode} · {game.dataMode === "alpaca_iex" ? "live IEX" : game.dataMode} data</p></div><span className="button-primary">Manage season <ArrowRight size={16} /></span></Link>)}<Link href="/teacher/games/new" className="card lesson-card" style={{ borderStyle: "dashed", alignItems: "center", justifyContent: "center", textAlign: "center" }}><Plus size={30} /><strong>Create a new season</strong></Link></div></main></>;
}
