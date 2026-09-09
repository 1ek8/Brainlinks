import { useNavigate } from "react-router-dom";
import { BrainLinksIcon } from "../icons/BrainLinksIcon";
import { Button } from "../components/ui/Button";
import { PlusIcon } from "../icons/Plusicon";
import { ShareIcon } from "../icons/Shareicon";

export function Landing() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white">
            <header className="flex items-center justify-between px-8 py-4 border-b border-purple-100">
                <div className="text-2xl flex items-center gap-2 text-purple-700 font-semibold">
                    Brainlinks <BrainLinksIcon />
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => navigate("/signin")} size="md" variant="secondary" text="Sign in" />
                    <Button onClick={() => navigate("/signup")} size="md" variant="primary" text="Get started" />
                </div>
            </header>

            <main>
                <section className="flex flex-col items-center text-center px-8 py-20 bg-gradient-to-b from-purple-50 to-white">
                    <h1 className="text-5xl font-bold text-gray-900 max-w-3xl leading-tight">
                        Your <span className="text-purple-600">second brain</span>, without the second app.
                    </h1>
                    <p className="mt-6 text-lg text-gray-600 max-w-2xl">
                        Save links, notes, and tweets in one place — then find them instantly with semantic
                        search or just ask your brain a question.
                    </p>
                    <div className="mt-8 flex gap-4">
                        <Button onClick={() => navigate("/signup")} size="lg" variant="primary" text="Create account" startIcon={<PlusIcon size="md" />} />
                        <Button onClick={() => navigate("/signin")} size="lg" variant="secondary" text="Sign in" />
                    </div>
                </section>

                <section className="px-8 py-16 max-w-5xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-xl border border-purple-100 bg-white shadow-sm">
                            <div className="text-purple-700 p-2"><ShareIcon size="lg" /></div>
                            <h3 className="text-lg font-semibold text-gray-900">Semantic search</h3>
                            <p className="mt-2 text-sm text-gray-600">Search your brain in natural language. Embeddings match meaning, not just keywords.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-purple-100 bg-white shadow-sm">
                            <div className="text-purple-700 p-2"><BrainLinksIcon /></div>
                            <h3 className="text-lg font-semibold text-gray-900">Ask your brain</h3>
                            <p className="mt-2 text-sm text-gray-600">An LLM reads your saved content and answers questions about it directly.</p>
                        </div>
                        <div className="p-6 rounded-xl border border-purple-100 bg-white shadow-sm">
                            <div className="text-purple-700 p-2"><ShareIcon size="lg" /></div>
                            <h3 className="text-lg font-semibold text-gray-900">Shareable brain</h3>
                            <p className="mt-2 text-sm text-gray-600">Share a link to your collection — no login needed for people you share with.</p>
                        </div>
                    </div>
                </section>

                <footer className="py-8 text-center text-sm text-gray-400 border-t border-purple-100">
                    Brainlinks — a personal knowledge base with AI built in.
                </footer>
            </main>
        </div>
    );
}