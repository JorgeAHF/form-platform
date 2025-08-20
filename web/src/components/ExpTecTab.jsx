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
    const [schema, setSchema] = useState({ sections: [] });
    const [fileTree, setFileTree] = useState({});
    const fileInputs = useRef({});
    const dirInputs = useRef({});
    const nodeMap = useRef({});

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
                setSchema(t);
                await loadFiles(projectId, t);
            } catch (err) {
                console.error(err);
            }
        })();
    }, [projectId, token]);

    function buildBaseTree(sch) {
        const root = {};
        sch.sections.forEach((sec) => {
            const secNode = {
                name: sec.folder,
                sectionKey: sec.key,
                categoryKey: null,
                subcategoryKey: null,
                subpath: "",
                pathKey: sec.key,
                children: {},
            };
            root[sec.folder] = secNode;
            sec.categories.forEach((cat) => {
                const catNode = {
                    name: cat.folder,
                    sectionKey: sec.key,
                    categoryKey: cat.key,
                    subcategoryKey: null,
                    subpath: "",
                    pathKey: [sec.key, cat.key].join("/"),
                    children: {},
                };
                secNode.children[cat.folder] = catNode;
                (cat.children || []).forEach((sub) => {
                    const subNode = {
                        name: sub.folder,
                        sectionKey: sec.key,
                        categoryKey: cat.key,
                        subcategoryKey: sub.key,
                        subpath: "",
                        pathKey: [sec.key, cat.key, sub.key].join("/"),
                        children: {},
                    };
                    catNode.children[sub.folder] = subNode;
                });
            });
        });
        return root;
    }

    async function loadFiles(pid, currSchema = schema) {
        try {
            const items = await listFiles(pid, {}, token);
            const base = buildBaseTree(currSchema);
            for (const f of items) {
                if (f.stage) continue;
                if (!f.path) continue;
                const parts = f.path.split("/");
                const section = parts[0];
                const category = parts[1];
                const dateIdx = parts.length - 2;
                let rest = parts.slice(2, dateIdx);
                let node = base[section]?.children?.[category];
                if (!node) continue;
                if (rest.length && node.children[rest[0]] && node.children[rest[0]].subcategoryKey) {
                    node = node.children[rest[0]];
                    rest = rest.slice(1);
                }
                for (const seg of rest) {
                    const newSub = node.subpath ? `${node.subpath}/${seg}` : seg;
                    if (!node.children[seg]) {
                        node.children[seg] = {
                            name: seg,
                            sectionKey: node.sectionKey,
                            categoryKey: node.categoryKey,
                            subcategoryKey: node.subcategoryKey,
                            subpath: newSub,
                            pathKey: [node.sectionKey, node.categoryKey, node.subcategoryKey, newSub]
                                .filter(Boolean)
                                .join("/"),
                            children: {},
                        };
                    }
                    node = node.children[seg];
                }
                node.files = node.files || [];
                node.files.push(f);
            }
            nodeMap.current = {};
            function register(n) {
                nodeMap.current[n.pathKey] = n;
                Object.values(n.children).forEach(register);
            }
            Object.values(base).forEach(register);
            setFileTree(base);
        } catch (err) {
            console.error(err);
        }
    }

    function pickFiles(key) {
        fileInputs.current[key]?.click();
    }

    function pickDir(key) {
        dirInputs.current[key]?.click();
    }
    async function onFiles(e, key) {
        const node = nodeMap.current[key];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;
        try {
            for (const file of files) {
                await uploadByCategory(
                    projectId,
                    node.sectionKey,
                    node.categoryKey,
                    node.subcategoryKey,
                    file,
                    token,
                    node.subpath,
                    undefined
                );
            }
            await loadFiles(projectId);
        } catch (err) {
            console.error(err);
            alert(err.message || "Error subiendo archivo");
        }
    }

    async function onDir(e, key) {
        const node = nodeMap.current[key];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;
        try {
            for (const file of files) {
                // webkitRelativePath usa "/" en la mayoría de navegadores, pero
                // algunos entornos (especialmente en Windows) pueden reportar
                // separadores "\". Para asegurar compatibilidad dividimos por
                // ambos y removemos la carpeta raíz seleccionada.
                const rel = (file.webkitRelativePath || "")
                    .split(/[\\\/]+/)
                    .slice(1);
                const inner = rel.slice(0, -1).join("/");
                const sp = node.subpath ? [node.subpath, inner].filter(Boolean).join("/") : inner;
                await uploadByCategory(
                    projectId,
                    node.sectionKey,
                    node.categoryKey,
                    node.subcategoryKey,
                    file,
                    token,
                    sp,
                    undefined
                );
            }
            await loadFiles(projectId);
        } catch (err) {
            console.error(err);
            alert(err.message || "Error subiendo carpeta");
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

    function renderNode(node) {
        const dirs = Object.values(node.children || {});
        return (
            <li key={node.pathKey} className="ml-2">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{node.name}</span>
                    {node.categoryKey && (
                        <>
                            <button
                                type="button"
                                onClick={() => pickFiles(node.pathKey)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                                Subir archivos
                            </button>
                            <button
                                type="button"
                                onClick={() => pickDir(node.pathKey)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                                Subir carpeta
                            </button>
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                ref={(el) => (fileInputs.current[node.pathKey] = el)}
                                onChange={(e) => onFiles(e, node.pathKey)}
                            />
                            <input
                                type="file"
                                multiple
                                webkitdirectory="true"
                                directory=""
                                className="hidden"
                                ref={(el) => (dirInputs.current[node.pathKey] = el)}
                                onChange={(e) => onDir(e, node.pathKey)}
                            />
                        </>
                    )}
                </div>
                <ul className="ml-4 space-y-1">
                    {dirs.map((d) => renderNode(d))}
                    {(node.files || []).map((f) => (
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
                                <span className="rounded-md border px-2 py-1 text-xs text-slate-500">
                                    Pendiente
                                </span>
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
            </li>
        );
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
            <ul className="space-y-1">
                {Object.values(fileTree).map((sec) => renderNode(sec))}
            </ul>
        </div>
    );
}
