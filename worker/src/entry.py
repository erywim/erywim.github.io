import json
from urllib.parse import urlparse

from workers import Response, WorkerEntrypoint


DEFAULT_ALLOWED_ORIGINS = {
    "https://erywim.github.io",
    "http://localhost:4321",
    "http://127.0.0.1:4321",
}


def json_response(payload, status=200, headers=None):
    response_headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    }
    if headers:
        response_headers.update(headers)
    return Response(json.dumps(payload, ensure_ascii=False), status=status, headers=response_headers)


class Default(WorkerEntrypoint):
    def allowed_origins(self):
        configured = getattr(self.env, "ALLOWED_ORIGINS", "")
        origins = {origin.strip() for origin in str(configured).split(",") if origin.strip()}
        return origins or DEFAULT_ALLOWED_ORIGINS

    def cors_headers(self, request):
        origin = request.headers.get("Origin")
        if not origin:
            return {}
        if origin not in self.allowed_origins():
            return None
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Accept, Content-Type",
            "Vary": "Origin",
        }

    async def fetch(self, request):
        path = urlparse(str(request.url)).path
        method = str(request.method).upper()
        cors = self.cors_headers(request)

        if cors is None:
            return json_response({"error": "origin_not_allowed"}, status=403)

        if method == "OPTIONS":
            return Response(None, status=204, headers=cors or {})

        if path == "/health" and method == "GET":
            return json_response({"status": "ok", "runtime": "cloudflare-python-worker"}, headers=cors)

        if path != "/api/hello" or method != "GET":
            return json_response({"error": "not_found"}, status=404, headers=cors)

        try:
            message = await self.env.DB.prepare(
                "SELECT message FROM greetings WHERE key = ? LIMIT 1"
            ).bind("hello").first("message")
        except Exception:
            return json_response(
                {"error": "d1_unavailable", "message": "D1 数据库暂不可用。"},
                status=503,
                headers=cors,
            )

        if message is None:
            return json_response(
                {"error": "hello_row_missing", "message": "D1 尚未初始化 hello 数据。"},
                status=503,
                headers=cors,
            )

        if hasattr(message, "to_py"):
            message = message.to_py()

        return json_response(
            {
                "message": str(message),
                "source": "cloudflare-d1",
            },
            headers=cors,
        )
