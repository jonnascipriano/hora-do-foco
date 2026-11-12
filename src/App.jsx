import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Home from "./components/Home";
import Login from "./components/Login";

const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const DashboardHome = lazy(() => import("./components/dashboard/DashboardHome"));
const StudyCalendar = lazy(() => import("./components/dashboard/StudyCalendar"));
const StudyTimeline = lazy(() => import("./components/dashboard/StudyTimeline"));

function AuthLoading() {
    return <div className="grid min-h-screen place-items-center text-(--muted)">Carregando...</div>;
}

function RequireAuth({ children, user, isLoading }) {
    if (isLoading) {
        return <AuthLoading />;
    }

    return user ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthenticated({ children, user, isLoading }) {
    if (isLoading) {
        return <AuthLoading />;
    }

    return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setIsLoading(false);
    }), []);

    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                <Route
                    path="/"
                    element={<RedirectIfAuthenticated user={user} isLoading={isLoading}><Home /></RedirectIfAuthenticated>}
                />
                <Route
                    path="/login"
                    element={<RedirectIfAuthenticated user={user} isLoading={isLoading}><Login /></RedirectIfAuthenticated>}
                />
                <Route
                    path="/dashboard"
                    element={
                        <Suspense fallback={<div className="grid min-h-screen place-items-center text-(--muted)">Carregando...</div>}>
                            <RequireAuth user={user} isLoading={isLoading}><DashboardLayout /></RequireAuth>
                        </Suspense>
                    }
                >
                    <Route index element={<DashboardHome />} />
                    <Route path="timer" element={null} />
                    <Route path="calendar" element={<StudyCalendar />} />
                    <Route path="timeline" element={<StudyTimeline />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}