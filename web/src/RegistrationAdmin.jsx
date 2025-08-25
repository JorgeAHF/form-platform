import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listUsers, createUser, updateUser, deleteUser } from "./api";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function RegistrationAdmin({ token }) {
    const [rows, setRows] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [defaultRole, setDefaultRole] = useState("colaborador");
    const [grantCreate, setGrantCreate] = useState(false);
    const [grantExpTec, setGrantExpTec] = useState(true);
    const [reason, setReason] = useState("");

    const [users, setUsers] = useState([]);
    const [userBusy, setUserBusy] = useState(null);
    const [editId, setEditId] = useState(null);
    const [newUser, setNewUser] = useState({ username: "", password: "", full_name: "", email: "", initials: "", role: "colaborador", can_create: false, can_exptec: true });

    async function loadRegs() {
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

    async function loadUsers() {
        try {
            const list = await listUsers(token);
            setUsers(list);
        } catch (e) {
            toast.error(e.message);
        }
    }

    useEffect(() => { loadRegs(); loadUsers(); }, []); // eslint-disable-line

    async function approve(id) {
        setBusyId(id);
        try {
            const fd = new FormData();
            fd.append("role", defaultRole);
            fd.append("can_create", grantCreate ? "true" : "false");
            fd.append("can_exptec", grantExpTec ? "true" : "false");
            const r = await fetch(`${API}/admin/registrations/${id}/approve`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.detail || "No se pudo aprobar");
            toast.success("Solicitud aprobada");
            await loadRegs();
            await loadUsers();
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
            await loadRegs();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusyId(null);
        }
    }

    async function handleCreateUser(e) {
        e.preventDefault();
        try {
            await createUser({ username: newUser.username, password: newUser.password, full_name: newUser.full_name, email: newUser.email, initials: newUser.initials, role: newUser.role, can_create: newUser.can_create, can_exptec: newUser.can_exptec }, token);
            toast.success("Usuario creado");
            setNewUser({ username: "", password: "", full_name: "", email: "", initials: "", role: "colaborador", can_create: false, can_exptec: true });
            await loadUsers();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleUpdateUser(u) {
        setUserBusy(u.id);
        try {
            const payload = {
                username: u.username,
                full_name: u.full_name,
                email: u.email,
                initials: u.initials,
                role: u.role,
                can_create: u.can_create_projects,
                can_exptec: u.can_access_exptec,
            };
            if (u.new_password) payload.password = u.new_password;
            await updateUser(u.id, payload, token);
            toast.success("Actualizado");
            await loadUsers();
            setEditId(null);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setUserBusy(null);
        }
    }

    async function handleDeleteUser(id) {
        if (!window.confirm("¿Eliminar usuario?")) return;
        setUserBusy(id);
        try {
            await deleteUser(id, token);
            toast.success("Eliminado");
            await loadUsers();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setUserBusy(null);
        }
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-5">
                <div>
                    <label className="text-sm font-medium">Rol por defecto al aprobar</label>
                    <select
                        value={defaultRole}
                        onChange={(e) => setDefaultRole(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="colaborador">colaborador</option>
                        <option value="auditor">auditor</option>
                        <option value="admin">admin</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={grantCreate} onChange={e => setGrantCreate(e.target.checked)} />
                        Permitir crear proyectos
                    </label>
                </div>
                <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={grantExpTec} onChange={e => setGrantExpTec(e.target.checked)} />
                        Acceso Exp. Tec.
                    </label>
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
                            <th>Nombre</th>
                            <th>Correo</th>
                            <th>Iniciales</th>
                            <th>Solicita crear</th>
                            <th>Estado</th>
                            <th>Nota</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                        {(!rows || rows.length === 0) ? (
                            <tr>
                                <td colSpan="9" className="px-3 py-6 text-center text-slate-500">Sin solicitudes</td>
                            </tr>
                        ) : rows.map((r) => (
                            <tr key={r.id}>
                                <td>{new Date(r.created_at).toLocaleString()}</td>
                                <td>{r.username}</td>
                                <td>{r.full_name}</td>
                                <td>{r.email}</td>
                                <td>{r.initials}</td>
                                <td>{r.want_create ? "sí" : "no"}</td>
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
            <div className="pt-8">
                <h3 className="text-sm font-medium mb-2">Gestionar usuarios</h3>
                <form onSubmit={handleCreateUser} className="flex flex-wrap gap-2 mb-4 items-end">
                    <input value={newUser.username} onChange={e=>setNewUser({...newUser, username:e.target.value})} placeholder="Usuario" className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                    <input type="password" value={newUser.password} onChange={e=>setNewUser({...newUser, password:e.target.value})} placeholder="Contraseña" className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                    <input value={newUser.full_name} onChange={e=>setNewUser({...newUser, full_name:e.target.value})} placeholder="Nombre completo" className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                    <input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email:e.target.value})} placeholder="Correo" className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                    <input value={newUser.initials} onChange={e=>setNewUser({...newUser, initials:e.target.value.toUpperCase()})} placeholder="Iniciales" className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" />
                    <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="rounded-lg border px-3 py-2">
                        <option value="colaborador">colaborador</option>
                        <option value="auditor">auditor</option>
                        <option value="admin">admin</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={newUser.can_create} onChange={e=>setNewUser({...newUser, can_create:e.target.checked})} />
                        Crear proyectos
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={newUser.can_exptec} onChange={e=>setNewUser({...newUser, can_exptec:e.target.checked})} />
                        Acceso Exp. Tec.
                    </label>
                    <button className="rounded-lg bg-slate-900 text-white px-3 py-2 hover:bg-slate-800">Agregar</button>
                </form>

                <div className="rounded-xl border overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-slate-100">
                            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                                <th>Usuario</th>
                                <th>Nombre</th>
                                <th>Correo</th>
                                <th>Iniciales</th>
                                <th>Rol</th>
                                <th>Puede crear</th>
                                <th>Exp. Tec.</th>
                                <th>Contraseña</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="[&>tr]:border-t [&>td]:px-3 [&>td]:py-2">
                            {users.map(u => (
                                <tr key={u.id}>
                                    {editId === u.id ? (
                                        <>
                                            <td><input value={u.username} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, username:e.target.value}:x))} className="border rounded px-2 py-1 w-32" /></td>
                                            <td><input value={u.full_name} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, full_name:e.target.value}:x))} className="border rounded px-2 py-1 w-40" /></td>
                                            <td><input value={u.email} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, email:e.target.value}:x))} className="border rounded px-2 py-1 w-48" /></td>
                                            <td><input value={u.initials} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, initials:e.target.value.toUpperCase()}:x))} className="border rounded px-2 py-1 w-20" /></td>
                                            <td>
                                                <select value={u.role} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, role:e.target.value}:x))} className="border rounded px-2 py-1 w-32">
                                                    <option value="colaborador">colaborador</option>
                                                    <option value="auditor">auditor</option>
                                                    <option value="admin">admin</option>
                                                </select>
                                            </td>
                                            <td><input type="checkbox" checked={u.can_create_projects} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, can_create_projects:e.target.checked}:x))} /></td>
                                            <td><input type="checkbox" checked={u.can_access_exptec} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, can_access_exptec:e.target.checked}:x))} /></td>
                                            <td><input type="password" value={u.new_password || ""} onChange={e=>setUsers(us=>us.map(x=>x.id===u.id?{...x, new_password:e.target.value}:x))} placeholder="Nueva" className="border rounded px-2 py-1 w-32" /></td>
                                            <td className="text-right space-x-2">
                                                <button onClick={()=>handleUpdateUser(u)} disabled={userBusy===u.id} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-100">Guardar</button>
                                                <button onClick={()=>{setEditId(null); loadUsers();}} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-100">Cancelar</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{u.username}</td>
                                            <td>{u.full_name}</td>
                                            <td>{u.email}</td>
                                            <td>{u.initials}</td>
                                            <td>{u.role}</td>
                                            <td>{u.can_create_projects ? "sí" : "no"}</td>
                                            <td>{u.can_access_exptec ? "sí" : "no"}</td>
                                            <td>-</td>
                                            <td className="text-right space-x-2">
                                                <button onClick={()=>setEditId(u.id)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-100">Editar</button>
                                                <button onClick={()=>handleDeleteUser(u.id)} disabled={userBusy===u.id} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-100">Eliminar</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-xs text-slate-500">
                * El registro por parte del usuario final lo veremos en una pantalla pública más adelante
                (por ahora tú puedes cargar solicitudes manualmente vía API si lo necesitas).
            </p>
        </div>
    );
}
