import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Home,
  Link as LinkIcon,
  Table2,
  Users,
  Wallet,
} from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/components/AppLayout'
import type { NavItem } from '@/components/BottomNav'
import { RequireRole } from '@/components/auth/RequireRole'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { useAuth } from '@/hooks/useAuth'
import { roleHome } from '@/lib/types'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Landing from '@/pages/Landing'
import ChildAssignments from '@/pages/parent/ChildAssignments'
import ChildAttendance from '@/pages/parent/ChildAttendance'
import ChildTuition from '@/pages/parent/ChildTuition'
import ParentDashboard from '@/pages/parent/Dashboard'
import LinkChild from '@/pages/parent/LinkChild'
import StudentDashboard from '@/pages/student/Dashboard'
import MyAttendance from '@/pages/student/MyAttendance'
import MyClasses from '@/pages/student/MyClasses'
import MyClassDetail from '@/pages/student/MyClassDetail'
import StudentAssignments from '@/pages/student/Assignments'
import AssignmentRunner from '@/pages/student/AssignmentRunner'
import UserProfile from '@/pages/UserProfile'
import Styleguide from '@/pages/Styleguide'
import TeacherAssignments from '@/pages/teacher/Assignments'
import AssignmentEditor from '@/pages/teacher/AssignmentEditor'
import SubmissionsOverview from '@/pages/teacher/SubmissionsOverview'
import Attendance from '@/pages/teacher/Attendance'
import ClassDetail from '@/pages/teacher/ClassDetail'
import TeacherClasses from '@/pages/teacher/Classes'
import TeacherDashboard from '@/pages/teacher/Dashboard'
import Gradebook from '@/pages/teacher/Gradebook'
import Tuition from '@/pages/teacher/Tuition'

const teacherNav: NavItem[] = [
  { to: '/teacher', label: 'Trang chủ', icon: Home, end: true },
  { to: '/teacher/classes', label: 'Lớp học', icon: Users },
  { to: '/teacher/attendance', label: 'Điểm danh', icon: CalendarCheck },
  { to: '/teacher/tuition', label: 'Học phí', icon: Wallet },
  { to: '/teacher/assignments', label: 'Bài tập', icon: ClipboardList },
  { to: '/teacher/gradebook', label: 'Bảng điểm', icon: Table2 },
]

const studentNav: NavItem[] = [
  { to: '/student', label: 'Trang chủ', icon: Home, end: true },
  { to: '/student/classes', label: 'Lớp học', icon: BookOpen },
  { to: '/student/assignments', label: 'Bài tập', icon: ClipboardList },
  { to: '/student/attendance', label: 'Điểm danh', icon: CalendarCheck },
]

const parentNav: NavItem[] = [
  { to: '/parent', label: 'Trang chủ', icon: Home, end: true },
  { to: '/parent/assignments', label: 'Bài tập', icon: ClipboardList },
  { to: '/parent/attendance', label: 'Điểm danh', icon: CalendarCheck },
  { to: '/parent/tuition', label: 'Học phí', icon: Wallet },
  { to: '/parent/link', label: 'Liên kết', icon: LinkIcon },
]

/** Về trang chủ đúng vai trò, hoặc landing nếu chưa đăng nhập. */
function HomeRedirect() {
  const { loading, session, profile } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session && profile) return <Navigate to={roleHome[profile.role]} replace />
  return <Landing />
}

/** Trang công khai (login/register): nếu đã đăng nhập thì đưa về trang chủ. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { loading, session, profile } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session && profile) return <Navigate to={roleHome[profile.role]} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/styleguide" element={<Styleguide />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />

      {/* Giáo viên */}
      <Route
        element={
          <RequireRole allow={['teacher']}>
            <AppLayout role="teacher" items={teacherNav} />
          </RequireRole>
        }
      >
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/classes" element={<TeacherClasses />} />
        <Route path="/teacher/classes/:classId" element={<ClassDetail />} />
        <Route path="/teacher/attendance" element={<Attendance />} />
        <Route path="/teacher/tuition" element={<Tuition />} />
        <Route path="/teacher/assignments" element={<TeacherAssignments />} />
        <Route path="/teacher/assignments/:assignmentId" element={<AssignmentEditor />} />
        <Route
          path="/teacher/assignments/:assignmentId/submissions"
          element={<SubmissionsOverview />}
        />
        <Route path="/teacher/gradebook" element={<Gradebook />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>

      {/* Học sinh */}
      <Route
        element={
          <RequireRole allow={['student']}>
            <AppLayout role="student" items={studentNav} />
          </RequireRole>
        }
      >
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/classes" element={<MyClasses />} />
        <Route path="/student/classes/:classId" element={<MyClassDetail />} />
        <Route path="/student/assignments" element={<StudentAssignments />} />
        <Route path="/student/assignments/:assignmentId" element={<AssignmentRunner />} />
        <Route path="/student/attendance" element={<MyAttendance />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>

      {/* Phụ huynh */}
      <Route
        element={
          <RequireRole allow={['parent']}>
            <AppLayout role="parent" items={parentNav} />
          </RequireRole>
        }
      >
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/link" element={<LinkChild />} />
        <Route path="/parent/assignments" element={<ChildAssignments />} />
        <Route path="/parent/attendance" element={<ChildAttendance />} />
        <Route path="/parent/tuition" element={<ChildTuition />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
