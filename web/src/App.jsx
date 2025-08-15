import React, { useState, useEffect } from "react";
import {
    login, getProjects, getStages,
    uploadByCategory, uploadExpedienteLegacy, getCategoryTree
} from "./api";
import Dashboard from "./Dashboard";
import ProjectAdmin from "./ProjectAdmin";
import MemberAdmin from "./MemberAdmin";
import RegistrationAdmin from "./RegistrationAdmin";
import FilesExplorer from "./FilesExplorer";
import toast from "react-hot-toast";
import { LogOut, Upload, BarChart3, FolderOpen, Settings2, Users, ClipboardList } from "lucide-react";
import ExpedienteTab from "./components/ExpedienteTab";


export default function App() {
    const [token, setToken] = useState(localStorage.getItem("apiToken") || "");
    const [role, setRole] = useState("");

    // login / registro
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [reqMsg, setReqMsg] = useState("");

    // navegación
    const [tab, setTab] = useState("subir"); // subir | dashboard | archivos | proyectos | miembros | solicitudes

    // subir
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [stages, setStages] = useState([]);
    const [stageId, setStageId] = useState("");
    const [catTree, setCatTree] = useState(null);
    const [sectionKey, setSectionKey] = useState("");
    const [categoryKey, setCategoryKey] = useState("");
    const [subcategoryKey, setSubcategoryKey] = useState("");
    const [mode, setMode] = useState("expediente"); // 'expediente' | 'info'
    const [expSubfolder, setExpSubfolder] = useState("");
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);


    useEffect(() => { if (token) localStorage.setItem("apiToken", token); }, [token]);

    async function doLogin(e) {
        e?.preventDefault();
        try {
            const j = await login(username, password);
            setToken(j.access_token);
            setRole(j.role);
            toast.success("Sesión iniciada");
            const projs = await getProjects(j.access_token);
            setProjects(projs);
        } catch (err) {
            toast.error(err.message || "Login inválido");
        }
    }

    // solicitud de registro (mantén tu endpoint/flujo actual si ya lo tienes en RegistrationAdmin)
    function logout() {
        setToken("");
        setRole("");
        localStorage.removeItem("apiToken");
    }

    async function refreshProjects() {
        try {
            const projs = await getProjects(token);
            setProjects(projs);
        } catch (err) {
            toast.error(err.message);
        }
    }

    async function onProjectChange(pid) {
        setProjectId(pid);
        setStageId("");
        setStages([]);
        setCatTree(null);
        setSectionKey(""); setCategoryKey(""); setSubcategoryKey("");
        if (!pid) return;
        try {
            const tree = await getCategoryTree(pid, token);
            setCatTree(tree);
            const sts = await getStages(pid, token);
            setStages(sts);
        } catch (err) { toast.error(err.message); }
    }

    async function doUpload() {
        if (!file || !projectId) return toast.error("Selecciona proyecto y archivo");
        setBusy(true);
        setProgress(0);
        try {
            let j;
            if (mode === "expediente") {
                if (!stageId) return toast.error("Elige una etapa del Expediente");
                j = await uploadExpedienteLegacy(projectId, stageId, file, token, null, (p) => setProgress(p));
            } else {
                if (!sectionKey || !categoryKey) return toast.error("Elige sección y categoría");
                j = await uploadByCategory(projectId, sectionKey, categoryKey, subcategoryKey, file, token, (p) => setProgress(p));
            }
            toast.success(`Subido: ${j.file?.filename || file.name}`);
            setFile(null);
        } catch (err) {
            toast.error(err.message || "Fallo la subida");
        } finally {
            setBusy(false);
            setTimeout(() => setProgress(0), 500);
        }
    }

    // UI helpers
    const NavBtn = ({ active, onClick, icon: Icon, children }) => (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 border transition ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
        >
            {Icon && <Icon size={16} />} {children}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="border-b bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-slate-900 text-white grid place-content-center font-bold">E</div>
                        <h1 className="text-lg font-semibold tracking-tight">Entregables</h1>
                        {token && <span className="ml-3 text-xs text-slate-500">({role})</span>}
                    </div>
                    {token && (
                        <button onClick={logout} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                            <LogOut size={16} /> Salir
                        </button>
                    )}
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6">
                {!token ? (
                    <div className="mx-auto max-w-md">
                        <div className="rounded-2xl border bg-white p-6 shadow-sm">
                            <h2 className="text-base font-semibold mb-4">Iniciar sesión</h2>
                            <form className="grid gap-3" onSubmit={doLogin}>
                                <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Usuario"
                                    value={username} onChange={e => setUsername(e.target.value)} />
                                <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Contraseña" type="password"
                                    value={password} onChange={e => setPassword(e.target.value)} />
                                <button className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800">
                                    Entrar
                                </button>
                            </form>

                            <div className="mt-4 text-sm text-slate-600">
                                ¿No tienes cuenta? Pídesela al admin o usa la opción “Solicitudes” cuando el admin esté logueado.
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* NAV */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <NavBtn active={tab === "subir"} onClick={() => setTab("subir")} icon={Upload}>Subir</NavBtn>
                            <NavBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={BarChart3}>Dashboard</NavBtn>
                            <NavBtn active={tab === "archivos"} onClick={() => setTab("archivos")} icon={FolderOpen}>Archivos</NavBtn>
                            <NavBtn active={tab === "expediente"} onClick={() => setTab("expediente")}>Expediente IMT</NavBtn>
                            {role === "admin" && (
                                <>
                                    <NavBtn active={tab === "proyectos"} onClick={() => setTab("proyectos")} icon={Settings2}>Proyectos</NavBtn>
                                    <NavBtn active={tab === "miembros"} onClick={() => setTab("miembros")} icon={Users}>Miembros</NavBtn>
                                    <NavBtn active={tab === "solicitudes"} onClick={() => setTab("solicitudes")} icon={ClipboardList}>Solicitudes</NavBtn>
                                </>
                            )}
                        </div>

                        {/* VISTAS */}
                        {tab === "subir" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <h3 className="text-base font-semibold mb-4">Subir entregable</h3>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-3">
                                        <label className="text-sm font-medium">Proyecto</label>
                                        <div className="flex items-center gap-2">
                                            <select value={projectId} onChange={e => onProjectChange(e.target.value)}
                                                className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                                                <option value="">— Selecciona —</option>
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                            </select>
                                            <button type="button" onClick={refreshProjects}
                                                className="rounded-lg border px-3 py-2 bg-white hover:bg-slate-100">↻</button>
                                        </div>

                                        <label className="text-sm font-medium mt-2">Subir a</label>
                                        <select value={mode} onChange={e => setMode(e.target.value)}
                                            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                                            <option value="expediente">Expediente IMT (Etapa)</option>
                                            <option value="info">Información técnica (Categoría)</option>
                                        </select>

                                        {mode === "expediente" && (
                                            <>
                                                <label className="text-sm font-medium mt-2">Etapa</label>
                                                <select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!projectId}
                                                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60">
                                                    <option value="">— Selecciona —</option>
                                                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>

                                                <label className="text-sm font-medium mt-2">Subcarpeta (opcional)</label>
                                                <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                                                    placeholder="p.ej. Documentos contrato" value={expSubfolder}
                                                    onChange={e => setExpSubfolder(e.target.value)} />
                                            </>
                                        )}

                                        {mode === "info" && catTree && (
                                            <>
                                                <label className="text-sm font-medium mt-2">Sección</label>
                                                <select value={sectionKey} onChange={e => { setSectionKey(e.target.value); setCategoryKey(""); setSubcategoryKey(""); }}
                                                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                                                    <option value="">— Selecciona —</option>
                                                    {catTree.sections.map(s => <option key={s.key} value={s.key}>{s.folder}</option>)}
                                                </select>

                                                {!!sectionKey && (
                                                    <>
                                                        <label className="text-sm font-medium mt-2">Categoría</label>
                                                        <select value={categoryKey} onChange={e => { setCategoryKey(e.target.value); setSubcategoryKey(""); }}
                                                            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                                                            <option value="">— Selecciona —</option>
                                                            {catTree.sections.find(s => s.key === sectionKey)?.categories.map(c => (
                                                                <option key={c.key} value={c.key}>{c.folder}</option>
                                                            ))}
                                                        </select>
                                                    </>
                                                )}

                                                {!!categoryKey && !!catTree.sections.find(s => s.key === sectionKey)?.categories.find(c => c.key === categoryKey)?.children?.length && (
                                                    <>
                                                        <label className="text-sm font-medium mt-2">Subcategoría</label>
                                                        <select value={subcategoryKey} onChange={e => setSubcategoryKey(e.target.value)}
                                                            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300">
                                                            <option value="">— (opcional) —</option>
                                                            {catTree.sections.find(s => s.key === sectionKey)?.categories.find(c => c.key === categoryKey)?.children.map(sub => (
                                                                <option key={sub.key} value={sub.key}>{sub.folder}</option>
                                                            ))}
                                                        </select>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        <label className="text-sm font-medium mt-2">Archivo</label>
                                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
                                            className="rounded-lg border px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white hover:file:bg-slate-800" />
                                        <p className="text-xs text-slate-500">Permitidos: pdf, docx, xlsx, jpg, png, zip</p>

                                        <div className="mt-2">
                                            <button type="button" onClick={doUpload} disabled={busy}
                                                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50">
                                                {busy ? "Subiendo..." : "Subir"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Nota/ayuda */}
                                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                                        <p className="font-medium mb-1">Tips</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>Elige <b>Expediente IMT</b> si quieres que cuente para el avance por etapas.</li>
                                            <li>Usa <b>Información técnica</b> para almacenar datos crudos, algoritmos, figuras, etc.</li>
                                            <li>Puedes crear <i>subcarpeta</i> dentro de una etapa (ej. “Documentos contrato”).</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : tab === "dashboard" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <Dashboard token={token} />
                            </div>
                        ) : tab === "archivos" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <FilesExplorer token={token} role={role} />
                            </div>
                        ) : tab === "expediente" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <ExpedienteTab token={token} />
                            </div>
                        ) : tab === "proyectos" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <ProjectAdmin
                                    token={token}
                                    role={role}
                                    onProjectsChanged={async () => {
                                        const projs = await getProjects(token);
                                        setProjects(projs);
                                    }}
                                />
                                <div className="mt-6">
                                    <h4 className="text-sm font-semibold mb-2">Proyectos actuales</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        {projects.map(p => (
                                            <li key={p.id}>{p.code} — {p.name} <span className="text-slate-400">({p.type})</span></li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : tab === "miembros" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <MemberAdmin token={token} role={role} />
                            </div>
                        ) : (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <RegistrationAdmin token={token} role={role} />
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
