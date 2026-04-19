interface FetchOptions {
  token?: string | null;
  method?: string;
  body?: unknown;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiFetch<T = unknown>(
  path: string,
  { token, method = "GET", body }: FetchOptions = {}
): Promise<{ success: true; data: T }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json?.error?.message ?? "Request failed");
  }

  return json as { success: true; data: T };
}
