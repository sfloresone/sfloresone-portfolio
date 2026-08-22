import { resolveVisitorLocation } from "../lib/visitorLocation";

const COOKIE_NAME = "visitor_no";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

interface VisitLocationRow {
  location_key: string;
  label: string;
}

function readCookie(request: Request, name: string): number | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=(\\d+)`));
  return match ? Number(match[1]) : null;
}

async function getActiveLocations(
  db: D1Database,
): Promise<{ locationKey: string; label: string }[]> {
  const { results } = await db
    .prepare(
      "SELECT location_key, label FROM visit_locations WHERE visit_count > 0",
    )
    .all<VisitLocationRow>();

  return results.map((row) => ({
    locationKey: row.location_key,
    label: row.label,
  }));
}

async function incrementLocation(
  db: D1Database,
  location: { locationKey: string; label: string; country: string },
) {
  await db
    .prepare(
      `INSERT INTO visit_locations (location_key, label, country, visit_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(location_key) DO UPDATE SET visit_count = visit_count + 1`,
    )
    .bind(location.locationKey, location.label, location.country)
    .run();
}

export async function onRequestGet(context: {
  request: Request;
  env: { DB: D1Database };
}) {
  const { request, env } = context;
  const db = env.DB;

  const existingNumber = readCookie(request, COOKIE_NAME);

  if (existingNumber !== null) {
    const locations = await getActiveLocations(db);
    return Response.json({
      number: existingNumber,
      locations,
    });
  }

  const totalRow = await db
    .prepare(
      "UPDATE visitor_counts SET total = total + 1 WHERE id = 1 RETURNING total",
    )
    .first<{ total: number }>();
  const total = totalRow?.total ?? 1;

  const cf = (request as Request & { cf?: Parameters<typeof resolveVisitorLocation>[0] }).cf;
  const location = resolveVisitorLocation(cf);
  if (location) {
    await incrementLocation(db, location);
  }

  const locations = await getActiveLocations(db);

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${total}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`,
  );

  return new Response(JSON.stringify({ number: total, locations }), { headers });
}
