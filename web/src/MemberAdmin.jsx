import React, { useEffect, useMemo, useState } from "react";
import {
    getProjects, listMembers, searchUsers, addOrUpdateMember, removeMember
} from "./api";

const ROLES = [
    { value: "viewer", label: "Solo lectura" },
    { value: "uploader", label: "Puede subir" },
    { value: "manager", label: "Gestor" },
];

export default function MemberAdmin({ token, role }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [members, setMembers] = useState([]);
    const [query, setQuery] = useState("");
    const [userOptions, setUserOptions] = useState([]);
    const [userId, setUserId] = useState("");
    const [userRole, setUserRole] = useState("uploader");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    const canAdmin = role === "admin";

    useEffect(() => {
        (async () => {
            try {
                const projs = await getProjects(token);
                setProjects(projs);
            } catch (e) {
                setMsg(e.message);
            }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            try {
                const ms = await listMembers(projectId, token);
                setMembers(ms);
            } catch (e) {
                setMsg(e.message);
            }
        })();
    }, [projectId, token]);

    // Búsqueda de usuarios con debounce
    useEffect(() => {
        if (!canAdmin) return;
        const h = setTimeout(async () => {
            try {
                const rows = await searchUsers(query, token);
                setUserOptions(rows);
            } catch (e) {
                // ignorar
            }
        }, 300);
        return () => clearTimeout(h);
    }, [query, token, canAdmin]);

    async function addMember() {
        if (!projectId || !userId) return setMsg("Selecciona proyecto y usuario.");
        setBusy(true); setMsg("");
        try {
            await addOrUpdateMember(projectId, userId, userRole, token);
            const ms = await listMembers(projectId, token);
            setMembers(ms);
            setUserId("");
            setMsg("Miembro agregado/actualizado.");
        } catch (e) {
            setMsg(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function delMember(uid) {
        if (!projectId) return;
        setBusy(true); setMsg("");
        try {
            await removeMember(projectId, uid, token);
            const ms = await listMembers(projectId, token);
            setMembers(ms);
        } catch (e) {
            setMsg(e.message);
        } finally {
            setBusy(false);
        }
    }

    if (!canAdmin) {
        return <p style={{ color: "#a33" }}>Solo administradores gestionan miembros.</p>;
    }

    return (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h3>Miembros del proyecto</h3>

            <div style={{ display: "grid", gap: 8, maxWidth: 900 }}>
                <div>
                    <label>Proyecto</label><br />
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                        <option value="">— Selecciona —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                </div>

                {projectId && (
                    <>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr 1fr auto", alignItems: "center" }}>
                            <div>
                                <label>Buscar usuario</label><br />
                                <input
                                    placeholder="usuario (mín. 1 letra)"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                                <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid #eee", borderRadius: 8, marginTop: 4 }}>
                                    {userOptions.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => { setUserId(u.id); setQuery(u.username); }}
                                            style={{
                                                padding: "6px 8px",
                                                cursor: "pointer",
                                                background: u.id === userId ? "#e6f4ea" : "transparent"
                                            }}
                                        >
                                            {u.username} <small>({u.role})</small>
                                        </div>
                                    ))}
                                    {!userOptions.length && <div style={{ padding: 8, color: "#777" }}><em>Sin resultados</em></div>}
                                </div>
                            </div>

                            <div>
                                <label>Rol</label><br />
                                <select value={userRole} onChange={e => setUserRole(e.target.value)}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label>Usuario seleccionado</label><br />
                                <input value={userId ? `${userId}` : ""} onChange={() => { }} readOnly />
                            </div>

                            <div>
                                <button type="button" onClick={addMember} disabled={busy || !userId}>
                                    {busy ? "Guardando..." : "Agregar / Actualizar"}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <h4>Miembros actuales</h4>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                        <th style={{ padding: 6 }}>Usuario</th>
                                        <th style={{ padding: 6 }}>Rol</th>
                                        <th style={{ padding: 6 }}>Desde</th>
                                        <th style={{ padding: 6 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.length === 0 ? (
                                        <tr><td colSpan="4" style={{ padding: 6, color: "#777" }}><em>Sin miembros</em></td></tr>
                                    ) : members.map(m => (
                                        <tr key={m.user_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: 6 }}>{m.username}</td>
                                            <td style={{ padding: 6 }}>{m.role}</td>
                                            <td style={{ padding: 6 }}>{new Date(m.since).toLocaleString()}</td>
                                            <td style={{ padding: 6 }}>
                                                <button onClick={() => delMember(m.user_id)} disabled={busy}>Quitar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {msg && <div><small style={{ color: msg.includes("Error") ? "#d33" : "#333" }}>{msg}</small></div>}
            </div>
        </div>
    );
}
