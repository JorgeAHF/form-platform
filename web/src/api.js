export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const hdr = (token) => ({ Authorization: `Bearer ${token}` });

export async function login(username, password) {
    const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Login inválido");
    return j;
}

/* ---------- registro con aprobación ---------- */
export async function requestRegister(username, password) {
    const r = await fetch(`${API}/auth/request-register`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo enviar la solicitud");
    return j; // {ok, message}
}

export async function listRegistrationRequests(token, status) {
    const url = new URL(`${API}/admin/registrations`);
    if (status) url.searchParams.set("status_filter", status);
    const r = await fetch(url, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando solicitudes");
    return j; // [{id, username, status, ...}]
}

export async function approveRegistration(token, reqId, role = "colaborador") {
    const r = await fetch(`${API}/admin/registrations/${reqId}/approve`, {
        method: "POST",
        headers: { ...hdr(token), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ role })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error aprobando solicitud");
    return j;
}

export async function rejectRegistration(token, reqId, note = "") {
    const r = await fetch(`${API}/admin/registrations/${reqId}/reject`, {
        method: "POST",
        headers: { ...hdr(token), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ note })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error rechazando solicitud");
    return j;
}

/* ---------- proyectos/etapas/upload/dashboard existentes ---------- */
export async function getProjects(token) {
    const r = await fetch(`${API}/projects`, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error proyectos");
    return j;
}

export async function getStages(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/stages`, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error etapas");
    return j;
}

export async function createProject({ code, name, type }, token) {
    const body = new URLSearchParams({ code, name, type });
    const r = await fetch(`${API}/projects`, {
        method: "POST",
        headers: { ...hdr(token), "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
    return j;
}

export async function uploadExpediente(projectId, stageId, file, token, expSubfolder = "") {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("stage_id", stageId);
    if (expSubfolder) form.append("exp_subfolder", expSubfolder);
    form.append("file", file);
    const r = await fetch(`${API}/upload`, { method: "POST", headers: hdr(token), body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error subiendo archivo");
    return j;
}

export async function uploadByCategory(projectId, sectionKey, categoryKey, subcategoryKey, file, token) {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("section_key", sectionKey);
    form.append("category_key", categoryKey);
    if (subcategoryKey) form.append("subcategory_key", subcategoryKey);
    form.append("file", file);
    const r = await fetch(`${API}/upload`, { method: "POST", headers: hdr(token), body: form });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error subiendo archivo");
    return j;
}

export async function getProgress(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/progress`, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error progreso");
    return j;
}

export async function listFiles(projectId, opts = {}, token) {
    // opts: { stageId, q, limit, offset }
    const url = new URL(`${API}/projects/${projectId}/files`);
    if (opts.stageId) url.searchParams.set("stage_id", opts.stageId);
    if (opts.q) url.searchParams.set("q", opts.q);
    url.searchParams.set("limit", opts.limit ?? 50);
    url.searchParams.set("offset", opts.offset ?? 0);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando archivos");
    return j.items || [];
}

export async function deleteFile(fileId, token) {
    const r = await fetch(`${API}/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo eliminar el archivo");
    return j;
}


export async function getCategoryTree(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/categories`, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error categorías");
    return j.tree;
}

/* ---------- miembros existentes ---------- */
export async function searchUsers(q, token) {
    const url = new URL(`${API}/users`);
    if (q) url.searchParams.set("q", q);
    const r = await fetch(url, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error buscando usuarios");
    return j;
}

export async function listMembers(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/members`, { headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando miembros");
    return j;
}

export async function addOrUpdateMember(projectId, userId, role, token) {
    const body = new URLSearchParams({ user_id: String(userId), role });
    const r = await fetch(`${API}/projects/${projectId}/members`, {
        method: "POST",
        headers: { ...hdr(token), "Content-Type": "application/x-www-form-urlencoded" },
        body
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo agregar/actualizar miembro");
    return j;
}

export async function removeMember(projectId, userId, token) {
    const url = new URL(`${API}/projects/${projectId}/members`);
    url.searchParams.set("user_id", String(userId));
    const r = await fetch(url, { method: "DELETE", headers: hdr(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo eliminar miembro");
    return j;
}
