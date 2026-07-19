/**
 * MedicalHistory.jsx — the patient's own records, in two tabs:
 *  - Consultations: doctor-written records (with prescription PDF download
 *    and a full history PDF)
 *  - Lab Reports: uploaded files (PDF/image); the patient can also upload
 *    their own reports here
 */
import { useEffect, useRef, useState } from 'react';
import { FileText, ImageIcon, ExternalLink, Upload, Download, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { patientService, medicalReportService, doctorService } from '../../api';
import { withDrPrefix } from '../../utils/names';
import { clinicDisplayName } from '../../utils/clinicTypes.js';
import Toast from '../../components/Toast.jsx';

// Button that downloads one record's prescription PDF.
const DownloadPdfButton = ({ recordId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mt-3">
      {err && <p className="text-xs text-red-500 mb-1">{err}</p>}
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setErr(''); setLoading(true);
          try { await doctorService.downloadPrescriptionPdf(recordId); }
          catch { setErr(t('medicalHistory.failedPdf')); }
          finally { setLoading(false); }
        }}
        className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
      >
        {loading ? t('medicalHistory.generating') : t('medicalHistory.downloadPdf')}
      </button>
    </div>
  );
};

const REPORT_TYPES = {
  blood_test:   { label: 'Blood Test',   cls: 'bg-red-100 text-red-700' },
  urine_test:   { label: 'Urine Test',   cls: 'bg-amber-100 text-amber-700' },
  xray:         { label: 'X-Ray',        cls: 'bg-purple-100 text-purple-700' },
  scan:         { label: 'Scan / MRI',   cls: 'bg-sky-100 text-sky-700' },
  ecg:          { label: 'ECG',          cls: 'bg-green-100 text-green-700' },
  prescription: { label: 'Prescription', cls: 'bg-indigo-100 text-indigo-700' },
  other:        { label: 'Other',        cls: 'bg-gray-100 text-gray-600' },
};

// One tab header button (with count chip).
const Tab = ({ label, active, onClick, count }) => (
  <button type="button" onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
      active ? 'bg-blue-900 text-white' : 'text-gray-500 hover:bg-blue-50'
    }`}>
    {label}
    {count != null && (
      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    )}
  </button>
);

// Page component.
const MedicalHistory = () => {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('records');
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [historyPdfLoading, setHistoryPdfLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [upForm, setUpForm] = useState({ title: '', reportType: 'blood_test', description: '', reportDate: '' });
  const [upFile, setUpFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [upMsg, setUpMsg] = useState({ text: '', error: false });

  // Download my full history PDF.
  const downloadFullHistory = async () => {
    if (!patient?._id) return;
    setHistoryPdfLoading(true);
    try { await doctorService.downloadHistoryPdf(patient._id, patient.userId?.name); }
    catch { setError(t('medicalHistory.failedPdf')); }
    finally { setHistoryPdfLoading(false); }
  };

  // Patient uploads their own report (blood test, ECG, x-ray, …).
  // The backend forces patientId to the signed-in patient's profile.
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!upFile) return setUpMsg({ text: t('patientReports.selectFile'), error: true });
    if (!upForm.title.trim()) return setUpMsg({ text: t('patientReports.titleRequired'), error: true });
    setUploading(true);
    setUpMsg({ text: '', error: false });
    try {
      const fd = new FormData();
      fd.append('report', upFile);
      fd.append('title', upForm.title);
      fd.append('reportType', upForm.reportType);
      fd.append('description', upForm.description);
      if (upForm.reportDate) fd.append('reportDate', upForm.reportDate);
      const data = await medicalReportService.create(fd);
      setReports((prev) => [data.report, ...prev]);
      setUpForm({ title: '', reportType: 'blood_test', description: '', reportDate: '' });
      setUpFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setUpMsg({ text: t('patientReports.uploaded'), error: false });
    } catch (err) {
      setUpMsg({ text: err.response?.data?.message || t('common.error'), error: true });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    // Fetch my consultation records and lab reports.
    const load = async () => {
      setLoading(true);
      const pat = await patientService.getMyProfile();
      setPatient(pat);

      const [recs, reports] = await Promise.all([
        doctorService.getRecordsForPatient(pat._id),
        medicalReportService.getMyReports().catch(() => []),
      ]);

      setRecords(recs);
      if (recs.length) setExpanded(recs[0]._id);
      setReports(reports);
      setLoading(false);
    };
    load().catch((err) => {
      setError(err.response?.data?.message || 'Failed to load medical history.');
      setLoading(false);
    });
  }, []);

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('medicalHistory.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {patient ? `${patient.userId?.name} · ${patient.NIC}` : t('medicalHistory.subtitle')}
            </p>
          </div>
          {patient && (
            <button type="button" onClick={downloadFullHistory} disabled={historyPdfLoading}
              className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60">
              <Download size={15} />
              {historyPdfLoading ? t('medicalHistory.generating') : t('medicalHistory.fullHistoryPdf')}
            </button>
          )}
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <Tab label={t('medicalHistory.consultationRecords')} active={tab === 'records'} onClick={() => setTab('records')} count={records.length} />
          <Tab label={t('medicalHistory.labReports')} active={tab === 'reports'} onClick={() => setTab('reports')} count={reports.length} />
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : tab === 'records' ? (
          records.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400 text-sm">
              {t('medicalHistory.noRecords')}
            </div>
          ) : (
            /* Timeline of consultations — click a card to expand its details
               (symptoms, notes, prescription table, tags, PDF download) */
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-blue-100 z-0" />
              <div className="flex flex-col gap-5">
                {records.map((record) => {
                  const isOpen = expanded === record._id;
                  return (
                    <div key={record._id} className="flex gap-4 relative z-10">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isOpen ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-200'}`}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                          <path stroke={isOpen ? '#fff' : '#6B7280'} strokeWidth="1.5" strokeLinecap="round" d="M9 12h6M9 16h6M12 4v4M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>
                        </svg>
                      </div>
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden">
                        <button type="button" onClick={() => setExpanded(isOpen ? null : record._id)}
                          className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-blue-50/50 transition-colors">
                          <div>
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                              {record.diagnosis}
                              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                                {record.clinicId ? clinicDisplayName(record.clinicId, t) : t('clinicTypes.opd')}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(record.visitDate).toLocaleDateString()} · {withDrPrefix(record.doctorId?.userId?.name) || 'N/A'}
                            </div>
                          </div>
                          <span className="text-gray-400 text-xl font-light">{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 border-t border-gray-50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                              <div>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">{t('medicalHistory.symptoms')}</div>
                                <div className="text-sm text-gray-700">{record.symptoms}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">{t('medicalHistory.notes')}</div>
                                <div className="text-sm text-gray-700">{record.notes || record.treatmentNotes || 'N/A'}</div>
                              </div>
                              <div className="sm:col-span-2">
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">{t('medicalHistory.followUp')}</div>
                                <div className="text-sm text-gray-700">{record.followUpInstructions || 'N/A'}</div>
                              </div>
                            </div>
                            {record.prescription?.length > 0 && (
                              <div className="mt-4">
                                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">{t('medicalHistory.prescription')}</div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-blue-50">
                                        {[t('medicalHistory.medicine'), t('medicalHistory.dosage'), t('medicalHistory.duration')].map((h) => (
                                          <th key={h} className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-3 py-2 border-b border-blue-100">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {record.prescription.map((item, i) => (
                                        <tr key={i} className="border-b border-gray-50">
                                          <td className="px-3 py-2 font-medium text-gray-900">{item.medicine}</td>
                                          <td className="px-3 py-2 text-gray-600">{item.dosage}</td>
                                          <td className="px-3 py-2 text-gray-600">{item.duration}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {record.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {record.tags.map((tag) => (
                                  <span key={tag} className="bg-blue-50 text-blue-700 rounded-full px-3 py-0.5 text-xs font-medium">{tag}</span>
                                ))}
                              </div>
                            )}
                            <DownloadPdfButton recordId={record._id} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* ── Lab Reports & Files ── */
          <>
          {/* Patient self-upload: blood / ECG / x-ray reports etc. */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-blue-900">{t('patientReports.uploadReport')}</div>
              <button type="button" onClick={() => setShowUpload((v) => !v)}
                className="flex items-center gap-1.5 h-9 px-4 bg-amber-400 hover:bg-amber-500 text-blue-900 text-xs font-bold rounded-xl transition-colors">
                <Upload size={14} /> {showUpload ? t('common.close') : t('patientReports.uploadBtn')}
              </button>
            </div>
            {upMsg.text && (
              <div className={`rounded-xl p-3 text-sm mt-3 flex items-start gap-2 ${upMsg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{upMsg.text}
              </div>
            )}
            {showUpload && (
              <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('patientReports.reportTitle')} *</label>
                  <input className="w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    value={upForm.title} onChange={(e) => setUpForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={t('patientReports.reportTitlePlaceholder')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('patientReports.reportType')}</label>
                  <select className="w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={upForm.reportType} onChange={(e) => setUpForm((f) => ({ ...f, reportType: e.target.value }))}>
                    {Object.entries(REPORT_TYPES).map(([value, rt]) => <option key={value} value={value}>{rt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('patientReports.reportDate')}</label>
                  <input type="date" className="w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={upForm.reportDate} onChange={(e) => setUpForm((f) => ({ ...f, reportDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('patientReports.file')}</label>
                  <input ref={fileRef} type="file" accept=".pdf,image/*"
                    className="w-full text-xs text-gray-500 file:mr-3 file:h-10 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                    onChange={(e) => setUpFile(e.target.files?.[0] || null)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('patientReports.description')}</label>
                  <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    value={upForm.description} onChange={(e) => setUpForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('patientReports.descriptionPlaceholder')} />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={uploading}
                    className="w-full sm:w-auto px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    <Upload size={15} />
                    {uploading ? t('patientReports.uploading') : t('patientReports.uploadBtn')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Uploaded report cards — coloured by type, View opens the file */}
          {reports.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('medicalHistory.noReports')}</p>
              <p className="text-xs mt-1">{t('medicalHistory.noReportsHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {reports.map((report) => {
                const rt = REPORT_TYPES[report.reportType] || REPORT_TYPES.other;
                return (
                  <div key={report._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${report.fileType === 'pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                        {report.fileType === 'pdf'
                          ? <FileText size={18} className="text-red-500" />
                          : <ImageIcon size={18} className="text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{report.title}</div>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${rt.cls}`}>{rt.label}</span>
                      </div>
                    </div>
                    {report.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{report.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{new Date(report.reportDate).toLocaleDateString()}</span>
                      <a href={report.fileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                        <ExternalLink size={12} /> {t('medicalHistory.view')}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default MedicalHistory;
