import { Input } from "../components/ui/InputBox"
import { Button } from "../components/ui/Button"
import axios from "axios";
import { useRef, useState } from 'react'
import { BACKEND_URL } from "../config";
import { useNavigate } from "react-router-dom";


export function Signup() {

    const navigate = useNavigate();

    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function signup() {
        const username = usernameRef.current?.value?.trim();
        const password = passwordRef.current?.value;
        const confirm = confirmRef.current?.value;

        setError("");

        if (!username || !password) {
            setError("Username and password are required.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await axios.post(BACKEND_URL + "/api/v1/signup", {
                username,
                password
            })
            navigate("/signin");
        } catch (error) {
            const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
            setError(message || "Signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
}
    
    return <div className="h-screen w-screen bg-gray-200 flex items-center justify-center">
        <div className=" bg-white border border-purple-300 p-6 rounded-2xl min-w-48">
            <div>
                <Input reference = {usernameRef} placeholder="Username" />
                <Input reference = {passwordRef} placeholder="Password" type="password" />
                <Input reference = {confirmRef} placeholder="Confirm password" type="password" />
            </div>
            {error && <p className="text-sm text-red-500 text-center px-2 mt-1">{error}</p>}
            <div className="flex justify-center mt-2">
                <Button onClick={signup} size="md" fullWidth = {true} variant="primary" text="Signup" loading={loading} />
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
                Already have an account? <a href="/signin" className="text-purple-600 hover:underline">Sign in</a>
            </p>
        </div>
    </div>
}