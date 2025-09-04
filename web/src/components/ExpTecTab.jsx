import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
    ChevronDown,
    ChevronRight,
    File as FileIcon,
    FileText,
    FileImage,
    FileArchive,
    FileSpreadsheet,
    FileVideo,
    FileAudio,
} from "lucide-react";
import {
    API,
    getProjects,
    getCategoryTree,
    listFiles,
    uploadByCategory,
    downloadFileById,
    requestDeleteFile,
    bulkDownloadFiles,
    bulkRequestDelete,
} from "../api";

function bytes(n) {
    if (!n && n !== 0) return "-";
    const kb = 1024, mb = kb * 1024, gb = mb * 1024;
    if (n >= gb) return (n / gb).toFixed(2) + " GB";
    if (n >= mb) return (n / mb).toFixed(2) + " MB";
    if (n >= kb) return (n / kb).toFixed(2) + " KB";
    return n + " B";
}

function fileIconFor(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
        pdf: FileText,
        txt: FileText,
        doc: FileText,
        docx: FileText,
        csv: FileSpreadsheet,
        xls: FileSpreadsheet,
        xlsx: FileSpreadsheet,
        png: FileImage,
        jpg: FileImage,
        jpeg: FileImage,
        gif: FileImage,
        bmp: FileImage,
        mp4: FileVideo,
        webm: FileVideo,
        mov: FileVideo,
        avi: FileVideo,
        mp3: FileAudio,
        wav: FileAudio,
        ogg: FileAudio,
        zip: FileArchive,
        rar: FileArchive,
        "7z": FileArchive,
        tar: FileArchive,
        gz: FileArchive,
    };
    return map[ext] || FileIcon;
}

export default function ExpTecTab({ token, readOnly = false }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [schema, setSchema] = useState({ sections: [] });
    const [fileTree, setFileTree] = useState({});
    const [openNodes, setOpenNodes] = useState({});
    const [activePath, setActivePath] = useState("");
    const [query, setQuery] = useState("");
    const [limit, setLimit] = useState(50);
    const [offset, setOffset] = useState(0);
    const fileInput = useRef(null);
    const dirInput = useRef(null);
    const nodeMap = useRef({});
    const [uploads, setUploads] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const previewRef = useRef(null);
    const [selected, setSelected] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
                const pid = projs?.[0]?.id ? String(projs[0].id) : "";
                setProjectId(pid);
            } catch (err) {
                toast.error(err.message || "Error cargando proyectos");
            }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            try {
                const t = await getCategoryTree(projectId, token);
                setSchema(t);
            } catch (err) {
                toast.error(err.message || "Error cargando categorías");
            }
        })();
    }, [projectId, token]);

    useEffect(() => {
        if (!projectId) return;
        loadFiles(projectId, schema);
    }, [projectId, token, query, limit, offset, schema]);

    useEffect(() => {
        if (previewFile) {
            previewRef.current?.showModal();
        } else {
            previewRef.current?.close();
        }
    }, [previewFile]);

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
            const items = await listFiles(pid, { q: query, limit, offset }, token);
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
            toast.error(err.message || "Error cargando archivos");
        }
    }

    function highlight(text) {
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return (
            <>
                {text.slice(0, idx)}
                <mark>{text.slice(idx, idx + query.length)}</mark>
                {text.slice(idx + query.length)}
            </>
        );
    }

    function pickFiles() {
        fileInput.current?.click();
    }

    function pickDir() {
        dirInput.current?.click();
    }

    async function uploadFilesToNode(node, files) {
        if (!files.length || !node) return;
        try {
            for (const file of files) {
                const rel = (file.webkitRelativePath || file.name)
                    .split(/[\\\/]+/)
                    .slice(1);
                const inner = rel.slice(0, -1).join("/");
                const sp = node.subpath
                    ? [node.subpath, inner].filter(Boolean).join("/")
                    : inner;
                const id = Math.random().toString(36).slice(2);
                setUploads((prev) => [
                    ...prev,
                    { id, name: file.name, progress: 0 },
                ]);
                await uploadByCategory(
                    projectId,
                    node.sectionKey,
                    node.categoryKey,
                    node.subcategoryKey,
                    file,
                    token,
                    sp,
                    (evt) => {
                        if (evt.lengthComputable) {
                            const pct = Math.round(
                                (evt.loaded / evt.total) * 100
                            );
                            setUploads((prev) =>
                                prev.map((u) =>
                                    u.id === id ? { ...u, progress: pct } : u
                                )
                            );
                        }
                    }
                );
                setUploads((prev) => prev.filter((u) => u.id !== id));
            }
            await loadFiles(projectId);
        } catch (err) {
            toast.error(err.message || "Error subiendo archivos");
        }
    }

    async function onFiles(e) {
        const node = nodeMap.current[activePath];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        await uploadFilesToNode(node, files);
    }

    async function onDir(e) {
        const node = nodeMap.current[activePath];
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        await uploadFilesToNode(node, files);
    }

    async function handleDrop(e, node) {
        e.preventDefault();
        e.stopPropagation();
        const target = node || nodeMap.current[activePath];
        const files = Array.from(e.dataTransfer?.files || []);
        await uploadFilesToNode(target, files);
    }

    async function onDelete(id) {
        const reason = window.prompt("Motivo para eliminar este archivo:");
        if (!reason || !reason.trim()) return;
        try {
            await requestDeleteFile(id, reason, token);
            toast.success("Solicitud enviada");
            await loadFiles(projectId);
        } catch (err) {
            toast.error(err.message || "Error solicitando eliminación");
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

    function toggleSelect(id) {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    }

    async function bulkDownload() {
        try {
            await bulkDownloadFiles(projectId, selected, token);
        } catch (err) {
            toast.error(err.message || "Error descargando archivos");
        }
    }

    async function bulkDelete() {
        const reason = window.prompt("Motivo para eliminar estos archivos:");
        if (!reason || !reason.trim()) return;
        try {
            await bulkRequestDelete(projectId, selected, reason, token);
            toast.success("Solicitud enviada");
            setSelected([]);
            await loadFiles(projectId);
        } catch (err) {
            toast.error(err.message || "Error solicitando eliminación");
        }
    }

    function previewUrl(fileId) {
        return `${API}/download/${fileId}?access_token=${encodeURIComponent(token)}&inline=1`;
    }

    function renderTree(node) {
        const dirs = Object.values(node.children || {});
        const files = node.files || [];
        const children = dirs.map((d) => renderTree(d)).filter(Boolean);
        const matchedFiles = query
            ? files.filter((f) =>
                  f.filename.toLowerCase().includes(query.toLowerCase())
              )
            : files;
        const nameMatches = query
            ? node.name.toLowerCase().includes(query.toLowerCase())
            : false;
        const hasChildren = children.length > 0 || matchedFiles.length > 0;
        if (query && !hasChildren && !nameMatches) return null;
        const isOpen = openNodes[node.pathKey];
        return (
            <li key={node.pathKey} className="ml-2">
                <div
                    className="flex items-center gap-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, node)}
                >
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
                        {highlight(node.name)}
                    </span>
                </div>
                {isOpen && (
                    <ul className="ml-4 space-y-1">{children}</ul>
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

    const activeFiles = (() => {
        const node = nodeMap.current[activePath];
        if (!node) return [];
        const files = node.files || [];
        return query
            ? files.filter((f) =>
                  f.filename.toLowerCase().includes(query.toLowerCase())
              )
            : files;
    })();

    return (
        <>
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
                <div className="flex gap-4" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                    <div className="w-1/3 rounded border p-2 overflow-y-auto max-h-[70vh]">
                        <ul className="space-y-1">
                            {Object.values(fileTree)
                                .map((sec) => renderTree(sec))
                                .filter(Boolean)}
                        </ul>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="text-sm font-medium">Buscar</label>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Buscar..."
                                    className="mt-1 w-full max-w-sm rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Límite</label>
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => setLimit(Number(e.target.value))}
                                    className="mt-1 w-24 rounded-lg border px-2 py-1 outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Offset</label>
                                <input
                                    type="number"
                                    value={offset}
                                    onChange={(e) => setOffset(Number(e.target.value))}
                                    className="mt-1 w-24 rounded-lg border px-2 py-1 outline-none focus:ring-2 focus:ring-slate-300"
                                />
                            </div>
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
                        {uploads.map((u) => (
                            <div key={u.id} className="w-full max-w-sm">
                                <div className="flex justify-between text-xs">
                                    <span>{u.name}</span>
                                    <span>{u.progress}%</span>
                                </div>
                                <div className="h-2 w-full rounded bg-slate-200">
                                    <div
                                        className="h-2 rounded bg-blue-500"
                                        style={{ width: `${u.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {selected.length > 0 && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={bulkDownload}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                >
                                    Descargar ZIP
                                </button>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={bulkDelete}
                                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                    >
                                        Eliminar seleccionados
                                    </button>
                                )}
                            </div>
                        )}
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, nodeMap.current[activePath])}
                        >
                            <table className="min-w-full text-sm border">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="p-2"></th>
                                        <th className="p-2 text-left">Nombre</th>
                                        <th className="p-2">Versión</th>
                                        <th className="p-2">Tamaño</th>
                                        <th className="p-2">Tipo</th>
                                        <th className="p-2">Fecha</th>
                                        <th className="p-2">Usuario</th>
                                        <th className="p-2">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeFiles.map((f) => {
                                        const Icon = fileIconFor(f.filename);
                                        return (
                                            <tr key={f.id} className="border-t">
                                                <td className="p-2 align-top">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.includes(f.id)}
                                                        onChange={() => toggleSelect(f.id)}
                                                    />
                                                </td>
                                                <td className="p-2 align-top">
                                                    <div className="flex items-center gap-2">
                                                        <Icon size={14} />
                                                        <span className="truncate">{highlight(f.filename)}</span>
                                                        {f.pending_delete && (
                                                            <span className="text-xs text-red-600">(pendiente)</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 align-top">v{f.version ?? 1}</td>
                                                <td className="p-2 align-top">{bytes(f.size_bytes)}</td>
                                                <td className="p-2 align-top">{f.content_type}</td>
                                                <td className="p-2 align-top">
                                                    {new Date(f.uploaded_at).toLocaleDateString()}
                                                </td>
                                                <td className="p-2 align-top">{f.uploaded_by}</td>
                                                <td className="p-2 flex gap-2 flex-wrap align-top">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewFile(f)}
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
                                                    {!readOnly && !f.pending_delete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onDelete(f.id)}
                                                            className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <dialog
                ref={previewRef}
                className="max-w-4xl w-[80vw] h-[80vh] rounded-lg"
            >
                {previewFile && (
                    <div className="flex h-full flex-col">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium truncate">
                                {previewFile.filename}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                                Cerrar
                            </button>
                        </div>
                        <iframe
                            src={previewUrl(previewFile.id)}
                            className="h-full w-full flex-1"
                        />
                    </div>
                )}
            </dialog>
        </>
    );
}
