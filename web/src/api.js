// web/src/api.js
// Determina la URL base de la API en este orden:
// 1. window.__ENV__.API_URL (inyectado en runtime por env.js)
// 2. import.meta.env.VITE_API_URL (definido al construir/desarrollar)
// 3. "/api" (fallback relativo, ideal para proxy reverso)
const runtimeApi = typeof window !== "undefined" && window.__ENV__?.API_URL;
const buildApi = import.meta.env.VITE_API_URL;
export const API =
  runtimeApi ||
  (buildApi && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(buildApi)
    ? buildApi
    : "") ||
  "/api";

// -------------- helpers --------------
function authHeaders(token) {
    return { Authorization: `Bearer ${token}` };
}
function asForm(obj) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) fd.append(k, v);
    return fd;
}

// Subida con progreso real usando XHR (para mostrar barra)
function xhrUpload(url, formData, token, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        if (xhr.upload && typeof onProgress === "function") {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total));
            };
        }
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            const ok = xhr.status >= 200 && xhr.status < 300;
            try {
                const json = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                return ok ? resolve(json) : reject(new Error(json.detail || "Error de subida"));
            } catch {
                return ok ? resolve({ ok: true }) : reject(new Error("Error de red"));
            }
        };
        xhr.onerror = () => reject(new Error("Error de red"));
        xhr.send(formData);
    });
}

// -------------- auth --------------
export async function login(username, password) {
    const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: asForm({ username, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Credenciales inválidas");
    return j; // {access_token, token_type, role, can_create_projects, can_access_exptec}
}

export async function requestRegister(username, password, wantCreate = false, full_name, email, initials) {
    const r = await fetch(`${API}/auth/request-register`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: asForm({ username, password, want_create: wantCreate, full_name, email, initials }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error en solicitud");
    return j; // {ok, message}
}

// -------------- proyectos / etapas / categorías --------------
export async function getProjects(token) {
    const r = await fetch(`${API}/projects`, { headers: authHeaders(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo proyectos");
    return j;
}

export async function getStages(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/stages`, {
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo etapas");
    return j;
}

export async function getCategoryTree(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo categorías");
    return j.tree || j; // {sections:[...]} o {tree:{...}}
}

// -------------- subidas --------------
export function uploadExpedienteLegacy(projectId, stageId, file, token, _subfolder, onProgress) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("stage_id", stageId);
    fd.append("file", file);
    return xhrUpload(`${API}/upload`, fd, token, onProgress);
}

export function uploadByCategory(
    projectId,
    sectionKey,
    categoryKey,
    subcategoryKey,
    file,
    token,
    subpath,
    onProgress
) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("section_key", sectionKey);
    fd.append("category_key", categoryKey);
    if (subcategoryKey) fd.append("subcategory_key", subcategoryKey);
    if (subpath) fd.append("subpath", subpath);
    fd.append("file", file);
    return xhrUpload(`${API}/upload`, fd, token, onProgress);
}

// -------------- archivos --------------
export async function listFiles(projectId, opts = {}, token) {
    // opts: { stageId, q, limit, offset }
    const url = new URL(`${API}/projects/${projectId}/files`);
    if (opts.stageId) url.searchParams.set("stage_id", opts.stageId);
    if (opts.q) url.searchParams.set("q", opts.q);
    url.searchParams.set("limit", opts.limit ?? 50);
    url.searchParams.set("offset", opts.offset ?? 0);

    const r = await fetch(url, { headers: authHeaders(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando archivos");
    return j.items || [];
}

export async function deleteFile(fileId, token) {
    const r = await fetch(`${API}/files/${fileId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo eliminar el archivo");
    return j;
}

export async function requestDeleteFile(fileId, reason, token) {
    const r = await fetch(`${API}/files/${fileId}/request-delete`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/x-www-form-urlencoded" },
        body: asForm({ reason }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo solicitar la eliminación");
    return j;
}

export async function bulkDownloadFiles(projectId, ids, token) {
    const r = await fetch(`${API}/projects/${projectId}/files/bulk-download`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || "Error descargando archivos");
    }
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "archivos.zip";
    a.click();
    window.URL.revokeObjectURL(url);
}

export async function bulkRequestDelete(projectId, ids, reason, token) {
    const r = await fetch(`${API}/projects/${projectId}/files/bulk-delete`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ids, reason }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "No se pudo solicitar la eliminación");
    return j;
}

export async function listDeleteRequests(token) {
    const r = await fetch(`${API}/file-delete-requests`, { headers: authHeaders(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando solicitudes");
    return j.items || [];
}

export async function approveDeleteRequest(reqId, token) {
    const r = await fetch(`${API}/file-delete-requests/${reqId}/approve`, {
        method: "POST",
        headers: authHeaders(token),
    });
    let j = {};
    try {
        j = await r.json();
    } catch {
        /* sin cuerpo */
    }
    if (!r.ok) throw new Error(j.detail || "Error aprobando solicitud");
    return j;
}

export async function rejectDeleteRequest(reqId, token) {
    const r = await fetch(`${API}/file-delete-requests/${reqId}/reject`, {
        method: "POST",
        headers: authHeaders(token),
    });
    let j = {};
    try {
        j = await r.json();
    } catch {
        /* sin cuerpo */
    }
    if (!r.ok) throw new Error(j.detail || "Error rechazando solicitud");
    return j;
}

// -------------- progreso de proyecto --------------
export async function getProjectProgress(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/progress`, {
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo progreso");
    return j; // {project, stages:[...], completed_percent}
}


// === Expediente IMT (nuevos helpers) ===
export async function getExpediente(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/expediente`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo expediente");
    return j;
}

export async function uploadExpediente({ projectId, stageId, deliverableKey, file, reason, token, onProgress }) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("stage_id", stageId);
    fd.append("deliverable_key", deliverableKey);
    if (reason) fd.append("reason", reason);
    fd.append("file", file);

    // XHR para poder reportar progreso
    const url = `${API}/upload/expediente`;
    const xhr = new XMLHttpRequest();
    const p = new Promise((resolve, reject) => {
        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.onload = () => {
            try {
                const j = JSON.parse(xhr.responseText || "{}");
                if (xhr.status >= 200 && xhr.status < 300) resolve(j);
                else reject(new Error(j.detail || `Error ${xhr.status}`));
            } catch {
                reject(new Error(`Respuesta inválida (${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error("Error de red"));
        xhr.upload.onprogress = (e) => {
            if (onProgress && e.lengthComputable) {
                onProgress(Math.round((e.loaded * 100) / e.total));
            }
        };
        xhr.send(fd);
    });
    return p;
}

export async function getProgressExpediente(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/progress-expediente`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo progreso");
    return j;
}


export async function downloadFileById(fileId, filename, token, opts = {}) {
    const { view = false } = opts;
    let url = `${API}/download/${fileId}?access_token=${encodeURIComponent(token)}`;
    if (view) {
        url += "&inline=1";
        window.open(url, "_blank");
    } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `archivo-${fileId}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

// -------------- usuarios y miembros --------------
export async function listUsers(token) {
    const r = await fetch(`${API}/users`, { headers: authHeaders(token) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error listando usuarios");
    return j;
}

export async function createUser(data, token) {
    const fd = asForm(data);
    const r = await fetch(`${API}/users`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error creando usuario");
    return j;
}

export async function updateUser(id, data, token) {
    const fd = asForm(data);
    const r = await fetch(`${API}/users/${id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: fd,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error actualizando usuario");
    return j;
}

export async function deleteUser(id, token) {
    const r = await fetch(`${API}/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error eliminando usuario");
    return j;
}

export async function listProjectMembers(projectId, token) {
    const r = await fetch(`${API}/projects/${projectId}/members`, {
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo miembros");
    return j;
}

export async function addProjectMember(projectId, userId, role, token) {
    const fd = new URLSearchParams();
    fd.append("user_id", userId);
    fd.append("role", role);
    const r = await fetch(`${API}/projects/${projectId}/members`, {
        method: "POST",
        headers: authHeaders(token),
        body: fd,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error agregando miembro");
    return j;
}

export async function deleteProjectMember(projectId, userId, token) {
    const r = await fetch(`${API}/projects/${projectId}/members?user_id=${userId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error eliminando miembro");
    return j;
}
