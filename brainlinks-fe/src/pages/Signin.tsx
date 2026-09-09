import { Input } from "../components/ui/InputBox"
import { Button } from "../components/ui/Button"

import { useRef } from "react";
import { BACKEND_URL } from "../config";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export function Signin() {

    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const navigate = useNavigate();

    async function signin() {
        const username = usernameRef.current?.value;
        const password = passwordRef.current?.value;
        try {
            const response = await axios.post(BACKEND_URL + "/api/v1/signin", {
                username,
                password
            })
            const jwt = response.data.token;
            localStorage.setItem("token", jwt)
            navigate("/dashboard");
        } catch (error) {
            const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
            alert(message || "Signin failed. Please try again.");
        }
}


    return <div className="h-screen w-screen bg-gray-200 flex items-center justify-center">
        <div className=" bg-white border border-purple-300 p-6 rounded-2xl min-w-48">
            <div>
            <Input reference = {usernameRef} placeholder="Username" />
            <Input reference = {passwordRef} placeholder="Password" />
            </div>
            <div className="flex justify-center mt-2">
                <Button onClick={signin} size="md" fullWidth = {true} variant="primary" text="Signin" loading={false} />
            </div>
        </div>
    </div>
}