import React, { useEffect, useState } from "react";
import { getProjects, getProjectProgress, listFiles } from "./api";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard({ token }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [prog, setProg] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
                if (projs[0]) setProjectId(String(projs[0].id));
            } catch (e) {
                toast.error(e.message);
            }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            setLoading(true);
            try {
                const p = await getProjectProgress(projectId, token);
                setProg(p);
                const rec = await listFiles(projectId, { limit: 10 }, token);
                setRecent(rec);
            } catch (e) {
                toast.error(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [projectId, token]);

    const pct = prog?.completed_percent ?? 0;

    return (
        <div className="space-y-6">
            {/* Selector de proyecto */}
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium">Proyecto</label>
                    <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="">— Selecciona —</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.code} — {p.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2 rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Avance del Expediente IMT</span>
                        <span className="text-sm text-slate-600">{pct}%</span>
                    </div>
                    <div className="mt-2 h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                            className={`h-full ${pct >= 100 ? "bg-emerald-600" : "bg-slate-900"}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Etapas */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-base font-semibold">Etapas del Expediente</h3>
                    {!loading && (!prog?.stages?.length) && (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-sm">
                            <AlertCircle size={16} /> Sin etapas definidas
                        </span>
                    )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-lg border p-3 animate-pulse bg-slate-50 h-16" />
                        ))
                    ) : (
                        (prog?.stages || []).map((s) => (
                            <div key={s.stage_id} className="rounded-lg border p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium">{s.stage_name}</div>
                                    <div className="text-xs text-slate-500">
                                        Archivos: {s.files} — {s.done ? "Completado" : "Pendiente"}
                                    </div>
                                </div>
                                {s.done ? (
                                    <CheckCircle2 className="text-emerald-600" size={20} />
                                ) : (
                                    <Circle className="text-slate-300" size={20} />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Actividad reciente */}
            <div className="rounded-2xl border bg-white p-4">
                <h3 className="text-base font-semibold mb-2">Actividad reciente</h3>
                <div className="rounded-xl border overflow-hidden">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-slate-100">
                            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                                <th>Archivo</th>
                                <th>Etapa</th>
                                <th>Usuario</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                            {(!recent || recent.length === 0) ? (
                                <tr>
                                    <td colSpan="4" className="px-3 py-6 text-center text-slate-500">Sin actividad</td>
                                </tr>
                            ) : recent.map((r) => (
                                <tr key={r.id}>
                                    <td className="truncate">{r.filename}</td>
                                    <td>{r.stage?.name || "-"}</td>
                                    <td>{r.uploaded_by || "-"}</td>
                                    <td>{new Date(r.uploaded_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
