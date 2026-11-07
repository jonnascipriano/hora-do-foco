import { useEffect, useMemo, useState } from "react";
import { auth } from "../../firebase";
import { getStudySessions } from "../../services/studyData";

const ranges = [
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
    { id: "year", label: "Ano" },
];
const colors = ["#6857e8", "#16a579", "#f3a64a", "#4285f4", "#e65a7a", "#13a6b0", "#8c59d9", "#64748b"];

function getRange(type) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);

    if (type === "week") {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 7);
    } else if (type === "month") {
        start.setDate(1);
        end.setFullYear(start.getFullYear(), start.getMonth() + 1, 1);
    } else if (type === "year") {
        start.setMonth(0, 1);
        end.setFullYear(start.getFullYear() + 1, 0, 1);
    } else {
        end.setDate(end.getDate() + 1);
    }

    return { start, end };
}

function formatDuration(seconds) {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} min`;
    return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

export default function DashboardHome() {
    const [range, setRange] = useState("week");
    const [result, setResult] = useState({ range: null, sessions: [], error: "" });
    const isLoading = result.range !== range;
    const sessions = useMemo(
        () => isLoading ? [] : result.sessions,
        [isLoading, result.sessions],
    );
    const error = isLoading ? "" : result.error;

    useEffect(() => {
        let isActive = true;
        const { start, end } = getRange(range);

        getStudySessions(auth.currentUser.uid, start, end)
            .then((items) => {
                if (isActive) setResult({ range, sessions: items, error: "" });
            })
            .catch(() => {
                if (isActive) setResult({
                    range,
                    sessions: [],
                    error: "Não foi possível carregar seus estudos. Confira as regras do Firestore.",
                });
            });

        return () => { isActive = false; };
    }, [range]);

    const subjects = useMemo(() => {
        const totals = new Map();
        sessions.forEach((session) => {
            const name = session.subject;
            totals.set(name, (totals.get(name) || 0) + session.elapsedSeconds);
        });
        return [...totals.entries()]
            .map(([name, seconds]) => ({ name, seconds }))
            .sort((a, b) => b.seconds - a.seconds);
    }, [sessions]);
    const totalSeconds = subjects.reduce((sum, subject) => sum + subject.seconds, 0);
    let accumulatedPercent = 0;
    const gradient = subjects.map((subject, index) => {
        const start = accumulatedPercent;
        accumulatedPercent += totalSeconds ? (subject.seconds / totalSeconds) * 100 : 0;
        return `${colors[index % colors.length]} ${start}% ${accumulatedPercent}%`;
    }).join(", ");
    const chartStyle = {
        background: totalSeconds
            ? `conic-gradient(${gradient})`
            : "conic-gradient(#e8ebf2 0% 100%)",
    };

    return (
        <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-(--purple)">Seu progresso</p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Dashboard</h1>
                    <p className="mt-2 text-sm text-(--muted)">Acompanhe sua rotina e evolução nos estudos.</p>
                </div>
                <div className="flex rounded-xl border border-(--line) bg-white p-1" aria-label="Período do dashboard">
                    {ranges.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setRange(item.id)}
                            aria-pressed={range === item.id}
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                                range === item.id ? "bg-(--purple) text-white" : "text-(--muted) hover:bg-(--bg)"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

            <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                <article className="rounded-2xl border border-(--line) bg-white p-5 sm:p-6">
                    <p className="text-sm font-bold text-(--muted)">Horas estudadas neste período</p>
                    <p className="mt-2 text-3xl font-extrabold">{isLoading ? "…" : formatDuration(totalSeconds)}</p>
                    <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                        <div
                            role="img"
                            aria-label="Gráfico de horas estudadas por disciplina"
                            className="grid h-48 w-48 shrink-0 place-items-center rounded-full"
                            style={chartStyle}
                        >
                            <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center">
                                <span>
                                    <strong className="block text-lg">{subjects.length}</strong>
                                    <small className="text-xs text-(--muted)">matérias</small>
                                </span>
                            </div>
                        </div>
                        <div className="w-full flex-1">
                            <h2 className="font-bold">Disciplinas estudadas</h2>
                            {isLoading ? (
                                <p className="mt-3 text-sm text-(--muted)">Carregando dados…</p>
                            ) : subjects.length === 0 ? (
                                <p className="mt-3 text-sm text-(--muted)">Ainda não há sessões neste período. Inicie um estudo para ver seu progresso.</p>
                            ) : (
                                <ul className="mt-3 divide-y divide-(--line)">
                                    {subjects.map((subject, index) => {
                                        const percentage = totalSeconds ? (subject.seconds / totalSeconds) * 100 : 0;
                                        return (
                                            <li key={subject.name} className="flex items-center gap-3 py-3">
                                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold">{subject.name}</span>
                                                    <span className="text-xs text-(--muted)">{formatDuration(subject.seconds)}</span>
                                                </span>
                                                <span className="text-sm font-bold">{percentage.toFixed(1)}%</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </article>
                <article className="rounded-2xl border border-(--line) bg-white p-5 sm:p-6">
                    <p className="text-sm font-bold text-(--muted)">Resumo de sessões</p>
                    <p className="mt-2 text-3xl font-extrabold">{isLoading ? "…" : sessions.length}</p>
                    <p className="mt-1 text-sm text-(--muted)">sessões concluídas no período</p>
                    <div className="mt-6 rounded-xl bg-(--purple2) p-4">
                        <p className="text-sm font-bold text-(--purple)">Constância vale mais que pressa.</p>
                        <p className="mt-1 text-xs leading-5 text-(--muted)">Registre cada sessão para acompanhar sua evolução por matéria e ao longo do tempo.</p>
                    </div>
                </article>
            </section>
        </div>
    );
}
