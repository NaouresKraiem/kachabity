interface LoadingSpinnerProps {
    message?: string;
    fullPage?: boolean;
}

// The header and footer come from app/[locale]/layout.tsx, so this renders only the spinner.
export default function LoadingSpinner({
    message = "Loading...",
    fullPage = true,
}: LoadingSpinnerProps) {
    return (
        <div className={`${fullPage ? 'min-h-screen' : 'min-h-[400px]'} bg-[#F7F7F7] flex items-center justify-center`}>
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a3b2e]"></div>
                <p className="mt-4 text-gray-600">{message}</p>
            </div>
        </div>
    );
}
