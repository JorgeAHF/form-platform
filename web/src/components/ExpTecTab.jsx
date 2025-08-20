import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
    const [openNodes, setOpenNodes] = useState({});
    const [activePath, setActivePath] = useState("");
    const fileInput = useRef(null);
    const dirInput = useRef(null);
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
                // La ruta ya no incluye subcarpeta por fecha; el índice final corresponde al archivo
                let rest = parts.slice(2, parts.length - 1);
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
            setOpenNodes((prev) => {
                const root = {};
                Object.values(base).forEach((n) => (root[n.pathKey] = true));
                return { ...root, ...prev };
            });
            setActivePath((prev) =>
                prev && nodeMap.current[prev]
                    ? prev
                    : Object.values(base)[0]?.pathKey || ""
            );
        } catch (err) {
            console.error(err);
        }
    }


    function pickFiles() {
        fileInput.current?.click();
    }

    function pickDir() {
        dirInput.current?.click();
    }

    async function onFiles(e) {
        const node = nodeMap.current[activePath];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length || !node) return;
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

    async function onDir(e) {
        const node = nodeMap.current[activePath];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length || !node) return;
        try {
            for (const file of files) {
                // webkitRelativePath usa "/" en la mayoría de navegadores, pero
                // algunos entornos (especialmente en Windows) pueden reportar
                // separadores "\\". Para asegurar compatibilidad dividimos por
                // ambos y removemos la carpeta raíz seleccionada.
                const rel = (file.webkitRelativePath || "")
                    .split(/[\\\/]+/)
                    .slice(1);
                const inner = rel.slice(0, -1).join("/");
                const sp = node.subpath
                    ? [node.subpath, inner].filter(Boolean).join("/")
                    : inner;
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

    function toggleNode(key) {
        setOpenNodes((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    function handleSelectNode(key) {
        setActivePath(key);
        setOpenNodes((prev) => {
            const next = { ...prev };
            const parts = key.split("/");
            for (let i = 1; i <= parts.length; i++) {
                const k = parts.slice(0, i).join("/");
                next[k] = true;
            }
            return next;
        });
    }

    function renderNode(node) {
        const dirs = Object.values(node.children || {});
        const files = node.files || [];
        const hasChildren = dirs.length > 0 || files.length > 0;
        const isOpen = openNodes[node.pathKey];
        return (
            <li key={node.pathKey} className="ml-2">
                <div className="flex items-center gap-1">
                    {hasChildren && (
                        <button
                            type="button"
                            onClick={() => toggleNode(node.pathKey)}
                            className="p-0.5"
                        >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                    <span
                        className={`font-medium cursor-pointer ${
                            activePath === node.pathKey ? "text-blue-600" : ""
                        }`}
                        onClick={() => handleSelectNode(node.pathKey)}
                    >
                        {node.name}
                    </span>
                </div>
                {isOpen && (
                    <ul className="ml-4 space-y-1">
                        {dirs.map((d) => renderNode(d))}
                        {files.map((f) => (
                            <li key={f.id} className="flex items-center gap-2">
                                <span className="text-slate-700 truncate">
                                    {f.filename} · {bytes(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleDateString()}
                                </span>
                                {f.pending_delete && (
                                    <span className="text-xs text-red-600">(pendiente)</span>
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        downloadFileById(f.id, f.filename, token, { view: true })
                                    }
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
                )}
            </li>
        );
    }

    function Breadcrumb({ pathKey, onSelect }) {
        if (!pathKey) return null;
        const parts = pathKey.split("/");
        const items = [];
        for (let i = 1; i <= parts.length; i++) {
            const key = parts.slice(0, i).join("/");
            const node = nodeMap.current[key];
            if (node) items.push({ key, name: node.name });
        }
        return (
            <div className="flex items-center gap-1 text-sm">
                {items.map((item, idx) => (
                    <span key={item.key} className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onSelect(item.key)}
                            className="text-blue-600 hover:underline"
                        >
                            {item.name}
                        </button>
                        {idx < items.length - 1 && <span>/</span>}
                    </span>
                ))}
            </div>
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
            <Breadcrumb pathKey={activePath} onSelect={handleSelectNode} />
            {activePath && nodeMap.current[activePath]?.categoryKey && !readOnly && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={pickFiles}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                    >
                        Subir archivos
                    </button>
                    <button
                        type="button"
                        onClick={pickDir}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                    >
                        Subir carpeta
                    </button>
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInput}
                        onChange={onFiles}
                    />
                    <input
                        type="file"
                        multiple
                        webkitdirectory="true"
                        directory=""
                        className="hidden"
                        ref={dirInput}
                        onChange={onDir}
                    />
                </div>
            )}
            <ul className="space-y-1">
                {Object.values(fileTree).map((sec) => renderNode(sec))}
            </ul>
        </div>
    );
}
