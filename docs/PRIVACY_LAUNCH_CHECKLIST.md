# Privacy and real-student launch checklist

The production hostname currently runs as Mike’s sole-user personal demo with live Alpaca Basic IEX data and simulated trading. It must not be shared or used with real students until every applicable item below has an accountable owner and written approval.

## Data and identity

- [ ] Execute a licensed business market-data agreement permitting the exact student/teacher display and derived uses.
- [ ] Replace development Clerk keys with a production Clerk instance and configure approved adult sign-in methods.
- [ ] Generate independent production `STUDENT_AUTH_PEPPER` and `CRON_SECRET` values.
- [ ] Set and verify `OPERATOR_EMAILS` using least privilege.
- [ ] Confirm student accounts need no email, legal name, phone number, precise location, advertising ID, or brokerage connection.
- [ ] Confirm unique student PINs and secure login-card handling with teachers.
- [ ] Configure deletion, export, correction, session revocation, and school offboarding workflows.
- [ ] Set retention periods for student work, financial simulation history, sessions, login-rate-limit records, logs, and backups.

## School and child privacy

- [ ] Obtain qualified counsel review for FERPA, COPPA, applicable state student-privacy laws, school contracts, and parental-consent responsibilities.
- [ ] Publish final privacy notice, terms, subprocessors, security contact, and accessibility contact.
- [ ] Execute required data-processing/student-privacy agreements with schools.
- [ ] Verify vendors are configured without behavioral advertising or unrelated profiling.
- [ ] Complete a data-flow inventory and data-protection impact review.
- [ ] Define and test parent/school access and deletion response procedures.

## Security and reliability

- [ ] Review authorization for teacher, student, operator, job, and API routes.
- [ ] Run dependency, secret, SAST, and production-header checks.
- [ ] Perform abuse testing for login enumeration, rate-limit bypass, IDOR, CSRF, injection, and order replay.
- [ ] Enable database recovery, monitoring, error alerting, and an incident-response contact rotation.
- [ ] Test restoration and financial reconciliation on an isolated copy.
- [ ] Validate quote freshness, corporate actions, session rules, fill policy, and all licensed-provider entitlements.
- [ ] Load-test class sign-in, discovery, portfolio refresh, order open, and market-close bursts.
- [ ] Verify WCAG 2.2 AA target journeys with automated and manual keyboard/screen-reader testing.

## Product and classroom readiness

- [ ] Replace the personal-demo warning only after the provider agreement covers the intended users and the feed is correctly labeled.
- [ ] Confirm all simulated-trading and educational-not-advice disclosures.
- [ ] Verify financial leaderboard uses only equity/return and learning remains separate.
- [ ] Confirm aliases-only student leaderboard defaults and teacher visibility controls.
- [ ] Review grade-band language with practicing elementary and middle-school educators.
- [ ] Pilot with adults, then a contractually approved small school cohort, before broader availability.
- [ ] Prepare teacher onboarding, login-card guidance, help material, incident communication, and support ownership.

Nothing in this checklist is legal advice. The purpose is to make the required professional review and operational decisions explicit rather than silently treating a technically working demo as a child-ready launch.
