import React, { useState, useEffect } from "react";
import {
    login, getProjects, getStages,
    uploadByCategory, uploadExpediente, getCategoryTree
} from "./api";
import Dashboard from "./Dashboard";
import ProjectAdmin from "./ProjectAdmin";
import MemberAdmin from "./MemberAdmin";
import RegistrationAdmin from "./RegistrationAdmin";
import { requestRegister } from "./api";
import FilesExplorer from "./FilesExplorer";

export default function App() {
    const [token, setToken] = useState(localStorage.getItem("apiToken") || "");
    const [role, setRole] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [tab, setTab] = useState("subir"); // subir | dashboard | proyectos | miembros | solicitudes

    const [showRequestForm, setShowRequestForm] = useState(false);
    const [reqMsg, setReqMsg] = useState("");

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
    const [msg, setMsg] = useState("");

    useEffect(() => { if (token) localStorage.setItem("apiToken", token); }, [token]);

    async function doLogin(e) {
        e?.preventDefault(); setMsg("");
        try {
            const j = await login(username, password);
            setToken(j.access_token); setRole(j.role);
            const projs = await getProjects(j.access_token);
            setProjects(projs);
        } catch (err) {
            setMsg(err.message);
        }
    }

    async function doRequestRegister(e) {
        e?.preventDefault();
        setReqMsg("");
        try {
            if (!username || !password) return setReqMsg("Escribe usuario y contraseña.");
            const res = await requestRegister(username, password);
            setReqMsg(res.message || "Solicitud enviada.");
        } catch (err) {
            setReqMsg(err.message);
        }
    }

    async function refreshProjects() {
        try {
            const projs = await getProjects(token);
            setProjects(projs);
        } catch (err) { setMsg(err.message); }
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
        } catch (err) { setMsg(err.message); }
    }

    async function doUpload() {
        if (!file || !projectId) return setMsg("Selecciona proyecto y archivo");
        setBusy(true); setMsg("");
        try {
            if (mode === "expediente") {
                if (!stageId) return setMsg("Elige una etapa del Expediente");
                const j = await uploadExpediente(projectId, stageId, file, token, expSubfolder);
                setMsg(`Subido (Expediente): ${j.file.filename}`);
            } else {
                if (!sectionKey || !categoryKey) return setMsg("Elige sección y categoría de Información técnica");
                const j = await uploadByCategory(projectId, sectionKey, categoryKey, subcategoryKey, file, token);
                setMsg(`Subido (Info técnica): ${j.file.filename}`);
            }
        } catch (err) {
            setMsg(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ fontFamily: "system-ui", margin: 24, maxWidth: 1100 }}>
            <h2>Entregables</h2>

            {!token ? (
                <>
                    {!showRequestForm ? (
                        <form onSubmit={doLogin} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
                            <input placeholder="usuario" value={username} onChange={e => setUsername(e.target.value)} />
                            <input placeholder="contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="submit">Iniciar sesión</button>
                            {msg && <small style={{ color: "#d33" }}>{msg}</small>}
                            <div style={{ marginTop: 8 }}>
                                <button type="button" onClick={() => { setShowRequestForm(true); setReqMsg(""); }}>¿No tienes cuenta? Solicitar acceso</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={doRequestRegister} style={{ display: "grid", gap: 8, maxWidth: 360 }}>
                            <h4>Solicitar acceso</h4>
                            <input placeholder="usuario deseado" value={username} onChange={e => setUsername(e.target.value)} />
                            <input placeholder="contraseña deseada" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="submit">Enviar solicitud</button>
                            <button type="button" onClick={() => { setShowRequestForm(false); setReqMsg(""); }}>Volver a login</button>
                            {reqMsg && <small style={{ color: reqMsg.toLowerCase().includes("error") ? "#d33" : "#333" }}>{reqMsg}</small>}
                        </form>
                    )}
                </>
            ) : (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                            <small>Token OK ({role || "user"})</small>{" "}
                            <button onClick={() => { setToken(""); localStorage.removeItem("apiToken"); }}>Salir</button>
                        </div>
                        <nav style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setTab("subir")} disabled={tab === "subir"}>Subir</button>
                            <button onClick={() => setTab("dashboard")} disabled={tab === "dashboard"}>Dashboard</button>
                            <button onClick={() => setTab("archivos")} disabled={tab === "archivos"}>Archivos</button>
                            {role === "admin" && (
                                <>
                                    <button onClick={() => setTab("proyectos")} disabled={tab === "proyectos"}>Proyectos</button>
                                    <button onClick={() => setTab("miembros")} disabled={tab === "miembros"}>Miembros</button>
                                    <button onClick={() => setTab("solicitudes")} disabled={tab === "solicitudes"}>Solicitudes</button>
                                </>
                            )}
                        </nav>
                    </div>

                    {tab === "subir" ? (
                        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, margin: "12px 0" }}>
                            <h3>Subir entregable</h3>
                            <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
                                <div>
                                    <label>Proyecto</label><br />
                                    <select value={projectId} onChange={e => onProjectChange(e.target.value)}>
                                        <option value="">— Selecciona —</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                    </select>
                                    <button type="button" onClick={async () => { await refreshProjects(); }} style={{ marginLeft: 8 }}>↻</button>
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <label>Subir a:</label>
                                    <select value={mode} onChange={e => setMode(e.target.value)}>
                                        <option value="expediente">Expediente IMT (Etapa)</option>
                                        <option value="info">Información técnica (Categoría)</option>
                                    </select>
                                </div>

                                {mode === "expediente" && (
                                    <>
                                        <div>
                                            <label>Etapa</label><br />
                                            <select value={stageId} onChange={e => setStageId(e.target.value)} disabled={!projectId}>
                                                <option value="">— Selecciona —</option>
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            <small style={{ marginLeft: 8 }}>Estas etapas cuentan para el avance</small>
                                        </div>
                                        <div>
                                            <label>Subcarpeta (opcional)</label><br />
                                            <input placeholder="p.ej. Documentos contrato" value={expSubfolder} onChange={e => setExpSubfolder(e.target.value)} />
                                        </div>
                                    </>
                                )}

                                {mode === "info" && catTree && (
                                    <>
                                        <div>
                                            <label>Sección</label><br />
                                            <select value={sectionKey} onChange={e => { setSectionKey(e.target.value); setCategoryKey(""); setSubcategoryKey(""); }}>
                                                <option value="">— Selecciona —</option>
                                                {catTree.sections.map(s => <option key={s.key} value={s.key}>{s.folder}</option>)}
                                            </select>
                                        </div>
                                        {!!sectionKey && (
                                            <div>
                                                <label>Categoría</label><br />
                                                <select value={categoryKey} onChange={e => { setCategoryKey(e.target.value); setSubcategoryKey(""); }}>
                                                    <option value="">— Selecciona —</option>
                                                    {catTree.sections.find(s => s.key === sectionKey)?.categories.map(c => (
                                                        <option key={c.key} value={c.key}>{c.folder}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {!!categoryKey && !!catTree.sections.find(s => s.key === sectionKey)?.categories.find(c => c.key === categoryKey)?.children?.length && (
                                            <div>
                                                <label>Subcategoría</label><br />
                                                <select value={subcategoryKey} onChange={e => setSubcategoryKey(e.target.value)}>
                                                    <option value="">— (opcional) —</option>
                                                    {catTree.sections.find(s => s.key === sectionKey)?.categories.find(c => c.key === categoryKey)?.children.map(sub => (
                                                        <option key={sub.key} value={sub.key}>{sub.folder}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div>
                                    <label>Archivo</label><br />
                                    <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                                    <small> Permitidos: pdf, docx, xlsx, jpg, png, zip</small>
                                </div>

                                <div>
                                    <button type="button" onClick={doUpload} disabled={busy}>{busy ? "Subiendo..." : "Subir"}</button>
                                    {msg && <div style={{ marginTop: 8 }}><small>{msg}</small></div>}
                                </div>
                            </div>
                        </div>
                    ) : tab === "dashboard" ? (
                        <Dashboard token={token} />
                    ) : tab === "archivos" ? (
                        <div style={{ margin: "12px 0" }}>
                            <FilesExplorer token={token} role={role} />
                        </div>
                    ) : tab === "proyectos" ? (
                        <div style={{ margin: "12px 0" }}>
                            <ProjectAdmin
                                token={token}
                                role={role}
                                onProjectsChanged={async () => {
                                    const projs = await getProjects(token);
                                    setProjects(projs);
                                }}
                            />
                            <div style={{ marginTop: 16 }}>
                                <h4>Proyectos actuales</h4>
                                <ul>
                                    {projects.map(p => (
                                        <li key={p.id}>{p.code} — {p.name} <small>({p.type})</small></li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : tab === "miembros" ? (
                        <div style={{ margin: "12px 0" }}>
                            <MemberAdmin token={token} role={role} />
                        </div>
                    ) : (
                        <div style={{ margin: "12px 0" }}>
                            <RegistrationAdmin token={token} role={role} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
