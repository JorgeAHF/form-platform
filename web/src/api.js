// web/src/api.js
const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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
    return j; // {access_token, token_type, role}
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
    const r = await fetch(`${API}/projects/${projectId}/categories/tree`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) {
        // Si aún no existe el endpoint en backend, no revientes el flujo.
        return { sections: [] };
    }
    const j = await r.json();
    if (!r.ok) throw new Error(j.detail || "Error leyendo categorías");
    return j; // { sections: [...] }
}

// -------------- subidas --------------
export function uploadExpedienteLegacy(projectId, stageId, file, token, _subfolder, onProgress) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("stage_id", stageId);
    fd.append("file", file);
    return xhrUpload(`${API}/upload`, fd, token, onProgress);
}

export function uploadByCategory(projectId, sectionKey, categoryKey, subcategoryKey, file, token, onProgress) {
    const fd = new FormData();
    fd.append("project_id", projectId);
    fd.append("section_key", sectionKey);
    fd.append("category_key", categoryKey);
    if (subcategoryKey) fd.append("subcategory_key", subcategoryKey);
    fd.append("file", file);
    return xhrUpload(`${API}/upload/by-category`, fd, token, onProgress);
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


export async function downloadFileById(fileId, filename, token) {
    const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const res = await fetch(`${API}/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        let err = "Error al descargar";
        try { const j = await res.json(); err = j.detail || err; } catch { }
        throw new Error(err);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `archivo-${fileId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
