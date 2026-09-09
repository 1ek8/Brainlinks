import { PlusIcon } from "../../icons/Plusicon"
import { ShareIcon } from "../../icons/Shareicon"
import { CrossIcon } from "../../icons/CrossIcon"
import EmbeddedTweet from "./Tweet"

interface CardProps {
    id?: string,
    title: string,
    link?   : string,
    type: "twitter" | "youtube" | "text",
    textContent?: string,
    highlighted?: boolean,
    onDelete?: () => void
}

function convertToEmbedUrl (youtubeUrl?: string)  {
    if (!youtubeUrl) return undefined;
    const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|playlist\?list=))([\w-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : undefined;
}


export const Card = ({id, title, link, type, textContent, highlighted, onDelete}: CardProps) => {
    const embedUrl = convertToEmbedUrl(link);

    return <div id={id}> 
        <span className={`p-4 bg-white rounded-md shadow-md border-slate-200 border-1 block max-w-96 min-h-60 min-w-72 transition-shadow ${highlighted ? "ring-2 ring-purple-500 shadow-purple-100" : ""}`}>
            <div className = "flex justify-between">
                
                <div className = "flex items-center">
                    <div className="p-2 text-gray-600"><ShareIcon size = "md" /></div>
                    {title}
                </div>
                <div className = "flex items-center">
                    <div className = "p-2 text-gray-600"><PlusIcon size = "lg"/></div>
                    {onDelete && <div onClick={onDelete} className = "p-2 text-gray-600 hover:text-red-500 cursor-pointer">
                        <CrossIcon />
                    </div>}
                    {link && <div className = "p-2 text-gray-600">
                        <a href = {link} target = "_blank" rel="noreferrer">
                            <ShareIcon size = "md"/>
                        </a> 
                    </div>}
                </div>
            </div>
    
            <div className="pt-2"> 
                {type === "youtube" && (embedUrl ? <iframe width="100%" src={embedUrl} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe> : <p className="text-sm text-gray-500">No valid YouTube link to preview.</p>)}

                {type === "twitter" && (link ? <EmbeddedTweet link = {link} /> : <p className="text-sm text-gray-500">No valid tweet link to preview.</p>)} 
                {type === 'text' && <p className="text-gray-700 whitespace-pre-wrap">{textContent}</p>}
            </div>
        </span>
    </div>
}