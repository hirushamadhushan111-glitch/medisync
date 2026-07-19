/**
 * Central barrel export for all API service singletons.
 *
 * OOP Concept: Service Layer pattern
 * Each service is a singleton instance of a class that extends BaseApiService.
 * Components import exactly the service they need — no raw axios calls.
 *
 * Usage:
 *   import { patientService, clinicService } from '../../api';
 */

export { default as authService }          from './services/AuthApiService';
export { default as patientService }       from './services/PatientApiService';
export { default as doctorService }        from './services/DoctorApiService';
export { default as appointmentService }   from './services/AppointmentApiService';
export { default as clinicService }        from './services/ClinicApiService';
export { default as clinicSessionService } from './services/ClinicSessionApiService';
export { default as queueService }         from './services/QueueApiService';
export { default as notificationService }  from './services/NotificationApiService';
export { default as reportService }        from './services/ReportApiService';
export { default as medicalReportService } from './services/MedicalReportApiService';
export { default as adminService }         from './services/AdminApiService';
