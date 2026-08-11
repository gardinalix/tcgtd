export async function submitAlphaFeedback(input = {}) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await readPayload(response);
  if (!response.ok) {
    const error = new Error(payload?.message || "Não foi possível transmitir o relatório.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
