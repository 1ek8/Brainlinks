import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 403 && localStorage.getItem("token")) {
            localStorage.removeItem("token");
            if (window.location.pathname !== "/signin") {
                window.location.assign("/signin");
            }
        }
        return Promise.reject(error);
    }
);

createRoot(document.getElementById('root')!).render(
    <App />
)
