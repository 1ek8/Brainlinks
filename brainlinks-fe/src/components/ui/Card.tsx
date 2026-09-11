import { ShareIcon } from "../../icons/Shareicon"
import { CrossIcon } from "../../icons/CrossIcon"
import { EditIcon } from "../../icons/EditIcon"
import EmbeddedTweet from "./Tweet"

interface CardProps {
    id?: string,
    title: string,
    link?   : string,
    type: "twitter" | "youtube" | "text",
    textContent?: string,
    tags?: { _id: string; name: string }[],
    highlighted?: boolean,
    onDelete?: () => void,
    onEdit?: () => void
}

function convertToEmbedUrl (youtubeUrl?: string)  {
    if (!youtubeUrl) return undefined;
    const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|playlist\?list=))([\w-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : undefined;
}


export const Card = ({id, title, link, type, textContent, tags, highlighted, onDelete, onEdit}: CardProps) => {
    const embedUrl = convertToEmbedUrl(link);

    return <div id={id}> 
        <span className={`p-4 bg-white rounded-md shadow-md border-slate-200 border-1 block max-w-96 min-h-60 min-w-72 transition-shadow ${highlighted ? "ring-2 ring-purple-500 shadow-purple-100" : ""}`}>
            <div className = "flex justify-between">
                <div className = "flex items-center font-medium">
                    {title}
                </div>
                <div className = "flex items-center">
                    {onEdit && <div onClick={onEdit} className = "p-2 text-gray-600 hover:text-purple-600 cursor-pointer">
                        <EditIcon />
                    </div>}
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

            {tags && tags.length > 0 && (
                <div className="pt-3 flex flex-wrap gap-1.5">
                    {tags.map(t => (
                        <span key={t._id} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full">{t.name}</span>
                    ))}
                </div>
            )}
        </span>
    </div>
}