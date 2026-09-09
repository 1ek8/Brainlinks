import { Button } from '../components/ui/Button'

import { PlusIcon } from '../icons/Plusicon'
import { ShareIcon } from '../icons/Shareicon'
import { Card } from '../components/ui/Card'
import { CreateContentModal } from '../components/ui/ContentModal'
import { useState } from 'react'
import { Sidebar } from '../components/ui/Sidebar'
import { useContent } from '../hooks/useContent'
import { SearchBar } from "../components/ui/SearchBar";
import { ChatModal } from "../components/ui/ChatModal";
import { ShareModal } from "../components/ui/ShareModal";
import axios from "axios";
import { BACKEND_URL } from "../config";

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState<string | null>(null);
  const { contents, refresh } = useContent();

  async function deleteContent(id: string) {
    if (!window.confirm("Delete this note?")) return;
    try {
      await axios.delete(BACKEND_URL + "/api/v1/content", {
        data: { contentId: id },
        headers: {
          "Authorization": localStorage.getItem("token")
        }
      });
      refresh();
    } catch (error) {
      console.error("Failed to delete content", error);
    }
  }

  return ( 
    <>
      <Sidebar/>
      <div className='p-3 ml-60 min-h-screen bg-gray-100'>
        <CreateContentModal open = {modalOpen} onClose={() => { setModalOpen(false)}} onAdded={refresh} />

        {chatQuery && (
                    <ChatModal query={chatQuery} onClose={() => setChatQuery(null)} />
                )}

        {shareOpen && <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />}

        <div className="flex justify-between items-center mb-6">
            <SearchBar onOpenChat={(query) => setChatQuery(query)} />
            
            <div className="flex justify-end gap-4">
                <Button onClick={() => setModalOpen(true)} startIcon={<PlusIcon size="md" />} size="md" variant="primary" text="Add Content" />
                <Button onClick={() => setShareOpen(true)} startIcon={<ShareIcon size="md" />} size="md" variant="secondary" text="Share brain" />
            </div>
          </div>

        <div className='flex flex-wrap gap-4'>
          {contents.length === 0 ? (
            <div className="p-4 text-gray-500">No notes yet. Click "Add Content" to get started.</div>
          ) : (
            contents.map(({ _id, type, link, title, textContent }) => <Card
              key={_id}
              title={title}
              type={type}
              link={link}
              textContent={textContent}
              onDelete={() => deleteContent(_id)}
            />)
          )}
        </div>

      </div>
    </>
  )
}

export default Dashboard