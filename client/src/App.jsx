import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import CandidateLayout from './layouts/CandidateLayout';
import AdminLayout from './layouts/AdminLayout';

// Route Guards
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';

// Public Pages
import HomePage from './pages/public/HomePage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import PublicSlotsPage from './pages/public/PublicSlotsPage';
import PublicAssessmentsPage from './pages/public/PublicAssessmentsPage';
import ForbiddenPage from './pages/public/ForbiddenPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Candidate Pages
import CandidateDashboardPage from './pages/candidate/CandidateDashboardPage';
import CandidateProfilePage from './pages/candidate/CandidateProfilePage';
import AvailableSlotsPage from './pages/candidate/AvailableSlotsPage';
import MyBookingsPage from './pages/candidate/MyBookingsPage';
import InterviewDetailsPage from './pages/candidate/InterviewDetailsPage';
import CandidateAssessmentsPage from './pages/candidate/CandidateAssessmentsPage';
import TakeAssessmentPage from './pages/candidate/TakeAssessmentPage';
import AssessmentResultPage from './pages/candidate/AssessmentResultPage';
import CandidateHistoryPage from './pages/candidate/CandidateHistoryPage';
import NotificationsPage from './pages/candidate/NotificationsPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminCandidatesPage from './pages/admin/AdminCandidatesPage';
import AdminCandidateDetailPage from './pages/admin/AdminCandidateDetailPage';
import AdminSlotsPage from './pages/admin/AdminSlotsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminAssessmentsPage from './pages/admin/AdminAssessmentsPage';
import AdminQuestionsPage from './pages/admin/AdminQuestionsPage';
import AdminResultsPage from './pages/admin/AdminResultsPage';
import AdminBroadcastPage from './pages/admin/AdminBroadcastPage';

function App() {
  return (
    <Routes>
      {/* Public Routes with PublicLayout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/slots" element={<PublicSlotsPage />} />
        <Route path="/assessments" element={<PublicAssessmentsPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      {/* Candidate Routes: Protected by ProtectedRoute, framed by CandidateLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<CandidateLayout />}>
          <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
          <Route path="/candidate/profile" element={<CandidateProfilePage />} />
          <Route path="/candidate/slots" element={<AvailableSlotsPage />} />
          <Route path="/candidate/bookings" element={<MyBookingsPage />} />
          <Route path="/candidate/bookings/:id" element={<InterviewDetailsPage />} />
          <Route path="/candidate/assessments" element={<CandidateAssessmentsPage />} />
          <Route path="/candidate/assessments/:id/take" element={<TakeAssessmentPage />} />
          <Route path="/candidate/attempts/:attemptId/result" element={<AssessmentResultPage />} />
          <Route path="/candidate/history" element={<CandidateHistoryPage />} />
          <Route path="/candidate/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      {/* Admin Routes: Protected by AdminRoute, framed by AdminLayout */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/candidates" element={<AdminCandidatesPage />} />
          <Route path="/admin/candidates/:id" element={<AdminCandidateDetailPage />} />
          <Route path="/admin/slots" element={<AdminSlotsPage />} />
          <Route path="/admin/bookings" element={<AdminBookingsPage />} />
          <Route path="/admin/assessments" element={<AdminAssessmentsPage />} />
          <Route path="/admin/assessments/:assessmentId/questions" element={<AdminQuestionsPage />} />
          <Route path="/admin/questions" element={<AdminQuestionsPage />} />
          <Route path="/admin/results" element={<AdminResultsPage />} />
          <Route path="/admin/broadcast" element={<AdminBroadcastPage />} />
          <Route path="/admin/notifications" element={<AdminBroadcastPage />} />
        </Route>
      </Route>

      {/* Fallback Catch-All Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
