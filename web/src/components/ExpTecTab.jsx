import { useEffect, useRef, useState } from "react";
import {
    getProjects,
    getCategoryTree,
    listFiles,
    uploadByCategory,
    downloadFileById,
    requestDeleteFile,
} from "../api";

function bytes(n) {
    if (!n && n !== 0) return "-";
    const kb = 1024, mb = kb * 1024, gb = mb * 1024;
    if (n >= gb) return (n / gb).toFixed(2) + " GB";
    if (n >= mb) return (n / mb).toFixed(2) + " MB";
    if (n >= kb) return (n / kb).toFixed(2) + " KB";
    return n + " B";
}

export default function ExpTecTab({ token, readOnly = false }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [tree, setTree] = useState({ sections: [] });
    const [filesMap, setFilesMap] = useState({});
    const fileInputs = useRef({});

    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
                const pid = projs?.[0]?.id ? String(projs[0].id) : "";
                setProjectId(pid);
            } catch (err) {
                console.error(err);
            }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            try {
                const t = await getCategoryTree(projectId, token);
                setTree(t);
                await loadFiles(projectId);
            } catch (err) {
                console.error(err);
            }
        })();
    }, [projectId, token]);

    async function loadFiles(pid) {
        try {
            const items = await listFiles(pid, {}, token);
            const map = {};
            for (const f of items) {
                if (f.stage) continue; // solo info técnica
                if (!f.path) continue;
                const parts = f.path.split("/");
                const section = parts[0];
                const category = parts[1];
                let sub = null;
                if (parts.length > 4) sub = parts[2];
                const key = [section, category, sub].filter(Boolean).join("/");
                if (!map[key]) map[key] = [];
                map[key].push(f);
            }
            setFilesMap(map);
        } catch (err) {
            console.error(err);
        }
    }

    function pickFile(key) {
        fileInputs.current[key]?.click();
    }

    async function onFile(e, secKey, catKey, subKey, key) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            await uploadByCategory(projectId, secKey, catKey, subKey, file, token);
            await loadFiles(projectId);
        } catch (err) {
            console.error(err);
            alert(err.message || "Error subiendo archivo");
        }
    }

    async function onDelete(id) {
        const reason = window.prompt("Motivo para eliminar este archivo:");
        if (!reason || !reason.trim()) return;
        try {
            await requestDeleteFile(id, reason, token);
            alert("Solicitud enviada");
            await loadFiles(projectId);
        } catch (err) {
            console.error(err);
            alert(err.message || "Error solicitando eliminación");
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm font-medium">Proyecto</label>
                <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="mt-1 w-full max-w-sm rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                >
                    <option value="">— Selecciona —</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                        </option>
                    ))}
                </select>
            </div>

            {tree.sections.map((sec) => {
                const rows = [];
                sec.categories.forEach((cat) => {
                    if (cat.children && cat.children.length) {
                        cat.children.forEach((sub) => {
                            rows.push({
                                sectionKey: sec.key,
                                categoryKey: cat.key,
                                subKey: sub.key,
                                title: `${cat.folder} / ${sub.folder}`,
                                mapKey: [sec.folder, cat.folder, sub.folder].join("/"),
                            });
                        });
                    } else {
                        rows.push({
                            sectionKey: sec.key,
                            categoryKey: cat.key,
                            subKey: null,
                            title: cat.folder,
                            mapKey: [sec.folder, cat.folder].join("/"),
                        });
                    }
                });
                return (
                    <div key={sec.key} className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">{sec.folder}</h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="py-2 pr-3">Categoría</th>
                                        <th className="py-2 pr-3">Acciones</th>
                                        <th className="py-2 pr-3">Archivos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.mapKey} className="border-b align-top">
                                            <td className="py-2 pr-3">{r.title}</td>
                                            <td className="py-2 pr-3">
                                                {!readOnly && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => pickFile(r.mapKey)}
                                                            className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                        >
                                                            Subir
                                                        </button>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            ref={(el) => (fileInputs.current[r.mapKey] = el)}
                                                            onChange={(e) =>
                                                                onFile(e, r.sectionKey, r.categoryKey, r.subKey, r.mapKey)
                                                            }
                                                        />
                                                    </>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <ul className="space-y-1">
                                                    {(filesMap[r.mapKey] || []).map((f) => (
                                                        <li key={f.id} className="flex items-center gap-2">
                                                            <span className="text-slate-700 truncate">
                                                                {f.filename} · {bytes(f.size_bytes)}
                                                            </span>
                                                            {f.pending_delete && (
                                                                <span className="text-xs text-red-600">(pendiente)</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => downloadFileById(f.id, f.filename, token, { view: true })}
                                                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                            >
                                                                Ver
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => downloadFileById(f.id, f.filename, token)}
                                                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                            >
                                                                Descargar
                                                            </button>
                                                            {f.pending_delete ? (
                                                                <span className="rounded-md border px-2 py-1 text-xs text-slate-500">Pendiente</span>
                                                            ) : (
                                                                !readOnly && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onDelete(f.id)}
                                                                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                                    >
                                                                        Eliminar
                                                                    </button>
                                                                )
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
