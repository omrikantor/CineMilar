import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import {
  ArrowRightIcon,
  FilmIcon,
  HeartIcon,
  MessageIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ThumbUpIcon,
} from "@/components/Icons";

const STEPS = [
  {
    icon: FilmIcon,
    title: "Pick something you loved",
    body: "Search any movie or TV series. We pull the real title straight from TMDB.",
  },
  {
    icon: MessageIcon,
    title: "Tell us why you loved it",
    body: "The slow-burn tension, a character, a twist - the detail is what makes the match.",
  },
  {
    icon: SparklesIcon,
    title: "Get picks that make sense",
    body: "Six ranked recommendations, each with a reason that connects back to what you said.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: "Always real titles",
    body: "Every suggestion is checked against TMDB before you see it. Nothing is invented.",
  },
  {
    icon: SparklesIcon,
    title: "Explained, not just listed",
    body: "Each pick comes with a short reason tied to your own words, not a generic synopsis.",
  },
  {
    icon: HeartIcon,
    title: "Remembers your taste",
    body: "Like or pass on any pick. Your history and saved list are one click away.",
  },
];

const EXAMPLE_PICKS = [
  {
    title: "Arrival",
    year: "2016",
    tone: "from-[#1d4350] to-[#c9803c]",
    why: "Like the film you loved, it rests on real scientific ideas and anchors a cosmic story in an intimate parent-and-child bond.",
  },
  {
    title: "Contact",
    year: "1997",
    tone: "from-[#3a1620] to-[#d9a441]",
    why: "It treats first contact as a question of evidence versus faith, with a deeply personal stake in the answer.",
  },
];

// Abstract "frames" for the film strip: teal-and-orange, sepia and velvet
// grades, the colours of a cinematic colour grade. Purely decorative.
const FRAME_GRADES = [
  "linear-gradient(135deg,#1d4350,#c9803c)",
  "linear-gradient(160deg,#3a1620,#a8503a)",
  "linear-gradient(135deg,#0f2a35,#4a8a96)",
  "linear-gradient(150deg,#3b2a12,#d9a441)",
  "linear-gradient(135deg,#2a1320,#8a2f45)",
  "linear-gradient(160deg,#13303a,#d98f4e)",
  "linear-gradient(135deg,#241a10,#7d6338)",
  "linear-gradient(150deg,#1b2a2e,#b5703a)",
];

function FilmStrip() {
  // Rendered twice so the looping animation (-50%) is seamless.
  const frames = [...FRAME_GRADES, ...FRAME_GRADES];
  return (
    <div className="film-strip" aria-hidden="true">
      <div className="film-strip-holes" />
      <div className="py-1.5">
        <div className="film-strip-track">
          {frames.map((grade, i) => (
            <div key={i} className="film-frame" style={{ background: grade }} />
          ))}
        </div>
      </div>
      <div className="film-strip-holes" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="projector-beam" aria-hidden="true" />

      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Link href="/login" className="btn-ghost">
          Log in
        </Link>
      </header>

      <main className="relative flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="animate-fade-up">
            <span className="badge badge-accent mb-6">
              <SparklesIcon className="h-3.5 w-3.5" />
              Movies &amp; TV, grounded in real data
            </span>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
              Your next favourite watch,{" "}
              <span className="text-gradient">explained.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Tell us a movie or TV series you loved - and why - and get real,
              explained recommendations for what to watch next.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn-primary px-6 py-3 text-base">
                Get started
                <ArrowRightIcon />
              </Link>
              <a href="#how-it-works" className="btn-secondary px-6 py-3 text-base">
                See how it works
              </a>
            </div>
          </div>

          {/* Static example of a result, so the value is clear before signing up. */}
          <div
            className="animate-fade-up relative mx-auto w-full max-w-md [animation-delay:120ms]"
            role="group"
            aria-label="Example recommendation"
          >
            <div
              className="bg-brand-gradient absolute -inset-6 -z-10 rounded-[2rem] opacity-15 blur-3xl"
              aria-hidden="true"
            />
            <div className="card animate-float p-5 [--tilt:-1deg]">
              <p className="eyebrow">Example</p>
              <p className="mt-1 text-sm text-muted">Because you liked</p>
              <p className="text-xl font-semibold tracking-tight">Interstellar</p>

              <ul className="mt-5 flex flex-col gap-4">
                {EXAMPLE_PICKS.map((pick, index) => (
                  <li
                    key={pick.title}
                    className="flex gap-3.5 rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div
                      className={`relative flex h-[84px] w-14 shrink-0 items-end rounded-lg bg-gradient-to-br ${pick.tone} p-1.5 ring-1 ring-black/5`}
                      aria-hidden="true"
                    >
                      <span className="text-xs font-bold text-white/90">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {pick.title}{" "}
                        <span className="font-normal text-muted">
                          ({pick.year})
                        </span>
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-muted">
                        {pick.why}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                        <ThumbUpIcon className="h-3.5 w-3.5" />
                        Matches what you said
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <FilmStrip />

        {/* How it works */}
        <section id="how-it-works" className="bg-surface/50 py-20">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              From &ldquo;I loved it&rdquo; to &ldquo;what&rsquo;s next&rdquo; in three steps
            </h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="card card-interactive">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-muted">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why it's different */}
        <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Why CineMilar</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Recommendations you can actually trust
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-accent shadow-card">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
          <div className="curtain overflow-hidden rounded-3xl border border-accent/30 px-6 py-16 text-center shadow-lift sm:px-12">
            <p className="eyebrow">Now showing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ready for something worth watching?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-foreground/80">
              It takes under a minute, and it&apos;s free.
            </p>
            <Link href="/login" className="btn-primary mt-9 px-7 py-3 text-base">
              Create your free account
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
