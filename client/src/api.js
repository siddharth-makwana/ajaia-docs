export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (form) init.body = form;
  else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Network error — check your connection');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  users: () => request('/users'),
  listDocs: () => request('/documents'),
  createDoc: (data) => request('/documents', { method: 'POST', body: data }),
  importDoc: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/documents/import', { method: 'POST', form });
  },
  getDoc: (id) => request(`/documents/${id}`),
  updateDoc: (id, data) => request(`/documents/${id}`, { method: 'PATCH', body: data }),
  deleteDoc: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  shares: (id) => request(`/documents/${id}/shares`),
  share: (id, email, role) => request(`/documents/${id}/shares`, { method: 'POST', body: { email, role } }),
  unshare: (id, userId) => request(`/documents/${id}/shares/${userId}`, { method: 'DELETE' }),
};
