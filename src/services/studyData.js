import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, getFirestore, query, setDoc, Timestamp, where } from "firebase/firestore";
import { app } from "../firebase";

const db = getFirestore(app);

const userCollection = (userId, name) => collection(db, "users", userId, name);

export async function saveStudySession(userId, session) {
    const savedSession = await addDoc(userCollection(userId, "studySessions"), {
        ...session,
        startedAt: Timestamp.fromDate(session.startedAt),
        endedAt: Timestamp.fromDate(session.endedAt),
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("study-session-saved"));
    return savedSession;
}

export async function getStudySessions(userId, start, end) {
    const sessionsQuery = query(
        userCollection(userId, "studySessions"),
        where("endedAt", ">=", Timestamp.fromDate(start)),
        where("endedAt", "<", Timestamp.fromDate(end)),
    );
    const snapshot = await getDocs(sessionsQuery);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getAllStudySessions(userId) {
    const snapshot = await getDocs(userCollection(userId, "studySessions"));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getCustomStudySubjects(userId) {
    const snapshot = await getDoc(doc(db, "users", userId, "settings", "studySubjects"));
    if (!snapshot.exists()) return [];

    const savedSubjects = snapshot.data().subjects;
    if (savedSubjects === undefined) return [];
    if (!Array.isArray(savedSubjects)) throw new Error("A lista de matérias salva está inválida.");
    return savedSubjects.filter((subject) => typeof subject === "string" && subject.trim());
}

export async function addCustomStudySubject(userId, subject) {
    const name = subject.trim();
    const settingsRef = doc(db, "users", userId, "settings", "studySubjects");
    const snapshot = await getDoc(settingsRef);
    const savedSubjects = snapshot.exists() ? snapshot.data().subjects ?? [] : [];
    if (!Array.isArray(savedSubjects) || savedSubjects.some((item) => typeof item !== "string")) {
        throw new Error("A lista de matérias salva está inválida.");
    }
    const existingSubject = savedSubjects.find((item) => item.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existingSubject) return existingSubject;

    await setDoc(settingsRef, { subjects: arrayUnion(name) }, { merge: true });
    return name;
}

export async function getThemePreference(userId) {
    const snapshot = await getDoc(doc(db, "users", userId, "settings", "preferences"));
    if (!snapshot.exists()) return "light";

    const theme = snapshot.data().theme;
    if (theme === undefined) return "light";
    if (theme !== "light" && theme !== "dark") {
        throw new Error("A preferência de tema salva está inválida.");
    }
    return theme;
}

export async function saveThemePreference(userId, theme) {
    if (theme !== "light" && theme !== "dark") {
        throw new Error("O tema selecionado é inválido.");
    }
    await setDoc(doc(db, "users", userId, "settings", "preferences"), { theme }, { merge: true });
}

export async function getWeeklyStudyGoal(userId) {
    const snapshot = await getDoc(doc(db, "users", userId, "settings", "weeklyStudyGoal"));
    if (!snapshot.exists()) return null;

    const hours = snapshot.data().hours;
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 1 || hours > 168) {
        throw new Error("Sua meta semanal salva está inválida.");
    }
    return hours;
}

export async function saveWeeklyStudyGoal(userId, hours) {
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 1 || hours > 168) {
        throw new Error("Defina uma meta entre 1 e 168 horas por semana.");
    }
    await setDoc(doc(db, "users", userId, "settings", "weeklyStudyGoal"), { hours });
}
