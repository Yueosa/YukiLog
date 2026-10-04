export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers({ Accept: 'application/json' });
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  if (!['GET', 'HEAD'].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const response = await fetch(path, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as
      | { code?: string; message?: string }
      | null;
    throw new ApiError(payload?.message ?? `请求失败（${response.status}）`, response.status, payload?.code);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function csrfToken(): string | undefined {
  for (const entry of document.cookie.split(';')) {
    const [rawName, ...rawValue] = entry.trim().split('=');
    if (rawName === 'yukilog_csrf' || rawName === '__Host-yukilog_csrf') {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return undefined;
}
