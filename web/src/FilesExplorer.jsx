import React, { useEffect, useState } from "react";
import { getProjects, getStages, listFiles, deleteFile } from "./api";

function formatSize(bytes) {
    if (!bytes && bytes !== 0) return "-";
    const kb = 1024, mb = kb * 1024, gb = mb * 1024;
    if (bytes >= gb) return (bytes / gb).toFixed(2) + " GB";
    if (bytes >= mb) return (bytes / mb).toFixed(2) + " MB";
    if (bytes >= kb) return (bytes / kb).toFixed(2) + " KB";
    return bytes + " B";
}

export default function FilesExplorer({ token, role }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [stages, setStages] = useState([]);
    const [stageId, setStageId] = useState("");
    const [q, setQ] = useState("");
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const canDelete = role === "admin"; // si luego quieres validar por proyecto, lo ajustamos

    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
                if (projs[0]) setProjectId(String(projs[0].id));
            } catch (e) { setMsg(e.message); }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            try {
                const sts = await getStages(projectId, token);
                setStages(sts);
            } catch (e) { }
        })();
    }, [projectId, token]);

    async function load() {
        if (!projectId) return;
        setBusy(true); setMsg("");
        try {
            const items = await listFiles(projectId, { stageId, q }, token);
            setRows(items);
        } catch (e) { setMsg(e.message); }
        finally { setBusy(false); }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, stageId]);

    async function onDelete(id) {
        if (!window.confirm("¿Eliminar este archivo? Esta acción es permanente.")) return;
        try {
            await deleteFile(id, token);
            await load();
        } catch (e) { setMsg(e.message); }
    }

    return (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h3>Explorador de archivos</h3>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "end", marginBottom: 8 }}>
                <div>
                    <label>Proyecto</label><br />
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                        <option value="">— Selecciona —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label>Etapa (Expediente)</label><br />
                    <select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!projectId}>
                        <option value="">— Todas —</option>
                        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label>Buscar por nombre</label><br />
                    <input placeholder="ej. contrato, informe..." value={q} onChange={e => setQ(e.target.value)} />
                </div>
                <div>
                    <button type="button" onClick={load} disabled={busy}>{busy ? "Cargando..." : "Buscar"}</button>
                </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                        <th style={{ padding: 6 }}>Archivo</th>
                        <th style={{ padding: 6 }}>Etapa</th>
                        <th style={{ padding: 6 }}>Tamaño</th>
                        <th style={{ padding: 6 }}>Subido por</th>
                        <th style={{ padding: 6 }}>Fecha</th>
                        <th style={{ padding: 6 }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: 6, color: "#777" }}><em>Sin resultados</em></td></tr>
                    ) : rows.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: 6 }}>
                                <a href={`${r.download_url}?access_token=${token}`} target="_blank" rel="noreferrer">
                                    {r.filename}
                                </a>
                            </td>
                            <td style={{ padding: 6 }}>{r.stage?.name || "-"}</td>
                            <td style={{ padding: 6 }}>{formatSize(r.size_bytes)}</td>
                            <td style={{ padding: 6 }}>{r.uploaded_by || "-"}</td>
                            <td style={{ padding: 6 }}>{new Date(r.uploaded_at).toLocaleString()}</td>
                            <td style={{ padding: 6 }}>
                                {canDelete ? (
                                    <button onClick={() => onDelete(r.id)}>Eliminar</button>
                                ) : (
                                    <span style={{ color: "#aaa" }}>—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {msg && <div style={{ marginTop: 8 }}><small>{msg}</small></div>}
        </div>
    );
}
