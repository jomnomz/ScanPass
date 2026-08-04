# ScanPass

ScanPass is a full-stack QR Code attendance management system built with React, Supabase, PostgreSQL, and React Native. It automates student attendance tracking, SMS notifications, and school data management through an intuitive web dashboard and mobile QR scanner.

ScanPass streamlines student attendance by replacing manual logging with QR code scanning while automatically notifying parents or guardians through SMS whenever a student checks in or checks out of the school.

---

## Overview

Traditional attendance systems are often time-consuming, prone to human error, and provide delayed communication with parents.

ScanPass addresses these issues by providing:

- QR Code-based attendance
- Real-time check-in/check-out Attendance logging
- SMS notifications to parents/guardians
- Student and faculty management
- Excel import for bulk data management

---

## Features

### Student Management

- Add, edit, archive, and restore students
- Upload student profile pictures
- Generate QR Codes for student IDs
- Bulk import students through Excel

### Attendance Monitoring

- Real-time attendance logging
- Daily attendance records
- Attendance history
- Search and filter attendance

### QR Code Scanner

- Mobile application for scanning student IDs
- Instant attendance recording
- Fast QR code recognition

### Parent Notifications

- SMS notifications for:
  - Student Check-In
  - Student Check-Out

### Faculty Management

- Manage teacher accounts
- Role-based access control
- Account invitation via email

### Academic Management

- School Years
- Grades
- Sections
- Class Schedules

### Dashboard

- Attendance statistics
- Student statistics
- Recent attendance logs
- Data visualization

### Excel Import System

Supports bulk importing of:

- Students
- Faculty
- Grades
- Sections
- School Years
- Class Schedules

---

## Built With

### Frontend

- React
- Vite
- React Router
- CSS Modules

### Backend

- Supabase
- PostgreSQL

### Mobile

- React Native
- Expo

### Services

- Resend (Email)
- iProg SMS API
- Supabase Storage

---

## Screenshots

> Add screenshots here.

Examples:

- Login Page
- Dashboard
- Student Management
- Attendance Logs
- QR Code Generator
- Mobile Scanner
- SMS Notification

---

## Project Structure

```
src/
│
├── assets/
├── components/
├── context/
├── hooks/
├── layouts/
├── pages/
├── routes/
├── services/
├── utils/
└── App.jsx
```

---

## User Roles

### Super Admin

- Full system access
- Manage faculty
- Manage students
- Import data
- Generate QR Codes
- View attendance reports

### Teachers

- View attendance
- Manage assigned students
- Generate reports

### Scanner App

- Scan QR Codes
- Record attendance
- Trigger SMS notifications

---

## Research Objectives

The system aims to:

- Improve attendance accuracy
- Reduce manual attendance recording
- Notify parents in real time
- Enhance student security
- Simplify school attendance management

---

## License

This project was developed as a capstone project for academic purposes.

---

## Developers

Developed by Jomeo Renz A. Dela Cruz.
