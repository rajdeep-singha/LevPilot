import { useNavigate } from 'react-router-dom'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4'

const NAV_LINKS = ['Protocol', 'Risk Engine', 'Docs', 'Community']

const displayFont = { fontFamily: "'Instrument Serif', serif" }
const mutedColor = { color: 'hsl(240, 4%, 66%)' }

const PILLARS = [
  {
    icon: '⚡',
    title: 'DeepBook Liquidity',
    desc: "Margin & spot depth sourced directly from Sui's native CLOB — tight spreads, deep fills.",
  },
  {
    icon: '🏦',
    title: 'Scallop Lending',
    desc: "Flash-loan collateral loops and borrow positions secured by Scallop's battle-tested vaults.",
  },
  {
    icon: '🛡',
    title: 'Risk Guard',
    desc: 'OpenZeppelin-grade policy engine screens every intent before a single byte touches the chain.',
  },
  {
    icon: '🤖',
    title: 'Agentic AI',
    desc: 'Claude-powered agent parses natural language into typed trade intents — no forms, just intent.',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'hsl(201, 100%, 13%)' }}>
      {/* Background video */}
      <video
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Subtle dark veil so text stays readable */}
      <div className="absolute inset-0 z-[1] bg-black/40" />

      {/* Nav */}
      <header className="relative z-10">
        <div className="flex flex-row justify-between items-center px-8 py-6 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-400 flex items-center justify-center shrink-0">
              <span className="text-black text-sm font-black">L</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-white" style={displayFont}>
              LevPilot
            </span>
            <span
              className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full border ml-1"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'hsl(240,4%,66%)' }}
            >
              TESTNET
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((label) => (
              <a
                key={label}
                href="#"
                className="text-sm transition-colors hover:text-white"
                style={mutedColor}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <button
            className="liquid-glass rounded-full px-6 py-2.5 text-sm text-white transition-transform hover:scale-[1.03] cursor-pointer"
            onClick={() => navigate('/app')}
          >
            Launch Terminal
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-20">
        {/* Eyebrow */}
        <div
          className="animate-fade-rise inline-flex items-center gap-2 liquid-glass rounded-full px-4 py-1.5 text-xs mb-10"
          style={mutedColor}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
          Risk-Guarded Agentic Leverage · Built on Sui
        </div>

        {/* H1 */}
        <h1
          className="animate-fade-rise text-5xl sm:text-7xl md:text-[88px] font-normal max-w-5xl text-white"
          style={{ ...displayFont, lineHeight: 0.95, letterSpacing: '-2.46px' }}
        >
          Trade with{' '}
          <em className="not-italic" style={{ color: 'hsl(142, 76%, 73%)' }}>
            leverage.
          </em>
          <br />
          Protected by{' '}
          <em className="not-italic" style={mutedColor}>
            intelligence.
          </em>
        </h1>

        {/* Subtext */}
        <p
          className="animate-fade-rise-delay text-base sm:text-lg max-w-2xl mt-8 leading-relaxed"
          style={mutedColor}
        >
          LevPilot is an AI agent that reads your intent, simulates risk, clears policy — then
          builds and submits the on-chain transaction. DeepBook liquidity. Scallop credit.
          Zero guesswork.
        </p>

        {/* CTA group */}
        <div className="animate-fade-rise-delay-2 flex flex-col sm:flex-row items-center gap-4 mt-12">
          <button
            className="liquid-glass rounded-full px-14 py-5 text-base text-white transition-transform hover:scale-[1.03] cursor-pointer"
            onClick={() => navigate('/app')}
          >
            Open Terminal
          </button>
          <a
            href="#how"
            className="text-sm transition-colors hover:text-white cursor-pointer"
            style={mutedColor}
          >
            How it works ↓
          </a>
        </div>

        {/* Stat strip */}
        <div
          className="animate-fade-rise-delay-2 flex flex-wrap justify-center gap-8 mt-16 text-center"
        >
          {[
            { value: '5×', label: 'Max Leverage' },
            { value: '<2s', label: 'Intent → PTB' },
            { value: 'A–F', label: 'Risk Grading' },
            { value: '0', label: 'Custody Risk' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-semibold text-white" style={displayFont}>{value}</p>
              <p className="text-xs mt-1" style={mutedColor}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section id="how" className="relative z-10 px-8 pb-28 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="liquid-glass rounded-2xl p-6 flex flex-col gap-3 text-left transition-transform hover:scale-[1.02] cursor-default"
            >
              <span className="text-2xl">{icon}</span>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs leading-relaxed" style={mutedColor}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between mt-16 pt-8 gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs" style={mutedColor}>
            © 2026 LevPilot · Sui Testnet · Not financial advice
          </p>
          <div className="flex items-center gap-2 text-xs" style={mutedColor}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Powered by Claude · Scallop · DeepBook · Pyth Oracle
          </div>
        </div>
      </section>
    </div>
  )
}
