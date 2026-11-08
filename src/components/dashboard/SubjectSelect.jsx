import { useEffect, useState } from "react";
import { auth } from "../../firebase";
import { addCustomStudySubject, getCustomStudySubjects } from "../../services/studyData";
import { subjects } from "./studySubjects";

export default function SubjectSelect({ value, onChange, customSubject, onCustomSubjectChange, disabled = false }) {
    const [personalSubjects, setPersonalSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState("");
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
    const [isSavingSubject, setIsSavingSubject] = useState(false);
    const [subjectError, setSubjectError] = useState("");

    useEffect(() => {
        let isActive = true;
        const userId = auth.currentUser?.uid;

        Promise.resolve()
            .then(() => {
                if (!userId) throw new Error("Nenhum usuário autenticado.");
                return getCustomStudySubjects(userId);
            })
            .then((items) => {
                if (isActive) setPersonalSubjects(items);
            })
            .catch((loadError) => {
                console.error("Não foi possível carregar as matérias personalizadas.", loadError);
                if (isActive) {
                    setSubjectError(userId
                        ? "Não foi possível carregar suas matérias salvas."
                        : "Entre na sua conta para carregar suas matérias.");
                }
            })
            .finally(() => {
                if (isActive) setIsLoadingSubjects(false);
            });

        return () => { isActive = false; };
    }, []);

    async function handleAddSubject(event) {
        event.preventDefault();
        const name = newSubject.trim();
        if (!name || isSavingSubject) return;

        const standardSubject = subjects.find((subject) => subject.toLocaleLowerCase() === name.toLocaleLowerCase());
        if (standardSubject) {
            onChange(standardSubject);
            setNewSubject("");
            setSubjectError("");
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            setSubjectError("Entre na sua conta para salvar uma matéria.");
            return;
        }

        setIsSavingSubject(true);
        setSubjectError("");
        try {
            const savedSubject = await addCustomStudySubject(userId, name);
            setPersonalSubjects((currentSubjects) => (
                currentSubjects.some((item) => item.toLocaleLowerCase() === savedSubject.toLocaleLowerCase())
                    ? currentSubjects
                    : [...currentSubjects, savedSubject]
            ));
            onChange(savedSubject);
            setNewSubject("");
        } catch (saveError) {
            console.error("Não foi possível salvar a matéria personalizada.", saveError);
            setSubjectError("Não foi possível salvar a matéria. Confira sua conexão e tente novamente.");
        } finally {
            setIsSavingSubject(false);
        }
    }

    return (
        <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">
                    Matéria <span className="text-red-600">*</span>
                    <select
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        disabled={disabled}
                        required
                        className="mt-1.5 w-full rounded-xl border border-(--line) bg-white p-3 font-normal outline-none focus:border-(--purple) disabled:bg-(--bg)"
                    >
                        <option value="">Selecione uma matéria</option>
                        {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                        {personalSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                    {isLoadingSubjects && <span className="mt-1 block text-xs text-(--muted)">Carregando suas matérias…</span>}
                </label>
                {value === "Outros" && (
                    <label className="text-sm font-bold">
                        Nome da matéria <span className="text-red-600">*</span>
                        <input
                            value={customSubject}
                            onChange={(event) => onCustomSubjectChange(event.target.value)}
                            disabled={disabled}
                            required
                            maxLength={60}
                            placeholder="Ex.: Medicina Legal"
                            className="mt-1.5 w-full rounded-xl border border-(--line) bg-white p-3 font-normal outline-none focus:border-(--purple)"
                        />
                    </label>
                )}
            </div>
            <form onSubmit={handleAddSubject} className="rounded-xl border border-(--line) bg-(--bg) p-4">
                <label htmlFor="new-study-subject" className="text-sm font-bold">Adicionar matéria à minha lista</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                        id="new-study-subject"
                        value={newSubject}
                        onChange={(event) => setNewSubject(event.target.value)}
                        disabled={disabled || isSavingSubject}
                        maxLength={60}
                        placeholder="Ex.: Medicina Legal"
                        className="min-w-0 flex-1 rounded-xl border border-(--line) bg-white p-3 text-sm font-normal outline-none focus:border-(--purple) disabled:bg-white"
                    />
                    <button
                        type="submit"
                        disabled={disabled || isSavingSubject || !newSubject.trim()}
                        className="rounded-xl bg-(--purple) px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSavingSubject ? "Salvando…" : "Adicionar"}
                    </button>
                </div>
                <p className="mt-2 text-xs text-(--muted)">A matéria ficará salva na sua conta para os próximos estudos.</p>
            </form>
            {subjectError && <p role="alert" className="text-sm font-semibold text-red-700">{subjectError}</p>}
        </div>
    );
}
