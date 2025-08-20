import { useState, useEffect } from "react";
import { login, requestRegister } from "./api";
import ProjectAdmin from "./ProjectAdmin";
import RegistrationAdmin from "./RegistrationAdmin";
import DeleteRequestsAdmin from "./DeleteRequestsAdmin";
import toast from "react-hot-toast";
import { LogOut, Upload, Settings2, ClipboardList } from "lucide-react";
import ExpedienteTab from "./components/ExpedienteTab";
import ExpTecTab from "./components/ExpTecTab";

export default function App() {
    const [token, setToken] = useState(localStorage.getItem("apiToken") || "");
    const [role, setRole] = useState("");
    const [canCreate, setCanCreate] = useState(false);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [reqMsg, setReqMsg] = useState("");
    const [wantCreate, setWantCreate] = useState(false);
    const [regFullName, setRegFullName] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regInitials, setRegInitials] = useState("");
    const [myInitials, setMyInitials] = useState("");

    const [tab, setTab] = useState("proyectos"); // expediente | expTec | proyectos | solicitudes

    useEffect(() => { if (token) localStorage.setItem("apiToken", token); }, [token]);

    async function doLogin(e) {
        e?.preventDefault();
        try {
            const j = await login(username, password);
            setToken(j.access_token);
            setRole(j.role);
            setCanCreate(j.can_create_projects);
            setMyInitials(j.initials || "");
            setTab("proyectos");
            toast.success("Sesión iniciada");
        } catch (err) {
            toast.error(err.message || "Login inválido");
        }
    }

    async function doRequestRegister(e) {
        e?.preventDefault();
        try {
            const j = await requestRegister(username, password, wantCreate, regFullName, regEmail, regInitials);
            setReqMsg(j.message || "Solicitud enviada. Espera aprobación");
            setUsername("");
            setPassword("");
            setWantCreate(false);
            setRegFullName("");
            setRegEmail("");
            setRegInitials("");
        } catch (err) {
            toast.error(err.message || "Error en solicitud");
        }
    }

    function logout() {
        setToken("");
        setRole("");
        setCanCreate(false);
        setMyInitials("");
        localStorage.removeItem("apiToken");
    }

    const NavBtn = ({ active, onClick, icon: Icon, children }) => (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 border transition ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"}`}
        >
            {Icon && <Icon size={16} />} {children}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="border-b bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 px-3 rounded-lg bg-slate-900 text-white grid place-content-center font-bold">PRAP</div>
                        <h1 className="text-lg font-semibold tracking-tight">Plataforma de Respaldos para Archivos de Proyectos</h1>
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
                            {!showRequestForm ? (
                                <>
                                    <h2 className="text-base font-semibold mb-4">Iniciar sesión</h2>
                                    <form className="grid gap-3" onSubmit={doLogin}>
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} />
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                                        <button className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800">Entrar</button>
                                    </form>
                                    <div className="mt-4 text-sm text-slate-600">
                                        <button type="button" onClick={() => setShowRequestForm(true)} className="text-slate-900 underline-offset-2 hover:underline">Solicitar acceso</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-base font-semibold mb-4">Solicitar acceso</h2>
                                    {reqMsg && <div className="mb-3 text-sm text-emerald-600">{reqMsg}</div>}
                                    <form className="grid gap-3" onSubmit={doRequestRegister}>
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} />
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Nombre completo" value={regFullName} onChange={e => setRegFullName(e.target.value)} />
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Correo" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                                        <input className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300" placeholder="Iniciales" value={regInitials} onChange={e => setRegInitials(e.target.value.toUpperCase())} />
                                        <label className="inline-flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={wantCreate} onChange={e => setWantCreate(e.target.checked)} />
                                            Solicitar permiso para crear proyectos
                                        </label>
                                        <button className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800">Enviar solicitud</button>
                                    </form>
                                    <div className="mt-4 text-sm text-slate-600">
                                        <button type="button" onClick={() => setShowRequestForm(false)} className="text-slate-900 underline-offset-2 hover:underline">Volver al login</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <NavBtn active={tab === "expediente"} onClick={() => setTab("expediente")}>Expediente IMT</NavBtn>
                            <NavBtn active={tab === "expTec"} onClick={() => setTab("expTec")} icon={Upload}>Expediente Técnico</NavBtn>
                            <NavBtn active={tab === "proyectos"} onClick={() => setTab("proyectos")} icon={Settings2}>Proyectos</NavBtn>
                            {role === "admin" && (
                                <NavBtn active={tab === "solicitudes"} onClick={() => setTab("solicitudes")} icon={ClipboardList}>Solicitudes</NavBtn>
                            )}
                        </div>

                        {tab === "expTec" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <ExpTecTab token={token} />
                            </div>
                        ) : tab === "expediente" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <ExpedienteTab token={token} />
                            </div>
                        ) : tab === "proyectos" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <ProjectAdmin token={token} role={role} canCreate={canCreate} initials={myInitials} />
                            </div>
                        ) : tab === "solicitudes" ? (
                            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                                <RegistrationAdmin token={token} />
                                <DeleteRequestsAdmin token={token} />
                            </div>
                        ) : null}
                    </>
                )}
            </main>
        </div>
    );
}
