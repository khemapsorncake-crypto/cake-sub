import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center space-y-6">

        <h1 className="text-5xl font-bold">
          🍰 Cake Sub
        </h1>

        <p className="text-zinc-400">
          AI Subtitle Generator
        </p>

        <Link
          href="/upload"
          className="bg-white text-black rounded-xl px-8 py-4 font-semibold"
        >
          เลือกวิดีโอ
        </Link>

      </div>
    </main>
  );
}
