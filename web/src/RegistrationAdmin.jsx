import React, { useEffect, useState } from "react";
import { listRegistrationRequests, approveRegistration, rejectRegistration } from "./api";

const ROLE_OPTIONS = [
    { value: "colaborador", label: "Colaborador" },
    { value: "admin", label: "Admin" },
];

export default function RegistrationAdmin({ token, role }) {
    const [items, setItems] = useState([]);
    const [tab, setTab] = useState("pending"); // pending | approved | rejected
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [roleToGrant, setRoleToGrant] = useState("colaborador");
    const [rejectNote, setRejectNote] = useState("");

    const isAdmin = role === "admin";

    async function load() {
        try {
            const rows = await listRegistrationRequests(token, tab);
            setItems(rows);
        } catch (e) {
            setMsg(e.message);
        }
    }

    useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [tab, token]);

    async function doApprove(id) {
        setBusy(true); setMsg("");
        try {
            await approveRegistration(token, id, roleToGrant);
            await load();
            setMsg("Solicitud aprobada.");
        } catch (e) {
            setMsg(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function doReject(id) {
        setBusy(true); setMsg("");
        try {
            await rejectRegistration(token, id, rejectNote);
            await load();
            setMsg("Solicitud rechazada.");
            setRejectNote("");
        } catch (e) {
            setMsg(e.message);
        } finally {
            setBusy(false);
        }
    }

    if (!isAdmin) return <p style={{ color: "#a33" }}>Solo administradores gestionan solicitudes.</p>;

    return (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h3>Solicitudes de registro</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={() => setTab("pending")} disabled={tab === "pending"}>Pendientes</button>
                <button onClick={() => setTab("approved")} disabled={tab === "approved"}>Aprobadas</button>
                <button onClick={() => setTab("rejected")} disabled={tab === "rejected"}>Rechazadas</button>
            </div>

            {tab === "pending" && (
                <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                    <label>Rol al aprobar:</label>
                    <select value={roleToGrant} onChange={e => setRoleToGrant(e.target.value)}>
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <label>Motivo rechazo (opcional):</label>
                    <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Motivo (si rechazas)" />
                </div>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                        <th style={{ padding: 6 }}>ID</th>
                        <th style={{ padding: 6 }}>Usuario</th>
                        <th style={{ padding: 6 }}>Estado</th>
                        <th style={{ padding: 6 }}>Creado</th>
                        <th style={{ padding: 6 }}>Decidido</th>
                        <th style={{ padding: 6 }}>Nota</th>
                        {tab === "pending" && <th style={{ padding: 6 }}>Acciones</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr><td colSpan={tab === "pending" ? 7 : 6} style={{ padding: 6, color: "#777" }}><em>Sin items</em></td></tr>
                    ) : items.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: 6 }}>{r.id}</td>
                            <td style={{ padding: 6 }}>{r.username}</td>
                            <td style={{ padding: 6 }}>{r.status}</td>
                            <td style={{ padding: 6 }}>{new Date(r.created_at).toLocaleString()}</td>
                            <td style={{ padding: 6 }}>{r.decided_at ? new Date(r.decided_at).toLocaleString() : "-"}</td>
                            <td style={{ padding: 6 }}>{r.note || "-"}</td>
                            {tab === "pending" && (
                                <td style={{ padding: 6, display: "flex", gap: 8 }}>
                                    <button onClick={() => doApprove(r.id)} disabled={busy}>Aprobar</button>
                                    <button onClick={() => doReject(r.id)} disabled={busy}>Rechazar</button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {msg && <div style={{ marginTop: 8 }}><small>{msg}</small></div>}
        </div>
    );
}
