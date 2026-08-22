import { useEffect, useMemo, useState } from "react";
import {
  Map,
  MapControls,
  MapGeoJSON,
} from "@/components/ui/map";
import type { MapGeoJSONData } from "@/components/ui/map";

interface VisitLocation {
  locationKey: string;
  label: string;
}

interface VisitResponse {
  number: number;
  locations: VisitLocation[];
}

interface CcaaFeatureProperties {
  code: string;
  provinces?: string[];
}

interface CcaaGeoJSON {
  features: Array<{ properties: CcaaFeatureProperties }>;
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

function isSpanishLocationKey(locationKey: string): boolean {
  return locationKey.startsWith("ES-") || locationKey.startsWith("ES:");
}

function spanishRegionCode(locationKey: string): string | null {
  if (locationKey.startsWith("ES-") || locationKey.startsWith("ES:")) {
    return locationKey.slice(3) || null;
  }
  return null;
}

function buildCcaaIndex(geo: CcaaGeoJSON): Map<string, string> {
  const index = new Map<string, string>();
  for (const feature of geo.features) {
    const { code, provinces = [] } = feature.properties;
    index.set(code, code);
    for (const province of provinces) {
      index.set(province, code);
    }
  }
  return index;
}

function resolveCcaaCode(
  locationKey: string,
  index: Map<string, string>,
): string | null {
  const raw = spanishRegionCode(locationKey);
  if (!raw) return null;
  return index.get(raw) ?? null;
}

const COUNTRIES_GEO = "/geo/countries-110m.geojson";
const SPAIN_CCAA_GEO = "/geo/spain-ccaa.geojson";

const visitedFill = "rgba(255, 255, 255, 0.32)";
const baseFill = "rgba(255, 255, 255, 0.06)";
const visitedLine = "rgba(255, 255, 255, 0.45)";
const baseLine = "rgba(255, 255, 255, 0.12)";

export default function VisitorMap() {
  const [data, setData] = useState<VisitResponse | null>(null);
  const [ccaaIndex, setCcaaIndex] = useState<Map<string, string> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/visit")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: VisitResponse) => setData(json))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    fetch(SPAIN_CCAA_GEO)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((geo: CcaaGeoJSON) => setCcaaIndex(buildCcaaIndex(geo)))
      .catch(() => setCcaaIndex(new Map()));
  }, []);

  const visitedCountries = useMemo(
    () =>
      data?.locations
        .filter((loc) => !isSpanishLocationKey(loc.locationKey))
        .map((loc) => loc.locationKey) ?? [],
    [data],
  );

  const visitedCcaa = useMemo(() => {
    if (!data || !ccaaIndex) return [];
    const codes = new Set<string>();
    for (const loc of data.locations) {
      const ccaa = resolveCcaaCode(loc.locationKey, ccaaIndex);
      if (ccaa) codes.add(ccaa);
    }
    return [...codes];
  }, [data, ccaaIndex]);

  const countryFillPaint = useMemo(
    () => ({
      "fill-color": [
        "case",
        ["in", ["get", "ISO_A2"], ["literal", visitedCountries]],
        visitedFill,
        baseFill,
      ],
    }),
    [visitedCountries],
  );

  const countryLinePaint = useMemo(
    () => ({
      "line-color": [
        "case",
        ["in", ["get", "ISO_A2"], ["literal", visitedCountries]],
        visitedLine,
        baseLine,
      ],
      "line-width": 0.5,
    }),
    [visitedCountries],
  );

  const ccaaFillPaint = useMemo(
    () => ({
      "fill-color": [
        "case",
        ["in", ["get", "code"], ["literal", visitedCcaa]],
        visitedFill,
        "rgba(255, 255, 255, 0.04)",
      ],
    }),
    [visitedCcaa],
  );

  const ccaaLinePaint = useMemo(
    () => ({
      "line-color": [
        "case",
        ["in", ["get", "code"], ["literal", visitedCcaa]],
        visitedLine,
        baseLine,
      ],
      "line-width": 0.6,
    }),
    [visitedCcaa],
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="visitor-map-frame aspect-[16/9] w-full overflow-hidden">
        <Map
          theme="dark"
          blank
          center={[10, 20]}
          zoom={1.6}
          minZoom={1}
          maxZoom={8}
        >
          <MapControls showZoom={false} />
          <MapGeoJSON
            id="visitor-countries"
            data={COUNTRIES_GEO as MapGeoJSONData}
            promoteId="ISO_A2"
            fillPaint={countryFillPaint}
            linePaint={countryLinePaint}
          />
          <MapGeoJSON
            id="visitor-spain-ccaa"
            data={SPAIN_CCAA_GEO as MapGeoJSONData}
            promoteId="code"
            fillPaint={ccaaFillPaint}
            linePaint={ccaaLinePaint}
          />
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
