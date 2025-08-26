import Chat from "@/app/components/chat/Chat";

export default function SessionChatPage() {
  return (
    <div className="min-h-screen w-full p-6 flex justify-center">
      <main className="w-full max-w-3xl flex flex-col gap-6">
        <Chat />
      </main>
    </div>
  );
}


