import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { getThemePreference, saveThemePreference } from "../../services/studyData";
import StudyTimer from "./StudyTimer";

const navigation = [
    { to: "/dashboard", label: "Visão geral", icon: "▦", end: true },
    { to: "/dashboard/timer", label: "Estudar", icon: "◷" },
    { to: "/dashboard/calendar", label: "Calendário", icon: "▣" },
    { to: "/dashboard/timeline", label: "Linha do tempo", icon: "↧" },
];

export default function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = auth.currentUser;
    const isTimerPage = location.pathname.endsWith("/dashboard/timer");
    const [theme, setTheme] = useState("light");
    const [isThemeLoading, setIsThemeLoading] = useState(true);
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const [themeError, setThemeError] = useState("");

    useEffect(() => {
        let isActive = true;
        if (!user?.uid) return undefined;

        getThemePreference(user.uid)
            .then((savedTheme) => {
                if (isActive) {
                    setTheme(savedTheme);
                    setThemeError("");
                }
            })
            .catch((loadError) => {
                console.error("Não foi possível carregar a preferência de tema.", loadError);
                if (isActive) setThemeError("Não foi possível carregar sua preferência de aparência.");
            })
            .finally(() => {
                if (isActive) setIsThemeLoading(false);
            });

        return () => { isActive = false; };
    }, [user?.uid]);

    async function handleToggleTheme() {
        if (!user?.uid || isSavingTheme || isThemeLoading) return;
        const previousTheme = theme;
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        setIsSavingTheme(true);
        setThemeError("");

        try {
            await saveThemePreference(user.uid, nextTheme);
        } catch (saveError) {
            console.error("Não foi possível salvar a preferência de tema.", saveError);
            setTheme(previousTheme);
            setThemeError("Não foi possível salvar o tema. Confira sua conexão e tente novamente.");
        } finally {
            setIsSavingTheme(false);
        }
    }

    async function handleSignOut() {
        await signOut(auth);
        navigate("/");
    }

    return (
        <div data-theme={theme} className="min-h-screen bg-(--bg) text-(--ink) md:flex">
            <aside className="flex w-full flex-col border-b border-(--line) bg-(--card) p-4 md:min-h-screen md:w-64 md:border-r md:border-b-0 md:p-5">
                <NavLink to="/dashboard" className="mb-5 flex items-center font-black text-xl md:mb-10">
                    <span className="mr-2 inline-grid h-8 w-8 place-items-center rounded-xl bg-(--purple) text-white">✓</span>
                    horado<b className="text-(--purple)">foco</b>
                </NavLink>
                <nav aria-label="Navegação principal" className="flex gap-2 overflow-x-auto md:flex-col">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                                    isActive ? "bg-(--purple2) text-(--purple)" : "text-(--muted) hover:bg-(--bg)"
                                }`
                            }
                        >
                            <span aria-hidden="true">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-(--line) pt-3 md:mt-auto md:block md:pt-5">
                    <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{user?.displayName || "Minha conta"}</p>
                        <p className="truncate text-xs text-(--muted)">{user?.email}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 md:mt-3 md:flex-col">
                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            disabled={isThemeLoading || isSavingTheme}
                            aria-pressed={theme === "dark"}
                            className="rounded-lg px-3 py-2 text-xs font-bold text-(--muted) hover:bg-(--bg) disabled:opacity-60 md:w-full md:text-left"
                        >
                            {isThemeLoading ? "Carregando tema…" : theme === "dark" ? "☀️ Modo claro" : "🌙 Modo noturno"}
                        </button>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="rounded-lg px-3 py-2 text-xs font-bold text-(--muted) hover:bg-(--bg) md:w-full md:text-left"
                        >
                            Sair da conta
                        </button>
                    </div>
                </div>
                {themeError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{themeError}</p>}
            </aside>
            <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
                {!isTimerPage && <Outlet />}
                <StudyTimer compact={!isTimerPage} />
            </main>
        </div>
    );
}
