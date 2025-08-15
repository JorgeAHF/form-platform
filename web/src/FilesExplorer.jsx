import React, { useEffect, useState } from "react";
import { getProjects, getStages, listFiles, deleteFile } from "./api";

function formatSize(bytes) {
    if (bytes === 0) return "0 B";
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
            } catch { }
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
        <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
                <div>
                    <label className="text-sm font-medium">Proyecto</label>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                        <option value="">— Selecciona —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">Etapa (Expediente)</label>
                    <select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!projectId}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60">
                        <option value="">— Todas —</option>
                        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">Buscar por nombre</label>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="ej. contrato, informe..."
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
                <div className="flex items-end">
                    <button onClick={load} disabled={busy}
                        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50">
                        {busy ? "Cargando..." : "Buscar"}
                    </button>
                </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-100">
                        <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                            <th>Archivo</th>
                            <th>Etapa</th>
                            <th>Tamaño</th>
                            <th>Subido por</th>
                            <th>Fecha</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                        {rows.length === 0 ? (
                            <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-500">Sin resultados</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.id}>
                                <td className="truncate">
                                    <a className="text-slate-900 hover:underline"
                                        href={`${r.download_url}?access_token=${token}`} target="_blank" rel="noreferrer">
                                        {r.filename}
                                    </a>
                                </td>
                                <td>{r.stage?.name || "-"}</td>
                                <td>{formatSize(r.size_bytes)}</td>
                                <td>{r.uploaded_by || "-"}</td>
                                <td>{new Date(r.uploaded_at).toLocaleString()}</td>
                                <td className="text-right">
                                    {canDelete ? (
                                        <button onClick={() => onDelete(r.id)}
                                            className="rounded-md border px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                                            Eliminar
                                        </button>
                                    ) : <span className="text-slate-300">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {msg && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{msg}</div>}
        </div>
    );
}
