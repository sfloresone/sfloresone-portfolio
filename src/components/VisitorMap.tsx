import { useEffect, useState } from "react";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
} from "@/components/ui/map";

interface VisitPoint {
  lat: number;
  lon: number;
}

interface VisitResponse {
  number: number;
  total: number;
  points: VisitPoint[];
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export default function VisitorMap() {
  const [data, setData] = useState<VisitResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/visit")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: VisitResponse) => setData(json))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/15">
        <Map theme="dark" center={[10, 20]} zoom={1.6} minZoom={1} maxZoom={8}>
          <MapControls showZoom={false} />
          {data?.points.map((p, i) => (
            <MapMarker key={`${p.lat}-${p.lon}-${i}`} longitude={p.lon} latitude={p.lat}>
              <MarkerContent className="size-2.5 rounded-full border border-white/70 bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
              <MarkerTooltip>
                ~{p.lat.toFixed(1)}, {p.lon.toFixed(1)}
              </MarkerTooltip>
            </MapMarker>
          ))}
        </Map>
      </div>

      <p className="font-body text-center text-base text-white/70 sm:text-lg">
        {failed ? (
          "Couldn't load the visitor count."
        ) : (
          <>
            You&rsquo;re the{" "}
            <span className="font-heading font-medium text-white underline decoration-1 underline-offset-4">
              {data ? ordinal(data.number) : "—"}
            </span>{" "}
            visitor!
          </>
        )}
      </p>
    </div>
  );
}
