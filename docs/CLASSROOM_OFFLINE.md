# Market Lab on 15 Fire tablets

Use **https://stocks.mikesego.com/classroom** on the tablets. The existing `/app` workspace remains available for online assignments, learning completion, leaderboard, research charts, and market/limit orders. Classroom is the dedicated offline workspace: portfolio, downloaded investments, immediate buy/sell, trade history and reflections, and downloaded lesson reading.

The 15-tablet count below is a setup example, not a configured capacity. Market Lab has no fixed classroom tablet-count limit. Add a student login and prepare a tablet for each additional student. Enrollment, the device dashboard, and refresh-all use the actual assigned devices. Each student portfolio uses one assigned tablet at a time.

## One-time classroom setup

1. On your computer, open `/teacher/games`, sign in, and create an active season. Set the start/end dates, concentration limit, fractional-share rule, and rationale requirement.
2. Add 15 aliases/usernames with individual PINs in **Roster**. Keep a private list matching each login to **Fire 01** through **Fire 15**. Do not use the shared seeded demo account for your class.
3. On each Fire, update Fire OS and Silk using good Wi-Fi. Use the same regular Silk browser and device profile each time. Do not use private browsing. Amazon Kids/restricted profiles may have different browser/storage access; test in the actual profile the child will use.
4. Sign in at `/join` with that tablet's student credentials. Open `/classroom`, enter its label, and select **Prepare this device**. This downloads the app, student's current portfolio, featured investments, available lesson text, season rules, and exact prices. If the portfolio has waiting orders, cancel those on the online Orders page first.
5. Wait for **Ready for offline use** and **All trades backed up**. The readiness check verifies the entire app cache and successful browser storage. Persistent storage is requested where supported; its status appears in Device & help.
6. Bookmark `/classroom` in Silk. Installation is optional. If Silk offers Add to Home Screen/Install, use it; availability depends on the tablet/browser version.
7. Turn Wi-Fi off, reload the bookmark, and confirm the portfolio opens. Close the tab and reopen the bookmark while offline too. In a practice season, make a small buy and sell, reload again, then reconnect and verify they are backed up once. Repeat on all tablets: Chromium automation cannot certify every physical Fire/Silk combination.
8. Download additional symbols in **Discover & trade** while connected. Featured investments and existing holdings are included automatically; the limit is 100 downloaded investments per tablet.

## During class

- Each student uses their assigned tablet. One portfolio is assigned to one browser at a time, preventing disconnected devices from spending the same cash.
- Buying and selling complete immediately at the exact saved last-trade price, online or offline, including weekends and closed market hours. Cash, shares, and the trade receipt commit together to IndexedDB before success is displayed.
- Tickets display the source time and exact price. If a price refresh races a submission, the child is asked to review the changed price rather than receiving an unexpected fill.
- The portfolio uses the latest downloaded prices for valuation. Cash and holdings constraints, whole/fractional-share rules, concentration limits, minimum cash, and required reasoning apply locally and again on the server.
- **Saved on tablet / awaiting backup** describes a completed trade whose teacher copy has not arrived. It is not a queued order. Reconnect never reprices it.
- Downloaded learning labs can be read offline. Trade reflections travel with receipts into the online journal. Assignment submissions, lesson completion recording, charts, and the class leaderboard use the online workspace.
- Teacher pauses, student deactivation, and rule changes take effect on each disconnected tablet after it downloads updated rules. Its previously downloaded end date is enforced locally. For an immediate class-wide stop, collect the devices.

## After class: all devices together

1. Bring all tablets to good Wi-Fi and connect them to power with Classroom still open. Once the network returns, each tablet automatically uploads its completed trades and refreshes prices. No individual Sync tap is normally needed.
2. In **Device & help**, enable **Keep screen awake while Market Lab is visible** where supported. If unavailable, increase **Display Sleep** in Fire Settings and keep tablets charging. Wake-lock support is feature-detected; it is not promised for every Silk build.
3. On your computer, open the season's **Classroom devices** page. It refreshes about every 20 seconds and shows last check-in, backed-up trade count, price download, and any outstanding refresh request. Confirm each tablet checked in after class before judging standings.
4. **Request refresh on all devices** queues a request for every assigned device. Connected/awake devices receive it on their next check-in. Visible tablets also check in about every 20–25 seconds and refresh prices about every minute without a teacher request.
5. **All trades backed up** on a tablet means that its current local sequence has been acknowledged. The teacher cannot know about new unsynced work on a disconnected tablet, so an old check-in is never a promise that all its work has arrived.

### Closed apps and sleeping tablets

Market Lab registers one-off Background Sync and Periodic Background Sync when available. They can help upload/refresh after the tab closes, but Silk/Fire OS decides whether and when to run them. They are an optimization, not a guarantee.

A website cannot reliably wake a sleeping Fire, launch a closed Silk browser, or bypass battery restrictions. The dependable no-individual-opening routine is to leave Classroom open when you collect the tablets, then reconnect and charge them together. Guaranteed unattended wake/start after closure or reboot would require device-management/kiosk software or a native Fire/Android app with suitable device permissions; that is outside what a deployed website can do.

## Switching students or tablets

1. On the original tablet, reconnect and wait for **All trades backed up**.
2. Choose **Device & help → Release this device**. Confirm the named student/tablet. Release preserves the server's history and removes that browser's classroom copy.
3. Sign in as the next student online, return to Classroom, and prepare it. Or sign in as the same student on the replacement tablet and prepare that tablet.
4. Ordinary student sign-out does not discard the dedicated classroom assignment or its unsynced work. Device assignment is separate from the 14-day online student login and remains valid until explicitly released.

## Recovery and practical limits

- Never clear Silk website data, reset a tablet, uninstall its browser, or change profiles with unsynced work. Persistent-storage grants reduce automatic eviction but cannot prevent deliberate deletion. Lost local data that was never synced or exported cannot be recovered from the server.
- **Download backup** in Device & help creates a JSON file containing the portfolio, original receipts/price packs, and device access key. Keep it private with the teacher.
- To restore a backup, use **Restore a teacher-held backup** on an unassigned Classroom page. Keep the original tablet closed; do not run two copies of its credential. Reconnect to verify/upload the saved receipts, then release/reprepare to retire the restored credential if moving permanently. An older backup missing receipts already present on the server stops with a clear conflict; use the latest complete backup rather than guessing at missing trades.
- Failed uploads retain all unacknowledged work. Successful server commits with lost responses retry the same receipt IDs/sequences; server transactions and replay fingerprints prevent duplicate fills. Local saves serialize across tabs and background workers.
- Provider failures retain the entire previous price pack and do not prevent saved-price trading or trade backup. A symbol without any downloaded price is unavailable offline. No made-up price is used.
- A stock split or dividend does not silently modify an assigned tablet's server portfolio. Recorded corporate events wait for device reconciliation after its earlier trades are uploaded. The tablet briefly pauses new trades while it atomically receives adjusted holdings and new prices. If that refresh fails, it stays in recovery mode until a successful reconnect, preserving all receipts. This avoids mixing pre-split holdings with post-split prices. Corporate-action availability still depends on the application's event ingestion; the market-data adapter itself supplies quotes/assets/bars.
- Use automatic date/time on all tablets. Future-dated or missing receipts, unknown price packs, changed server balances, or sequence conflicts stop synchronization for review and preserve a downloadable backup. The server verifies price provenance and arithmetic; it cannot independently prove the clock time or what a disconnected child saw. This is a teacher-managed classroom simulation, not an adversarial trading competition.
- Devices can have different price timestamps when connectivity differs. This is intentional under the latest-known-price rule. Synchronize before class when comparable starting prices matter; sync every tablet before final standings.

## Engineering and deployment

- `npm run build:classroom` bundles the standalone React classroom and classic service worker to `public/classroom/`. Both `predev` and `prebuild` run it automatically. No Clerk script, external font, Next.js server-rendered response, or external asset is required to reopen the cached classroom.
- `/classroom` rewrites to the static shell. The worker's explicit scope and cache allowlist cover only classroom shell/resources, never authentication, teacher HTML, or API responses. All dependencies must precache successfully before readiness. Updates wait for old tabs to close; IndexedDB data survives app-cache replacement.
- Apply Drizzle migrations before deploying. `classroom_devices` stores scoped credential hashes and sequence/version ownership; immutable `classroom_price_packs` provide authoritative price/rule provenance. `corporate_action_applications` permits per-portfolio idempotent reconciliation.
- Device requests are JSON POSTs with scoped bearer authorization. Enrollment requires the ordinary authenticated student session and portfolio lock. No provider or database keys reach a tablet.
- The server replays receipts with the same Decimal.js accounting as the device and writes orders, fills, cash ledger, positions, journal, audit evidence, and sequence acknowledgement in one transaction. Each retry verifies its original receipt fingerprint. Trade upload does not call the price provider.
- The regression suite covers decimal/rule checks, atomic IndexedDB updates, concurrent tabs, lost response/retry, sync-in-flight trades, provider failure, offline close/reopen, new-price execution, credential isolation, and real API/database reconciliation. See `tests/unit/classroom.test.ts` and `tests/e2e/classroom.spec.ts`.

Browser references: [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API), [Periodic Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API), and [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). All are feature-detected rather than inferred from a device's name.
