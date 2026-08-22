export type ResolvedLocation = {
  locationKey: string;
  label: string;
  country: string;
};

export type CfGeo = {
  country?: string | null;
  region?: string | null;
  regionCode?: string | null;
};

const regionNames = new Intl.DisplayNames("en", { type: "region" });

function countryLabel(code: string): string {
  return regionNames.of(code) ?? code;
}

function normalizeRegionCode(regionCode: string | null | undefined): string | null {
  if (!regionCode) return null;
  const code = regionCode.toUpperCase().replace(/^ES-/, "");
  return code || null;
}

export function resolveVisitorLocation(cf: CfGeo | undefined): ResolvedLocation | null {
  const country = cf?.country?.toUpperCase();
  if (!country) return null;

  if (country === "ES") {
    const code = normalizeRegionCode(cf.regionCode);
    if (!code) return null;

    return {
      locationKey: `ES-${code}`,
      label: cf.region ?? code,
      country: "ES",
    };
  }

  return {
    locationKey: country,
    label: countryLabel(country),
    country,
  };
}
