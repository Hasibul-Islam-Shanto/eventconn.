import { env } from './env';

export type ApiErrorShape = {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

export class ApiError extends Error implements ApiErrorShape {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | null | undefined;
type RequestOptions = {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${env.apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      signal: options.signal,
      headers: { 'content-type': 'application/json', ...options.headers },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'EventConn is unavailable. Please try again shortly.', 'NETWORK_ERROR');
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    code?: string;
    fieldErrors?: Record<string, string>;
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message || 'The request could not be completed.',
      payload?.code,
      payload?.fieldErrors,
    );
  }
  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>('PATCH', path, options),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, options),
};

export type SuccessResponse<T> = { success: true; message: string; data: T };
export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type PaginatedResponse<T> = SuccessResponse<T[]> & { pagination: Pagination };
