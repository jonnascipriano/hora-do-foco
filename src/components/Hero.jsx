import Button from "./Button"

const studyBars = ["32%", "58%", "43%", "78%", "62%", "91%", "68%"]

const features = [
    {
        icon: "◷",
        title: "Pomodoro inteligente",
        description:
            "Ciclos de 25 minutos de foco e 5 minutos de pausa. Cada sessão concluída soma automaticamente ao seu histórico.",
    },
    {
        icon: "◷",
        title: "Dashboard de desempenho",
        description:
            "Visualize horas e porcentagens por disciplina em um gráfico, acompanhe totais e descubra onde está investindo seu tempo.",
    },
    {
        icon: "▦",
        title: "Diário de estudos",
        description:
            "Escolha qualquer dia até hoje, registre anotações e guarde PDFs, fotos e outros arquivos importantes.",
    },
    {
        icon: '◷',
        title: 'Contador livre',
        description:
            "Função que começa contabilizar as horas estudadas a partir de um clique.",
    }
]

export default function Hero(){
    return (
        <>
            <section className="mx-auto grid max-w-5xl items-center gap-12 py-12 md:grid-cols-2 md:gap-16 md:py-16">
                <div>
                    <span className="inline-flex rounded-full bg-(--purple2) px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-(--purple)">
                        ✦ Sua rotina, seu objetivo
                    </span>
                    <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-(--ink) sm:text-5xl">
                        Estude com foco.
                        <span className="block text-(--purple)">
                            Acompanhe sua evolução.
                        </span>
                    </h1>
                    <p className="mt-4 max-w-lg text-sm leading-6 text-(--muted) sm:text-base">
                        Organize suas matérias, mantenha a consistência com Pomodoro e veja cada hora de dedicação virar progresso rumo à aprovação.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button className="bg-(--purple) text-sm font-bold text-white shadow-lg shadow-purple-200 hover:-translate-y-0.5">
                            Acessar minha área →
                        </Button>
                        <Button className="border border-(--line) bg-white text-sm font-bold text-(--ink) hover:bg-(--purple2)">
                            Conhecer recursos
                        </Button>
                    </div>
                    <p className="mt-3 text-[11px] text-(--muted)">
                        ✦ Um espaço único para sua preparação.
                    </p>
                </div>

                <div className="rounded-3xl border border-white bg-white rotate-3 p-4 shadow-[0_24px_60px_rgba(28,35,67,0.12)] sm:p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-extrabold text-(--ink)">Visão geral</h2>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-(--muted)">
                            Prévia do painel
                        </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-(--line) bg-(--bg) p-3">
                            <p className="text-[10px] text-(--muted)">Horas estudadas</p>
                            <p className="mt-1 text-xl font-bold text-(--ink)">42h 30min</p>
                        </div>
                        <div className="rounded-xl border border-(--line) bg-(--bg) p-3">
                            <p className="text-[10px] text-(--muted)">Nível atual</p>
                            <p className="mt-1 text-xl font-bold text-(--ink)">04 ↑</p>
                        </div>
                    </div>

                    <div className="mt-2 rounded-xl border border-(--line) bg-(--bg) p-3">
                        <p className="text-[10px] text-(--muted)">Ritmo de estudos</p>
                        <div className="mt-3 flex h-20 items-end gap-1.5 sm:gap-2">
                            {studyBars.map((height, index) => (
                                <div
                                    key={index}
                                    className={`flex-1 rounded-t-md ${index % 2 === 0 ? "bg-violet-300" : "bg-violet-500"}`}
                                    style={{ height }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-2 rounded-xl bg-(--bg) p-3">
                        <div className="flex justify-between text-[10px] font-bold text-(--ink)">
                            <span>Meta de evolução</span>
                            <span>68%</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-violet-100">
                            <div className="h-full w-[68%] rounded-full bg-(--purple)" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-5xl pb-14 pt-2 sm:pb-16">
                <div className="text-center">
                    <h2 className="text-2xl font-extrabold tracking-tight text-(--ink)">
                        Tudo o que você precisa para evoluir
                    </h2>
                    <p className="mt-3 text-xs leading-5 text-(--muted) sm:text-sm">
                        Ferramentas simples para transformar intenção em constância.
                    </p>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-4">
                    {features.map((feature) => (
                        <article
                            key={feature.title}
                            className="rounded-2xl border border-(--line) bg-white p-4"
                        >
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-(--purple2) text-sm text-(--purple)">
                                {feature.icon}
                            </span>
                            <h3 className="mt-3 text-sm font-bold text-(--ink)">
                                {feature.title}
                            </h3>
                            <p className="mt-1 text-xs leading-[1.55] text-(--muted)">
                                {feature.description}
                            </p>
                        </article>
                    ))}
                </div>
            </section>
        </>
    )
}