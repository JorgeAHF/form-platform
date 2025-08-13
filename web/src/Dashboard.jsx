import React, { useEffect, useState } from "react";
import { getProjects, getProgress, listFiles } from "./api";

export default function Dashboard({ token }) {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [error, setError] = useState("");
    const [filesByProject, setFilesByProject] = useState({});
    const [stageFilter, setStageFilter] = useState({});

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const projs = await getProjects(token);
                setProjects(projs);
                const entries = await Promise.all(
                    projs.map(async (p) => [p.id, await getProgress(p.id, token)])
                );
                setProgressMap(Object.fromEntries(entries));
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    async function loadFilesFor(projectId) {
        try {
            const sid = stageFilter[projectId];
            const items = await listFiles(projectId, sid, token);
            setFilesByProject((prev) => ({ ...prev, [projectId]: items }));
        } catch (e) {
            setError(e.message);
        }
    }

    if (loading) return <p>Cargando dashboard…</p>;
    if (error) return <p style={{ color: "#d33" }}>{error}</p>;
    if (!projects.length) return <p>No hay proyectos aún.</p>;

    return (
        <div>
            <h3>Dashboard de avance</h3>
            {projects.map((p) => {
                const prog = progressMap[p.id];
                const pct = prog?.completed_percent ?? 0;
                const stages = prog?.stages || [];
                const files = filesByProject[p.id] || [];
                return (
                    <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, margin: "12px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div><strong>{p.code}</strong> — {p.name}</div>
                            <div><strong>{pct}%</strong></div>
                        </div>
                        <div style={{ height: 10, background: "#eee", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#4a90e2" }} />
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                            {stages.map(s => (
                                <span key={s.stage_id}
                                    style={{
                                        padding: "4px 8px", borderRadius: 999,
                                        border: "1px solid #ddd", background: s.done ? "#e6f4ea" : "#f7f7f7",
                                        fontSize: 12
                                    }}>
                                    {s.stage_code}: {s.done ? "✅" : "—"}
                                </span>
                            ))}
                        </div>

                        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                            <label>Filtrar por etapa:</label>
                            <select
                                value={stageFilter[p.id] || ""}
                                onChange={(e) => setStageFilter((prev) => ({ ...prev, [p.id]: e.target.value || null }))}
                            >
                                <option value="">— Todas —</option>
                                {stages.map(s => (
                                    <option key={s.stage_id} value={s.stage_id}>
                                        {s.stage_code} — {s.stage_name}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => loadFilesFor(p.id)}>Ver archivos</button>
                        </div>

                        <ul style={{ marginTop: 8 }}>
                            {files.length === 0 ? (
                                <li style={{ color: "#666" }}><em>—</em></li>
                            ) : files.map(f => (
                                <li key={f.id}>
                                    <a href={f.download_url} target="_blank" rel="noreferrer">{f.filename}</a>
                                    {" "}— {f.stage?.code || "—"} — {(f.size_bytes / 1024).toFixed(0)} KB
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}
