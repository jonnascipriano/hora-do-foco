import { auth } from "../firebase";

const API_URL = import.meta.env.VITE_CALENDAR_API_URL || "https://horadofoco.com/api/calendar.php";

async function getAuthToken() {
    if (!auth.currentUser) {
        throw new Error("Faça login para acessar o calendário.");
    }
    return auth.currentUser.getIdToken();
}

function endpointUrl(params = {}) {
    const url = new URL(API_URL, window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
}

async function parseJsonResponse(response) {
    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error("A API do calendário retornou uma resposta inválida.");
    }

    if (!response.ok) {
        throw new Error(typeof payload.erro === "string" ? payload.erro : "Não foi possível acessar o calendário.");
    }
    return payload;
}

async function postJson(payload) {
    const token = await getAuthToken();
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    return parseJsonResponse(response);
}

export async function getCalendarEntry(date) {
    const token = await getAuthToken();
    const response = await fetch(endpointUrl({ date }), {
        headers: { Authorization: `Bearer ${token}` },
    });
    return parseJsonResponse(response);
}

export async function saveCalendarEntry(date, notes) {
    await postJson({ action: "save", date, notes });
}

export async function uploadCalendarAttachment(date, file, onProgress) {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append("action", "upload");
    formData.append("date", date);
    formData.append("file", file);

    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", API_URL);
        request.setRequestHeader("Authorization", `Bearer ${token}`);
        request.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) onProgress?.(event.loaded / event.total);
        });
        request.addEventListener("error", () => reject(new Error("Não foi possível conectar à API do calendário.")));
        request.addEventListener("abort", () => reject(new Error("O envio do arquivo foi cancelado.")));
        request.addEventListener("load", () => {
            let payload;
            try {
                payload = JSON.parse(request.responseText);
            } catch {
                reject(new Error("A API do calendário retornou uma resposta inválida."));
                return;
            }

            if (request.status < 200 || request.status >= 300 || !payload.sucesso || !payload.arquivo) {
                reject(new Error(typeof payload.erro === "string" ? payload.erro : "Não foi possível salvar o arquivo."));
                return;
            }
            resolve(payload.arquivo);
        });
        request.send(formData);
    });
}

export async function getCalendarAttachmentBlob(id) {
    const token = await getAuthToken();
    const response = await fetch(endpointUrl({ action: "download", id }), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const payload = await parseJsonResponse(response);
        throw new Error(payload.erro || "Não foi possível baixar o arquivo.");
    }
    return response.blob();
}

export async function deleteCalendarAttachment(id) {
    await postJson({ action: "delete", id });
}
