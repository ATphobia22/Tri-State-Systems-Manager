import { useEffect, useState } from 'react';
import {
  fetchCommunityGauges,
  startGaugePoll,
  type RiverGaugeObservation,
} from '../lib/river-gauges';

/**
 * Live community river gauges with 60s refresh.
 * Uses TSM community API → USGS OGC direct → LKG.
 */
export function useLiveGauges(intervalMs = 60_000): {
  gauges: RiverGaugeObservation[];
  loading: boolean;
  lastUpdated: string | null;
} {
  const [gauges, setGauges] = useState<RiverGaugeObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const stop = startGaugePoll((rows) => {
      if (!mounted) return;
      setGauges(rows);
      setLoading(false);
      setLastUpdated(new Date().toISOString());
    }, intervalMs);
    void fetchCommunityGauges().then((rows) => {
      if (!mounted) return;
      setGauges(rows);
      setLoading(false);
      setLastUpdated(new Date().toISOString());
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [intervalMs]);

  return { gauges, loading, lastUpdated };
}
