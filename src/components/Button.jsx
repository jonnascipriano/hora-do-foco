export default function Button({ children, className = "", onClick, type = "button", disabled = false }) {
    return (
        <button 
            type={type} 
            onClick={onClick} 
            disabled={disabled}
            className={`py-2.5 px-4 rounded-lg cursor-pointer duration-200 ${className}`}
        >
            {children}
        </button>
    )
}