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
    const [notificationPermission, setNotificationPermission] = useState(
        "Notification" in window ? Notification.permission : "unsupported",
    );
    const [notificationError, setNotificationError] = useState("");
    const [isBigScreen, setIsBigScreen] = useState(false);
    const [orientationWarning, setOrientationWarning] = useState("");
    const focusSecondsRef = useRef(0);
    const freeSecondsRef = useRef(0);
    const remainingSecondsRef = useRef(25 * 60);
    const phaseRef = useRef("focus");
    const lastTickAtRef = useRef(null);
    const elapsedRemainderMsRef = useRef(0);
    const focusStartedAtRef = useRef(null);
    const freeStartedAtRef = useRef(null);
    const audioContextRef = useRef(null);
    const lastCompletionAtRef = useRef(0);
    const originalTitleRef = useRef(document.title);

    const resolvedSubject = subject === "Outros" ? customSubject.trim() : subject;
    const timerSeconds = mode === "free" ? freeSeconds : remainingSeconds;
    const hasUnfinishedSession = freeSeconds > 0 || focusSeconds > 0 || phase === "break";
    const notificationTag = "hora-do-foco-timer";

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

    const notify = useCallback(async (title, body, silent = false) => {
        if (notificationPermission !== "granted" || !("serviceWorker" in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body,
                icon: `${import.meta.env.BASE_URL}android-chrome-192x192.png`,
                tag: notificationTag,
                renotify: !silent,
                silent,
            });
        } catch (notificationFailure) {
            console.error("Não foi possível exibir a notificação do Pomodoro.", notificationFailure);
            setNotificationError("Não foi possível exibir a notificação. Confira as permissões do navegador.");
        }
    }, [notificationPermission]);

    const playCompletionSound = useCallback(() => {
        const audioContext = audioContextRef.current;
        if (!audioContext) return;

        try {
            const startAt = audioContext.currentTime;
            [660, 880, 660].forEach((frequency, index) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const noteStart = startAt + index * 0.24;
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0.0001, noteStart);
                gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.2);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.start(noteStart);
                oscillator.stop(noteStart + 0.21);
            });
        } catch (soundFailure) {
            console.error("Não foi possível reproduzir o alerta sonoro do Pomodoro.", soundFailure);
            setNotificationError("Não foi possível reproduzir o alerta sonoro neste dispositivo.");
        }
    }, []);

    const advanceTimer = useCallback(() => {
        const now = Date.now();
        if (lastTickAtRef.current === null) {
            lastTickAtRef.current = now;
            return;
        }

        const elapsedMs = Math.max(0, now - lastTickAtRef.current) + elapsedRemainderMsRef.current;
        lastTickAtRef.current = now;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        elapsedRemainderMsRef.current = elapsedMs % 1000;
        if (elapsedSeconds === 0) return;

        if (mode === "free") {
            freeSecondsRef.current += elapsedSeconds;
            setFreeSeconds(freeSecondsRef.current);
            return;
        }

        let secondsToApply = elapsedSeconds;
        let nextPhase = phaseRef.current;
        let nextRemaining = remainingSecondsRef.current;
        let nextFocusSeconds = focusSecondsRef.current;
        let completedPhase = "";

        while (secondsToApply > 0) {
            const consumedSeconds = Math.min(secondsToApply, nextRemaining);
            secondsToApply -= consumedSeconds;
            nextRemaining -= consumedSeconds;
            if (nextPhase === "focus") nextFocusSeconds += consumedSeconds;
            if (nextRemaining > 0) break;

            const transitionAt = new Date(now - secondsToApply * 1000);
            if (nextPhase === "focus") {
                completedPhase = "focus";
                lastCompletionAtRef.current = transitionAt.getTime();
                const startedAt = focusStartedAtRef.current
                    || new Date(transitionAt.getTime() - nextFocusSeconds * 1000);
                setIsSaving(true);
                recordSession(nextFocusSeconds, startedAt, transitionAt, "pomodoro")
                    .then(() => setNotice(`Sessão de ${resolvedSubject} salva.`))
                    .catch(() => setError("O ciclo terminou, mas não foi possível salvar a sessão. Confira sua conexão e as regras do Firestore."))
                    .finally(() => setIsSaving(false));
                nextFocusSeconds = 0;
                focusStartedAtRef.current = null;
                nextPhase = "break";
                nextRemaining = breakMinutes * 60;
            } else {
                completedPhase = "break";
                lastCompletionAtRef.current = transitionAt.getTime();
                nextPhase = "focus";
                nextFocusSeconds = 0;
                focusStartedAtRef.current = transitionAt;
                nextRemaining = studyMinutes * 60;
            }
        }

        phaseRef.current = nextPhase;
        remainingSecondsRef.current = nextRemaining;
        focusSecondsRef.current = nextFocusSeconds;
        setPhase(nextPhase);
        setRemainingSeconds(nextRemaining);
        setFocusSeconds(nextFocusSeconds);

        if (completedPhase === "focus") {
            playCompletionSound();
            void notify("Fim do foco", "Seu ciclo de estudo terminou. Hora da pausa.");
        } else if (completedPhase === "break") {
            playCompletionSound();
            void notify("Fim da pausa", "Sua pausa terminou. Hora de voltar aos estudos.");
        }
    }, [breakMinutes, mode, notify, playCompletionSound, recordSession, resolvedSubject, studyMinutes]);

    const enableNotifications = useCallback(async () => {
        if (!("Notification" in window)) {
            setNotificationPermission("unsupported");
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            setNotificationError(
                permission === "denied"
                    ? "Notificações bloqueadas. Altere a permissão nas configurações do navegador."
                    : "",
            );
        } catch (permissionFailure) {
            console.error("Não foi possível solicitar permissão para notificações.", permissionFailure);
            setNotificationError("Não foi possível ativar as notificações neste navegador.");
        }
    }, []);

    useEffect(() => {
        if (!isRunning) return undefined;
        const interval = window.setInterval(advanceTimer, 1000);
        document.addEventListener("visibilitychange", advanceTimer);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", advanceTimer);
        };
    }, [advanceTimer, isRunning]);

    useEffect(() => {
        if (!isRunning) {
            document.title = originalTitleRef.current;
            return;
        }
        const activity = mode === "free" ? "Contador livre" : phase === "break" ? "Pausa" : "Foco";
        document.title = `${formatClock(timerSeconds)} · ${activity} | Hora do Foco`;
    }, [isRunning, mode, phase, timerSeconds]);

    useEffect(() => () => {
        document.title = originalTitleRef.current;
    }, []);

    useEffect(() => {
        if (!isRunning || notificationPermission !== "granted") return undefined;

        const updateTimerNotification = () => {
            if (!document.hidden || Date.now() - lastCompletionAtRef.current < 60_000) return;
            const isBreak = mode === "pomodoro" && phase === "break";
            const title = mode === "free"
                ? "Contador livre em andamento"
                : isBreak ? "Pausa em andamento" : "Foco em andamento";
            const body = mode === "free"
                ? `${formatClock(freeSecondsRef.current)} estudados`
                : `${formatClock(remainingSecondsRef.current)} restantes`;
            void notify(title, body, true);
        };
        const closeTimerNotification = () => {
            navigator.serviceWorker.ready.then((registration) =>
                registration.getNotifications({ tag: notificationTag }).then((notifications) => {
                    notifications.forEach((notification) => notification.close());
                }),
            ).catch((notificationFailure) => {
                console.error("Não foi possível atualizar a notificação do timer.", notificationFailure);
            });
        };
        const handleVisibilityChange = () => {
            if (document.hidden) {
                updateTimerNotification();
            } else {
                closeTimerNotification();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        const updateInterval = window.setInterval(updateTimerNotification, 60_000);
        handleVisibilityChange();

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.clearInterval(updateInterval);
            if (!isRunning || !document.hidden) closeTimerNotification();
        };
    }, [isRunning, mode, notificationPermission, notify, phase]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (document.fullscreenElement) return;
            setIsBigScreen(false);
            screen.orientation?.unlock?.();
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    async function enterBigScreen() {
        setOrientationWarning("");
        setIsBigScreen(true);

        try {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (fullscreenFailure) {
            console.error("Não foi possível ativar a tela cheia do contador.", fullscreenFailure);
            setOrientationWarning("Não foi possível ativar a tela cheia. Você ainda pode usar o contador ampliado.");
        }

        if (window.matchMedia("(max-width: 767px)").matches) {
            if (screen.orientation?.lock) {
                try {
                    await screen.orientation.lock("landscape");
                } catch {
                    setOrientationWarning("Para girar a tela, desative a rotação automática bloqueada no celular.");
                }
            } else {
                setOrientationWarning("Gire o celular para a horizontal para aproveitar melhor o contador.");
            }
        }
    }

    async function exitBigScreen() {
        setIsBigScreen(false);
        screen.orientation?.unlock?.();
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (fullscreenFailure) {
                console.error("Não foi possível sair da tela cheia do contador.", fullscreenFailure);
            }
        }
    }

    function selectMode(nextMode) {
        if (isRunning || hasUnfinishedSession) return;
        setMode(nextMode);
        setError("");
        setNotice("");
        setPhase("focus");
        phaseRef.current = "focus";
        focusSecondsRef.current = 0;
        freeSecondsRef.current = 0;
        elapsedRemainderMsRef.current = 0;
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
        setNotificationError("");
        if (!resolvedSubject) {
            setError(subject === "Outros" ? "Informe o nome da matéria para começar." : "Selecione uma matéria para começar.");
            return;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current?.state === "suspended") {
            audioContextRef.current.resume().catch((soundFailure) => {
                console.error("Não foi possível ativar o áudio para o alerta do Pomodoro.", soundFailure);
                setNotificationError("Ative o som do navegador para ouvir o alerta ao fim do ciclo.");
            });
        }
        if (mode === "free" && freeSecondsRef.current === 0) freeStartedAtRef.current = new Date();
        if (mode === "pomodoro" && phase === "focus" && focusSecondsRef.current === 0) focusStartedAtRef.current = new Date();
        lastTickAtRef.current = Date.now();
        setIsRunning(true);
    }

    async function stopTimer() {
        if (isRunning) advanceTimer();
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
        elapsedRemainderMsRef.current = 0;
        lastTickAtRef.current = null;
        setFocusSeconds(0);
        setFreeSeconds(0);
        focusStartedAtRef.current = null;
        freeStartedAtRef.current = null;
        setPhase("focus");
        phaseRef.current = "focus";
        remainingSecondsRef.current = studyMinutes * 60;
        setRemainingSeconds(remainingSecondsRef.current);
    }

    function pauseTimer() {
        advanceTimer();
        setIsRunning(false);
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

    if (isBigScreen) {
        return (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black text-white">
                <button
                    type="button"
                    onClick={exitBigScreen}
                    aria-label="Sair da tela grande"
                    className="absolute right-4 top-4 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white/80"
                >
                    Sair
                </button>
                <p aria-live="polite" aria-label={`Tempo: ${formatClock(timerSeconds)}`} className="font-mono text-[clamp(4rem,20vw,14rem)] font-bold leading-none tracking-tight">
                    {formatClock(timerSeconds)}
                </p>
                {orientationWarning && (
                    <p role="status" className="absolute bottom-6 left-4 right-4 text-center text-sm text-white/70">
                        {orientationWarning}
                    </p>
                )}
            </div>
        );
    }

    if (compact) {
        if (!isRunning) return null;
        return (
            <div className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-(--line) bg-(--card) p-3 shadow-xl sm:inset-x-auto sm:right-6">
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

            <section className="mt-6 rounded-2xl border border-(--line) bg-(--card) p-5 sm:p-8">
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
                                mode === value ? "bg-(--card) text-(--purple) shadow-sm" : "text-(--muted)"
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
                    <button
                        type="button"
                        onClick={enterBigScreen}
                        className="rounded-xl border border-(--line) bg-(--card) px-5 py-3 text-sm font-bold"
                    >
                        Tela grande
                    </button>
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
                        <button type="button" onClick={pauseTimer} className="rounded-xl border border-(--line) bg-(--card) px-6 py-3 text-sm font-bold">
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
                {notificationPermission === "default" && (
                    <div className="mt-5 text-center">
                        <button
                            type="button"
                            onClick={enableNotifications}
                            className="text-sm font-bold text-(--purple) underline underline-offset-2"
                        >
                            Ativar notificações do timer
                        </button>
                    </div>
                )}
                {notificationPermission === "denied" && (
                    <p className="mt-5 text-center text-xs text-(--muted)">
                        Para receber notificações, permita-as nas configurações do navegador.
                    </p>
                )}
                {notificationPermission === "granted" && (
                    <p className="mt-5 text-center text-xs text-(--muted)">
                        Notificações ativadas: o timer aparece em segundo plano e avisa quando o ciclo terminar.
                    </p>
                )}
                {notificationPermission === "unsupported" && (
                    <p className="mt-5 text-center text-xs text-(--muted)">
                        Este navegador não oferece suporte a notificações.
                    </p>
                )}
                {notificationError && (
                    <p role="alert" className="mt-3 text-center text-sm font-semibold text-amber-700">{notificationError}</p>
                )}
                {error && <p role="alert" className="mt-4 text-center text-sm font-semibold text-red-700">{error}</p>}
                {notice && <p role="status" className="mt-4 text-center text-sm font-semibold text-green-700">{notice}</p>}
                {subject === "Outros" && !customSubject.trim() && (
                    <p className="mt-4 text-center text-xs text-(--muted)">O nome da matéria é obrigatório antes de começar.</p>
                )}
            </section>
        </div>
    );
}
