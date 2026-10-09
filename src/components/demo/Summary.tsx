import { SPOT_CHECK, formatDuration, speedText } from "@/lib/demo/efficiency";
import { WHO, type Summary as SummaryData } from "@/lib/demo/results";

const tallyText = (t: Record<string, number>) =>
  Object.entries(t)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${WHO[k] ?? k} ${n}`)
    .join(", ");

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-paper px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

export function Summary({ summary, judgeSummary, pending }: { summary: SummaryData; judgeSummary: string | null; pending: number }) {
  const { efficiency: e, speed, agreement, richness, keyMatch, judgeTally } = summary;
  const answers = Object.keys(summary.rows).length;
  return (
    <section className="card">
      {speed ? (
        <h2 className="text-2xl" title="GraderBot's mean time per answer, one at a time; stored results don't count.">
          {speedText(speed)}
        </h2>
      ) : (
        <h2 className="text-2xl text-muted">{`Waiting for GraderBot on ${pending} answer${pending === 1 ? "" : "s"}…`}</h2>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {agreement.compared > 0 && <Tile label="Agreed" value={`${agreement.agree} of ${agreement.compared}`} detail={`You and GraderBot agreed on ${agreement.agree} of ${agreement.compared} verdicts`} />}
        {e && (
          <Tile
            label="Your time"
            value={`${formatDuration(e.byHandMs)} → ${formatDuration(e.withAgentMs)}`}
            detail={`by hand, then with GraderBot: read the ${e.deferred} it flagged and spot-check ${SPOT_CHECK * 100}% of the ${e.recorded} it filed`}
          />
        )}
        {agreement.compared > 0 && (
          <Tile label="Feedback richness" value={`${richness.visitor} vs ${richness.agent}`} detail={`you vs GraderBot, out of ${4 * answers}`} />
        )}
        {keyMatch && <Tile label="Answer key" value={`${keyMatch.agree} of ${keyMatch.compared}`} detail={`GraderBot matched the intended verdict on ${keyMatch.agree} of ${keyMatch.compared}`} />}
        {judgeTally && (
          <Tile label="Judge" value={tallyText(judgeTally.verdict)} detail={`better verdict; better note ${tallyText(judgeTally.note)}`} />
        )}
      </div>
      {judgeSummary && <p className="mt-4 font-display text-lg italic leading-snug">{judgeSummary}</p>}
      <p className="mt-3 text-xs text-muted">
        {keyMatch && "The intended verdicts are what the generator meant to write: a model's intention, not ground truth. "}
        {judgeTally && "The judge is another model. It reads the same lesson GraderBot did, and nobody has checked it against human graders for this comparison."}
      </p>
    </section>
  );
}
