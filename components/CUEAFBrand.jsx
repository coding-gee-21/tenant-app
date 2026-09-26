import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ADMIN_PORTAL_TAP_LIMIT = 5;
const ADMIN_PORTAL_TAP_WINDOW_MS = 4000;
const ADMIN_PORTAL_TAP_STORAGE_KEY = 'cueaf-admin-portal-taps';

export default function CUEAFBrand({ compact = false }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const brandRef = useRef(null);
  const adminTapSequenceRef = useRef({ count: 0, lastTapAt: 0 });

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (brandRef.current && !brandRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const handleBrandMarkClick = (event) => {
    const now = Date.now();
    let previousSequence = adminTapSequenceRef.current;

    try {
      const storedSequence = window.sessionStorage.getItem(
        ADMIN_PORTAL_TAP_STORAGE_KEY
      );

      if (storedSequence) {
        const parsedSequence = JSON.parse(storedSequence);

        if (
          Number.isFinite(parsedSequence?.count) &&
          Number.isFinite(parsedSequence?.lastTapAt)
        ) {
          previousSequence = parsedSequence;
        }
      }
    } catch {
      // The in-memory sequence still supports the shortcut when storage
      // is unavailable, such as in a restrictive private-browsing mode.
    }

    const isWithinTapWindow =
      now - previousSequence.lastTapAt <= ADMIN_PORTAL_TAP_WINDOW_MS;
    const nextSequence = {
      count: isWithinTapWindow ? previousSequence.count + 1 : 1,
      lastTapAt: now,
    };

    adminTapSequenceRef.current = nextSequence;

    if (nextSequence.count >= ADMIN_PORTAL_TAP_LIMIT) {
      event.preventDefault();
      adminTapSequenceRef.current = { count: 0, lastTapAt: 0 };

      try {
        window.sessionStorage.removeItem(ADMIN_PORTAL_TAP_STORAGE_KEY);
      } catch {
        // No cleanup is required when browser storage is unavailable.
      }

      void router.push('/admin/login');
      return;
    }

    try {
      window.sessionStorage.setItem(
        ADMIN_PORTAL_TAP_STORAGE_KEY,
        JSON.stringify(nextSequence)
      );
    } catch {
      // Keep the in-memory fallback above when storage is unavailable.
    }
  };

  const expandedNameId = compact
    ? 'cueaf-expanded-name-sidebar'
    : 'cueaf-expanded-name-header';

  return (
    <span
      ref={brandRef}
      className={`cueaf-brand ${compact ? 'cueaf-brand--compact' : ''}`}
      aria-label="Chuka University External Accommodation Facilities"
    >
      <Link
        href="/"
        className="cueaf-brand__home"
        onClick={handleBrandMarkClick}
        aria-label="Go to the CUEAF home page"
      >
        <span className="cueaf-brand__mark-wrap">
          <Image
            src="/cueaf-housing-mark.png"
            alt="CUEAF housing and location symbol"
            width={100}
            height={40}
            className="cueaf-brand__mark"
            priority
          />
        </span>
      </Link>

      <button
        type="button"
        className="cueaf-brand__wordmark"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={expandedNameId}
        aria-label={
          expanded
            ? 'Hide the full CUEAF name'
            : 'Show the full CUEAF name'
        }
      >
        <strong>CUEAF</strong>

        <ChevronDown
          size={15}
          className={
            expanded
              ? 'cueaf-brand__chevron cueaf-brand__chevron--open'
              : 'cueaf-brand__chevron'
          }
          aria-hidden="true"
        />

        {!compact && <small>Click to reveal the full name</small>}
      </button>

      <span
        id={expandedNameId}
        className={`cueaf-brand__expanded-name ${
          expanded ? 'cueaf-brand__expanded-name--visible' : ''
        }`}
        aria-hidden={!expanded}
      >
        <small>CUEAF means</small>
        <strong>
          Chuka University External Accommodation Facilities
        </strong>
      </span>
    </span>
  );
}
