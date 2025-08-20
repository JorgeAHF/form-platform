import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listDeleteRequests, approveDeleteRequest } from "./api";

export default function DeleteRequestsAdmin({ token }) {
    const [items, setItems] = useState([]);

    async function load() {
        try {
            const rows = await listDeleteRequests(token);
            setItems(rows);
        } catch (err) {
            toast.error(err.message || "Error");
        }
    }

    useEffect(() => {
        load();
    }, [token]);

    async function approve(id) {
        if (!window.confirm("¿Aprobar eliminación?")) return;
        try {
            await approveDeleteRequest(id, token);
            toast.success("Eliminado");
            await load();
        } catch (err) {
            toast.error(err.message || "Error");
        }
    }

    return (
        <div className="mt-8">
            <h3 className="text-base font-semibold mb-4">Solicitudes de eliminación de archivos</h3>
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b text-left">
                        <th className="py-2 pr-3">Archivo</th>
                        <th className="py-2 pr-3">Motivo</th>
                        <th className="py-2 pr-3">Solicitante</th>
                        <th className="py-2 pr-3">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((r) => (
                        <tr key={r.id} className="border-b">
                            <td className="py-2 pr-3">{r.file?.filename || "(archivo perdido)"}</td>
                            <td className="py-2 pr-3">{r.reason}</td>
                            <td className="py-2 pr-3">{r.requested_by}</td>
                            <td className="py-2 pr-3">
                                <button
                                    type="button"
                                    onClick={() => approve(r.id)}
                                    className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                                >
                                    Aprobar
                                </button>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td className="py-4 text-center text-slate-500" colSpan={4}>
                                No hay solicitudes pendientes.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
