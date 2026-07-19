import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import patientService from '../api/services/PatientApiService.js';

/**
 * Autocomplete patient search — same live-suggestion behaviour as the
 * navbar search, reusable on any page. Type ≥2 chars (name / NIC / phone)
 * and matching patients drop down; pick one to fire onSelect(patient).
 */
const PatientSearchInput = ({ onSelect, placeholder, inputClass = '', autoFocus = false }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    // Close the suggestions on an outside click.
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = useCallback((value) => {
    setTerm(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await patientService.search(value.trim());
        setResults(found.slice(0, 8));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Choose a suggestion → notify the parent and reset the box.
  const pick = (patient) => {
    setOpen(false);
    setTerm('');
    setResults([]);
    onSelect?.(patient);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoFocus={autoFocus}
          className={inputClass || 'w-full h-10 border border-gray-200 rounded-xl pl-8 pr-8 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400'}
          style={{ paddingLeft: '2rem' }}
          placeholder={placeholder}
          value={term}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {term && (
          <button type="button" onClick={() => { setTerm(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          {searching ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">—</div>
          ) : results.map((p) => (
            <button key={p._id} type="button" onClick={() => pick(p)}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-bold">
                {p.userId?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{p.userId?.name}</div>
                <div className="text-xs text-gray-400">{p.NIC}{p.userId?.phone ? ` · ${p.userId.phone}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientSearchInput;
