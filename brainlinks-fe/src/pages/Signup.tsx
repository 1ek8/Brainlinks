import { Input } from "../components/ui/InputBox"
import { Button } from "../components/ui/Button"
import axios from "axios";
import { useRef } from 'react'
import { BACKEND_URL } from "../config";
import { useNavigate } from "react-router-dom";


export function Signup() {

    const navigate = useNavigate();

    const usernameRef = useRef<HTMLInputElement>();
    const passwordRef = useRef<HTMLInputElement>();

    async function signup() {
        const username = usernameRef.current?.value;
        const password = passwordRef.current?.value;
        try {
            await axios.post(BACKEND_URL + "/api/v1/signup", {
                username,
                password
            })
            navigate("/signin");
        } catch (error: any) {
            const message = error?.response?.data?.message;
            alert(message || "Signup failed. Please try again.");
        }
}
    
    return <div className="h-screen w-screen bg-gray-200 flex items-center justify-center">
        <div className=" bg-white border border-purple-300 p-6 rounded-2xl min-w-48">
            <div>
                <Input reference = {usernameRef} placeholder="Username" />
                <Input reference = {passwordRef} placeholder="Password" />
            </div>
            <div className="flex justify-center mt-2">
                <Button onClick={signup} size="md" fullWidth = {true} variant="primary" text="Signup" loading={false} />
            </div>
        </div>
    </div>
}