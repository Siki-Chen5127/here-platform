import {
  BookOpen,
  BriefcaseMedical,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  FileUp,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  UserCircle,
  UserRoundCheck,
  UserRoundCog,
  Users,
} from 'lucide-react'

export const roleLabels = {
  counselor: '高校辅导员',
  psychologist: '心理咨询师',
  center_director: '心理中心负责人',
  admin: '系统管理员',
  supervisor: '心理咨询督导',
}

export const reviewNavigation = { id: 'review', label: '资料审核', icon: FileCheck2 }

export const platformConfig = {
  counselor: {
    title: '辅导员工作台',
    description: '学生关怀、预警处置与干预记录',
    navigation: [
      { id: 'dashboard', label: '工作概览', icon: LayoutDashboard },
      { id: 'students', label: '我的学生', icon: Users },
      { id: 'workorders', label: '预警工单', icon: ShieldCheck },
      { id: 'archives', label: '干预档案', icon: FileClock },
      { id: 'submissions', label: '资料管理', icon: FileUp },
      { id: 'knowledge', label: '工作知识库', icon: BookOpen },
      { id: 'profile', label: '个人资料', icon: UserCircle },
    ],
  },
  psychologist: {
    title: '心理咨询师工作台',
    description: '授权个案、转介处理与服务记录',
    navigation: [
      { id: 'dashboard', label: '工作概览', icon: LayoutDashboard },
      { id: 'cases', label: '我的个案', icon: BriefcaseMedical },
      { id: 'workorders', label: '转介工单', icon: ClipboardCheck },
      { id: 'archives', label: '服务档案', icon: FileClock },
      { id: 'submissions', label: '资料管理', icon: FileUp },
      { id: 'knowledge', label: '专业知识库', icon: BookOpen },
      { id: 'profile', label: '个人资料', icon: UserCircle },
    ],
  },
  center_director: {
    title: '心理中心负责人平台',
    description: '资料审核、知识发布与中心运行概览',
    navigation: [
      { id: 'dashboard', label: '中心概览', icon: LayoutDashboard },
      { id: 'review', label: '资料审核', icon: FileCheck2 },
      { id: 'knowledge', label: '已发布知识', icon: BookOpen },
      { id: 'profile', label: '个人资料', icon: UserCircle },
    ],
  },
  admin: {
    title: '系统管理平台',
    description: '账号、知识库与系统审计',
    navigation: [
      { id: 'dashboard', label: '系统概览', icon: LayoutDashboard },
      { id: 'reviews', label: '审核中心', icon: UserRoundCheck },
      { id: 'staff', label: '工作人员账号', icon: UserRoundCog },
      { id: 'knowledge', label: '知识库管理', icon: ScrollText },
      { id: 'audit', label: '审计日志', icon: ShieldCheck },
    ],
  },
}

export const futurePlatforms = [
  { role: 'supervisor', label: '心理咨询督导' },
]
