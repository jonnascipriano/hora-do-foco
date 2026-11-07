import { subjects } from "./studySubjects";

export default function SubjectSelect({ value, onChange, customSubject, onCustomSubjectChange, disabled = false }) {
    return (
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
                </select>
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
                        className="mt-1.5 w-full rounded-xl border border-(--line) bg-white p-3 font-normal outline-none focus:border-(--purple) disabled:bg-(--bg)"
                    />
                </label>
            )}
        </div>
    );
}
