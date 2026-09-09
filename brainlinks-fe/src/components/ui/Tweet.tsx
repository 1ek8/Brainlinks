import { useEffect, useRef } from "react";

interface TweetProps{
    link: string;
}

interface TwttrWidgets {
    createTweet: (id: string, container: HTMLElement) => void;
}

interface Twttr {
    widgets?: TwttrWidgets;
}

declare global {
    interface Window {
        twttr?: Twttr;
    }
}

const EmbeddedTweet = (props: TweetProps) => {
    const tweetContainerRef = useRef<HTMLDivElement>(null);
    
    const parts = props.link.split("/");
    const tweetID = parts[parts.length - 1];

    useEffect(() => {
        if (window.twttr?.widgets && tweetContainerRef.current) {
            tweetContainerRef.current.innerHTML = ""; //remove previous embeds

            window.twttr.widgets.createTweet(tweetID, tweetContainerRef.current);
        }
    }, [tweetID]);

    return <div ref={tweetContainerRef}></div>;
};

export default EmbeddedTweet;