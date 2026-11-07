import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Home from "./components/Home";
import Login from "./components/Login";

const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout"));
const DashboardHome = lazy(() => import("./components/dashboard/DashboardHome"));
const StudyCalendar = lazy(() => import("./components/dashboard/StudyCalendar"));

function RequireAuth({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setIsLoading(false);
    }), []);

    if (isLoading) {
        return <div className="grid min-h-screen place-items-center text-(--muted)">Carregando...</div>;
    }

    return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route
                    path="/dashboard"
                    element={
                        <Suspense fallback={<div className="grid min-h-screen place-items-center text-(--muted)">Carregando...</div>}>
                            <RequireAuth><DashboardLayout /></RequireAuth>
                        </Suspense>
                    }
                >
                    <Route index element={<DashboardHome />} />
                    <Route path="timer" element={null} />
                    <Route path="calendar" element={<StudyCalendar />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}