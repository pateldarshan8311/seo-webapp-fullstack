const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (parseError) {
        payload = { message: text.trim() };
      }
    }

    if ([502, 503, 504].includes(response.status)) {
      throw new Error('Backend API is unavailable. Check the Render service status and try again.');
    }

    if (!response.ok) {
      throw new Error(payload?.message || 'Request failed');
    }

    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Unable to reach the backend API at ${API_BASE_URL}.`);
    }

    throw error;
  }
}

export function listAudits() {
  return request('/audits');
}

export function getAudit(auditId) {
  return request(`/audits/${auditId}`);
}

export function getAuditTasks(auditId, filters = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') {
      searchParams.set(key, value);
    }
  });

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return request(`/audits/${auditId}/tasks${suffix}`);
}

export function startAudit(payload) {
  return request('/audits', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function pauseAudit(auditId) {
  return request(`/audits/${auditId}/pause`, {
    method: 'POST',
  });
}

export function resumeAudit(auditId) {
  return request(`/audits/${auditId}/resume`, {
    method: 'POST',
  });
}

export function updateAuditTask(auditId, taskId, payload) {
  return request(`/audits/${auditId}/tasks/${taskId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

export function updateAuditPage(auditId, payload) {
  return request(`/audits/${auditId}/pages`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

export function verifyAuditTask(auditId, taskId) {
  return request(`/audits/${auditId}/tasks/${taskId}/verify`, {
    method: 'POST',
  });
}

export function verifyOpenAuditTasks(auditId) {
  return request(`/audits/${auditId}/verify-open-tasks`, {
    method: 'POST',
  });
}
