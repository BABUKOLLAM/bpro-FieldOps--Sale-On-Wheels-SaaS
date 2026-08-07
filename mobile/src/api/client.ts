import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '../config';

const KEYCHAIN_SERVICE = 'vansales.auth';

type Tokens = { access: string; refresh: string };

export async function saveTokens(tokens: Tokens): Promise<void> {
  await Keychain.setGenericPassword('vansales', JSON.stringify(tokens), {
    service: KEYCHAIN_SERVICE,
  });
}

export async function getTokens(): Promise<Tokens | null> {
  const result = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });
  if (!result) {
    return null;
  }
  try {
    return JSON.parse(result.password) as Tokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Authenticated fetch wrapper. On a 401, attempts one refresh-token
 * rotation before giving up — callers that get an ApiError with status
 * 401 after that should route the user back to the login screen.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const tokens = await getTokens();
  const doFetch = (accessToken: string | undefined) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
      },
    });

  let response = await doFetch(tokens?.access);

  if (response.status === 401 && tokens?.refresh) {
    const refreshed = await refreshAccessToken(tokens.refresh);
    if (refreshed) {
      response = await doFetch(refreshed.access);
    }
  }

  return response;
}

async function refreshAccessToken(
  refreshToken: string
): Promise<Tokens | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!response.ok) {
    await clearTokens();
    return null;
  }
  const data = await response.json();
  const tokens = { access: data.access, refresh: data.refresh || refreshToken };
  await saveTokens(tokens);
  return tokens;
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await response.json().catch(() => null)
    );
  }
  return response.json();
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      await response.json().catch(() => null)
    );
  }
  return response.json();
}

/**
 * Multipart file upload (invoice signature, expense receipt photo).
 * Deliberately does NOT go through apiFetch: that helper always forces
 * `Content-Type: application/json`, which would strip the multipart
 * boundary fetch needs to set itself from the FormData body.
 */
export async function apiUploadFile(
  path: string,
  fieldName: string,
  fileUri: string,
  fileName: string,
  mimeType: string = 'image/jpeg'
): Promise<Response> {
  const tokens = await getTokens();
  const form = new FormData();
  // React Native's fetch/FormData accepts this {uri, name, type} shape
  // for a file field — not a real Blob, since RN has no filesystem Blob API.
  form.append(fieldName, {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const doUpload = (accessToken: string | undefined) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });

  let response = await doUpload(tokens?.access);
  if (response.status === 401 && tokens?.refresh) {
    const refreshed = await refreshAccessToken(tokens.refresh);
    if (refreshed) {
      response = await doUpload(refreshed.access);
    }
  }
  return response;
}
