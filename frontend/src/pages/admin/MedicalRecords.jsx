/**
 * MedicalRecords.jsx — admin oversight of ALL consultation records (UC19).
 * Paginated, searchable list; records can be corrected in a modal or
 * deleted (both actions are audit-logged on the server).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { adminService } from '../../api';
import { withDrPrefix } from '../../utils/names';
import { clinicDisplayName } from '../../utils/clinicTypes.js';
import Toast from '../../components/Toast.jsx';

const inputClass = 'h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
const areaClass  = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';

// Modal for correcting one record's fields.
const RecordModal = ({ record, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    symptoms:        record.symptoms || '',
    diagnosis:       record.diagnosis || '',
    treatmentNotes:  record.treatmentNotes || '',
    notes:           record.notes || '',
    doctorComments:  record.doctorComments || '',
    followUpDate:    record.followUpDate ? new Date(record.followUpDate).toISOString().slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  // Save the modal's changes.
  const save = async () => {
    setSaving(true);
    const payload = { ...form };
    if (!payload.followUpDate) delete payload.followUpDate;
    await onSave(record._id, payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-bold text-blue-900">{t('recordMgmt.editRecord')}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {record.patientId?.userId?.name} · {withDrPrefix(record.doctorId?.userId?.name)} · {new Date(record.visitDate).toLocaleDateString('en-GB')}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('recordMgmt.symptoms')}</label>
              <textarea className={areaClass} rows={3} value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('recordMgmt.diagnosis')}</label>
              <textarea className={areaClass} rows={3} value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </div>
          </div>

          {(record.prescription || []).length > 0 && (
            <div>
              <label className={labelClass}>{t('recordMgmt.prescription')}</label>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                {record.prescription.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-semibold text-gray-800">{p.medicine}</span>
                    <span className="text-gray-500 text-xs">{p.dosage} · {p.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{t('recordMgmt.treatmentNotes')}</label>
            <textarea className={areaClass} rows={2} value={form.treatmentNotes}
              onChange={(e) => setForm({ ...form, treatmentNotes: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('recordMgmt.doctorComments')}</label>
              <textarea className={areaClass} rows={2} value={form.doctorComments}
                onChange={(e) => setForm({ ...form, doctorComments: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('recordMgmt.followUpDate')}</label>
              <input type="date" className={`${inputClass} w-full`} value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
              <label className={`${labelClass} mt-3`}>{t('recordMgmt.notes')}</label>
              <textarea className={areaClass} rows={1} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Page component.
const MedicalRecords = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  // Fetch one page of records (with search).
  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      const data = await adminService.getAllRecords(params);
      setRecords(data.records);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search]);

  // Apply the search box (back to page 1).
  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  // Persist modal edits via the admin API.
  const saveRecord = async (id, payload) => {
    setError(''); setMessage('');
    try {
      await adminService.updateRecord(id, payload);
      setEditing(null);
      setMessage(t('recordMgmt.updated'));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Delete a record after confirmation (audit-logged).
  const deleteRecord = async (record) => {
    if (!window.confirm(t('recordMgmt.deleteConfirm'))) return;
    setError(''); setMessage('');
    try {
      await adminService.deleteRecord(record._id);
      setMessage(t('recordMgmt.deleted'));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('recordMgmt.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('recordMgmt.subtitle')}</p>
          </div>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        {/* Search bar — filters records by patient name or NIC */}
        <form onSubmit={submitSearch} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} w-full pl-9`} placeholder={t('recordMgmt.searchPlaceholder')}
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <button type="submit" className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors">
            {t('common.search')}
          </button>
          <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            className="h-10 px-4 flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
        </form>

        {/* Records table with per-row Edit (opens modal) and Delete buttons;
            records without a clinicId display as General OPD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-base font-bold text-blue-900 mb-4">
            {t('recordMgmt.listTitle')} <span className="text-xs font-semibold text-gray-400 ml-1">({total})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  {[t('recordMgmt.visitDate'), t('recordMgmt.patient'), t('recordMgmt.nic'), t('recordMgmt.doctor'),
                    t('recordMgmt.clinic'), t('recordMgmt.diagnosis'), t('recordMgmt.medicines'), ''].map((h, i) => (
                    <th key={i} className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-4 py-3 border-b-2 border-blue-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-10">{t('common.loading')}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-10">{t('recordMgmt.noRecords')}</td></tr>
                ) : records.map((record) => (
                  <tr key={record._id} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{new Date(record.visitDate).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{record.patientId?.userId?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{record.patientId?.userId?.NIC || record.patientId?.NIC || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{withDrPrefix(record.doctorId?.userId?.name) || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{record.clinicId ? clinicDisplayName(record.clinicId, t) : t('clinicTypes.opd')}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate" title={record.diagnosis}>{record.diagnosis}</td>
                    <td className="px-4 py-3 text-gray-600">{(record.prescription || []).length}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => setEditing(record)}
                        className="text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1 mr-2 transition-colors">
                        {t('common.edit')}
                      </button>
                      <button type="button" onClick={() => deleteRecord(record)}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition-colors">
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-semibold text-gray-500">{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal — only medical fields are editable (links stay locked) */}
      {editing && <RecordModal record={editing} onSave={saveRecord} onClose={() => setEditing(null)} t={t} />}
    </div>
  );
};

export default MedicalRecords;
