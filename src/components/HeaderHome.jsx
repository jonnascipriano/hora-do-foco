import Button from "./Button"

export default function HeaderHome(){
    return(
        <header className="flex flex-row flex-wrap justify-between items-center m-auto max-w-6xl h-16 text-sm">
            <div className="font-black p-3 text-xl">
                <span className="bg-(--purple) text-white rounded-xl w-8 h-8 inline-grid place-items-center mr-2">
                    ✓
                </span>
                horado
                <b className="text-(--purple)">foco</b>
            </div>

            <nav className="flex gap-3 font-bold">
                <Button className="text-(--ink) bg-white border-1-(--line)">Entrar</Button>
                <Button className="text-(--line) bg-(--purple)">Começar agora</Button>
            </nav>
        </header>
    )
}