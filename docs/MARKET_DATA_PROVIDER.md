# Market data and classroom execution

Market Lab uses **Alpaca Basic with the real-time IEX feed** through a server-only `MarketDataProvider`. Credentials remain in server environment variables. Every order is simulated; Market Lab never places brokerage orders.

The adapter retrieves active tradable U.S. stocks and ETFs, IEX snapshots, and adjusted daily bars. Twelve curated investments provide the default classroom download. Students can download additional supported symbols while connected, up to 100 investments per tablet. IEX is one exchange, so its prices may differ from consolidated market prices. Source timestamps remain visible.

## Classroom mode

The `/classroom` workspace implements immediate execution at the latest successfully downloaded last-trade price, for both buys and sells. It works during and outside regular market hours, including weekends. A stale or disconnected price is still executable by design; it is labeled with its original source time. No synthetic prices, spreads, or future prices are substituted.

Each completed trade refers to an immutable server-recorded price pack containing instrument identifiers, exact decimal prices, timestamps, and the season rules at download. The tablet saves the portfolio change and receipt atomically in IndexedDB. On reconnect, the server replays those receipts using the original pack and shared decimal calculations, with sequential, idempotent accounting. New prices affect only subsequent trades and current valuation.

Refresh failure preserves the prior complete pack. Backup failure preserves local receipts for retry. No market-data request is needed to accept a previously completed classroom trade. Class pauses and rule changes take effect on each tablet when it downloads updated rules; a disconnected device continues with its last downloaded rules until the saved season end time.

## Online market/limit mode

The existing `/app` workspace retains regular-session market/limit order matching, ask/bid pricing, and freshness checks. A portfolio assigned to a classroom tablet must trade through that tablet. Release the tablet after syncing to return to online market/limit orders.

## Provider operations

Keep provider keys server-only. Watch provider errors, timestamp age, and symbol coverage. A partial download does not advance the device's price pack. Polling is approximately once per minute per visible tablet; check-ins and uploads are separate from provider availability. Provider metadata and underlying price timestamps distinguish a successful download from a recent market trade.

Robinhood MCP remains outside the application runtime. Nothing in the classroom flow reaches a brokerage order API.
