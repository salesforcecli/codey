import SessionList from "./components/SessionList";

export default function Home() {
  return (
    <div className="min-h-screen w-full p-6 flex justify-center">
      <main className="w-full max-w-4xl flex flex-col gap-8">
        <h1 className="text-2xl font-semibold">Codey Sessions</h1>
        <SessionList />
      </main>
    </div>
  );
}
