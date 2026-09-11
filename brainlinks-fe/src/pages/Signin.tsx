import { Input } from "../components/ui/InputBox"
import { Button } from "../components/ui/Button"

import { useRef, useState } from "react";
import { BACKEND_URL } from "../config";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export function Signin() {

    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    async function signin() {
        const username = usernameRef.current?.value?.trim();
        const password = passwordRef.current?.value;

        setError("");

        if (!username || !password) {
            setError("Username and password are required.");
            return;
        }

        setLoading(true);
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
            setError(message || "Signin failed. Please try again.");
        } finally {
            setLoading(false);
        }
}


    return <div className="h-screen w-screen bg-gray-200 flex items-center justify-center">
        <div className=" bg-white border border-purple-300 p-6 rounded-2xl min-w-48">
            <div>
            <Input reference = {usernameRef} placeholder="Username" />
            <Input reference = {passwordRef} placeholder="Password" type="password" />
            </div>
            {error && <p className="text-sm text-red-500 text-center px-2 mt-1">{error}</p>}
            <div className="flex justify-center mt-2">
                <Button onClick={signin} size="md" fullWidth = {true} variant="primary" text="Sign in" loading={loading} />
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
                Don't have an account? <a href="/signup" className="text-purple-600 hover:underline">Sign up</a>
            </p>
        </div>
    </div>
}