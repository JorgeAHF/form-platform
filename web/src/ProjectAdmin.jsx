import React, { useState } from "react";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function ProjectAdmin({ token, initials = "", onProjectsChanged }) {
    const [type, setType] = useState("externo"); // externo | interno
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);

    function suggestPrefix(t) {
        return t === "externo" ? "EE" : "EI";
    }

    function onTypeChange(v) {
        setType(v);
        // ayuda rápida para el formato del código
        if (!code) setCode(`${suggestPrefix(v)}#### ${initials || "SIGLAS"}`);
    }

    async function createProject() {
        if (!code.trim() || !name.trim()) {
            toast.error("Completa código y nombre");
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
            onProjectsChanged?.();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <select
                        value={type}
                        onChange={(e) => onTypeChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <option value="externo">Externo (EE#### {initials || "SIGLAS"})</option>
                        <option value="interno">Interno (EI#### {initials || "SIGLAS"})</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                        Prefijo sugerido: <b>{suggestPrefix(type)}</b>
                    </p>
                </div>

                <div>
                    <label className="text-sm font-medium">Código</label>
                    <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder={`${suggestPrefix(type)}#### ${initials || "SIGLAS"}`}
                        className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
                    />
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

            <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium mb-1">Formato recomendado</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Externos: <b>EE#### {initials || "SIGLAS"}</b> (ej. EE2225 JAHF)</li>
                    <li>Internos: <b>EI#### {initials || "SIGLAS"}</b> (ej. EI0525 JAHF)</li>
                </ul>
            </div>
        </div>
    );
}
