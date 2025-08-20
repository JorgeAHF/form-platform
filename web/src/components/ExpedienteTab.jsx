import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCcw } from "lucide-react";
import {
    getProjects,
    getStages,
    getExpediente,
    uploadExpediente,
    downloadFileById,
    requestDeleteFile,
} from "../api";


// ---------- util ----------
function bytes(n) {
    if (n === 0) return "0 B";
    if (!n && n !== 0) return "—";
    const kb = 1024, mb = kb * 1024, gb = mb * 1024;
    if (n >= gb) return (n / gb).toFixed(2) + " GB";
    if (n >= mb) return (n / mb).toFixed(2) + " MB";
    if (n >= kb) return (n / kb).toFixed(1) + " KB";
    return n + " B";
}
function chip(txt) {
    return (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-700 bg-slate-50 mr-1">{txt}</span>
    );
}
function ProgressBar({ value }) {
    const v = Math.max(0, Math.min(100, Math.round(value || 0)));
    return (
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${v}%` }} />
        </div>
    );
}

export default function ExpedienteTab({ token, readOnly = false }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [stages, setStages] = useState([]);
    const [stageId, setStageId] = useState("");
    const [snap, setSnap] = useState(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputs = useRef({});

    // load projects on mount
    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
                const pid = projs?.[0]?.id ? String(projs[0].id) : "";
                setProjectId(pid);
            } catch (e) { toast.error(e.message); }
        })();
    }, [token]);

    // when project changes, load stages + snapshot
    useEffect(() => {
        (async () => {
            if (!projectId) { setStages([]); setSnap(null); return; }
            try {
                const sts = await getStages(projectId, token);
                setStages(sts);
                const s = await getExpediente(projectId, token);
                setSnap(s);
                // preselect first stage
                setStageId(sts?.[0]?.id ? String(sts[0].id) : "");
            } catch (e) { toast.error(e.message); }
        })();
    }, [projectId, token]);

    const currentStage = useMemo(() => {
        if (!snap || !stageId) return null;
        const id = Number(stageId);
        return snap.stages.find(s => s.stage.id === id) || null;
    }, [snap, stageId]);

    function acceptFromAllowed(allowed_ext = []) {
        const dots = allowed_ext.map(e => `.${e.toLowerCase()}`);
        return dots.join(",");
    }
    function triggerSelect(deliverableKey) {
        const ref = fileInputs.current[deliverableKey];
        if (ref) ref.click();
    }

    function groupDeliverables(stage) {
        const req = [], opt = [], extra = [];
        for (const d of stage.deliverables) {
            if (d.optional_group === "contract") extra.push(d);
            else if (d.required) req.push(d);
            else opt.push(d);
        }
        return { requeridos: req, opcionales: opt, contrato_extra: extra };
    }

    async function refreshSnapshot() {
        if (!projectId) return;
        try {
            const s = await getExpediente(projectId, token);
            setSnap(s);
        } catch (e) { toast.error(e.message); }
    }

    async function handleFileSelected(d, e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        // si es single y ya existe activo, pedir motivo
        const hasActive = d.multi ? d.files.length > 0 : d.files?.some(f => f.is_active);
        let reason = null;
        if (hasActive && !d.multi) {
            reason = window.prompt("Motivo de la nueva versión:");
            if (!reason || !reason.trim()) { toast.error("Debes indicar un motivo."); return; }
        }

        try {
            setBusy(true); setProgress(0);
            await uploadExpediente({
                projectId,
                stageId,
                deliverableKey: d.key,
                file,
                reason,
                token,
                onProgress: (p) => setProgress(p),
            });
            toast.success("Archivo subido");
            await refreshSnapshot();
        } catch (err) {
            toast.error(err.message || "Error al subir");
        } finally {
            setBusy(false); setProgress(0);
        }
    }

    async function onDeleteFile(id) {
        const reason = window.prompt("Motivo para eliminar este archivo:");
        if (!reason || !reason.trim()) return;
        try {
            await requestDeleteFile(id, reason, token);
            toast.success("Solicitud enviada");
            await refreshSnapshot();
        } catch (err) {
            console.error(err);
            alert(err.message || "Error solicitando eliminación");
        }
    }

    // ---------- render ----------
    return (
        <div className="grid gap-5">
            {/* filters */}
            <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Proyecto</label>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                </div>
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Etapa</label>
                    <select value={stageId} onChange={e => setStageId(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Progreso total</label>
                    <div className="flex items-center gap-3">
                        <ProgressBar value={snap?.progress_percent || 0} />
                        <span className="text-sm w-12 text-right">{snap?.progress_percent ?? 0}%</span>
                    </div>
                </div>
            </div>

            {/* stage content */}
            {!currentStage ? (
                <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">Selecciona un proyecto y una etapa.</div>
            ) : (
                <>
                    <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <div className="text-sm text-slate-500">Etapa</div>
                                <div className="text-base font-semibold">{currentStage.stage.name}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {currentStage.required_done}/{currentStage.required_total} requeridos
                                </div>
                            </div>
                            <button type="button" onClick={refreshSnapshot}
                                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
                                <RefreshCcw size={16} /> Actualizar
                            </button>
                        </div>
                        <ProgressBar value={currentStage.progress_percent} />
                    </div>

                    {["requeridos", "opcionales", "contrato_extra"].map(blockKey => {
                        const title = blockKey === "requeridos"
                            ? "Entregables requeridos"
                            : blockKey === "opcionales"
                                ? "Entregables opcionales"
                                : "Documentos contrato / adicionales (opcionales)";
                        const items = groupDeliverables(currentStage)[blockKey];
                        if (!items.length) return null;

                        const table = (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-slate-600">
                                                <th className="py-2 pr-3">Entregable</th>
                                                <th className="py-2 pr-3">Estado</th>
                                                <th className="py-2 pr-3">Archivos</th>
                                                <th className="py-2">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((d) => {
                                                const hasActive = d.multi
                                                    ? d.files.length > 0
                                                    : d.files.some((f) => f.is_active);
                                                const accept = acceptFromAllowed(d.allowed_ext);

                                                return (
                                                    <tr key={d.key} className="border-t">
                                                        <td className="py-3 pr-3 align-top">
                                                            <div className="font-medium">{d.title}</div>
                                                            <div className="mt-1">
                                                                {d.required ? chip("Obligatorio") : chip("Opcional")}
                                                                {d.multi ? chip("Multiple") : chip("Único")}
                                                                {d.allowed_ext?.length ? chip(d.allowed_ext.join(" | ").toUpperCase()) : null}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 pr-3 align-top">
                                                            <span
                                                                className={
                                                                    "inline-flex rounded-full px-2 py-0.5 text-xs " +
                                                                    (hasActive
                                                                        ? "bg-green-100 text-green-800 border border-green-200"
                                                                        : "bg-amber-100 text-amber-800 border border-amber-200")
                                                                }
                                                            >
                                                                {hasActive ? "Completo" : "Faltante"}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 pr-3 align-top">
                                                            {d.files.length === 0 ? (
                                                                <span className="text-slate-500">—</span>
                                                            ) : (
                                                                <ul className="space-y-1">
                                                                    {d.files.map((f) => (
                                                                        <li key={f.id} className="flex items-center gap-2">
                                                                            <span className="text-slate-700">
                                                                                v{f.version} · {f.filename} · {bytes(f.size_bytes)}
                                                                            </span>
                                                                            {f.pending_delete && (
                                                                                <span className="text-xs text-red-600">(pendiente)</span>
                                                                            )}
                                                                            {f.is_active ? chip("Activo") : chip("Histórico")}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => downloadFileById(f.id, f.filename, token, { view: true })}
                                                                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                                                title="Ver"
                                                                            >
                                                                                Ver
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => downloadFileById(f.id, f.filename, token)}
                                                                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                                                title="Descargar"
                                                                            >
                                                                                Descargar
                                                                            </button>
                                                                            {f.pending_delete ? (
                                                                                <span className="rounded-md border px-2 py-1 text-xs text-slate-500" title="Pendiente de eliminación">
                                                                                    Pendiente
                                                                                </span>
                                                                            ) : (
                                                                                !readOnly && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => onDeleteFile(f.id)}
                                                                                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                                                        title="Eliminar"
                                                                                    >
                                                                                        Eliminar
                                                                                    </button>
                                                                                )
                                                                            )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </td>
                                                    <td className="py-3 align-top">
                                                        {!readOnly && (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    ref={(el) => (fileInputs.current[d.key] = el)}
                                                                    type="file"
                                                                    accept={accept}
                                                                    className="hidden"
                                                                    onChange={(e) => handleFileSelected(d, e)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => triggerSelect(d.key)}
                                                                    disabled={busy}
                                                                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800 disabled:opacity-50"
                                                                >
                                                                    {busy ? "Subiendo..." : hasActive && !d.multi ? "Reemplazar" : "Subir"}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                                {/* barra global de subida */}
                                {busy && (
                                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                        <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                )}
                            </>
                        );

                        if (blockKey === "adicionalesContrato") {
                            return (
                                <details key={blockKey} className="mt-5">
                                    <summary className="text-sm font-semibold cursor-pointer select-none">
                                        {title}
                                    </summary>
                                    <div className="mt-2">{table}</div>
                                </details>
                            );
                        }

                        return (
                            <div key={blockKey} className="mt-5">
                                <h4 className="text-sm font-semibold mb-2">{title}</h4>
                                {table}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
