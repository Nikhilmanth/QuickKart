const TOKEN_KEY = 'quickkart_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem('blinkit_token');
export const setToken = (t) => {
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('blinkit_token');
  }
};

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (p, body) => request(p, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (p) => request(p, { method: 'DELETE' }),
};
