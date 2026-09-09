import { ReactElement } from "react";

interface SideBarItemProps {
    text: string;
    icon: ReactElement;
    active?: boolean;
    onClick?: () => void;
}

export function SideBarItem({text, icon, active, onClick}: SideBarItemProps){
    return <div onClick={onClick} className={`inline-flex p-2 items-center text-[17px] font-[420] my-1 ml-2 cursor-pointer hover:pl-4 ${active ? "text-purple-600 bg-purple-50 pl-4" : "text-gray-700 hover:bg-gray-100"}`}>
        {icon} {text}
    </div> 
}