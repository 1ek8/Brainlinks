import { LegacyRef } from "react";

interface InputProps {
    placeholder: string;
    reference: LegacyRef<HTMLInputElement>;
    type?: string;
}

export function Input ({reference, placeholder, type = "text"}: InputProps) {
    return <div>
        <input ref={reference} placeholder={placeholder} type = {type} className="px-4 py-2 border-1 m-2 rounded" >
        </input>
    </div>
}