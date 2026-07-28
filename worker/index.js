/**
 * Cloudflare Worker entry point used by Sites deployments.
 * Local development continues to use the existing Vite server.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && request.headers.get("accept")?.includes("text/html")) {
      response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    const html = (await response.text()).replaceAll("__SITE_ORIGIN__", url.origin);
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

