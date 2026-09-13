import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, MapPin } from 'lucide-react';

export default function CUEAFBrand({ compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const brandRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (
        brandRef.current &&
        !brandRef.current.contains(event.target)
      ) {
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
      document.removeEventListener(
        'mousedown',
        closeOnOutsideClick
      );

      document.removeEventListener(
        'keydown',
        closeOnEscape
      );
    };
  }, []);

  const expandedNameId = compact
    ? 'cueaf-expanded-name-sidebar'
    : 'cueaf-expanded-name-header';

  return (
    <span
      ref={brandRef}
      className={`cueaf-brand ${
        compact ? 'cueaf-brand--compact' : ''
      }`}
      aria-label="Chuka University External Accommodation Facilities"
    >
      <Link
        href="/"
        className="cueaf-brand__home"
        aria-label="CUEAF home"
      >
        <span className="cueaf-brand__crest-wrap">
          <Image
            src="/chuka-university-crest.jpeg"
            alt="Chuka University crest"
            width={44}
            height={44}
            className="cueaf-brand__crest"
            priority
          />
        </span>

        <span
          className="cueaf-brand__housing"
          aria-hidden="true"
        >
          <Building2 size={22} />

          <MapPin
            size={13}
            className="cueaf-brand__pin"
          />
        </span>
      </Link>

      <button
        type="button"
        className="cueaf-brand__wordmark"
        onClick={() =>
          setExpanded((current) => !current)
        }
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
          aria-hidden="true"
          className={
            expanded
              ? 'cueaf-brand__chevron cueaf-brand__chevron--open'
              : 'cueaf-brand__chevron'
          }
        />

        {!compact && (
          <small>Click to reveal the full name</small>
        )}
      </button>

      <span
        id={expandedNameId}
        className={`cueaf-brand__expanded-name ${
          expanded
            ? 'cueaf-brand__expanded-name--visible'
            : ''
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