import type { Metadata } from "next";
import { InfoSections, PublicInfoPage } from "@/components/public-info-page";

export const metadata: Metadata = { title: "Privacy" };
export default function PrivacyPage() {
  return <PublicInfoPage eyebrow="Trust center" title="Privacy designed for classrooms." intro="This development policy explains the product’s intended data practices. A qualified privacy review is required before real-student launch."><InfoSections sections={[
    { title: "Data minimization", body: <p>Student participation is designed around a classroom alias, login credential, portfolio activity, learning progress, and teacher feedback. Student email addresses, advertising identifiers, precise location, and brokerage credentials are not needed.</p> },
    { title: "How information is used", body: <p>Records support authentication, the simulation, teacher reporting, safety, product operation, and legally required administration. Student data is not intended for targeted advertising or sale.</p> },
    { title: "Teacher and school controls", body: <p>Authorized adults can manage rosters, reset student credentials, export class records, archive seasons, and initiate deletion according to the school’s retention choices.</p> },
    { title: "Development status", body: <p>This site currently contains demonstration data and is not approved for real students. COPPA, FERPA, state student-privacy requirements, contracts, subprocessors, retention, and incident procedures must be reviewed before launch.</p> },
  ]} /></PublicInfoPage>;
}
