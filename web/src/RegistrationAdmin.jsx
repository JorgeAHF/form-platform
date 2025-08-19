import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function RegistrationAdmin({ token }) {
    const [rows, setRows] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [defaultRole, setDefaultRole] = useState("colaborador");
    const [reason, setReason] = useState("");

    async function load() {
        try {
            const r = await fetch(`${API}/admin/registrations?status_filter=pending`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "Error cargando solicitudes");
            setRows(j || []);
        } catch (e) {
            toast.error(e.message);
        }
    }

    useEffect(() => { load(); }, []); // eslint-disable-line

    async function approve(id) {
        setBusyId(id);
        try {
            const fd = new FormData();
            fd.append("role", defaultRole);
            const r = await fetch(`${API}/admin/registrations/${id}/approve`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "No se pudo aprobar");
            toast.success("Solicitud aprobada");
            await load();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusyId(null);
        }
    }

    async function reject(id) {
        setBusyId(id);
        try {
            const fd = new FormData();
            if (reason) fd.append("note", reason);
            const r = await fetch(`${API}/admin/registrations/${id}/reject`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j.detail || "No se pudo rechazar");
            }
            toast.success("Solicitud rechazada");
            setReason("");
            await load();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium">Rol por defecto al aprobar</label>
                    <select
                        value={defaultRole}
                        onChange={(e) => setDefaultRole(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="colaborador">colaborador</option>
                        <option value="admin">admin</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-sm font-medium">Motivo de rechazo (opcional)</label>
                    <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej. Usuario duplicado / datos incompletos"
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
                </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-100">
                        <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                            <th>Fecha</th>
                            <th>Usuario</th>
                            <th>Estado</th>
                            <th>Nota</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                        {(!rows || rows.length === 0) ? (
                            <tr>
                                <td colSpan="5" className="px-3 py-6 text-center text-slate-500">Sin solicitudes</td>
                            </tr>
                        ) : rows.map((r) => (
                            <tr key={r.id}>
                                <td>{new Date(r.created_at).toLocaleString()}</td>
                                <td>{r.username}</td>
                                <td>{r.status}</td>
                                <td className="truncate">{r.note || "-"}</td>
                                <td className="text-right space-x-2">
                                    <button
                                        onClick={() => approve(r.id)}
                                        disabled={busyId === r.id}
                                        className="rounded-md bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => reject(r.id)}
                                        disabled={busyId === r.id}
                                        className="rounded-md border px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                    >
                                        Rechazar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-500">
                * El registro por parte del usuario final lo veremos en una pantalla pública más adelante
                (por ahora tú puedes cargar solicitudes manualmente vía API si lo necesitas).
            </p>
        </div>
    );
}
