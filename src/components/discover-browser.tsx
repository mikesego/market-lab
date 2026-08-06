"use client";

import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type { InvestmentSearchResult } from "@/lib/market/search-types";
import { formatMoney, formatPercent } from "@/lib/utils";

const BROWSE_FILTERS = ["All", "Stocks", "ETFs", "Technology", "Consumer", "Broad market"] as const;
const SEARCH_FILTERS = ["All", "Stocks", "ETFs"] as const;
type Filter = (typeof BROWSE_FILTERS)[number];

function matchesFilter(investment: InvestmentSearchResult, filter: Filter) {
  if (filter === "Stocks") return investment.assetType === "stock";
  if (filter === "ETFs") return investment.assetType === "etf";
  if (filter === "Technology") return investment.sector === "Technology";
  if (filter === "Consumer") return investment.sector.includes("Consumer");
  if (filter === "Broad market") return investment.sector === "Broad Market";
  return true;
}

function matchesQuery(investment: InvestmentSearchResult, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || [investment.symbol, investment.name, investment.sector]
    .some((value) => value.toLowerCase().includes(normalized));
}

export function DiscoverBrowser({ featured }: { featured: InvestmentSearchResult[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [filter, setFilter] = useState<Filter>("All");
  const [remoteResults, setRemoteResults] = useState<InvestmentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const searchMode = deferredQuery.length > 0;
  const activeSearching = searchMode && searching;
  const activeSearchError = searchMode ? searchError : undefined;
  const filters = searchMode ? SEARCH_FILTERS : BROWSE_FILTERS;

  useEffect(() => {
    if (!deferredQuery) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(undefined);
      const category = filter === "Stocks" ? "stock" : filter === "ETFs" ? "etf" : "all";
      try {
        const response = await fetch(`/api/market/assets?q=${encodeURIComponent(deferredQuery)}&category=${category}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json() as { results?: InvestmentSearchResult[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Search failed.");
        setRemoteResults(body.results ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemoteResults([]);
        setSearchError(error instanceof Error ? error.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredQuery, filter]);

  const investments = useMemo(() => {
    if (!searchMode) return featured.filter((investment) => matchesFilter(investment, filter));
    const matchingFeatured = featured.filter((investment) => matchesQuery(investment, deferredQuery) && matchesFilter(investment, filter));
    const bySymbol = new Map<string, InvestmentSearchResult>();
    for (const investment of [...remoteResults, ...matchingFeatured]) bySymbol.set(investment.symbol, investment);
    return [...bySymbol.values()];
  }, [deferredQuery, featured, filter, remoteResults, searchMode]);

  return <>
    <div className="card investment-search">
      <Search size={21} aria-hidden="true" />
      <input
        aria-label="Search investments"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!["All", "Stocks", "ETFs"].includes(filter)) setFilter("All");
        }}
        placeholder="Search any supported company or ticker, like SBUX"
      />
      {activeSearching ? <LoaderCircle className="animate-spin" size={20} aria-label="Searching" /> : null}
    </div>
    <div className="investment-filters" aria-label="Investment filters">
      {filters.map((option) => <button
        key={option}
        type="button"
        aria-pressed={filter === option}
        className={filter === option ? "button-primary" : "button-quiet"}
        onClick={() => setFilter(option)}
      >{option}</button>)}
    </div>
    <div className="search-summary" role="status" aria-live="polite">
      {activeSearchError
        ? <span className="negative">{activeSearchError}</span>
        : activeSearching
          ? `Searching Alpaca for “${deferredQuery}”…`
          : searchMode
            ? `${investments.length} result${investments.length === 1 ? "" : "s"} for “${deferredQuery}”`
            : `${investments.length} featured ${filter.toLowerCase()} investment${investments.length === 1 ? "" : "s"}`}
    </div>
    {investments.length ? <div className="discover-grid">
      {investments.map((investment) => <InvestmentCard investment={investment} key={investment.symbol} />)}
    </div> : !activeSearching && !activeSearchError ? <div className="card empty-search">
      <strong>No matching investments yet.</strong>
      <p className="muted">Check the company name or ticker. Market Lab supports active U.S. stocks and ETFs available through Alpaca.</p>
    </div> : null}
  </>;
}

function InvestmentCard({ investment }: { investment: InvestmentSearchResult }) {
  return <Link href={`/app/stocks/${encodeURIComponent(investment.symbol)}`} className="card stock-card focus-ring">
    <div className="stock-card-top">
      <div className="symbol-cell">
        <span className="symbol-logo" style={{ background: investment.logoColor }}>{investment.symbol.slice(0, 2)}</span>
        <div><strong>{investment.symbol}</strong><span className="muted stock-meta">{investment.exchange} · {investment.assetType.toUpperCase()}</span></div>
      </div>
      {investment.changePercent === null
        ? <span className="muted stock-change">Open quote</span>
        : <span className={investment.changePercent >= 0 ? "positive" : "negative"}>{formatPercent(investment.changePercent)}</span>}
    </div>
    <h2>{investment.name}</h2>
    <p className="muted stock-description">{investment.description}</p>
    <div className="stock-card-footer">
      <div><span className="eyebrow">{investment.price === null ? "Live quote" : "Live IEX price"}</span><strong>{investment.price === null ? "View research" : formatMoney(investment.price)}</strong></div>
      <span className="status-pill">{investment.sector}</span>
    </div>
  </Link>;
}
