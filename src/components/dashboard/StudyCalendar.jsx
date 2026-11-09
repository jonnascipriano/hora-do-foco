import { useEffect, useMemo, useState } from "react";
import {
    deleteCalendarAttachment,
    getCalendarAttachmentBlob,
    getCalendarEntry,
    saveCalendarEntry,
    uploadCalendarAttachment,
} from "../../services/calendarApi";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function sameMonth(left, right) {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export default function StudyCalendar() {
    const today = useMemo(() => new Date(), []);
    const todayKey = dateKey(today);
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(today);
    const [notes, setNotes] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [loadedKey, setLoadedKey] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const selectedKey = dateKey(selectedDate);

    useEffect(() => {
        let isActive = true;
        getCalendarEntry(selectedKey)
            .then((entry) => {
                if (!isActive) return;
                setNotes(entry.notes || "");
                setAttachments(entry.attachments || []);
                setError("");
                setLoadedKey(selectedKey);
            })
            .catch((loadError) => {
                if (!isActive) return;
                setNotes("");
                setAttachments([]);
                setError(loadError.message || "Não foi possível carregar este dia.");
                setLoadedKey(selectedKey);
            });
        return () => { isActive = false; };
    }, [selectedKey]);

    const calendarDays = useMemo(() => {
        const firstWeekday = (month.getDay() + 6) % 7;
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        return [
            ...Array.from({ length: firstWeekday }, () => null),
            ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
        ];
    }, [month]);

    function moveMonth(amount) {
        setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
    }

    function selectDate(date) {
        if (isSaving || dateKey(date) > todayKey) return;
        setNotice("");
        setSelectedDate(date);
    }

    async function handleSaveNotes(event) {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        setNotice("");
        try {
            await saveCalendarEntry(selectedKey, notes);
            setNotice("Anotações salvas.");
        } catch (saveError) {
            setError(saveError.message || "Não foi possível salvar as anotações.");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleUpload(event) {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length) return;
        const oversizedFile = files.find((file) => file.size >= MAX_FILE_SIZE);
        if (oversizedFile) {
            setError(`O arquivo "${oversizedFile.name}" excede o limite de 15 MB.`);
            return;
        }

        setIsSaving(true);
        setUploadProgress({ fileName: files[0].name, percent: 0 });
        setError("");
        setNotice("");
        try {
            const uploaded = [];
            for (const file of files) {
                setUploadProgress({ fileName: file.name, percent: 0 });
                const attachment = await uploadCalendarAttachment(
                    selectedKey,
                    file,
                    (progress) => setUploadProgress({ fileName: file.name, percent: Math.round(progress * 100) }),
                );
                uploaded.push(attachment);
                setAttachments((currentAttachments) => [...currentAttachments, attachment]);
            }
            setUploadProgress({ fileName: null, percent: 100 });
            await saveCalendarEntry(selectedKey, notes);
            setNotice(`${uploaded.length === 1 ? "Arquivo adicionado" : "Arquivos adicionados"} ao diário.`);
        } catch (uploadError) {
            setError(uploadError.message || "Não foi possível enviar o arquivo.");
        } finally {
            setUploadProgress(null);
            setIsSaving(false);
        }
    }

    async function handleDeleteAttachment(attachment) {
        setIsSaving(true);
        setError("");
        setNotice("");
        try {
            await deleteCalendarAttachment(attachment.id);
            setAttachments((currentAttachments) => currentAttachments.filter((item) => item.id !== attachment.id));
            setNotice("Arquivo removido.");
        } catch (deleteError) {
            setError(deleteError.message || "Não foi possível remover este arquivo.");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDownloadAttachment(attachment) {
        setError("");
        try {
            const blob = await getCalendarAttachmentBlob(attachment.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.name;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (downloadError) {
            setError(downloadError.message || "Não foi possível baixar o arquivo.");
        }
    }

    const isCurrentMonth = sameMonth(month, today);
    const isLoading = loadedKey !== selectedKey;

    return (
        <div className="mx-auto max-w-6xl">
            <p className="text-sm font-bold text-(--purple)">Seu diário</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Calendário de estudos</h1>
            <p className="mt-2 text-sm text-(--muted)">Escolha um dia até hoje para guardar anotações e arquivos da sua preparação.</p>

            <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className="rounded-2xl border border-(--line) bg-white p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => moveMonth(-1)}
                            aria-label="Mês anterior"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-(--line) text-lg hover:bg-(--bg)"
                        >
                            ‹
                        </button>
                        <h2 className="text-lg font-extrabold capitalize">
                            {month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </h2>
                        <button
                            type="button"
                            onClick={() => moveMonth(1)}
                            disabled={isCurrentMonth}
                            aria-label="Próximo mês"
                            className="grid h-10 w-10 place-items-center rounded-xl border border-(--line) text-lg hover:bg-(--bg) disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            ›
                        </button>
                    </div>
                    <div className="mt-5 grid grid-cols-7 gap-1 text-center">
                        {weekdays.map((day) => (
                            <span key={day} className="py-2 text-xs font-bold text-(--muted)">{day}</span>
                        ))}
                        {calendarDays.map((date, index) => {
                            if (!date) return <span key={`empty-${index}`} />;
                            const key = dateKey(date);
                            const isFuture = key > todayKey;
                            const isSelected = key === selectedKey;
                            const isToday = key === todayKey;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={isFuture || isSaving}
                                    onClick={() => selectDate(date)}
                                    aria-pressed={isSelected}
                                    aria-label={date.toLocaleDateString("pt-BR", { dateStyle: "full" })}
                                    className={`mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-xl text-sm transition ${
                                        isSelected
                                            ? "bg-(--purple) font-bold text-white"
                                            : isFuture
                                              ? "cursor-not-allowed text-slate-300"
                                              : isSaving
                                                ? "cursor-not-allowed opacity-50"
                                              : isToday
                                                ? "border border-(--purple) font-bold text-(--purple)"
                                                : "hover:bg-(--purple2)"
                                    }`}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-4 text-center text-xs text-(--muted)">Datas futuras não podem ser selecionadas.</p>
                </section>

                <section className="rounded-2xl border border-(--line) bg-white p-4 sm:p-6">
                    <h2 className="text-lg font-extrabold">
                        {selectedDate.toLocaleDateString("pt-BR", { dateStyle: "full" })}
                    </h2>
                    {isLoading ? (
                        <p className="mt-6 text-sm text-(--muted)">Carregando diário...</p>
                    ) : (
                        <>
                            <form onSubmit={handleSaveNotes} className="mt-5">
                                <label htmlFor="study-notes" className="text-sm font-bold">Anotações</label>
                                <textarea
                                    id="study-notes"
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    maxLength={10000}
                                    rows={7}
                                    disabled={isSaving}
                                    placeholder="O que você estudou neste dia? Registre pontos importantes, dúvidas e próximos passos."
                                    className="mt-2 w-full resize-y rounded-xl border border-(--line) p-3 text-sm leading-6 outline-none focus:border-(--purple) disabled:bg-(--bg)"
                                />
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-xs text-(--muted)">{notes.length}/10000 caracteres</span>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="rounded-xl bg-(--purple) px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                                    >
                                        {isSaving ? "Salvando..." : "Salvar anotações"}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 border-t border-(--line) pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold">Arquivos do dia</h3>
                                        <p className="mt-1 text-xs text-(--muted)">Imagens, PDFs e outros arquivos até 15 MB cada.</p>
                                    </div>
                                    <label className={`cursor-pointer rounded-xl border border-(--line) px-4 py-2.5 text-sm font-bold hover:bg-(--bg) ${isSaving ? "pointer-events-none opacity-50" : ""}`}>
                                        Adicionar arquivos
                                        <input
                                            type="file"
                                            multiple
                                            disabled={isSaving}
                                            onChange={handleUpload}
                                            className="sr-only"
                                        />
                                    </label>
                                </div>
                                {uploadProgress && (
                                    <p role="status" className="mt-3 text-sm font-semibold text-(--purple)">
                                        {uploadProgress.fileName
                                            ? `Enviando ${uploadProgress.fileName}… ${uploadProgress.percent}%`
                                            : "Salvando arquivos no diário…"}
                                    </p>
                                )}
                                {attachments.length === 0 ? (
                                    <p className="mt-4 rounded-xl bg-(--bg) p-4 text-sm text-(--muted)">Nenhum arquivo adicionado neste dia.</p>
                                ) : (
                                    <ul className="mt-4 space-y-3">
                                        {attachments.map((attachment) => (
                                            <li key={attachment.id} className="flex items-center gap-3 rounded-xl bg-(--bg) p-3">
                                                <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-(--purple)">
                                                    {attachment.contentType === "application/pdf"
                                                        ? "PDF"
                                                        : attachment.contentType?.startsWith("image/")
                                                          ? "IMG"
                                                          : "FILE"}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadAttachment(attachment)}
                                                        className="block max-w-full truncate text-left text-sm font-bold text-(--ink) hover:text-(--purple)"
                                                    >
                                                        {attachment.name}
                                                    </button>
                                                    <span className="text-xs text-(--muted)">{(attachment.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleDeleteAttachment(attachment)}
                                                    aria-label={`Remover ${attachment.name}`}
                                                    className="rounded-lg px-2 py-1 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    Remover
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                    {notice && <p role="status" className="mt-4 text-sm font-semibold text-green-700">{notice}</p>}
                </section>
            </div>
        </div>
    );
}
