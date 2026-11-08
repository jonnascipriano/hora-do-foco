import { addDoc, arrayUnion, collection, doc, getDoc, getDocs, getFirestore, query, setDoc, Timestamp, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { app } from "../firebase";

const db = getFirestore(app);
const storage = getStorage(app);

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

export async function getCalendarEntry(userId, dateKey) {
    const entry = await getDoc(doc(db, "users", userId, "calendarEntries", dateKey));
    return entry.exists() ? entry.data() : { notes: "", attachments: [] };
}

export async function saveCalendarEntry(userId, dateKey, entry) {
    await setDoc(doc(db, "users", userId, "calendarEntries", dateKey), {
        ...entry,
        updatedAt: Timestamp.now(),
    });
}

export async function uploadCalendarAttachment(userId, dateKey, file, onProgress) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const path = `users/${userId}/calendar/${dateKey}/${crypto.randomUUID()}-${safeName}`;
    const fileRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(fileRef, file);
    await new Promise((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            (snapshot) => {
                onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
            },
            reject,
            resolve,
        );
    });
    const url = await getDownloadURL(fileRef);
    return { name: file.name, path, url, contentType: file.type || "application/octet-stream", size: file.size };
}

export async function deleteCalendarAttachment(path) {
    await deleteObject(ref(storage, path));
}
