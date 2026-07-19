/**
 * PatientReports.jsx — staff/doctor page for lab-report files.
 * Search a patient, then view, upload (PDF/image → Cloudinary), and
 * delete their reports. Also shows the patient's consultation records
 * with clinic labels and a history-PDF download.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, ImageIcon, Trash2, ExternalLink, AlertCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doctorService, medicalReportService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import PatientSearchInput from '../../components/PatientSearchInput.jsx';

const REPORT_TYPES = [
  { value: 'blood_test',   label: 'Blood Test' },
  { value: 'urine_test',   label: 'Urine Test' },
  { value: 'xray',         label: 'X-Ray' },
  { value: 'scan',         label: 'Scan / MRI' },
  { value: 'ecg',          label: 'ECG' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'other',        label: 'Other' },
];

const TYPE_COLORS = {
  blood_test:   'bg-red-100 text-red-700',
  urine_test:   'bg-amber-100 text-amber-700',
  xray:         'bg-purple-100 text-purple-700',
  scan:         'bg-sky-100 text-sky-700',
  ecg:          'bg-green-100 text-green-700',
  prescription: 'bg-indigo-100 text-indigo-700',
  other:        'bg-gray-100 text-gray-600',
};

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5';

// Page component.
const PatientReports = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const fileRef = useRef(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ title: '', reportType: 'blood_test', description: '', reportDate: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [loading, setLoading] = useState(false);

  // Set the active patient (from search or navigation state).
  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    loadReports(patient._id);
  };

  // Download this patient's history PDF.
  const downloadFullHistory = async () => {
    if (!selectedPatient) return;
    setPdfLoading(true);
    try { await doctorService.downloadHistoryPdf(selectedPatient._id, selectedPatient.userId?.name); }
    catch { setMsg({ text: t('common.error'), error: true }); }
    finally { setPdfLoading(false); }
  };

  // Arriving from the navbar patient search — auto-select that patient
  useEffect(() => {
    const preselect = location.state?.patient;
    if (preselect?._id) selectPatient(preselect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Fetch the patient's lab reports + consultation records.
  const loadReports = async (patientId) => {
    setLoading(true);
    try {
      const reports = await medicalReportService.getByPatient(patientId);
      setReports(reports);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  // Update one upload-form field.
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Upload the chosen report file (PDF/image).
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return setMsg({ text: t('patientReports.selectFirst'), error: true });
    if (!file) return setMsg({ text: t('patientReports.selectFile'), error: true });
    if (!form.title.trim()) return setMsg({ text: t('patientReports.titleRequired'), error: true });

    setUploading(true);
    setMsg({ text: '', error: false });
    try {
      const fd = new FormData();
      fd.append('report', file);
      fd.append('patientId', selectedPatient._id);
      fd.append('title', form.title);
      fd.append('reportType', form.reportType);
      fd.append('description', form.description);
      if (form.reportDate) fd.append('reportDate', form.reportDate);

      const data = await medicalReportService.create(fd);
      setReports((prev) => [data.report, ...prev]);
      setMsg({ text: t('patientReports.uploaded'), error: false });
      setForm({ title: '', reportType: 'blood_test', description: '', reportDate: '' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setMsg({ text: err.response?.data?.message || t('common.error'), error: true });
    } finally {
      setUploading(false);
    }
  };

  // Delete a report after confirmation.
  const handleDelete = async (id) => {
    if (!window.confirm(t('patientReports.deleteConfirm'))) return;
    try {
      await medicalReportService.remove(id);
      setReports((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || t('common.error'));
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('patientReports.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('patientReports.subtitle')}</p>
        </div>

        {/* Two columns: left = search + upload form, right = report list */}
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">
          <div className="flex flex-col gap-4">
            {/* Patient search card — pick who the reports belong to */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="text-sm font-bold text-blue-900 mb-3">{t('patientReports.findPatient')}</div>
              <div className="mb-2">
                <PatientSearchInput placeholder={t('patientReports.searchPlaceholder')} onSelect={selectPatient} />
              </div>

              {/* Selected patient chip with full-history PDF download */}
              {selectedPatient && (
                <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-blue-900 truncate">{selectedPatient.userId?.name}</div>
                    <div className="text-xs text-gray-500">{selectedPatient.NIC || selectedPatient.userId?.NIC}</div>
                    {(selectedPatient.registeredClinics || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedPatient.registeredClinics.map((clinic) => (
                          <span key={clinic?._id || clinic} className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                            {clinicDisplayName(clinic, t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onClick={downloadFullHistory} disabled={pdfLoading}
                      title={t('patientReports.fullHistoryPdf')}
                      className="flex items-center gap-1 h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-60">
                      <Download size={12} /> PDF
                    </button>
                    <button type="button" onClick={() => { setSelectedPatient(null); setReports([]); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1">✕</button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload form — title, type, date, description + PDF/image file */}
            {selectedPatient && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-sm font-bold text-blue-900 mb-4">{t('patientReports.uploadReport')}</div>

                {msg.text && (
                  <div className={`rounded-xl p-3 text-sm mb-3 flex items-start gap-2 ${msg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{msg.text}
                  </div>
                )}

                <form onSubmit={handleUpload} className="space-y-3">
                  <div>
                    <label className={labelClass}>{t('patientReports.reportTitle')} *</label>
                    <input className={inputClass} placeholder={t('patientReports.reportTitlePlaceholder')} value={form.title} onChange={set('title')} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('patientReports.reportType')}</label>
                    <select className={inputClass} value={form.reportType} onChange={set('reportType')}>
                      {REPORT_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('patientReports.reportDate')}</label>
                    <input type="date" className={inputClass} value={form.reportDate} onChange={set('reportDate')} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('patientReports.description')}</label>
                    <textarea className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      rows={3} placeholder={t('patientReports.descriptionPlaceholder')} value={form.description} onChange={set('description')} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('patientReports.file')}</label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-blue-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      {file ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-700 font-medium">
                          {file.type === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                          {file.name}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">
                          <Upload size={20} className="mx-auto mb-1 text-blue-300" />
                          {t('patientReports.clickToSelect')}
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <div className="text-[10px] text-gray-400 mt-1">{t('patientReports.fileHint')}</div>
                  </div>

                  <button type="submit" disabled={uploading}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    <Upload size={15} />
                    {uploading ? t('patientReports.uploading') : t('patientReports.uploadBtn')}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Report list — each row: file icon, title, type chip, view/delete */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-bold text-blue-900 mb-4">
              {selectedPatient ? `${t('patientReports.reportsFor')} ${selectedPatient.userId?.name}` : t('patientReports.selectToView')}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">{t('patientReports.loadingReports')}</div>
            ) : !selectedPatient ? (
              <div className="text-center py-12 text-gray-300">
                <FileText size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('patientReports.searchAndSelect')}</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-gray-300">
                <FileText size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('patientReports.noReports')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report._id} className="border border-gray-100 rounded-2xl p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${report.fileType === 'pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                          {report.fileType === 'pdf'
                            ? <FileText size={18} className="text-red-500" />
                            : <ImageIcon size={18} className="text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{report.title}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${TYPE_COLORS[report.reportType] || TYPE_COLORS.other}`}>
                              {REPORT_TYPES.find((rt) => rt.value === report.reportType)?.label || report.reportType}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(report.reportDate).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-400">{t('patientReports.by')} {report.uploadedBy?.name}</span>
                          </div>
                          {report.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{report.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={report.fileUrl} target="_blank" rel="noreferrer"
                          className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors" title={t('common.view')}>
                          <ExternalLink size={14} className="text-blue-600" />
                        </a>
                        <button type="button" onClick={() => handleDelete(report._id)}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors" title={t('common.delete')}>
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientReports;
