import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Eye, MapPinCheck, ShieldAlert } from 'lucide-react';

export default function StudentSafetyWarning() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="student-safety" aria-label="Important payment safety warning">
      <div className="student-safety__banner" role="alert">
        <span className="student-safety__icon" aria-hidden="true">
          <ShieldAlert size={24} />
        </span>

        <div className="student-safety__message">
          <strong>STOP — verify the property before paying.</strong>
          <span>
            Do not pay any amount of money until you have physically visited and
            verified the property yourself.
          </span>
        </div>

        <button
          type="button"
          className="student-safety__toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls="student-safety-steps"
        >
          Safety steps
          <ChevronDown
            size={18}
            className={expanded ? 'student-safety__chevron student-safety__chevron--open' : 'student-safety__chevron'}
          />
        </button>
      </div>

      {expanded && (
        <div id="student-safety-steps" className="student-safety__steps">
          <div>
            <Eye size={19} aria-hidden="true" />
            <span><strong>Visit in person</strong>Inspect the exact room and its facilities.</span>
          </div>
          <div>
            <MapPinCheck size={19} aria-hidden="true" />
            <span><strong>Confirm the location</strong>Ensure it matches the map and listing details.</span>
          </div>
          <div>
            <ShieldAlert size={19} aria-hidden="true" />
            <span><strong>Verify who receives payment</strong>Confirm the landlord or authorised caretaker first.</span>
          </div>
          <Link href="/safety">Open the safety centre →</Link>
        </div>
      )}
    </section>
  );
}
