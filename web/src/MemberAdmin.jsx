import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { API } from "./api";

export default function MemberAdmin({ token }) {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState("");
    const [rows, setRows] = useState([]);
    const [username, setUsername] = useState("");
    const [role, setRole] = useState("viewer");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`${API}/projects`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const j = await r.json();
                if (r.ok) setProjects(j);
            } catch { }
        })();
    }, [token]);

    useEffect(() => {
        if (!projectId) return;
        loadMembers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    async function loadMembers() {
        try {
            const r = await fetch(`${API}/projects/${projectId}/members`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "Error cargando miembros");
            setRows(j);
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function addMember() {
        if (!projectId || !username.trim()) {
            toast.error("Selecciona proyecto y escribe el usuario");
            return;
        }
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("username", username.trim());
            fd.append("role", role);

            const r = await fetch(`${API}/projects/${projectId}/members`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "No se pudo agregar");
            toast.success("Miembro agregado");
            setUsername("");
            await loadMembers();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function updateRole(userId, newRole) {
        try {
            const fd = new FormData();
            fd.append("role", newRole);
            const r = await fetch(`${API}/projects/${projectId}/members/${userId}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "No se pudo actualizar el rol");
            toast.success("Rol actualizado");
            await loadMembers();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function removeMember(userId) {
        if (!window.confirm("¿Eliminar este miembro del proyecto?")) return;
        try {
            const r = await fetch(`${API}/projects/${projectId}/members/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.detail || "No se pudo eliminar");
            }
            toast.success("Miembro eliminado");
            await loadMembers();
        } catch (e) {
            toast.error(e.message);
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium">Proyecto</label>
                    <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="">— Selecciona —</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.code} — {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-sm font-medium">Usuario</label>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-sm font-medium">Rol</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            <option value="viewer">viewer (consulta)</option>
                            <option value="manager">manager (gestión)</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={addMember}
                            disabled={!projectId || busy}
                            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {busy ? "Agregando..." : "Agregar"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-100">
                        <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                        {(!rows || rows.length === 0) ? (
                            <tr>
                                <td colSpan="3" className="px-3 py-6 text-center text-slate-500">
                                    Sin miembros
                                </td>
                            </tr>
                        ) : rows.map((m) => (
                            <tr key={m.user_id}>
                                <td>{m.username}</td>
                                <td>
                                    <select
                                        value={m.role}
                                        onChange={(e) => updateRole(m.user_id, e.target.value)}
                                        className="rounded-lg border px-2 py-1"
                                    >
                                        <option value="viewer">viewer</option>
                                        <option value="manager">manager</option>
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
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
