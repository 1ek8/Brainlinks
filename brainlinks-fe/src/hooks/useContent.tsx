import { useState } from "react";
import { useEffect } from "react";
import { BACKEND_URL } from "../config";
import axios from "axios";

export interface Content {
    _id: string;
    title: string;
    type: "twitter" | "youtube" | "text";
    link?: string;
    textContent?: string;
}

export function useContent() {
    const [contents, setContents] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);

    async function refresh() {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/v1/content`, {
                headers: {
                    "Authorization": localStorage.getItem("token")
                }
            });
            setContents(Array.isArray(response.data.content) ? response.data.content : []);
        } catch (error) {
            console.error("Failed to load content", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return { contents, refresh, loading };
}