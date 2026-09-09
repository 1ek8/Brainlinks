import { LegacyRef } from "react";

interface InputProps {
    placeholder: string;
    reference: LegacyRef<HTMLInputElement>;
}

export function Input ({reference, placeholder}: InputProps) {
    return <div>
        <input ref={reference} placeholder={placeholder} type = {"text"} className="px-4 py-2 border-1 m-2 rounded" >
        </input>
    </div>
}