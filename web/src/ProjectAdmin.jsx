import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { API, getProjects, listUsers, listProjectMembers, addProjectMember, deleteProjectMember } from "./api";

export default function ProjectAdmin({ token, role, canCreate, initials }) {
    const [type, setType] = useState("externo"); // externo | interno
    const [code, setCode] = useState(""); // 4 dígitos
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);

    const [showMembers, setShowMembers] = useState(false);
    const [currentProj, setCurrentProj] = useState(null);
    const [users, setUsers] = useState([]);
    const [members, setMembers] = useState([]);
    const [memberUserId, setMemberUserId] = useState("");
    const [memberRole, setMemberRole] = useState("uploader");
    const [memberBusy, setMemberBusy] = useState(false);

    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);

    function suggestPrefix(t) {
        return t === "externo" ? "EE" : "EI";
    }

    function onTypeChange(v) {
        setType(v);
    }

    useEffect(() => { refreshProjects(); }, []);

    async function refreshProjects() {
        setLoadingProjects(true);
        try {
            const list = await getProjects(token);
            setProjects(list);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoadingProjects(false);
        }
    }

    async function createProject() {
        if (!code.trim() || !name.trim()) {
            toast.error("Completa código y nombre");
            return;
        }
        if (!/^\d{4}$/.test(code.trim())) {
            toast.error("Clave inválida (debe tener 4 dígitos)");
            return;
        }
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("code", code.trim());
            fd.append("name", name.trim());
            // si tu backend guarda type, envíalo; si no, lo ignorará
            fd.append("type", type);

            const r = await fetch(`${API}/projects`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "No se pudo crear");

            toast.success(`Proyecto ${j.code} creado`);
            setCode(""); setName("");
            await refreshProjects();
            if (window.confirm("¿Agregar miembros a este proyecto?")) {
                await openMemberManager(j);
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function openMemberManager(proj) {
        setCurrentProj(proj);
        setShowMembers(true);
        setMemberUserId("");
        setMemberRole("uploader");
        try {
            const us = await listUsers(token);
            setUsers(us);
            const ms = await listProjectMembers(proj.id, token);
            setMembers(ms);
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleAddMember() {
        if (!memberUserId) {
            toast.error("Selecciona usuario");
            return;
        }
        setMemberBusy(true);
        try {
            await addProjectMember(currentProj.id, memberUserId, memberRole, token);
            const ms = await listProjectMembers(currentProj.id, token);
            setMembers(ms);
            setMemberUserId("");
            toast.success("Miembro agregado");
        } catch (e) {
            toast.error(e.message);
        } finally {
            setMemberBusy(false);
        }
    }

    async function updateMemberRole(uid, role) {
        try {
            await addProjectMember(currentProj.id, uid, role, token);
            const ms = await listProjectMembers(currentProj.id, token);
            setMembers(ms);
            toast.success("Rol actualizado");
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function removeMember(uid) {
        if (!window.confirm("¿Eliminar este miembro del proyecto?")) return;
        try {
            await deleteProjectMember(currentProj.id, uid, token);
            const ms = await listProjectMembers(currentProj.id, token);
            setMembers(ms);
        } catch (e) {
            toast.error(e.message);
        }
    }

    function closeMembers() {
        setShowMembers(false);
        setCurrentProj(null);
        setMembers([]);
        refreshProjects();
    }

    const owned = projects.filter(p => p.is_owner);
    const member = role === "auditor" ? projects : projects.filter(p => !p.is_owner);

    function roleLabel(r) {
        switch (r) {
            case "viewer": return "Visor";
            case "uploader": return "Colaborador";
            case "manager": return "Gestor";
            case "owner": return "Dueño";
            default: return r;
        }
    }

    return (
        <div className="space-y-6">
            {(role === "admin" || canCreate) && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                value={type}
                                onChange={(e) => onTypeChange(e.target.value)}
                                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="externo">Externo (EE#### SIGLAS)</option>
                                <option value="interno">Interno (EI#### SIGLAS)</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                Prefijo sugerido: <b>{suggestPrefix(type)}</b>
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Clave</label>
                            <input
                                value={code}
                                maxLength={4}
                                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                                placeholder="####"
                                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            />
                            <p className="text-xs text-slate-500 mt-1">Código final: <b>{`${suggestPrefix(type)}${code}${initials ? ` ${initials}` : ""}`}</b></p>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Nombre</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nombre descriptivo"
                                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            onClick={createProject}
                            disabled={busy}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {busy ? "Creando..." : "Crear proyecto"}
                        </button>
                    </div>

                </>
            )}

            <div className="space-y-4">
                {loadingProjects ? (
                    <p className="text-sm text-slate-500">Cargando proyectos...</p>
                ) : (
                    <>
                        {owned.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">Mis proyectos</h3>
                                <div className="rounded-xl border overflow-hidden">
                                    <table className="w-full border-collapse text-sm">
                                        <thead className="bg-slate-100">
                                            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                                                <th>Código</th>
                                                <th>Nombre</th>
                                                <th>Rol</th>
                                                <th className="text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                                            {owned.map(p => (
                                                <tr key={p.id}>
                                                    <td>{p.code}</td>
                                                    <td>{p.name}</td>
                                                    <td>{roleLabel("owner")}</td>
                                                    <td className="text-right">
                                                        <button onClick={() => openMemberManager(p)} className="rounded-md border px-3 py-1.5 text-slate-700 hover:bg-slate-100">Miembros</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {member.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">{role === "auditor" ? "Todos los proyectos" : "Proyectos como miembro"}</h3>
                                <div className="rounded-xl border overflow-hidden">
                                    <table className="w-full border-collapse text-sm">
                                        <thead className="bg-slate-100">
                                            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                                                <th>Código</th>
                                                <th>Nombre</th>
                                                {role !== "auditor" && <th>Mi rol</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                                            {member.map(p => (
                                                <tr key={p.id}>
                                                    <td>{p.code}</td>
                                                    <td>{p.name}</td>
                                                    {role !== "auditor" && <td>{roleLabel(p.role)}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {owned.length === 0 && member.length === 0 && (
                            <p className="text-sm text-slate-500">Sin proyectos asignados</p>
                        )}
                    </>
                )}
            </div>

            {showMembers && currentProj && (
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Miembros de {currentProj.code}</h3>
                        <button onClick={closeMembers} className="text-sm text-slate-600 hover:underline">Cerrar</button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-medium">Usuario</label>
                            <select
                                value={memberUserId}
                                onChange={(e) => setMemberUserId(e.target.value)}
                                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="">— Selecciona —</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.username}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Permiso</label>
                            <select
                                value={memberRole}
                                onChange={(e) => setMemberRole(e.target.value)}
                                className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                            >
                                <option value="uploader">Colaborador (sube/gestiona)</option>
                                <option value="viewer">Visor (solo consulta)</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={handleAddMember}
                                disabled={memberBusy}
                                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {memberBusy ? "Agregando..." : "Agregar"}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-slate-100">
                                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                                    <th>Usuario</th>
                                    <th>Permiso</th>
                                    <th className="text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-3 py-6 text-center text-slate-500">
                                            Sin miembros
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((m) => (
                                        <tr key={m.user_id}>
                                            <td>{m.username}</td>
                                            <td>
                                                <select
                                                    value={m.role}
                                                    onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                                                    className="rounded-lg border px-2 py-1"
                                                >
                                                    <option value="uploader">Colaborador</option>
                                                    <option value="viewer">Visor</option>
                                                </select>
                                            </td>
                                            <td className="text-right">
                                                <button
                                                    onClick={() => removeMember(m.user_id)}
                                                    className="rounded-md border px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
