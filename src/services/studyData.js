import { addDoc, collection, doc, getDoc, getDocs, getFirestore, query, setDoc, Timestamp, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../firebase";

const db = getFirestore(app);
const storage = getStorage(app);

const userCollection = (userId, name) => collection(db, "users", userId, name);

export async function saveStudySession(userId, session) {
    return addDoc(userCollection(userId, "studySessions"), {
        ...session,
        startedAt: Timestamp.fromDate(session.startedAt),
        endedAt: Timestamp.fromDate(session.endedAt),
    });
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

export async function uploadCalendarAttachment(userId, dateKey, file) {
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const path = `users/${userId}/calendar/${dateKey}/${crypto.randomUUID()}-${safeName}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { name: file.name, path, url, contentType: file.type || "application/octet-stream", size: file.size };
}

export async function deleteCalendarAttachment(path) {
    await deleteObject(ref(storage, path));
}
