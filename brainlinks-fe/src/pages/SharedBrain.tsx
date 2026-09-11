import { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { BACKEND_URL } from "../config";
import { Card } from "../components/ui/Card";
import { BrainLinksIcon } from "../icons/BrainLinksIcon";

interface SharedContentItem {
    _id: string;
    title: string;
    type: "twitter" | "youtube" | "text";
    link?: string;
    textContent?: string;
    tags?: { _id: string; name: string }[];
}

export function SharedBrain() {
    const { hash } = useParams<{ hash: string }>();
    const [username, setUsername] = useState("");
    const [contents, setContents] = useState<SharedContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/brain/${hash}`)
            .then((res) => {
                setUsername(res.data.username);
                setContents(Array.isArray(res.data.content) ? res.data.content : []);
            })
            .catch((e) => {
                setError(e?.response?.data?.message || "This shared brain doesn't exist or has expired.");
            })
            .finally(() => setLoading(false));
    }, [hash]);

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2">
                <span className="text-2xl flex items-center pr-2">Brainlinks {<BrainLinksIcon />}</span>
                {username && <span className="text-sm text-gray-500">· Shared by <strong>{username}</strong></span>}
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="p-4 text-gray-500">Loading shared notes...</div>
                ) : error ? (
                    <div className="p-4 text-red-500">{error}</div>
                ) : contents.length === 0 ? (
                    <div className="p-4 text-gray-500">No notes shared.</div>
                ) : (
                    <div className="flex flex-wrap gap-4">
                        {contents.map(({ _id, type, link, title, textContent, tags }) => (
                            <Card key={_id} title={title} type={type} link={link} textContent={textContent} tags={tags} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SharedBrain;