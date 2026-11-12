import { useEffect, useRef, useState } from "react";
import { getCalendarAttachmentBlob, getCalendarTimeline } from "../../services/calendarApi";

function formatEntryDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function TimelinePhoto({ attachment }) {
    const containerRef = useRef(null);
    const [imageUrl, setImageUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let isActive = true;
        let objectUrl = "";
        const container = containerRef.current;
        if (!container) return undefined;

        async function loadImage() {
            try {
                const blob = await getCalendarAttachmentBlob(attachment.id);
                objectUrl = URL.createObjectURL(blob);
                if (isActive) setImageUrl(objectUrl);
                else URL.revokeObjectURL(objectUrl);
            } catch (loadError) {
                if (isActive) setError(loadError.message || "Não foi possível carregar esta foto.");
            }
        }

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    loadImage();
                }
            }, { rootMargin: "160px" });
            observer.observe(container);
            return () => {
                isActive = false;
                observer.disconnect();
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            };
        }

        loadImage();
        return () => {
            isActive = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [attachment.id]);

    return (
        <div ref={containerRef} className="overflow-hidden rounded-xl border border-(--line) bg-(--bg)">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={attachment.caption || "Foto do diário de estudos"}
                    className="max-h-96 w-full object-cover"
                />
            ) : (
                <div className="grid min-h-36 place-items-center px-4 py-8 text-center text-sm text-(--muted)">
                    {error || "Carregando foto…"}
                </div>
            )}
            {attachment.caption && (
                <p className="px-3 py-2 text-sm text-(--muted)">{attachment.caption}</p>
            )}
        </div>
    );
}

export default function StudyTimeline() {
    const [entries, setEntries] = useState([]);
    const [before, setBefore] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [loadKey, setLoadKey] = useState(0);

    useEffect(() => {
        let isActive = true;
        getCalendarTimeline()
            .then((result) => {
                if (!isActive) return;
                setEntries(result.entries || []);
                setBefore(result.nextBefore || null);
                setHasMore(Boolean(result.hasMore));
            })
            .catch((loadError) => {
                if (isActive) setError(loadError.message || "Não foi possível carregar sua linha do tempo.");
            })
            .finally(() => {
                if (isActive) setIsLoading(false);
            });
        return () => { isActive = false; };
    }, [loadKey]);

    async function handleLoadMore() {
        if (!before || isLoadingMore) return;
        setIsLoadingMore(true);
        setError("");
        try {
            const result = await getCalendarTimeline(before);
            setEntries((currentEntries) => [...currentEntries, ...(result.entries || [])]);
            setBefore(result.nextBefore || null);
            setHasMore(Boolean(result.hasMore));
        } catch (loadError) {
            setError(loadError.message || "Não foi possível carregar mais registros.");
        } finally {
            setIsLoadingMore(false);
        }
    }

    return (
        <div className="mx-auto max-w-4xl">
            <p className="text-sm font-bold text-(--purple)">Seu diário em movimento</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Linha do tempo</h1>
            <p className="mt-2 text-sm text-(--muted)">Reviva sua jornada de estudos, das anotações mais recentes às primeiras.</p>

            {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

            {isLoading ? (
                <p role="status" className="mt-8 text-sm text-(--muted)">Carregando sua jornada…</p>
            ) : entries.length === 0 ? (
                <section className="mt-8 rounded-2xl border border-dashed border-(--line) bg-(--card) px-6 py-12 text-center">
                    <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-(--purple2) text-2xl text-(--purple)">
                        {error ? "!" : "✦"}
                    </span>
                    <h2 className="mt-4 text-lg font-extrabold">{error ? "Não foi possível abrir sua história" : "Sua história começa aqui"}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-(--muted)">
                        {error
                            ? "Confira sua conexão e tente carregar os registros novamente."
                            : "Adicione fotos e anotações no calendário para guardar os momentos importantes da sua preparação."}
                    </p>
                    {error && (
                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setIsLoading(true);
                                setLoadKey((current) => current + 1);
                            }}
                            className="mt-4 rounded-xl bg-(--purple) px-4 py-2.5 text-sm font-bold text-white"
                        >
                            Tentar novamente
                        </button>
                    )}
                </section>
            ) : (
                <div className="relative mt-8 space-y-6 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-(--line) sm:before:left-[23px]">
                    {entries.map((entry) => {
                        const images = entry.attachments.filter((attachment) => attachment.contentType?.startsWith("image/"));
                        const otherFiles = entry.attachments.filter((attachment) => !attachment.contentType?.startsWith("image/"));
                        return (
                            <article key={entry.date} className="relative pl-11 sm:pl-14">
                                <span aria-hidden="true" className="absolute left-2 top-5 grid h-6 w-6 place-items-center rounded-full border-4 border-(--bg) bg-(--purple) text-[9px] text-white sm:left-3">
                                    ✦
                                </span>
                                <div className="rounded-2xl border border-(--line) bg-(--card) p-4 shadow-sm sm:p-6">
                                    <time dateTime={entry.date} className="text-sm font-extrabold capitalize text-(--purple)">
                                        {formatEntryDate(entry.date)}
                                    </time>
                                    {entry.notes.length > 0 && (
                                        <ul className={`${images.length || otherFiles.length ? "mt-4" : "mt-3"} space-y-2`}>
                                            {entry.notes.map((note, index) => (
                                                <li key={`${entry.date}-note-${index}`} className="flex gap-3 text-sm leading-6 text-(--ink)">
                                                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--purple)" />
                                                    <span className="whitespace-pre-wrap">{note}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {images.length > 0 && (
                                        <div className={`grid gap-3 sm:grid-cols-2 ${entry.notes.length ? "mt-4" : "mt-3"}`}>
                                            {images.map((image) => <TimelinePhoto key={image.id} attachment={image} />)}
                                        </div>
                                    )}
                                    {otherFiles.length > 0 && (
                                        <ul className="mt-3 flex flex-wrap gap-2">
                                            {otherFiles.map((file) => (
                                                <li key={file.id} className="rounded-lg bg-(--bg) px-3 py-2 text-xs font-semibold text-(--muted)">
                                                    ▤ {file.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                    {hasMore && (
                        <div className="relative pl-11 sm:pl-14">
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="rounded-xl border border-(--line) bg-(--card) px-4 py-2.5 text-sm font-bold text-(--purple) transition hover:bg-(--purple2) disabled:cursor-wait disabled:opacity-60"
                            >
                                {isLoadingMore ? "Carregando…" : "Ver registros anteriores"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
