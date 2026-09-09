import { useNavigate } from "react-router-dom";
import { BrainLinksIcon } from "../../icons/BrainLinksIcon";
import { TwitterIcon } from "../../icons/TwitterIcon";
import { YoutubeIcon } from "../../icons/YoutubeIcon";
import { SideBarItem } from "./SidebarItem";

interface SidebarProps {
    activeType: string | null;
    onSelectType: (type: string | null) => void;
}

const AllIcon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-11V7.5M12 12m-5.25 4.5L12 12" /></svg>;

const TextIcon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>;

export function Sidebar({activeType, onSelectType}: SidebarProps) {
    const navigate = useNavigate();

    function logout() {
        localStorage.removeItem("token");
        navigate("/signin");
    }

    return <div className="h-screen w-60 border-r-3 border-purple-100 bg-white fixed left-0 top-0 p-2 pt-4 flex flex-col">
        <div className="text-3xl flex items-center pb-4 ml-3 my-4">Brainlinks    {<BrainLinksIcon/>} </div>

        <SideBarItem icon = {AllIcon} text = "All" active={activeType === null} onClick={() => onSelectType(null)} />
        <SideBarItem icon = {<TwitterIcon />} text = "Twitter" active={activeType === "twitter"} onClick={() => onSelectType("twitter")} />
        <SideBarItem icon = {<YoutubeIcon/>} text = "Youtube" active={activeType === "youtube"} onClick={() => onSelectType("youtube")} />
        <SideBarItem icon = {TextIcon} text = "Text" active={activeType === "text"} onClick={() => onSelectType("text")} />

        <div className="mt-auto">
            <button onClick={logout} className="w-full inline-flex p-2 items-center justify-center text-[17px] font-[420] my-1 ml-2 text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m-3 0 3-3m0 0-3-3m3 3H3" /></svg>
                Logout
            </button>
        </div>
    </div>

}