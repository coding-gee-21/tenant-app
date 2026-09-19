import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, BadgeCheck, Eye, Flag, ShieldCheck } from 'lucide-react';

const safetySteps = [
  {
    Icon: Eye,
    title: 'View before paying',
    text: 'Visit the room and confirm that the person showing it controls the property before sending rent or a deposit.',
  },
  {
    Icon: BadgeCheck,
    title: 'Understand verification',
    text: 'A verified badge means CUEAF reviewed the submitted account or property information. It is not a guarantee of every future transaction.',
  },
  {
    Icon: AlertTriangle,
    title: 'Keep payment evidence',
    text: 'Ask for a written agreement and a receipt. Confirm the recipient name before completing any payment.',
  },
  {
    Icon: Flag,
    title: 'Report inaccurate information',
    text: 'Use the report button when photos, rent, availability or contact information appear incorrect.',
  },
];

export default function Safety() {
  const [eyeBlink, setEyeBlink] = useState(0);

  return (
    <>
      <Head>
        <title>Trust and Safety Centre | CUEAF</title>
        <meta
          name="description"
          content="Practical safety guidance for students searching for off-campus housing through CUEAF."
        />
      </Head>

      <main className="mx-auto max-w-4xl space-y-8 text-white">
        <Link
          href="/account"
          className="inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          ← Account
        </Link>

        <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-8">
          <ShieldCheck size={42} className="text-blue-400" />
          <h1 className="mt-4 text-3xl font-bold">Trust and safety centre</h1>
          <p className="mt-3 max-w-2xl text-gray-300">
            Practical steps for finding student housing responsibly and
            understanding the platform&apos;s verification badges.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {safetySteps.map(({ Icon, title, text }, index) => (
            <article
              key={title}
              className="safety-floater rounded-2xl border border-white/10 bg-[#18181B] p-6"
              style={{ animationDelay: `${index * -0.85}s` }}
            >
              {index === 0 ? (
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setEyeBlink((blink) => blink + 1)}
                  aria-label="Blink the safety eye"
                  title="Click to blink"
                >
                  <Eye
                    key={eyeBlink}
                    className="eye-blink text-emerald-400"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <Icon className="safety-floater-icon text-emerald-400" />
              )}
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">{text}</p>
            </article>
          ))}
        </div>

        <div
          className="safety-important rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100"
          role="alert"
        >
          <AlertTriangle
            className="safety-important-icon"
            size={21}
            aria-hidden="true"
          />
          <p>
            <strong>Important:</strong> Never rely on urgency or pressure. If
            information does not match what is shown on CUEAF, pause and report
            the listing.
          </p>
        </div>

        <style jsx>{`
          .safety-floater {
            animation: safety-float 5.4s ease-in-out infinite;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
            transition:
              border-color 220ms ease,
              box-shadow 220ms ease;
            will-change: transform;
          }

          .safety-floater:nth-child(even) {
            animation-name: safety-float-reverse;
          }

          .safety-floater:hover,
          .safety-floater:focus-within {
            animation-play-state: paused;
            border-color: rgba(52, 211, 153, 0.34);
            box-shadow:
              0 18px 34px rgba(0, 0, 0, 0.2),
              0 0 0 1px rgba(52, 211, 153, 0.08);
          }

          .safety-floater :global(.safety-floater-icon) {
            animation: safety-icon-breathe 3.6s ease-in-out infinite;
            filter: drop-shadow(0 0 0 rgba(52, 211, 153, 0));
          }

          .eye-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            color: inherit;
            background: transparent;
            border: 0;
            border-radius: 0.375rem;
            cursor: pointer;
          }

          .eye-button:focus-visible {
            outline: 2px solid rgba(52, 211, 153, 0.9);
            outline-offset: 4px;
          }

          .eye-button :global(.eye-blink) {
            animation: safety-eye-blink 420ms ease-in-out;
            filter: drop-shadow(0 0 6px rgba(52, 211, 153, 0.24));
            transform-box: fill-box;
            transform-origin: center;
          }

          .safety-important {
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            overflow: hidden;
            animation: safety-warning-breathe 3.8s ease-in-out infinite;
            isolation: isolate;
          }

          .safety-important::after {
            position: absolute;
            top: -60%;
            bottom: -60%;
            left: -32%;
            width: 24%;
            content: '';
            background: linear-gradient(
              90deg,
              transparent,
              rgba(251, 191, 36, 0.14),
              transparent
            );
            pointer-events: none;
            transform: skewX(-18deg);
            animation: safety-warning-sweep 5.4s ease-in-out infinite;
            z-index: -1;
          }

          .safety-important p {
            margin: 0;
          }

          .safety-important :global(.safety-important-icon) {
            flex: 0 0 auto;
            color: rgb(251, 191, 36);
            animation: safety-warning-icon-pulse 1.9s ease-in-out infinite;
          }

          @keyframes safety-float {
            0%,
            100% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(0, -7px, 0);
            }
          }

          @keyframes safety-float-reverse {
            0%,
            100% {
              transform: translate3d(0, -5px, 0);
            }
            50% {
              transform: translate3d(0, 2px, 0);
            }
          }

          @keyframes safety-icon-breathe {
            0%,
            100% {
              opacity: 0.82;
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(52, 211, 153, 0));
            }
            50% {
              opacity: 1;
              transform: scale(1.06);
              filter: drop-shadow(0 0 7px rgba(52, 211, 153, 0.28));
            }
          }

          @keyframes safety-eye-blink {
            0%,
            100% {
              transform: scaleY(1);
            }
            42%,
            58% {
              transform: scaleY(0.08);
            }
          }

          @keyframes safety-warning-breathe {
            0%,
            100% {
              border-color: rgba(245, 158, 11, 0.3);
              box-shadow: 0 0 0 rgba(245, 158, 11, 0);
            }
            50% {
              border-color: rgba(251, 191, 36, 0.56);
              box-shadow: 0 0 24px rgba(245, 158, 11, 0.15);
            }
          }

          @keyframes safety-warning-sweep {
            0%,
            18% {
              left: -32%;
              opacity: 0;
            }
            28% {
              opacity: 1;
            }
            62%,
            100% {
              left: 112%;
              opacity: 0;
            }
          }

          @keyframes safety-warning-icon-pulse {
            0%,
            100% {
              opacity: 0.78;
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
            }
            50% {
              opacity: 1;
              transform: scale(1.1);
              filter: drop-shadow(0 0 7px rgba(251, 191, 36, 0.42));
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .safety-floater,
            .safety-floater :global(.safety-floater-icon),
            .eye-button :global(.eye-blink),
            .safety-important,
            .safety-important::after,
            .safety-important :global(.safety-important-icon) {
              animation: none;
            }
          }
        `}</style>
      </main>
    </>
  );
}
