import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CUEAFBrand({ compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const brandRef = useRef(null);

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