import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { DashboardFragment, AddTransactionFragment, BudgetCalculatorFragment, ReportFragment, type FragmentPart } from './fragments';

const HERO_IMAGES = [
  { src: '/img/hero-a.jpg', alt: 'A small red boat floating on clear turquoise water, seen from above', credit: 'Anton Sulsky' },
  { src: '/img/hero-b.jpg', alt: 'A silhouetted pier on a hazy blue lake below faint mountains', credit: 'Paul E. Harrer' },
  { src: '/img/hero-c.jpg', alt: 'Two people paddling a canoe across a misty green lake', credit: 'Matthew Clark' },
];

/** Rises once as it enters; content stays visible without script or with reduced motion. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('reveal', revealed && 'revealed', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Hero() {
  const [imageIndex, setImageIndex] = useState(0);
  const [docked, setDocked] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return; // pause while the tab is hidden
      setImageIndex((current) => (current + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => setDocked(!entries[0]?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const railText = docked ? 'text-ink' : 'text-[#f3f5f7]';

  return (
    <>
      <div ref={heroRef} className="relative h-[100svh]">
        <div className="hero-crossfade absolute inset-0">
          {HERO_IMAGES.map((image, index) => (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              width={2400}
              height={1350}
              fetchPriority={index === 0 ? 'high' : undefined}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms]',
                index === imageIndex ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
        </div>

        {/* The rail on the exact vertical midline, carrying everything on one baseline */}
        <div
          className={cn(
            'absolute inset-x-0 top-[calc(50svh-2rem)] z-50 flex h-16 items-center gap-4 px-5 transition-opacity duration-300 md:px-10',
            railText,
            docked && 'pointer-events-none opacity-0',
          )}
        >
          <h1 className="text-[clamp(32px,3vw,42px)] font-medium leading-none tracking-tight">Smart Finance</h1>
          <p className="ml-3 hidden max-w-[30ch] text-[18px] leading-snug md:block lg:max-w-[44ch]">
            See where your money goes, and where it should.
          </p>
          <nav aria-label="Landing" className={cn('ml-auto hidden items-center gap-6 text-[15px] lg:flex')}>
            <a href="#features" className="hover:underline">
              Features
            </a>
            <a href="#how" className="hover:underline">
              How it works
            </a>
            <a href="#faq" className="hover:underline">
              FAQ
            </a>
            <Link to="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
          <Link to="/login" className="ml-auto text-[15px] text-[#f3f5f7] hover:underline md:hidden">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="hidden h-9 items-center rounded-[10px] bg-[#f3f5f7] px-4 text-[15px] font-medium text-ink transition-colors hover:bg-white md:inline-flex"
          >
            Create free account
          </Link>
        </div>

        {/* The docked header: takes the page ground once the pictures have passed */}
        <header
          className={cn(
            'fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-4 px-5 transition-all duration-300 md:px-10',
            docked ? 'translate-y-0 border-b border-line bg-ground text-ink opacity-100' : 'pointer-events-none -translate-y-full text-ink opacity-0', // taste-skill-ignore: docked sticky header is real navigation chrome
          )}
        >
          <h2 className="text-[21px] font-medium leading-none tracking-tight">Smart Finance</h2>
          <p className="ml-3 hidden max-w-[44ch] text-[16px] leading-snug lg:block">
            See where your money goes, and where it should.
          </p>
          <nav aria-label="Landing" className="ml-auto hidden items-center gap-6 text-[15px] lg:flex">
            <a href="#features" className="hover:underline">
              Features
            </a>
            <a href="#how" className="hover:underline">
              How it works
            </a>
            <Link to="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
          <Link
            to="/signup"
            className="ml-auto inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#1a55bd] lg:ml-0"
          >
            Create free account
          </Link>
        </header>

        {/* Phone: the sentence leaves the rail and sits on the corner scrim with the action */}
        <div className="absolute inset-x-0 bottom-0 bg-black/35 p-5 md:hidden">
          <p className="text-[18px] leading-snug text-[#f3f5f7]">See where your money goes, and where it should.</p>
          <Link
            to="/signup"
            className="mt-3 flex h-11 items-center justify-center rounded-[10px] bg-accent text-[15px] font-medium text-white"
          >
            Create free account
          </Link>
        </div>
      </div>

      {/* A closer detail of the same subject, so the rail is seen crossing two pictures */}
      <img
        src="/img/detail.jpg"
        alt="A small red boat on a wide expanse of dark blue rippling sea"
        width={2400}
        height={1350}
        loading="lazy"
        className="h-[60svh] w-full object-cover"
      />
    </>
  );
}

interface NoteProps {
  name: string;
  body: string;
  part: FragmentPart;
  activePart: FragmentPart | null;
  setActivePart: (part: FragmentPart | null) => void;
}

function Note({ name, body, part, activePart, setActivePart }: NoteProps) {
  return (
    <button
      type="button"
      onMouseEnter={() => setActivePart(part)}
      onMouseLeave={() => setActivePart(null)}
      onFocus={() => setActivePart(part)}
      onBlur={() => setActivePart(null)}
      className={cn(
        'block w-full max-w-[24ch] rounded-[8px] text-left',
        activePart === part && 'bg-accent-soft p-2 -m-2',
      )}
    >
      <span className="block text-[18px] font-medium text-ink">{name}</span>
      <span className="mt-1 block text-[15px] leading-snug text-muted">{body}</span>
    </button>
  );
}

function Features() {
  const [activePart, setActivePart] = useState<FragmentPart | null>(null);

  return (
    <section id="features" className="px-5 pb-16 pt-24 md:px-10">
      <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left margin: heading, then its notes spread down the panel's height */}
        <div className="flex flex-col gap-14 lg:col-span-4 lg:row-span-1 lg:pt-8 lg:text-right">
          <Reveal>
            <h2 className="text-[32px] font-medium leading-tight tracking-tight text-ink md:text-[36px]">
              The whole picture
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-ink lg:ml-auto lg:max-w-[36ch]">
              One ledger, one plan, one honest number at a time. Hover a note to find its part.
            </p>
          </Reveal>
          <div className="flex flex-col gap-14 lg:hidden">
            <Reveal delay={120}>
              <Note name="Net worth" body="Every account you keep, summed into one number." part="networth" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
            <Reveal delay={150}>
              <Note name="The month's plan" body="Limits per category, drawn as one ring with its share spent." part="plan" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
          </div>
          <div className="hidden flex-1 flex-col justify-around gap-14 lg:flex">
            <Reveal delay={120} className="lg:self-end">
              <Note name="Net worth" body="Every account you keep, summed into one number." part="networth" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
            <Reveal delay={150} className="lg:self-end">
              <Note name="The month's plan" body="Limits per category, drawn as one ring with its share spent." part="plan" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
            <Reveal delay={180} className="lg:self-end">
              <Note name="Safe to spend" body="What is left of the plan, per day, to the cent." part="safe" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
          </div>
        </div>

        {/* The panel: a plate in a manual, at true size */}
        <Reveal className="lg:col-span-4 lg:col-start-5" delay={80}>
          <div className="flex flex-col items-center gap-3">
            <DashboardFragment activePart={activePart} />
            <p className="max-w-[38ch] text-center text-[14px] text-muted">
              One evening of real use: three entries recorded, limits holding, a pot filling.
            </p>
          </div>
        </Reveal>

        {/* Right margin: its notes spread down the panel's height, closing to the margin */}
        <div className="hidden flex-col gap-14 lg:col-span-4 lg:col-start-9 lg:flex lg:pt-8">
          <div className="flex flex-1 flex-col justify-around gap-14">
            <Reveal delay={160}>
              <Note name="Recent spending" body="The last few movements, payee over category, newest first." part="recent" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
            <Reveal delay={190}>
              <Note name="Category limits" body="Spent against limit, category by category, quiet while a limit holds." part="categories" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
            <Reveal delay={220}>
              <Note name="Goal pots" body="Savings that fill toward the thing you are saving for." part="goal" activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
          </div>
          <Reveal delay={250}>
            <p className="text-[14px] leading-snug text-muted">
              Every figure in this panel is computed from the rows shown; nothing is typed twice.
            </p>
          </Reveal>
        </div>

        {/* Notes for small screens, inline after the panel */}
        <div className="grid gap-6 sm:grid-cols-2 lg:hidden">
          {(
            [
              ['Safe to spend', 'What is left of the plan, per day, to the cent.', 'safe'],
              ['Recent spending', 'Payee over category, newest first.', 'recent'],
              ['Category limits', 'Spent against limit, category by category.', 'categories'],
              ['Goal pots', 'Savings filling toward a target.', 'goal'],
            ] as Array<[string, string, FragmentPart]>
          ).map(([name, body, part], index) => (
            <Reveal key={part} delay={index * 60}>
              <Note name={name} body={body} part={part} activePart={activePart} setActivePart={setActivePart} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  // Redraw of the dealt "run-in column": its single narrow column left the right
  // half of two screens empty (inspector FAIL). The house layout rule closes the
  // void by putting each stage's evidence on the far side; the reading column keeps
  // its run-in typography.
  return (
    <section id="how" className="px-5 pb-16 pt-16 md:px-10">
      <div className="w-full">
        <Reveal>
          <h2 className="text-[28px] font-medium leading-tight tracking-tight text-ink md:text-[32px]">
            How does it work?
          </h2>
        </Reveal>

        <div className="mt-12 flex flex-col gap-[72px]">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
            <Reveal>
              <p className="max-w-[52ch] text-[17px] leading-[1.6] text-ink">
                <strong className="font-semibold">To begin,</strong> record money as it moves: income, bills, the
                small daily spends. Everything lands in one ledger with a category attached, so nothing waits in a
                spreadsheet. An entry takes a payee, an amount and a category; corrections are edits, not rewrites.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <AddTransactionFragment />
            </Reveal>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
            <Reveal>
              <p className="max-w-[52ch] text-[17px] leading-[1.6] text-ink">
                <strong className="font-semibold">Each week,</strong> the plan does the arithmetic: limits per
                category, what is safe to spend today, and the pots filling toward their goals. The safe-to-spend
                figure carries its own per-day line, so a strong Tuesday never reads like a strong month. Try the
                split with your own take-home:
              </p>
            </Reveal>
            <Reveal delay={90}>
              <BudgetCalculatorFragment />
            </Reveal>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
            <Reveal>
              <p className="max-w-[52ch] text-[17px] leading-[1.6] text-ink">
                <strong className="font-semibold">From then on,</strong> reports read plainly: where the month
                went, which limits held, and what to adjust before the next one begins. Every figure names its
                period, so this month is never read against the wrong one.
              </p>
            </Reveal>
            <Reveal delay={90}>
              <ReportFragment />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}


function Benefits() {
  const benefits: Array<[string, string]> = [
    ['Numbers you can trust', 'Totals are computed from the ledger, never stored twice. What the dashboard says and what the rows say are the same number.'],
    ['Limits that warn, not scold', 'Budgets stay quiet while they hold, turn amber near the line, and only go red once a limit is actually passed.'],
    ['Reports that read plainly', 'Every figure carries its period. A month is never read against the wrong one, and a CSV or PDF is one click away.'],
  ];
  return (
    <section id="benefits" className="px-5 pb-8 pt-24 md:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4 lg:pt-2">
          <Reveal>
            <h2 className="text-[28px] font-medium leading-tight tracking-tight text-ink md:text-[32px]">Why it sticks</h2>
            <p className="mt-3 max-w-[36ch] text-[17px] leading-relaxed text-ink">
              Tools fail when they shout or when they hide. This one does neither.
            </p>
          </Reveal>
        </div>
        <div className="flex flex-col gap-12 lg:col-span-7 lg:col-start-6">
          {benefits.map(([name, body], index) => (
            <Reveal key={name} delay={index * 80}>
              <p className="text-[18px] font-medium text-ink">{name}</p>
              <p className="mt-1.5 max-w-[52ch] text-[16px] leading-relaxed text-muted">{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS: Array<[string, string]> = [
  ['Is my data private?', 'Your ledger lives in your own database and is served only to your signed-in session. Passwords are hashed and the session cookie is unreadable by scripts.'],
  ['Does it cost anything?', 'No. Smart Finance runs on your own infrastructure; there is no account to pay for and nothing is sold about you.'],
  ['What currencies work?', 'Amounts are stored as integer minor units and formatted with your account currency. Switch currency in Settings and every figure follows.'],
  ['Can I get my data out?', 'Yes. The transactions page exports the current filter as CSV, and reports offer the same, so your ledger is never locked in.'],
  ['What if I forget my password?', 'The sign-in page starts a reset: a single-use link, valid for one hour, that lets you set a new password.'],
];

function Faq() {
  return (
    <section id="faq" className="px-5 pb-16 pt-24 md:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal>
            <h2 className="text-[28px] font-medium leading-tight tracking-tight text-ink md:text-[32px]">Questions, answered</h2>
            <p className="mt-3 max-w-[32ch] text-[17px] leading-relaxed text-ink">
              The short version of everything people ask before starting.
            </p>
          </Reveal>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-8">
          {FAQ_ITEMS.map(([question, answer], index) => (
            <Reveal key={question} delay={index * 60}>
              <details className="group rounded-[10px] px-3 py-3 hover:bg-active/50">
                <summary className="cursor-pointer list-none text-[16px] font-medium text-ink marker:hidden">
                  <span className="mr-2 inline-block w-4 text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                  {question}
                </summary>
                <p className="mt-2 max-w-[56ch] pl-6 text-[15px] leading-relaxed text-muted">{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCall() {
  return (
    <section className="px-5 pb-[20svh] pt-[30svh] md:px-10">
      <div className="md:ml-[30%] md:max-w-[560px]">
        <Reveal>
          <p className="max-w-[34ch] text-[18px] leading-snug text-ink md:text-[21px]">
            Open a free account, record this month, and read the plan tonight.
          </p>
          <div className="mt-6 flex items-center gap-5">
            <Link
              to="/signup"
              className="inline-flex h-10 items-center rounded-[10px] bg-accent px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-[#1a55bd] active:scale-[0.98]"
            >
              Create free account
            </Link>
            <Link to="/login" className="text-[15px] text-ink hover:underline">
              Sign in
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-5 pb-8 md:px-10">
      <div className="grid grid-cols-1 items-baseline gap-3 text-sm md:grid-cols-3">
        <p className="text-muted">Your quiet money manager</p>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-6">
          <a href="#features" className="text-ink hover:underline">
            Features
          </a>
          <a href="#how" className="text-ink hover:underline">
            How it works
          </a>
          <a href="#faq" className="text-ink hover:underline">
            FAQ
          </a>
          <Link to="/login" className="text-ink hover:underline">
            Sign in
          </Link>
          <Link to="/signup" className="text-ink hover:underline">
            Create account
          </Link>
        </nav>
        <p className="text-muted md:text-right">© 2026 · Privacy</p>
      </div>
      <p className="mt-4 max-w-[72ch] text-[14px] leading-relaxed text-muted">
        Photographs: “Small red boat floating on clear turquoise water” by Anton Sulsky, “Silhouetted pier on a
        hazy blue lake” by Paul E. Harrer, “Two people paddling a canoe across a misty green lake” by Matthew
        Clark, “Small red boat on a wide expanse of dark blue rippling sea” by Marcelo Quinan — Unsplash
        licence, served via picsum.photos.
      </p>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="bg-ground">
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
      <Faq />
      <ClosingCall />
      <Footer />
    </div>
  );
}
