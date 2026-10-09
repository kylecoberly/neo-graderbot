import { notFound } from "next/navigation";
import { loadCorpus } from "@/lib/data";
import { Prose } from "@/components/ui";
import { TOPICS } from "@/lib/topics";

const LESSONS = new Set(Object.values(TOPICS).flatMap((t) => t.lessons));

export default async function Lesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LESSONS.has(slug)) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="eyebrow">Lesson</p>
      <h1 className="text-3xl">{slug}</h1>
      <Prose text={loadCorpus()[slug]} className="mt-6 text-[15px] leading-relaxed" />
    </main>
  );
}
