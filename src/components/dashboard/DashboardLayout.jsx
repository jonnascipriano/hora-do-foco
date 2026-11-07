import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import StudyTimer from "./StudyTimer";

const navigation = [
    { to: "/dashboard", label: "Visão geral", icon: "▦", end: true },
    { to: "/dashboard/timer", label: "Estudar", icon: "◷" },
    { to: "/dashboard/calendar", label: "Calendário", icon: "▣" },
];

export default function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = auth.currentUser;
    const isTimerPage = location.pathname.endsWith("/dashboard/timer");

    async function handleSignOut() {
        await signOut(auth);
        navigate("/");
    }

    return (
        <div className="min-h-screen bg-(--bg) text-(--ink) md:flex">
            <aside className="flex w-full flex-col border-b border-(--line) bg-white p-4 md:min-h-screen md:w-64 md:border-r md:border-b-0 md:p-5">
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
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-0 shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-(--muted) hover:bg-(--bg) md:mt-3 md:w-full md:text-left"
                    >
                        Sair da conta
                    </button>
                </div>
            </aside>
            <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
                {!isTimerPage && <Outlet />}
                <StudyTimer compact={!isTimerPage} />
            </main>
        </div>
    );
}
