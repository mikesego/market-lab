export type PortfolioHistoryPoint = {
  at: string;
  value: number;
};

type RecordedSnapshot = {
  capturedAt: Date;
  equity: string | number;
};

export function buildPortfolioHistory({
  createdAt,
  startingCash,
  snapshots,
  currentAt,
  currentValue,
}: {
  createdAt: Date;
  startingCash: number;
  snapshots: RecordedSnapshot[];
  currentAt: Date;
  currentValue: number;
}): PortfolioHistoryPoint[] {
  const createdTime = createdAt.getTime();
  const points: PortfolioHistoryPoint[] = [{ at: createdAt.toISOString(), value: startingCash }];
  const ordered = [...snapshots]
    .filter((snapshot) => Number.isFinite(Number(snapshot.equity)) && snapshot.capturedAt.getTime() >= createdTime)
    .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());

  for (const snapshot of ordered) {
    const at = snapshot.capturedAt.toISOString();
    const value = Number(snapshot.equity);
    const last = points.at(-1);
    if (last?.at === at) last.value = value;
    else points.push({ at, value });
  }

  const current = { at: currentAt.toISOString(), value: currentValue };
  const last = points.at(-1);
  if (last?.at === current.at) last.value = current.value;
  else points.push(current);
  return points;
}
