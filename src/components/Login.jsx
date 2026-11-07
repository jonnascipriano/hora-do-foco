import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, googleProvider } from "../firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";
import Button from "./Button";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email.trim(), password);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
            navigate("/dashboard");
        } catch (err) {
            switch (err.code) {
                case "auth/invalid-credential":
                    setError("E-mail ou senha incorretos.");
                    break;
                case "auth/invalid-email":
                    setError("Informe um endereço de e-mail válido.");
                    break;
                case "auth/email-already-in-use":
                    setError("Este e-mail já está cadastrado.");
                    break;
                case "auth/weak-password":
                    setError("A senha deve ter pelo menos 6 caracteres.");
                    break;
                case "auth/operation-not-allowed":
                    setError("O cadastro por e-mail e senha não está habilitado no Firebase.");
                    break;
                case "auth/too-many-requests":
                    setError("Muitas tentativas. Aguarde um pouco e tente novamente.");
                    break;
                case "auth/network-request-failed":
                    setError("Falha de conexão. Verifique sua internet e tente novamente.");
                    break;
                default:
                    setError("Não foi possível concluir a operação. Tente novamente.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleAuth = async () => {
        setError("");
        setIsSubmitting(true);

        try {
            await signInWithPopup(auth, googleProvider);
            navigate("/dashboard");
        } catch (err) {
            switch (err.code) {
                case "auth/popup-closed-by-user":
                    setError("A janela do Google foi fechada antes de concluir o login.");
                    break;
                case "auth/popup-blocked":
                    setError("O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.");
                    break;
                case "auth/unauthorized-domain":
                    setError("Este domínio não está autorizado no Firebase Authentication.");
                    break;
                case "auth/account-exists-with-different-credential":
                    setError("Já existe uma conta com este e-mail. Entre usando o método cadastrado.");
                    break;
                case "auth/operation-not-allowed":
                    setError("O login com Google não está habilitado no Firebase.");
                    break;
                case "auth/network-request-failed":
                    setError("Falha de conexão. Verifique sua internet e tente novamente.");
                    break;
                default:
                    setError("Não foi possível entrar com Google. Tente novamente.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-purple-50 to-blue-50">
            <div className="w-full max-w-[430px] bg-white border border-(--line) rounded-2xl p-8 shadow-[0_12px_35px_rgba(28,35,67,0.07)]">
                
                <div className="font-black text-xl mb-6 flex items-center">
                    <span className="bg-(--purple) text-white rounded-xl w-8 h-8 inline-grid place-items-center mr-2">✓</span>
                    horado<b className="text-(--purple)">foco</b>
                </div>

                <h2 className="text-[27px] font-extrabold mt-6 mb-1.5 text-(--ink)">
                    {isRegistering ? "Crie sua conta" : "Bem-vindo de volta!"}
                </h2>
                <p className="text-(--muted) mb-6 text-sm">
                    {isRegistering ? "Comece a rastrear sua evolução agora." : "Entre para continuar sua jornada de estudos."}
                </p>

                <form onSubmit={handleAuth} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-(--ink)" htmlFor="email">E-mail</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="voce@email.com"
                            required
                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-(--purple) focus:ring-3 focus:ring-purple-500/10"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-(--ink)" htmlFor="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={isRegistering ? "Mínimo de 6 caracteres" : "Sua senha"}
                            required
                            minLength="6"
                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-(--purple) focus:ring-3 focus:ring-purple-500/10"
                        />
                    </div>

                    {error && <p role="alert" className="text-red-500 text-sm font-bold">{error}</p>}

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 bg-(--purple) text-white font-bold py-3 shadow-lg shadow-purple-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting
                            ? "Aguarde..."
                            : isRegistering
                              ? "Criar conta e acessar"
                              : "Entrar na minha conta"}
                    </Button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-(--muted)">
                    <span className="h-px flex-1 bg-(--line)" />
                    ou continue com
                    <span className="h-px flex-1 bg-(--line)" />
                </div>
                <Button
                    onClick={handleGoogleAuth}
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 border border-(--line) bg-white font-bold text-(--ink) hover:bg-(--bg) disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <span aria-hidden="true" className="text-base font-black text-blue-600">G</span>
                    Continuar com Google
                </Button>

                <div className="text-center text-sm text-(--muted) mt-6 border-t border-(--line) pt-5">
                    {isRegistering ? "Já tem uma conta?" : "Ainda não tem uma conta?"}
                    <button 
                        type="button"
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError("");
                        }} 
                        className="text-(--purple) font-bold hover:underline ml-1"
                    >
                        {isRegistering ? "Faça login" : "Crie uma agora"}
                    </button>
                </div>
                
                <div className="text-center mt-4">
                    <Link to="/" className="text-xs text-gray-400 hover:underline">
                        Voltar ao início
                    </Link>
                </div>
            </div>
        </div>
    );
}