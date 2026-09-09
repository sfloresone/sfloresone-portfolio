const COOKIE_NAME = "visitor_no";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

function readCookie(request: Request, name: string): number | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=(\\d+)`));
  return match ? Number(match[1]) : null;
}

export async function onRequestGet(context: {
  request: Request;
  env: { DB: D1Database };
}) {
  const { request, env } = context;
  const db = env.DB;

  const existingNumber = readCookie(request, COOKIE_NAME);

  if (existingNumber !== null) {
    return Response.json({ number: existingNumber });
  }

  const totalRow = await db
    .prepare(
      "UPDATE visitor_counts SET total = total + 1 WHERE id = 1 RETURNING total",
    )
    .first<{ total: number }>();
  const total = totalRow?.total ?? 1;

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${total}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`,
  );

  return new Response(JSON.stringify({ number: total }), { headers });
}
