"use client";

import { useState } from "react";

interface NewsletterFormProps {
    title: string;
    subtitle?: string;
    placeholder?: string;
}

export default function NewsletterForm({
    title,
    subtitle,
    placeholder = "Enter your email"
}: NewsletterFormProps) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setStatus("error");
            setMessage("Please enter your email");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setStatus("error");
            setMessage("Please enter a valid email address");
            return;
        }

        setStatus("loading");

        try {
            const response = await fetch('/api/newsletter/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus("success");
                setMessage(data.message || "Thank you for subscribing!");
                setEmail("");

                setTimeout(() => {
                    setStatus("idle");
                    setMessage("");
                }, 5000);
            } else {
                setStatus("error");
                setMessage(data.error || "Something went wrong. Please try again.");
            }
        } catch {
            setStatus("error");
            setMessage("Network error. Please try again.");
        }
    };

    return (
        <div>
            <h3 className="text-lg font-semibold text-[#2b1a16] mb-2">
                {title}
            </h3>
            {subtitle && (
                <p className="text-gray-600 text-sm mb-4">
                    {subtitle}
                </p>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={placeholder}
                    className="placeholder:text-[#96999D80] flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-sm"
                    disabled={status === "loading"}
                />
                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="px-6 py-2.5 bg-[#842E1B] text-white rounded-lg hover:bg-[#6b2516] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {status === "loading" ? "Subscribing..." : "Subscribe"}
                </button>
            </form>
            {message && (
                <p className={`mt-2 text-sm ${status === "success" ? "text-green-600" : "text-red-600"}`}>
                    {message}
                </p>
            )}
        </div>
    );
}