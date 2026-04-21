import { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../config";

export function SearchBar({ onOpenChat }: { onOpenChat: (query: string) => void}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 3) {
                setResults([]);
                return;
            }
            try {
                const res = await axios.get(`${BACKEND_URL}/api/v1/content/search?q=${query}`, {
                    headers: { "Authorization": localStorage.getItem("token") }
                });
                setResults(res.data.content || []);
                setIsOpen(true);
            } catch (e) {
                console.error("Search failed");
            }
        };

        const timeoutId = setTimeout(fetchResults, 400); // Debounce
        return () => clearTimeout(timeoutId);
    }, [query]);

    return (
        <div className="relative w-full max-w-lg">
            <input 
                type="text" 
                placeholder="Ask your brain..." 
                className="w-full px-4 py-2 border rounded-md"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                onFocus={() => { if(results.length > 0) setIsOpen(true) }}
            />
            
            {isOpen && query.length >= 3 && (
                <div className="absolute top-full mt-1 w-full bg-white border shadow-lg rounded-md z-50 overflow-hidden">
                    <div 
                        className="p-3 border-b text-sm text-purple-600 font-medium cursor-pointer hover:bg-purple-50 flex items-center gap-2"
                        onClick={() => {
                            onOpenChat(query);
                            setIsOpen(false);
                        }}
                    >
                        ✨ Answer using LLM
                    </div>
                    {results.length > 0 ? results.map(item => (
                        <div key={item._id} className="p-3 border-b hover:bg-gray-50 cursor-pointer">
                            <p className="font-medium text-sm">{item.title}</p>
                            <span className="text-xs text-gray-400">{item.type}</span>
                        </div>
                    )) : (
                        <div className="p-3 text-sm text-gray-500">No results found in brain</div>
                    )}
                </div>
            )}
        </div>
    );
}