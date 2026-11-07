export default function Button({ children, className = "" }) {
    return(
    <button className={`py-2.5 px-4 rounded-lg cursor-pointer duration-200 ${className}`}>
            {children}
        </button>
    )
}