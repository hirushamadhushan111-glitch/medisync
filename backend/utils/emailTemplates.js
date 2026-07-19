/**
 * emailTemplates.js — styled HTML email bodies.
 * Inline CSS only — most email clients ignore <style> blocks.
 * Each template is a pure function: data in → HTML string out.
 */

// Sent to a doctor when the admin schedules them for a clinic session.
const clinicScheduleEmail = ({ doctorName, clinicName, dateStr, startTime, endTime }) => `
<div style="margin:0;padding:24px;background:#eff6ff;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbeafe;">
    <div style="background:#1e3a8a;padding:22px 28px;">
      <div style="color:#ffffff;font-size:22px;font-weight:bold;">&#43; MediSync</div>
      <div style="color:#bfdbfe;font-size:12px;margin-top:3px;letter-spacing:1px;text-transform:uppercase;">Clinic Schedule Notification</div>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 14px;color:#111827;font-size:15px;">Dear <strong>${doctorName}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
        You have been scheduled to conduct the following clinic session. Please be available on time.
      </p>
      <table style="width:100%;border-collapse:separate;border-spacing:0;background:#eff6ff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:12px 18px;color:#6b7280;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Clinic</td>
          <td style="padding:12px 18px;color:#111827;font-size:14px;font-weight:600;">${clinicName}</td>
        </tr>
        <tr>
          <td style="padding:12px 18px;color:#6b7280;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #dbeafe;">Date</td>
          <td style="padding:12px 18px;color:#111827;font-size:14px;font-weight:600;border-top:1px solid #dbeafe;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:12px 18px;color:#6b7280;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #dbeafe;">Time</td>
          <td style="padding:12px 18px;color:#111827;font-size:14px;font-weight:600;border-top:1px solid #dbeafe;">${startTime} &ndash; ${endTime}</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        If you are unavailable for this session, please inform the hospital administration as soon as possible.
      </p>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:11px;">
      This is an automated message from the MediSync clinic management system. Please do not reply to this email.
    </div>
  </div>
</div>`;

module.exports = { clinicScheduleEmail };
