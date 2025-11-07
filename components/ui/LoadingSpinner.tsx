import StaticHeader from "../layout/StaticHeader";
import Footer from "../footer/Footer";

interface LoadingSpinnerProps {
    message?: string;
    fullPage?: boolean;
    showHeaderFooter?: boolean;
}

export default function LoadingSpinner({
    message = "Loading...",
    fullPage = true,
    showHeaderFooter = true
}: LoadingSpinnerProps) {
    const spinner = (
        <div className={`${fullPage ? 'min-h-screen' : 'min-h-[400px]'} bg-[#F7F7F7] flex items-center justify-center`}>
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a3b2e]"></div>
                <p className="mt-4 text-gray-600">{message}</p>
            </div>
        </div>
    );

    if (showHeaderFooter) {
        return (
            <>
                <StaticHeader />
                {spinner}
                <Footer />
            </>
        );
    }

    return spinner;
}
