import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../firebase";
import { saveStudySession } from "../../services/studyData";
import SubjectSelect from "./SubjectSelect";

function formatClock(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map((value) => value.toString().padStart(2, "0")).join(":");
}

export default function StudyTimer({ compact = false }) {
    const [mode, setMode] = useState("pomodoro");
    const [subject, setSubject] = useState("");
    const [customSubject, setCustomSubject] = useState("");
    const [studyMinutes, setStudyMinutes] = useState(25);
    const [breakMinutes, setBreakMinutes] = useState(5);
    const [phase, setPhase] = useState("focus");
    const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
    const [focusSeconds, setFocusSeconds] = useState(0);
    const [freeSeconds, setFreeSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const focusSecondsRef = useRef(0);
    const freeSecondsRef = useRef(0);
    const remainingSecondsRef = useRef(25 * 60);
    const focusStartedAtRef = useRef(null);
    const freeStartedAtRef = useRef(null);

    const resolvedSubject = subject === "Outros" ? customSubject.trim() : subject;
    const timerSeconds = mode === "free" ? freeSeconds : remainingSeconds;
    const hasUnfinishedSession = freeSeconds > 0 || focusSeconds > 0 || phase === "break";

    const recordSession = useCallback(async (seconds, startedAt, endedAt, sessionMode) => {
        if (!seconds || !resolvedSubject) return;
        await saveStudySession(auth.currentUser.uid, {
            subject: resolvedSubject,
            elapsedSeconds: seconds,
            mode: sessionMode,
            startedAt,
            endedAt,
        });
    }, [resolvedSubject]);

    useEffect(() => {
        if (!isRunning) return undefined;
        const interval = window.setInterval(() => {
            if (mode === "free") {
                freeSecondsRef.current += 1;
                setFreeSeconds(freeSecondsRef.current);
                return;
            }

            if (phase === "focus") {
                focusSecondsRef.current += 1;
                setFocusSeconds(focusSecondsRef.current);
            }

            const nextRemaining = remainingSecondsRef.current - 1;
            remainingSecondsRef.current = nextRemaining;
            setRemainingSeconds(Math.max(0, nextRemaining));
            if (nextRemaining > 0) return;

            if (phase === "focus") {
                const seconds = focusSecondsRef.current;
                const endedAt = new Date();
                const startedAt = focusStartedAtRef.current || new Date(endedAt.getTime() - seconds * 1000);
                setIsSaving(true);
                recordSession(seconds, startedAt, endedAt, "pomodoro")
                    .then(() => setNotice(`Sessão de ${resolvedSubject} salva.`))
                    .catch(() => setError("O ciclo terminou, mas não foi possível salvar a sessão. Confira sua conexão e as regras do Firestore."))
                    .finally(() => setIsSaving(false));
                focusSecondsRef.current = 0;
                setFocusSeconds(0);
                focusStartedAtRef.current = null;
                remainingSecondsRef.current = breakMinutes * 60;
                setRemainingSeconds(remainingSecondsRef.current);
                setPhase("break");
            } else {
                focusStartedAtRef.current = new Date();
                focusSecondsRef.current = 0;
                setFocusSeconds(0);
                remainingSecondsRef.current = studyMinutes * 60;
                setRemainingSeconds(remainingSecondsRef.current);
                setPhase("focus");
            }
        }, 1000);
        return () => window.clearInterval(interval);
    }, [isRunning, mode, phase, breakMinutes, studyMinutes, resolvedSubject, recordSession]);

    function selectMode(nextMode) {
        if (isRunning || hasUnfinishedSession) return;
        setMode(nextMode);
        setError("");
        setNotice("");
        setPhase("focus");
        focusSecondsRef.current = 0;
        freeSecondsRef.current = 0;
        setFocusSeconds(0);
        setFreeSeconds(0);
        remainingSecondsRef.current = studyMinutes * 60;
        setRemainingSeconds(remainingSecondsRef.current);
        focusStartedAtRef.current = null;
        freeStartedAtRef.current = null;
    }

    function startTimer() {
        setError("");
        setNotice("");
        if (!resolvedSubject) {
            setError(subject === "Outros" ? "Informe o nome da matéria para começar." : "Selecione uma matéria para começar.");
            return;
        }
        if (mode === "free" && freeSecondsRef.current === 0) freeStartedAtRef.current = new Date();
        if (mode === "pomodoro" && phase === "focus" && focusSecondsRef.current === 0) focusStartedAtRef.current = new Date();
        setIsRunning(true);
    }

    async function stopTimer() {
        setIsRunning(false);
        setError("");
        const now = new Date();
        const seconds = mode === "free" ? freeSecondsRef.current : phase === "focus" ? focusSecondsRef.current : 0;
        const startedAt = mode === "free" ? freeStartedAtRef.current : focusStartedAtRef.current;
        if (seconds && startedAt) {
            setIsSaving(true);
            try {
                await recordSession(seconds, startedAt, now, mode);
                setNotice(`Tempo de ${resolvedSubject} salvo no seu dashboard.`);
            } catch {
                setError("Não foi possível salvar seu tempo de estudo. Confira sua conexão e tente novamente.");
                setIsSaving(false);
                return;
            }
            setIsSaving(false);
        }
        focusSecondsRef.current = 0;
        freeSecondsRef.current = 0;
        setFocusSeconds(0);
        setFreeSeconds(0);
        focusStartedAtRef.current = null;
        freeStartedAtRef.current = null;
        setPhase("focus");
        remainingSecondsRef.current = studyMinutes * 60;
        setRemainingSeconds(remainingSecondsRef.current);
    }

    function updateDuration(value, setter, isBreak = false) {
        const nextValue = Math.min(isBreak ? 60 : 180, Math.max(1, Number(value) || 1));
        setter(nextValue);
        if (!isRunning && phase === (isBreak ? "break" : "focus")) {
            const seconds = nextValue * 60;
            remainingSecondsRef.current = seconds;
            setRemainingSeconds(seconds);
        }
    }

    if (compact) {
        if (!isRunning) return null;
        return (
            <div className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-(--line) bg-white p-3 shadow-xl sm:inset-x-auto sm:right-6">
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{resolvedSubject} · {mode === "pomodoro" && phase === "break" ? "Pausa" : "Estudando"}</p>
                    <p className="font-mono text-lg font-extrabold">{formatClock(timerSeconds)}</p>
                </div>
                <Link to="/dashboard/timer" className="shrink-0 rounded-lg bg-(--purple) px-3 py-2 text-xs font-bold text-white">
                    Abrir cronômetro
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl">
            <p className="text-sm font-bold text-(--purple)">Sua sessão de estudo</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Cronômetro</h1>
            <p className="mt-2 text-sm text-(--muted)">Escolha uma matéria. Todo tempo registrado entra no seu dashboard.</p>

            <section className="mt-6 rounded-2xl border border-(--line) bg-white p-5 sm:p-8">
                <div className="flex w-fit rounded-xl bg-(--bg) p-1">
                    {[
                        ["pomodoro", "Pomodoro"],
                        ["free", "Contador livre"],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => selectMode(value)}
                            disabled={isRunning || isSaving || hasUnfinishedSession}
                            aria-pressed={mode === value}
                            className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${
                                mode === value ? "bg-white text-(--purple) shadow-sm" : "text-(--muted)"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="mt-6">
                    <SubjectSelect
                        value={subject}
                        onChange={(value) => { setSubject(value); setError(""); }}
                        customSubject={customSubject}
                        onCustomSubjectChange={(value) => { setCustomSubject(value); setError(""); }}
                        disabled={isRunning || isSaving || hasUnfinishedSession}
                    />
                </div>

                {mode === "pomodoro" && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-bold">
                            Minutos de foco
                            <input
                                type="number"
                                min="1"
                                max="180"
                                value={studyMinutes}
                                disabled={isRunning || isSaving || hasUnfinishedSession}
                                onChange={(event) => updateDuration(event.target.value, setStudyMinutes)}
                                className="mt-1.5 w-full rounded-xl border border-(--line) p-3 disabled:bg-(--bg)"
                            />
                        </label>
                        <label className="text-sm font-bold">
                            Minutos de pausa
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={breakMinutes}
                                disabled={isRunning || isSaving || hasUnfinishedSession}
                                onChange={(event) => updateDuration(event.target.value, setBreakMinutes, true)}
                                className="mt-1.5 w-full rounded-xl border border-(--line) p-3 disabled:bg-(--bg)"
                            />
                        </label>
                    </div>
                )}

                <div className="my-8 rounded-2xl bg-(--bg) px-4 py-8 text-center">
                    <p className="text-sm font-bold text-(--muted)">
                        {mode === "free" ? "Tempo de estudo" : phase === "focus" ? "Hora de focar" : "Hora da pausa"}
                    </p>
                    <p aria-live="polite" className="mt-2 font-mono text-5xl font-extrabold tracking-tight text-(--ink) sm:text-6xl">
                        {formatClock(timerSeconds)}
                    </p>
                    {mode === "pomodoro" && (
                        <p className="mt-3 text-xs text-(--muted)">
                            {isRunning ? (phase === "focus" ? `${formatClock(focusSeconds)} estudados neste ciclo` : `Próximo: ${studyMinutes} min de foco`) : `${studyMinutes} min de foco · ${breakMinutes} min de pausa`}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                    {!isRunning ? (
                        <button
                            type="button"
                            onClick={startTimer}
                            disabled={isSaving}
                            className="rounded-xl bg-(--purple) px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-200 hover:-translate-y-0.5 disabled:opacity-60"
                        >
                            {mode === "free" && freeSeconds > 0 ? "Retomar" : "Começar a estudar"}
                        </button>
                    ) : (
                        <button type="button" onClick={() => setIsRunning(false)} className="rounded-xl border border-(--line) bg-white px-6 py-3 text-sm font-bold">
                            Pausar
                        </button>
                    )}
                    {(isRunning || freeSeconds > 0 || focusSeconds > 0 || phase === "break") && (
                        <button
                            type="button"
                            onClick={stopTimer}
                            disabled={isSaving}
                            className="rounded-xl border border-(--line) px-6 py-3 text-sm font-bold text-(--muted) disabled:opacity-60"
                        >
                            {isSaving ? "Salvando..." : "Finalizar sessão"}
                        </button>
                    )}
                </div>
                {error && <p role="alert" className="mt-4 text-center text-sm font-semibold text-red-700">{error}</p>}
                {notice && <p role="status" className="mt-4 text-center text-sm font-semibold text-green-700">{notice}</p>}
                {subject === "Outros" && !customSubject.trim() && (
                    <p className="mt-4 text-center text-xs text-(--muted)">O nome da matéria é obrigatório antes de começar.</p>
                )}
            </section>
        </div>
    );
}
