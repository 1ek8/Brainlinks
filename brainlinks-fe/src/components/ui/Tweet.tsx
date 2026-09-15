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

let widgetScriptPromise: Promise<void> | null = null;

// Loads Twitter's widgets.js exactly once, on the first tweet card that mounts,
// and resolves only when twttr.widgets is ready to render. widgets.js is loaded
// async in the HTML, so a naive "if (window.twttr)" check on mount races it and
// silently renders an empty card. Loading lazily also avoids the third-party
// request on pages that never display a tweet.
const loadTweetWidgets = (): Promise<void> => {
    if (window.twttr?.widgets) {
        return Promise.resolve();
    }
    if (widgetScriptPromise) {
        return widgetScriptPromise;
    }

    widgetScriptPromise = new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.async = true;
        script.src = "https://platform.twitter.com/widgets.js";
        script.onload = () => {
            // The onload handler can fire a tick before twttr.widgets is
            // actually populated, so poll briefly and then give up quietly.
            const pollReady = (tries = 20) => {
                if (window.twttr?.widgets) {
                    resolve();
                } else if (tries > 0) {
                    setTimeout(() => pollReady(tries - 1), 250);
                } else {
                    resolve();
                }
            };
            pollReady();
        };
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });

    return widgetScriptPromise;
};

const EmbeddedTweet = (props: TweetProps) => {
    const tweetContainerRef = useRef<HTMLDivElement>(null);

    // Strip trailing query/fragment junk ("?t=...&s=...") that copied X links
    // carry, so the ID passed to createTweet is the bare numeric status ID.
    const tweetID = props.link.split("/").pop()?.split(/[?#]/)[0] ?? "";
    const isValidTweetId = /^\d+$/.test(tweetID);

    useEffect(() => {
        // The embed must never be written after the card unmounts or once the
        // link changed — a late script resolve would otherwise target a stale
        // (or removed) container.
        let cancelled = false;

        if (!isValidTweetId) return;

        if (tweetContainerRef.current) {
            tweetContainerRef.current.innerHTML = ""; //remove previous embeds
        }

        loadTweetWidgets().then(() => {
            if (cancelled || !tweetContainerRef.current) return;
            window.twttr?.widgets?.createTweet(tweetID, tweetContainerRef.current);
        });

        return () => {
            cancelled = true;
        };
    }, [tweetID, isValidTweetId]);

    return <div ref={tweetContainerRef}></div>;
};

export default EmbeddedTweet;