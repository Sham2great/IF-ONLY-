export default async (req) => {
  const headers = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  const reply = (statusCode, body) => new Response(JSON.stringify(body), { status: statusCode, headers: { ...headers, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Use the story page to request an image." });

  const apiKey = Netlify.env.get("POLLINATIONS_API_KEY");
  if (!apiKey) return reply(503, { error: "AI images aren't connected yet. Add POLLINATIONS_API_KEY in Netlify environment variables." });

  let body;
  try { body = await req.json(); } catch { return reply(400, { error: "The image prompt was missing." }); }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 900) : "";
  if (prompt.length < 10) return reply(400, { error: "Please provide a little more detail for the image." });

  const styledPrompt = "Create a cinematic, atmospheric illustration for an introspective literary short story. Dreamlike but grounded, subtle film grain, soft natural light, muted midnight blue and warm amber palette, elegant composition, emotionally evocative, painterly realism, wide landscape frame. No words, no lettering, no typography, no watermarks. Scene: " + prompt;
  const url = "https://gen.pollinations.ai/image/" + encodeURIComponent(styledPrompt) + "?model=flux&width=768&height=512&nologo=true";
  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { "Authorization": "Bearer " + apiKey, "Accept": "image/*" }
    });
    if (!upstream.ok) {
      const message = await upstream.text();
      console.error("Pollinations image request failed:", JSON.stringify({ status: upstream.status, message: message.slice(0, 350) }));
      if (upstream.status === 401 || upstream.status === 403) return reply(502, { error: "The image provider couldn't authenticate. Check the Pollinations API key saved in Netlify." });
      if (upstream.status === 402) return reply(402, { error: "The image provider needs available credits before it can generate more pictures." });
      if (upstream.status === 429) return reply(429, { error: "The image provider is busy or has reached its current limit. Try again later." });
      return reply(502, { error: "This world couldn't render its image just now. You can still read the story." });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return reply(502, { error: "The image provider returned an unexpected response. You can still read the story." });
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: { ...headers, "Content-Type": contentType, "Cache-Control": "no-store" }
    });
  } catch (err) {
    console.error("Image function error:", err?.message || "unknown error");
    return reply(502, { error: "The image connection was interrupted. You can still read the story." });
  }
};
