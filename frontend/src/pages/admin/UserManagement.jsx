/**
 * UserManagement.jsx — admin page for all user accounts.
 *
 * Create doctor/staff accounts (QA-validated like the register pages),
 * list every user, edit role/status, delete accounts, and assign staff
 * members to clinics via the modal. (Patients are registered on the
 * staff Register Patient page, which collects the full profile.)
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminService, authService, clinicService } from '../../api';
import { clinicDisplayName, clinicTypeLabel } from '../../utils/clinicTypes';
import { DEPARTMENTS } from '../../utils/departments';
import { withDrPrefix } from '../../utils/names';
import { getAccountFieldError } from '../../utils/validators';
import Toast from '../../components/Toast.jsx';

const emptyUser = { name: '', email: '', password: '', role: 'patient', phone: '', NIC: '', designation: 'Receptionist', department: '', specialization: '' };

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

// Small coloured chip showing a user's role.
const rolePill = (role) => {
  const map = { admin: 'bg-purple-100 text-purple-700', doctor: 'bg-green-100 text-green-700', staff: 'bg-amber-100 text-amber-700', patient: 'bg-blue-100 text-blue-700' };
  return <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${map[role] || 'bg-gray-100 text-gray-600'}`}>{role}</span>;
};

// Modal: choose which clinics a staff member manages.
const ClinicAssignModal = ({ user, clinics, onSave, onClose, t }) => {
  const currentIds = new Set((user.assignedClinics || []).map((c) => c._id || c));
  const [selected, setSelected] = useState(new Set(currentIds));
  const [saving, setSaving] = useState(false);

  // Tick/untick one clinic in the modal.
  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Save the clinic assignment.
  const save = async () => {
    setSaving(true);
    await onSave(user._id, [...selected]);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-bold text-blue-900">{t('userMgmt.assignClinics')}</div>
            <div className="text-xs text-gray-500 mt-0.5">{user.name} · {user.designation || 'Staff'}</div>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-lg transition-colors">✕</button>
        </div>

        {clinics.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">{t('userMgmt.noClinics')}</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {clinics.map((clinic) => (
              <label key={clinic._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={selected.has(clinic._id)} onChange={() => toggle(clinic._id)} className="w-4 h-4 accent-blue-600" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{clinicDisplayName(clinic, t)}</div>
                  <div className="text-xs text-gray-400">{clinicTypeLabel(clinic.departmentType, t)}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60">
            {saving ? t('userMgmt.saving') : t('userMgmt.saveAssignment')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Page component.
const UserManagement = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [newUser, setNewUser] = useState(emptyUser);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [assignModal, setAssignModal] = useState(null);

  // Refresh the users table.
  const loadUsers = async () => {
    const users = await adminService.getAll();
    setUsers(users);
  };

  useEffect(() => {
    // Initial load: users + clinics in parallel.
    const load = async () => {
      const [users, clinics] = await Promise.all([adminService.getAll(), clinicService.getAll()]);
      setUsers(users);
      setClinics(clinics);
    };
    load().catch((err) => setError(err.response?.data?.message || t('userMgmt.failedLoad')));
  }, []);

  // Create a doctor/staff account from the form (QA-validated).
  const createUser = async (event) => {
    event.preventDefault(); setError(''); setMessage('');

    // Same QA standard as the register pages: valid email, password ≥ 6,
    // phone = 10 digits, Sri Lankan NIC (see utils/validators.js).
    const accountError = getAccountFieldError(newUser, t);
    if (accountError) { setError(accountError); return; }

    try {
      const payload = { ...newUser };
      if (payload.role === 'doctor') payload.name = withDrPrefix(payload.name);
      else { delete payload.department; delete payload.specialization; }
      if (payload.role !== 'staff') delete payload.designation;
      await authService.createUser(payload);
      setNewUser(emptyUser);
      await loadUsers();
      setMessage(t('userMgmt.userCreated'));
    } catch (err) { setError(err.response?.data?.message || t('userMgmt.failedCreate')); }
  };

  // Save edits to a user (role, status, etc.).
  const updateUser = async (id, updates) => {
    setError(''); setMessage('');
    try {
      await adminService.updateUser(id, updates);
      await loadUsers();
      setMessage(t('userMgmt.userUpdated'));
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
  };

  // Delete a user after confirmation.
  const deleteUser = async (id) => {
    if (!window.confirm(t('userMgmt.deleteConfirm'))) return;
    await adminService.deleteUser(id);
    await loadUsers();
  };

  // Persist the modal's clinic assignment for a staff member.
  const handleAssignClinics = async (userId, clinicIds) => {
    setError(''); setMessage('');
    try {
      await adminService.assignStaffClinics(userId, clinicIds);
      await loadUsers();
      setAssignModal(null);
      setMessage(t('userMgmt.assignUpdated'));
    } catch (err) {
      setError(err.response?.data?.message || t('userMgmt.failedAssign'));
      setAssignModal(null);
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('userMgmt.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('userMgmt.subtitle')}</p>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        {/* Create-account card — extra fields appear based on the chosen role
            (designation for staff, department/specialization for doctors) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="text-base font-bold text-blue-900 mb-4">{t('userMgmt.createAccount')}</div>
          <form onSubmit={createUser}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
              {[
                ['name', t('userMgmt.name'), 'text'],
                ['email', t('userMgmt.email'), 'email'],
                ['password', t('userMgmt.password'), 'password'],
                ['phone', t('userMgmt.phone'), 'text'],
                ['NIC', t('userMgmt.nic'), 'text'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className={labelClass} htmlFor={`new-${field}`}>{label}</label>
                  <input id={`new-${field}`} className={inputClass} type={type} value={newUser[field]}
                    onChange={(e) => setNewUser({ ...newUser, [field]: e.target.value })} required />
                </div>
              ))}
              <div>
                <label className={labelClass} htmlFor="new-role">{t('userMgmt.role')}</label>
                <select id="new-role" className={inputClass} value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  {['patient', 'doctor', 'staff'].map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              {newUser.role === 'staff' && (
                <div>
                  <label className={labelClass} htmlFor="new-designation">{t('userMgmt.designation')}</label>
                  <select id="new-designation" className={inputClass} value={newUser.designation}
                    onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}>
                    <option value="Receptionist">{t('userMgmt.receptionist')}</option>
                    <option value="Nurse">{t('userMgmt.nurse')}</option>
                  </select>
                </div>
              )}
              {newUser.role === 'doctor' && (
                <>
                  <div>
                    <label className={labelClass} htmlFor="new-department">{t('userMgmt.department')}</label>
                    <select id="new-department" className={inputClass} value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value, specialization: '' })} required>
                      <option value="">{t('registerDoctor.selectDept')}</option>
                      {DEPARTMENTS.map((dept) => <option key={dept.key} value={dept.en}>{t(`departments.${dept.key}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="new-specialization">{t('userMgmt.specialization')}</label>
                    <select id="new-specialization" className={inputClass} value={newUser.specialization}
                      onChange={(e) => setNewUser({ ...newUser, specialization: e.target.value })} disabled={!newUser.department} required>
                      <option value="">{newUser.department ? t('registerDoctor.selectSpec') : t('registerDoctor.selectDeptFirst')}</option>
                      {(DEPARTMENTS.find((dept) => dept.en === newUser.department)?.specializations || []).map((spec) => (
                        <option key={spec.key} value={spec.en}>{t(`specializations.${spec.key}`)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <button className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors" type="submit">
              {t('userMgmt.createBtn')}
            </button>
          </form>
        </div>

        {/* All-users table — role dropdown, clinic chips (staff), active toggle,
            delete. Own row is locked (isSelf) so admin can't lock themselves out. */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-base font-bold text-blue-900 mb-4">{t('userMgmt.allUsers')}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  {[t('userMgmt.name'), t('userMgmt.email'), t('userMgmt.role'), t('userMgmt.phone'), t('userMgmt.clinics'), t('userMgmt.status'), ''].map((h) => (
                    <th key={h} className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-4 py-3 border-b-2 border-blue-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user._id === currentUser?._id;
                  return (
                  <tr key={user._id} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {user.name}
                      {isSelf && <span className="ml-2 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{t('userMgmt.you')}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <select className="h-7 border border-gray-200 rounded-lg px-2 text-xs bg-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        value={user.role} disabled={isSelf} title={isSelf ? t('userMgmt.selfLocked') : undefined}
                        onChange={(e) => updateUser(user._id, { role: e.target.value })}>
                        {['patient', 'doctor', 'staff', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.phone}</td>
                    <td className="px-4 py-3">
                      {user.role === 'staff' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {(user.assignedClinics || []).length > 0
                            ? user.assignedClinics.map((c) => (
                                <span key={c._id} className="text-[10px] bg-blue-100 text-blue-700 font-semibold rounded-full px-2 py-0.5">{clinicDisplayName(c, t)}</span>
                              ))
                            : <span className="text-[10px] text-gray-400">{t('userMgmt.none')}</span>
                          }
                          <button type="button" onClick={() => setAssignModal(user)}
                            className="text-[10px] border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-0.5 font-semibold transition-colors">
                            {t('common.edit')}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <label className={`relative inline-flex items-center ${isSelf ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        title={isSelf ? t('userMgmt.selfLocked') : undefined}>
                        <input type="checkbox" checked={user.isActive} className="sr-only peer" disabled={isSelf}
                          onChange={(e) => updateUser(user._id, { isActive: e.target.checked })} />
                        <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => deleteUser(user._id)} disabled={isSelf}
                        title={isSelf ? t('userMgmt.selfLocked') : undefined}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Popup for ticking which clinics a staff member works in */}
      {assignModal && (
        <ClinicAssignModal user={assignModal} clinics={clinics} onSave={handleAssignClinics} onClose={() => setAssignModal(null)} t={t} />
      )}
    </div>
  );
};

export default UserManagement;
