import axios from "axios";
import { useOutsideClick } from "../../hooks/useOnClickOutside";
import { CrossIcon } from "../../icons/CrossIcon";
import { Button } from "./Button";
import { Input } from "./InputBox";

import { useRef, useState, useEffect, useCallback } from "react";
import { BACKEND_URL } from "../../config";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    onAdded?: () => void;
    initial?: Content | null;
}

interface Content {
    _id: string;
    title: string;
    type: "youtube" | "twitter" | "text";
    link?: string;
    textContent?: string;
    tags?: { _id: string; name: string }[];
}

enum ContentType {
    Youtube = "youtube",
    Twitter = "twitter",
    Text = "text"
}

export function CreateContentModal({open, onClose, onAdded, initial = null}: ModalProps) {
    const modalRef = useOutsideClick(onClose);
    const titleRef = useRef<HTMLInputElement>(null);
    const linkRef = useRef<HTMLInputElement>(null);
    const textContentRef = useRef<HTMLTextAreaElement>(null);
    const tagsRef = useRef<HTMLInputElement>(null);

    const [type, setType] = useState(ContentType.Youtube);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const resetForm = useCallback(() => {
        setError("");
        const init = initial;
        if (titleRef.current) titleRef.current.value = init?.title || "";
        if (linkRef.current) linkRef.current.value = init?.link || "";
        if (textContentRef.current) textContentRef.current.value = init?.textContent || "";
        if (tagsRef.current) tagsRef.current.value = init?.tags?.map(t => t.name).join(", ") || "";
        setType((init?.type as ContentType) ?? ContentType.Youtube);
    }, [initial]);

    useEffect(() => {
        if (open) resetForm();
    }, [open, resetForm]);

    function closeModal() {
        setSubmitting(false);
        resetForm();
        onClose();
    }

    async function addContent() {
        setError("");

        const title = titleRef.current?.value?.trim();
        const link = linkRef.current?.value?.trim();
        const textContent = textContentRef.current?.value?.trim();
        // Trim + lowercase + dedupe + cap so "AI, ai" and "react,react" collapse to
// one canonical tag, and a bulked-up tag list can't spawn dozens of DB writes.
const rawTags = (tagsRef.current?.value || "").split(",");
const tags = Array.from(
    new Set(rawTags.map(t => t.trim().toLowerCase()).filter(Boolean))
).slice(0, 5);

        if (!title) {
            setError("Title is required.");
            return;
        }
        if (type === ContentType.Text && !textContent) {
            setError("Please write some content for your note.");
            return;
        }
        if (type !== ContentType.Text && !link) {
            setError("A link is required for this content type.");
            return;
        }

        const payload = {
            title,
            link,
            type,
            textContent,
            tags
        };

        setSubmitting(true);
        try {
            if (initial) {
                await axios.patch(`${BACKEND_URL}/api/v1/content/${initial._id}`, payload, {
                    headers: {
                        "Authorization": localStorage.getItem("token")
                    }
                });
            } else {
                await axios.post(BACKEND_URL + "/api/v1/content", payload, {
                    headers: {
                        "Authorization": localStorage.getItem("token")
                    }
                });
            }
            closeModal();
            onAdded?.();
        } catch (e) {
            console.error("Failed to save content", e);
            const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
            setError(msg || "Failed to save. Please try again.");
            setSubmitting(false);
        }
    }

    function handleTypeChange(nextType: ContentType) {
        setType(nextType);
        setError("");
    }

    return <div>
            {open && <div className="w-screen h-screen bg-black/70 fixed top-0 left-0 flex items-center justify-center backdrop-blur-none">
                    <div ref={modalRef} className="absolute bg-white  p-2 rounded opacity-100">
                        <div className="flex justify-end">
                            <div onClick = {closeModal} className="cursor-pointer">
                                <CrossIcon />
                            </div>
                        </div>
                        <div>
                            <Input reference = {titleRef} placeholder = "Title"/>
                            {type === ContentType.Text ? (
                                <textarea ref={textContentRef} placeholder="Enter your note..." className="w-full p-2 border border-slate-200 rounded m-2" rows={4} />
                            ) : (
                                <Input reference={linkRef} placeholder="Link"/>
                            )}
                        </div>
                        <div className="flex justify-center my-2 gap-3">
                            <Button size = "md" text = "Youtube" variant = {type === ContentType.Youtube ? "primary" : "secondary"} onClick={() => handleTypeChange(ContentType.Youtube)} />
                            <Button size = "md" text = "Twitter" variant = {type === ContentType.Twitter ? "primary" : "secondary"} onClick={() => handleTypeChange(ContentType.Twitter)} />
                            <Button size = "md" text = "Text" variant = {type === ContentType.Text ? "primary" : "secondary"} onClick = {() => handleTypeChange(ContentType.Text)} />
                        </div>
                        <div>
                            <Input reference = {tagsRef} placeholder = "Tags (comma separated)"/>
                        </div>
                        {error && <p className="text-sm text-red-500 text-center px-2">{error}</p>}
                        <div className="flex justify-center p-2">
                            <Button onClick = {addContent} size = "md" text = {initial ? "Update note" : "Submit"} variant = "primary" loading={submitting} />
                        </div>

                    </div>
            </div>}
        </div>

}