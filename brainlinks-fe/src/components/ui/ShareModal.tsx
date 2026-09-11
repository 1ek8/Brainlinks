import { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../config";
import { CrossIcon } from "../../icons/CrossIcon";
import { Button } from "./Button";
import { useOutsideClick } from "../../hooks/useOnClickOutside";

interface ShareModalProps {
    open: boolean;
    onClose: () => void;
}

export function ShareModal({ open, onClose }: ShareModalProps) {
    const modalRef = useOutsideClick(onClose);
    const [link, setLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (!open) return;
        setError("");
        setCopied(false);
        setFetching(true);
        axios.get(`${BACKEND_URL}/api/v1/brain/share`, {
            headers: { "Authorization": localStorage.getItem("token") }
        }).then(res => {
            const hash = res.data?.hash;
            setLink(hash ? `${window.location.origin}/brain/${hash}` : null);
        }).catch(() => {
            setLink(null);
        }).finally(() => setFetching(false));
    }, [open]);

    async function enableShare() {
        setLoading(true);
        setError("");
        setCopied(false);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/v1/brain/share`, { share: true }, {
                headers: { "Authorization": localStorage.getItem("token") }
            });
            setLink(`${window.location.origin}/brain/${res.data.hash}`);
        } catch {
            setError("Failed to create share link. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function disableShare() {
        setLoading(true);
        setError("");
        try {
            await axios.post(`${BACKEND_URL}/api/v1/brain/share`, { share: false }, {
                headers: { "Authorization": localStorage.getItem("token") }
            });
            setLink(null);
        } catch {
            setError("Failed to disable sharing. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function copyLink() {
        if (!link) return;
        navigator.clipboard?.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    if (!open) return null;

    return <div className="w-screen h-screen bg-black/70 fixed top-0 left-0 flex items-center justify-center z-50">
        <div ref={modalRef} className="absolute bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h2 className="text-xl font-semibold text-purple-600">Share your Brain</h2>
                <div onClick={onClose} className="cursor-pointer p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <CrossIcon />
                </div>
            </div>

            {fetching ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading share status...</p>
            ) : !link ? (
                <div>
                    <p className="text-sm text-gray-600 mb-4">Share all your saved notes publicly with a single link.</p>
                    {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                    <Button onClick={enableShare} size="md" variant="primary" text="Generate share link" loading={loading} fullWidth />
                </div>
            ) : (
                <div>
                    <p className="text-sm text-gray-600 mb-2">Anyone with this link can view your saved notes:</p>
                    <div className="flex items-center gap-2 mb-4">
                        <input readOnly value={link} className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm bg-gray-50" onFocus={(e) => e.target.select()} />
                        <Button onClick={copyLink} size="md" variant="secondary" text={copied ? "Copied!" : "Copy"} />
                    </div>
                    {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
                    <Button onClick={disableShare} size="md" variant="secondary" text="Disable sharing" loading={loading} />
                </div>
            )}
        </div>
    </div>;
}
