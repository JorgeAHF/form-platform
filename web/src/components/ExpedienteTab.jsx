import { useEffect, useMemo, useRef, useState } from "react";
import {
    getProjects,
    getStages,
    getExpediente,
    uploadExpediente,
    downloadFileById,
    deleteFile,
} from "../api";


function bytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function chip(txt) {
    return (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-700 bg-slate-50 mr-1">
            {txt}
        </span>
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

export default function ExpedienteTab({ token }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [stages, setStages] = useState([]);
    const [stageId, setStageId] = useState("");
    const [snap, setSnap] = useState(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);

    // file inputs dinámicos por entregable
    const fileInputs = useRef({}); // deliverableKey -> input

    useEffect(() => {
        async function boot() {
            try {
                const p = await getProjects(token);
                setProjects(p);
                if (p[0]) {
                    setProjectId(String(p[0].id));
                }
            } catch (e) {
                console.error(e);
                alert("Error cargando proyectos");
            }
        }
        boot();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        async function loadStagesAndSnap() {
            try {
                const sts = await getStages(projectId, token);
                setStages(sts);
                if (sts[0]) setStageId(String(sts[0].id));
                const s = await getExpediente(projectId, token);
                setSnap(s);
            } catch (e) {
                console.error(e);
                alert("Error cargando etapas/expediente");
            }
        }
        loadStagesAndSnap();
    }, [projectId, token]);

    async function refreshSnap() {
        if (!projectId) return;
        const s = await getExpediente(projectId, token);
        setSnap(s);
    }

    const currentStage = useMemo(() => {
        if (!snap || !stageId) return null;
        const id = Number(stageId);
        return snap.stages.find((s) => s.stage.id === id) || null;
    }, [snap, stageId]);

    function acceptFromAllowed(allowed_ext = []) {
        // ".pdf,.doc,.docx,.xls,.xlsx"
        const dots = allowed_ext.map((e) => `.${e.toLowerCase()}`);
        return dots.join(",");
    }

    function triggerSelect(deliverableKey) {
        if (fileInputs.current[deliverableKey]) {
            fileInputs.current[deliverableKey].value = "";
            fileInputs.current[deliverableKey].click();
        }
    }

    async function handleFileSelected(deliv, e) {
        const file = e.target.files?.[0];
        if (!file) return;
        let reason = undefined;

        // Si es single y ya hay activo => pedir motivo de versión
        const hasActive =
            deliv.multi === false &&
            Array.isArray(deliv.files) &&
            deliv.files.some((f) => f.is_active);

        if (hasActive) {
            reason = window.prompt("Motivo de la nueva versión:");
            if (!reason || !reason.trim()) {
                alert("Debes indicar un motivo.");
                return;
            }
        }

        try {
            setBusy(true);
            setProgress(0);
            await uploadExpediente({
                projectId,
                stageId,
                deliverableKey: deliv.key,
                file,
                reason,
                token,
                onProgress: setProgress,
            });
            await refreshSnap();
        } catch (err) {
            console.error(err);
            alert(err.message || "Error subiendo archivo");
        } finally {
            setBusy(false);
            setProgress(0);
        }
    }

    async function onDeleteFile(id) {
        if (!window.confirm("¿Eliminar este archivo?")) return;
        try {
            await deleteFile(id, token);
            await refreshSnap();
        } catch (err) {
            console.error(err);
            alert(err.message || "Error eliminando archivo");
        }
    }

    function groupDeliverables(list = []) {
        const req = [];
        const opc = [];
        const extrasContrato = [];
        for (const d of list) {
            if (d.optional_group === "documentos_contrato_adicionales") {
                extrasContrato.push(d);
            } else if (d.required) {
                req.push(d);
            } else {
                opc.push(d);
            }
        }
        // ordena por order ya viene ordenado desde backend, por si acaso:
        return {
            requeridos: req,
            opcionales: opc,
            adicionalesContrato: extrasContrato,
        };
    }

    return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Expediente IMT</h3>

            {/* Selectores */}
            <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                    <label className="text-sm font-medium">Proyecto</label>
                    <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.code} — {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium">Etapa</label>
                    <select
                        value={stageId}
                        onChange={(e) => setStageId(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium">Avance del proyecto</label>
                    <div className="flex items-center gap-3">
                        <ProgressBar value={snap?.progress_percent || 0} />
                        <span className="text-sm w-12 text-right">{snap?.progress_percent ?? 0}%</span>
                    </div>
                </div>
            </div>

            <hr className="my-4" />

            {!currentStage ? (
                <p className="text-sm text-slate-600">Selecciona proyecto y etapa.</p>
            ) : (
                <>
                    {/* progreso de la etapa */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium">
                                {currentStage.stage.name}
                            </div>
                            <div className="text-xs text-slate-600">
                                {currentStage.required_done}/{currentStage.required_total} requeridos
                            </div>
                        </div>
                        <ProgressBar value={currentStage.progress_percent} />
                    </div>

                    {/* tablas */}
                    {["requeridos", "opcionales", "adicionalesContrato"].map((blockKey) => {
                        const title =
                            blockKey === "requeridos"
                                ? "Entregables requeridos"
                                : blockKey === "opcionales"
                                    ? "Entregables opcionales"
                                    : "Documentos contrato / adicionales (opcionales)";
                        const items = groupDeliverables(currentStage.deliverables)[blockKey];
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
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onDeleteFile(f.id)}
                                                                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                                                title="Eliminar"
                                                                            >
                                                                                Eliminar
                                                                            </button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </td>
                                                        <td className="py-3 align-top">
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
