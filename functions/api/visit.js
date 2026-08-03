const COOKIE_NAME = "visitor_no";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const RECENT_POINTS_LIMIT = 500;

// Round to 1 decimal degree (~11km at the equator) so the map shows roughly
// where a visit came from without pinpointing an exact address.
function roundCoord(n) {
  return Math.round(n * 10) / 10;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=(\\d+)`));
  return match ? Number(match[1]) : null;
}

async function getRecentPoints(db) {
  const { results } = await db
    .prepare("SELECT lat, lon FROM visit_points ORDER BY id DESC LIMIT ?")
    .bind(RECENT_POINTS_LIMIT)
    .all();
  return results;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const existingNumber = readCookie(request, COOKIE_NAME);

  if (existingNumber !== null) {
    const totalRow = await db
      .prepare("SELECT total FROM visitor_counts WHERE id = 1")
      .first();
    const points = await getRecentPoints(db);

    return Response.json({
      number: existingNumber,
      total: totalRow?.total ?? existingNumber,
      points,
    });
  }

  const rawLat = parseFloat(request.cf?.latitude);
  const rawLon = parseFloat(request.cf?.longitude);
  const hasLocation = Number.isFinite(rawLat) && Number.isFinite(rawLon);

  const totalRow = await db
    .prepare("UPDATE visitor_counts SET total = total + 1 WHERE id = 1 RETURNING total")
    .first();
  const total = totalRow.total;

  if (hasLocation) {
    await db
      .prepare("INSERT INTO visit_points (lat, lon) VALUES (?, ?)")
      .bind(roundCoord(rawLat), roundCoord(rawLon))
      .run();
  }

  const points = await getRecentPoints(db);

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${total}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`
  );

  return new Response(JSON.stringify({ number: total, total, points }), { headers });
}
