import React, { useState } from "react";
import { createProject } from "./api";

const RX_EXT = /^EE\d{4}\s+[A-Z0-9]{3,}$/;
const RX_INT = /^EI\d{4}\s+[A-Z0-9]{3,}$/;

export default function ProjectAdmin({ token, onProjectsChanged, role }) {
    const [type, setType] = useState("externo");
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [msg, setMsg] = useState("");
    const [creating, setCreating] = useState(false);

    const validCode = () => {
        if (type === "externo") return RX_EXT.test(code.trim());
        return RX_INT.test(code.trim());
    };

    async function handleCreateProject() {
        setMsg("");
        if (!validCode()) {
            return setMsg(
                `Código inválido para tipo ${type === "externo" ? "externo (EE#### SIGLAS)" : "interno (EI#### SIGLAS)"}`
            );
        }
        if (!name.trim()) return setMsg("Pon un nombre de proyecto.");
        setCreating(true);
        try {
            const p = await createProject({ code: code.trim(), name: name.trim(), type }, token);
            setMsg(`Proyecto creado: ${p.code}`);
            setCode(""); setName("");
            onProjectsChanged?.();
        } catch (e) {
            setMsg(e.message);
        } finally {
            setCreating(false);
        }
    }

    if (role !== "admin") {
        return <p style={{ color: "#a33" }}>Solo administradores pueden crear proyectos.</p>;
    }

    return (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <h3>Crear proyecto</h3>
            <div style={{ display: "grid", gap: 8, maxWidth: 700 }}>
                <div>
                    <label>Tipo</label><br />
                    <select value={type} onChange={e => setType(e.target.value)}>
                        <option value="externo">Externo (EE#### SIGLAS)</option>
                        <option value="interno">Interno (EI#### SIGLAS)</option>
                    </select>
                </div>
                <div>
                    <label>Código</label><br />
                    <input
                        placeholder={type === "externo" ? "EE2225 JAHF" : "EI0525 JAHF"}
                        value={code} onChange={e => setCode(e.target.value)}
                        style={{ borderColor: code ? (validCode() ? "#3a3" : "#d33") : "#ccc" }}
                    />
                    <small style={{ marginLeft: 8 }}>
                        {type === "externo" ? "EE#### SIGLAS" : "EI#### SIGLAS"}
                    </small>
                </div>
                <div>
                    <label>Nombre</label><br />
                    <input placeholder="Nombre del proyecto" value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div>
                    <button type="button" onClick={handleCreateProject} disabled={creating}>
                        {creating ? "Creando..." : "Crear proyecto"}
                    </button>
                </div>

                {msg && <div><small style={{ color: msg.includes("Error") ? "#d33" : "#333" }}>{msg}</small></div>}
            </div>
        </div>
    );
}
