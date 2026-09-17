import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../config";
import { CrossIcon } from "../../icons/CrossIcon"; // Adjust path if needed

interface ChatModalProps {
    query: string;
    onClose: () => void;
}

export function ChatModal({ query, onClose }: ChatModalProps) {
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(true);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        const fetchAnswer = async () => {
            // Reset so a reused/requeried modal never flashes the previous answer.
            setAnswer("");
            setLoading(true);
            setElapsed(0);
            try {
                const res = await axios.post(`${BACKEND_URL}/api/v1/chat`, { query }, {
                    headers: { "Authorization": localStorage.getItem("token") },
                    signal: controller.signal
                });
                setAnswer(res.data.answer);
            } catch (e) {
                if (axios.isCancel(e)) return;// closed mid-request: safe to ignore
                // Surface the backend's own message (e.g. 429 "Too many chat
                // requests…") instead of hiding it behind a generic error.
                const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
                setAnswer(msg || "Failed to fetch answer. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        const elapsedTimer = setInterval(() => setElapsed(s => s + 1), 1000);
        fetchAnswer();

        // Abort the in-flight LLM round-trip when the modal closes or the query
        // changes, so we don't setState on an unmounted component.
        return () => {
            clearInterval(elapsedTimer);
            controller.abort();
        };
    }, [query]);

    return (
        <div className="w-screen h-screen bg-black/70 fixed top-0 left-0 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="relative bg-white w-full max-w-2xl h-[500px] max-h-[80vh] rounded-xl p-6 flex flex-col shadow-2xl m-4">
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h2 className="text-xl font-semibold text-purple-600">✨ Ask your Brain</h2>
                    <div onClick={onClose} className="cursor-pointer p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <CrossIcon />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="bg-purple-50 p-3 rounded-lg mb-6 inline-block text-purple-900 border border-purple-100">
                        <strong>You:</strong> {query}
                    </div>
                    
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {loading ? (
                            <span className="animate-pulse flex flex-col gap-3">
                                <span className="flex items-center gap-2">
                                    <span>Thinking</span>
                                    <span className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></span>
                                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></span>
                                    </span>
                                </span>
                                <span className="text-xs text-gray-400">
                                    Still thinking — the answer can take up to 30s… ({elapsed}s)
                                </span>
                            </span>
                        ) : answer}
                    </div>
                </div>
            </div>
        </div>
    );
}