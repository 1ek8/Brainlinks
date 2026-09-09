import { useState } from "react";
import { useEffect } from "react";
import { BACKEND_URL } from "../config";
import axios from "axios";

export function useContent() {
    const [contents, setContents] = useState([]);
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