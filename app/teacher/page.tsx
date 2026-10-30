import TeacherDashboardMatrix from '@/components/TeacherDashboardMatrix';

export const metadata = {
  title: 'Socratix — Live Class Telemetry Matrix (Teacher Dashboard)',
  description: 'Real-time Java OOP competency monitoring powered by Supabase Realtime and Meta AI',
};

export default function TeacherPage() {
  return <TeacherDashboardMatrix />;
}
