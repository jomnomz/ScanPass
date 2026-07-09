# Role Page Map

This document summarizes what each user-facing page does in this repo and which significant files build that page.

I kept out small presentational atoms like simple buttons, labels, and icon-only helpers unless they are part of the page's main behavior.

## Routing And Shell

- [src/App.jsx](src/App.jsx) defines the role gates and the route tree.
- [src/Components/Authentication/AuthProvider/AuthProvider.jsx](src/Components/Authentication/AuthProvider/AuthProvider.jsx) loads the signed-in user plus the `users` table profile used for role checks.
- [src/Components/Authentication/ProtectedRoutes/ProtectedRoute.jsx](src/Components/Authentication/ProtectedRoutes/ProtectedRoute.jsx) blocks inactive users and mismatched roles.
- [src/Components/Layouts/AdminLayout/AdminLayout.jsx](src/Components/Layouts/AdminLayout/AdminLayout.jsx) wraps all admin pages with the admin nav shell.
- [src/Components/Layouts/TeacherLayout/TeacherLayout.jsx](src/Components/Layouts/TeacherLayout/TeacherLayout.jsx) wraps all teacher pages with the teacher nav shell.
- [src/Components/NavBars/NavBar/NavBar.jsx](src/Components/NavBars/NavBar/NavBar.jsx) renders the role-aware sidebar and logout behavior.

## Shared Entry Pages

### Login

What it does:
- Entry page for unauthenticated users.
- Shows the login form and auto-redirects signed-in users to the correct dashboard by role.

Files involved:
- [src/Pages/LoginPage/LoginPage.jsx](src/Pages/LoginPage/LoginPage.jsx)
- [src/Components/Forms/LoginForm/LoginForm.jsx](src/Components/Forms/LoginForm/LoginForm.jsx)
- [src/Components/Authentication/AuthProvider/AuthProvider.jsx](src/Components/Authentication/AuthProvider/AuthProvider.jsx)

### Confirm Invitation

What it does:
- Verifies teacher invitation links from query params.
- Shows success or error feedback, then redirects back to login.

Files involved:
- [src/Pages/ConfirmInvitation/ConfirmInvitation.jsx](src/Pages/ConfirmInvitation/ConfirmInvitation.jsx)

Note:
- This page currently redirects to `/login`, but the router in [src/App.jsx](src/App.jsx) uses `/` for the login page.

## Admin Role Pages

### Admin Dashboard

What it does:
- Shows high-level school metrics for admins.
- Displays total students, total teachers, teacher accounts, and SMS notifications sent today.
- Renders trend charts for attendance/activity overview.

Files involved:
- [src/Pages/AdminPages/AdminDashboard/AdminDashboard.jsx](src/Pages/AdminPages/AdminDashboard/AdminDashboard.jsx)
- [src/Components/Hooks/fetchData.js](src/Components/Hooks/fetchData.js)
- [src/lib/supabase.js](src/lib/supabase.js)
- [src/Components/Charts/BarGraph/BarGraph.jsx](src/Components/Charts/BarGraph/BarGraph.jsx)
- [src/Components/Charts/LineChart/LineChart.jsx](src/Components/Charts/LineChart/LineChart.jsx)
- [src/Components/UI/Cards/DashboardCard/DashboardCard.jsx](src/Components/UI/Cards/DashboardCard/DashboardCard.jsx)

### Admin Students

What it does:
- Manages the student roster.
- Supports search, grade and section filtering, paging, bulk selection, bulk delete, export, QR download, and file import.

Files involved:
- [src/Pages/AdminPages/AdminStudents/AdminStudents.jsx](src/Pages/AdminPages/AdminStudents/AdminStudents.jsx)
- [src/Components/Tables/StudentTable/StudentTable.jsx](src/Components/Tables/StudentTable/StudentTable.jsx)
- [src/Components/Modals/FileUploadModal/FileUploadModal.jsx](src/Components/Modals/FileUploadModal/FileUploadModal.jsx)
- [src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx](src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx)
- [src/Components/Modals/DownloadQRModal/DownloadQRModal.jsx](src/Components/Modals/DownloadQRModal/DownloadQRModal.jsx)
- [src/Utils/EntityService.js](src/Utils/EntityService.js)
- [src/Utils/exportEntity.js](src/Utils/exportEntity.js)
- [src/Utils/SortEntities.js](src/Utils/SortEntities.js)
- [src/lib/supabase.js](src/lib/supabase.js)
- [src/Components/Toast/ToastContext/ToastContext.jsx](src/Components/Toast/ToastContext/ToastContext.jsx)

### Admin Guardians

What it does:
- Shows guardian records derived from student data.
- Supports search, grade and section filtering, sorting, and paging.

Files involved:
- [src/Pages/AdminPages/AdminGuardians/AdminGuardians.jsx](src/Pages/AdminPages/AdminGuardians/AdminGuardians.jsx)
- [src/Components/Tables/GuardianTable/GuardianTable.jsx](src/Components/Tables/GuardianTable/GuardianTable.jsx)
- [src/Utils/SortEntities.js](src/Utils/SortEntities.js)
- [src/lib/supabase.js](src/lib/supabase.js)

### Admin Messages

What it does:
- Displays SMS notification records.
- Lets admins search messages and filter by date using the calendar picker.
- Refreshes available dates when SMS logs change.

Files involved:
- [src/Pages/AdminPages/AdminMessages/AdminMessages.jsx](src/Pages/AdminPages/AdminMessages/AdminMessages.jsx)
- [src/Components/Tables/MessageTable/MessageTable.jsx](src/Components/Tables/MessageTable/MessageTable.jsx)
- [src/Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar.jsx](src/Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar.jsx)
- [src/lib/supabase.js](src/lib/supabase.js)

### Admin Attendance

What it does:
- Displays attendance records by date.
- Supports search, grade and section filtering, paging, and date selection.
- Falls back to a direct attendance scan if the date RPC fails.

Files involved:
- [src/Pages/AdminPages/AdminAttendace/AdminAttendance.jsx](src/Pages/AdminPages/AdminAttendace/AdminAttendance.jsx)
- [src/Components/Tables/AttendanceTable/AttendanceTable.jsx](src/Components/Tables/AttendanceTable/AttendanceTable.jsx)
- [src/Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar.jsx](src/Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar.jsx)
- [src/lib/supabase.js](src/lib/supabase.js)

### Admin Master Data

What it does:
- Manages the school master data set across three tabs: grade and section, subjects, and schedules.
- Supports search, paging, bulk selection, bulk delete, import, and export.
- Keeps all three tables mounted so data is available for export even when a tab is hidden.

Files involved:
- [src/Pages/AdminPages/AdminMasterData/AdminMasterData.jsx](src/Pages/AdminPages/AdminMasterData/AdminMasterData.jsx)
- [src/Components/Tables/GradeSectionTable/GradeSectionTable.jsx](src/Components/Tables/GradeSectionTable/GradeSectionTable.jsx)
- [src/Components/Tables/SubjectTable/SubjectTable.jsx](src/Components/Tables/SubjectTable/SubjectTable.jsx)
- [src/Components/Tables/GradeSchedulesTable/GradeSchedulesTable.jsx](src/Components/Tables/GradeSchedulesTable/GradeSchedulesTable.jsx)
- [src/Components/Modals/FileUploadModal/FileUploadModal.jsx](src/Components/Modals/FileUploadModal/FileUploadModal.jsx)
- [src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx](src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx)
- [src/Utils/EntityService.js](src/Utils/EntityService.js)
- [src/Utils/exportEntity.js](src/Utils/exportEntity.js)

### Admin Teachers

What it does:
- Manages teacher records.
- Supports import, export, search, paging, bulk selection, bulk delete, and teacher invitations.
- Creates invitation emails and sends teacher account actions through the backend.

Files involved:
- [src/Pages/AdminPages/AdminTeachers/AdminTeachers.jsx](src/Pages/AdminPages/AdminTeachers/AdminTeachers.jsx)
- [src/Components/Tables/TeacherTable/TeacherTable.jsx](src/Components/Tables/TeacherTable/TeacherTable.jsx)
- [src/Components/Modals/FileUploadModal/FileUploadModal.jsx](src/Components/Modals/FileUploadModal/FileUploadModal.jsx)
- [src/Components/Modals/InviteModal/InviteModal.jsx](src/Components/Modals/InviteModal/InviteModal.jsx)
- [src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx](src/Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx)
- [src/Components/Hooks/useEntities.js](src/Components/Hooks/useEntities.js)
- [src/Utils/EntityService.js](src/Utils/EntityService.js)
- [src/Utils/exportEntity.js](src/Utils/exportEntity.js)
- [src/config/api.js](src/config/api.js)
- [src/lib/supabase.js](src/lib/supabase.js)

### Admin Reports

What it does:
- Shows the attendance report view for admins.

Files involved:
- [src/Pages/AdminPages/AdminReports/AdminReports.jsx](src/Pages/AdminPages/AdminReports/AdminReports.jsx)
- [src/Components/Tables/ReportTable/ReportTable.jsx](src/Components/Tables/ReportTable/ReportTable.jsx)

### Admin Settings

What it does:
- Lets the signed-in user change password.
- Includes the chatbot assistant panel.

Files involved:
- [src/Pages/AdminPages/AdminSettings/AdminSettings.jsx](src/Pages/AdminPages/AdminSettings/AdminSettings.jsx)
- [src/Components/Forms/ChangePasswordForm/ChangePasswordForm.jsx](src/Components/Forms/ChangePasswordForm/ChangePasswordForm.jsx)
- [src/Components/Forms/Chatbot/Chatbot.jsx](src/Components/Forms/Chatbot/Chatbot.jsx)
- [src/config/api.js](src/config/api.js)
- [src/Components/Authentication/AuthProvider/AuthProvider.jsx](src/Components/Authentication/AuthProvider/AuthProvider.jsx)

## Teacher Role Pages

### Teacher Dashboard

What it does:
- Shows teacher-specific counts for assigned students, subjects, and classes.
- Renders teacher-only charts based on the logged-in teacher's assignments.

Files involved:
- [src/Pages/TeacherPages/TeacherDashboard/TeacherDashboard.jsx](src/Pages/TeacherPages/TeacherDashboard/TeacherDashboard.jsx)
- [src/Components/Hooks/useTeacherClasses.js](src/Components/Hooks/useTeacherClasses.js)
- [src/Components/Hooks/fetchData.js](src/Components/Hooks/fetchData.js)
- [src/Components/Charts/TeacherBarGraph/TeacherBarGraph.jsx](src/Components/Charts/TeacherBarGraph/TeacherBarGraph.jsx)
- [src/Components/Charts/TeacherLineChart/TeacherLineChart.jsx](src/Components/Charts/TeacherLineChart/TeacherLineChart.jsx)
- [src/Components/Charts/TeacherPieChart/TeacherPieChart.jsx](src/Components/Charts/TeacherPieChart/TeacherPieChart.jsx)

### Teacher Students

What it does:
- Shows the student view for one selected class.
- Reads the class key from the query string and passes it into the teacher student table.

Files involved:
- [src/Pages/TeacherPages/TeacherStudents/TeacherStudents.jsx](src/Pages/TeacherPages/TeacherStudents/TeacherStudents.jsx)
- [src/Components/Tables/TeacherStudentViewTable/TeacherStudentViewTable.jsx](src/Components/Tables/TeacherStudentViewTable/TeacherStudentViewTable.jsx)

### Teacher Attendance

What it does:
- Shows the teacher's assigned classes as attendance cards.
- Resolves the teacher identity from auth and then loads classes from the backend.
- Caches the class list in session storage and refreshes it when stale.

Files involved:
- [src/Pages/TeacherPages/TeacherAtendace/TeacherAttendance.jsx](src/Pages/TeacherPages/TeacherAtendace/TeacherAttendance.jsx)
- [src/Components/UI/Cards/AttendanceCard/AttendanceCard.jsx](src/Components/UI/Cards/AttendanceCard/AttendanceCard.jsx)
- [src/Components/Authentication/AuthProvider/AuthProvider.jsx](src/Components/Authentication/AuthProvider/AuthProvider.jsx)
- [server/routes/teacherInvite.js](server/routes/teacherInvite.js)
- [server/server.js](server/server.js)

### Teacher Reports

What it does:
- Currently only renders a page shell for reports.
- It does not yet mount a report table or data view.

Files involved:
- [src/Pages/TeacherPages/TeacherReports/TeacherReports.jsx](src/Pages/TeacherPages/TeacherReports/TeacherReports.jsx)

### Teacher Settings

What it does:
- Provides a teacher-facing change password and logout screen.
- Includes the chatbot assistant panel.

Files involved:
- [src/Pages/TeacherPages/TeacherSettings/TeacherSettings.jsx](src/Pages/TeacherPages/TeacherSettings/TeacherSettings.jsx)
- [src/Components/Forms/ChangePasswordForm/ChangePasswordForm.jsx](src/Components/Forms/ChangePasswordForm/ChangePasswordForm.jsx)
- [src/Components/Forms/Chatbot/Chatbot.jsx](src/Components/Forms/Chatbot/Chatbot.jsx)
- [src/config/api.js](src/config/api.js)
- [src/lib/supabase.js](src/lib/supabase.js)

## Notes

- The teacher settings component exists at [src/Pages/TeacherPages/TeacherSettings/TeacherSettings.jsx](src/Pages/TeacherPages/TeacherSettings/TeacherSettings.jsx), but [src/App.jsx](src/App.jsx) currently routes `/teacher/settings` to [src/Pages/AdminPages/AdminSettings/AdminSettings.jsx](src/Pages/AdminPages/AdminSettings/AdminSettings.jsx) instead.
- The teacher settings file looks like a duplicate or alternate implementation rather than the one used by the router.
- The attendance page folder is spelled `AdminAttendace` in the filesystem and route imports.
- Some page behavior depends on backend endpoints in `server/`, especially teacher invitations, teacher class lookup, password changes, and class or attendance data fetching.