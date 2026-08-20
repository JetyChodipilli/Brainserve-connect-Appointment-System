"use client";

import {
    ArrowLeft,
    ArrowRight,
    Archive,
    BadgeCheck,
    Bell,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleUserRound,
    Clock3,
    DoorOpen,
    FileClock,
    FileText,
    Fingerprint,
    IdCard,
    Inbox,
    LayoutDashboard,
    LockKeyhole,
    LogIn,
    LogOut,
    Mail,
    Volume2,
    VolumeX,
    Menu,
    MessageSquare,
    MoreHorizontal,
    Plus,
    QrCode,
    RotateCcw,
    Search,
    Send,
    Trash2,
    Settings,
    ShieldCheck,
    Sparkles,
    UserCog,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AccountClosureCandidate, AccountClosureRequest, AccountLifecycleAccount, AccountLifecycleRecord, AccountRecoveryRequest, ApiError, ArchiveManifest, ArchivedAccount, ArchivedRecoveryChallenge, brainServeApi, CompanyProfile, CompensationRecord, DataLegalHold, DepartmentEmployeeSummary, DepartmentHrAssignment, DirectArchiveChallenge, EmployeeDocument, EmployeeTerminationRequest, EssentialLogRecord, GovernanceLedgerEntry, GovernanceOverview, HistoryDataset, HistoryRow, HrAccountApprovalInput, HrLifecycleAccount, IntegrationOverview, InternalNotification,
    InternalNotificationRecipient, isBackendConfigured, LeaveRequest, ManagedAppointment, MonthlyRecords, ProvisioningAccount,
    MyProfile, PublicDirectoryEmployee, RealtimeConnectionState, ReportExportJob, ResourceDiscussion, RetentionPolicy, RoleDefinition, RoleDepartmentChangeRequest, setAccessToken, setAuthTokens, hasAuthSession, StaffAccount,
    onAuthSessionExpired, subscribeToWorkspaceUpdates, TeamLeadAssignment, ManagerAssignment,
    TeamLeadPerformance, WorkInsight, WorkTask,
    VisitorIdentity, VisitorPass, WorkspaceSetting } from "./lib/api";
import { allowedRecipientAuthorities, currentNotificationRecipients,
    readableNotificationRole } from "./lib/internal-notifications";
import { notificationSoundEnabled, onNotificationSoundChange, playNotificationSound,
    setNotificationSoundEnabled } from "./lib/notification-sounds";
import {
    appointmentTypeCode,
    appointmentDates,
    AvailableSlot,
    dateCard,
    fallbackSlots,
    formatOfficeDate,
    formatOfficeTime,
    hostCategoryForVisit,
    hostCategoriesForVisit,
    newDemoReference,
    nextBusinessDays,
    OFFICE_TIME_ZONE,
    officeDateTimeToIso,
    officeToday,
    officeYearMonth,
    PublicAppointment,
    PublicHost,
} from "./lib/appointments";

type Role = "HR Admin" | "Manager" | "Team Lead" | "CEO" | "Employee" | "Reception" | "Security" | "System Admin";
type Screen = "welcome" | "book" | "track" | "login" | "register" | "forgot-password" | "forgot-email" | "app";
type View = "overview" | "appointments" | "work" | "performance" | "insights" | "employees" | "terminations" | "account-lifecycle" | "visitors" | "notifications" | "organization" | "reports" | "audit" | "logs" | "settings" | "profile";
type AppointmentStatus = "Approved" | "Awaiting Security" | "Awaiting Reception" | "Awaiting HR" | "Awaiting Team Lead" | "Awaiting Manager" | "Awaiting CEO" |
    "Pending" | "Checked in" | "Completed" | "Rejected" | "Cancelled" | "Expired";

/**
 * Raise an application-level validation failure outside the surrounding
 * try/catch block. Keeping the throw in this helper avoids locally-caught
 * exception warnings while preserving the existing error-handling behavior.
 */
function fail(message: string): never {
    throw new Error(message);
}

/** Re-raise an unknown failure without triggering local-throw inspections. */
function rethrow(reason: unknown): never {
    throw reason;
}

const SYSTEM_ADMIN_EMAIL = "jetychodipilli@gmail.com";

type Appointment = {
    id: string;
    initials: string;
    visitor: string;
    visitorEmail?: string;
    visitorPhone?: string;
    company: string;
    host: string;
    purpose: string;
    time: string;
    date: string;
    status: AppointmentStatus;
    type: string;
    referenceNumber?: string;
    hostEmployeeId?: string;
    hostCategory?: PublicHost["category"];
    routingDepartmentId?: string | null;
    requestedEmployeeId?: string | null;
    slotStart?: string;
    accessRecordId?: string;
    securityIntakeActorId?: string | null;
    securityIntakeAt?: string | null;
    arrivalVisitorName?: string | null;
    arrivalPurpose?: string | null;
    identityDocumentType?: string | null;
    identityDocumentLastFour?: string | null;
    securityNotes?: string | null;
    receptionVerificationActorId?: string | null;
    receptionVerifiedAt?: string | null;
    receptionVerificationRemarks?: string | null;
    hrApprovalActorId?: string | null;
    hrDecisionAt?: string | null;
    hrDecisionRemarks?: string | null;
    teamLeadApprovalActorId?: string | null;
    teamLeadDecisionAt?: string | null;
    teamLeadDecisionRemarks?: string | null;
    managerApprovalActorId?: string | null;
    managerDecisionAt?: string | null;
    managerDecisionRemarks?: string | null;
    ceoApprovalActorId?: string | null;
    ceoDecisionAt?: string | null;
    ceoDecisionRemarks?: string | null;
    receptionForwardActorId?: string | null;
    receptionForwardedAt?: string | null;
    receptionForwardRemarks?: string | null;
    createdAt?: string;
    assignedToCurrentActor?: boolean;
};

type Employee = {
    id: string;
    uuid?: string;
    departmentId?: string;
    name: string;
    initials: string;
    role: string;
    department: string;
    email: string;
    hostCategory?: PublicHost["category"];
    lifecycleProtected?: boolean;
    status: "Active" | "On leave" | "Onboarding" | "Notice period" | "Suspended" | "Resigned" | "Terminated" | "Inactive";
};
type DepartmentRosterPage = {
    items: Employee[];
    page: number;
    totalElements: number;
    totalPages: number;
    query: string;
};

type Department = { id: string; code: string; name: string; active: boolean; version: number };
type DashboardMetrics = { awaitingApproval: number; activeVisits: number; visitorsInside: number;
    totalEmployees: number; activeEmployees: number };
type AccessRecord = { id: string; appointmentId: string; visitorName: string; badgeNumber: string;
    checkedInAt: string; checkedOutAt: string | null; processedBy: string };

type DemoProvisioningAccount = ProvisioningAccount & {
    passwordHash: string;
    employeeId?: string | null;
    forcePasswordChange?: boolean;
};
type DemoRecoveryRequest = AccountRecoveryRequest & { recoveryCode?: string | null };

const DEMO_ACCOUNTS_KEY = "brainserve.demo.provisioning.accounts.v1";
const DEMO_APPOINTMENTS_KEY = "brainserve.demo.public.appointments.v1";
const DEMO_LAST_REFERENCE_KEY = "brainserve.demo.last-reference.v1";
const DEMO_INTERNAL_NOTIFICATIONS_KEY = "brainserve.demo.internal.notifications.v1";
const DEMO_RECOVERY_REQUESTS_KEY = "brainserve.demo.account.recovery.v1";
const DEMO_WORK_TASKS_KEY = "brainserve.demo.work.tasks.v1";
const DEMO_EMPLOYEES_KEY = "brainserve.demo.employees.v1";
const DEMO_DEPARTMENTS_KEY = "brainserve.demo.departments.v1";
const DEMO_TEAM_LEAD_ASSIGNMENTS_KEY = "brainserve.demo.team-lead-assignments.v1";
const DEMO_DEPARTMENT_HR_ASSIGNMENTS_KEY = "brainserve.demo.department-hr-assignments.v1";
const DEMO_MANAGER_ASSIGNMENTS_KEY = "brainserve.demo.manager-assignments.v1";
const DEMO_ROLE_DEPARTMENT_CHANGES_KEY = "brainserve.demo.role-department-changes.v1";
const DEMO_WORK_INSIGHTS_KEY = "brainserve.demo.work-insights.v1";
const DEMO_TERMINATIONS_KEY = "brainserve.demo.employee-terminations.v1";
const DEMO_ESSENTIAL_LOGS_KEY = "brainserve.demo.essential-logs.v1";
const DEMO_ACCOUNT_CLOSURES_KEY = "brainserve.demo.account-closures.v1";
const DEMO_ARCHIVED_ACCOUNTS_KEY = "brainserve.demo.archived-accounts.v1";
const DEMO_ACCOUNT_LIFECYCLE_KEY = "brainserve.demo.account-lifecycle.v1";
const PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY = "brainserve.connect.preview-direct-archive-challenge.v1";
const PREVIEW_DIRECT_ARCHIVE_PASSWORD_FAILURES_KEY =
    "brainserve.connect.preview-direct-archive-password-failures.v1";
const PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY =
    "brainserve.connect.preview-archived-recovery-challenge.v1";
const PREVIEW_WORKSPACE_SESSION_KEY = "brainserve.connect.preview-workspace-session.v1";
const previewOtpIsValid = (otp: string) => {
    void otp;
    return false;
};

// Legacy browser-only fixtures remain solely for local UI development. They
// contain no usable credential and are unreachable when the backend is absent.
const DEMO_SYSTEM_ADMIN: DemoProvisioningAccount = {
    id: "00000000-0000-4000-8000-000000000001",
    fullName: "Jety Chodipilli",
    email: SYSTEM_ADMIN_EMAIL,
    role: "ROLE_SYSTEM_ADMIN",
    status: "ACTIVE",
    createdByUserId: null,
    approvedByUserId: null,
    createdAt: "2026-07-14T00:00:00.000Z",
    approvedAt: null,
    forcePasswordChange: false,
    passwordHash: "",
};

// This deliberately unusable local fixture supports layout-only development.
// It cannot authenticate or authorize any hosted workflow.
const DEMO_CEO_ACCOUNT: DemoProvisioningAccount = {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Althuf",
    email: "althuf@brainserve.in",
    role: "ROLE_CEO",
    status: "ACTIVE",
    createdByUserId: DEMO_SYSTEM_ADMIN.id,
    approvedByUserId: DEMO_SYSTEM_ADMIN.id,
    createdAt: "2026-07-14T00:00:00.000Z",
    approvedAt: "2026-07-14T00:00:00.000Z",
    forcePasswordChange: false,
    passwordHash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
};

const BROWSER_PREVIEW_ROLE_ORDER: Role[] = [
    "System Admin", "CEO", "Manager", "HR Admin", "Team Lead", "Employee", "Reception", "Security",
];

const BROWSER_PREVIEW_ACCOUNT_TEMPLATES: Record<Role, DemoProvisioningAccount> = {
    "System Admin": DEMO_SYSTEM_ADMIN,
    CEO: DEMO_CEO_ACCOUNT,
    Manager: {
        id: "demo-manager", fullName: "Aarav Mehta", email: "aarav.mehta@brainserve.in",
        role: "ROLE_MANAGER", status: "ACTIVE", employeeId: "BSPL-OP-0027",
        createdByUserId: DEMO_SYSTEM_ADMIN.id, approvedByUserId: DEMO_CEO_ACCOUNT.id,
        createdAt: "2026-07-20T04:30:00.000Z", approvedAt: "2026-07-20T04:30:00.000Z",
        forcePasswordChange: false, passwordHash: "",
    },
    "HR Admin": {
        id: "demo-hr-admin", fullName: "Kavya Reddy", email: "kavya.reddy@brainserve.in",
        role: "ROLE_HR_ADMIN", status: "ACTIVE", employeeId: "BSPL-HR-0018",
        createdByUserId: DEMO_SYSTEM_ADMIN.id, approvedByUserId: DEMO_CEO_ACCOUNT.id,
        createdAt: "2026-07-16T04:30:00.000Z", approvedAt: "2026-07-16T04:30:00.000Z",
        forcePasswordChange: false, passwordHash: "",
    },
    "Team Lead": {
        id: "demo-team-lead", fullName: "Riya Sharma", email: "riya.sharma@brainserve.in",
        role: "ROLE_TEAM_LEAD", status: "ACTIVE", employeeId: "BSPL-IT-0042",
        createdByUserId: DEMO_SYSTEM_ADMIN.id, approvedByUserId: "demo-hr-admin",
        createdAt: "2026-07-15T04:30:00.000Z", approvedAt: "2026-07-15T04:30:00.000Z",
        forcePasswordChange: false, passwordHash: "",
    },
    Employee: {
        id: "demo-employee", fullName: "Kalyan Reddy", email: "kalyan@brainserve.in",
        role: "ROLE_EMPLOYEE", status: "ACTIVE", employeeId: "BSPL-IT-0071",
        createdByUserId: "demo-hr-admin", approvedByUserId: "demo-hr-admin",
        createdAt: "2026-07-17T04:30:00.000Z", approvedAt: "2026-07-17T04:30:00.000Z",
        forcePasswordChange: false, passwordHash: "",
    },
    Reception: {
        id: "reception-preview", fullName: "Reception Desk", email: "reception@brainserve.in",
        role: "ROLE_RECEPTIONIST", status: "ACTIVE", createdByUserId: "demo-hr-admin",
        approvedByUserId: "demo-hr-admin", createdAt: "2026-07-17T04:30:00.000Z",
        approvedAt: "2026-07-17T04:30:00.000Z", forcePasswordChange: false, passwordHash: "",
    },
    Security: {
        id: "security-preview", fullName: "Security Desk", email: "security@brainserve.in",
        role: "ROLE_SECURITY", status: "ACTIVE", createdByUserId: "demo-hr-admin",
        approvedByUserId: "demo-hr-admin", createdAt: "2026-07-17T04:30:00.000Z",
        approvedAt: "2026-07-17T04:30:00.000Z", forcePasswordChange: false, passwordHash: "",
    },
};

function startBrowserPreviewRole(role: Role) {
    const accounts = readDemoAccounts();
    const existing = accounts.find((account) => account.status === "ACTIVE"
        && roleFromAuthority(account.role) === role
        && (role !== "Employee" || Boolean(account.employeeId)));
    if (existing) return existing;
    const template = BROWSER_PREVIEW_ACCOUNT_TEMPLATES[role];
    const withoutTemplateIdentity = accounts.filter((account) => account.id !== template.id
        && account.email.toLowerCase() !== template.email.toLowerCase());
    writeDemoAccounts([...withoutTemplateIdentity, template]);
    return template;
}

function resetBrowserPreviewWorkspace() {
    if (typeof window === "undefined") return;
    for (const storage of [window.localStorage, window.sessionStorage]) {
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
            .filter((key): key is string => Boolean(key?.startsWith("brainserve.")));
        keys.forEach((key) => storage.removeItem(key));
    }
    window.location.reload();
}

function readDemoRecoveryRequests(): DemoRecoveryRequest[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_RECOVERY_REQUESTS_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoRecoveryRequests(items: DemoRecoveryRequest[]) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_RECOVERY_REQUESTS_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent("brainserve:demo-recovery-updated"));
    }
}

function newDemoRecoveryCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segment = () => Array.from(crypto.getRandomValues(new Uint8Array(4)),
        (value) => alphabet[value % alphabet.length]).join("");
    return `BSR-${segment()}-${segment()}-${segment()}`;
}

function newDemoTemporaryPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const random = Array.from(crypto.getRandomValues(new Uint8Array(15)),
        (value) => alphabet[value % alphabet.length]).join("");
    return `Bs!7${random}`;
}

type DemoInternalNotification = InternalNotification & { senderEmail: string; recipientEmail: string };

function readDemoInternalNotifications(): DemoInternalNotification[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_INTERNAL_NOTIFICATIONS_KEY) ?? "[]");
        const accounts = readDemoAccounts();
        return Array.isArray(value) ? value.map((item: DemoInternalNotification) => {
            const sender = accounts.find((account) => account.id === item.senderUserId
                || account.email.toLowerCase() === item.senderEmail?.toLowerCase());
            const recipient = accounts.find((account) => account.id === item.recipientUserId
                || account.email.toLowerCase() === item.recipientEmail?.toLowerCase());
            return { ...item,
                senderName: sender?.fullName ?? item.senderName,
                recipientName: recipient?.fullName ?? item.recipientName,
                senderEmail: sender?.email ?? item.senderEmail,
                recipientEmail: recipient?.email ?? item.recipientEmail,
                senderRoles: sender ? [sender.role] : item.senderRoles ?? [],
                recipientRoles: recipient ? [recipient.role] : item.recipientRoles ?? [],
                priority: item.priority ?? "NORMAL", category: item.category ?? "GENERAL",
                conversationKey: item.conversationKey ?? [item.senderUserId, item.recipientUserId].sort().join(":") };
        }) : [];
    } catch { return []; }
}

function writeDemoInternalNotifications(items: DemoInternalNotification[]) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_INTERNAL_NOTIFICATIONS_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent("brainserve:demo-internal-notifications-updated"));
    }
}

function readDemoWorkTasks(): WorkTask[] {
    if (typeof window === "undefined") return initialWorkTasks;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_WORK_TASKS_KEY) ?? "[]");
        const tasks = Array.isArray(value) && value.length ? value : initialWorkTasks;
        const departments = readDemoDepartments();
        return tasks.map((item: WorkTask & { category?: string }) => ({ ...item,
            departmentBranch: item.departmentBranch
                ?? departments.find((department) => department.id === item.departmentId)?.name
                ?? item.category ?? "Assigned department",
            insightReviewSource: item.insightReviewSource ?? null,
            insightReviewReason: item.insightReviewReason ?? null,
            insightReviewRequestedAt: item.insightReviewRequestedAt ?? null,
            reworkCycle: item.reworkCycle ?? 0 }));
    } catch { return initialWorkTasks; }
}

function writeDemoWorkTasks(items: WorkTask[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_WORK_TASKS_KEY, JSON.stringify(items));
}

function readDemoWorkInsights(): WorkInsight[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_WORK_INSIGHTS_KEY) ?? "[]");
        return Array.isArray(value) ? value.map((item: WorkInsight) => ({ ...item,
            reworkRequestedByRole: item.reworkRequestedByRole ?? null,
            reworkReason: item.reworkReason ?? null,
            reworkRequestedAt: item.reworkRequestedAt ?? null,
            teamLeadReworkGuidance: item.teamLeadReworkGuidance ?? null,
            teamLeadRespondedAt: item.teamLeadRespondedAt ?? null,
            reworkCycle: item.reworkCycle ?? 0 })) : [];
    } catch { return []; }
}

function writeDemoWorkInsights(items: WorkInsight[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_WORK_INSIGHTS_KEY, JSON.stringify(items));
}

function officeDateFromInstant(value: string) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: OFFICE_TIME_ZONE, year: "numeric",
        month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
}

function workWeekStart(value = officeToday()) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
}

function readDemoEmployees(): Employee[] {
    if (typeof window === "undefined") return initialEmployees;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_EMPLOYEES_KEY) ?? "[]");
        const employees: Employee[] = Array.isArray(value) && value.length ? value : initialEmployees;
        const departments = readDemoDepartments();
        let migrated = false;
        const activeManagers = readDemoManagerAssignments();
        const normalized = employees.map((employee) => {
            const managerAssignment = activeManagers.find((assignment) => assignment.active
                && assignment.managerEmployeeId === (employee.uuid ?? employee.id));
            const assignedDepartment = managerAssignment
                ? departments.find((item) => item.id === managerAssignment.departmentId)
                : undefined;
            if (managerAssignment && assignedDepartment
                && (employee.departmentId !== assignedDepartment.id
                    || employee.department !== assignedDepartment.name
                    || employee.role !== "Department Manager"
                    || employee.status !== "Active")) {
                migrated = true;
                return { ...employee, departmentId: assignedDepartment.id,
                    department: assignedDepartment.name, role: "Department Manager", status: "Active" as const };
            }
            if (employee.departmentId && departments.some((department) => department.id === employee.departmentId)) {
                return employee;
            }
            const department = departments.find((item) => item.name.toLowerCase() === employee.department?.toLowerCase()
                || item.code.toLowerCase() === employee.department?.toLowerCase()
                || item.id === employee.departmentId);
            if (!department) return employee;
            migrated = true;
            return { ...employee, departmentId: department.id, department: department.name };
        });
        if (migrated) writeDemoEmployees(normalized);
        return normalized;
    } catch { return initialEmployees; }
}

function writeDemoEmployees(items: Employee[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(items));
}

function readDemoDepartments(): Department[] {
    if (typeof window === "undefined") return initialDepartments;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_DEPARTMENTS_KEY) ?? "[]");
        return Array.isArray(value) && value.length ? value : initialDepartments;
    } catch { return initialDepartments; }
}

function writeDemoDepartments(items: Department[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_DEPARTMENTS_KEY, JSON.stringify(items));
}

function readDemoTeamLeadAssignments(): TeamLeadAssignment[] {
    if (typeof window === "undefined") return initialTeamLeadAssignments;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_TEAM_LEAD_ASSIGNMENTS_KEY) ?? "[]");
        let assignments: TeamLeadAssignment[] = Array.isArray(value) && value.length
            ? value : initialTeamLeadAssignments;
        let migrated = false;
        const employees = readDemoEmployees();
        const departments = readDemoDepartments();
        assignments = assignments.map((assignment) => {
            if (departments.some((department) => department.id === assignment.departmentId)) return assignment;
            const department = departments.find((item) => item.code.toLowerCase() === assignment.departmentId.toLowerCase()
                || item.name.toLowerCase() === assignment.departmentId.toLowerCase());
            if (!department) return assignment;
            migrated = true;
            return { ...assignment, departmentId: department.id };
        });
        const legacyTeamLeads = readDemoAccounts().filter((account) => account.status === "ACTIVE"
            && account.role === "ROLE_TEAM_LEAD");
        for (const account of legacyTeamLeads) {
            const employee = employees.find((item) => (account.employeeId && (item.uuid ?? item.id) === account.employeeId)
                || item.email.toLowerCase() === account.email.toLowerCase()
                || item.name.trim().toLowerCase() === account.fullName.trim().toLowerCase());
            if (!employee?.departmentId || assignments.some((assignment) => assignment.active
                && (assignment.teamLeadUserId === account.id
                    || assignment.teamLeadEmployeeId === (employee.uuid ?? employee.id)))) continue;
            const now = new Date().toISOString();
            assignments = [{ id: newClientId(), departmentId: employee.departmentId,
                teamLeadUserId: account.id, teamLeadEmployeeId: employee.uuid ?? employee.id,
                active: true, assignedByUserId: "demo-legacy-migration", assignedAt: now,
                endedByUserId: null, endedAt: null }, ...assignments.map((assignment) =>
                assignment.active && assignment.departmentId === employee.departmentId
                    ? { ...assignment, active: false, endedByUserId: "demo-legacy-migration", endedAt: now }
                    : assignment)];
            migrated = true;
        }
        if (migrated) writeDemoTeamLeadAssignments(assignments);
        return assignments;
    } catch { return initialTeamLeadAssignments; }
}

function writeDemoTeamLeadAssignments(items: TeamLeadAssignment[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_TEAM_LEAD_ASSIGNMENTS_KEY, JSON.stringify(items));
}

function readDemoDepartmentHrAssignments(): DepartmentHrAssignment[] {
    if (typeof window === "undefined") return initialDepartmentHrAssignments;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_DEPARTMENT_HR_ASSIGNMENTS_KEY) ?? "[]");
        return Array.isArray(value) && value.length ? value : initialDepartmentHrAssignments;
    } catch { return initialDepartmentHrAssignments; }
}

function writeDemoDepartmentHrAssignments(items: DepartmentHrAssignment[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_DEPARTMENT_HR_ASSIGNMENTS_KEY, JSON.stringify(items));
}

function readDemoManagerAssignments(): ManagerAssignment[] {
    if (typeof window === "undefined") return initialManagerAssignments;
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_MANAGER_ASSIGNMENTS_KEY) ?? "[]");
        return Array.isArray(value) && value.length ? value : initialManagerAssignments;
    } catch { return initialManagerAssignments; }
}

function writeDemoManagerAssignments(items: ManagerAssignment[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_MANAGER_ASSIGNMENTS_KEY, JSON.stringify(items));
}

function readDemoRoleDepartmentChanges(): RoleDepartmentChangeRequest[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_ROLE_DEPARTMENT_CHANGES_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoRoleDepartmentChanges(items: RoleDepartmentChangeRequest[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_ROLE_DEPARTMENT_CHANGES_KEY, JSON.stringify(items));
}

function readDemoTerminations(): EmployeeTerminationRequest[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_TERMINATIONS_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoTerminations(items: EmployeeTerminationRequest[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_TERMINATIONS_KEY, JSON.stringify(items));
}

function readDemoEssentialLogs(): EssentialLogRecord[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_ESSENTIAL_LOGS_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoEssentialLogs(items: EssentialLogRecord[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_ESSENTIAL_LOGS_KEY, JSON.stringify(items));
}

function readDemoAccountClosures(): AccountClosureRequest[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_ACCOUNT_CLOSURES_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoAccountClosures(items: AccountClosureRequest[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_ACCOUNT_CLOSURES_KEY, JSON.stringify(items));
}

function readDemoArchivedAccounts(): ArchivedAccount[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_ARCHIVED_ACCOUNTS_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoArchivedAccounts(items: ArchivedAccount[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_ARCHIVED_ACCOUNTS_KEY, JSON.stringify(items));
}

function readDemoAccountLifecycle(): AccountLifecycleRecord[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_ACCOUNT_LIFECYCLE_KEY) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeDemoAccountLifecycle(items: AccountLifecycleRecord[]) {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_ACCOUNT_LIFECYCLE_KEY, JSON.stringify(items));
}

function readPreviewDirectArchiveChallenge(): DirectArchiveChallenge | null {
    if (typeof window === "undefined") return null;
    try {
        const value = JSON.parse(
            window.sessionStorage.getItem(PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY) ?? "null") as DirectArchiveChallenge | null;
        if (!value?.challengeId || value.targetRole === "ROLE_CEO"
            || Date.parse(value.expiresAt) <= Date.now() || value.attemptsRemaining <= 0) {
            window.sessionStorage.removeItem(PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY);
            return null;
        }
        return value;
    } catch {
        window.sessionStorage.removeItem(PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY);
        return null;
    }
}

function writePreviewDirectArchiveChallenge(value: DirectArchiveChallenge | null) {
    if (typeof window === "undefined") return;
    if (value) window.sessionStorage.setItem(PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(PREVIEW_DIRECT_ARCHIVE_CHALLENGE_KEY);
}

function readPreviewArchivedRecoveryChallenge(): ArchivedRecoveryChallenge | null {
    if (typeof window === "undefined") return null;
    try {
        const value = JSON.parse(
            window.sessionStorage.getItem(PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY) ?? "null") as
            ArchivedRecoveryChallenge | null;
        if (!value?.challengeId || Date.parse(value.expiresAt) <= Date.now()
            || value.attemptsRemaining <= 0) {
            window.sessionStorage.removeItem(PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY);
            return null;
        }
        return value;
    } catch {
        window.sessionStorage.removeItem(PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY);
        return null;
    }
}

function writePreviewArchivedRecoveryChallenge(value: ArchivedRecoveryChallenge | null) {
    if (typeof window === "undefined") return;
    if (value) {
        window.sessionStorage.setItem(PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY, JSON.stringify(value));
    } else {
        window.sessionStorage.removeItem(PREVIEW_ARCHIVED_RECOVERY_CHALLENGE_KEY);
    }
}

function previewArchivePasswordFailure(): number {
    if (typeof window === "undefined") return 0;
    try {
        const current = JSON.parse(
            window.sessionStorage.getItem(PREVIEW_DIRECT_ARCHIVE_PASSWORD_FAILURES_KEY) ?? "null") as
            { failures: number; lockedUntil: number } | null;
        if (current?.lockedUntil && current.lockedUntil > Date.now()) {
            fail("Too many incorrect password attempts. Try again later.");
        }
        const failures = (current?.failures ?? 0) + 1;
        window.sessionStorage.setItem(PREVIEW_DIRECT_ARCHIVE_PASSWORD_FAILURES_KEY,
            JSON.stringify({ failures, lockedUntil: failures >= 5 ? Date.now() + 15 * 60_000 : 0 }));
        return Math.max(0, 5 - failures);
    } catch (reason) {
        if (reason instanceof Error && reason.message.startsWith("Too many incorrect")) rethrow(reason);
        window.sessionStorage.removeItem(PREVIEW_DIRECT_ARCHIVE_PASSWORD_FAILURES_KEY);
        return 4;
    }
}

function clearPreviewArchivePasswordFailures() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PREVIEW_DIRECT_ARCHIVE_PASSWORD_FAILURES_KEY);
    }
}

function recordDemoClosureTransition(request: AccountClosureRequest, eventType: string,
                                     fromStatus: string | null, actorUserId: string | null, detail: string) {
    const occurredAt = new Date().toISOString();
    writeDemoAccountLifecycle([{ id: newClientId(), closureRequestId: request.id,
        targetUserId: request.targetUserId, eventType, fromStatus, toStatus: request.status,
        actorUserId, detail, occurredAt }, ...readDemoAccountLifecycle()]);
    writeDemoEssentialLogs([{ id: newClientId(), category: "ACCOUNT_LIFECYCLE", eventType,
        subjectType: "USER_ACCOUNT", subjectId: request.targetUserId, referenceId: request.id,
        actorUserId, approverUserId: actorUserId, status: request.status,
        title: `${request.targetName} · ${request.status.replaceAll("_", " ")}`, detail, occurredAt },
        ...readDemoEssentialLogs()]);
}

function demoAccountDepartment(userId: string, email: string) {
    const account = readDemoAccounts().find((item) => item.id === userId || item.email === email);
    const employee = readDemoEmployees().find((item) =>
        Boolean(account?.employeeId && (item.uuid ?? item.id) === account.employeeId)
        || item.email.toLowerCase() === email.toLowerCase());
    if (employee?.departmentId) return employee.departmentId;
    return readDemoDepartmentHrAssignments().find((item) => item.active && item.hrUserId === userId)?.departmentId
        ?? readDemoManagerAssignments().find((item) => item.active && item.managerUserId === userId)?.departmentId
        ?? readDemoTeamLeadAssignments().find((item) => item.active && item.teamLeadUserId === userId)?.departmentId
        ?? null;
}

function demoInternalRecipients(role: Role, senderEmail: string): InternalNotificationRecipient[] {
    const allowed = allowedRecipientAuthorities(role);
    const activeAccounts = readDemoAccounts().filter((account) => account.status === "ACTIVE");
    const sender = activeAccounts.find((account) => account.email.toLowerCase() === senderEmail.toLowerCase());
    const stored = activeAccounts
        .map((account) => ({ userId: account.id, fullName: account.fullName, email: account.email, roles: [account.role] }));
    const defaults: InternalNotificationRecipient[] = [
        { userId: DEMO_CEO_ACCOUNT.id, fullName: DEMO_CEO_ACCOUNT.fullName,
            email: DEMO_CEO_ACCOUNT.email, roles: ["ROLE_CEO"] },
        { userId: "demo-manager", fullName: "Aarav Mehta", email: "aarav.mehta@brainserve.in", roles: ["ROLE_MANAGER"] },
        { userId: "demo-hr-admin", fullName: "Kavya Reddy", email: "hr.admin@brainserve.in", roles: ["ROLE_HR_ADMIN"] },
        { userId: "demo-team-lead", fullName: "Riya Sharma", email: "riya.sharma@brainserve.in", roles: ["ROLE_TEAM_LEAD"] },
        { userId: "demo-employee-riya", fullName: "Riya Sharma", email: "riya.sharma@brainserve.in", roles: ["ROLE_EMPLOYEE"] },
        { userId: "reception-preview", fullName: "Reception Desk", email: "reception@brainserve.in", roles: ["ROLE_RECEPTIONIST"] },
    ];
    const senderDepartment = demoAccountDepartment(sender?.id ?? senderEmail, senderEmail);
    return currentNotificationRecipients(allowed, stored, defaults, sender?.id, senderEmail)
        .filter((recipient) => {
            const departmentBound = role === "Manager" && recipient.roles.includes("ROLE_HR_ADMIN")
                || role === "HR Admin"
                && recipient.roles.some((authority) => ["ROLE_TEAM_LEAD", "ROLE_EMPLOYEE"].includes(authority))
                || role === "Team Lead" && recipient.roles.includes("ROLE_HR_ADMIN")
                || role === "Employee" && recipient.roles.includes("ROLE_HR_ADMIN");
            return !departmentBound || Boolean(senderDepartment
                && senderDepartment === demoAccountDepartment(recipient.userId, recipient.email));
        });
}

function demoSenderName(role: Role, email: string) {
    return readDemoAccounts().find((account) => account.email === email)?.fullName
        ?? (role === "CEO" ? "BrainServe CEO" : role === "Manager" ? "Department Manager"
            : role === "HR Admin" ? "HR Admin" : role === "Team Lead" ? "Team Lead"
                : role === "Reception" ? "Reception Desk" : "BrainServe Employee");
}

function readDemoAccounts(): DemoProvisioningAccount[] {
    if (typeof window === "undefined") return [DEMO_SYSTEM_ADMIN, DEMO_CEO_ACCOUNT];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(DEMO_ACCOUNTS_KEY) ?? "[]");
        const accounts = Array.isArray(parsed) ? parsed : [];
        const normalizedAccounts = accounts.map((account: DemoProvisioningAccount) => ({
            ...account,
            forcePasswordChange: account.forcePasswordChange ?? false,
            status: account.status === "PENDING_APPROVAL"
            && ["ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(account.role)
                ? "PENDING_HR_APPROVAL"
                : account.status,
        }));
        const activeManagerUserIds = new Set(readDemoManagerAssignments()
            .filter((assignment) => assignment.active).map((assignment) => assignment.managerUserId));
        const managerIdentityConflictExists = normalizedAccounts.some((account: DemoProvisioningAccount) =>
            account.role === "ROLE_CEO"
            && activeManagerUserIds.has(account.id)
            && normalizedAccounts.some((candidate: DemoProvisioningAccount) =>
                candidate.id !== account.id && candidate.role === "ROLE_CEO"));
        const normalized = normalizedAccounts.map((account: DemoProvisioningAccount) =>
            account.role === "ROLE_CEO"
            && activeManagerUserIds.has(account.id)
            && normalizedAccounts.some((candidate: DemoProvisioningAccount) =>
                candidate.id !== account.id && candidate.role === "ROLE_CEO")
                ? { ...account, role: "ROLE_MANAGER", status: "ACTIVE",
                    rejectedAt: null, forcePasswordChange: account.forcePasswordChange ?? false }
                : account);
        const persistedCeoAccounts = normalized.filter((account: DemoProvisioningAccount) =>
            account.role === "ROLE_CEO");
        const activeCeoCandidates = persistedCeoAccounts.filter((account: DemoProvisioningAccount) =>
            ["ACTIVE", "PENDING_APPROVAL"].includes(account.status));
        const persistedSeedCeo = activeCeoCandidates.find((account: DemoProvisioningAccount) =>
            account.id === DEMO_CEO_ACCOUNT.id
            || account.email.toLowerCase() === DEMO_CEO_ACCOUNT.email);
        const persistedCompanyCeo = activeCeoCandidates.find((account: DemoProvisioningAccount) =>
            account.id !== DEMO_CEO_ACCOUNT.id
            && account.email.toLowerCase() !== DEMO_CEO_ACCOUNT.email);
        const historicalCompanyCeo = persistedCeoAccounts
            .filter((account: DemoProvisioningAccount) => account.id !== DEMO_CEO_ACCOUNT.id
                && account.email.toLowerCase() !== DEMO_CEO_ACCOUNT.email)
            .sort((left: DemoProvisioningAccount, right: DemoProvisioningAccount) =>
                Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
        // The seed is only a fresh-browser fallback. A real active CEO created by
        // System Admin must remain authoritative even when its email differs from
        // the original preview seed.
        const canonicalCeo = persistedCompanyCeo ?? persistedSeedCeo
            ?? (managerIdentityConflictExists && historicalCompanyCeo
                ? { ...historicalCompanyCeo, status: "ACTIVE" as const, rejectedAt: null }
                : null)
            ?? (persistedCeoAccounts.length === 0 ? DEMO_CEO_ACCOUNT : null);
        const historicalDuplicateCeos = normalized
            .filter((account: DemoProvisioningAccount) => account.role === "ROLE_CEO"
                && (!canonicalCeo || (account.id !== canonicalCeo.id
                    && account.email.toLowerCase() !== canonicalCeo.email.toLowerCase())))
            .map((account: DemoProvisioningAccount) => ({
                ...account,
                status: canonicalCeo && ["ACTIVE", "PENDING_APPROVAL"].includes(account.status)
                    ? "REJECTED" : account.status,
            }));
        const withoutSeedIdentities = normalized.filter((account: DemoProvisioningAccount) =>
            account.role !== "ROLE_SYSTEM_ADMIN"
            && account.role !== "ROLE_CEO"
            && account.email !== SYSTEM_ADMIN_EMAIL);
        return [DEMO_SYSTEM_ADMIN, ...(canonicalCeo ? [canonicalCeo] : []),
            ...historicalDuplicateCeos, ...withoutSeedIdentities];
    } catch {
        return [DEMO_SYSTEM_ADMIN, DEMO_CEO_ACCOUNT];
    }
}

function writeDemoAccounts(accounts: DemoProvisioningAccount[]) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
        window.dispatchEvent(new CustomEvent("brainserve:demo-accounts-updated"));
    }
}

function readPreviewWorkspaceSession(): { role: Role; email: string } | null {
    if (typeof window === "undefined") return null;
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(PREVIEW_WORKSPACE_SESSION_KEY) ?? "null") as
            { role?: Role; email?: string } | null;
        if (!parsed?.role || !parsed.email) return null;
        const account = readDemoAccounts().find((item) => item.email === parsed.email
            && item.status === "ACTIVE");
        if (!account || roleFromAuthority(account.role) !== parsed.role || account.forcePasswordChange) {
            window.sessionStorage.removeItem(PREVIEW_WORKSPACE_SESSION_KEY);
            return null;
        }
        return { role: parsed.role, email: parsed.email };
    } catch {
        window.sessionStorage.removeItem(PREVIEW_WORKSPACE_SESSION_KEY);
        return null;
    }
}

function writePreviewWorkspaceSession(session: { role: Role; email: string } | null) {
    if (typeof window === "undefined") return;
    if (session) window.sessionStorage.setItem(PREVIEW_WORKSPACE_SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(PREVIEW_WORKSPACE_SESSION_KEY);
}

type DemoAppointment = PublicAppointment & {
    id?: string;
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    visitorCompany?: string | null;
    purpose?: string;
    routingDepartmentId?: string | null;
    requestedEmployeeId?: string | null;
    identityDocumentType?: string | null;
    identityDocumentLastFour?: string | null;
    notes?: string | null;
    securityIntakeAt?: string | null;
    receptionVerifiedAt?: string | null;
    receptionVerificationRemarks?: string | null;
    receptionForwardedAt?: string | null;
    createdAt?: string;
    hostCategory?: PublicHost["category"];
    managerApprovalActorId?: string | null;
    managerDecisionAt?: string | null;
    managerDecisionRemarks?: string | null;
    ceoApprovalActorId?: string | null;
    ceoDecisionAt?: string | null;
    ceoDecisionRemarks?: string | null;
};

function readDemoAppointments(): DemoAppointment[] {
    if (typeof window === "undefined") return [];
    try {
        const value = JSON.parse(window.localStorage.getItem(DEMO_APPOINTMENTS_KEY) ?? "[]");
        if (Array.isArray(value) && value.length) return value;
        const start = officeDateTimeToIso(nextBusinessDays(2)[0], "10:10");
        return [{ referenceNumber: "BSA-DEMO-PASS", type: "CLIENT_MEETING", status: "APPROVED",
            hostReference: initialEmployees[0]?.id ?? "demo-host", slotStart: start,
            slotEnd: new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(), visitorDisplayName: "Demo Visitor" }];
    } catch { return []; }
}

function writeDemoAppointments(appointments: DemoAppointment[]) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_APPOINTMENTS_KEY, JSON.stringify(appointments));
        window.dispatchEvent(new CustomEvent("brainserve:demo-appointments-updated"));
    }
}

async function hashDemoPassword(password: string) {
    if (crypto.subtle?.digest) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    // Standards-correct SHA-256 for non-secure local review contexts where
    // WebCrypto is unavailable. Production passwords remain Bcrypt-hashed.
    const constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const state = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const bytes = new TextEncoder().encode(password);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);
    const rotateRight = (value: number, bits: number) =>
        ((value >>> bits) | (value << (32 - bits))) >>> 0;
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
        for (let index = 16; index < 64; index += 1) {
            const sigma0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18)
                ^ (words[index - 15] >>> 3);
            const sigma1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19)
                ^ (words[index - 2] >>> 10);
            words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = state;
        for (let index = 0; index < 64; index += 1) {
            const upperSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choice = (e & f) ^ (~e & g);
            const temporary1 = (h + upperSigma1 + choice + constants[index] + words[index]) >>> 0;
            const upperSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temporary2 = (upperSigma0 + majority) >>> 0;
            h = g; g = f; f = e; e = (d + temporary1) >>> 0;
            d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
        }
        state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
        state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
        state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
        state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    }
    return Array.from(state, (word) => word.toString(16).padStart(8, "0")).join("");
}

function constantTimeHexEqual(left: string, right: string) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
}

async function verifyPreviewSystemAdminPassword(email: string, currentPassword: string) {
    if (!currentPassword) return false;
    const admin = readDemoAccounts().find((item) =>
        item.email.toLowerCase() === email.trim().toLowerCase()
        && item.role === "ROLE_SYSTEM_ADMIN"
        && item.status === "ACTIVE");
    if (!admin) return false;
    return constantTimeHexEqual(admin.passwordHash, await hashDemoPassword(currentPassword));
}

function newClientId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function roleFromAuthority(authority: string): Role | null {
    const roleMap: Record<string, Role> = {
        ROLE_CEO: "CEO", ROLE_MANAGER: "Manager", ROLE_HR_ADMIN: "HR Admin", ROLE_TEAM_LEAD: "Team Lead",
        ROLE_EMPLOYEE: "Employee", ROLE_RECEPTIONIST: "Reception", ROLE_SECURITY: "Security",
        ROLE_SYSTEM_ADMIN: "System Admin",
    };
    return roleMap[authority] ?? null;
}

const ROLE_AUTHORITY_BY_LABEL: Record<Role, string> = {
    "HR Admin": "ROLE_HR_ADMIN", Manager: "ROLE_MANAGER", "Team Lead": "ROLE_TEAM_LEAD",
    CEO: "ROLE_CEO", Employee: "ROLE_EMPLOYEE", Reception: "ROLE_RECEPTIONIST", Security: "ROLE_SECURITY",
    "System Admin": "ROLE_SYSTEM_ADMIN",
};

const SUPPORTED_ROLE_AUTHORITIES = [
    "ROLE_SYSTEM_ADMIN",
    "ROLE_CEO",
    "ROLE_MANAGER",
    "ROLE_HR_ADMIN",
    "ROLE_TEAM_LEAD",
    "ROLE_EMPLOYEE",
    "ROLE_RECEPTIONIST",
    "ROLE_SECURITY",
] as const;

function primaryRoleFromAuthorities(authorities: string[]): Role | null {
    const supportedAuthorities = SUPPORTED_ROLE_AUTHORITIES.filter((authority) =>
        authorities.includes(authority),
    );
    if (supportedAuthorities.length !== 1) return null;
    return roleFromAuthority(supportedAuthorities[0]);
}

function roleBadge(role: Role) {
    return { "System Admin": "SA", CEO: "CE", Manager: "MG", "HR Admin": "HR", "Team Lead": "TL",
        Employee: "EM", Reception: "RE", Security: "SE" }[role];
}

type ReceptionVisitInput = {
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string;
    visitorCompany: string;
    visitType: string;
    hostEmployeeId: string;
    hostCategory: PublicHost["category"];
    routingDepartmentId: string;
    requestedEmployeeId?: string | null;
    slotStart: string;
    slotEnd: string;
    purpose: string;
    identityDocumentType?: string | null;
    identityDocumentLastFour?: string | null;
    notes?: string | null;
};

type SecurityIntakeInput = {
    visitorName: string;
    purpose: string;
    identityDocumentType: string | null;
    identityDocumentLastFour: string | null;
    notes: string | null;
};


const initialAppointments: Appointment[] = [
    { id: "1", initials: "AK", visitor: "Arjun Kumar", company: "Acme Technologies", host: "Riya Sharma", purpose: "Product partnership", time: "10:00 AM", date: "Today", status: "Approved", type: "Client meeting" },
    { id: "2", initials: "NS", visitor: "Neha Singh", company: "Independent", host: "Kavya Reddy", purpose: "Backend developer interview", time: "11:30 AM", date: "Today", status: "Awaiting HR", type: "Interview" },
    { id: "3", initials: "VP", visitor: "Vikram Patel", company: "Northstar Systems", host: "Aarav Mehta", purpose: "Quarterly service review", time: "1:00 PM", date: "Today", status: "Checked in", type: "Vendor visit" },
    { id: "4", initials: "SM", visitor: "Sara Mathew", company: "Vertex Labs", host: "CEO Office", purpose: "Research collaboration", time: "3:30 PM", date: "Today", status: "Awaiting Reception", type: "CEO visit", arrivalVisitorName: "Sara Mathew", arrivalPurpose: "Research collaboration", identityDocumentType: "Passport", identityDocumentLastFour: "A123", securityNotes: "Photo identity matched", securityIntakeAt: new Date().toISOString() },
    { id: "5", initials: "DR", visitor: "Dev Rao", company: "Cobalt Design", host: "Ananya Joshi", purpose: "Design handoff", time: "4:30 PM", date: "Today", status: "Approved", type: "Employee visit" },
    { id: "6", initials: "RK", visitor: "Rohan Khanna", company: "Axis Ventures", host: "CEO Office", purpose: "Strategic investment meeting", time: "5:00 PM", date: "Today", status: "Awaiting Manager", type: "CEO visit", routingDepartmentId: "OPS" },
    { id: "7", initials: "PJ", visitor: "Priya Jain", company: "Helios Labs", host: "Riya Sharma", purpose: "Product implementation review", time: "2:20 PM", date: "Today", status: "Awaiting Security", type: "Employee visit" },
    { id: "8", initials: "AM", visitor: "Aditi Menon", visitorEmail: "aditi.menon@northstar.example",
        visitorPhone: "+91 98765 12004", company: "Northstar Systems", host: "Kalyan Reddy",
        hostEmployeeId: "BSPL-IT-0071", purpose: "Project delivery and integration review", time: "4:00 PM",
        date: "Today", status: "Awaiting Team Lead", type: "Employee visit", referenceNumber: "BSA-KLYN-2041",
        arrivalVisitorName: "Aditi Menon", arrivalPurpose: "Project delivery and integration review",
        securityIntakeAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        receptionVerifiedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        hrDecisionAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        hrDecisionRemarks: "Visitor details verified and forwarded to the employee and Team Lead" },
];

const initialWorkTasks: WorkTask[] = [
    { id: "demo-work-1", departmentId: "TECH", employeeId: "BSPL-IT-0071", teamLeadUserId: "demo-team-lead",
        title: "Complete visitor workflow API validation", description: "Verify Security, Reception and HR routing contracts and document the result.",
        departmentBranch: "Technology", dueDate: nextBusinessDays(3)[0], status: "IN_PROGRESS",
        employeeUpdate: "Security and Reception routes validated; HR tests are in progress.", teamLeadReview: null,
        startedAt: new Date().toISOString(), completedAt: null, approvedAt: null, acknowledgedAt: null,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), version: 1 },
    { id: "demo-work-2", departmentId: "TECH", employeeId: "BSPL-IT-0071", teamLeadUserId: "demo-team-lead",
        title: "Publish appointment dashboard refinements", description: "Complete the responsive employee dashboard and submit it for Team Lead review.",
        departmentBranch: "Technology", dueDate: nextBusinessDays(1)[0], status: "COMPLETED",
        employeeUpdate: "Responsive view and empty states are complete.", teamLeadReview: null,
        startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), completedAt: new Date().toISOString(),
        approvedAt: null, acknowledgedAt: null, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), version: 2 },
];

function demoWorkspaceAppointments() {
    return readDemoAppointments().map((item): Appointment => {
        const visitorName = item.visitorName ?? item.visitorDisplayName ?? "Visitor";
        const host = initialEmployees.find((employee) => (employee.uuid ?? employee.id)
            === (item.requestedEmployeeId ?? item.hostReference));
        return {
            id: item.id ?? item.referenceNumber, initials: visitorInitials(visitorName), visitor: visitorName,
            visitorEmail: item.visitorEmail, visitorPhone: item.visitorPhone,
            company: item.visitorCompany ?? "Independent",
            host: host?.name ?? (item.hostCategory === "CEO" ? "CEO Office" : "BrainServe host"),
            purpose: item.purpose ?? "Visitor appointment", time: formatOfficeTime(item.slotStart),
            date: formatOfficeDate(item.slotStart, { year: undefined }), status: appointmentStatusFromApi(item.status),
            type: visitTypeLabel(item.type), referenceNumber: item.referenceNumber, hostEmployeeId: item.hostReference,
            hostCategory: item.hostCategory,
            routingDepartmentId: item.routingDepartmentId, requestedEmployeeId: item.requestedEmployeeId,
            slotStart: item.slotStart, identityDocumentType: item.identityDocumentType,
            identityDocumentLastFour: item.identityDocumentLastFour, securityNotes: item.notes,
            securityIntakeAt: item.securityIntakeAt,
            receptionVerifiedAt: item.receptionVerifiedAt,
            receptionVerificationRemarks: item.receptionVerificationRemarks,
            managerApprovalActorId: item.managerApprovalActorId,
            managerDecisionAt: item.managerDecisionAt,
            managerDecisionRemarks: item.managerDecisionRemarks,
            ceoApprovalActorId: item.ceoApprovalActorId,
            ceoDecisionAt: item.ceoDecisionAt,
            ceoDecisionRemarks: item.ceoDecisionRemarks,
            receptionForwardedAt: item.receptionForwardedAt,
            createdAt: item.createdAt, assignedToCurrentActor: true,
        };
    });
}

function readPreviewWorkspaceAppointments() {
    const persisted = demoWorkspaceAppointments();
    const persistedReferences = new Set(persisted.map((item) => item.referenceNumber ?? item.id));
    return [
        ...initialAppointments.filter((item) => !persistedReferences.has(item.referenceNumber ?? item.id)),
        ...persisted,
    ];
}

function updateDemoAppointment(referenceNumber: string | undefined, status: string, patch: Partial<DemoAppointment> = {}) {
    if (isBackendConfigured || !referenceNumber) return;
    writeDemoAppointments(readDemoAppointments().map((item) => item.referenceNumber === referenceNumber
        ? { ...item, ...patch, status } : item));
}

const initialStaffAccounts: StaffAccount[] = [
    { userId: "demo-manager", employeeId: "BSPL-OP-0027", fullName: "Aarav Mehta", email: "aarav.mehta@brainserve.in",
        roles: ["ROLE_MANAGER"], enabled: true, forcePasswordChange: false, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["MANAGER_VISIT_APPROVE", "EMPLOYEE_READ", "REPORT_VIEW", "INTERNAL_NOTIFICATION_READ"] },
    { userId: "demo-hr-admin", employeeId: "BSPL-HR-0018", fullName: "Kavya Reddy", email: "hr.admin@brainserve.in",
        roles: ["ROLE_HR_ADMIN"], enabled: true, forcePasswordChange: false, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["HR_VISIT_APPROVE", "WORK_INSIGHT_AUDIT", "WORK_TASK_PERFORMANCE_READ", "INTERNAL_NOTIFICATION_READ"] },
    { userId: "demo-team-lead", employeeId: "BSPL-IT-0042", fullName: "Riya Sharma", email: "riya.sharma@brainserve.in",
        roles: ["ROLE_TEAM_LEAD"], enabled: true, forcePasswordChange: false, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["TEAM_LEAD_DIRECTORY_VIEW", "TEAM_LEAD_VISIT_APPROVE", "APPOINTMENT_REQUEST", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { userId: "demo-employee-kalyan", employeeId: "BSPL-IT-0071", fullName: "Kalyan Reddy", email: "kalyan@brainserve.in",
        roles: ["ROLE_EMPLOYEE"], enabled: true, forcePasswordChange: false, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["EMPLOYEE_READ", "APPOINTMENT_REQUEST", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { userId: "reception-preview", fullName: "Reception Desk", email: "reception@brainserve.in",
        roles: ["ROLE_RECEPTIONIST"], enabled: true, forcePasswordChange: true, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["EMPLOYEE_READ", "VISITOR_REGISTER", "RECEPTION_VISIT_VERIFY", "VISITOR_CHECK_IN", "VISITOR_CHECK_OUT", "QR_PASS_VERIFY"] },
    { userId: "security-preview", fullName: "Security Desk", email: "security@brainserve.in",
        roles: ["ROLE_SECURITY"], enabled: true, forcePasswordChange: false, status: "ACTIVE",
        grantedPermissions: [], deniedPermissions: [],
        effectivePermissions: ["SECURITY_VISITOR_INTAKE", "VISITOR_CHECK_IN", "VISITOR_CHECK_OUT", "QR_PASS_VERIFY"] },
];

const initialAccessRecords: AccessRecord[] = [{ id: "demo-access-1", appointmentId: "3",
    visitorName: "Vikram Patel", badgeNumber: "B-103",
    checkedInAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), checkedOutAt: null, processedBy: "Reception Desk" }];

function appointmentStatusFromApi(status: string): AppointmentStatus {
    const values: Record<string, AppointmentStatus> = {
        PENDING_HR_APPROVAL: "Awaiting HR",
        PENDING_TEAM_LEAD_APPROVAL: "Awaiting Team Lead",
        PENDING_MANAGER_APPROVAL: "Awaiting Manager",
        PENDING_CEO_APPROVAL: "Awaiting CEO",
        PENDING_SECURITY_INTAKE: "Awaiting Security",
        PENDING_RECEPTION_VERIFICATION: "Awaiting Reception",
        PENDING_APPROVAL: "Pending",
        PENDING_VERIFICATION: "Pending",
        APPROVED: "Approved",
        CHECKED_IN: "Checked in",
        IN_MEETING: "Checked in",
        CHECKED_OUT: "Completed",
        COMPLETED: "Completed",
        REJECTED: "Rejected",
        CANCELLED: "Cancelled",
        EXPIRED: "Expired",
    };
    return values[status] ?? "Pending";
}

function visitTypeLabel(type: string) {
    const values: Record<string, string> = {
        INTERVIEW: "Interview", CEO_VISIT: "CEO visit", HR_VISIT: "HR visit", EMERGENCY: "Emergency visit",
        EMPLOYEE_VISIT: "Employee visit", CLIENT_MEETING: "Client meeting", VENDOR_VISIT: "Vendor visit",
    };
    return values[type] ?? type.replaceAll("_", " ").toLowerCase();
}

function visitorInitials(name: string) {
    return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "VI";
}

function employeeStatusLabel(status: string): Employee["status"] {
    const labels: Record<string, Employee["status"]> = { ACTIVE: "Active", ON_LEAVE: "On leave", ONBOARDING: "Onboarding",
        NOTICE_PERIOD: "Notice period", SUSPENDED: "Suspended", RESIGNED: "Resigned", TERMINATED: "Terminated", INACTIVE: "Inactive" };
    return labels[status] ?? "Onboarding";
}

const employeeStatusCode: Record<Employee["status"], string> = { Active: "ACTIVE", "On leave": "ON_LEAVE",
    Onboarding: "ONBOARDING", "Notice period": "NOTICE_PERIOD", Suspended: "SUSPENDED", Resigned: "RESIGNED",
    Terminated: "TERMINATED", Inactive: "INACTIVE" };

function canDecideVisit(role: Role, appointment: Appointment) {
    return (role === "HR Admin" && appointment.status === "Awaiting HR"
            && appointment.assignedToCurrentActor !== false) ||
        (role === "Team Lead" && appointment.status === "Awaiting Team Lead") ||
        (role === "Manager" && appointment.status === "Awaiting Manager") ||
        (role === "CEO" && appointment.status === "Awaiting CEO");
}

function isCeoApprovalRoute(appointment: Appointment) {
    return appointment.type === "CEO visit"
        || appointment.type === "Emergency visit"
        && (appointment.hostCategory === "CEO" || appointment.host === "CEO Office");
}

function needsAppointmentAction(role: Role, appointment: Appointment) {
    return (canDecideVisit(role, appointment)
            && !(role === "HR Admin" && appointment.assignedToCurrentActor === false))
        || (role === "Security" && appointment.status === "Awaiting Security")
        || (role === "Reception" && appointment.status === "Awaiting Reception");
}

const initialEmployees: Employee[] = [
    { id: "BSPL-IT-0042", departmentId: "TECH", name: "Riya Sharma", initials: "RS", role: "Engineering Manager", department: "Technology", email: "riya.sharma@brainserve.in", status: "Active" },
    { id: "BSPL-HR-0018", departmentId: "HR", name: "Kavya Reddy", initials: "KR", role: "HR Business Partner", department: "Human Resources", email: "kavya.reddy@brainserve.in", status: "Active" },
    { id: "BSPL-OP-0027", departmentId: "OPS", name: "Aarav Mehta", initials: "AM", role: "Operations Lead", department: "Operations", email: "aarav.mehta@brainserve.in", status: "Active" },
    { id: "BSPL-FN-0011", departmentId: "FIN", name: "Ananya Joshi", initials: "AJ", role: "Finance Analyst", department: "Finance", email: "ananya.joshi@brainserve.in", status: "On leave" },
    { id: "BSPL-IT-0069", departmentId: "TECH", name: "Ishaan Verma", initials: "IV", role: "Software Engineer", department: "Technology", email: "ishaan.verma@brainserve.in", status: "Onboarding" },
    { id: "BSPL-IT-0071", departmentId: "TECH", name: "Kalyan Reddy", initials: "KR", role: "Software Engineer", department: "Technology", email: "kalyan@brainserve.in", status: "Active" },
];

function belongsToDepartment(employee: Employee, department: Department) {
    return employee.departmentId ? employee.departmentId === department.id : employee.department === department.name;
}

const initialDepartments: Department[] = [
    { id: "TECH", code: "TECH", name: "Technology", active: true, version: 0 },
    { id: "HR", code: "HR", name: "Human Resources", active: true, version: 0 },
    { id: "OPS", code: "OPS", name: "Operations", active: true, version: 0 },
    { id: "FIN", code: "FIN", name: "Finance", active: true, version: 0 },
];

const initialTeamLeadAssignments: TeamLeadAssignment[] = [
    { id: "demo-tl-tech", departmentId: "TECH", teamLeadUserId: "demo-team-lead",
        teamLeadEmployeeId: "BSPL-IT-0042", active: true, assignedByUserId: "demo-hr-admin",
        assignedAt: "2026-07-15T04:30:00.000Z", endedByUserId: null, endedAt: null },
];

const initialDepartmentHrAssignments: DepartmentHrAssignment[] = [
    { id: "demo-hr-tech", departmentId: "TECH", hrUserId: "demo-hr-admin", hrEmployeeId: "BSPL-HR-0018",
        active: true, assignedByUserId: "demo-ceo", assignedAt: "2026-07-16T04:30:00.000Z",
        endedByUserId: null, endedAt: null },
];

const initialManagerAssignments: ManagerAssignment[] = [
    { id: "demo-manager-ops", departmentId: "OPS", managerUserId: "demo-manager",
        managerEmployeeId: "BSPL-OP-0027", active: true, assignedByUserId: "demo-ceo",
        assignedAt: "2026-07-20T04:30:00.000Z", endedByUserId: null, endedAt: null },
];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "appointments", label: "Appointments", icon: CalendarDays },
    { id: "work", label: "Work board", icon: BriefcaseBusiness },
    { id: "performance", label: "Team Lead performance", icon: Sparkles },
    { id: "insights", label: "Insights", icon: FileClock },
    { id: "employees", label: "Employees", icon: Users },
    { id: "terminations", label: "Terminations", icon: UserCog },
    { id: "account-lifecycle", label: "Account lifecycle", icon: Archive },
    { id: "visitors", label: "Visitors", icon: IdCard },
    { id: "notifications", label: "Notifications", icon: MessageSquare },
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "audit", label: "Audit trail", icon: FileClock },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
];

const rolePermissions: Record<Role, View[]> = {
    "HR Admin": ["overview", "appointments", "performance", "insights", "employees", "terminations", "account-lifecycle", "visitors", "notifications", "organization", "reports", "audit", "settings", "profile"],
    CEO: ["overview", "appointments", "insights", "employees", "terminations", "account-lifecycle", "visitors", "notifications", "organization", "reports", "audit", "settings", "profile"],
    Manager: ["overview", "appointments", "insights", "employees", "visitors", "notifications", "organization", "reports", "profile"],
    "Team Lead": ["overview", "work", "employees", "notifications", "organization", "reports", "profile"],
    Employee: ["overview", "work", "employees", "notifications", "reports", "profile"],
    Reception: ["overview", "appointments", "visitors", "notifications", "reports", "profile"],
    Security: ["overview", "appointments", "visitors", "reports", "profile"],
    "System Admin": ["overview", "insights", "account-lifecycle", "reports", "audit", "logs", "settings", "profile"],
};

function Logo({ compact = false, productName = "BrainServe Connect" }: { compact?: boolean; productName?: string }) {
    return (
        <div className="brand-lockup" aria-label={productName}>
            <div className="brand-mark"><span>B</span></div>
            {!compact && <div><strong>{productName}</strong><small>Workplace Operations</small></div>}
        </div>
    );
}

function useModalDialog(onClose: () => void) {
    useEffect(() => {
        const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog']");
        const dialog = dialogs.item(dialogs.length - 1);
        if (!dialog) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        const selector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
        const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(selector))
            .filter((element) => element.offsetParent !== null);
        window.requestAnimationFrame(() => (focusable()[0] ?? dialog).focus());
        document.body.style.overflow = "hidden";
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab") return;
            const items = focusable();
            if (!items.length) { event.preventDefault(); dialog.focus(); return; }
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [onClose]);
}

function StatusPill({ status }: {
    status: Appointment["status"] | Employee["status"] | "Verified" | "Pending verification";
}) {
    const key = status.toLowerCase().replace(" ", "-");
    return <span className={`status-pill status-${key}`}><span />{status}</span>;
}

function Welcome({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
    const featuredDate = dateCard(officeToday());
    const [profile, setProfile] = useState<CompanyProfile>(() => isBackendConfigured
        ? { name: "", emailDomain: "", hqAddress: "", supportEmail: "", consentVersion: "" }
        : { name: "BrainServe Connect", emailDomain: "brainserve.in", hqAddress: "Hyderabad, Telangana, India",
            supportEmail: "support@brainserve.in", consentVersion: "2026.1" });
    const [leadership, setLeadership] = useState(() => isBackendConfigured
        ? { ceo: "", hr: "" } : { ceo: "Chief Executive Officer", hr: "HR Admin" });
    useEffect(() => {
        if (!isBackendConfigured) return;
        let active = true;
        Promise.all([brainServeApi.companyProfile(), brainServeApi.publicHosts()]).then(([value, hosts]) => {
            if (!active) return; setProfile(value);
            setLeadership({ ceo: hosts.find((host) => host.category === "CEO")?.displayName ?? "Chief Executive Officer",
                hr: hosts.find((host) => host.category === "HR")?.displayName ?? "HR Admin" });
        }).catch(() => undefined);
        return () => { active = false; };
    }, []);
    return (
        <main className="welcome-page">
            <div className="ambient ambient-one" />
            <div className="ambient ambient-two" />
            <header className="public-header glass-panel">
                <Logo productName="BrainServe Connect" />
                <nav aria-label="Public navigation">
                    <button className="text-button" onClick={() => onNavigate("track")}>Track appointment</button>
                    <button className="button button-quiet" onClick={() => onNavigate("login")}><LogIn size={17} /> Staff login</button>
                </nav>
            </header>

            <section className="welcome-hero">
                <div className="eyebrow"><Sparkles size={14} /> Welcome to {profile.name || "your organization"}</div>
                <h1>A thoughtful welcome,<br /><span>before you arrive.</span></h1>
                <p>Book a secure appointment with our employees, HR team or leadership at {profile.hqAddress || "our office"}. We’ll guide your visit from approval to check-out.</p>
                <div className="hero-actions">
                    <button className="button button-primary button-large" onClick={() => onNavigate("book")}>Book an appointment <ArrowRight size={18} /></button>
                    <button className="button button-secondary button-large" onClick={() => onNavigate("track")}><Search size={18} /> Track your visit</button>
                </div>
                <div className="trust-row">
                    <span><ShieldCheck size={17} /> Privacy protected</span>
                    <span><BadgeCheck size={17} /> Verified check-in</span>
                    <span><Bell size={17} /> Real-time updates</span>
                </div>
            </section>

            <aside className="arrival-card glass-panel">
                <div className="arrival-top"><span>YOUR VISIT</span><QrCode size={22} /></div>
                <div className="mini-date"><strong>{featuredDate.date}</strong><span>{featuredDate.month.toUpperCase()}<br />TODAY</span></div>
                <div className="arrival-details">
                    <span>Appointment with</span>
                    <strong>{leadership.ceo || "Leadership"}</strong>
                    <small>Leadership visit · coordinated through Reception</small>
                </div>
                <div className="arrival-timeline"><span className="done" /><i /><span className="done" /><i /><span /></div>
                <div className="arrival-stages"><span>Requested</span><span>Approved</span><span>Arrive</span></div>
                <div className="arrival-footer"><CheckCircle2 size={17} /><span><strong>You’re approved</strong><small>Present your QR code at reception</small></span></div>
            </aside>

            <section className="how-it-works">
                <div><span>01</span><strong>Choose your host</strong><small>Find the right person or team.</small></div>
                <div><span>02</span><strong>Pick a suitable time</strong><small>See only genuinely available slots.</small></div>
                <div><span>03</span><strong>Receive your pass</strong><small>Get approval, updates and a secure QR.</small></div>
            </section>
        </main>
    );
}

function BookingFlow({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
    const [step, setStep] = useState(1);
    const [submission, setSubmission] = useState<PublicAppointment | null>(null);
    const [visitType, setVisitType] = useState("Employee visit");
    const dates = useMemo(() => appointmentDates(8, visitType === "Emergency visit"), [visitType]);
    const [visitDate, setVisitDate] = useState(() => appointmentDates(8, false)[0]);
    const [hosts, setHosts] = useState<PublicHost[]>([]);
    const [publicDepartments, setPublicDepartments] = useState<Department[]>(() =>
        isBackendConfigured ? [] : initialDepartments,
    );
    const [hostId, setHostId] = useState("");
    const [routingDepartmentId, setRoutingDepartmentId] = useState("");
    const [requestedEmployeeId, setRequestedEmployeeId] = useState("");
    const [requestedEmployees, setRequestedEmployees] = useState<PublicDirectoryEmployee[]>([]);
    const [employeeQuery, setEmployeeQuery] = useState("");
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [slots, setSlots] = useState<AvailableSlot[]>([]);
    const [slot, setSlot] = useState<AvailableSlot | null>(null);
    const [visitor, setVisitor] = useState({ name: "", email: "", phone: "", company: "", purpose: "" });
    const [consentVersion, setConsentVersion] = useState(() => isBackendConfigured ? "" : "2026.1");
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const steps = ["Visit", "Schedule", "Your details", "Review"];
    const requiredHostCategory = hostCategoryForVisit(visitType);
    const requiredHostCategories = useMemo(() => hostCategoriesForVisit(visitType), [visitType]);
    const eligibleHosts = useMemo(() => hosts.filter((host) => requiredHostCategories.includes(host.category)
            && (!routingDepartmentId || host.category === "CEO" || host.departmentId === routingDepartmentId)),
        [hosts, requiredHostCategories, routingDepartmentId]);
    const routingDepartments = useMemo(() => publicDepartments.filter((department) => department.active)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((department) => [department.id, department.name] as const), [publicDepartments]);
    const selectedHost = hosts.find((host) => host.id === hostId);

    const loadRequestedEmployees = useCallback(async (departmentId: string, query = "") => {
        if (!departmentId) { setRequestedEmployees([]); return; }
        setEmployeesLoading(true);
        try {
            const next = isBackendConfigured
                ? (await brainServeApi.publicEmployees(departmentId, query)).content
                : initialEmployees.filter((employee) => employee.status === "Active"
                    && (employee.departmentId ?? employee.department) === departmentId
                    && (!query || `${employee.name} ${employee.id}`.toLowerCase().includes(query.toLowerCase())))
                    .slice(0, 25).map((employee) => ({
                        id: employee.uuid ?? employee.id, displayName: employee.name,
                        designation: employee.role, departmentId,
                    }));
            setRequestedEmployees(next);
            setRequestedEmployeeId((current) => next.some((item) => item.id === current) ? current : "");
        } catch (reason) {
            setRequestedEmployees([]);
            setError(reason instanceof Error ? reason.message : "The employee directory could not be loaded.");
        } finally { setEmployeesLoading(false); }
    }, []);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const [result, departmentResult, companyProfile]: [PublicHost[], Department[], CompanyProfile] = isBackendConfigured
                    ? await Promise.all([brainServeApi.publicHosts(), brainServeApi.publicDepartments(), brainServeApi.companyProfile()])
                    : [(() => {
                        const employeeHosts: PublicHost[] = initialEmployees.filter((employee) => employee.status === "Active").map((employee) => ({
                            id: employee.id, displayName: employee.name, designation: employee.role,
                            departmentId: employee.department === "Human Resources" ? "TECH" : employee.departmentId ?? employee.department,
                            departmentName: employee.department === "Human Resources" ? "Technology" : employee.department,
                            category: employee.id === "BSPL-IT-0042" ? "TEAM_LEAD"
                                : employee.department === "Human Resources" ? "HR" : "EMPLOYEE",
                        }));
                        const accountChiefExecutives: PublicHost[] = readDemoAccounts()
                            .filter((account) => account.status === "ACTIVE" && account.role === "ROLE_CEO")
                            .map((account) => ({ id: account.id, displayName: account.fullName,
                                designation: "Chief Executive Officer", departmentId: "EXEC", departmentName: "Executive Office", category: "CEO" }));
                        const chiefExecutives = accountChiefExecutives.length ? accountChiefExecutives : [{
                            id: "00000000-0000-0000-0000-00000000ce00", displayName: "BrainServe CEO",
                            designation: "Chief Executive Officer", departmentId: "EXEC", departmentName: "Executive Office", category: "CEO" as const,
                        }];
                        return [...employeeHosts, ...chiefExecutives];
                    })(), readDemoDepartments(), { name: "BrainServe Connect", emailDomain: "brainserve.in",
                        hqAddress: "Hyderabad, Telangana, India", supportEmail: "support@brainserve.in",
                        consentVersion: "2026.1" }];
                if (!active) return;
                setHosts(result);
                setPublicDepartments(departmentResult);
                setConsentVersion(companyProfile.consentVersion);
                const categories = hostCategoriesForVisit(visitType);
                const initialEligible = result.filter((host) => categories.includes(host.category));
                const initialDepartment = visitType === "CEO visit"
                    ? departmentResult.find((department) => department.active)?.id ?? ""
                    : result.find((host) => host.category === "HR")?.departmentId
                    ?? departmentResult.find((department) => department.active)?.id ?? "";
                setRoutingDepartmentId(initialDepartment);
                if (visitType === "Employee visit") {
                    setRequestedEmployeeId("");
                    setHostId(result.find((host) => host.category === "HR" && host.departmentId === initialDepartment)?.id ?? "");
                } else setHostId(initialEligible[0]?.id ?? "");
            } catch (reason) {
                if (active) setError(reason instanceof ApiError ? reason.message : "Available hosts could not be loaded.");
            }
        };
        void load();
        return () => { active = false; };
    }, [visitType]);

    useEffect(() => {
        if (visitType !== "Employee visit" || !routingDepartmentId) return;
        const timer = window.setTimeout(() => void loadRequestedEmployees(routingDepartmentId), 0);
        return () => window.clearTimeout(timer);
    }, [loadRequestedEmployees, routingDepartmentId, visitType]);

    useEffect(() => {
        if (!hostId || !visitDate) return;
        let active = true;
        const load = async () => {
            try {
                const result = isBackendConfigured
                    ? await brainServeApi.availableSlots(hostId, visitDate, appointmentTypeCode(visitType))
                    : fallbackSlots(visitDate);
                if (!active) return;
                setSlots(result);
                setSlot(result[0] ?? null);
            } catch (reason) {
                if (active) { setSlots([]); setError(reason instanceof ApiError ? reason.message : "Available slots could not be loaded."); }
            }
        };
        void load();
        return () => { active = false; };
    }, [hostId, visitDate, visitType]);

    const chooseVisitType = (nextType: string) => {
        setVisitType(nextType);
        const categories = hostCategoriesForVisit(nextType);
        const matchingHosts = hosts.filter((host) => categories.includes(host.category));
        const department = nextType === "CEO visit"
            ? routingDepartments[0]?.[0] ?? ""
            : hosts.find((host) => host.category === "HR")?.departmentId ?? routingDepartments[0]?.[0] ?? "";
        setRoutingDepartmentId(department);
        if (nextType === "Employee visit") {
            setRequestedEmployeeId("");
            setEmployeeQuery("");
            setHostId(hosts.find((host) => host.category === "HR" && host.departmentId === department)?.id ?? "");
        } else {
            setRequestedEmployeeId(""); setRequestedEmployees([]); setEmployeeQuery("");
            setHostId(matchingHosts[0]?.id ?? "");
        }
        setVisitDate(appointmentDates(8, nextType === "Emergency visit")[0]);
        setSlot(null); setSlots([]); setError("");
    };

    const continueFlow = async () => {
        setError("");
        if (step === 1 && (!hostId || !routingDepartmentId || visitor.purpose.trim().length < 5
            || (visitType === "Employee visit" && (!routingDepartmentId || !requestedEmployeeId)))) {
            setError("Select an available host and enter a clear purpose of at least 5 characters."); return;
        }
        if (step === 2 && !slot) { setError("Select an available appointment slot."); return; }
        if (step === 3) {
            if (visitor.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(visitor.email)
                || visitor.phone.replace(/\D/g, "").length < 8 || !consent) {
                setError("Enter a valid name, email and mobile number, then accept the privacy notice."); return;
            }
        }
        if (step < 4) { setStep(step + 1); return; }
        if (!slot || !selectedHost) return;
        setBusy(true);
        try {
            const payload = {
                type: appointmentTypeCode(visitType), visitorName: visitor.name.trim(), visitorEmail: visitor.email.trim(),
                visitorPhone: visitor.phone.trim(), visitorCompany: visitor.company.trim() || null,
                hostEmployeeId: selectedHost.id,
                // Leadership visits belong to the department whose assigned Manager reviews them.
                routingDepartmentId: routingDepartmentId || selectedHost.departmentId,
                requestedEmployeeId: visitType === "Employee visit" ? requestedEmployeeId : null,
                slotStart: slot.start, slotEnd: slot.end, purpose: visitor.purpose.trim(),
            };
            let result: PublicAppointment;
            if (isBackendConfigured) {
                const idempotencyKey = newClientId();
                await brainServeApi.registerVisitor({
                    name: visitor.name.trim(), email: visitor.email.trim(), phone: visitor.phone.trim(),
                    company: visitor.company.trim() || null, governmentId: null, consentVersion,
                }, idempotencyKey);
                result = await brainServeApi.createAppointment(payload, idempotencyKey);
            } else {
                const demoResult: DemoAppointment = {
                    id: newClientId(),
                    referenceNumber: newDemoReference(), type: payload.type, status: "PENDING_SECURITY_INTAKE",
                    hostReference: selectedHost.id, slotStart: slot.start, slotEnd: slot.end,
                    hostCategory: selectedHost.category,
                    visitorDisplayName: visitor.name.trim(), visitorName: visitor.name.trim(),
                    visitorEmail: visitor.email.trim(), visitorPhone: visitor.phone.trim(),
                    visitorCompany: visitor.company.trim() || null, purpose: visitor.purpose.trim(),
                    routingDepartmentId: payload.routingDepartmentId,
                    requestedEmployeeId: payload.requestedEmployeeId,
                    createdAt: new Date().toISOString(),
                };
                writeDemoAppointments([...readDemoAppointments(), demoResult]);
                result = demoResult;
            }
            if (!isBackendConfigured) window.localStorage.setItem(DEMO_LAST_REFERENCE_KEY, result.referenceNumber);
            setSubmission(result);
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : "Your appointment request could not be submitted.");
        } finally { setBusy(false); }
    };

    const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!submission) return;
        setBusy(true); setError("");
        const data = new FormData(event.currentTarget);
        try {
            setSubmission(await brainServeApi.verifyAppointment(submission.referenceNumber, String(data.get("otp"))));
        } catch (reason) { setError(reason instanceof ApiError ? reason.message : "The OTP could not be verified."); }
        finally { setBusy(false); }
    };

    if (submission) {
        return (
            <main className="flow-page">
                <header className="flow-header"><Logo /><button className="icon-button" onClick={() => onNavigate("welcome")} aria-label="Close"><X size={20} /></button></header>
                <section className="confirmation-card glass-panel">
                    <div className="success-icon"><Check size={32} /></div>
                    <span className="eyebrow">Request submitted</span>
                    <h1>We’ll take it from here.</h1>
                    <p>{submission.status === "PENDING_VERIFICATION"
                        ? "We emailed a six-digit OTP to verify this request before it enters approval."
                        : "Your contact is verified. Security records arrival, then Reception routes the request to the department HR, Team Lead or Manager required for this visit."}</p>
                    <div className="reference-box"><span>TRACKING REFERENCE</span><strong>{submission.referenceNumber}</strong><button className="button button-quiet" onClick={() => onNavigate("track")}>Track status <ArrowRight size={16} /></button></div>
                    <div className="confirmation-grid"><div><CalendarDays size={18} /><span><small>Date</small><strong>{formatOfficeDate(submission.slotStart)}</strong></span></div><div><Clock3 size={18} /><span><small>Time</small><strong>{formatOfficeTime(submission.slotStart)}</strong></span></div><div><CircleUserRound size={18} /><span><small>Host</small><strong>{selectedHost?.displayName ?? "BrainServe host"}</strong></span></div><div><Building2 size={18} /><span><small>Location</small><strong>Hyderabad HQ</strong></span></div></div>
                    {submission.status === "PENDING_VERIFICATION" && <form className="inline-account-form" onSubmit={verifyOtp}><label>Verification OTP<input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label><button className="button button-primary" disabled={busy}>{busy ? "Verifying…" : "Verify request"}</button></form>}
                    {error && <div className="login-error" role="alert">{error}</div>}
                    <button className="button button-primary button-large" onClick={() => onNavigate("welcome")}>Return to home</button>
                </section>
            </main>
        );
    }

    return (
        <main className="flow-page">
            <header className="flow-header"><Logo /><button className="icon-button" onClick={() => onNavigate("welcome")} aria-label="Close"><X size={20} /></button></header>
            <div className="flow-shell">
                <aside className="stepper glass-panel">
                    <span className="eyebrow">Book an appointment</span>
                    <h2>Plan your visit</h2>
                    <p>Complete these four simple steps. Your information remains protected.</p>
                    <div className="step-list">
                        {steps.map((label, index) => <div key={label} className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span><div><strong>{label}</strong><small>{["Who would you like to meet?", "Choose an available time", "Tell us who you are", "Confirm your request"][index]}</small></div></div>)}
                    </div>
                    <div className="privacy-note"><ShieldCheck size={19} /><span><strong>Your privacy matters</strong><small>Data is encrypted and used only to coordinate your visit.</small></span></div>
                </aside>

                <section className="form-card glass-panel">
                    <div className="form-heading"><span>STEP {step} OF 4</span><h1>{["Who are you visiting?", "Choose your arrival time", "Tell us about yourself", "Review your request"][step - 1]}</h1><p>{["Select a visit type and the right BrainServe host.", "Available slots are shown in India Standard Time.", "We’ll use these details for verification and visit updates.", "Check everything before sending it for approval."][step - 1]}</p></div>

                    {step === 1 && <div className="field-stack">
                        <label>Visit type</label>
                        <div className="choice-grid">{["Employee visit", "HR visit", "CEO visit", "Interview", "Client meeting", "Emergency visit"].map((type) => <button type="button" key={type} className={visitType === type ? "choice active" : "choice"} onClick={() => chooseVisitType(type)}><span>{type === "Interview" || type === "Client meeting" ? <BriefcaseBusiness size={20} /> : type === "CEO visit" ? <ShieldCheck size={20} /> : type === "Emergency visit" ? <Bell size={20} /> : <Users size={20} />}</span><strong>{type}</strong><small>{type === "Interview" ? "Candidate meeting" : type === "Client meeting" ? "Meet a department Team Lead" : type === "Emergency visit" ? "Request the next available time today" : `Meet our ${type.replace(" visit", "").toLowerCase()} team`}</small></button>)}</div>
                        <><label htmlFor="department">Routing department</label><select id="department" value={routingDepartmentId} onChange={(event) => { const department = event.target.value; setRoutingDepartmentId(department); setRequestedEmployeeId(""); setRequestedEmployees([]); setEmployeeQuery(""); const category = visitType === "Employee visit" ? "HR" : requiredHostCategories[0]; if (category !== "CEO") setHostId(hosts.find((host) => host.departmentId === department && host.category === category)?.id ?? ""); setSlot(null); setSlots([]); }}><option value="">Select a department</option>{routingDepartments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></>
                        {visitType === "Employee visit" && <><label htmlFor="employeeSearch">Find employee</label><div className="directory-search-row"><input id="employeeSearch" value={employeeQuery}
                                                                                                                                                               onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Name or employee ID" /><button type="button"
                                                                                                                                                                                                                                                                      className="button button-secondary" disabled={employeesLoading || !routingDepartmentId}
                                                                                                                                                                                                                                                                      onClick={() => void loadRequestedEmployees(routingDepartmentId, employeeQuery)}><Search size={15} />{employeesLoading ? "Searching…" : "Search"}</button></div>
                            <label htmlFor="requestedEmployee">Employee to meet</label><select id="requestedEmployee" value={requestedEmployeeId}
                                                                                               onChange={(event) => setRequestedEmployeeId(event.target.value)} required disabled={employeesLoading}>
                                <option value="">{employeesLoading ? "Loading department employees…" : "Select an active employee"}</option>
                                {requestedEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName} · {employee.designation}</option>)}</select></>}
                        <label htmlFor="host">Select host</label>
                        <select id="host" value={hostId} onChange={(event) => { const next = hosts.find((host) => host.id === event.target.value); setHostId(event.target.value); if (next?.category !== "CEO") setRoutingDepartmentId(next?.departmentId ?? ""); setSlot(null); setSlots([]); }} disabled={!eligibleHosts.length}><option value="">{eligibleHosts.length ? "Select an active host" : `No eligible ${requiredHostCategory ?? "host"} assigned`}</option>{eligibleHosts.map((host) => <option key={host.id} value={host.id}>{host.displayName} · {host.designation} · {host.departmentName}</option>)}</select>
                        <label htmlFor="purpose">Purpose of visit</label><textarea id="purpose" value={visitor.purpose} onChange={(e) => setVisitor({ ...visitor, purpose: e.target.value })} placeholder="Briefly describe what you’d like to discuss" />
                    </div>}

                    {step === 2 && <div className="field-stack">
                        <label>Visit date</label>
                        <div className="date-strip">{dates.map((date) => { const card = dateCard(date); return <button type="button" className={visitDate === date ? "active" : ""} onClick={() => { setVisitDate(date); setSlot(null); setSlots([]); }} key={date}><small>{date === officeToday() ? "TODAY" : card.day}</small><strong>{card.date}</strong><small>{card.month}</small></button>; })}</div>
                        <label>Available slots</label>
                        <div className="slot-grid">{slots.map((available) => <button type="button" key={available.start} className={slot?.start === available.start ? "active" : ""} onClick={() => setSlot(available)}>{formatOfficeTime(available.start)}</button>)}</div>
                        {!slots.length && <div className="empty-state"><Clock3 size={24} /><strong>No available slots</strong><small>{visitType === "Emergency visit" ? "No future office-hour slots remain today. Choose the next working day." : "Choose another business day or host."}</small></div>}
                        <div className="info-banner"><Clock3 size={18} /><span><strong>30 minute appointment</strong><small>Past times are removed automatically. A 10 minute arrival buffer is included.</small></span></div>
                    </div>}

                    {step === 3 && <div className="field-stack two-column-fields">
                        <label>Full name<input required value={visitor.name} onChange={(e) => setVisitor({ ...visitor, name: e.target.value })} placeholder="Your full name" /></label>
                        <label>Company<input value={visitor.company} onChange={(e) => setVisitor({ ...visitor, company: e.target.value })} placeholder="Company or organization" /></label>
                        <label>Email address<input required type="email" value={visitor.email} onChange={(e) => setVisitor({ ...visitor, email: e.target.value })} placeholder="name@example.com" /></label>
                        <label>Mobile number<input required value={visitor.phone} onChange={(e) => setVisitor({ ...visitor, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
                        <label className="checkbox-label full-field"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to the visitor privacy notice and consent to identity verification at reception.</span></label>
                    </div>}

                    {step === 4 && <div className="review-list">
                        <div><CircleUserRound size={20} /><span><small>Host</small><strong>{selectedHost?.displayName} · {selectedHost?.designation}</strong></span><button onClick={() => setStep(1)}>Edit</button></div>
                        <div><CalendarDays size={20} /><span><small>Date and time</small><strong>{slot ? `${formatOfficeDate(slot.start)} · ${formatOfficeTime(slot.start)}` : "No slot selected"}</strong></span><button onClick={() => setStep(2)}>Edit</button></div>
                        <div><IdCard size={20} /><span><small>Visitor</small><strong>{visitor.name} · {visitor.email}</strong></span><button onClick={() => setStep(3)}>Edit</button></div>
                        <div><FileText size={20} /><span><small>Visit</small><strong>{visitType} · {visitor.purpose}</strong></span></div>
                        <div className="approval-note"><Bell size={19} /><span><strong>What happens next?</strong><small>Security and Reception verify the visit, then the assigned department approver completes the review. Once approved, we’ll send your secure visitor QR pass by email.</small></span></div>
                    </div>}

                    {error && <div className="login-error" role="alert">{error}</div>}
                    <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => step === 1 ? onNavigate("welcome") : setStep(step - 1)}><ArrowLeft size={17} /> Back</button><button type="button" className="button button-primary" disabled={busy} onClick={() => void continueFlow()}>{busy ? "Submitting…" : step === 4 ? "Submit request" : "Continue"}<ArrowRight size={17} /></button></div>
                </section>
            </div>
        </main>
    );
}

function TrackAppointment({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
    const [reference, setReference] = useState(() => isBackendConfigured || typeof window === "undefined"
        ? "" : window.localStorage.getItem(DEMO_LAST_REFERENCE_KEY) ?? "");
    const [result, setResult] = useState<PublicAppointment | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [visitorPass, setVisitorPass] = useState<VisitorPass | null>(null);
    const [passError, setPassError] = useState("");
    const [cancellationOtpRequested, setCancellationOtpRequested] = useState(false);
    const [cancellationOtp, setCancellationOtp] = useState("");
    useEffect(() => {
        if (!result || !["APPROVED", "CHECKED_IN"].includes(result.status)) return;
        let active = true;
        const load = async () => {
            try {
                const pass = isBackendConfigured
                    ? await brainServeApi.visitorPass(result.referenceNumber)
                    : {
                        referenceNumber: result.referenceNumber, visitorDisplayName: result.visitorDisplayName,
                        status: result.status, validFrom: result.slotStart,
                        expiresAt: new Date(new Date(result.slotEnd).getTime() + 2 * 60 * 60 * 1000).toISOString(),
                        token: `brainserve-demo:${result.referenceNumber}`,
                        qrCodeDataUrl: await (await import("qrcode")).default.toDataURL(`brainserve-demo:${result.referenceNumber}`, {
                            width: 320, margin: 1, color: { dark: "#690718", light: "#ffffff" },
                        }),
                    } satisfies VisitorPass;
                if (active) setVisitorPass(pass);
            } catch (reason) {
                if (active) setPassError(reason instanceof Error ? reason.message : "The QR pass could not be generated.");
            }
        };
        void load();
        return () => { active = false; };
    }, [result]);
    const trackedReference = result?.referenceNumber;
    const trackedStatus = result?.status;
    useEffect(() => {
        if (!trackedReference || !trackedStatus) return;
        const terminalStatuses = new Set(["CANCELLED", "REJECTED", "COMPLETED", "CHECKED_OUT", "NO_SHOW", "EXPIRED"]);
        if (terminalStatuses.has(trackedStatus)) return;
        let active = true;
        const refreshStatus = async () => {
            try {
                const refreshed = isBackendConfigured
                    ? await brainServeApi.trackAppointment(trackedReference)
                    : readDemoAppointments().find((item) => item.referenceNumber === trackedReference);
                if (active && refreshed) {
                    if (!["APPROVED", "CHECKED_IN"].includes(refreshed.status)) {
                        setVisitorPass(null);
                        setPassError("");
                    }
                    setResult(refreshed);
                }
            } catch { /* Keep the last verified status during a temporary refresh failure. */ }
        };
        const timer = window.setInterval(() => void refreshStatus(), 5000);
        const onStorage = (event: StorageEvent) => {
            if (event.key === DEMO_APPOINTMENTS_KEY) void refreshStatus();
        };
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            window.clearInterval(timer);
            window.removeEventListener("storage", onStorage);
        };
    }, [trackedReference, trackedStatus]);
    const track = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError(""); setResult(null); setVisitorPass(null); setPassError("");
        setCancellationOtpRequested(false); setCancellationOtp("");
        const normalized = reference.trim().toUpperCase();
        if (!/^BSA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
            setError("Enter a valid reference such as BSA-7M4K-26Q9."); setBusy(false); return;
        }
        try {
            const appointment = isBackendConfigured
                ? await brainServeApi.trackAppointment(normalized)
                : readDemoAppointments().find((item) => item.referenceNumber === normalized);
            if (!appointment) fail("Appointment was not found.");
            setReference(normalized); setResult(appointment);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Appointment was not found."); }
        finally { setBusy(false); }
    };
    const requestCancellationOtp = async () => {
        if (!result) return;
        setBusy(true); setError("");
        try {
            if (!isBackendConfigured) fail("Secure appointment cancellation requires the BrainServe backend.");
            await brainServeApi.requestAppointmentCancellationOtp(result.referenceNumber);
            setCancellationOtpRequested(true);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The cancellation code could not be sent."); }
        finally { setBusy(false); }
    };
    const cancel = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!result) return;
        setBusy(true); setError("");
        try {
            if (!isBackendConfigured) fail("Secure appointment cancellation requires the BrainServe backend.");
            setResult(await brainServeApi.cancelAppointment(result.referenceNumber, cancellationOtp));
            setCancellationOtpRequested(false);
            setCancellationOtp("");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The appointment could not be cancelled."); }
        finally { setBusy(false); }
    };
    const readableStatus = result ? appointmentStatusFromApi(result.status) : "Pending";
    const completed = result ? ["COMPLETED", "CHECKED_OUT"].includes(result.status) : false;
    const cancellable = result && !["CANCELLED", "REJECTED", "COMPLETED", "CHECKED_OUT", "EXPIRED"].includes(result.status);
    return <main className="flow-page"><header className="flow-header"><Logo /><button className="icon-button" onClick={() => onNavigate("welcome")} aria-label="Close"><X size={20} /></button></header><section className="track-card glass-panel"><div className="track-icon"><Search size={26} /></div><span className="eyebrow">Appointment tracker</span><h1>Know what’s happening.</h1><p>Enter the secure reference sent to your email.</p><form onSubmit={track}><label htmlFor="reference">Tracking reference</label><div className="reference-input"><input id="reference" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="e.g. BSA-7M4K-26Q9" required /><button className="button button-primary" disabled={busy}>{busy ? "Checking…" : "Track"}</button></div></form>{error && <div className="login-error" role="alert">{error}</div>}{result && <div className={`tracked-result${completed ? " tracked-completed" : ""}`}><div className="tracked-head"><span><CheckCircle2 size={20} /><strong>{readableStatus}</strong></span><small>{result.referenceNumber}</small></div><h3>{result.visitorDisplayName} · BrainServe Connect appointment</h3><p>{formatOfficeDate(result.slotStart)} · {formatOfficeTime(result.slotStart)} · Hyderabad HQ</p>{completed && <div className="completion-banner"><CheckCircle2 size={18} /><span><strong>Visit completed</strong><small>The visitor has checked out and this appointment is now closed.</small></span></div>}<div className="arrival-timeline"><span className="done" /><i /><span className={result.status !== "PENDING_VERIFICATION" ? "done" : ""} /><i /><span className={result.status === "CHECKED_IN" || result.status === "IN_MEETING" || completed ? "done" : ""} /></div><div className="arrival-stages"><span>Requested</span><span>Approval</span><span>{completed ? "Completed" : "Arrival"}</span></div>{visitorPass && <div className="visitor-pass"><div className="visitor-pass-head"><span><QrCode size={18} /> SIGNED VISITOR PASS</span><strong>{visitorPass.referenceNumber}</strong></div><Image src={visitorPass.qrCodeDataUrl} width={320} height={320} unoptimized alt={`QR visitor pass for ${visitorPass.referenceNumber}`} /><p>Present this QR at reception or security. It is signed by BrainServe Connect and expires {formatOfficeDate(visitorPass.expiresAt)} at {formatOfficeTime(visitorPass.expiresAt)}.</p><a className="button button-primary" href={visitorPass.qrCodeDataUrl} download={`BrainServe-${visitorPass.referenceNumber}-pass.png`}><QrCode size={16} /> Save QR pass</a></div>}{passError && <div className="login-error" role="alert">{passError}</div>}{cancellable && !cancellationOtpRequested && <button className="button button-reject" disabled={busy} onClick={() => void requestCancellationOtp()}><X size={17} /> {busy ? "Sending code…" : "Cancel appointment"}</button>}{cancellable && cancellationOtpRequested && <form className="field-stack" onSubmit={cancel}><div className="info-banner"><ShieldCheck size={18} /><span><strong>Cancellation code sent</strong><small>Enter the six-digit code sent to the appointment email. It expires in 10 minutes.</small></span></div><label htmlFor="cancellationOtp">Cancellation code<input id="cancellationOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={cancellationOtp} onChange={(event) => setCancellationOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label><div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => { setCancellationOtpRequested(false); setCancellationOtp(""); }}>Keep appointment</button><button className="button button-reject" disabled={busy || cancellationOtp.length !== 6}><X size={17} /> {busy ? "Cancelling…" : "Confirm cancellation"}</button></div></form>}</div>}<button className="text-button back-home" onClick={() => onNavigate("welcome")}><ArrowLeft size={16} /> Back to home</button></section></main>;
}

function Login({ onLogin, onNavigate, sessionMessage = "", browserPreviewEnabled = false }: {
    onLogin: (role: Role, email: string, forcePasswordChange: boolean, currentPassword: string) => void;
    onNavigate: (screen: Screen) => void;
    sessionMessage?: string;
    browserPreviewEnabled?: boolean;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (!isBackendConfigured) {
            const email = String(data.get("email")).trim().toLowerCase();
            const password = String(data.get("password"));
            const passwordHash = await hashDemoPassword(password);
            const account = readDemoAccounts().find((item) => item.email === email
                && item.passwordHash === passwordHash && item.status === "ACTIVE");
            const accountRole = account ? roleFromAuthority(account.role) : null;
            if (account && accountRole === "Employee" && !account.employeeId) {
                setError("Your Employee login is approved, but HR must assign your department and employee ID before you can sign in.");
            } else if (account && accountRole) {
                onLogin(accountRole, account.email, Boolean(account.forcePasswordChange), password);
            }
            else setError("Invalid email or password, or the account is still pending approval.");
            return;
        }
        setLoading(true); setError("");
        try {
            const tokens = await brainServeApi.login(String(data.get("email")), String(data.get("password")));
            setAuthTokens(tokens.accessToken, tokens.refreshToken);
            const profile = await brainServeApi.me();
            const resolved = primaryRoleFromAuthorities(profile.roles);
            if (!resolved) {
                fail("This account must have exactly one supported BrainServe role. Ask System Admin to repair the account before signing in.");
            }
            if (resolved === "Employee" && !profile.employeeId) {
                fail("Your Employee login is approved, but HR must assign your department and employee ID before you can sign in.");
            }
            onLogin(resolved, profile.email, tokens.forcePasswordChange || profile.forcePasswordChange,
                String(data.get("password")));
        } catch (reason) {
            setAccessToken(null);
            setError(reason instanceof Error ? reason.message : "The BrainServe service is temporarily unavailable.");
        } finally { setLoading(false); }
    };

    return <main className="login-page"><div className="ambient ambient-one" /><section className="login-brand"><Logo /><div><span className="eyebrow">Secure workplace access</span><h1>Every visit.<br />One clear view.</h1><p>Coordinate appointments, employees and workplace access without compromising privacy.</p></div><div className="login-trust"><ShieldCheck size={20} /><span><strong>Enterprise protected</strong><small>Role-based access · Complete audit trail</small></span></div></section><section className="login-card glass-panel"><div className="login-card-head"><span className="avatar large">BS</span><div><small>INTERNAL PORTAL</small><h2>Welcome back</h2><p>Use your approved BrainServe Connect login email.</p></div></div>{browserPreviewEnabled && <section className="browser-preview-panel" aria-label="Browser preview roles"><div><span><ShieldCheck size={16} /> BROWSER PREVIEW</span><strong>Open a role workspace</strong><small>Uses isolated data in this browser. Real authentication starts automatically after the backend is connected.</small></div><div className="browser-preview-role-grid">{BROWSER_PREVIEW_ROLE_ORDER.map((previewRole) => <button type="button" key={previewRole} onClick={() => { const account = startBrowserPreviewRole(previewRole); onLogin(previewRole, account.email, false, ""); }}><span>{roleBadge(previewRole)}</span>{previewRole}</button>)}</div><button type="button" className="text-button browser-preview-reset" onClick={resetBrowserPreviewWorkspace}><RotateCcw size={14} /> Reset browser test data</button></section>}{sessionMessage && <div className="info-banner" role="status"><ShieldCheck size={17} /><span><strong>Session ended securely</strong><small>{sessionMessage}</small></span></div>}<form onSubmit={submit}><label>Login email<input name="email" type="email" placeholder="name@brainserve.in or System Admin email" autoComplete="username" required /></label><label>Password<div className="password-field"><input name="password" type="password" placeholder="Your password" autoComplete="current-password" minLength={8} required /><LockKeyhole size={17} /></div></label><div className="login-recovery-links"><button type="button" className="text-button" onClick={() => onNavigate("forgot-password")}>Forgot password?</button><button type="button" className="text-button" onClick={() => onNavigate("forgot-email")}>Forgot company email?</button></div>{error && <div className="login-error" role="alert">{error}</div>}<button className="button button-primary button-large full-button" disabled={loading}>{loading ? "Signing in…" : "Sign in securely"} {!loading && <ArrowRight size={18} />}</button></form><div className="login-divider"><span>Protected by BrainServe Connect IAM</span></div><button className="button button-secondary full-button" onClick={() => onNavigate("register")}><UserPlus size={17} /> Create an account</button><button className="text-button back-home" onClick={() => onNavigate("welcome")}><ArrowLeft size={16} /> Return to visitor portal</button></section></main>;
}

function ForcedPasswordChange({ email, currentPassword: initialPassword, onComplete, onLogout }: {
    email: string;
    currentPassword: string;
    onComplete: () => void;
    onLogout: () => void;
}) {
    const [currentPassword, setCurrentPassword] = useState(initialPassword);
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState<"request" | "confirm">("request");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [previewOtp, setPreviewOtp] = useState("");
    const requestOtp = async (event: FormEvent) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
            if (isBackendConfigured) {
                await brainServeApi.requestPasswordChangeOtp(currentPassword);
            } else {
                const passwordHash = await hashDemoPassword(currentPassword);
                const account = readDemoAccounts().find((item) => item.email === email.toLowerCase()
                    && item.passwordHash === passwordHash && item.status === "ACTIVE" && item.forcePasswordChange);
                if (!account) fail("The temporary password is invalid or has already been changed.");
                const value = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
                setPreviewOtp(value);
            }
            setStep("confirm");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The verification code could not be sent.");
        } finally { setBusy(false); }
    };
    const confirm = async (event: FormEvent) => {
        event.preventDefault(); setError("");
        if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
        const strongPassword = newPassword.length >= 12 && newPassword.length <= 64
            && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword)
            && /[^A-Za-z0-9]/.test(newPassword) && !/\s/.test(newPassword);
        if (!strongPassword) {
            setError("Password must be 12-64 characters with uppercase, lowercase, number and special character, without spaces.");
            return;
        }
        setBusy(true);
        try {
            if (isBackendConfigured) {
                await brainServeApi.confirmPasswordChange(otp, newPassword);
            } else {
                if (!previewOtp || otp !== previewOtp) fail("The preview verification code is incorrect.");
                const passwordHash = await hashDemoPassword(newPassword);
                writeDemoAccounts(readDemoAccounts().map((item) => item.email === email.toLowerCase()
                    ? { ...item, passwordHash, forcePasswordChange: false } : item));
            }
            onComplete();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The password could not be changed.");
        } finally { setBusy(false); }
    };
    return <main className="login-page"><div className="ambient ambient-one" /><section className="login-brand">
        <Logo productName="BrainServe Connect" /><div><span className="eyebrow">First-login protection</span>
        <h1>Secure your account.</h1><p>Replace the temporary password before opening the workplace.</p></div>
        <div className="login-trust"><ShieldCheck size={20} /><span><strong>Mandatory password change</strong>
      <small>OTP verified · Existing sessions revoked</small></span></div></section>
        <section className="login-card glass-panel"><div className="login-card-head"><span className="avatar large"><LockKeyhole size={22} /></span>
            <div><small>BRAINSERVE CONNECT</small><h2>Choose your password</h2><p>{email}</p></div></div>
            {step === "request" ? <form onSubmit={requestOtp}><label>Temporary password<input type="password"
                                                                                              value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} minLength={8}
                                                                                              autoComplete="current-password" required /></label><button className="button button-primary button-large full-button"
                                                                                                                                                         disabled={busy}>{busy ? "Sending…" : "Send verification code"}</button></form>
                : <form onSubmit={confirm}><label>Six-digit code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                                                                       value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} required /></label>
                    {!isBackendConfigured && previewOtp && <div className="success-banner" role="status">
                        <ShieldCheck size={17} /> Preview verification code: <strong>{previewOtp}</strong>
                    </div>}
                    <label>New password<input type="password" minLength={12} maxLength={64} value={newPassword}
                                              onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
                    <label>Confirm new password<input type="password" minLength={12} maxLength={64} value={confirmPassword}
                                                      onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
                    <button className="button button-primary button-large full-button" disabled={busy || otp.length !== 6}>
                        {busy ? "Changing…" : "Change password"}</button></form>}
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="text-button back-home" onClick={onLogout}>Sign out</button></section></main>;
}

function AccountRecovery({ type, onNavigate }: {
    type: "PASSWORD" | "EMAIL";
    onNavigate: (screen: Screen) => void;
}) {
    const [busy, setBusy] = useState("");
    const [requestMessage, setRequestMessage] = useState("");
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const isPassword = type === "PASSWORD";
    const title = isPassword ? "Reset your password" : "Recover your company email";

    const requestRecovery = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) return;

        const form = event.currentTarget;
        const data = new FormData(form);
        const identifier = String(data.get("identifier") ?? "").trim();
        const accountRole = String(data.get("role") ?? "").trim();

        setError("");
        setSuccess("");
        setRequestMessage("");

        if (!identifier) {
            setError("Enter your company email or exact full name.");
            return;
        }
        if (!accountRole) {
            setError("Select your account role.");
            return;
        }

        setBusy("request");
        try {
            if (isBackendConfigured) {
                const result = await brainServeApi.requestAccountRecovery(identifier, accountRole, type);
                setRequestMessage(result.message);
            } else {
                const accounts = readDemoAccounts();
                const normalizedIdentifier = identifier.toLowerCase();
                const target = identifier.includes("@")
                    ? accounts.find((account) => account.status === "ACTIVE"
                        && account.role !== "ROLE_SYSTEM_ADMIN"
                        && account.email.toLowerCase() === normalizedIdentifier)
                    : accounts.find((account) => account.status === "ACTIVE" && account.role === accountRole
                        && account.fullName.toLowerCase() === normalizedIdentifier);
                if (target) {
                    const requests = readDemoRecoveryRequests();
                    const alreadyPending = requests.some((item) => item.userId === target.id && item.type === type
                        && item.status === "PENDING");
                    if (!alreadyPending) {
                        writeDemoRecoveryRequests([...requests, {
                            id: newClientId(), userId: target.id, fullName: target.fullName, email: target.email,
                            role: target.role, type, status: "PENDING", requestedAt: new Date().toISOString(),
                            approvedAt: null, expiresAt: null, recoveryCode: null,
                        }]);
                    }
                }
                setRequestMessage("Preview request saved in this browser. Open System Admin in this same browser profile to review it. Connect Spring Boot for requests shared across devices.");
            }
            form.reset();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The recovery request could not be submitted.");
        } finally {
            setBusy("");
        }
    };

    const completeRecovery = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy("recover"); setError(""); setSuccess("");
        const form = event.currentTarget;
        const data = new FormData(form);
        const code = String(data.get("code")).trim().toUpperCase();
        const primary = String(data.get(isPassword ? "newPassword" : "newEmail")).trim();
        const confirmation = String(data.get(isPassword ? "confirmPassword" : "confirmEmail")).trim();
        if (primary !== confirmation) {
            setError(`${isPassword ? "Password" : "Email"} and confirmation do not match.`);
            setBusy(""); return;
        }
        if (isPassword) {
            const strong = primary.length >= 12 && primary.length <= 64 && /[A-Z]/.test(primary)
                && /[a-z]/.test(primary) && /\d/.test(primary) && /[^A-Za-z0-9]/.test(primary) && !/\s/.test(primary);
            if (!strong) {
                setError("Password must be 12-64 characters with uppercase, lowercase, number and special character, without spaces.");
                setBusy(""); return;
            }
        }
        try {
            if (isBackendConfigured) {
                if (isPassword) await brainServeApi.recoverPassword(code, primary, confirmation);
                else await brainServeApi.recoverEmail(code, primary, confirmation);
            } else {
                const requests = readDemoRecoveryRequests();
                const request = requests.find((item) => item.type === type && item.status === "APPROVED"
                    && item.recoveryCode === code && item.expiresAt && new Date(item.expiresAt).getTime() > Date.now());
                if (!request) fail("Recovery code is invalid, expired or already used.");
                const accounts = readDemoAccounts();
                if (isPassword) {
                    const nextHash = await hashDemoPassword(primary);
                    if (accounts.some((account) => account.id === request.userId && account.passwordHash === nextHash)) {
                        fail("New password must differ from the current password.");
                    }
                    writeDemoAccounts(accounts.map((account) => account.id === request.userId
                        ? { ...account, passwordHash: nextHash } : account));
                } else {
                    const normalized = primary.toLowerCase();
                    if (!normalized.endsWith("@brainserve.in")) fail("Use an official @brainserve.in email address.");
                    if (accounts.some((account) => account.id !== request.userId && account.email === normalized)) {
                        fail("A login account already uses this email.");
                    }
                    writeDemoAccounts(accounts.map((account) => account.id === request.userId
                        ? { ...account, email: normalized } : account));
                }
                writeDemoRecoveryRequests(requests.map((item) => item.id === request.id
                    ? { ...item, status: "USED", recoveryCode: null } : item));
            }
            form.reset(); setRequestMessage("");
            setSuccess(`${isPassword ? "Password" : "Company email"} updated successfully. The recovery code is now invalid.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The recovery could not be completed.");
        } finally { setBusy(""); }
    };

    return <main className="login-page"><div className="ambient ambient-one" /><section className="login-brand"><Logo /><div><span className="eyebrow">System Admin approved recovery</span><h1>Regain access.<br />Securely.</h1><p>BrainServe Connect never retrieves an existing password. A one-time code must first be approved by the System Admin and expires after 30 minutes.</p></div><div className="login-trust"><ShieldCheck size={20} /><span><strong>One-time recovery</strong><small>Hashed code · Full audit trail · Sessions revoked</small></span></div></section><section className="login-card recovery-card glass-panel"><div className="login-card-head"><span className="avatar large"><Fingerprint size={22} /></span><div><small>ACCOUNT RECOVERY</small><h2>{title}</h2><p>Request approval, then use the code supplied by your System Admin.</p></div></div><div className="recovery-type-switch"><button type="button" className={isPassword ? "active" : ""} onClick={() => onNavigate("forgot-password")}>Password</button><button type="button" className={!isPassword ? "active" : ""} onClick={() => onNavigate("forgot-email")}>Company email</button></div><form onSubmit={requestRecovery} className="recovery-request-form"><strong>1. Request System Admin approval</strong><label>{isPassword ? "Company email or exact full name" : "Exact full name (or remembered company email)"}<input name="identifier" minLength={2} maxLength={255} autoComplete="off" required /></label><label>Account role<select name="role" defaultValue="ROLE_CEO"><option value="ROLE_CEO">CEO</option><option value="ROLE_HR_ADMIN">HR Admin</option><option value="ROLE_MANAGER">Manager</option><option value="ROLE_TEAM_LEAD">Team Lead</option><option value="ROLE_EMPLOYEE">Employee</option><option value="ROLE_RECEPTIONIST">Receptionist</option><option value="ROLE_SECURITY">Security</option></select></label><button type="submit" className="button button-secondary full-button" disabled={Boolean(busy)}><UserCog size={16} />{busy === "request" ? "Sending request…" : "Request approval"}</button></form>{requestMessage && <div className="success-banner"><CheckCircle2 size={17} />{requestMessage}</div>}<div className="login-divider"><span>After approval</span></div><form onSubmit={completeRecovery}><strong>2. Use your one-time code</strong><label>System Admin recovery code<input name="code" placeholder="BSR-XXXX-XXXX-XXXX" pattern="BSR-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}" autoComplete="one-time-code" required /></label>{isPassword ? <><label>New password<div className="password-field"><input name="newPassword" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /><LockKeyhole size={17} /></div></label><label>Confirm new password<div className="password-field"><input name="confirmPassword" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /><LockKeyhole size={17} /></div></label><div className="password-policy">12-64 characters · uppercase · lowercase · number · special character · no spaces</div></> : <><label>New company email<input name="newEmail" type="email" placeholder="name@brainserve.in" autoComplete="email" required /></label><label>Confirm company email<input name="confirmEmail" type="email" placeholder="name@brainserve.in" autoComplete="email" required /></label></>}<button type="submit" className="button button-primary button-large full-button" disabled={Boolean(busy)}>{busy === "recover" ? "Updating…" : isPassword ? "Set new password" : "Set company email"}<ArrowRight size={18} /></button></form>{success && <div className="success-banner"><CheckCircle2 size={17} />{success}</div>}{error && <div className="login-error" role="alert">{error}</div>}<button type="button" className="text-button back-home" onClick={() => onNavigate("login")}><ArrowLeft size={16} /> Back to sign in</button></section></main>;
}

function AccountRegistration({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError(""); setSuccess("");
        const form = event.currentTarget;
        const data = new FormData(form);
        const fullName = String(data.get("fullName")).trim();
        const email = String(data.get("email")).trim().toLowerCase();
        const requestedRole = String(data.get("role"));
        const password = String(data.get("password"));
        if (password !== String(data.get("confirmPassword"))) {
            setError("Password and confirmation do not match."); setBusy(false); return;
        }
        const strongPassword = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
            && /[^A-Za-z0-9]/.test(password) && !/\s/.test(password);
        if (!strongPassword) {
            setError("Password must include uppercase, lowercase, number and special characters without spaces.");
            setBusy(false); return;
        }
        try {
            let result: { message: string };
            if (isBackendConfigured) {
                result = await brainServeApi.registerAccount(fullName, email, password, requestedRole);
            } else {
                if (requestedRole === "ROLE_CEO") {
                    fail("CEO is the single company authority and can be created only by System Admin.");
                }
                if (!email.endsWith("@brainserve.in")) fail("Use an official @brainserve.in email address.");
                const accounts = readDemoAccounts();
                if (accounts.some((item) => item.email === email) || email === SYSTEM_ADMIN_EMAIL) {
                    fail("An account already uses this email address.");
                }
                const lowerRole = ["ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(requestedRole);
                const pending: DemoProvisioningAccount = {
                    id: newClientId(), fullName, email, role: requestedRole,
                    status: lowerRole ? "PENDING_HR_APPROVAL" : "PENDING_APPROVAL",
                    createdByUserId: null, approvedByUserId: null, createdAt: new Date().toISOString(), approvedAt: null,
                    passwordHash: await hashDemoPassword(password),
                };
                writeDemoAccounts([...accounts, pending]);
                result = { message: ["ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(requestedRole)
                        ? "Registration submitted to the company CEO for approval"
                        : "Registration submitted for HR Admin approval" };
            }
            setSuccess(result.message + ". You can sign in after an authorized approver activates your account.");
            form.reset();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Registration could not be submitted."); }
        finally { setBusy(false); }
    };

    return <main className="login-page"><div className="ambient ambient-one" /><section className="login-brand"><Logo /><div><span className="eyebrow">Staff registration</span><h1>Request secure<br />workplace access.</h1><p>HR Admin and Manager requests go to the single company CEO. Employee, Receptionist and Security requests go to the assigned HR Admin.</p></div><div className="login-trust"><ShieldCheck size={20} /><span><strong>Role-based activation</strong><small>No pending account can sign in</small></span></div></section><section className="login-card glass-panel"><div className="login-card-head"><span className="avatar large">BS</span><div><small>NEW ACCOUNT REQUEST</small><h2>Register with BrainServe Connect</h2><p>Use your official company email.</p></div></div><div className="team-lead-registration-note"><BadgeCheck size={17} /><span><strong>CEO and Team Lead are governed roles</strong><small>System Admin creates the single CEO. Employees become Team Leads only through an audited role transition in their department. Receptionist and Security accounts are never eligible.</small></span></div><form onSubmit={submit}><label>Full name<input name="fullName" minLength={2} maxLength={170} required /></label><label>Company email<input name="email" type="email" placeholder="name@brainserve.in" required /></label><label>Requested role<select name="role"><option value="ROLE_MANAGER">Manager</option><option value="ROLE_HR_ADMIN">HR Admin</option><option value="ROLE_EMPLOYEE">Employee</option><option value="ROLE_RECEPTIONIST">Receptionist</option><option value="ROLE_SECURITY">Security</option></select></label><label>Password<div className="password-field"><input name="password" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /><LockKeyhole size={17} /></div></label><label>Confirm password<div className="password-field"><input name="confirmPassword" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /><LockKeyhole size={17} /></div></label><div className="password-policy">12-64 characters · uppercase · lowercase · number · special character · no spaces</div>{success && <div className="success-banner"><CheckCircle2 size={17} /> {success}</div>}{error && <div className="login-error" role="alert">{error}</div>}<button className="button button-primary button-large full-button" disabled={busy}>{busy ? "Submitting…" : "Submit account request"}<ArrowRight size={18} /></button></form><button type="button" className="text-button back-home" onClick={() => onNavigate("login")}><ArrowLeft size={16} /> Back to sign in</button></section></main>;
}

function mergeDemoStaffAccounts(current: StaffAccount[]) {
    const staffRoles = new Set(["ROLE_EMPLOYEE", "ROLE_TEAM_LEAD", "ROLE_HR_ADMIN", "ROLE_MANAGER",
        "ROLE_RECEPTIONIST", "ROLE_SECURITY"]);
    const persisted = readDemoAccounts().filter((account) => staffRoles.has(account.role));
    const persistedEmails = new Set(persisted.map((account) => account.email.toLowerCase()));
    return [
        ...current.filter((account) => !persistedEmails.has(account.email.toLowerCase())),
        ...persisted.map((account): StaffAccount => ({
            userId: account.id,
            employeeId: account.employeeId,
            fullName: account.fullName,
            email: account.email,
            roles: [account.role],
            enabled: account.status === "ACTIVE",
            forcePasswordChange: Boolean(account.forcePasswordChange),
            status: account.status,
            grantedPermissions: [],
            deniedPermissions: [],
            effectivePermissions: fallbackRoles.find((definition) =>
                definition.role === account.role)?.defaultPermissions ?? [],
        })),
    ];
}

function DashboardApp({ role, userEmail, onLogout }: { role: Role; userEmail: string; onLogout: () => void | Promise<void> }) {
    const [view, setView] = useState<View>("overview");
    const [appointments, setAppointments] = useState(() => isBackendConfigured
        ? [] : readPreviewWorkspaceAppointments());
    const [employees, setEmployees] = useState<Employee[]>(() => isBackendConfigured ? [] : readDemoEmployees());
    const [appointmentHosts, setAppointmentHosts] = useState<Employee[]>([]);
    const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() => isBackendConfigured
        ? [] : mergeDemoStaffAccounts(initialStaffAccounts));
    const [departments, setDepartments] = useState<Department[]>(() => isBackendConfigured
        ? [] : readDemoDepartments());
    const [departmentSummaries, setDepartmentSummaries] = useState<DepartmentEmployeeSummary[]>([]);
    const [teamLeadAssignments, setTeamLeadAssignments] = useState<TeamLeadAssignment[]>(() => isBackendConfigured
        ? [] : readDemoTeamLeadAssignments());
    const [departmentHrAssignments, setDepartmentHrAssignments] = useState<DepartmentHrAssignment[]>(() => isBackendConfigured
        ? [] : readDemoDepartmentHrAssignments());
    const [managerAssignments, setManagerAssignments] = useState<ManagerAssignment[]>(() => isBackendConfigured
        ? [] : readDemoManagerAssignments());
    const [metrics, setMetrics] = useState<DashboardMetrics>(() => isBackendConfigured ? {
        awaitingApproval: 0, activeVisits: 0, visitorsInside: 0, totalEmployees: 0, activeEmployees: 0,
    } : {
        awaitingApproval: initialAppointments.filter((item) => ["Pending", "Awaiting Security", "Awaiting Reception", "Awaiting HR", "Awaiting Team Lead", "Awaiting Manager", "Awaiting CEO"].includes(item.status)).length,
        activeVisits: initialAppointments.filter((item) => ["Approved", "Checked in"].includes(item.status)).length,
        visitorsInside: initialAppointments.filter((item) => item.status === "Checked in").length,
        totalEmployees: initialEmployees.length, activeEmployees: initialEmployees.filter((item) => item.status === "Active").length,
    });
    const [accessRecords, setAccessRecords] = useState<AccessRecord[]>(() =>
        isBackendConfigured ? [] : initialAccessRecords,
    );
    const [employeeModal, setEmployeeModal] = useState(false);
    const [terminationEmployee, setTerminationEmployee] = useState<Employee | null>(null);
    const [employeeDepartmentId, setEmployeeDepartmentId] = useState<string>();
    const [employeeAccountId, setEmployeeAccountId] = useState<string>();
    const [visitModal, setVisitModal] = useState(false);
    const [securityIntakeAppointment, setSecurityIntakeAppointment] = useState<Appointment | null>(null);
    const [privacyOpen, setPrivacyOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const [operationError, setOperationError] = useState("");
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [soundEnabled, setSoundEnabled] = useState(notificationSoundEnabled);
    const previousUnreadRef = useRef<number | null>(null);
    const appointmentSoundSnapshotRef = useRef<Map<string, AppointmentStatus> | null>(null);
    const [globalSearch, setGlobalSearch] = useState("");
    const [workspaceRevision, setWorkspaceRevision] = useState(0);
    const [approvedRecovery, setApprovedRecovery] = useState<AccountRecoveryRequest | null>(null);
    const [liveState, setLiveState] = useState<RealtimeConnectionState>(isBackendConfigured ? "connecting" : "offline");
    const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(() =>
        isBackendConfigured || typeof window === "undefined" ? null
            : window.localStorage.getItem(`brainserve.demo.profile.photo.${userEmail.toLowerCase()}`),
    );
    const [profileName, setProfileName] = useState(() => isBackendConfigured ? role : readDemoAccounts()
        .find((account) => account.email.toLowerCase() === userEmail.toLowerCase())?.fullName ?? role);
    const handleProfileUpdated = useCallback((profile: MyProfile) => {
        setProfilePhotoUrl(profile.photoUrl);
        setProfileName(profile.fullName);
    }, []);

    const refreshPreviewWorkspace = useCallback(() => {
        if (isBackendConfigured) return;
        setAppointments(readPreviewWorkspaceAppointments());
        setEmployees(readDemoEmployees());
        setDepartments(readDemoDepartments());
        setTeamLeadAssignments(readDemoTeamLeadAssignments());
        setDepartmentHrAssignments(readDemoDepartmentHrAssignments());
        setManagerAssignments(readDemoManagerAssignments());
        setLastLiveUpdate(new Date());
    }, []);

    useEffect(() => {
        if (isBackendConfigured) return;
        let endingSession = false;
        const enforceCurrentPreviewIdentity = () => {
            if (endingSession) return;
            const account = readDemoAccounts().find((item) =>
                item.email.toLowerCase() === userEmail.toLowerCase() && item.status === "ACTIVE");
            const currentRole = account ? roleFromAuthority(account.role) : null;
            if (currentRole === role) return;
            endingSession = true;
            writePreviewWorkspaceSession(null);
            void onLogout();
        };
        const accountStorageChanged = (event: StorageEvent) => {
            if (event.key === DEMO_ACCOUNTS_KEY) enforceCurrentPreviewIdentity();
        };
        window.addEventListener("storage", accountStorageChanged);
        window.addEventListener("brainserve:demo-accounts-updated", enforceCurrentPreviewIdentity);
        return () => {
            window.removeEventListener("storage", accountStorageChanged);
            window.removeEventListener("brainserve:demo-accounts-updated", enforceCurrentPreviewIdentity);
        };
    }, [onLogout, role, userEmail]);

    const requestWorkspaceRefresh = () => {
        refreshPreviewWorkspace();
        setWorkspaceRevision((revision) => revision + 1);
    };

    useEffect(() => onNotificationSoundChange(setSoundEnabled), []);

    useEffect(() => {
        if (isBackendConfigured) return;
        const synchronize = () => refreshPreviewWorkspace();
        const synchronizeStorage = (event: StorageEvent) => {
            if (event.key?.startsWith("brainserve.demo.")) synchronize();
        };
        window.addEventListener("storage", synchronizeStorage);
        window.addEventListener("brainserve:demo-appointments-updated", synchronize);
        window.addEventListener("focus", synchronize);
        return () => {
            window.removeEventListener("storage", synchronizeStorage);
            window.removeEventListener("brainserve:demo-appointments-updated", synchronize);
            window.removeEventListener("focus", synchronize);
        };
    }, [refreshPreviewWorkspace]);

    useEffect(() => {
        const snapshot = new Map(appointments.map((item) => [item.id, item.status]));
        const previous = appointmentSoundSnapshotRef.current;
        appointmentSoundSnapshotRef.current = snapshot;
        if (!previous) return;
        const changed = appointments.filter((item) => previous.has(item.id) && previous.get(item.id) !== item.status);
        const added = appointments.filter((item) => !previous.has(item.id));
        if (added.some((item) => item.status === "Awaiting Reception" || item.status === "Checked in")) {
            void playNotificationSound("visitor");
        } else if (changed.some((item) => item.status.startsWith("Awaiting") || item.status === "Pending")) {
            void playNotificationSound("approval");
        } else if (changed.length > 0 || added.length > 0) {
            void playNotificationSound("appointment");
        }
    }, [appointments]);

    useEffect(() => {
        if (!isBackendConfigured) {
            const timer = window.setTimeout(() => setProfilePhotoUrl(
                window.localStorage.getItem(`brainserve.demo.profile.photo.${userEmail.toLowerCase()}`)), 0);
            return () => window.clearTimeout(timer);
        }
        let active = true;
        brainServeApi.myProfile().then((profile) => {
            if (active) {
                setProfilePhotoUrl(profile.photoUrl);
                setProfileName(profile.fullName);
            }
        })
            .catch(() => { /* My Profile displays the recoverable error when opened. */ });
        return () => { active = false; };
    }, [userEmail, workspaceRevision]);

    useEffect(() => {
        if (!profileMenuOpen) return;
        const closeWhenOutside = (event: PointerEvent) => {
            if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setProfileMenuOpen(false);
        };
        document.addEventListener("pointerdown", closeWhenOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeWhenOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [profileMenuOpen]);

    const signOut = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try { await onLogout(); }
        finally { setLoggingOut(false); setProfileMenuOpen(false); }
    };

    useEffect(() => {
        if (!isBackendConfigured) return;
        let refreshTimer: number | null = null;
        const queueSafeRefresh = () => {
            if (refreshTimer) window.clearTimeout(refreshTimer);
            const applyWhenIdle = () => {
                const active = document.activeElement;
                const editing = active instanceof HTMLElement
                    && (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
                        || Boolean(active.closest("[role='dialog']")));
                if (editing) {
                    refreshTimer = window.setTimeout(applyWhenIdle, 1_500);
                    return;
                }
                setWorkspaceRevision((revision) => revision + 1);
            };
            refreshTimer = window.setTimeout(applyWhenIdle, 500);
        };
        const unsubscribe = subscribeToWorkspaceUpdates(
            () => {
                setLastLiveUpdate(new Date());
                queueSafeRefresh();
            },
            setLiveState,
        );
        return () => {
            unsubscribe();
            if (refreshTimer) window.clearTimeout(refreshTimer);
        };
    }, [role, userEmail]);

    useEffect(() => {
        if (!isBackendConfigured) return;
        let active = true;
        const loadWorkspace = async () => {
            const errors: string[] = [];
            let hostNames = new Map<string, string>();
            let hostCategories = new Map<string, PublicHost["category"]>();
            if (role === "System Admin") {
                try {
                    const [departmentList, managerAssignmentList] = await Promise.all([
                        brainServeApi.departments(),
                        brainServeApi.managerAssignments(),
                    ]);
                    if (!active) return;
                    setDepartments(departmentList);
                    setManagerAssignments(managerAssignmentList);
                } catch (reason) {
                    errors.push(reason instanceof ApiError ? reason.message
                        : "The System Admin department directory could not be loaded from the database.");
                }
            } else if (role === "Team Lead") {
                try {
                    const workspace = await brainServeApi.myTeamLeadWorkspace().catch(async () => {
                        const [assignment, employees, visibleDepartments] = await Promise.all([
                            brainServeApi.myTeamLeadAssignment(),
                            brainServeApi.myTeam(),
                            brainServeApi.visibleDepartments(),
                        ]);
                        const department = visibleDepartments.find((item) => item.id === assignment.departmentId);
                        if (!department) fail("Your assigned department is unavailable.");
                        return { assignment, department, employees };
                    });
                    if (!active) return;
                    const assignment = workspace.assignment;
                    const department = { ...workspace.department, active: true, version: 0 };
                    const nextEmployees: Employee[] = workspace.employees.content.map((item) => ({
                        id: item.employeeNumber, uuid: item.id, departmentId: item.departmentId,
                        name: item.displayName, initials: visitorInitials(item.displayName),
                        role: item.designation, department: department.name,
                        email: item.officialEmail, lifecycleProtected: item.lifecycleProtected,
                        status: employeeStatusLabel(item.status),
                    }));
                    setEmployees(nextEmployees); setDepartments([department]);
                    setDepartmentSummaries([{ departmentId: assignment.departmentId,
                        totalEmployees: workspace.employees.totalElements ?? nextEmployees.length,
                        activeEmployees: nextEmployees.filter((item) => item.status === "Active").length,
                        onLeaveEmployees: nextEmployees.filter((item) => item.status === "On leave").length,
                        onboardingEmployees: nextEmployees.filter((item) => item.status === "Onboarding").length }]);
                    setTeamLeadAssignments([{ id: assignment.assignmentId, departmentId: assignment.departmentId,
                        teamLeadUserId: assignment.teamLeadUserId, teamLeadEmployeeId: assignment.teamLeadEmployeeId,
                        active: true, assignedByUserId: "", assignedAt: "", endedByUserId: null, endedAt: null }]);
                    hostNames = new Map(nextEmployees.map((item) => [item.uuid ?? item.id, item.name]));
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Your Team Lead workspace could not be loaded."); }
            } else if (!["Security", "System Admin"].includes(role)) {
                try {
                    const [employeePage, departmentList, summaryList, assignmentList, hrAssignmentList, managerAssignmentList] = await Promise.all([
                        brainServeApi.employees(), ["HR Admin", "Manager"].includes(role)
                            ? brainServeApi.visibleDepartments() : brainServeApi.departments(),
                        ["CEO", "HR Admin", "Manager"].includes(role) ? brainServeApi.departmentEmployeeSummary() : Promise.resolve([]),
                        ["CEO", "HR Admin"].includes(role) ? brainServeApi.teamLeadAssignments() : Promise.resolve([]),
                        ["CEO", "HR Admin"].includes(role) ? brainServeApi.departmentHrAssignments() : Promise.resolve([]),
                        ["CEO", "System Admin"].includes(role)
                            ? brainServeApi.managerAssignments()
                            : role === "Manager"
                                ? brainServeApi.myManagerAssignment().then((assignment) => [{
                                    id: assignment.assignmentId,
                                    departmentId: assignment.departmentId,
                                    managerUserId: assignment.managerUserId,
                                    managerEmployeeId: assignment.managerEmployeeId,
                                    active: true,
                                    assignedByUserId: "",
                                    assignedAt: "",
                                    endedByUserId: null,
                                    endedAt: null,
                                }])
                                : Promise.resolve([]),
                    ]);
                    if (!active) return;
                    setDepartments(departmentList);
                    setDepartmentSummaries(summaryList);
                    setTeamLeadAssignments(assignmentList);
                    setDepartmentHrAssignments(hrAssignmentList);
                    setManagerAssignments(managerAssignmentList);
                    const departmentNames = new Map(departmentList.map((item) => [item.id, item.name]));
                    const nextEmployees: Employee[] = employeePage.content.map((item) => ({
                        id: item.employeeNumber, uuid: item.id, departmentId: item.departmentId,
                        name: item.displayName, initials: visitorInitials(item.displayName),
                        role: item.designation, department: departmentNames.get(item.departmentId) ?? "Unassigned", email: item.officialEmail,
                        lifecycleProtected: item.lifecycleProtected, status: employeeStatusLabel(item.status),
                    }));
                    setEmployees(nextEmployees);
                    hostNames = new Map(nextEmployees.map((item) => [item.uuid ?? item.id, item.name]));
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Employee data could not be loaded."); }
            }
            if (role === "Security" || role === "Reception") {
                try {
                    const [publicHosts, publicDepartments] = await Promise.all([
                        brainServeApi.publicHosts(),
                        role === "Security" ? brainServeApi.publicDepartments() : Promise.resolve([]),
                    ]);
                    if (!active) return;
                    const securityHosts: Employee[] = publicHosts.map((host) => ({
                        id: host.id, uuid: host.id, departmentId: host.departmentId,
                        name: host.displayName, initials: visitorInitials(host.displayName),
                        role: host.designation, department: host.departmentName, hostCategory: host.category,
                        email: "", status: "Active",
                    }));
                    setAppointmentHosts(securityHosts);
                    if (role === "Security") {
                        setEmployees(securityHosts);
                    }
                    // Reception already loads the authoritative department directory above. Do not replace it
                    // with the much smaller set of departments that currently have an HR host assignment.
                    // Security cannot read the private employee directory. Its form uses the bounded public
                    // department directory and only retrieves employee names after a department is selected.
                    if (role === "Security") {
                        setDepartments(publicDepartments.sort((left, right) => left.name.localeCompare(right.name)));
                    }
                    hostNames = new Map(securityHosts.map((item) => [item.uuid ?? item.id, item.name]));
                    hostCategories = new Map(publicHosts.map((item) => [item.id, item.category]));
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Appointment hosts could not be loaded."); }
            }
            if (role !== "System Admin") {
                try {
                    const appointmentPage = await brainServeApi.appointments();
                    if (!active) return;
                    setAppointments(appointmentPage.content.map((item) => {
                        return {
                            id: item.id, initials: visitorInitials(item.visitorName), visitor: item.visitorName,
                            visitorEmail: item.visitorEmail, visitorPhone: item.visitorPhone,
                            company: item.visitorCompany ?? "Independent",
                            host: hostNames.get(item.requestedEmployeeId ?? item.hostEmployeeId) ?? "BrainServe host",
                            purpose: item.purpose, time: formatOfficeTime(item.slotStart),
                            date: formatOfficeDate(item.slotStart, { year: undefined }),
                            status: appointmentStatusFromApi(item.status), type: visitTypeLabel(item.type), referenceNumber: item.referenceNumber,
                            hostEmployeeId: item.hostEmployeeId, hostCategory: hostCategories.get(item.hostEmployeeId),
                            routingDepartmentId: item.routingDepartmentId,
                            requestedEmployeeId: item.requestedEmployeeId, slotStart: item.slotStart,
                            securityIntakeActorId: item.securityIntakeActorId, securityIntakeAt: item.securityIntakeAt,
                            arrivalVisitorName: item.arrivalVisitorName, arrivalPurpose: item.arrivalPurpose,
                            identityDocumentType: item.identityDocumentType, identityDocumentLastFour: item.identityDocumentLastFour,
                            securityNotes: item.securityNotes, receptionVerificationActorId: item.receptionVerificationActorId,
                            receptionVerifiedAt: item.receptionVerifiedAt,
                            receptionVerificationRemarks: item.receptionVerificationRemarks,
                            hrApprovalActorId: item.hrApprovalActorId, hrDecisionAt: item.hrDecisionAt,
                            hrDecisionRemarks: item.hrDecisionRemarks,
                            teamLeadApprovalActorId: item.teamLeadApprovalActorId,
                            teamLeadDecisionAt: item.teamLeadDecisionAt,
                            teamLeadDecisionRemarks: item.teamLeadDecisionRemarks,
                            managerApprovalActorId: item.managerApprovalActorId,
                            managerDecisionAt: item.managerDecisionAt,
                            managerDecisionRemarks: item.managerDecisionRemarks,
                            ceoApprovalActorId: item.ceoApprovalActorId,
                            ceoDecisionAt: item.ceoDecisionAt,
                            ceoDecisionRemarks: item.ceoDecisionRemarks,
                            receptionForwardActorId: item.receptionForwardActorId,
                            receptionForwardedAt: item.receptionForwardedAt,
                            receptionForwardRemarks: item.receptionForwardRemarks,
                            createdAt: item.createdAt, assignedToCurrentActor: item.assignedToCurrentActor,
                        };
                    }));
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Appointment data could not be loaded."); }
            }
            if (role !== "System Admin") {
                try {
                    const summary = await brainServeApi.dashboard();
                    if (active) setMetrics(summary);
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Dashboard metrics could not be loaded."); }
            }
            if (["Reception", "Security"].includes(role)) {
                try {
                    const records = await brainServeApi.visitorsInside();
                    if (active) setAccessRecords(records);
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Visitor occupancy could not be loaded."); }
            }
            if (role === "HR Admin") {
                try {
                    const accounts = await brainServeApi.staffAccounts();
                    if (active) setStaffAccounts(accounts);
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Staff accounts could not be loaded."); }
            } else if (role === "CEO") {
                try {
                    const candidates = await brainServeApi.departmentHrCandidates();
                    if (active) setStaffAccounts(candidates.map((candidate) => ({ ...candidate, roles: ["ROLE_HR_ADMIN"],
                        enabled: true, forcePasswordChange: false, status: "ACTIVE", grantedPermissions: [], deniedPermissions: [],
                        effectivePermissions: [] })));
                } catch (reason) { errors.push(reason instanceof ApiError ? reason.message : "Department HR candidates could not be loaded."); }
            }
            if (active) {
                setOperationError(errors.join(" "));
                setLastLiveUpdate(new Date());
            }
        };
        void loadWorkspace();
        return () => { active = false; };
    }, [role, workspaceRevision]);

    useEffect(() => {
        if (!isBackendConfigured || role === "System Admin") return;
        let active = true;
        const refreshAppointments = async () => {
            try {
                const appointmentPage = await brainServeApi.appointments();
                if (!active) return;
                setAppointments((current) => appointmentPage.content.map((item) => {
                    const previous = current.find((value) => value.id === item.id);
                    const host = employees.find((employee) => (employee.uuid ?? employee.id)
                        === (item.requestedEmployeeId ?? item.hostEmployeeId));
                    return {
                        id: item.id, initials: visitorInitials(item.visitorName), visitor: item.visitorName,
                        visitorEmail: item.visitorEmail, visitorPhone: item.visitorPhone,
                        company: item.visitorCompany ?? "Independent", host: host?.name ?? previous?.host ?? "BrainServe host",
                        purpose: item.purpose, time: formatOfficeTime(item.slotStart),
                        date: formatOfficeDate(item.slotStart, { year: undefined }),
                        status: appointmentStatusFromApi(item.status), type: visitTypeLabel(item.type),
                        referenceNumber: item.referenceNumber, hostEmployeeId: item.hostEmployeeId,
                        hostCategory: host?.hostCategory ?? previous?.hostCategory,
                        routingDepartmentId: item.routingDepartmentId, requestedEmployeeId: item.requestedEmployeeId,
                        slotStart: item.slotStart,
                        securityIntakeActorId: item.securityIntakeActorId, securityIntakeAt: item.securityIntakeAt,
                        arrivalVisitorName: item.arrivalVisitorName, arrivalPurpose: item.arrivalPurpose,
                        identityDocumentType: item.identityDocumentType,
                        identityDocumentLastFour: item.identityDocumentLastFour, securityNotes: item.securityNotes,
                        receptionVerificationActorId: item.receptionVerificationActorId,
                        receptionVerifiedAt: item.receptionVerifiedAt,
                        receptionVerificationRemarks: item.receptionVerificationRemarks,
                        hrApprovalActorId: item.hrApprovalActorId, hrDecisionAt: item.hrDecisionAt,
                        hrDecisionRemarks: item.hrDecisionRemarks,
                        teamLeadApprovalActorId: item.teamLeadApprovalActorId,
                        teamLeadDecisionAt: item.teamLeadDecisionAt,
                        teamLeadDecisionRemarks: item.teamLeadDecisionRemarks,
                        managerApprovalActorId: item.managerApprovalActorId,
                        managerDecisionAt: item.managerDecisionAt,
                        managerDecisionRemarks: item.managerDecisionRemarks,
                        ceoApprovalActorId: item.ceoApprovalActorId,
                        ceoDecisionAt: item.ceoDecisionAt,
                        ceoDecisionRemarks: item.ceoDecisionRemarks,
                        receptionForwardActorId: item.receptionForwardActorId,
                        receptionForwardedAt: item.receptionForwardedAt,
                        receptionForwardRemarks: item.receptionForwardRemarks,
                        createdAt: item.createdAt, assignedToCurrentActor: item.assignedToCurrentActor,
                    };
                }));
            } catch { /* The initial loader displays actionable API errors. */ }
        };
        const timer = window.setInterval(() => void refreshAppointments(), 60000);
        return () => { active = false; window.clearInterval(timer); };
    }, [employees, role]);

    useEffect(() => {
        if (!rolePermissions[role].includes("notifications")) return;
        let active = true;
        const refresh = async () => {
            try {
                const unread = isBackendConfigured
                    ? (await brainServeApi.internalNotificationUnreadCount()).unreadCount
                    : readDemoInternalNotifications().filter((item) => item.recipientEmail === userEmail && !item.readAt).length;
                if (active) {
                    const previousUnread = previousUnreadRef.current;
                    previousUnreadRef.current = unread;
                    setUnreadNotifications(unread);
                    if (previousUnread !== null && unread > previousUnread) void playNotificationSound("message");
                }
            } catch { /* The inbox itself presents recoverable service errors. */ }
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 15000);
        return () => { active = false; window.clearInterval(timer); };
    }, [role, userEmail]);

    const permittedNav = navItems.filter((item) => rolePermissions[role].includes(item.id));
    const currentEmployee = employees.find((employee) => employee.email.toLowerCase() === userEmail.toLowerCase());
    const unassignedEmployeeAccounts = staffAccounts.filter((account) => account.enabled && account.status === "ACTIVE"
        && account.roles.length === 1 && account.roles[0] === "ROLE_EMPLOYEE" && !account.employeeId
        && !employees.some((employee) => employee.email.toLowerCase() === account.email.toLowerCase()));
    const selectedEmployeeAccount = staffAccounts.find((account) => account.userId === employeeAccountId);
    const pendingAppointmentCount = appointments.filter((item) => needsAppointmentAction(role, item)).length;
    const globalSearchResults = useMemo(() => {
        const query = globalSearch.trim().toLowerCase();
        if (query.length < 2) return [];
        const appointmentResults = appointments.filter((item) =>
            `${item.visitor} ${item.company} ${item.host} ${item.purpose} ${item.referenceNumber ?? ""}`.toLowerCase().includes(query))
            .map((item) => ({ id: `appointment-${item.id}`, view: (["Employee", "Team Lead"] as Role[]).includes(role) ? "notifications" as View : "appointments" as View,
                title: item.visitor, detail: `${item.type} · ${item.referenceNumber ?? item.host}` }));
        const employeeResults = employees.filter((item) =>
            `${item.name} ${item.email} ${item.id} ${item.role} ${item.department}`.toLowerCase().includes(query))
            .map((item) => ({ id: `employee-${item.id}`, view: "employees" as View,
                title: item.name, detail: `${item.role} · ${item.department}` }));
        return [...appointmentResults, ...employeeResults].slice(0, 8);
    }, [appointments, employees, globalSearch, role]);
    const updateAppointment = (id: string, status: AppointmentStatus, patch: Partial<Pick<Appointment,
        "managerApprovalActorId" | "managerDecisionAt" | "managerDecisionRemarks"
        | "ceoApprovalActorId" | "ceoDecisionAt" | "ceoDecisionRemarks">> = {}) =>
        setAppointments((items) => items.map((item) => {
            if (item.id !== id && item.referenceNumber !== id) return item;
            updateDemoAppointment(item.referenceNumber, {
                "Awaiting Security": "PENDING_SECURITY_INTAKE", "Awaiting Reception": "PENDING_RECEPTION_VERIFICATION",
                "Awaiting HR": "PENDING_HR_APPROVAL", "Awaiting Team Lead": "PENDING_TEAM_LEAD_APPROVAL",
                "Awaiting Manager": "PENDING_MANAGER_APPROVAL",
                "Awaiting CEO": "PENDING_CEO_APPROVAL", Approved: "APPROVED",
                Rejected: "REJECTED", "Checked in": "CHECKED_IN", Completed: "COMPLETED",
                Pending: "PENDING_VERIFICATION", Cancelled: "CANCELLED", Expired: "EXPIRED",
            }[status] ?? status, patch);
            return { ...item, ...patch, status };
        }));

    const decideAppointment = async (id: string, decision: "approve" | "reject") => {
        const appointment = appointments.find((item) => item.id === id);
        if (!appointment) return;
        const stage = appointment.status === "Awaiting HR" ? "hr" : appointment.status === "Awaiting Team Lead" ? "team-lead"
            : appointment.status === "Awaiting Manager" ? "manager"
                : appointment.status === "Awaiting CEO" ? "ceo"
                    : appointment.status === "Pending" ? "host" : null;
        if (!stage) return;
        const remarks = decision === "reject"
            ? window.prompt("Enter the rejection reason", "Visitor request does not meet the approval requirements")
            : "";
        if (decision === "reject" && (remarks === null || remarks.trim().length < 5)) return;
        setOperationError("");
        try {
            let backendDecision: ManagedAppointment | null = null;
            if (isBackendConfigured) {
                if (stage === "host") backendDecision = await brainServeApi.decideHostVisit(id, decision, remarks?.trim() ?? "");
                else backendDecision = await brainServeApi.decideVisit(id, stage, decision, remarks?.trim() ?? "");
            }
            const nextStatus: AppointmentStatus = backendDecision
                ? appointmentStatusFromApi(backendDecision.status)
                : decision === "reject" ? "Rejected"
                    : stage === "manager" && isCeoApprovalRoute(appointment) ? "Awaiting CEO"
                        : stage === "hr" && isCeoApprovalRoute(appointment) ? "Awaiting Manager"
                            : stage === "hr" && appointment.type === "Employee visit" ? "Awaiting Team Lead" : "Approved";
            const decidedAt = new Date().toISOString();
            const auditPatch = stage === "manager"
                ? { managerApprovalActorId: backendDecision?.managerApprovalActorId ?? userEmail,
                    managerDecisionAt: backendDecision?.managerDecisionAt ?? decidedAt,
                    managerDecisionRemarks: backendDecision?.managerDecisionRemarks ?? remarks?.trim() ?? null }
                : stage === "ceo"
                    ? { ceoApprovalActorId: backendDecision?.ceoApprovalActorId ?? userEmail,
                        ceoDecisionAt: backendDecision?.ceoDecisionAt ?? decidedAt,
                        ceoDecisionRemarks: backendDecision?.ceoDecisionRemarks ?? remarks?.trim() ?? null }
                    : {};
            updateAppointment(id, nextStatus, auditPatch);
            if (!isBackendConfigured && isCeoApprovalRoute(appointment)
                && (stage === "manager" || stage === "ceo")) {
                const accounts = readDemoAccounts();
                const sender = accounts.find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                const managerAssignment = readDemoManagerAssignments().find((item) =>
                    item.active && item.departmentId === appointment.routingDepartmentId);
                const recipient = stage === "manager"
                    ? accounts.find((item) => item.role === "ROLE_CEO" && item.status === "ACTIVE")
                    : accounts.find((item) => item.id === managerAssignment?.managerUserId && item.status === "ACTIVE");
                if (recipient) {
                    const message = stage === "manager"
                        ? `Manager approved CEO visit ${appointment.referenceNumber ?? appointment.id} for ${appointment.visitor}. CEO final approval is required.`
                        : `CEO ${decision === "approve" ? "approved" : "rejected"} visit ${appointment.referenceNumber ?? appointment.id} for ${appointment.visitor}.${remarks?.trim() ? ` Remarks: ${remarks.trim()}` : ""}`;
                    writeDemoInternalNotifications([{ id: newClientId(), senderUserId: sender?.id ?? userEmail,
                        recipientUserId: recipient.id, senderName: sender?.fullName ?? demoSenderName(role, userEmail),
                        recipientName: recipient.fullName, message, deliveryStatus: "DELIVERED", sentAt: decidedAt,
                        deliveredAt: decidedAt, readAt: null, senderEmail: sender?.email ?? userEmail,
                        recipientEmail: recipient.email }, ...readDemoInternalNotifications()]);
                }
            }
            if (!isBackendConfigured && appointment.type === "Employee visit"
                && ((stage === "hr" && decision === "approve") || stage === "team-lead")) {
                const host = employees.find((employee) => (employee.uuid ?? employee.id) === appointment.hostEmployeeId
                    || employee.name === appointment.host);
                if (host) {
                    const account = readDemoAccounts().find((item) => item.email === host.email && item.status === "ACTIVE");
                    const now = new Date().toISOString();
                    const message = stage === "hr"
                        ? `HR forwarded visitor ${appointment.arrivalVisitorName ?? appointment.visitor} (${appointment.referenceNumber ?? appointment.id}) to you for ${appointment.arrivalPurpose ?? appointment.purpose}. Team Lead approval is pending.`
                        : `Team Lead ${decision === "approve" ? "approved" : "rejected"} visitor ${appointment.arrivalVisitorName ?? appointment.visitor} (${appointment.referenceNumber ?? appointment.id}) for ${appointment.arrivalPurpose ?? appointment.purpose}.`;
                    writeDemoInternalNotifications([{ id: newClientId(), senderUserId: userEmail,
                        recipientUserId: account?.id ?? `employee-${host.id}`, senderName: demoSenderName(role, userEmail),
                        recipientName: host.name, message, deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now,
                        readAt: null, senderEmail: userEmail, recipientEmail: host.email }, ...readDemoInternalNotifications()]);
                }
            }
            if (!["Awaiting CEO", "Awaiting Manager", "Awaiting Team Lead"].includes(nextStatus)) {
                setMetrics((current) => ({ ...current,
                    awaitingApproval: Math.max(0, current.awaitingApproval - 1),
                    activeVisits: decision === "approve" ? current.activeVisits + 1 : current.activeVisits,
                }));
            }
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "The approval action failed.");
        }
    };

    const recordSecurityIntake = async (id: string, input: SecurityIntakeInput) => {
        const appointment = appointments.find((item) => item.id === id);
        if (!appointment) return;
        setOperationError("");
        try {
            if (isBackendConfigured) await brainServeApi.recordSecurityIntake(id, input);
            const now = new Date().toISOString();
            setAppointments((items) => items.map((item) => item.id === id ? {
                ...item, status: "Awaiting Reception", arrivalVisitorName: input.visitorName,
                arrivalPurpose: input.purpose, identityDocumentType: input.identityDocumentType,
                identityDocumentLastFour: input.identityDocumentLastFour, securityNotes: input.notes,
                securityIntakeAt: now,
            } : item));
            updateDemoAppointment(appointment.referenceNumber, "PENDING_RECEPTION_VERIFICATION", {
                visitorName: input.visitorName, purpose: input.purpose,
                identityDocumentType: input.identityDocumentType,
                identityDocumentLastFour: input.identityDocumentLastFour, notes: input.notes, securityIntakeAt: now,
            });
            if (!isBackendConfigured) {
                const notification: DemoInternalNotification = {
                    id: newClientId(), senderUserId: userEmail, recipientUserId: "reception-preview",
                    senderName: "Security Desk", recipientName: "Reception Desk",
                    message: `${input.visitorName} arrived for ${appointment.host}. ${input.purpose} · ${appointment.referenceNumber ?? appointment.id}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: userEmail, recipientEmail: "reception@brainserve.in",
                };
                writeDemoInternalNotifications([notification, ...readDemoInternalNotifications()]);
            }
            setSecurityIntakeAppointment(null);
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "Security intake could not be recorded.");
            rethrow(reason);
        }
    };

    const decideReceptionVisit = async (id: string, decision: "verify" | "reject") => {
        const appointment = appointments.find((item) => item.id === id);
        if (!appointment) return;
        const defaultRemarks = decision === "verify" ? "Arrival, contact details, purpose and identity verified by Reception"
            : "Reception rejected the visitor after reviewing arrival details";
        const remarks = window.prompt(decision === "verify" ? "Enter Reception verification details" : "Enter rejection reason", defaultRemarks);
        if (remarks === null || remarks.trim().length < 2) return;
        setOperationError("");
        try {
            const backendDecision = isBackendConfigured
                ? await brainServeApi.decideReceptionVisit(id, decision, remarks.trim()) : null;
            const managerRoute = isCeoApprovalRoute(appointment);
            const nextStatus: AppointmentStatus = backendDecision
                ? appointmentStatusFromApi(backendDecision.status)
                : decision === "reject" ? "Rejected" : managerRoute ? "Awaiting Manager" : "Awaiting HR";
            setAppointments((items) => items.map((item) => item.id === id ? {
                ...item, status: nextStatus, receptionVerifiedAt: new Date().toISOString(),
                receptionVerificationRemarks: remarks.trim(),
            } : item));
            const verifiedAt = new Date().toISOString();
            updateDemoAppointment(appointment.referenceNumber, backendDecision?.status
                ?? (decision === "reject" ? "REJECTED"
                    : managerRoute ? "PENDING_MANAGER_APPROVAL" : "PENDING_HR_APPROVAL"),
                { receptionVerifiedAt: verifiedAt, receptionVerificationRemarks: remarks.trim() });
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "Reception verification failed.");
        }
    };

    const forwardReceptionVisit = async (id: string) => {
        const appointment = appointments.find((item) => item.id === id);
        if (!appointment) return;
        const destination = isCeoApprovalRoute(appointment) ? "CEO cabin" : "HR cabin";
        const remarks = window.prompt(`Message for the ${destination}`, `Visitor is being sent to the ${destination}`);
        if (remarks === null || remarks.trim().length < 2) return;
        setOperationError("");
        try {
            const now = new Date().toISOString();
            if (isBackendConfigured) await brainServeApi.forwardReceptionVisit(id, remarks.trim());
            setAppointments((items) => items.map((item) => item.id === id ? {
                ...item, receptionForwardedAt: now, receptionForwardRemarks: remarks.trim(),
            } : item));
            updateDemoAppointment(appointment.referenceNumber, "APPROVED", { receptionForwardedAt: now });
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "The visitor could not be forwarded.");
        }
    };

    const addEmployee = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name")).trim().replace(/\s+/g, " ");
        const officialEmail = String(data.get("email")).trim().toLowerCase();
        if (!isBackendConfigured && !officialEmail.endsWith("@brainserve.in")) {
            setOperationError("Use an approved @brainserve.in Employee login before assigning a department."); return;
        }
        if (name.length < 2) { setOperationError("Enter the employee's full name."); return; }
        const nameParts = name.split(" ");
        const firstName = nameParts.shift() ?? "";
        const lastName = nameParts.join(" ");
        const departmentId = String(data.get("departmentId"));
        const department = departments.find((item) => item.id === departmentId);
        setOperationError("");
        try {
            let created: Employee;
            if (isBackendConfigured) {
                const response = await brainServeApi.createEmployee({
                    firstName, lastName, officialEmail, phoneNumber: String(data.get("phone")) || null,
                    departmentId, designation: String(data.get("designation")),
                    joiningDate: String(data.get("joiningDate")),
                });
                created = {
                    id: response.employee.employeeNumber, uuid: response.employee.id, departmentId,
                    name: response.employee.displayName,
                    initials: visitorInitials(response.employee.displayName), role: response.employee.designation,
                    department: department?.name ?? "Unassigned", email: response.employee.officialEmail, status: "Onboarding",
                };
            } else {
                created = { id: `BSPL-${department?.code ?? "EMP"}-${String(employees.length + 70).padStart(4, "0")}`, departmentId,
                    name, initials: visitorInitials(name), role: String(data.get("designation")),
                    department: department?.name ?? "Unassigned", email: officialEmail, status: "Onboarding" };
            }
            setEmployees((items) => {
                const updated = [...items, created];
                if (!isBackendConfigured) writeDemoEmployees(updated);
                return updated;
            });
            const linkedEmployeeId = created.uuid ?? created.id;
            setStaffAccounts((items) => items.map((account) => account.email.toLowerCase() === created.email.toLowerCase()
                ? { ...account, employeeId: linkedEmployeeId }
                : account));
            if (!isBackendConfigured) writeDemoAccounts(readDemoAccounts().map((account) =>
                account.email.toLowerCase() === created.email.toLowerCase() ? { ...account, employeeId: linkedEmployeeId } : account));
            setDepartmentSummaries((items) => {
                const existing = items.find((item) => item.departmentId === departmentId);
                if (!existing) return [...items, { departmentId, totalEmployees: 1, activeEmployees: 0, onLeaveEmployees: 0, onboardingEmployees: 1 }];
                return items.map((item) => item.departmentId === departmentId
                    ? { ...item, totalEmployees: item.totalEmployees + 1, onboardingEmployees: item.onboardingEmployees + 1 }
                    : item);
            });
            if (isBackendConfigured) {
                try { setStaffAccounts(await brainServeApi.staffAccounts()); }
                catch { setOperationError("Employee created, but the pending login list could not be refreshed. Reload the workspace before approval."); }
            }
            setMetrics((current) => ({ ...current, totalEmployees: current.totalEmployees + 1 }));
            setEmployeeModal(false);
            setEmployeeDepartmentId(undefined);
            setEmployeeAccountId(undefined);
        } catch (reason) { setOperationError(reason instanceof ApiError ? reason.message : "The employee could not be created."); }
    };

    const createDepartment = async (code: string, name: string) => {
        const created = isBackendConfigured
            ? await brainServeApi.createDepartment(code, name)
            : { id: newClientId(), code: code.toUpperCase(), name, active: true, version: 0 };
        setDepartments((items) => {
            const updated = [...items, created];
            if (!isBackendConfigured) writeDemoDepartments(updated);
            return updated;
        });
        return created;
    };

    const joinExecutiveDepartment = async (payload: { departmentId: string; phoneNumber: string;
        designation: string; joiningDate: string }) => {
        setOperationError("");
        try {
            if (isBackendConfigured) {
                const profile = await brainServeApi.upsertExecutiveProfile(payload);
                const department = departments.find((item) => item.id === profile.departmentId);
                const mapped: Employee = { id: profile.employeeNumber, uuid: profile.id, departmentId: profile.departmentId,
                    name: profile.displayName, initials: visitorInitials(profile.displayName), role: profile.designation,
                    department: department?.name ?? "Executive department", email: profile.officialEmail,
                    status: employeeStatusLabel(profile.status) };
                setEmployees((items) => [mapped, ...items.filter((item) => (item.uuid ?? item.id) !== profile.id
                    && item.email.toLowerCase() !== profile.officialEmail.toLowerCase())]);
            } else {
                const department = departments.find((item) => item.id === payload.departmentId);
                const existing = employees.find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                const name = existing?.name ?? demoSenderName("CEO", userEmail);
                const mapped: Employee = { id: existing?.id ?? `BSPL-${department?.code ?? "EXEC"}-${String(Date.now()).slice(-4)}`,
                    uuid: existing?.uuid ?? newClientId(), departmentId: payload.departmentId,
                    name, initials: visitorInitials(name), role: payload.designation,
                    department: department?.name ?? "Executive department", email: userEmail, status: "Active" };
                setEmployees((items) => {
                    const updated = [mapped, ...items.filter((item) => item.email.toLowerCase() !== userEmail.toLowerCase())];
                    writeDemoEmployees(updated); return updated;
                });
                writeDemoAccounts(readDemoAccounts().map((account) => account.email.toLowerCase() === userEmail.toLowerCase()
                    ? { ...account, employeeId: mapped.uuid } : account));
            }
            return true;
        } catch (reason) {
            setOperationError(reason instanceof Error ? reason.message : "The CEO department profile could not be updated.");
            return false;
        }
    };

    const toggleDepartment = async (department: Department) => {
        setOperationError("");
        try {
            const updated = isBackendConfigured
                ? await brainServeApi.changeDepartmentStatus(department.id, !department.active)
                : { ...department, active: !department.active, version: department.version + 1 };
            setDepartments((items) => {
                const values = items.map((item) => item.id === department.id ? updated : item);
                if (!isBackendConfigured) writeDemoDepartments(values);
                return values;
            });
        } catch (reason) { setOperationError(reason instanceof Error ? reason.message : "Department status could not be changed."); }
    };

    const assignTeamLead = async (departmentId: string, employeeId: string) => {
        setOperationError("");
        try {
            const previousAssignment = teamLeadAssignments.find((item) => item.departmentId === departmentId && item.active);
            const promotedEmployee = employees.find((item) => (item.uuid ?? item.id) === employeeId);
            const promotedAccount = !isBackendConfigured ? readDemoAccounts().find((account) =>
                account.employeeId === employeeId || account.email.toLowerCase() === promotedEmployee?.email.toLowerCase()) : undefined;
            const created = isBackendConfigured ? await brainServeApi.assignTeamLead(departmentId, employeeId) : {
                id: newClientId(), departmentId, teamLeadUserId: promotedAccount?.id ?? `demo-tl-${employeeId}`,
                teamLeadEmployeeId: employeeId, active: true, assignedByUserId: "demo-hr-admin",
                assignedAt: new Date().toISOString(), endedByUserId: null, endedAt: null,
            };
            setTeamLeadAssignments((items) => {
                const updated = [created, ...items.map((item) => item.departmentId === departmentId && item.active
                    ? { ...item, active: false, endedAt: new Date().toISOString() } : item)];
                if (!isBackendConfigured) writeDemoTeamLeadAssignments(updated);
                return updated;
            });
            if (isBackendConfigured) {
                setStaffAccounts(await brainServeApi.staffAccounts());
            } else {
                const previousEmployee = employees.find((item) => (item.uuid ?? item.id) === previousAssignment?.teamLeadEmployeeId);
                setStaffAccounts((items) => items.map((account) => {
                    if (account.email.toLowerCase() === promotedEmployee?.email.toLowerCase()) return {
                        ...account,
                        roles: ["ROLE_TEAM_LEAD"],
                        effectivePermissions: ["TEAM_LEAD_DIRECTORY_VIEW", "TEAM_LEAD_VISIT_APPROVE", "APPOINTMENT_REQUEST", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"],
                    };
                    if (previousEmployee && account.email.toLowerCase() === previousEmployee.email.toLowerCase()) return {
                        ...account,
                        roles: ["ROLE_EMPLOYEE"],
                        effectivePermissions: ["EMPLOYEE_READ", "APPOINTMENT_REQUEST", "APPOINTMENT_APPROVE", "APPOINTMENT_REJECT", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"],
                    };
                    return account;
                }));
                writeDemoAccounts(readDemoAccounts().map((account) => {
                    if (account.email.toLowerCase() === promotedEmployee?.email.toLowerCase()) return { ...account, role: "ROLE_TEAM_LEAD" };
                    if (previousEmployee && account.email.toLowerCase() === previousEmployee.email.toLowerCase()) return { ...account, role: "ROLE_EMPLOYEE" };
                    return account;
                }));
            }
            return true;
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "Team Lead assignment failed.");
            return false;
        }
    };

    const endTeamLeadAssignment = async (assignment: TeamLeadAssignment) => {
        setOperationError("");
        try {
            const ended = isBackendConfigured ? await brainServeApi.endTeamLeadAssignment(assignment.id)
                : { ...assignment, active: false, endedAt: new Date().toISOString() };
            setTeamLeadAssignments((items) => {
                const updated = items.map((item) => item.id === assignment.id ? ended : item);
                if (!isBackendConfigured) writeDemoTeamLeadAssignments(updated);
                return updated;
            });
            if (isBackendConfigured) {
                setStaffAccounts(await brainServeApi.staffAccounts());
            } else {
                const formerLead = employees.find((item) => (item.uuid ?? item.id) === assignment.teamLeadEmployeeId);
                setStaffAccounts((items) => items.map((account) => formerLead && account.email.toLowerCase() === formerLead.email.toLowerCase()
                    ? {
                        ...account,
                        roles: ["ROLE_EMPLOYEE"],
                        effectivePermissions: ["EMPLOYEE_READ", "APPOINTMENT_REQUEST", "APPOINTMENT_APPROVE", "APPOINTMENT_REJECT", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"],
                    }
                    : account));
                if (formerLead) writeDemoAccounts(readDemoAccounts().map((account) => account.email.toLowerCase() === formerLead.email.toLowerCase()
                    ? { ...account, role: "ROLE_EMPLOYEE" }
                    : account));
            }
        } catch (reason) { setOperationError(reason instanceof ApiError ? reason.message : "Team Lead assignment could not be ended."); }
    };

    const assignDepartmentHr = async (departmentId: string, hrUserId: string) => {
        setOperationError("");
        try {
            const created = isBackendConfigured ? await brainServeApi.assignDepartmentHr(departmentId, hrUserId) : (() => {
                const account = staffAccounts.find((item) => item.userId === hrUserId);
                if (!account?.employeeId) fail("Select an active HR account linked to an employee profile.");
                return { id: newClientId(), departmentId, hrUserId, hrEmployeeId: account.employeeId,
                    active: true, assignedByUserId: "demo-ceo", assignedAt: new Date().toISOString(),
                    endedByUserId: null, endedAt: null } satisfies DepartmentHrAssignment;
            })();
            setDepartmentHrAssignments((items) => {
                const updated = [created, ...items.map((item) => item.active
                && (item.departmentId === departmentId || item.hrUserId === hrUserId)
                    ? { ...item, active: false, endedAt: new Date().toISOString(), endedByUserId: "demo-ceo" } : item)];
                if (!isBackendConfigured) writeDemoDepartmentHrAssignments(updated);
                return updated;
            });
            const department = departments.find((item) => item.id === departmentId);
            setEmployees((items) => {
                const updated = items.map((employee) => (employee.uuid ?? employee.id) === created.hrEmployeeId
                    ? { ...employee, departmentId, department: department?.name ?? employee.department }
                    : employee);
                if (!isBackendConfigured) writeDemoEmployees(updated);
                return updated;
            });
            if (isBackendConfigured) setDepartmentSummaries(await brainServeApi.departmentEmployeeSummary());
            return true;
        } catch (reason) {
            setOperationError(reason instanceof Error ? reason.message : "Department HR assignment failed.");
            return false;
        }
    };

    const endDepartmentHr = async (assignment: DepartmentHrAssignment) => {
        setOperationError("");
        try {
            const ended = isBackendConfigured ? await brainServeApi.endDepartmentHrAssignment(assignment.id)
                : { ...assignment, active: false, endedAt: new Date().toISOString(), endedByUserId: "demo-ceo" };
            setDepartmentHrAssignments((items) => {
                const updated = items.map((item) => item.id === assignment.id ? ended : item);
                if (!isBackendConfigured) writeDemoDepartmentHrAssignments(updated);
                return updated;
            });
        } catch (reason) { setOperationError(reason instanceof Error ? reason.message : "Department HR assignment could not be ended."); }
    };

    const refreshRoleAssignments = async () => {
        if (!isBackendConfigured) {
            setTeamLeadAssignments(readDemoTeamLeadAssignments());
            setDepartmentHrAssignments(readDemoDepartmentHrAssignments());
            setManagerAssignments(readDemoManagerAssignments());
            setEmployees(readDemoEmployees());
            setStaffAccounts(mergeDemoStaffAccounts);
            return;
        }
        const [leadAssignments, hrAssignments, managerAssignmentList, employeePage, summaries] = await Promise.all([
            brainServeApi.teamLeadAssignments(), brainServeApi.departmentHrAssignments(),
            ["CEO", "System Admin"].includes(role) ? brainServeApi.managerAssignments()
                : Promise.resolve(managerAssignments),
            brainServeApi.employees(), brainServeApi.departmentEmployeeSummary(),
        ]);
        setTeamLeadAssignments(leadAssignments); setDepartmentHrAssignments(hrAssignments);
        setManagerAssignments(managerAssignmentList);
        setDepartmentSummaries(summaries);
        setEmployees(employeePage.content.map((item) => { const department = departments.find((value) => value.id === item.departmentId);
            return { id: item.employeeNumber, uuid: item.id, departmentId: item.departmentId,
                name: item.displayName, initials: visitorInitials(item.displayName), role: item.designation,
                department: department?.name ?? "Department", email: item.officialEmail,
                status: employeeStatusLabel(item.status) }; }));
    };

    const changeEmployeeLifecycle = async (employee: Employee, nextStatus: Employee["status"]) => {
        setOperationError("");
        if (nextStatus === "Terminated") {
            setTerminationEmployee(employee);
            return;
        }
        try {
            if (isBackendConfigured) {
                if (!employee.uuid) fail("This employee record is missing its database identifier. Refresh the directory and try again.");
                await brainServeApi.changeEmployeeStatus(employee.uuid, employeeStatusCode[nextStatus]);
                setDepartmentSummaries(await brainServeApi.departmentEmployeeSummary());
            }
            setEmployees((items) => {
                const updated = items.map((item) => item.id === employee.id ? { ...item, status: nextStatus } : item);
                if (!isBackendConfigured) writeDemoEmployees(updated);
                return updated;
            });
            setMetrics((current) => ({ ...current, activeEmployees: current.activeEmployees
                    + (employee.status !== "Active" && nextStatus === "Active" ? 1 : 0)
                    - (employee.status === "Active" && nextStatus !== "Active" ? 1 : 0) }));
        } catch (reason) { setOperationError(reason instanceof Error ? reason.message : "Employee lifecycle update failed."); }
    };

    const registerVisit = async (input: ReceptionVisitInput) => {
        const host = employees.find((item) => (item.uuid ?? item.id) === input.hostEmployeeId) ?? employees[0];
        const requestedEmployee = employees.find((item) => (item.uuid ?? item.id) === input.requestedEmployeeId);
        setOperationError("");
        try {
            let id = String(Date.now());
            let referenceNumber = `LOCAL-${id}`;
            const startIso = input.slotStart;
            if (isBackendConfigured) {
                const payload = {
                    type: appointmentTypeCode(input.visitType), visitorName: input.visitorName, visitorEmail: input.visitorEmail,
                    visitorPhone: input.visitorPhone, visitorCompany: input.visitorCompany,
                    hostEmployeeId: input.hostEmployeeId, routingDepartmentId: input.routingDepartmentId,
                    requestedEmployeeId: input.requestedEmployeeId ?? null, slotStart: startIso,
                    slotEnd: input.slotEnd, purpose: input.purpose,
                    identityDocumentType: input.identityDocumentType,
                    identityDocumentLastFour: input.identityDocumentLastFour, notes: input.notes,
                    createdAt: new Date().toISOString(),
                };
                const created = role === "Security"
                    ? await brainServeApi.registerAtSecurity(payload, newClientId())
                    : await brainServeApi.registerAtReception(payload, newClientId());
                id = created.id; referenceNumber = created.referenceNumber;
            } else {
                const demo: DemoAppointment = {
                    id, referenceNumber, type: appointmentTypeCode(input.visitType),
                    status: role === "Security" ? "PENDING_RECEPTION_VERIFICATION" : "PENDING_SECURITY_INTAKE",
                    hostReference: input.hostEmployeeId, slotStart: startIso, slotEnd: input.slotEnd,
                    hostCategory: input.hostCategory,
                    visitorDisplayName: input.visitorName, visitorName: input.visitorName,
                    visitorEmail: input.visitorEmail, visitorPhone: input.visitorPhone,
                    visitorCompany: input.visitorCompany || null, purpose: input.purpose,
                    routingDepartmentId: input.routingDepartmentId, requestedEmployeeId: input.requestedEmployeeId ?? null,
                    identityDocumentType: input.identityDocumentType,
                    identityDocumentLastFour: input.identityDocumentLastFour, notes: input.notes,
                };
                writeDemoAppointments([...readDemoAppointments(), demo]);
            }
            setAppointments((items) => [...items, {
                id, initials: visitorInitials(input.visitorName), visitor: input.visitorName,
                company: input.visitorCompany || "Independent", host: requestedEmployee?.name ?? host?.name ?? "BrainServe host",
                purpose: input.purpose, time: formatOfficeTime(startIso), date: formatOfficeDate(startIso, { year: undefined }),
                status: role === "Security" ? "Awaiting Reception" : "Awaiting Security",
                type: input.visitType, referenceNumber, hostEmployeeId: input.hostEmployeeId,
                hostCategory: input.hostCategory,
                routingDepartmentId: input.routingDepartmentId, requestedEmployeeId: input.requestedEmployeeId ?? null,
                slotStart: startIso,
                arrivalVisitorName: role === "Security" ? input.visitorName : null,
                arrivalPurpose: role === "Security" ? input.purpose : null,
                identityDocumentType: input.identityDocumentType,
                identityDocumentLastFour: input.identityDocumentLastFour, securityNotes: input.notes,
            }]);
            if (!isBackendConfigured && role === "Security") {
                const now = new Date().toISOString();
                writeDemoInternalNotifications([{ id: newClientId(), senderUserId: userEmail,
                    recipientUserId: "reception-preview", senderName: "Security Desk", recipientName: "Reception Desk",
                    message: `${input.visitorName} arrived for ${host?.name ?? "BrainServe host"}. ${input.purpose} · ${referenceNumber}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: userEmail, recipientEmail: "reception@brainserve.in" }, ...readDemoInternalNotifications()]);
            }
            setMetrics((current) => ({ ...current, awaitingApproval: current.awaitingApproval + 1 }));
            setVisitModal(false);
        } catch (reason) {
            setOperationError(reason instanceof ApiError ? reason.message : "The visitor request could not be created.");
            rethrow(reason);
        }
    };

    const checkInAppointment = async (id: string) => {
        setOperationError("");
        try {
            if (isBackendConfigured) {
                const record = await brainServeApi.checkIn(id);
                setAccessRecords((items) => [...items, record]);
            } else {
                setAccessRecords((items) => [...items, { id: newClientId(), appointmentId: id,
                    visitorName: appointments.find((item) => item.id === id)?.visitor ?? "Visitor",
                    badgeNumber: `B-${String(items.length + 1).padStart(3, "0")}`, checkedInAt: new Date().toISOString(),
                    checkedOutAt: null, processedBy: userEmail }]);
            }
            updateAppointment(id, "Checked in");
            setMetrics((current) => ({ ...current, visitorsInside: current.visitorsInside + 1 }));
        } catch (reason) { setOperationError(reason instanceof ApiError ? reason.message : "Visitor check-in failed."); }
    };

    const checkOutAppointment = async (appointmentId: string) => {
        const record = accessRecords.find((item) => item.appointmentId === appointmentId);
        if (!record) { setOperationError("The active access record was not found."); return; }
        setOperationError("");
        try {
            if (isBackendConfigured) await brainServeApi.checkOut(record.id);
            setAccessRecords((items) => items.filter((item) => item.id !== record.id));
            updateAppointment(appointmentId, "Completed");
            setMetrics((current) => ({ ...current, visitorsInside: Math.max(0, current.visitorsInside - 1),
                activeVisits: Math.max(0, current.activeVisits - 1) }));
        } catch (reason) { setOperationError(reason instanceof ApiError ? reason.message : "Visitor check-out failed."); }
    };

    const checkInByReference = async (referenceNumber: string) => {
        const normalized = referenceNumber.trim().toUpperCase();
        if (!/^BSA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) fail("Enter a valid BrainServe reference.");
        let record: AccessRecord;
        if (isBackendConfigured) {
            record = await brainServeApi.checkInByReference(normalized);
        } else {
            const appointment = readDemoAppointments().find((item) => item.referenceNumber === normalized);
            if (!appointment || appointment.status !== "APPROVED") fail("Only an approved demo appointment can check in.");
            record = { id: newClientId(), appointmentId: appointment.referenceNumber,
                visitorName: appointment.visitorDisplayName, badgeNumber: `B-${String(accessRecords.length + 1).padStart(3, "0")}`,
                checkedInAt: new Date().toISOString(), checkedOutAt: null, processedBy: userEmail };
        }
        setAccessRecords((items) => [...items, record]);
        updateAppointment(normalized, "Checked in");
        setMetrics((current) => ({ ...current, visitorsInside: current.visitorsInside + 1 }));
    };

    const checkInByPass = async (token: string) => {
        if (!isBackendConfigured) {
            const reference = token.replace("brainserve-demo:", "").trim().toUpperCase();
            await checkInByReference(reference);
            return;
        }
        const record = await brainServeApi.checkInWithVisitorPass(token);
        setAccessRecords((items) => [...items, record]);
        setAppointments((items) => items.map((item) => item.id === record.appointmentId
            ? { ...item, status: "Checked in" } : item));
        setMetrics((current) => ({ ...current, visitorsInside: current.visitorsInside + 1 }));
    };

    const createStaffAccount = async (email: string, temporaryPassword: string, accountRole: string) => {
        let created: StaffAccount;
        if (isBackendConfigured) created = await brainServeApi.createStaffAccount(email, temporaryPassword, accountRole);
        else {
            const normalizedEmail = email.trim().toLowerCase();
            if (readDemoAccounts().some((item) => item.email === normalizedEmail)
                || staffAccounts.some((item) => item.email === normalizedEmail)) {
                fail("A login account already uses this email address.");
            }
            const id = newClientId();
            const fullName = normalizedEmail.split("@")[0].replaceAll(".", " ");
            created = { userId: id, fullName, email: normalizedEmail, roles: [accountRole], enabled: false,
                forcePasswordChange: true, status: "PENDING_HR_APPROVAL", grantedPermissions: [],
                deniedPermissions: [], effectivePermissions: [] };
            writeDemoAccounts([...readDemoAccounts(), { id, fullName, email: normalizedEmail, role: accountRole,
                status: "PENDING_HR_APPROVAL", createdByUserId: null, approvedByUserId: null,
                createdAt: new Date().toISOString(), approvedAt: null,
                forcePasswordChange: true,
                passwordHash: await hashDemoPassword(temporaryPassword) }]);
        }
        setStaffAccounts((items) => [...items, created]);
    };
    const changeStaffEmail = async (userId: string, email: string) => {
        if (isBackendConfigured) await brainServeApi.changeStaffEmail(userId, email);
        else writeDemoAccounts(readDemoAccounts().map((item) => item.id === userId ? { ...item, email } : item));
        setStaffAccounts((items) => items.map((item) => item.userId === userId ? { ...item, email } : item));
    };
    const resetStaffPassword = async (userId: string, password: string) => {
        if (isBackendConfigured) await brainServeApi.resetStaffPassword(userId, password);
        else {
            const passwordHash = await hashDemoPassword(password);
            writeDemoAccounts(readDemoAccounts().map((item) => item.id === userId
                ? { ...item, passwordHash, forcePasswordChange: true } : item));
        }
        setStaffAccounts((items) => items.map((item) => item.userId === userId ? { ...item, forcePasswordChange: true } : item));
    };
    const setStaffEnabled = async (userId: string, enabled: boolean) => {
        if (isBackendConfigured) await brainServeApi.setStaffEnabled(userId, enabled);
        else writeDemoAccounts(readDemoAccounts().map((item) => item.id === userId
            ? { ...item, status: enabled ? "ACTIVE" : "DISABLED" } : item));
        setStaffAccounts((items) => items.map((item) => item.userId === userId
            ? { ...item, enabled, status: enabled ? "ACTIVE" : "DISABLED" } : item));
    };
    const updateStaffPermissions = async (userId: string, grants: string[], denies: string[]) => {
        const updated = isBackendConfigured
            ? await brainServeApi.permissionOverrides(userId, grants, denies)
            : { userId, grantedOverrides: grants, deniedOverrides: denies,
                effectivePermissions: [...new Set([...grants, ...(staffAccounts.find((item) => item.userId === userId)?.effectivePermissions ?? [])])]
                    .filter((permission) => !denies.includes(permission)) };
        setStaffAccounts((items) => items.map((item) => item.userId === userId ? { ...item,
            grantedPermissions: updated.grantedOverrides, deniedPermissions: updated.deniedOverrides,
            effectivePermissions: updated.effectivePermissions } : item));
    };
    const refreshStaffAccounts = async () => {
        if (!isBackendConfigured) {
            setStaffAccounts(mergeDemoStaffAccounts);
            return;
        }
        if (role !== "HR Admin") return;
        try { setStaffAccounts(await brainServeApi.staffAccounts()); }
        catch (reason) { setOperationError(reason instanceof Error ? reason.message : "Staff accounts could not be refreshed."); }
    };

    return <main className="app-shell">
        <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
            <div className="sidebar-top"><Logo /><button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)}><X size={19} /></button></div>
            <div className="workspace-label">WORKSPACE</div>
            <nav>{permittedNav.map((item) => {
                const label = item.id === "insights"
                    ? role === "CEO" ? "Work approvals" : role === "Manager" ? "Work oversight" : item.label
                    : item.label;
                return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSidebarOpen(false); }}><item.icon size={19} /><span>{label}</span>{(item.id === "appointments" || (item.id === "work" && role === "Team Lead")) && pendingAppointmentCount > 0 && <b>{pendingAppointmentCount}</b>}{item.id === "notifications" && unreadNotifications > 0 && <b>{unreadNotifications}</b>}</button>;
            })}</nav>
            <div className="sidebar-bottom"><button onClick={() => setPrivacyOpen(true)}><ShieldCheck size={19} /><span><strong>Privacy centre</strong><small>Policies & consent</small></span></button><div className="profile-menu-wrap" ref={profileMenuRef}>{profileMenuOpen && <div className="profile-popover" role="menu" aria-label="Profile menu"><div className="profile-popover-identity"><span className={`avatar account-avatar${profilePhotoUrl ? " has-photo" : ""}`} style={profilePhotoUrl ? { backgroundImage: `url(${profilePhotoUrl})` } : undefined}>{!profilePhotoUrl && roleBadge(role)}</span><span><strong>{profileName}</strong><small>{userEmail}</small><em>{role}</em></span></div><button type="button" role="menuitem" onClick={() => { setView("profile"); setProfileMenuOpen(false); setSidebarOpen(false); }}><CircleUserRound size={17} /><span><strong>My profile</strong><small>View account details</small></span><ChevronRight size={16} /></button><button type="button" role="menuitemcheckbox" aria-checked={soundEnabled} onClick={() => setNotificationSoundEnabled(!soundEnabled)}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}<span><strong>Notification sounds</strong><small>{soundEnabled ? "On · Play alerts for new activity" : "Off · Alerts stay silent"}</small></span><em className={`sound-toggle ${soundEnabled ? "on" : ""}`} aria-hidden="true"><i /></em></button><button type="button" role="menuitem" className="profile-logout" disabled={loggingOut} onClick={() => void signOut()}><LogOut size={17} /><span><strong>{loggingOut ? "Signing out…" : "Logout"}</strong><small>End this secure session</small></span></button></div>}<button type="button" className="user-block" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}><span className={`avatar account-avatar${profilePhotoUrl ? " has-photo" : ""}`} style={profilePhotoUrl ? { backgroundImage: `url(${profilePhotoUrl})` } : undefined}>{!profilePhotoUrl && roleBadge(role)}</span><span><strong>{profileName}</strong><small>{role} · {userEmail}</small></span><ChevronRight className="profile-menu-chevron" size={17} /></button></div></div>
        </aside>

        <section className="app-main">
            <header className="app-header"><div className="global-search"><button className="icon-button menu-button" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><Search size={18} /><input aria-label="Search" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search people, visits or reference…" />{globalSearch.trim().length >= 2 && <div className="global-search-results glass-panel">{globalSearchResults.map((result) => <button key={result.id} onClick={() => { setView(result.view); setGlobalSearch(""); }}><Search size={14} /><span><strong>{result.title}</strong><small>{result.detail}</small></span><ChevronRight size={14} /></button>)}{globalSearchResults.length === 0 && <div><strong>No matching workspace records</strong><small>Try a name, email or appointment reference.</small></div>}</div>}</div><div className="header-actions"><button type="button" className={`live-status ${isBackendConfigured ? `live-${liveState}` : "live-preview"}`} onClick={requestWorkspaceRefresh} title={lastLiveUpdate ? `Last synchronized ${lastLiveUpdate.toLocaleTimeString("en-IN")}` : "Refresh BrainServe Connect data"}><span />{isBackendConfigured ? liveState === "live" ? "Live" : liveState === "connecting" ? "Connecting" : liveState === "offline" ? "Offline" : "Reconnecting" : "Preview"}<RotateCcw size={13} /></button>{rolePermissions[role].includes("notifications") && <button className="icon-button notification-button" onClick={() => setView("notifications")} aria-label={`Open notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}><Bell size={19} />{unreadNotifications > 0 && <span />}</button>}</div></header>
            <div className="app-content">
                {operationError && <div className="login-error workspace-error" role="alert">{operationError}</div>}
                {view === "overview" && (role === "System Admin"
                    ? <AccountProvisioningPanel key={`overview:${workspaceRevision}`} role={role} departments={departments}
                                                onDecision={refreshStaffAccounts} />
                    : ["CEO", "HR Admin"].includes(role)
                        ? <><Overview key={`overview:${workspaceRevision}:operations`} role={role} appointments={appointments}
                                      metrics={metrics} onNavigate={setView} onRegister={() => setVisitModal(true)}
                                      decideAppointment={decideAppointment} />
                            <AccountProvisioningPanel key={`overview:${workspaceRevision}:accounts`} compact role={role}
                                                      departments={departments} onDecision={refreshStaffAccounts} /></>
                        : <Overview key={`overview:${workspaceRevision}`} role={role} appointments={appointments} metrics={metrics} onNavigate={setView}
                                    onRegister={() => setVisitModal(true)} decideAppointment={decideAppointment} />)}
                {view === "appointments" && <AppointmentsView key={`appointments:${workspaceRevision}`} role={role} appointments={appointments} currentEmployee={currentEmployee}
                                                              onCreate={() => setVisitModal(true)} decideAppointment={decideAppointment}
                                                              onSecurityIntake={setSecurityIntakeAppointment} decideReceptionVisit={decideReceptionVisit}
                                                              forwardReceptionVisit={forwardReceptionVisit} />}
                {view === "work" && <WorkBoard key={`work:${workspaceRevision}`} role={role} userEmail={userEmail} employees={employees}
                                               departments={departments} teamLeadAssignments={teamLeadAssignments}
                                               appointments={appointments} decideAppointment={decideAppointment} />}
                {view === "performance" && <TeamLeadPerformanceView key={`performance:${workspaceRevision}`} departments={departments}
                                                                    employees={employees} staffAccounts={staffAccounts} />}
                {view === "insights" && <WorkInsightsView key={`insights:${workspaceRevision}`} role={role} userEmail={userEmail} departments={departments}
                                                          employees={employees} staffAccounts={staffAccounts} />}
                {view === "employees" && <EmployeesView key={`employees:${workspaceRevision}`} role={role} employees={employees}
                                                        departments={departments}
                                                        staffAccounts={staffAccounts}
                                                        currentEmployee={currentEmployee}
                                                        unassignedAccounts={unassignedEmployeeAccounts}
                                                        onAssignDepartment={(account) => { setOperationError(""); setEmployeeAccountId(account.userId); setEmployeeDepartmentId(undefined); setEmployeeModal(true); }}
                                                        onAdd={() => { setOperationError(""); setEmployeeAccountId(undefined); setEmployeeDepartmentId(undefined); setEmployeeModal(true); }} onStatus={changeEmployeeLifecycle} />}
                {view === "terminations" && <TerminationsView key={`terminations:${workspaceRevision}`} role={role} userEmail={userEmail}
                                                              onEmployeeTerminated={(employeeId) => {
                                                                  setEmployees((items) => items.map((item) => (item.uuid ?? item.id) === employeeId ? { ...item, status: "Terminated" } : item));
                                                                  setWorkspaceRevision((revision) => revision + 1);
                                                              }} />}
                {view === "account-lifecycle" && <AccountLifecycleView key={`account-lifecycle:${workspaceRevision}`} role={role}
                                                                       userEmail={userEmail} staffAccounts={staffAccounts} departments={departments} employees={employees} />}
                {view === "visitors" && <VisitorsView key={`visitors:${workspaceRevision}`} role={role} appointments={appointments} accessRecords={accessRecords}
                                                      onCheckIn={checkInAppointment} onReferenceCheckIn={checkInByReference}
                                                      onPassCheckIn={checkInByPass} onCheckOut={checkOutAppointment}
                                                      decideReceptionVisit={decideReceptionVisit} onRegister={() => setVisitModal(true)} />}
                {view === "notifications" && <InternalNotificationsView key={`notifications:${workspaceRevision}`} role={role} userEmail={userEmail}
                                                                        onUnreadChange={setUnreadNotifications} />}
                {view === "organization" && <OrganizationView key={`organization:${workspaceRevision}`} role={role} userEmail={userEmail} departments={departments} employees={employees}
                                                              staffAccounts={staffAccounts}
                                                              summaries={departmentSummaries} teamLeadAssignments={teamLeadAssignments}
                                                              departmentHrAssignments={departmentHrAssignments}
                                                              onCreate={createDepartment} onToggle={toggleDepartment} onAssignTeamLead={assignTeamLead}
                                                              onEndTeamLead={endTeamLeadAssignment}
                                                              onAssignDepartmentHr={assignDepartmentHr} onEndDepartmentHr={endDepartmentHr}
                                                              onJoinExecutiveDepartment={joinExecutiveDepartment}
                                                              onAddEmployee={(departmentId) => { setOperationError(""); setEmployeeAccountId(undefined); setEmployeeDepartmentId(departmentId); setEmployeeModal(true); }} />}
                {view === "reports" && <ReportsView role={role} metrics={metrics} appointments={appointments}
                                                    accessRecords={accessRecords} refreshKey={workspaceRevision} onRefresh={requestWorkspaceRefresh} />}
                {view === "audit" && <AuditView key={`audit:${workspaceRevision}`} />}
                {view === "logs" && <EssentialLogsView key={`logs:${workspaceRevision}`} />}
                {view === "profile" && <MyProfileView key={`profile:${workspaceRevision}`} role={role} userEmail={userEmail}
                                                      departments={departments} employees={employees} staffAccounts={staffAccounts}
                                                      onProfileUpdated={handleProfileUpdated} />}
                {view === "settings" && <SettingsView key={`settings:${workspaceRevision}`} role={role} userEmail={userEmail} accounts={staffAccounts}
                                                      departments={departments} employees={employees} teamLeadAssignments={teamLeadAssignments}
                                                      departmentHrAssignments={departmentHrAssignments} managerAssignments={managerAssignments}
                                                      approvedRecovery={approvedRecovery} onApprovedRecoveryChange={setApprovedRecovery}
                                                      onRoleAssignmentChanged={refreshRoleAssignments}
                                                      onAddEmployee={() => { setOperationError(""); setEmployeeAccountId(undefined); setEmployeeDepartmentId(undefined); setEmployeeModal(true); }}
                                                      onAssignTeamLead={assignTeamLead}
                                                      onCreate={createStaffAccount} onChangeEmail={changeStaffEmail} onResetPassword={resetStaffPassword}
                                                      onSetEnabled={setStaffEnabled} onUpdatePermissions={updateStaffPermissions} />}
            </div>
        </section>
        {employeeModal && <EmployeeModal key={`${employeeAccountId ?? "new"}:${employeeDepartmentId ?? "employee"}`} departments={departments} employees={employees}
                                         teamLeadAssignments={teamLeadAssignments}
                                         account={selectedEmployeeAccount} initialDepartmentId={employeeDepartmentId} error={operationError}
                                         onClose={() => { setOperationError(""); setEmployeeModal(false); setEmployeeDepartmentId(undefined); setEmployeeAccountId(undefined); }} onSubmit={addEmployee} />}
        {terminationEmployee && <TerminationRequestModal employee={terminationEmployee} userEmail={userEmail}
                                                         onClose={() => setTerminationEmployee(null)} onSubmitted={() => {
            setTerminationEmployee(null); setView("terminations"); setWorkspaceRevision((revision) => revision + 1);
        }} />}
        {visitModal && <VisitRegistrationModal employees={appointmentHosts.length ? appointmentHosts : employees}
                                               departments={departments} securityMode={role === "Security"}
                                               onClose={() => setVisitModal(false)} onSubmit={registerVisit} />}
        {securityIntakeAppointment && <SecurityIntakeModal appointment={securityIntakeAppointment}
                                                           onClose={() => setSecurityIntakeAppointment(null)} onSubmit={recordSecurityIntake} />}
        {privacyOpen && <PrivacyCentreModal onClose={() => setPrivacyOpen(false)} />}
    </main>;
}

function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
    return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function MyProfileView({ role, userEmail, departments, employees, staffAccounts, onProfileUpdated }: {
    role: Role; userEmail: string; departments: Department[]; employees: Employee[]; staffAccounts: StaffAccount[];
    onProfileUpdated: (profile: MyProfile) => void;
}) {
    const demoProfile = useCallback((): MyProfile => {
        const savedAccount = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
        const staffAccount = staffAccounts.find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
        const employeeId = savedAccount?.employeeId ?? staffAccount?.employeeId ?? null;
        const employee = employees.find((item) => item.email.toLowerCase() === userEmail.toLowerCase()
            || Boolean(employeeId && (item.uuid ?? item.id) === employeeId));
        const department = departments.find((item) => item.id === employee?.departmentId);
        const photoUrl = typeof window === "undefined" ? null
            : window.localStorage.getItem(`brainserve.demo.profile.photo.${userEmail.toLowerCase()}`);
        return {
            userId: savedAccount?.id ?? staffAccount?.userId ?? `demo-${role.toLowerCase().replaceAll(" ", "-")}`,
            employeeId: employeeId ?? employee?.uuid ?? null,
            fullName: savedAccount?.fullName ?? staffAccount?.fullName ?? employee?.name
                ?? (role === "System Admin" ? "Jety Chodipilli" : role === "Reception" ? "Reception Desk" : role === "Security" ? "Security Desk" : role),
            email: userEmail, roles: [ROLE_AUTHORITY_BY_LABEL[role]], employeeNumber: employee?.id ?? null,
            designation: employee?.role ?? (role === "System Admin" ? "System Administrator" : role),
            employeeStatus: employee?.status?.toUpperCase().replaceAll(" ", "_") ?? (staffAccount?.enabled ? "ACTIVE" : null),
            departmentId: department?.id ?? null, departmentCode: department?.code ?? null,
            departmentName: department?.name ?? null, departmentActive: department?.active ?? null,
            photoDocumentId: null, photoUrl, photoUrlExpiresAt: null,
        };
    }, [departments, employees, role, staffAccounts, userEmail]);
    const [profile, setProfile] = useState<MyProfile>(() => isBackendConfigured ? {
        userId: "", employeeId: null, fullName: role, email: userEmail,
        roles: [ROLE_AUTHORITY_BY_LABEL[role]], employeeNumber: null, designation: role,
        employeeStatus: null, departmentId: null, departmentCode: null, departmentName: null,
        departmentActive: null, photoDocumentId: null, photoUrl: null, photoUrlExpiresAt: null,
    } : demoProfile());
    const [backendProfileLoaded, setBackendProfileLoaded] = useState(!isBackendConfigured);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [changeRequests, setChangeRequests] = useState<RoleDepartmentChangeRequest[]>(() => !isBackendConfigured
        ? readDemoRoleDepartmentChanges().filter((item) => item.requesterUserId === profile.userId) : []);
    const [targetDepartmentId, setTargetDepartmentId] = useState("");
    const [changeBusy, setChangeBusy] = useState(false);
    const [closureRequests, setClosureRequests] = useState<AccountClosureRequest[]>(() => !isBackendConfigured
        ? readDemoAccountClosures().filter((item) => item.requesterUserId === profile.userId) : []);
    const [closureCandidates, setClosureCandidates] = useState<AccountClosureCandidate[]>([]);
    const [closureBusy, setClosureBusy] = useState(false);
    const demoClosureCandidates = useMemo((): AccountClosureCandidate[] => {
        if (isBackendConfigured) return [];
        const authority = role === "HR Admin" ? "ROLE_HR_ADMIN" : role === "Manager" ? "ROLE_MANAGER"
            : role === "Team Lead" ? "ROLE_TEAM_LEAD"
                : role === "Reception" ? "ROLE_RECEPTIONIST" : role === "Security" ? "ROLE_SECURITY" : "ROLE_CEO";
        const accounts = readDemoAccounts().filter((item) => item.status === "ACTIVE" && item.id !== profile.userId);
        const candidates = role === "Team Lead"
            ? accounts.filter((item) => item.role === "ROLE_EMPLOYEE").filter((item) => {
                const employee = employees.find((value) => value.email.toLowerCase() === item.email.toLowerCase());
                return Boolean(employee && employee.departmentId === profile.departmentId && employee.status === "Active");
            })
            : accounts.filter((item) => item.role === authority)
                .filter((item) => role !== "HR Admin" || !readDemoDepartmentHrAssignments()
                    .some((assignment) => assignment.active && assignment.hrUserId === item.id))
                .filter((item) => role !== "Manager" || !readDemoManagerAssignments()
                    .some((assignment) => assignment.active && assignment.managerUserId === item.id));
        return candidates.map((item) => ({ userId: item.id, fullName: item.fullName,
            email: item.email, role: item.role, employeeId: item.employeeId ?? null, departmentId: profile.departmentId }));
    }, [employees, profile.departmentId, profile.userId, role]);
    const availableClosureCandidates = isBackendConfigured ? closureCandidates : demoClosureCandidates;

    useEffect(() => {
        if (!isBackendConfigured) return;
        let active = true;
        brainServeApi.myProfile().then((value) => { if (active) { setProfile(value); setBackendProfileLoaded(true); onProfileUpdated(value); setError(""); } })
            .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Your profile could not be loaded."); });
        if (["HR Admin", "Team Lead"].includes(role)) {
            brainServeApi.myRoleDepartmentChanges().then((items) => { if (active) setChangeRequests(items); })
                .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Department change requests could not be loaded."); });
        }
        return () => { active = false; };
    }, [demoProfile, onProfileUpdated, role]);

    useEffect(() => {
        const eligible = ["CEO", "HR Admin", "Team Lead", "Reception", "Security"].includes(role);
        if (!eligible) return;
        if (isBackendConfigured) {
            if (!backendProfileLoaded) return;
            let active = true;
            Promise.all([brainServeApi.myAccountClosures(), brainServeApi.accountClosureCandidates(profile.userId)])
                .then(([requests, candidates]) => { if (active) { setClosureRequests(requests); setClosureCandidates(candidates); } })
                .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Account lifecycle data could not be loaded."); });
            return () => { active = false; };
        }
        return;
    }, [backendProfileLoaded, employees, profile.departmentId, profile.userId, role]);

    const uploadPhoto = async (file: File | undefined) => {
        if (!file) return;
        setError(""); setMessage("");
        if (!["image/jpeg", "image/png"].includes(file.type)) { setError("Choose a JPEG or PNG image."); return; }
        if (file.size > 10 * 1024 * 1024) { setError("Profile photos must be 10 MB or smaller."); return; }
        setBusy(true);
        try {
            if (isBackendConfigured) {
                const updated = await brainServeApi.uploadMyProfilePhoto(file);
                setProfile(updated); onProfileUpdated(updated);
            }
            else {
                const photoUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error("The selected image could not be read.")); reader.readAsDataURL(file);
                });
                window.localStorage.setItem(`brainserve.demo.profile.photo.${userEmail.toLowerCase()}`, photoUrl);
                setProfile((current) => { const updated = { ...current, photoUrl }; onProfileUpdated(updated); return updated; });
            }
            setMessage("Your profile photo was updated securely.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Your profile photo could not be uploaded."); }
        finally { setBusy(false); }
    };

    const roles = profile.roles.map(readableNotificationRole);
    const canRequestDepartmentChange = role === "HR Admin" || role === "Team Lead";
    const pendingChange = changeRequests.find((item) => item.status === "PENDING");
    const selectedTarget = departments.find((item) => item.id === targetDepartmentId);
    const targetHrAssignment = !isBackendConfigured && role === "HR Admin"
        ? readDemoDepartmentHrAssignments().find((item) => item.active && item.departmentId === targetDepartmentId)
        : undefined;
    const targetTeamLeadAssignment = !isBackendConfigured && role === "Team Lead"
        ? readDemoTeamLeadAssignments().find((item) => item.active && item.departmentId === targetDepartmentId)
        : undefined;
    const targetOccupantName = role === "HR Admin"
        ? [...staffAccounts, ...readDemoAccounts().map((item) => ({ userId: item.id, fullName: item.fullName } as StaffAccount))]
            .find((item) => item.userId === targetHrAssignment?.hrUserId)?.fullName
        : employees.find((item) => (item.uuid ?? item.id) === targetTeamLeadAssignment?.teamLeadEmployeeId)?.name;

    const requestDepartmentChange = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError(""); setMessage(""); setChangeBusy(true);
        const form = event.currentTarget; const data = new FormData(form);
        try {
            let created: RoleDepartmentChangeRequest;
            const payload = { targetDepartmentId: String(data.get("targetDepartmentId")),
                reason: String(data.get("reason")), phoneNumber: String(data.get("phoneNumber") ?? "") || null,
                designation: String(data.get("designation") ?? "") || profile.designation || role,
                joiningDate: String(data.get("joiningDate") ?? "") || officeToday() };
            if (isBackendConfigured) created = await brainServeApi.requestRoleDepartmentChange(payload);
            else {
                const target = departments.find((item) => item.id === payload.targetDepartmentId);
                if (!target) fail("Select an active department.");
                if (role === "Team Lead" && !readDemoDepartmentHrAssignments().some((item) => item.active && item.departmentId === target.id)) {
                    fail("The destination department needs an assigned HR Admin before a Team Lead can request access.");
                }
                const occupantUserId = role === "HR Admin" ? targetHrAssignment?.hrUserId
                    : targetTeamLeadAssignment?.teamLeadUserId;
                created = { id: newClientId(), requesterUserId: profile.userId, requesterEmployeeId: profile.employeeId,
                    requesterName: profile.fullName, requesterEmail: profile.email,
                    requesterRole: role === "HR Admin" ? "HR_ADMIN" : "TEAM_LEAD",
                    fromDepartmentId: profile.departmentId, fromDepartmentName: profile.departmentName,
                    targetDepartmentId: target.id, targetDepartmentName: target.name,
                    targetOccupied: Boolean(occupantUserId && occupantUserId !== profile.userId),
                    targetOccupantUserId: occupantUserId ?? null, targetOccupantName: targetOccupantName ?? null,
                    reason: payload.reason.trim(), status: "PENDING", requestedAt: new Date().toISOString(),
                    resolution: null, decisionNote: null, decidedByUserId: null, decidedAt: null };
                writeDemoRoleDepartmentChanges([created, ...readDemoRoleDepartmentChanges()]);
                const allAccounts = readDemoAccounts();
                const recipient = role === "HR Admin"
                    ? allAccounts.find((item) => item.status === "ACTIVE" && item.role === "ROLE_CEO")
                    : allAccounts.find((item) => item.id === readDemoDepartmentHrAssignments()
                        .find((item) => item.active && item.departmentId === target.id)?.hrUserId);
                const now = new Date().toISOString();
                writeDemoInternalNotifications([{ id: newClientId(), senderUserId: profile.userId,
                    recipientUserId: recipient?.id ?? (role === "HR Admin" ? "demo-ceo" : "demo-hr-admin"),
                    senderName: profile.fullName, recipientName: recipient?.fullName ?? (role === "HR Admin" ? "BrainServe CEO" : "Department HR Admin"),
                    message: `${profile.fullName} requested a ${role} department change to ${target.name}. Review it in Settings → Roles & responsibilities.`,
                    priority: "HIGH", category: "ACTION_REQUIRED",
                    conversationKey: `role-department-change:${created.id}`, deliveryStatus: "DELIVERED",
                    sentAt: now, deliveredAt: now, readAt: null, senderEmail: profile.email,
                    recipientEmail: recipient?.email ?? (role === "HR Admin" ? "ceo@brainserve.in" : "hr.admin@brainserve.in") },
                    ...readDemoInternalNotifications()]);
            }
            setChangeRequests((items) => [created, ...items]); setTargetDepartmentId(""); form.reset();
            setMessage(`Department change request sent to ${role === "HR Admin" ? "CEO" : "the destination department HR"}.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The department change request could not be sent."); }
        finally { setChangeBusy(false); }
    };

    const cancelDepartmentChange = async (request: RoleDepartmentChangeRequest) => {
        setChangeBusy(true); setError("");
        try {
            const updated = isBackendConfigured ? await brainServeApi.cancelRoleDepartmentChange(request.id)
                : { ...request, status: "CANCELLED" as const, decidedByUserId: profile.userId, decidedAt: new Date().toISOString() };
            if (!isBackendConfigured) writeDemoRoleDepartmentChanges(readDemoRoleDepartmentChanges()
                .map((item) => item.id === request.id ? updated : item));
            setChangeRequests((items) => items.map((item) => item.id === request.id ? updated : item));
            setMessage("Department change request cancelled.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The request could not be cancelled."); }
        finally { setChangeBusy(false); }
    };

    const requestAccountClosure = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setClosureBusy(true); setError(""); setMessage("");
        const form = event.currentTarget; const data = new FormData(form);
        const reason = String(data.get("reason") ?? "").trim();
        const effectiveDate = String(data.get("effectiveDate") ?? "");
        const replacementUserId = String(data.get("replacementUserId") ?? "") || null;
        try {
            let created: AccountClosureRequest;
            if (isBackendConfigured) created = await brainServeApi.requestMyAccountClosure(reason, effectiveDate, replacementUserId);
            else {
                const authority = role === "HR Admin" ? "ROLE_HR_ADMIN" : role === "Manager" ? "ROLE_MANAGER"
                    : role === "Team Lead" ? "ROLE_TEAM_LEAD"
                        : role === "Reception" ? "ROLE_RECEPTIONIST" : role === "Security" ? "ROLE_SECURITY" : "ROLE_CEO";
                if (readDemoAccountClosures().some((item) => item.targetUserId === profile.userId
                    && ["REQUESTED", "BUSINESS_APPROVED", "PENDING_SYSTEM_ADMIN", "SCHEDULED"].includes(item.status))) {
                    fail("This account already has an open closure request.");
                }
                if (!["Reception", "Security"].includes(role) && !replacementUserId) {
                    fail("Select an active replacement so responsibilities are not orphaned.");
                }
                const replacement = availableClosureCandidates.find((item) => item.userId === replacementUserId);
                const now = new Date().toISOString();
                created = { id: newClientId(), targetUserId: profile.userId, targetName: profile.fullName,
                    targetEmail: profile.email, targetRole: authority, employeeId: profile.employeeId,
                    departmentId: profile.departmentId, departmentName: profile.departmentName,
                    requesterUserId: profile.userId, origin: "SELF_SERVICE", reason,
                    requestedEffectiveDate: effectiveDate, replacementUserId,
                    replacementName: replacement?.fullName ?? null, status: "REQUESTED", requestedAt: now,
                    businessApproverUserId: null, businessApprovedAt: null, systemAdminApproverUserId: null,
                    systemAdminApprovedAt: null, decisionNote: null, scheduledAt: null, archivedAt: null,
                    cancelledAt: null };
                writeDemoAccountClosures([created, ...readDemoAccountClosures()]);
                recordDemoClosureTransition(created, "ACCOUNT_CLOSURE_REQUESTED", null, profile.userId,
                    "Self-service account closure requested");
            }
            setClosureRequests((items) => [created, ...items]); form.reset();
            setMessage(role === "CEO" ? "Closure request sent to System Admin."
                : role === "HR Admin" ? "Closure request sent to CEO for business review."
                    : role === "Team Lead" ? "Closure request sent to your department HR."
                        : "Closure request sent to HR for business review.");
        } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "The closure request could not be sent."); }
        finally { setClosureBusy(false); }
    };

    const cancelAccountClosure = async (request: AccountClosureRequest) => {
        setClosureBusy(true); setError("");
        try {
            const updated = isBackendConfigured ? await brainServeApi.cancelAccountClosure(request.id)
                : { ...request, status: "CANCELLED" as const, cancelledAt: new Date().toISOString() };
            if (!isBackendConfigured) {
                writeDemoAccountClosures(readDemoAccountClosures().map((item) => item.id === updated.id ? updated : item));
                recordDemoClosureTransition(updated, "ACCOUNT_CLOSURE_CANCELLED", request.status, profile.userId,
                    "Requester cancelled account closure");
            }
            setClosureRequests((items) => items.map((item) => item.id === updated.id ? updated : item));
            setMessage("Account closure request cancelled.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The closure request could not be cancelled."); }
        finally { setClosureBusy(false); }
    };
    return <section className="my-profile-page">
        <PageTitle eyebrow="MY PROFILE" title="Your BrainServe Connect identity"
                   detail="Review your signed-in role, department assignment and employee identity in one private workspace." />
        <article className="profile-hero glass-panel">
            <div className="profile-photo" style={profile.photoUrl ? { backgroundImage: `url(${profile.photoUrl})` } : undefined}>
                {!profile.photoUrl && <span>{visitorInitials(profile.fullName)}</span>}
            </div>
            <div className="profile-identity"><span>ACTIVE STAFF IDENTITY</span><h2>{profile.fullName}</h2><p>{profile.email}</p>
                <div>{roles.map((value) => <b key={value}><ShieldCheck size={13} />{value}</b>)}</div></div>
            <label className={`button button-primary profile-upload${busy ? " disabled" : ""}`}>
                <CircleUserRound size={17} />{busy ? "Uploading…" : "Upload profile picture"}
                <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(event) => {
                    void uploadPhoto(event.target.files?.[0]); event.target.value = "";
                }} />
            </label>
        </article>
        <div className="profile-detail-grid">
            <article className="profile-detail-card glass-panel"><Building2 size={20} /><span><small>DEPARTMENT</small><strong>{profile.departmentName ?? "Not assigned"}</strong><p>{profile.departmentCode ? `${profile.departmentCode} · ${profile.departmentActive ? "Active" : "Inactive"}` : "No department is linked to this role."}</p></span></article>
            <article className="profile-detail-card glass-panel"><IdCard size={20} /><span><small>EMPLOYEE ID</small><strong>{profile.employeeNumber ?? "Not applicable"}</strong><p>{profile.employeeId ? "Linked to your verified employee record." : "This operational account has no employee profile."}</p></span></article>
            <article className="profile-detail-card glass-panel"><BriefcaseBusiness size={20} /><span><small>DESIGNATION</small><strong>{profile.designation ?? role}</strong><p>{profile.employeeStatus ? profile.employeeStatus.replaceAll("_", " ").toLowerCase() : "Active account"}</p></span></article>
        </div>
        {canRequestDepartmentChange && <article className="department-change-profile glass-panel">
            <div className="panel-heading"><div><span>ROLE ASSIGNMENT REQUEST</span><h2>Request a department change</h2><p>{role === "HR Admin" ? "CEO reviews HR department ownership." : "The HR Admin assigned to your destination department reviews Team Lead access."} Existing ownership always requires an explicit swap or replacement decision.</p></div><Building2 size={23} /></div>
            {pendingChange ? <div className="pending-department-change"><span className="role-icon"><FileClock size={18} /></span><span><strong>{pendingChange.fromDepartmentName ?? "Unassigned"} <ArrowRight size={14} /> {pendingChange.targetDepartmentName}</strong><small>{pendingChange.reason} · requested {new Date(pendingChange.requestedAt).toLocaleDateString("en-IN")}</small></span><StatusPill status="Pending" /><button className="button button-reject" disabled={changeBusy} onClick={() => void cancelDepartmentChange(pendingChange)}>Cancel request</button></div>
                : <form className="department-change-form" onSubmit={requestDepartmentChange}>
                    <label>New department<select name="targetDepartmentId" value={targetDepartmentId} onChange={(event) => setTargetDepartmentId(event.target.value)} required><option value="">Select an active department</option>{departments.filter((item) => item.active && item.id !== profile.departmentId).map((department) => <option key={department.id} value={department.id}>{department.name} · {department.code}</option>)}</select></label>
                    <label>Reason for change<textarea name="reason" minLength={5} maxLength={500} required placeholder="Explain why this department assignment should change." /></label>
                    {!profile.employeeId && role === "HR Admin" && <div className="department-change-profile-fields"><label>Designation<input name="designation" defaultValue="HR Admin" maxLength={120} required /></label><label>Phone number<input name="phoneNumber" maxLength={30} placeholder="Optional" /></label><label>Joining date<input name="joiningDate" type="date" max={officeToday()} defaultValue={officeToday()} required /></label></div>}
                    {selectedTarget && (targetHrAssignment || targetTeamLeadAssignment) && <div className="role-conflict-warning"><ShieldCheck size={17} /><span><strong>{selectedTarget.name} already has {targetOccupantName ?? (role === "HR Admin" ? "an HR Admin" : "a Team Lead")}.</strong><small>The approver must choose to swap both assignments or replace the current role owner.</small></span></div>}
                    <button className="button button-primary" disabled={changeBusy || !targetDepartmentId}><Send size={16} />{changeBusy ? "Sending…" : "Send approval request"}</button>
                </form>}
            {changeRequests.some((item) => item.status !== "PENDING") && <div className="department-change-history">{changeRequests.filter((item) => item.status !== "PENDING").slice(0, 4).map((item) => <div key={item.id}><span><strong>{item.targetDepartmentName}</strong><small>{item.resolution ? item.resolution.toLowerCase() : item.status.toLowerCase()} · {item.decisionNote ?? item.reason}</small></span><StatusPill status={item.status === "APPROVED" ? "Approved" : item.status === "REJECTED" ? "Rejected" : "Cancelled"} /></div>)}</div>}
        </article>}
        <article className="account-closure-profile glass-panel">
            <div className="panel-heading"><div><span>ACCOUNT LIFECYCLE</span><h2>Deactivate &amp; archive</h2><p>Login is disabled only after the approval route completes. Visits, tasks, messages and audit history remain linked to your original account.</p></div><Archive size={23} /></div>
            {role === "System Admin" ? <div className="protected-account-note"><ShieldCheck size={19} /><span><strong>Permanent protected account</strong><small>The inbuilt System Admin cannot be closed, archived or replaced.</small></span></div>
                : role === "Employee" ? <div className="protected-account-note"><UserCog size={19} /><span><strong>Employee termination governance</strong><small>Employee access is archived only after HR requests termination and CEO gives final approval.</small></span></div>
                    : closureRequests.find((item) => ["REQUESTED", "BUSINESS_APPROVED", "PENDING_SYSTEM_ADMIN", "SCHEDULED"].includes(item.status))
                        ? (() => { const request = closureRequests.find((item) => ["REQUESTED", "BUSINESS_APPROVED", "PENDING_SYSTEM_ADMIN", "SCHEDULED"].includes(item.status))!;
                            return <div className="closure-request-summary"><span className="role-icon"><FileClock size={18} /></span><span><strong>{request.status.replaceAll("_", " ")}</strong><small>Effective {new Date(`${request.requestedEffectiveDate}T00:00:00`).toLocaleDateString("en-IN")} · {request.reason}{request.replacementName ? ` · replacement: ${request.replacementName}` : ""}</small></span><span className={`closure-status closure-${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span>{request.status !== "SCHEDULED" && <button className="button button-reject" disabled={closureBusy} onClick={() => void cancelAccountClosure(request)}>Cancel request</button>}</div>; })()
                        : <form className="account-closure-form" onSubmit={requestAccountClosure}>
                            <label>Reason<textarea name="reason" minLength={5} maxLength={1000} required placeholder="Explain why this account should be deactivated and archived." /></label>
                            <label>Effective date<input name="effectiveDate" type="date" min={officeToday()} defaultValue={officeToday()} required /></label>
                            <label>Replacement account<select name="replacementUserId" required={!(["Reception", "Security"].includes(role))}><option value="">{["Reception", "Security"].includes(role) ? "No replacement required" : "Select an active replacement"}</option>{availableClosureCandidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.fullName} · {readableNotificationRole(candidate.role)}</option>)}</select></label>
                            <button className="button button-reject" disabled={closureBusy}><Archive size={16} />{closureBusy ? "Sending…" : "Request account closure"}</button>
                        </form>}
            {closureRequests.filter((item) => !["REQUESTED", "BUSINESS_APPROVED", "PENDING_SYSTEM_ADMIN", "SCHEDULED"].includes(item.status)).slice(0, 3).map((item) => <div className="closure-history-row" key={item.id}><span><strong>{item.status.replaceAll("_", " ")}</strong><small>{item.decisionNote ?? item.reason}</small></span><time>{new Date(item.archivedAt ?? item.cancelledAt ?? item.requestedAt).toLocaleDateString("en-IN")}</time></div>)}
        </article>
        <article className="profile-security-note glass-panel"><Fingerprint size={21} /><span><strong>Private profile storage</strong><small>Profile pictures are virus-scanned and stored privately. Role identity stays locked; HR and Team Lead department changes only take effect after the required approval and an audited assignment decision.</small></span></article>
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function AccountLifecycleView({ role, userEmail, departments, employees }: {
    role: Role; userEmail: string; staffAccounts: StaffAccount[]; departments: Department[]; employees: Employee[];
}) {
    const [tab, setTab] = useState<"pending" | "active" | "archived">("pending");
    const [requests, setRequests] = useState<AccountClosureRequest[]>(() => !isBackendConfigured ? readDemoAccountClosures() : []);
    const [accounts, setAccounts] = useState<AccountLifecycleAccount[]>([]);
    const [archived, setArchived] = useState<ArchivedAccount[]>(() => !isBackendConfigured ? readDemoArchivedAccounts() : []);
    const [accountQuery, setAccountQuery] = useState("");
    const [accountRole, setAccountRole] = useState("ALL");
    const [accountDepartmentId, setAccountDepartmentId] = useState("");
    const [accountPage, setAccountPage] = useState(0);
    const [accountPageCount, setAccountPageCount] = useState(1);
    const [accountTotal, setAccountTotal] = useState(0);
    const [accountPageBusy, setAccountPageBusy] = useState(false);
    const [archivedQuery, setArchivedQuery] = useState("");
    const [archivedPage, setArchivedPage] = useState(0);
    const [archivedPageCount, setArchivedPageCount] = useState(1);
    const [archivedTotal, setArchivedTotal] = useState(0);
    const [archivedPageBusy, setArchivedPageBusy] = useState(false);
    const [replacements, setReplacements] = useState<Record<string, string>>({});
    const [candidateMap, setCandidateMap] = useState<Record<string, AccountClosureCandidate[]>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [directTargetId, setDirectTargetId] = useState("");
    const [archiveChallenge, setArchiveChallenge] = useState<DirectArchiveChallenge | null>(
        () => !isBackendConfigured ? readPreviewDirectArchiveChallenge() : null);
    const [archivePanelMinimized, setArchivePanelMinimized] = useState(false);
    const [recoveryTargetId, setRecoveryTargetId] = useState("");
    const [recoveryRole, setRecoveryRole] = useState("ROLE_MANAGER");
    const [recoveryDepartmentId, setRecoveryDepartmentId] = useState("");
    const [recoveryChallenge, setRecoveryChallenge] = useState<ArchivedRecoveryChallenge | null>(
        () => !isBackendConfigured ? readPreviewArchivedRecoveryChallenge() : null);
    const [recoveryPanelMinimized, setRecoveryPanelMinimized] = useState(false);
    const [challengeClock, setChallengeClock] = useState(() => Date.now());
    const [history, setHistory] = useState<AccountLifecycleRecord[]>([]);
    const [historyRequestId, setHistoryRequestId] = useState("");
    const directArchivePanelRef = useRef<HTMLElement>(null);
    const recoveryPanelRef = useRef<HTMLElement>(null);
    const accountPageSize = 25;

    const demoAccounts = useCallback((): AccountLifecycleAccount[] => {
        const currentEmployees = isBackendConfigured ? employees : readDemoEmployees();
        return readDemoAccounts()
            .filter((item) => item.status === "ACTIVE")
            .map((item) => {
                const employee = currentEmployees.find((value) => value.email.toLowerCase() === item.email.toLowerCase()
                    || Boolean(item.employeeId && (value.uuid ?? value.id) === item.employeeId));
                const department = departments.find((value) => value.id === employee?.departmentId)
                    ?? (item.role === "ROLE_HR_ADMIN" ? departments.find((value) => readDemoDepartmentHrAssignments()
                        .some((assignment) => assignment.active && assignment.departmentId === value.id && assignment.hrUserId === item.id)) : undefined)
                    ?? (item.role === "ROLE_MANAGER" ? departments.find((value) => readDemoManagerAssignments()
                        .some((assignment) => assignment.active && assignment.departmentId === value.id && assignment.managerUserId === item.id)) : undefined)
                    ?? (item.role === "ROLE_TEAM_LEAD" ? departments.find((value) => readDemoTeamLeadAssignments()
                        .some((assignment) => assignment.active && assignment.departmentId === value.id && assignment.teamLeadUserId === item.id)) : undefined);
                return { userId: item.id, fullName: item.fullName, email: item.email, role: item.role,
                    status: item.status, enabled: item.status === "ACTIVE", archived: false,
                    employeeId: item.employeeId ?? employee?.uuid ?? null, departmentId: department?.id ?? null,
                    departmentName: department?.name ?? null,
                    protectedAccount: ["ROLE_SYSTEM_ADMIN", "ROLE_CEO"].includes(item.role) };
            });
    }, [departments, employees]);

    const load = useCallback(async () => {
        setError("");
        try {
            if (isBackendConfigured) {
                if (role === "System Admin") {
                    const allRequests = await brainServeApi.accountClosureRequests();
                    setRequests(allRequests);
                    const candidateEntries = await Promise.all(allRequests.filter((item) => ["REQUESTED", "PENDING_SYSTEM_ADMIN"].includes(item.status))
                        .map(async (item) => [item.targetUserId, await brainServeApi.accountClosureCandidates(item.targetUserId)] as const));
                    setCandidateMap(Object.fromEntries(candidateEntries));
                } else {
                    const pending = await brainServeApi.businessPendingAccountClosures();
                    setRequests(pending);
                    const candidateEntries = await Promise.all(pending.map(async (item) =>
                        [item.targetUserId, await brainServeApi.accountClosureCandidates(item.targetUserId)] as const));
                    setCandidateMap(Object.fromEntries(candidateEntries));
                }
            } else {
                const all = readDemoAccountClosures();
                setRequests(role === "System Admin" ? all : all.filter((item) => item.status === "REQUESTED"
                    && (role === "CEO" ? ["ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(item.targetRole)
                        : ["ROLE_TEAM_LEAD", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(item.targetRole))));
            }
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Account lifecycle records could not be loaded."); }
    }, [role]);

    const loadAccountPage = useCallback(async () => {
        if (role !== "System Admin") return;
        if (accountRole === "ROLE_EMPLOYEE" && !accountDepartmentId) {
            setAccounts([]);
            setAccountPageCount(1);
            setAccountTotal(0);
            setAccountPageBusy(false);
            return;
        }
        setAccountPageBusy(true);
        try {
            if (isBackendConfigured) {
                const result = await brainServeApi.accountLifecycleAccountPage({
                    query: accountQuery, role: accountRole, departmentId: accountDepartmentId || undefined,
                    page: accountPage, size: accountPageSize,
                });
                const pageCount = Math.max(1, result.totalPages ?? 1);
                if (accountPage >= pageCount && accountPage > 0) {
                    setAccountPage(pageCount - 1);
                    return;
                }
                setAccounts(result.content);
                setAccountPageCount(pageCount);
                setAccountTotal(result.totalElements ?? result.content.length);
            } else {
                const query = accountQuery.trim().toLowerCase();
                const filtered = demoAccounts().filter((account) =>
                    (!query || `${account.fullName} ${account.email}`.toLowerCase().includes(query))
                    && (accountRole === "ALL" || account.role === accountRole)
                    && (!accountDepartmentId || account.departmentId === accountDepartmentId));
                const pageCount = Math.max(1, Math.ceil(filtered.length / accountPageSize));
                if (accountPage >= pageCount && accountPage > 0) {
                    setAccountPage(pageCount - 1);
                    return;
                }
                setAccounts(filtered.slice(accountPage * accountPageSize, (accountPage + 1) * accountPageSize));
                setAccountPageCount(pageCount);
                setAccountTotal(filtered.length);
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Operational accounts could not be loaded.");
        } finally { setAccountPageBusy(false); }
    }, [accountDepartmentId, accountPage, accountPageSize, accountQuery, accountRole, demoAccounts, role]);

    const loadArchivedPage = useCallback(async () => {
        if (role !== "System Admin") return;
        setArchivedPageBusy(true);
        try {
            if (isBackendConfigured) {
                const result = await brainServeApi.archivedAccountPage({
                    query: archivedQuery, page: archivedPage, size: accountPageSize,
                });
                const pageCount = Math.max(1, result.totalPages ?? 1);
                if (archivedPage >= pageCount && archivedPage > 0) {
                    setArchivedPage(pageCount - 1);
                    return;
                }
                setArchived(result.content);
                setArchivedPageCount(pageCount);
                setArchivedTotal(result.totalElements ?? result.content.length);
            } else {
                const query = archivedQuery.trim().toLowerCase();
                const filtered = readDemoArchivedAccounts().filter((account) =>
                    !query || `${account.fullName} ${account.email} ${account.role} ${account.departmentName ?? ""}`
                        .toLowerCase().includes(query));
                const pageCount = Math.max(1, Math.ceil(filtered.length / accountPageSize));
                if (archivedPage >= pageCount && archivedPage > 0) {
                    setArchivedPage(pageCount - 1);
                    return;
                }
                setArchived(filtered.slice(archivedPage * accountPageSize, (archivedPage + 1) * accountPageSize));
                setArchivedPageCount(pageCount);
                setArchivedTotal(filtered.length);
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Archived accounts could not be loaded.");
        } finally { setArchivedPageBusy(false); }
    }, [accountPageSize, archivedPage, archivedQuery, role]);

    useEffect(() => { Promise.resolve().then(load); }, [load]);
    useEffect(() => {
        const timer = window.setTimeout(() => { void loadAccountPage(); }, 250);
        return () => window.clearTimeout(timer);
    }, [loadAccountPage]);
    useEffect(() => {
        if (role !== "System Admin" || isBackendConfigured) return;
        const refreshDirectory = () => { void loadAccountPage(); };
        const refreshFromStorage = (event: StorageEvent) => {
            if (!event.key || event.key === DEMO_ACCOUNTS_KEY) refreshDirectory();
        };
        window.addEventListener("brainserve:demo-accounts-updated", refreshDirectory);
        window.addEventListener("storage", refreshFromStorage);
        window.addEventListener("focus", refreshDirectory);
        return () => {
            window.removeEventListener("brainserve:demo-accounts-updated", refreshDirectory);
            window.removeEventListener("storage", refreshFromStorage);
            window.removeEventListener("focus", refreshDirectory);
        };
    }, [loadAccountPage, role]);
    useEffect(() => {
        const timer = window.setTimeout(() => { void loadArchivedPage(); }, 250);
        return () => window.clearTimeout(timer);
    }, [loadArchivedPage]);
    useEffect(() => {
        if (role !== "System Admin" || !isBackendConfigured) return;
        let active = true;
        void brainServeApi.activeDirectArchiveChallenge()
            .then((challenge) => {
                if (!active || !challenge) return;
                setArchiveChallenge(challenge);
                setDirectTargetId(challenge.targetUserId);
                setArchivePanelMinimized(true);
            })
            .catch((reason) => {
                if (active && !(reason instanceof ApiError && reason.status === 404)) {
                    setError(reason instanceof Error ? reason.message : "Archive verification could not be restored.");
                }
            });
        return () => { active = false; };
    }, [role]);
    useEffect(() => {
        if (role !== "System Admin" || !isBackendConfigured) return;
        let active = true;
        void brainServeApi.activeArchivedRecoveryChallenge()
            .then((challenge) => {
                if (!active || !challenge) return;
                setRecoveryChallenge(challenge);
                setRecoveryTargetId(challenge.archivedAccountId);
                setRecoveryRole(challenge.targetRole);
                setRecoveryDepartmentId(challenge.targetDepartmentId ?? "");
                setRecoveryPanelMinimized(true);
            })
            .catch((reason) => {
                if (active && !(reason instanceof ApiError && reason.status === 404)) {
                    setError(reason instanceof Error ? reason.message : "Account recovery verification could not be restored.");
                }
            });
        return () => { active = false; };
    }, [role]);
    useEffect(() => {
        if (!archiveChallenge) return;
        const timer = window.setInterval(() => {
            const now = Date.now();
            setChallengeClock(now);
            if (now >= Date.parse(archiveChallenge.expiresAt)) {
                if (!isBackendConfigured) writePreviewDirectArchiveChallenge(null);
                setArchiveChallenge(null);
                setDirectTargetId("");
                setArchivePanelMinimized(false);
                setError("The account archive confirmation code expired. Start the verification again.");
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, [archiveChallenge]);
    useEffect(() => {
        if (!recoveryChallenge) return;
        const timer = window.setInterval(() => {
            const now = Date.now();
            setChallengeClock(now);
            if (now >= Date.parse(recoveryChallenge.expiresAt)) {
                if (!isBackendConfigured) writePreviewArchivedRecoveryChallenge(null);
                setRecoveryChallenge(null);
                setRecoveryTargetId("");
                setRecoveryPanelMinimized(false);
                setError("The account recovery code expired. Start the verification again.");
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, [recoveryChallenge]);
    useEffect(() => {
        if ((!directTargetId && !archiveChallenge) || archivePanelMinimized) return;
        window.requestAnimationFrame(() => {
            directArchivePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            directArchivePanelRef.current?.querySelector<HTMLElement>("textarea, input, button")?.focus();
        });
    }, [archiveChallenge, archivePanelMinimized, directTargetId]);
    useEffect(() => {
        if ((!recoveryTargetId && !recoveryChallenge) || recoveryPanelMinimized) return;
        window.requestAnimationFrame(() => {
            recoveryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            recoveryPanelRef.current?.querySelector<HTMLElement>("textarea, select, input, button")?.focus();
        });
    }, [recoveryChallenge, recoveryPanelMinimized, recoveryTargetId]);

    const candidatesFor = (target: AccountClosureRequest | AccountLifecycleAccount) => {
        const targetId = "targetUserId" in target ? target.targetUserId : target.userId;
        if (isBackendConfigured && candidateMap[targetId]) return candidateMap[targetId];
        const all = isBackendConfigured ? accounts : demoAccounts();
        const targetRole = "targetRole" in target ? target.targetRole : target.role;
        if (targetRole === "ROLE_TEAM_LEAD") {
            const departmentId = target.departmentId;
            return all.filter((item) => item.enabled && item.role === "ROLE_EMPLOYEE" && item.departmentId === departmentId
                && item.userId !== ("targetUserId" in target ? target.targetUserId : target.userId));
        }
        return all.filter((item) => item.enabled && item.role === targetRole && item.userId !== targetId)
            .filter((item) => isBackendConfigured || targetRole !== "ROLE_HR_ADMIN" || !readDemoDepartmentHrAssignments()
                .some((assignment) => assignment.active && assignment.hrUserId === item.userId));
    };

    const openDirectAccount = async (account: AccountLifecycleAccount) => {
        setError(""); setMessage("");
        if (recoveryChallenge) {
            setError(`Finish or cancel the active recovery verification for ${recoveryChallenge.targetName} first.`);
            return;
        }
        if (archiveChallenge) {
            if (archiveChallenge.targetUserId !== account.userId) {
                setError(`Finish or cancel the active archive verification for ${archiveChallenge.targetName} first.`);
                return;
            }
            setDirectTargetId(account.userId);
            setArchivePanelMinimized(false);
            return;
        }
        setDirectTargetId(account.userId);
        setArchivePanelMinimized(false);
        if (!isBackendConfigured) return;
        try {
            const candidates = await brainServeApi.accountClosureCandidates(account.userId);
            setCandidateMap((items) => ({ ...items, [account.userId]: candidates }));
        } catch (reason) {
            setDirectTargetId("");
            setError(reason instanceof Error ? reason.message : "Replacement candidates could not be loaded.");
        }
    };

    const businessDecision = async (request: AccountClosureRequest, decision: "approve" | "reject") => {
        setBusyId(request.id); setError(""); setMessage("");
        const replacementUserId = replacements[request.id] || request.replacementUserId || null;
        const note = notes[request.id]?.trim() || (decision === "approve" ? "Business responsibilities reviewed" : "Closure request rejected by business owner");
        try {
            let updated: AccountClosureRequest;
            if (isBackendConfigured) updated = await brainServeApi.decideBusinessAccountClosure(request.id, decision, replacementUserId, note);
            else {
                if (decision === "approve" && !["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(request.targetRole) && !replacementUserId) {
                    fail("Select an active replacement before approval.");
                }
                const now = new Date().toISOString();
                updated = decision === "approve" ? { ...request, replacementUserId,
                        replacementName: candidatesFor(request).find((item) => item.userId === replacementUserId)?.fullName ?? request.replacementName,
                        status: "PENDING_SYSTEM_ADMIN", businessApproverUserId: userEmail,
                        businessApprovedAt: now, decisionNote: note }
                    : { ...request, status: "REJECTED", businessApproverUserId: userEmail,
                        businessApprovedAt: null, decisionNote: note };
                writeDemoAccountClosures(readDemoAccountClosures().map((item) => item.id === updated.id ? updated : item));
                if (decision === "approve") {
                    recordDemoClosureTransition({ ...updated, status: "BUSINESS_APPROVED" }, "ACCOUNT_CLOSURE_BUSINESS_APPROVED",
                        request.status, userEmail, "Business owner approved account closure");
                    recordDemoClosureTransition(updated, "ACCOUNT_CLOSURE_PENDING_SYSTEM_ADMIN", "BUSINESS_APPROVED",
                        userEmail, "Account closure forwarded to System Admin");
                } else recordDemoClosureTransition(updated, "ACCOUNT_CLOSURE_REJECTED", request.status, userEmail,
                    "Business owner rejected account closure");
            }
            setRequests((items) => items.filter((item) => item.id !== request.id));
            setMessage(decision === "approve" ? "Request forwarded to System Admin for final action." : "Closure request rejected.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The lifecycle decision failed."); }
        finally { setBusyId(""); }
    };

    const archiveDemoAccount = (request: AccountClosureRequest, actor: string) => {
        const account = demoAccounts().find((item) => item.userId === request.targetUserId);
        if (!account) fail("The target account could not be found.");
        const archivedAt = new Date().toISOString();
        const snapshot: ArchivedAccount = { id: newClientId(), originalUserId: account.userId,
            fullName: account.fullName, email: account.email, role: account.role,
            departmentId: account.departmentId, departmentName: account.departmentName,
            employeeId: account.employeeId, employeeNumber: employees.find((item) => item.uuid === account.employeeId)?.id ?? null,
            previousStatus: account.status, reason: request.reason, closureRequestId: request.id,
            archivedByUserId: actor, archivedAt,
            retentionUntil: `${new Date().getFullYear() + 7}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}` };
        writeDemoArchivedAccounts([snapshot, ...readDemoArchivedAccounts()]);
        writeDemoAccounts(readDemoAccounts().map((item) => item.id === account.userId
            ? { ...item, status: "DISABLED" } : item));
        return { ...request, status: "ARCHIVED" as const, archivedAt };
    };

    const systemDecision = async (request: AccountClosureRequest, decision: "approve" | "reject") => {
        setBusyId(request.id); setError(""); setMessage("");
        const replacementUserId = replacements[request.id] || request.replacementUserId || null;
        const note = notes[request.id]?.trim() || (decision === "approve" ? "System Admin compliance review completed" : "System Admin rejected closure");
        try {
            let updated: AccountClosureRequest;
            if (isBackendConfigured) updated = await brainServeApi.decideSystemAdminAccountClosure(request.id, decision, replacementUserId, note);
            else {
                if (decision === "approve" && !["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(request.targetRole) && !replacementUserId) {
                    fail("Select an active replacement before final archival.");
                }
                if (decision === "reject") updated = { ...request, status: "REJECTED", decisionNote: note,
                    systemAdminApproverUserId: SYSTEM_ADMIN_EMAIL, systemAdminApprovedAt: null };
                else if (request.requestedEffectiveDate > officeToday()) updated = { ...request, replacementUserId,
                    replacementName: candidatesFor(request).find((item) => item.userId === replacementUserId)?.fullName ?? request.replacementName,
                    status: "SCHEDULED", decisionNote: note, systemAdminApproverUserId: SYSTEM_ADMIN_EMAIL,
                    systemAdminApprovedAt: new Date().toISOString(), scheduledAt: new Date().toISOString() };
                else updated = archiveDemoAccount({ ...request, replacementUserId,
                        replacementName: candidatesFor(request).find((item) => item.userId === replacementUserId)?.fullName ?? request.replacementName,
                        systemAdminApproverUserId: SYSTEM_ADMIN_EMAIL, systemAdminApprovedAt: new Date().toISOString() }, SYSTEM_ADMIN_EMAIL);
                writeDemoAccountClosures(readDemoAccountClosures().map((item) => item.id === updated.id ? updated : item));
                recordDemoClosureTransition(updated, `ACCOUNT_CLOSURE_${updated.status}`, request.status, SYSTEM_ADMIN_EMAIL,
                    updated.status === "ARCHIVED" ? "Login disabled, sessions revoked and immutable snapshot retained"
                        : updated.status === "SCHEDULED" ? "System Admin approved and scheduled account archival" : "System Admin rejected account closure");
            }
            setMessage(updated.status === "ARCHIVED" ? "Account deactivated and archived. Historical records remain available."
                : updated.status === "SCHEDULED" ? "Account closure scheduled." : "Account closure rejected.");
            await Promise.all([load(), loadAccountPage(), loadArchivedPage()]);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The System Admin decision failed."); }
        finally { setBusyId(""); }
    };

    const showHistory = async (request: AccountClosureRequest) => {
        setHistoryRequestId(request.id);
        try { setHistory(isBackendConfigured ? await brainServeApi.accountClosureHistory(request.id)
            : readDemoAccountLifecycle().filter((item) => item.closureRequestId === request.id)
                .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Lifecycle history could not be loaded."); }
    };

    const selectedDirectTarget = accounts.find((item) => item.userId === directTargetId);
    const directTarget: AccountLifecycleAccount | undefined = selectedDirectTarget ?? (archiveChallenge ? {
        userId: archiveChallenge.targetUserId,
        fullName: archiveChallenge.targetName,
        email: archiveChallenge.targetEmail,
        role: archiveChallenge.targetRole,
        status: "ACTIVE",
        enabled: true,
        archived: false,
        employeeId: null,
        departmentId: archiveChallenge.departmentId,
        departmentName: archiveChallenge.departmentName,
        protectedAccount: false,
    } : undefined);
    const archiveSecondsRemaining = archiveChallenge
        ? Math.max(0, Math.ceil((Date.parse(archiveChallenge.expiresAt) - challengeClock) / 1000)) : 0;
    const archiveResendSeconds = archiveChallenge
        ? Math.max(0, Math.ceil((Date.parse(archiveChallenge.resendAvailableAt) - challengeClock) / 1000)) : 0;
    const archiveTimeRemaining = `${Math.floor(archiveSecondsRemaining / 60)}:${String(
        archiveSecondsRemaining % 60).padStart(2, "0")}`;

    const directArchive = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); if (!directTarget) return;
        const form = event.currentTarget; const data = new FormData(form); setBusyId("direct"); setError(""); setMessage("");
        try {
            if (!archiveChallenge) {
                const currentPassword = String(data.get("currentPassword") ?? "");
                const replacementUserId = String(data.get("replacementUserId") ?? "") || null;
                const reason = String(data.get("reason") ?? "").trim();
                let challenge: DirectArchiveChallenge;
                if (isBackendConfigured) {
                    challenge = await brainServeApi.requestDirectArchiveOtp(
                        directTarget.userId, currentPassword, reason, replacementUserId);
                } else {
                    if (!await verifyPreviewSystemAdminPassword(userEmail, currentPassword)) {
                        const attemptsRemaining = previewArchivePasswordFailure();
                        fail(attemptsRemaining === 0
                            ? "Too many incorrect password attempts. Try again later."
                            : `Current System Admin password is incorrect. ${attemptsRemaining} attempts remain.`);
                    }
                    clearPreviewArchivePasswordFailures();
                    const createdAt = new Date();
                    challenge = {
                        challengeId: newClientId(),
                        targetUserId: directTarget.userId,
                        targetName: directTarget.fullName,
                        targetEmail: directTarget.email,
                        targetRole: directTarget.role,
                        departmentId: directTarget.departmentId,
                        departmentName: directTarget.departmentName,
                        reason,
                        replacementUserId,
                        replacementName: candidatesFor(directTarget)
                            .find((item) => item.userId === replacementUserId)?.fullName ?? null,
                        createdAt: createdAt.toISOString(),
                        expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
                        resendAvailableAt: new Date(createdAt.getTime() + 60_000).toISOString(),
                        attemptsRemaining: 5,
                    };
                    writePreviewDirectArchiveChallenge(challenge);
                }
                form.reset();
                setArchiveChallenge(challenge);
                setChallengeClock(Date.parse(challenge.createdAt));
                setMessage("System Admin password verified. A one-time confirmation code was sent; you can minimize this section while checking it.");
            } else {
                const otp = String(data.get("otp") ?? "");
                if (isBackendConfigured) await brainServeApi.directArchiveAccount(archiveChallenge.challengeId, otp);
                else if (!previewOtpIsValid(otp)) {
                    const attemptsRemaining = archiveChallenge.attemptsRemaining - 1;
                    if (attemptsRemaining <= 0) {
                        writePreviewDirectArchiveChallenge(null);
                        setArchiveChallenge(null); setDirectTargetId("");
                        fail("The verification was cancelled after too many incorrect codes.");
                    }
                    const updated = { ...archiveChallenge, attemptsRemaining };
                    writePreviewDirectArchiveChallenge(updated);
                    setArchiveChallenge(updated);
                    fail(`The confirmation code is incorrect. ${attemptsRemaining} attempts remain.`);
                } else {
                    const now = new Date().toISOString();
                    const request: AccountClosureRequest = { id: newClientId(), targetUserId: directTarget.userId,
                        targetName: directTarget.fullName, targetEmail: directTarget.email, targetRole: directTarget.role,
                        employeeId: directTarget.employeeId, departmentId: directTarget.departmentId,
                        departmentName: directTarget.departmentName, requesterUserId: SYSTEM_ADMIN_EMAIL,
                        origin: "SYSTEM_ADMIN_EMERGENCY", reason: archiveChallenge.reason,
                        requestedEffectiveDate: officeToday(), replacementUserId: archiveChallenge.replacementUserId,
                        replacementName: archiveChallenge.replacementName,
                        status: "REQUESTED", requestedAt: now, businessApproverUserId: null, businessApprovedAt: null,
                        systemAdminApproverUserId: SYSTEM_ADMIN_EMAIL, systemAdminApprovedAt: now, decisionNote: "Emergency direct archive",
                        scheduledAt: null, archivedAt: null, cancelledAt: null };
                    const archivedRequest = archiveDemoAccount(request, SYSTEM_ADMIN_EMAIL);
                    writeDemoAccountClosures([archivedRequest, ...readDemoAccountClosures()]);
                    recordDemoClosureTransition(archivedRequest, "ACCOUNT_CLOSURE_ARCHIVED", "REQUESTED", SYSTEM_ADMIN_EMAIL,
                        "Emergency archive confirmed by System Admin password and OTP; sessions revoked");
                }
                writePreviewDirectArchiveChallenge(null);
                setDirectTargetId(""); setArchiveChallenge(null); setArchivePanelMinimized(false); form.reset();
                setMessage("Account deactivated and archived. Historical records remain available.");
                await Promise.all([load(), loadAccountPage(), loadArchivedPage()]);
            }
        } catch (reasonValue) {
            const archiveErrorCode = reasonValue instanceof ApiError ? reasonValue.problem.errorCode : undefined;
            if (["ACCOUNT_ARCHIVE_OTP_ATTEMPTS_EXHAUSTED", "ACCOUNT_ARCHIVE_CHALLENGE_EXPIRED",
                "ACCOUNT_ARCHIVE_CHALLENGE_STALE"].includes(archiveErrorCode ?? "")) {
                writePreviewDirectArchiveChallenge(null);
                setArchiveChallenge(null); setDirectTargetId(""); setArchivePanelMinimized(false);
            } else if (isBackendConfigured && archiveErrorCode === "INVALID_OTP") {
                const refreshed = await brainServeApi.activeDirectArchiveChallenge().catch(() => undefined);
                if (refreshed) setArchiveChallenge(refreshed);
            }
            setError(reasonValue instanceof Error ? reasonValue.message : "Direct archival failed.");
        }
        finally { setBusyId(""); }
    };

    const resendDirectArchiveOtp = async () => {
        if (!archiveChallenge || archiveResendSeconds > 0) return;
        setBusyId("direct-resend"); setError(""); setMessage("");
        try {
            let challenge: DirectArchiveChallenge;
            if (isBackendConfigured) {
                challenge = await brainServeApi.resendDirectArchiveOtp(archiveChallenge.challengeId);
            } else {
                const now = Date.now();
                challenge = { ...archiveChallenge, expiresAt: new Date(now + 10 * 60_000).toISOString(),
                    resendAvailableAt: new Date(now + 60_000).toISOString(), attemptsRemaining: 5 };
                writePreviewDirectArchiveChallenge(challenge);
            }
            setArchiveChallenge(challenge);
            setChallengeClock(Date.parse(challenge.resendAvailableAt) - 60_000);
            setMessage("A new confirmation code was sent to the System Admin mailbox.");
        } catch (reasonValue) {
            setError(reasonValue instanceof Error ? reasonValue.message : "The confirmation code could not be resent.");
        } finally { setBusyId(""); }
    };

    const cancelDirectArchive = async () => {
        if (busyId) return;
        setBusyId("direct-cancel"); setError(""); setMessage("");
        try {
            if (archiveChallenge && isBackendConfigured) {
                await brainServeApi.cancelDirectArchiveChallenge(archiveChallenge.challengeId);
            }
            writePreviewDirectArchiveChallenge(null);
            setArchiveChallenge(null);
            setDirectTargetId("");
            setArchivePanelMinimized(false);
            setMessage(archiveChallenge ? "Archive verification cancelled. No account changes were made." : "");
        } catch (reasonValue) {
            if (reasonValue instanceof ApiError && [404, 410].includes(reasonValue.status)) {
                writePreviewDirectArchiveChallenge(null);
                setArchiveChallenge(null); setDirectTargetId(""); setArchivePanelMinimized(false);
                setMessage("The expired archive verification was cleared. No account changes were made.");
                return;
            }
            setError(reasonValue instanceof Error ? reasonValue.message : "Archive verification could not be cancelled.");
        } finally { setBusyId(""); }
    };

    const selectedRecoveryTarget = archived.find((item) => item.id === recoveryTargetId);
    const recoveryTarget: ArchivedAccount | undefined = selectedRecoveryTarget ?? (recoveryChallenge ? {
        id: recoveryChallenge.archivedAccountId,
        originalUserId: recoveryChallenge.targetUserId,
        fullName: recoveryChallenge.targetName,
        email: recoveryChallenge.targetEmail,
        role: recoveryChallenge.previousRole,
        departmentId: recoveryChallenge.previousDepartmentId,
        departmentName: recoveryChallenge.previousDepartmentName,
        employeeId: recoveryChallenge.employeeId,
        employeeNumber: null,
        previousStatus: "ACTIVE",
        reason: recoveryChallenge.reason,
        closureRequestId: "",
        archivedByUserId: "",
        archivedAt: recoveryChallenge.createdAt,
        retentionUntil: "",
    } : undefined);
    const recoveryNeedsDepartment = !["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(
        recoveryChallenge?.targetRole ?? recoveryRole);
    const recoverySecondsRemaining = recoveryChallenge
        ? Math.max(0, Math.ceil((Date.parse(recoveryChallenge.expiresAt) - challengeClock) / 1000)) : 0;
    const recoveryResendSeconds = recoveryChallenge
        ? Math.max(0, Math.ceil((Date.parse(recoveryChallenge.resendAvailableAt) - challengeClock) / 1000)) : 0;
    const recoveryTimeRemaining = `${Math.floor(recoverySecondsRemaining / 60)}:${String(
        recoverySecondsRemaining % 60).padStart(2, "0")}`;

    const openArchivedRecovery = (account: ArchivedAccount) => {
        setError(""); setMessage("");
        if (archiveChallenge) {
            setError(`Finish or cancel the active archive verification for ${archiveChallenge.targetName} first.`);
            return;
        }
        if (recoveryChallenge) {
            if (recoveryChallenge.archivedAccountId !== account.id) {
                setError(`Finish or cancel the active recovery verification for ${recoveryChallenge.targetName} first.`);
                return;
            }
            setRecoveryTargetId(account.id);
            setRecoveryPanelMinimized(false);
            return;
        }
        const sameRole = ["ROLE_CEO", "ROLE_MANAGER", "ROLE_HR_ADMIN", "ROLE_TEAM_LEAD",
            "ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(account.role)
            ? account.role : "ROLE_EMPLOYEE";
        const activeCeoExists = readDemoAccounts().some((item) => item.status === "ACTIVE"
            && item.role === "ROLE_CEO" && item.id !== account.originalUserId);
        const nextRole = sameRole === "ROLE_CEO" && activeCeoExists ? "ROLE_MANAGER" : sameRole;
        setRecoveryRole(nextRole);
        setRecoveryDepartmentId(["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(nextRole)
            ? "" : account.departmentId ?? "");
        setRecoveryTargetId(account.id);
        setRecoveryPanelMinimized(false);
    };

    const validatePreviewRecovery = (account: ArchivedAccount, targetRole: string,
                                     departmentId: string | null) => {
        const currentAccount = readDemoAccounts().find((item) => item.id === account.originalUserId);
        if (!currentAccount || currentAccount.status === "ACTIVE") {
            fail("The linked identity is no longer archived. Refresh the directory.");
        }
        if (!["ROLE_CEO", "ROLE_MANAGER", "ROLE_HR_ADMIN", "ROLE_TEAM_LEAD", "ROLE_EMPLOYEE",
            "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(targetRole)) {
            fail("Select one supported recovery role.");
        }
        const employeeRole = !["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(targetRole);
        if (employeeRole && !currentAccount.employeeId) {
            fail("This role requires the archived account's existing employee ID.");
        }
        if (employeeRole && !departmentId) fail("Select an active department.");
        if (!employeeRole && departmentId) {
            fail("Receptionist and Security recovery remain company-wide.");
        }
        if (departmentId && !departments.some((item) => item.id === departmentId && item.active)) {
            fail("Select an active department.");
        }
        if (targetRole === "ROLE_CEO" && readDemoAccounts().some((item) => item.id !== currentAccount.id
            && item.status === "ACTIVE" && item.role === "ROLE_CEO")) {
            fail("The company already has an active CEO. Select another role for this recovery.");
        }
        const occupied = targetRole === "ROLE_MANAGER"
            ? readDemoManagerAssignments().some((item) => item.active && item.departmentId === departmentId
                && item.managerUserId !== currentAccount.id)
            : targetRole === "ROLE_HR_ADMIN"
                ? readDemoDepartmentHrAssignments().some((item) => item.active && item.departmentId === departmentId
                    && item.hrUserId !== currentAccount.id)
                : targetRole === "ROLE_TEAM_LEAD"
                    ? readDemoTeamLeadAssignments().some((item) => item.active && item.departmentId === departmentId
                        && item.teamLeadUserId !== currentAccount.id)
                    : false;
        if (occupied) {
            fail(`The selected department already has an active ${statusLabel(targetRole)}.`);
        }
        return currentAccount;
    };

    const recoverPreviewAccount = (challenge: ArchivedRecoveryChallenge) => {
        const account = readDemoArchivedAccounts().find((item) => item.id === challenge.archivedAccountId);
        if (!account) fail("The archived account record could not be found.");
        const currentAccount = validatePreviewRecovery(account, challenge.targetRole,
            challenge.targetDepartmentId);
        const now = new Date().toISOString();
        const department = challenge.targetDepartmentId
            ? departments.find((item) => item.id === challenge.targetDepartmentId) : undefined;
        let teamLeads = readDemoTeamLeadAssignments();
        let departmentHrs = readDemoDepartmentHrAssignments();
        let managers = readDemoManagerAssignments();
        const sameTeamLead = challenge.targetRole === "ROLE_TEAM_LEAD" && teamLeads.some((item) =>
            item.active && item.teamLeadUserId === currentAccount.id
            && item.departmentId === challenge.targetDepartmentId);
        const sameHr = challenge.targetRole === "ROLE_HR_ADMIN" && departmentHrs.some((item) =>
            item.active && item.hrUserId === currentAccount.id
            && item.departmentId === challenge.targetDepartmentId);
        const sameManager = challenge.targetRole === "ROLE_MANAGER" && managers.some((item) =>
            item.active && item.managerUserId === currentAccount.id
            && item.departmentId === challenge.targetDepartmentId);
        teamLeads = teamLeads.map((item) => item.active && item.teamLeadUserId === currentAccount.id
        && !(sameTeamLead && item.departmentId === challenge.targetDepartmentId)
            ? { ...item, active: false, endedByUserId: DEMO_SYSTEM_ADMIN.id, endedAt: now } : item);
        departmentHrs = departmentHrs.map((item) => item.active && item.hrUserId === currentAccount.id
        && !(sameHr && item.departmentId === challenge.targetDepartmentId)
            ? { ...item, active: false, endedByUserId: DEMO_SYSTEM_ADMIN.id, endedAt: now } : item);
        managers = managers.map((item) => item.active && item.managerUserId === currentAccount.id
        && !(sameManager && item.departmentId === challenge.targetDepartmentId)
            ? { ...item, active: false, endedByUserId: DEMO_SYSTEM_ADMIN.id, endedAt: now } : item);
        if (challenge.targetRole === "ROLE_TEAM_LEAD" && !sameTeamLead) {
            teamLeads = [{ id: newClientId(), departmentId: challenge.targetDepartmentId!,
                teamLeadUserId: currentAccount.id, teamLeadEmployeeId: currentAccount.employeeId!,
                active: true, assignedByUserId: DEMO_SYSTEM_ADMIN.id, assignedAt: now,
                endedByUserId: null, endedAt: null }, ...teamLeads];
        } else if (challenge.targetRole === "ROLE_HR_ADMIN" && !sameHr) {
            departmentHrs = [{ id: newClientId(), departmentId: challenge.targetDepartmentId!,
                hrUserId: currentAccount.id, hrEmployeeId: currentAccount.employeeId!,
                active: true, assignedByUserId: DEMO_SYSTEM_ADMIN.id, assignedAt: now,
                endedByUserId: null, endedAt: null }, ...departmentHrs];
        } else if (challenge.targetRole === "ROLE_MANAGER" && !sameManager) {
            managers = [{ id: newClientId(), departmentId: challenge.targetDepartmentId!,
                managerUserId: currentAccount.id, managerEmployeeId: currentAccount.employeeId!,
                active: true, assignedByUserId: DEMO_SYSTEM_ADMIN.id, assignedAt: now,
                endedByUserId: null, endedAt: null }, ...managers];
        }
        const designation = challenge.targetRole === "ROLE_CEO" ? "Chief Executive Officer"
            : challenge.targetRole === "ROLE_MANAGER" ? "Department Manager"
                : challenge.targetRole === "ROLE_HR_ADMIN" ? "HR Business Partner"
                    : challenge.targetRole === "ROLE_TEAM_LEAD" ? "Team Lead"
                        : challenge.targetRole === "ROLE_EMPLOYEE" ? "Employee" : null;
        const nextEmployees = readDemoEmployees().map((item) =>
            currentAccount.employeeId && (item.uuid ?? item.id) === currentAccount.employeeId
                ? { ...item, ...(department ? { departmentId: department.id, department: department.name } : {}),
                    ...(designation ? { role: designation } : {}), status: "Active" as const } : item);
        const nextAccounts = readDemoAccounts().map((item) => item.id === currentAccount.id
            ? { ...item, role: challenge.targetRole, status: "ACTIVE", rejectedAt: null } : item);
        const lifecycleRecord: AccountLifecycleRecord = {
            id: newClientId(), closureRequestId: account.closureRequestId,
            targetUserId: currentAccount.id, eventType: "ACCOUNT_RECOVERED",
            fromStatus: "ARCHIVED", toStatus: "ACTIVE", actorUserId: DEMO_SYSTEM_ADMIN.id,
            detail: `Recovered with the same user and employee IDs; current role ${statusLabel(
                challenge.targetRole)}; current department ${department?.name ?? "Company-wide"}; previous role and department retained in audit history`,
            occurredAt: now,
        };
        const essentialLog: EssentialLogRecord = {
            id: newClientId(), category: "ACCOUNT_LIFECYCLE", eventType: "ARCHIVED_ACCOUNT_RECOVERED",
            subjectType: "USER_ACCOUNT", subjectId: currentAccount.id, referenceId: account.closureRequestId,
            actorUserId: DEMO_SYSTEM_ADMIN.id, approverUserId: DEMO_SYSTEM_ADMIN.id, status: "ACTIVE",
            title: `Recovered ${account.fullName}`, detail: lifecycleRecord.detail, occurredAt: now,
        };
        // All next states are validated before these writes. The account write is
        // last because it invalidates stale preview sessions across open tabs.
        writeDemoTeamLeadAssignments(teamLeads);
        writeDemoDepartmentHrAssignments(departmentHrs);
        writeDemoManagerAssignments(managers);
        writeDemoEmployees(nextEmployees);
        writeDemoArchivedAccounts(readDemoArchivedAccounts().filter((item) => item.id !== account.id));
        writeDemoAccountLifecycle([lifecycleRecord, ...readDemoAccountLifecycle()]);
        writeDemoEssentialLogs([essentialLog, ...readDemoEssentialLogs()]);
        writeDemoAccounts(nextAccounts);
    };

    const recoverArchived = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!recoveryTarget) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusyId("recovery"); setError(""); setMessage("");
        try {
            if (!recoveryChallenge) {
                const targetRole = recoveryRole;
                const departmentId = recoveryNeedsDepartment ? recoveryDepartmentId || null : null;
                const reason = String(data.get("reason") ?? "").trim();
                const currentPassword = String(data.get("currentPassword") ?? "");
                let challenge: ArchivedRecoveryChallenge;
                if (isBackendConfigured) {
                    challenge = await brainServeApi.requestArchivedRecoveryOtp({
                        archivedAccountId: recoveryTarget.id, targetRole, departmentId, currentPassword, reason,
                    });
                } else {
                    if (!await verifyPreviewSystemAdminPassword(userEmail, currentPassword)) {
                        const attemptsRemaining = previewArchivePasswordFailure();
                        fail(attemptsRemaining === 0
                            ? "Too many incorrect password attempts. Try again later."
                            : `Current System Admin password is incorrect. ${attemptsRemaining} attempts remain.`);
                    }
                    clearPreviewArchivePasswordFailures();
                    const currentAccount = validatePreviewRecovery(recoveryTarget, targetRole, departmentId);
                    const employee = readDemoEmployees().find((item) =>
                        currentAccount.employeeId && (item.uuid ?? item.id) === currentAccount.employeeId);
                    const createdAt = new Date();
                    const targetDepartment = departments.find((item) => item.id === departmentId);
                    challenge = {
                        challengeId: newClientId(), archivedAccountId: recoveryTarget.id,
                        targetUserId: currentAccount.id, targetName: currentAccount.fullName,
                        targetEmail: currentAccount.email, employeeId: currentAccount.employeeId ?? null,
                        previousRole: currentAccount.role,
                        previousDepartmentId: employee?.departmentId ?? recoveryTarget.departmentId,
                        previousDepartmentName: employee?.department ?? recoveryTarget.departmentName,
                        targetRole, targetDepartmentId: departmentId,
                        targetDepartmentName: targetDepartment?.name ?? null, reason,
                        createdAt: createdAt.toISOString(),
                        expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
                        resendAvailableAt: new Date(createdAt.getTime() + 60_000).toISOString(),
                        attemptsRemaining: 5,
                    };
                    writePreviewArchivedRecoveryChallenge(challenge);
                }
                form.reset();
                setRecoveryChallenge(challenge);
                setRecoveryRole(challenge.targetRole);
                setRecoveryDepartmentId(challenge.targetDepartmentId ?? "");
                setChallengeClock(Date.parse(challenge.createdAt));
                setMessage("System Admin password verified. A recovery code was sent; you can minimize this section while checking it.");
            } else {
                const otp = String(data.get("otp") ?? "");
                if (isBackendConfigured) {
                    await brainServeApi.recoverArchivedAccount(recoveryChallenge.challengeId, otp);
                } else if (!previewOtpIsValid(otp)) {
                    const attemptsRemaining = recoveryChallenge.attemptsRemaining - 1;
                    if (attemptsRemaining <= 0) {
                        writePreviewArchivedRecoveryChallenge(null);
                        setRecoveryChallenge(null); setRecoveryTargetId("");
                        fail("The recovery verification was cancelled after too many incorrect codes.");
                    }
                    const updated = { ...recoveryChallenge, attemptsRemaining };
                    writePreviewArchivedRecoveryChallenge(updated);
                    setRecoveryChallenge(updated);
                    fail(`The recovery code is incorrect. ${attemptsRemaining} attempts remain.`);
                } else {
                    recoverPreviewAccount(recoveryChallenge);
                }
                writePreviewArchivedRecoveryChallenge(null);
                setRecoveryChallenge(null); setRecoveryTargetId(""); setRecoveryPanelMinimized(false);
                form.reset();
                setMessage(`${recoveryTarget.fullName} recovered with the same employee ID and the current ${statusLabel(
                    recoveryChallenge.targetRole)} role. Previous access remains only in audit history.`);
                await Promise.all([load(), loadAccountPage(), loadArchivedPage()]);
            }
        } catch (reasonValue) {
            const errorCode = reasonValue instanceof ApiError ? reasonValue.problem.errorCode : undefined;
            if (["ACCOUNT_RECOVERY_OTP_ATTEMPTS_EXHAUSTED", "ACCOUNT_RECOVERY_CHALLENGE_EXPIRED",
                "ACCOUNT_RECOVERY_CHALLENGE_STALE", "ARCHIVED_ACCOUNT_ALREADY_RECOVERED"].includes(errorCode ?? "")) {
                writePreviewArchivedRecoveryChallenge(null);
                setRecoveryChallenge(null); setRecoveryTargetId(""); setRecoveryPanelMinimized(false);
            } else if (isBackendConfigured && errorCode === "INVALID_OTP") {
                const refreshed = await brainServeApi.activeArchivedRecoveryChallenge().catch(() => undefined);
                if (refreshed) setRecoveryChallenge(refreshed);
            }
            setError(reasonValue instanceof Error ? reasonValue.message : "Archived account recovery failed.");
        } finally { setBusyId(""); }
    };

    const resendArchivedRecoveryOtp = async () => {
        if (!recoveryChallenge || recoveryResendSeconds > 0) return;
        setBusyId("recovery-resend"); setError(""); setMessage("");
        try {
            const challenge = isBackendConfigured
                ? await brainServeApi.resendArchivedRecoveryOtp(recoveryChallenge.challengeId)
                : { ...recoveryChallenge, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
                    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(), attemptsRemaining: 5 };
            if (!isBackendConfigured) writePreviewArchivedRecoveryChallenge(challenge);
            setRecoveryChallenge(challenge);
            setChallengeClock(Date.now());
            setMessage("A new recovery code was sent to the System Admin mailbox.");
        } catch (reasonValue) {
            setError(reasonValue instanceof Error ? reasonValue.message : "The recovery code could not be resent.");
        } finally { setBusyId(""); }
    };

    const cancelArchivedRecovery = async () => {
        if (busyId) return;
        setBusyId("recovery-cancel"); setError(""); setMessage("");
        try {
            if (recoveryChallenge && isBackendConfigured) {
                await brainServeApi.cancelArchivedRecoveryChallenge(recoveryChallenge.challengeId);
            }
            writePreviewArchivedRecoveryChallenge(null);
            setRecoveryChallenge(null); setRecoveryTargetId(""); setRecoveryPanelMinimized(false);
            setMessage(recoveryChallenge
                ? "Account recovery verification cancelled. No identity or role changes were made." : "");
        } catch (reasonValue) {
            if (reasonValue instanceof ApiError && [404, 410].includes(reasonValue.status)) {
                writePreviewArchivedRecoveryChallenge(null);
                setRecoveryChallenge(null); setRecoveryTargetId(""); setRecoveryPanelMinimized(false);
                setMessage("The expired recovery verification was cleared. No identity changes were made.");
                return;
            }
            setError(reasonValue instanceof Error ? reasonValue.message : "Recovery verification could not be cancelled.");
        } finally { setBusyId(""); }
    };

    const actionable = requests.filter((item) => role === "System Admin"
        ? item.status === "PENDING_SYSTEM_ADMIN" || (item.targetRole === "ROLE_CEO" && item.status === "REQUESTED")
        : item.status === "REQUESTED");
    const scheduled = role === "System Admin" ? requests.filter((item) => item.status === "SCHEDULED") : [];
    const statusLabel = (value: string) => value.replace("ROLE_", "").replaceAll("_", " ");

    return <section className="account-lifecycle-page">
        <PageTitle eyebrow="IDENTITY GOVERNANCE" title="Account lifecycle"
                   detail={role === "System Admin" ? "Review, schedule and archive accounts without deleting company history."
                       : "Complete the business review before System Admin performs the final archival action."} />
        {role === "System Admin" && <div className="lifecycle-tabs glass-panel"><button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>Pending closure requests <b>{actionable.length + scheduled.length}</b></button><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active accounts <b>{accountTotal}</b></button><button className={tab === "archived" ? "active" : ""} onClick={() => setTab("archived")}>Archived accounts <b>{archivedTotal}</b></button></div>}
        {(role !== "System Admin" || tab === "pending") && <article className="lifecycle-panel glass-panel">
            <div className="panel-heading"><div><span>{role === "System Admin" ? "FINAL CONTROL" : "BUSINESS APPROVAL"}</span><h2>{role === "System Admin" ? "Requests awaiting final action" : "Requests awaiting your review"}</h2><p>Replacement ownership is recorded before access is disabled.</p></div><Archive size={22} /></div>
            <div className="lifecycle-table lifecycle-request-table"><div className="lifecycle-table-head"><span>Account</span><span>Route</span><span>Reason &amp; date</span><span>Replacement</span><span>Action</span></div>{actionable.map((request) => <div className="lifecycle-table-row" key={request.id}><div><strong>{request.targetName}</strong><small>{request.targetEmail}</small></div><div><span className={`closure-status closure-${request.status.toLowerCase()}`}>{statusLabel(request.targetRole)}</span><small>{request.departmentName ?? "Company-wide"}</small></div><div><strong>{request.reason}</strong><small>Effective {request.requestedEffectiveDate}</small></div><div><select value={replacements[request.id] ?? request.replacementUserId ?? ""} onChange={(event) => setReplacements((items) => ({ ...items, [request.id]: event.target.value }))}><option value="">{["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(request.targetRole) ? "No replacement required" : "Select replacement"}</option>{candidatesFor(request).map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.fullName}</option>)}</select><input value={notes[request.id] ?? ""} onChange={(event) => setNotes((items) => ({ ...items, [request.id]: event.target.value }))} placeholder="Decision note" /></div><div className="lifecycle-actions"><button className="button button-reject" disabled={busyId === request.id} onClick={() => void (role === "System Admin" ? systemDecision(request, "reject") : businessDecision(request, "reject"))}>Reject</button><button className="button button-primary" disabled={busyId === request.id} onClick={() => void (role === "System Admin" ? systemDecision(request, "approve") : businessDecision(request, "approve"))}>{role === "System Admin" ? "Approve / schedule" : "Business approve"}</button>{role === "System Admin" && <button className="text-button" onClick={() => void showHistory(request)}>History</button>}</div></div>)}</div>
            {actionable.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>No pending lifecycle action</strong><small>New requests will appear here as their approval route reaches you.</small></div>}
            {scheduled.length > 0 && <div className="scheduled-closure-list"><span>SCHEDULED ARCHIVAL</span>{scheduled.map((request) => <div key={request.id}><span><strong>{request.targetName}</strong><small>{statusLabel(request.targetRole)} · replacement {request.replacementName ?? "not required"}</small></span><time>{request.requestedEffectiveDate}</time><button className="text-button" onClick={() => void showHistory(request)}>History</button></div>)}</div>}
        </article>}
        {role === "System Admin" && tab === "active" && <article className="lifecycle-panel glass-panel">
            <div className="panel-heading"><div><span>ACTIVE DIRECTORY</span><h2>Operational accounts</h2><p>Only 25 matching accounts are loaded at once. Search, role and department filters run in PostgreSQL.</p></div><Users size={22} /></div>
            <div className={`lifecycle-directory-toolbar ${accountRole === "ROLE_EMPLOYEE" ? "with-department-filter" : ""}`}>
                <div className="toolbar-search wide"><Search size={16} /><input value={accountQuery}
                                                                                onChange={(event) => { setAccountPage(0); setAccountQuery(event.target.value); }}
                                                                                placeholder="Search name or company email" aria-label="Search operational accounts" /></div>
                <select value={accountRole} aria-label="Filter operational accounts by role"
                        onChange={(event) => {
                            setAccountPage(0); setAccountDepartmentId(""); setAccountRole(event.target.value);
                        }}>
                    <option value="ALL">All roles</option>
                    <option value="ROLE_CEO">CEO</option><option value="ROLE_HR_ADMIN">HR Admin</option>
                    <option value="ROLE_MANAGER">Manager</option><option value="ROLE_TEAM_LEAD">Team Lead</option>
                    <option value="ROLE_EMPLOYEE">Employee</option>
                    <option value="ROLE_RECEPTIONIST">Receptionist</option><option value="ROLE_SECURITY">Security</option>
                    <option value="ROLE_SYSTEM_ADMIN">System Admin</option>
                </select>
                {accountRole === "ROLE_EMPLOYEE" && <select value={accountDepartmentId}
                                                            aria-label="Filter employees by department"
                                                            onChange={(event) => { setAccountPage(0); setAccountDepartmentId(event.target.value); }}>
                    <option value="">Select employee department</option>
                    {departments.filter((department) => department.active).map((department) =>
                        <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>}
                <span className="directory-result-count" aria-live="polite">{accountPageBusy ? "Loading…" : `${accountTotal.toLocaleString("en-IN")} matching accounts`}</span>
            </div>
            <div className="lifecycle-table" aria-busy={accountPageBusy}>
                <div className="lifecycle-table-head account-head"><span>Identity</span><span>Role</span><span>Department</span><span>Status</span><span>Action</span></div>
                {accounts.map((account) => <div className="lifecycle-table-row account-row" key={account.userId}><div><strong>{account.fullName}</strong><small>{account.email}</small></div><div>{statusLabel(account.role)}</div><div>{account.departmentName ?? "Company-wide"}</div><div><span className="closure-status closure-active">{account.status}</span></div><div>{account.protectedAccount ? <span className="protected-chip"><ShieldCheck size={13} /> Protected</span> : account.role === "ROLE_EMPLOYEE" ? <small>Use HR → CEO termination</small> : <button className={archiveChallenge?.targetUserId === account.userId ? "button button-primary" : "button button-reject"} disabled={Boolean(recoveryChallenge || (archiveChallenge && archiveChallenge.targetUserId !== account.userId))} title={recoveryChallenge ? `Finish or cancel ${recoveryChallenge.targetName}'s recovery first` : archiveChallenge && archiveChallenge.targetUserId !== account.userId ? `Finish or cancel ${archiveChallenge.targetName}'s verification first` : undefined} onClick={() => void openDirectAccount(account)}>{archiveChallenge?.targetUserId === account.userId ? "Enter OTP" : "Deactivate & archive"}</button>}</div></div>)}
                {!accountPageBusy && accounts.length === 0 && <div className="empty-state"><Search size={28} />
                    <strong>{accountRole === "ROLE_EMPLOYEE" && !accountDepartmentId
                        ? "Select an employee department" : "No matching operational accounts"}</strong>
                    <small>{accountRole === "ROLE_EMPLOYEE" && !accountDepartmentId
                        ? "Employees are loaded only after a department is selected."
                        : "Change the name, email, role or department filter."}</small></div>}
            </div>
            <div className="bounded-pagination page-number-pagination lifecycle-pagination">
                <button className="button button-secondary" disabled={accountPageBusy || accountPage === 0} onClick={() => setAccountPage((value) => Math.max(0, value - 1))}>Previous</button>
                <span>Page {accountPage + 1} of {accountPageCount}</span>
                <button className="button button-secondary" disabled={accountPageBusy || accountPage + 1 >= accountPageCount} onClick={() => setAccountPage((value) => value + 1)}>Next</button>
            </div>
        </article>}
        {role === "System Admin" && tab === "archived" && <article className="lifecycle-panel glass-panel">
            <div className="panel-heading"><div><span>RETAINED HISTORY</span><h2>Archived accounts</h2><p>No password hashes, tokens, OTPs or profile image binaries are stored here.</p></div><FileClock size={22} /></div>
            <div className="lifecycle-directory-toolbar archived-directory-toolbar">
                <div className="toolbar-search wide"><Search size={16} /><input value={archivedQuery}
                                                                                onChange={(event) => { setArchivedPage(0); setArchivedQuery(event.target.value); }}
                                                                                placeholder="Search archived identity, role or department" aria-label="Search archived accounts" /></div>
                <span className="directory-result-count" aria-live="polite">{archivedPageBusy ? "Loading…" : `${archivedTotal.toLocaleString("en-IN")} archived accounts`}</span>
            </div>
            <div className="lifecycle-table" aria-busy={archivedPageBusy}>
                <div className="lifecycle-table-head archived-head"><span>Identity snapshot</span><span>Role / department</span><span>Closure</span><span>Retention</span><span>Action</span></div>
                {archived.map((account) => <div className="lifecycle-table-row archived-row" key={account.id}><div><strong>{account.fullName}</strong><small>{account.email}</small></div><div><strong>{statusLabel(account.role)}</strong><small>{account.departmentName ?? "Company-wide"}</small></div><div><strong>{account.reason}</strong><small>{new Date(account.archivedAt).toLocaleString("en-IN")}</small></div><div><span className="closure-status closure-archived">ARCHIVED</span><small>Retain until {account.retentionUntil}</small></div><div><button className={recoveryChallenge?.archivedAccountId === account.id ? "button button-primary" : "button button-secondary"} disabled={Boolean(archiveChallenge || (recoveryChallenge && recoveryChallenge.archivedAccountId !== account.id))} title={archiveChallenge ? `Finish or cancel ${archiveChallenge.targetName}'s archive verification first` : recoveryChallenge && recoveryChallenge.archivedAccountId !== account.id ? `Finish or cancel ${recoveryChallenge.targetName}'s recovery first` : undefined} onClick={() => openArchivedRecovery(account)}>{recoveryChallenge?.archivedAccountId === account.id ? "Enter OTP" : "Recover account"}</button></div></div>)}
            </div>
            {!archivedPageBusy && archived.length === 0 && <div className="empty-state"><Archive size={28} /><strong>No archived accounts</strong><small>Archived identity snapshots will be retained here for compliance.</small></div>}
            <div className="bounded-pagination page-number-pagination lifecycle-pagination">
                <button className="button button-secondary" disabled={archivedPageBusy || archivedPage === 0} onClick={() => setArchivedPage((value) => Math.max(0, value - 1))}>Previous</button>
                <span>Page {archivedPage + 1} of {archivedPageCount}</span>
                <button className="button button-secondary" disabled={archivedPageBusy || archivedPage + 1 >= archivedPageCount} onClick={() => setArchivedPage((value) => value + 1)}>Next</button>
            </div>
        </article>}
        {recoveryChallenge && recoveryPanelMinimized && <article className="direct-archive-resume recovery-resume glass-panel" role="status">
            <span className="direct-archive-resume-icon"><RotateCcw size={19} /></span>
            <span><strong>Recovery verification pending for {recoveryChallenge.targetName}</strong><small>{statusLabel(recoveryChallenge.targetRole)} · expires in {recoveryTimeRemaining} · {recoveryChallenge.attemptsRemaining} attempts remaining</small></span>
            <button type="button" className="button button-primary" onClick={() => { setTab("archived"); setRecoveryPanelMinimized(false); }}><LockKeyhole size={15} /> Enter OTP</button>
        </article>}
        {recoveryTarget && !recoveryPanelMinimized && <article ref={recoveryPanelRef} className="direct-archive-panel recovery-panel glass-panel" aria-labelledby="archived-recovery-title" aria-describedby="archived-recovery-description">
            <header><div><span>GOVERNED RECOVERY</span><h2 id="archived-recovery-title">Recover {recoveryTarget.fullName}</h2><p id="archived-recovery-description">{recoveryChallenge ? "Enter the mailbox code to activate the frozen role and department selection. You can minimize this section without losing progress." : "Restore the same user and employee identity with one current role. Previous role and department remain in immutable lifecycle history."}</p></div><button className="icon-button" type="button" disabled={Boolean(busyId)} aria-label={recoveryChallenge ? "Minimize recovery verification" : "Close account recovery section"} onClick={() => recoveryChallenge ? setRecoveryPanelMinimized(true) : void cancelArchivedRecovery()}>{recoveryChallenge ? <MoreHorizontal size={18} /> : <X size={18} />}</button></header>
            <div className="direct-archive-steps" aria-label="Account recovery verification progress"><span className="complete"><b>1</b>Identity</span><i /><span className={recoveryChallenge ? "complete" : "active"}><b>2</b>Role &amp; password</span><i /><span className={recoveryChallenge ? "active" : ""}><b>3</b>Mailbox OTP</span></div>
            <form onSubmit={recoverArchived}>
                <div className="direct-archive-context"><span className="avatar">{visitorInitials(recoveryTarget.fullName)}</span><span><small>Archived as {statusLabel(recoveryTarget.role)} · {recoveryTarget.departmentName ?? "Company-wide"}</small><strong>{recoveryTarget.email}</strong>{recoveryTarget.employeeNumber && <small>Employee ID {recoveryTarget.employeeNumber}</small>}</span><span className="closure-status closure-archived">{recoveryChallenge ? "OTP PENDING" : "ARCHIVED"}</span></div>
                {!recoveryChallenge ? <div className="direct-archive-form-grid recovery-form-grid">
                    <label>New current role<select name="targetRole" value={recoveryRole} required onChange={(event) => {
                        const nextRole = event.target.value;
                        setRecoveryRole(nextRole);
                        if (["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(nextRole)) setRecoveryDepartmentId("");
                    }}><option value="ROLE_MANAGER">Manager</option><option value="ROLE_HR_ADMIN">HR Admin</option><option value="ROLE_TEAM_LEAD">Team Lead</option><option value="ROLE_EMPLOYEE">Employee</option><option value="ROLE_CEO">CEO</option><option value="ROLE_RECEPTIONIST">Receptionist</option><option value="ROLE_SECURITY">Security</option></select><small>CEO is unavailable while another active CEO exists.</small></label>
                    {recoveryNeedsDepartment && <label>Department<select name="departmentId" value={recoveryDepartmentId} onChange={(event) => setRecoveryDepartmentId(event.target.value)} required><option value="">Select active department</option>{departments.filter((item) => item.active).map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select><small>Manager, HR Admin and Team Lead slots must be unoccupied.</small></label>}
                    <label>Recovery reason<textarea name="reason" minLength={5} maxLength={1000} required placeholder="Explain why this archived identity is being restored and assigned this role." /></label>
                    <label>Current System Admin password<input name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required /><small>Verified securely and never saved in this form or browser storage.</small></label>
                </div> : <div className="direct-archive-verification">
                    <div className="direct-archive-summary"><span><small>Role transition</small><strong>{statusLabel(recoveryChallenge.previousRole)} → {statusLabel(recoveryChallenge.targetRole)}</strong></span><span><small>Department</small><strong>{recoveryChallenge.targetDepartmentName ?? "Company-wide"}</strong></span><span><small>Recovery reason</small><strong>{recoveryChallenge.reason}</strong></span></div>
                    <div className="otp-status-strip"><Mail size={18} /><span><strong>Recovery code sent to the System Admin mailbox</strong><small>Expires in {recoveryTimeRemaining} · {recoveryChallenge.attemptsRemaining} attempts remaining</small></span></div>
                    <label>Six-digit recovery code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} required /></label>
                </div>}
                {message && <div className="success-banner direct-panel-message"><CheckCircle2 size={17} />{message}</div>}
                {error && <div className="login-error direct-panel-message" role="alert">{error}</div>}
                <div className="direct-archive-actions">
                    {!recoveryChallenge ? <>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId)} onClick={() => void cancelArchivedRecovery()}>Cancel</button>
                        <button className="button button-primary" disabled={Boolean(busyId)}><Mail size={15} />{busyId === "recovery" ? "Verifying…" : "Verify password & send OTP"}</button>
                    </> : <>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId)} onClick={() => setRecoveryPanelMinimized(true)}>Minimize</button>
                        <button type="button" className="button button-secondary danger-text" disabled={Boolean(busyId)} onClick={() => void cancelArchivedRecovery()}>Cancel verification</button>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId) || recoveryResendSeconds > 0} onClick={() => void resendArchivedRecoveryOtp()}><RotateCcw size={15} />{busyId === "recovery-resend" ? "Sending…" : recoveryResendSeconds > 0 ? `Resend in ${recoveryResendSeconds}s` : "Resend code"}</button>
                        <button className="button button-primary" disabled={Boolean(busyId) || recoverySecondsRemaining === 0}><BadgeCheck size={16} />{busyId === "recovery" ? "Recovering…" : "Confirm account recovery"}</button>
                    </>}
                </div>
            </form>
        </article>}
        {archiveChallenge && archivePanelMinimized && <article className="direct-archive-resume glass-panel" role="status">
            <span className="direct-archive-resume-icon"><LockKeyhole size={19} /></span>
            <span><strong>OTP verification pending for {archiveChallenge.targetName}</strong><small>{statusLabel(archiveChallenge.targetRole)} · expires in {archiveTimeRemaining} · {archiveChallenge.attemptsRemaining} attempts remaining</small></span>
            <button type="button" className="button button-primary" onClick={() => { setTab("active"); setArchivePanelMinimized(false); }}><LockKeyhole size={15} /> Enter OTP</button>
        </article>}
        {directTarget && !archivePanelMinimized && <article ref={directArchivePanelRef} className="direct-archive-panel glass-panel" aria-labelledby="direct-archive-title" aria-describedby="direct-archive-description">
            <header><div><span>EMERGENCY CONTROL</span><h2 id="direct-archive-title">Deactivate &amp; archive {directTarget.fullName}</h2><p id="direct-archive-description">{archiveChallenge ? "Enter the mailbox code to complete the verified archive action. You can minimize this section without losing progress." : "Confirm the account, replacement and reason, then verify the current System Admin password."}</p></div><button className="icon-button" type="button" disabled={Boolean(busyId)} aria-label={archiveChallenge ? "Minimize archive verification" : "Close deactivate and archive section"} onClick={() => archiveChallenge ? setArchivePanelMinimized(true) : void cancelDirectArchive()}>{archiveChallenge ? <MoreHorizontal size={18} /> : <X size={18} />}</button></header>
            <div className="direct-archive-steps" aria-label="Archive verification progress"><span className="complete"><b>1</b>Account details</span><i /><span className={archiveChallenge ? "complete" : "active"}><b>2</b>Password</span><i /><span className={archiveChallenge ? "active" : ""}><b>3</b>Mailbox OTP</span></div>
            <form onSubmit={directArchive}>
                <div className="direct-archive-context"><span className="avatar">{visitorInitials(directTarget.fullName)}</span><span><small>{statusLabel(directTarget.role)} · {directTarget.departmentName ?? "Company-wide"}</small><strong>{directTarget.email}</strong></span><span className="closure-status closure-active">{archiveChallenge ? "OTP PENDING" : directTarget.status}</span></div>
                {!archiveChallenge ? <div className="direct-archive-form-grid">
                    <label>Archive reason<textarea name="reason" minLength={5} maxLength={1000} required placeholder="Explain why this account must be deactivated and archived." /></label>
                    <label>Replacement<select name="replacementUserId" required={!(["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(directTarget.role))}><option value="">{["ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(directTarget.role) ? "No replacement required" : "Select replacement"}</option>{candidatesFor(directTarget).map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.fullName}</option>)}</select></label>
                    <label>Current System Admin password<input name="currentPassword" type="password" minLength={8} maxLength={128} autoComplete="current-password" required /><small>Verified securely and never saved in this form or browser storage.</small></label>
                </div> : <div className="direct-archive-verification">
                    <div className="direct-archive-summary"><span><small>Archive reason</small><strong>{archiveChallenge.reason}</strong></span><span><small>Replacement</small><strong>{archiveChallenge.replacementName ?? "Not required"}</strong></span></div>
                    <div className="otp-status-strip"><Mail size={18} /><span><strong>Code sent to the System Admin mailbox</strong><small>Expires in {archiveTimeRemaining} · {archiveChallenge.attemptsRemaining} attempts remaining</small></span></div>
                    <label>Six-digit confirmation code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} required /></label>
                </div>}
                {message && <div className="success-banner direct-panel-message"><CheckCircle2 size={17} />{message}</div>}
                {error && <div className="login-error direct-panel-message" role="alert">{error}</div>}
                <div className="direct-archive-actions">
                    {!archiveChallenge ? <>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId)} onClick={() => void cancelDirectArchive()}>Cancel</button>
                        <button className="button button-reject" disabled={Boolean(busyId)}><Mail size={15} />{busyId === "direct" ? "Verifying…" : "Verify password & send OTP"}</button>
                    </> : <>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId)} onClick={() => setArchivePanelMinimized(true)}>Minimize</button>
                        <button type="button" className="button button-secondary danger-text" disabled={Boolean(busyId)} onClick={() => void cancelDirectArchive()}>Cancel verification</button>
                        <button type="button" className="button button-secondary" disabled={Boolean(busyId) || archiveResendSeconds > 0} onClick={() => void resendDirectArchiveOtp()}><RotateCcw size={15} />{busyId === "direct-resend" ? "Sending…" : archiveResendSeconds > 0 ? `Resend in ${archiveResendSeconds}s` : "Resend code"}</button>
                        <button className="button button-reject" disabled={Boolean(busyId) || archiveSecondsRemaining === 0}><Archive size={16} />{busyId === "direct" ? "Archiving…" : "Confirm deactivation & archive"}</button>
                    </>}
                </div>
            </form>
        </article>}
        {historyRequestId && <article className="lifecycle-history glass-panel"><div className="panel-heading"><div><span>IMMUTABLE RECORD</span><h2>Lifecycle history</h2></div><button className="icon-button" onClick={() => setHistoryRequestId("")}><X size={18} /></button></div>{history.map((record) => <div key={record.id}><i /><span><strong>{record.toStatus.replaceAll("_", " ")}</strong><small>{record.detail} · {new Date(record.occurredAt).toLocaleString("en-IN")}</small></span></div>)}</article>}
        {message && !directTarget && !recoveryTarget && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && !directTarget && !recoveryTarget && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function Overview({ role, appointments, metrics, onNavigate, onRegister, decideAppointment }: { role: Role;
    appointments: Appointment[]; metrics: DashboardMetrics; onNavigate: (view: View) => void; onRegister: () => void;
    decideAppointment: (id: string, decision: "approve" | "reject") => Promise<void> }) {
    const context = role === "Reception"
        ? { title: "Reception command centre", detail: "Verify Security arrivals, route approvals and coordinate check-ins." }
        : role === "Security"
            ? { title: "Security arrival desk", detail: "Capture who arrived and why, then notify Reception through BrainServe Connect." }
            : role === "Team Lead"
                ? { title: "Department delivery centre", detail: "Assign work, review completed tasks and keep HR informed of delivery performance." }
                : role === "Manager"
                    ? { title: "Department executive desk", detail: "Review CEO visitors routed by Reception and coordinate the assigned department." }
                    : role === "CEO"
                        ? { title: "Executive governance centre", detail: "Complete final CEO-visit decisions and oversee company-wide work and account approvals." }
                        : role === "HR Admin"
                            ? { title: "People operations centre", detail: "Review department visits, staff activity and governed account requests." }
                            : role === "Employee"
                                ? { title: "Your workday, clearly organized", detail: "Start assigned work, submit completion evidence and acknowledge Team Lead decisions." }
                                : { title: "Your appointment workspace", detail: "Review requests, manage your time and prepare for today’s visitors." };
    const pending = appointments.filter((item) => needsAppointmentAction(role, item));
    const allPending = appointments.filter((item) => ["Pending", "Awaiting Security", "Awaiting Reception", "Awaiting HR", "Awaiting Team Lead", "Awaiting Manager", "Awaiting CEO"].includes(item.status));
    const queueTitle = role === "Security" ? "Security intake queue" : role === "Reception" ? "Reception verification queue"
        : role === "Manager" ? "CEO visitor approval queue" : role === "CEO" ? "CEO approval queue"
            : role === "Team Lead" ? "Department approval queue" : "HR approval queue";
    const isRoutingRole = role === "Security" || role === "Reception";
    const isWorkRole = role === "Employee" || role === "Team Lead";
    const primaryView: View = isWorkRole ? "work" : "appointments";
    return <>
        <PageTitle eyebrow={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()} · ${role.toUpperCase()}`}
                   title={context.title} detail={context.detail}
                   action={<button className="button button-primary" onClick={() => role === "Reception" ? onRegister() : onNavigate(primaryView)}>
                       <Plus size={17} />{role === "Reception" ? "Register walk-in" : isWorkRole ? "Open work board" : "Open appointments"}
                   </button>} />
        <section className="metric-grid">
            <article className="metric-card glass-panel"><div><span>Active visits</span><strong>{metrics.activeVisits}</strong><small>Approved or currently in progress</small></div><span className="metric-icon"><CalendarDays size={22} /></span></article>
            <article className="metric-card glass-panel"><div><span>In workflow</span><strong>{metrics.awaitingApproval || allPending.length}</strong><small>{pending.length} require your action</small></div><span className="metric-icon"><Clock3 size={22} /></span></article>
            <article className="metric-card glass-panel"><div><span>Currently inside</span><strong>{metrics.visitorsInside}</strong><small>Live access records</small></div><span className="metric-icon"><DoorOpen size={22} /></span></article>
            <article className="metric-card glass-panel"><div><span>Active employees</span><strong>{metrics.activeEmployees}</strong><small>{metrics.totalEmployees} total profiles</small></div><span className="metric-icon"><Users size={22} /></span></article>
        </section>
        <section className="dashboard-grid">
            {isWorkRole ? <article className="panel glass-panel work-overview-panel">
                <div className="panel-heading"><div><span>DEPARTMENT DELIVERY</span><h2>Your work board</h2><p>Track assigned work, completion evidence, Team Lead decisions and acknowledgement.</p></div><BriefcaseBusiness size={22} /></div>
                <div className="work-overview-flow"><span>Assigned</span><i /><span>In progress</span><i /><span>Completed</span><i /><span>Approved</span></div>
                <button className="button button-primary" onClick={() => onNavigate("work")}>Open work board <ArrowRight size={16} /></button>
            </article> : <article className="panel glass-panel schedule-panel">
                <div className="panel-heading"><div><span>LIVE SCHEDULE</span><h2>Today at BrainServe Connect</h2></div><button className="text-button" onClick={() => onNavigate("appointments")}>View queue <ChevronRight size={16} /></button></div>
                <div className="schedule-list">{appointments.slice(0, 4).map((item) => <div key={item.id} className="schedule-row"><time>{item.time.replace(" ", "\n")}</time><i className={`line status-dot-${item.status.toLowerCase().replaceAll(" ", "-")}`} /><span className="avatar">{item.initials}</span><div><strong>{item.visitor}</strong><small>{item.purpose} · with {item.host}</small></div><StatusPill status={item.status} /><button className="icon-button" onClick={() => onNavigate("appointments")} aria-label={`Open ${item.visitor}'s appointment`}><MoreHorizontal size={18} /></button></div>)}</div>
            </article>}
            <article className="panel glass-panel approval-panel">
                <div className="panel-heading"><div><span>NEEDS YOUR ATTENTION</span><h2>{queueTitle}</h2></div><b>{pending.length}</b></div>
                {pending.map((item) => <div className="approval-item" key={item.id}><div className="approval-person"><span className="avatar">{item.initials}</span><span><strong>{item.visitor}</strong><small>{item.type} · {item.company}</small></span></div><p>“{item.arrivalPurpose ?? item.purpose}”</p><div className="approval-meta"><span><Clock3 size={15} /> {item.date}, {item.time}</span><span><CircleUserRound size={15} /> {item.host}</span></div>{item.status === "Awaiting Manager" && <div className="approval-route"><CheckCircle2 size={15} /> Security and Reception verified · waiting for the assigned Manager</div>}{item.status === "Awaiting CEO" && <div className="approval-route"><CheckCircle2 size={15} /> Security and Reception verified · Manager approved · waiting for CEO final decision</div>}{item.status === "Awaiting Team Lead" && <div className="approval-route"><CheckCircle2 size={15} /> HR verified · waiting for your department decision</div>}{isRoutingRole ? <div className="approval-actions"><button className="button button-primary" onClick={() => onNavigate("appointments")}><ArrowRight size={16} /> Open {role === "Security" ? "intake" : "verification"}</button></div> : <div className="approval-actions"><button className="button button-reject" onClick={() => void decideAppointment(item.id, "reject")}><X size={16} /> Decline</button><button className="button button-approve" onClick={() => void decideAppointment(item.id, "approve")}><Check size={16} /> {role === "CEO" ? "Final CEO approval" : role === "Manager" ? "Approve & send to CEO" : role === "Team Lead" ? "Team Lead approve" : "HR approve"}</button></div>}</div>)}
                {pending.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>All caught up</strong><small>No appointments require your workflow stage.</small></div>}
            </article>
        </section>
    </>;
}

function workTaskStatusLabel(status: WorkTask["status"]) {
    return { ASSIGNED: "Assigned", IN_PROGRESS: "In progress", COMPLETED: "Awaiting approval",
        CHANGES_REQUESTED: "Rework in progress", INSIGHT_REWORK_REQUESTED: "Returned by Insights",
        APPROVED: "Approved", ACKNOWLEDGED: "Acknowledged" }[status];
}

function WorkTaskPill({ status }: { status: WorkTask["status"] }) {
    return <span className={`work-task-status work-task-${status.toLowerCase().replaceAll("_", "-")}`}><i />{workTaskStatusLabel(status)}</span>;
}

function WorkBoard({ role, userEmail, employees, departments, teamLeadAssignments, appointments, decideAppointment }: {
    role: Role; userEmail: string; employees: Employee[]; departments: Department[];
    teamLeadAssignments: TeamLeadAssignment[]; appointments: Appointment[];
    decideAppointment: (id: string, decision: "approve" | "reject") => Promise<void>;
}) {
    const [tasks, setTasks] = useState<WorkTask[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [branchFilter, setBranchFilter] = useState("ALL");
    const [busy, setBusy] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [actionDialog, setActionDialog] = useState<{ task: WorkTask; action: "start" | "complete" | "approve" | "request-changes" | "insight-rework" } | null>(null);
    const [actionNote, setActionNote] = useState("");
    const demoAccounts = !isBackendConfigured ? readDemoAccounts() : [];
    const currentDemoAccount = demoAccounts.find((account) =>
        account.email.toLowerCase() === userEmail.toLowerCase());
    const profileEmployee = employees.find((item) => item.email.toLowerCase() === userEmail.toLowerCase()
        || Boolean(currentDemoAccount?.employeeId && (item.uuid ?? item.id) === currentDemoAccount.employeeId));
    const profileEmployeeId = profileEmployee?.uuid ?? profileEmployee?.id ?? currentDemoAccount?.employeeId ?? undefined;
    const activeTeamLeadAssignments = teamLeadAssignments.filter((assignment) => assignment.active);
    const matchedTeamLeadAssignment = role === "Team Lead" ? activeTeamLeadAssignments.find((assignment) =>
        assignment.teamLeadUserId === currentDemoAccount?.id
        || assignment.teamLeadEmployeeId === profileEmployeeId) : undefined;
    const soleTeamLeadAssignment = activeTeamLeadAssignments.length === 1 ? activeTeamLeadAssignments[0] : undefined;
    const soleAssignmentHasKnownPreviewOwner = Boolean(soleTeamLeadAssignment && demoAccounts.some((account) =>
        account.id === soleTeamLeadAssignment.teamLeadUserId && account.status === "ACTIVE" && account.role === "ROLE_TEAM_LEAD"));
    const currentTeamLeadAssignment = matchedTeamLeadAssignment
        ?? (role === "Team Lead" && soleTeamLeadAssignment
        && (isBackendConfigured || (Boolean(currentDemoAccount) && !soleAssignmentHasKnownPreviewOwner))
            ? soleTeamLeadAssignment : undefined);
    const currentEmployee = profileEmployee ?? (currentTeamLeadAssignment
        ? employees.find((item) => (item.uuid ?? item.id) === currentTeamLeadAssignment.teamLeadEmployeeId)
        : undefined);
    const currentEmployeeId = currentEmployee?.uuid ?? currentEmployee?.id ?? profileEmployeeId;
    const teamLeadDepartmentId = role === "Team Lead"
        ? currentTeamLeadAssignment?.departmentId ?? currentEmployee?.departmentId : currentEmployee?.departmentId;
    const assignedDepartment = departments.find((department) => department.id === teamLeadDepartmentId);
    const eligibleEmployees = employees.filter((item) => item.status === "Active"
        && (item.uuid ?? item.id) !== currentEmployeeId
        && (role !== "Team Lead" || (Boolean(teamLeadDepartmentId)
            && item.departmentId === teamLeadDepartmentId)));

    const load = useCallback(async () => {
        try {
            const values = isBackendConfigured ? await brainServeApi.workTasks() : readDemoWorkTasks();
            if (role === "Employee" && !currentEmployeeId) {
                setTasks([]);
                setError("Your Employee login is not linked to a saved employee profile. Ask HR to complete your department assignment.");
                return;
            }
            const scoped = role === "Employee"
                ? values.filter((item) => item.employeeId === currentEmployeeId)
                : role === "Team Lead" && !isBackendConfigured
                    ? values.filter((item) => Boolean(teamLeadDepartmentId)
                        && item.departmentId === teamLeadDepartmentId)
                    : values;
            setTasks(scoped); setError("");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Department work could not be loaded."); }
    }, [currentEmployeeId, role, teamLeadDepartmentId]);

    useEffect(() => {
        const initial = window.setTimeout(() => void load(), 0);
        const timer = window.setInterval(() => void load(), 15000);
        return () => { window.clearTimeout(initial); window.clearInterval(timer); };
    }, [load]);

    const saveDemo = (updated: WorkTask) => {
        const all = readDemoWorkTasks().map((item) => item.id === updated.id ? updated : item);
        writeDemoWorkTasks(all);
        setTasks((items) => items.map((item) => item.id === updated.id ? updated : item));
    };

    const createTask = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const payload = { employeeId: String(data.get("employeeId")), title: String(data.get("title")).trim(),
            description: String(data.get("description")).trim(), dueDate: String(data.get("dueDate")) };
        setBusy("create"); setError(""); setMessage("");
        try {
            const created = isBackendConfigured ? await brainServeApi.createWorkTask(payload) : (() => {
                const selectedEmployee = employees.find((item) => (item.uuid ?? item.id) === payload.employeeId);
                const teamLeadAccount = readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                return {
                    id: newClientId(), departmentId: selectedEmployee?.departmentId ?? teamLeadDepartmentId ?? "",
                    employeeId: payload.employeeId, teamLeadUserId: teamLeadAccount?.id ?? userEmail, title: payload.title,
                    description: payload.description, departmentBranch: assignedDepartment?.name ?? selectedEmployee?.department ?? "Assigned department",
                    dueDate: payload.dueDate,
                    status: "ASSIGNED" as const, employeeUpdate: null, teamLeadReview: null, startedAt: null,
                    completedAt: null, approvedAt: null, acknowledgedAt: null, createdAt: new Date().toISOString(), version: 0,
                };
            })();
            if (!isBackendConfigured) {
                writeDemoWorkTasks([created, ...readDemoWorkTasks()]);
                const selectedEmployee = employees.find((item) => (item.uuid ?? item.id) === payload.employeeId);
                const recipient = readDemoAccounts().find((account) => account.employeeId === payload.employeeId
                    || account.email.toLowerCase() === selectedEmployee?.email.toLowerCase());
                if (recipient) {
                    const now = new Date().toISOString();
                    writeDemoInternalNotifications([{ id: newClientId(), senderUserId: created.teamLeadUserId,
                        recipientUserId: recipient.id, senderName: demoSenderName(role, userEmail), recipientName: recipient.fullName,
                        message: `New ${created.departmentBranch} task sheet: ${created.title}. Due ${created.dueDate}.`,
                        deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                        senderEmail: userEmail, recipientEmail: recipient.email }, ...readDemoInternalNotifications()]);
                }
            }
            setTasks((items) => [created, ...items]); form.reset(); setShowCreate(false);
            setMessage("Task sheet created. Only the selected employee can see it, and BrainServe Internal Calls notified them immediately.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be assigned."); }
        finally { setBusy(""); }
    };

    const act = async (task: WorkTask, action: "start" | "complete" | "approve" | "request-changes" | "acknowledge", note = "") => {
        if (["complete", "request-changes"].includes(action) && !note.trim()) {
            setError(action === "complete" ? "Describe the completed work before submitting it for review."
                : "A review note is required when requesting changes."); return false;
        }
        setBusy(`${task.id}:${action}`); setError(""); setMessage("");
        try {
            let updated: WorkTask;
            if (isBackendConfigured) updated = action === "acknowledge"
                ? await brainServeApi.acknowledgeWorkTask(task.id)
                : await brainServeApi.updateWorkTask(task.id, action, note?.trim() ?? "");
            else {
                const now = new Date().toISOString();
                const nextStatus: WorkTask["status"] = action === "start" ? "IN_PROGRESS" : action === "complete" ? "COMPLETED"
                    : action === "approve" ? "APPROVED" : action === "request-changes" ? "CHANGES_REQUESTED" : "ACKNOWLEDGED";
                updated = { ...task, status: nextStatus, version: task.version + 1,
                    employeeUpdate: ["start", "complete"].includes(action) ? note?.trim() || task.employeeUpdate : task.employeeUpdate,
                    teamLeadReview: ["approve", "request-changes"].includes(action) ? note?.trim() || task.teamLeadReview : task.teamLeadReview,
                    startedAt: action === "start" ? now : task.startedAt,
                    completedAt: action === "complete" ? now : task.completedAt,
                    approvedAt: action === "approve" ? now : task.approvedAt,
                    acknowledgedAt: action === "acknowledge" ? now : task.acknowledgedAt };
                saveDemo(updated);
                const employee = employees.find((item) => (item.uuid ?? item.id) === task.employeeId);
                const accounts = readDemoAccounts();
                const actor = accounts.find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                const recipient = role === "Employee"
                    ? accounts.find((account) => account.id === task.teamLeadUserId)
                    ?? initialStaffAccounts.find((account) => account.userId === task.teamLeadUserId)
                    : accounts.find((account) => account.employeeId === task.employeeId
                        || account.email.toLowerCase() === employee?.email.toLowerCase());
                if (recipient) {
                    const recipientId = "id" in recipient ? recipient.id : recipient.userId;
                    const recipientEmail = recipient.email;
                    writeDemoInternalNotifications([{ id: newClientId(), senderUserId: actor?.id ?? userEmail,
                        recipientUserId: recipientId, senderName: demoSenderName(role, userEmail), recipientName: recipient.fullName,
                        message: `Task sheet “${task.title}” is now ${workTaskStatusLabel(nextStatus).toLowerCase()}${note?.trim() ? `: ${note.trim()}` : "."}`,
                        deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                        senderEmail: userEmail, recipientEmail }, ...readDemoInternalNotifications()]);
                }
            }
            if (isBackendConfigured) setTasks((items) => items.map((item) => item.id === updated.id ? updated : item));
            setMessage(action === "approve" ? "Task approved. Employee and HR performance inboxes were notified."
                : action === "acknowledge" ? "Team Lead approval acknowledged." : "Task status updated and delivered to the other participant.");
            return true;
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The task action failed."); return false; }
        finally { setBusy(""); }
    };

    const assignInsightRework = async (task: WorkTask, guidance: string) => {
        if (!guidance.trim()) { setError("Rework guidance is required before returning the worksheet to the employee."); return false; }
        setBusy(`${task.id}:insight-rework`); setError(""); setMessage("");
        try {
            if (isBackendConfigured) {
                await brainServeApi.assignWorkInsightRework(task.id, guidance.trim());
                await load();
            } else {
                const now = new Date().toISOString();
                const updated: WorkTask = { ...task, status: "CHANGES_REQUESTED", teamLeadReview: guidance.trim(),
                    startedAt: null, completedAt: null, approvedAt: null, acknowledgedAt: null, version: task.version + 1 };
                saveDemo(updated);
                writeDemoWorkInsights(readDemoWorkInsights().map((item) => item.workTaskId === task.id
                    ? { ...item, auditStatus: "REWORK_ASSIGNED" as const, teamLeadReworkGuidance: guidance.trim(),
                        teamLeadRespondedAt: now } : item));
                const employee = employees.find((item) => (item.uuid ?? item.id) === task.employeeId);
                const sender = readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                const recipient = readDemoAccounts().find((account) => account.employeeId === task.employeeId
                    || account.email.toLowerCase() === employee?.email.toLowerCase());
                if (sender && recipient) writeDemoInternalNotifications([{ id: newClientId(), senderUserId: sender.id,
                    recipientUserId: recipient.id, senderName: sender.fullName, recipientName: recipient.fullName,
                    message: `Rework required for “${task.title}”. Team Lead guidance: ${guidance.trim()}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: sender.email, recipientEmail: recipient.email }, ...readDemoInternalNotifications()]);
            }
            setMessage("Rework guidance sent to the employee. The worksheet is now tracked in the same audit cycle.");
            return true;
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The rework plan could not be assigned."); return false; }
        finally { setBusy(""); }
    };

    const openTaskAction = (task: WorkTask, action: "start" | "complete" | "approve" | "request-changes" | "insight-rework") => {
        setActionDialog({ task, action });
        setActionNote(action === "insight-rework" ? task.insightReviewReason ?? "" : "");
        setError(""); setMessage("");
    };

    const submitTaskAction = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!actionDialog) return;
        const { task, action } = actionDialog;
        const succeeded = action === "insight-rework" ? await assignInsightRework(task, actionNote)
            : await act(task, action, actionNote);
        if (succeeded) { setActionDialog(null); setActionNote(""); }
    };

    const taskActionCopy = actionDialog ? {
        start: ["Start this worksheet", "Add a concise progress note so your Team Lead knows how work began.", "Starting note", "Describe the first step or current focus", "Start work"],
        complete: ["Submit completed work", "Summarize the result and evidence your Team Lead should review.", "Completion update", "What was completed, tested or delivered?", "Submit for review"],
        approve: ["Approve employee delivery", "Record the Team Lead decision before the worksheet enters HR Insights.", "Approval note", "Optional verification or quality note", "Approve worksheet"],
        "request-changes": ["Return for employee changes", "Explain exactly what the employee must correct before resubmitting.", "Required changes", "List the flaws and acceptance criteria", "Send changes"],
        "insight-rework": ["Create an Insights rework plan", "Translate the HR or CEO feedback into clear corrective work for the employee.", "Rework guidance", "Explain the flaws, correction and expected evidence", "Assign rework"],
    }[actionDialog.action] : null;

    const branches = [...new Set(tasks.map((item) => item.departmentBranch))].sort();
    const filtered = tasks.filter((item) => (statusFilter === "ALL" || item.status === statusFilter)
        && (branchFilter === "ALL" || item.departmentBranch === branchFilter)
        && `${item.title} ${item.description} ${item.departmentBranch}`.toLowerCase().includes(query.toLowerCase()));
    const employeeName = (id: string) => employees.find((item) => (item.uuid ?? item.id) === id)?.name ?? "Assigned employee";
    const pendingVisitorApprovals = role === "Team Lead" ? appointments.filter((item) => item.status === "Awaiting Team Lead") : [];
    const insightReworkQueue = role === "Team Lead" ? tasks.filter((item) => item.status === "INSIGHT_REWORK_REQUESTED") : [];
    const metric = (statuses: WorkTask["status"][]) => tasks.filter((item) => statuses.includes(item.status)).length;

    return <section className="work-board-page">
        <PageTitle eyebrow="DEPARTMENT TASK SHEETS" title={role === "Team Lead" ? "Team task sheets" : "My task sheets"}
                   detail={role === "Team Lead" ? "Create a private task sheet for one employee in your department and review that employee’s delivery."
                       : "Only task sheets assigned to your Employee profile appear here. Other employees’ work is never shown."}
                   action={role === "Team Lead" && <button className="button button-primary" onClick={() => setShowCreate((value) => !value)}><FileText size={17} /> {showCreate ? "Close task form" : "Create task sheet"}</button>} />
        <div className="work-notification-note glass-panel"><MessageSquare size={19} /><span><strong>Visitor updates stay in Notifications</strong><small>Appointments no longer occupy Employee or Team Lead navigation. HR visitor cards and workflow decisions are delivered through the internal message service.</small></span></div>
        {role === "Team Lead" && insightReworkQueue.length > 0 && <section className="work-rework-alert glass-panel"><span><RotateCcw size={20} /></span><div><small>INSIGHTS ACTION REQUIRED</small><strong>{insightReworkQueue.length} worksheet{insightReworkQueue.length === 1 ? "" : "s"} returned for rework</strong><p>Review the HR or CEO feedback and create an employee rework plan. Employees cannot restart until you provide guidance.</p></div><button className="button button-primary" onClick={() => { setStatusFilter("INSIGHT_REWORK_REQUESTED"); window.scrollTo({ top: 560, behavior: "smooth" }); }}>Review returned work</button></section>}
        <section className="work-metrics glass-panel">
            <div><span>My task sheets</span><strong>{tasks.length}</strong><small>{role === "Employee" ? "Assigned only to you" : "Your department only"}</small></div><i />
            <div><span>In progress</span><strong>{metric(["IN_PROGRESS", "CHANGES_REQUESTED"])}</strong><small>Currently being worked</small></div><i />
            <div><span>Awaiting review</span><strong>{metric(["COMPLETED"])}</strong><small>Team Lead action required</small></div><i />
            <div><span>Insights rework</span><strong>{metric(["INSIGHT_REWORK_REQUESTED"])}</strong><small>HR or CEO feedback</small></div>
        </section>
        {showCreate && <form className="work-create-form task-sheet-form panel glass-panel" onSubmit={createTask}>
            <div className="panel-heading"><div><span>NEW TASK SHEET</span><h2>Create an employee worksheet</h2><p>Select one active employee from your department. The completed sheet remains private to that employee, you and authorized HR reporting.</p></div><FileText size={22} /></div>
            <div className="modal-form-grid"><label>Department employee<select name="employeeId" required defaultValue=""><option value="" disabled>Select an employee in your department</option>{eligibleEmployees.map((item) => <option key={item.uuid ?? item.id} value={item.uuid ?? item.id}>{item.name} · {item.role}</option>)}</select></label>
                <label>Department / branch<input value={assignedDepartment ? `${assignedDepartment.name} · ${assignedDepartment.code}` : "No department assigned"} readOnly aria-readonly="true" /></label>
                <label>Task<input name="title" minLength={3} maxLength={160} required placeholder="What should the employee complete?" /></label>
                <label>Due date<input name="dueDate" type="date" min={officeToday()} defaultValue={nextBusinessDays(3)[0]} required /></label>
                <label className="full-field">Worksheet instructions<textarea name="description" minLength={5} maxLength={1000} required placeholder="Describe the work, expected result and acceptance criteria" /></label></div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={busy === "create" || eligibleEmployees.length === 0 || !assignedDepartment}><Send size={16} />{busy === "create" ? "Creating…" : "Create sheet & notify"}</button></div>
            {!assignedDepartment && <div className="login-error" role="alert">Your Team Lead account has no active department assignment. Ask HR to assign you as the Team Lead of a department.</div>}
            {assignedDepartment && eligibleEmployees.length === 0 && <div className="login-error" role="alert">No active Employee login is available in {assignedDepartment.name}. HR must add or activate an Employee in this department before a task sheet can be assigned.</div>}
        </form>}
        <div className="work-toolbar glass-panel"><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search my task sheets" /></div><select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value="ALL">All departments</option>{branches.map((item) => <option key={item}>{item}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CHANGES_REQUESTED", "INSIGHT_REWORK_REQUESTED", "APPROVED", "ACKNOWLEDGED"] as WorkTask["status"][]).map((item) => <option key={item} value={item}>{workTaskStatusLabel(item)}</option>)}</select></div>
        <div className="task-sheet-grid">
            {filtered.map((task) => <article className="task-sheet-card glass-panel" key={task.id}>
                <header><div><span className="task-sheet-label"><FileText size={14} /> TASK SHEET</span><small>#{task.id.slice(-8).toUpperCase()}</small></div><WorkTaskPill status={task.status} /></header>
                <div className="task-sheet-title"><span className="work-category">{task.departmentBranch}</span><h2>{task.title}</h2><p>{task.description}</p></div>
                <div className="task-sheet-fields"><div><span>Assigned employee</span><strong>{role === "Employee" ? "Assigned to you" : employeeName(task.employeeId)}</strong></div><div><span>Department / branch</span><strong>{task.departmentBranch}</strong></div><div><span>Due date</span><strong>{new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></div><div><span>Current stage</span><strong>{workTaskStatusLabel(task.status)}</strong></div></div>
                <div className="task-flow" aria-label={`Worksheet stage: ${workTaskStatusLabel(task.status)}`}><span className="done"><i>1</i>Assigned</span><b /><span className={["IN_PROGRESS", "COMPLETED", "APPROVED", "ACKNOWLEDGED", "CHANGES_REQUESTED"].includes(task.status) ? "done" : task.status === "ASSIGNED" ? "current" : ""}><i>2</i>Employee work</span><b /><span className={["APPROVED", "ACKNOWLEDGED"].includes(task.status) ? "done" : task.status === "COMPLETED" ? "current" : ""}><i>3</i>Team Lead review</span><b /><span className={task.status === "ACKNOWLEDGED" ? "done" : task.status === "INSIGHT_REWORK_REQUESTED" ? "returned" : ["APPROVED"].includes(task.status) ? "current" : ""}><i>4</i>Insights</span></div>
                {task.insightReviewReason && <div className="insight-rework-card"><span><RotateCcw size={15} /> INSIGHTS REWORK · CYCLE {task.reworkCycle ?? 1}</span><strong>{task.insightReviewSource === "CEO" ? "CEO feedback" : "HR feedback"}</strong><p>{task.insightReviewReason}</p>{task.status === "INSIGHT_REWORK_REQUESTED" && <small>Waiting for the Team Lead to convert this feedback into an employee rework plan.</small>}</div>}
                {(task.employeeUpdate || task.teamLeadReview) && <div className="task-sheet-responses">{task.employeeUpdate && <div><span>Employee work update</span><p>{task.employeeUpdate}</p></div>}{task.teamLeadReview && <div><span>Team Lead decision</span><p>{task.teamLeadReview}</p></div>}</div>}
                <footer className="work-task-actions">
                    {role === "Employee" && ["ASSIGNED", "CHANGES_REQUESTED"].includes(task.status) && <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => openTaskAction(task, "start")}><Clock3 size={14} /> Start</button>}
                    {role === "Employee" && ["ASSIGNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(task.status) && <button className="button button-primary" disabled={Boolean(busy)} onClick={() => openTaskAction(task, "complete")}><CheckCircle2 size={14} /> Complete</button>}
                    {role === "Team Lead" && task.status === "COMPLETED" && <><button className="button button-reject" disabled={Boolean(busy)} onClick={() => openTaskAction(task, "request-changes")}><X size={14} /> Request changes</button><button className="button button-approve" disabled={Boolean(busy)} onClick={() => openTaskAction(task, "approve")}><BadgeCheck size={14} /> Approve delivery</button></>}
                    {role === "Team Lead" && task.status === "INSIGHT_REWORK_REQUESTED" && <button className="button button-primary" disabled={Boolean(busy)} onClick={() => openTaskAction(task, "insight-rework")}><RotateCcw size={14} /> Create rework plan</button>}
                    {role === "Employee" && task.status === "APPROVED" && <button className="button button-approve" disabled={Boolean(busy)} onClick={() => void act(task, "acknowledge")}><BadgeCheck size={14} /> Acknowledge</button>}
                </footer>
            </article>)}{filtered.length === 0 && <div className="empty-state task-sheet-empty"><FileText size={29} /><strong>{role === "Employee" ? "No task sheet is assigned to you" : "No department task sheets yet"}</strong><small>{role === "Employee" ? "When your Team Lead creates a sheet for your Employee ID, it will appear here automatically." : "Create a task sheet and select one active employee from your department."}</small></div>}
        </div>
        {role === "Team Lead" && <article className="panel glass-panel work-visitor-approvals"><div className="panel-heading"><div><span>VISITOR WORKFLOW</span><h2>Department visitor approvals</h2><p>Visitor approval remains available here so removing Appointments never breaks Security → Reception → HR routing.</p></div><b>{pendingVisitorApprovals.length}</b></div>{pendingVisitorApprovals.map((item) => <div className="approval-item" key={item.id}><div className="approval-person"><span className="avatar">{item.initials}</span><span><strong>{item.visitor}</strong><small>Visiting {item.host} · {item.referenceNumber}</small></span></div><p>“{item.arrivalPurpose ?? item.purpose}”</p><div className="approval-actions"><button className="button button-reject" onClick={() => void decideAppointment(item.id, "reject")}><X size={15} /> Reject visit</button><button className="button button-approve" onClick={() => void decideAppointment(item.id, "approve")}><Check size={15} /> Approve visit</button></div></div>)}{pendingVisitorApprovals.length === 0 && <div className="empty-state"><ShieldCheck size={27} /><strong>No visitor approvals waiting</strong><small>HR-routed department visitors will appear here.</small></div>}</article>}
        {actionDialog && taskActionCopy && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActionDialog(null); }}><section className="modal work-action-modal" role="dialog" aria-modal="true" aria-labelledby="work-action-title"><header><div><span>WORKSHEET ACTION</span><h2 id="work-action-title">{taskActionCopy[0]}</h2><p>{taskActionCopy[1]}</p></div><button className="icon-button" type="button" onClick={() => setActionDialog(null)} aria-label="Close worksheet action"><X size={18} /></button></header><form onSubmit={submitTaskAction}><div className="work-action-context"><span className="avatar">{visitorInitials(employeeName(actionDialog.task.employeeId))}</span><span><small>{actionDialog.task.departmentBranch} · {workTaskStatusLabel(actionDialog.task.status)}</small><strong>{actionDialog.task.title}</strong></span></div>{actionDialog.action === "insight-rework" && <div className="modal-review-source"><RotateCcw size={16} /><span><small>{actionDialog.task.insightReviewSource === "CEO" ? "CEO FEEDBACK" : "HR FEEDBACK"}</small><strong>{actionDialog.task.insightReviewReason}</strong></span></div>}<label>{taskActionCopy[2]}<textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder={taskActionCopy[3]} minLength={["complete", "request-changes", "insight-rework"].includes(actionDialog.action) ? 5 : undefined} maxLength={1000} required={["complete", "request-changes", "insight-rework"].includes(actionDialog.action)} autoFocus /></label><small className="dialog-character-count">{actionNote.length}/1000</small>{error && <div className="login-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setActionDialog(null)}>Cancel</button><button className="button button-primary" disabled={Boolean(busy)}>{busy ? "Saving…" : taskActionCopy[4]}<ArrowRight size={15} /></button></div></form></section></div>}
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}{error && !actionDialog && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function TeamLeadPerformanceView({ departments, employees, staffAccounts }: {
    departments: Department[]; employees: Employee[]; staffAccounts: StaffAccount[];
}) {
    const [items, setItems] = useState<TeamLeadPerformance[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                if (isBackendConfigured) {
                    const values = await brainServeApi.teamLeadPerformance(); if (active) setItems(values);
                } else {
                    const grouped = new Map<string, WorkTask[]>();
                    readDemoWorkTasks().forEach((task) => { const key = `${task.teamLeadUserId}:${task.departmentId}`;
                        grouped.set(key, [...(grouped.get(key) ?? []), task]); });
                    setItems([...grouped.values()].map((tasks) => { const first = tasks[0]; const approved = tasks.filter((item) => ["APPROVED", "ACKNOWLEDGED"].includes(item.status));
                        return { teamLeadUserId: first.teamLeadUserId, departmentId: first.departmentId, totalTasks: tasks.length,
                            completedTasks: tasks.filter((item) => ["COMPLETED", "APPROVED", "ACKNOWLEDGED"].includes(item.status)).length,
                            approvedTasks: approved.length, inProgressTasks: tasks.filter((item) => item.status === "IN_PROGRESS").length,
                            pendingReviewTasks: tasks.filter((item) => item.status === "COMPLETED").length,
                            overdueTasks: tasks.filter((item) => item.dueDate < officeToday() && !["APPROVED", "ACKNOWLEDGED"].includes(item.status)).length,
                            completionRate: Math.round(approved.length * 100 / tasks.length), lastApprovedAt: approved.map((item) => item.approvedAt).filter(Boolean).sort().at(-1) ?? null };
                    }));
                }
                setError("");
            } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Team Lead performance could not be loaded."); }
        };
        void load(); return () => { active = false; };
    }, []);
    const leadName = (userId: string) => staffAccounts.find((item) => item.userId === userId)?.fullName
        ?? (!isBackendConfigured ? initialStaffAccounts.find((item) => item.userId === userId)?.fullName : undefined)
        ?? "Team Lead";
    const departmentName = (id: string) => departments.find((item) => item.id === id)?.name ?? "Assigned department";
    const total = items.reduce((sum, item) => sum + item.totalTasks, 0);
    const approved = items.reduce((sum, item) => sum + item.approvedTasks, 0);
    const pending = items.reduce((sum, item) => sum + item.pendingReviewTasks, 0);
    const overdue = items.reduce((sum, item) => sum + item.overdueTasks, 0);
    return <section className="team-lead-performance-page"><PageTitle eyebrow="HR DELIVERY INTELLIGENCE" title="Team Lead performance"
                                                                      detail="Review department delivery, completion quality and overdue work. Every Team Lead approval also sends HR a BrainServe Internal Calls update." />
        <section className="work-metrics glass-panel"><div><span>Tracked work</span><strong>{total}</strong><small>Across Team Lead departments</small></div><i /><div><span>Approved</span><strong>{approved}</strong><small>Verified by Team Leads</small></div><i /><div><span>Awaiting review</span><strong>{pending}</strong><small>Completed by employees</small></div><i /><div><span>Overdue</span><strong>{overdue}</strong><small>Needs HR attention</small></div></section>
        <article className="performance-table glass-panel"><div className="performance-head"><span>Team Lead & department</span><span>Delivery</span><span>In progress</span><span>Awaiting review</span><span>Overdue</span><span>Last approval</span></div>{items.map((item) => <div className="performance-row" key={`${item.teamLeadUserId}:${item.departmentId}`}><div className="person-cell"><span className="avatar">{visitorInitials(leadName(item.teamLeadUserId))}</span><span><strong>{leadName(item.teamLeadUserId)}</strong><small>{departmentName(item.departmentId)} · {employees.filter((employee) => employee.departmentId === item.departmentId).length} employees</small></span></div><div><strong className="performance-rate">{item.completionRate}%</strong><small>{item.approvedTasks}/{item.totalTasks} approved</small></div><div><strong>{item.inProgressTasks}</strong><small>Active work</small></div><div><strong>{item.pendingReviewTasks}</strong><small>Needs Team Lead</small></div><div><strong className={item.overdueTasks ? "danger-text" : ""}>{item.overdueTasks}</strong><small>Past due</small></div><div><strong>{item.lastApprovedAt ? new Date(item.lastApprovedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No approvals"}</strong><small>Live update sent to HR</small></div></div>)}{items.length === 0 && <div className="empty-state"><Sparkles size={28} /><strong>No Team Lead delivery data yet</strong><small>Performance appears after a Team Lead assigns the first department task.</small></div>}</article>{error && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function insightStatusLabel(status: WorkInsight["auditStatus"]) {
    return { NOT_AUDITED: "Not audited", HR_REWORK_REQUESTED: "Returned by HR",
        PENDING_CEO_APPROVAL: "Awaiting CEO", CEO_APPROVED: "CEO approved",
        CEO_REWORK_REQUESTED: "Returned by CEO", REWORK_ASSIGNED: "Rework assigned" }[status];
}

function WorkInsightsView({ role, userEmail, departments, employees, staffAccounts }: {
    role: Role; userEmail: string; departments: Department[]; employees: Employee[]; staffAccounts: StaffAccount[];
}) {
    const [weekStart, setWeekStart] = useState(() => workWeekStart());
    const [items, setItems] = useState<WorkInsight[]>([]);
    const [busy, setBusy] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [departmentFilter, setDepartmentFilter] = useState("ALL");
    const [expandedTaskId, setExpandedTaskId] = useState("");
    const [decisionDialog, setDecisionDialog] = useState<{ item: WorkInsight; kind: "HR_REWORK" | "CEO_REWORK" | "CEO_APPROVE" } | null>(null);
    const [decisionNote, setDecisionNote] = useState("");

    const demoInsight = useCallback((task: WorkTask, retained?: WorkInsight): WorkInsight => {
        const employee = employees.find((item) => (item.uuid ?? item.id) === task.employeeId);
        const teamLead = staffAccounts.find((item) => item.userId === task.teamLeadUserId)
            ?? initialStaffAccounts.find((item) => item.userId === task.teamLeadUserId);
        return retained ?? { auditRecordId: null, workTaskId: task.id,
            weekStart: workWeekStart(officeDateFromInstant(task.createdAt)), departmentId: task.departmentId,
            departmentName: departments.find((item) => item.id === task.departmentId)?.name ?? task.departmentBranch,
            employeeId: task.employeeId, employeeNumber: employee?.id ?? task.employeeId,
            employeeName: employee?.name ?? "Assigned employee", teamLeadUserId: task.teamLeadUserId,
            teamLeadName: teamLead?.fullName ?? "Team Lead", taskTitle: task.title, taskStatus: task.status,
            auditStatus: "NOT_AUDITED", hrAuditedAt: null, ceoDecidedAt: null, ceoRemarks: null,
            reworkRequestedByRole: null, reworkReason: null, reworkRequestedAt: null,
            teamLeadReworkGuidance: null, teamLeadRespondedAt: null, reworkCycle: 0 };
    }, [departments, employees, staffAccounts]);

    const load = useCallback(async () => {
        try {
            if (isBackendConfigured) setItems(await brainServeApi.workInsights(weekStart));
            else {
                const retained = readDemoWorkInsights().filter((item) => item.weekStart === weekStart);
                if (role === "HR Admin") {
                    const retainedByTask = new Map(retained.map((item) => [item.workTaskId, item]));
                    setItems(readDemoWorkTasks().filter((task) => workWeekStart(officeDateFromInstant(task.createdAt)) === weekStart)
                        .map((task) => demoInsight(task, retainedByTask.get(task.id))));
                } else if (role === "Manager") {
                    const account = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                    const departmentId = demoAccountDepartment(account?.id ?? userEmail, userEmail);
                    setItems(departmentId ? retained.filter((item) => item.departmentId === departmentId) : []);
                } else setItems(retained);
            }
            setError("");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Weekly work insights could not be loaded."); }
    }, [demoInsight, role, userEmail, weekStart]);

    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);

    const auditTask = async (item: WorkInsight) => {
        setBusy(item.workTaskId); setError(""); setMessage("");
        try {
            let updated: WorkInsight;
            if (isBackendConfigured) updated = await brainServeApi.auditWorkInsight(item.workTaskId);
            else {
                updated = { ...item, auditRecordId: item.auditRecordId ?? newClientId(), auditStatus: "PENDING_CEO_APPROVAL",
                    hrAuditedAt: new Date().toISOString(), ceoDecidedAt: null, ceoRemarks: null };
                writeDemoWorkInsights([updated, ...readDemoWorkInsights().filter((value) => value.workTaskId !== item.workTaskId)]);
                const sender = readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                const ceo = readDemoAccounts().find((account) => account.role === "ROLE_CEO" && account.status === "ACTIVE");
                if (sender && ceo) {
                    const now = new Date().toISOString();
                    writeDemoInternalNotifications([{ id: newClientId(), senderUserId: sender.id,
                        recipientUserId: ceo.id, senderName: sender.fullName, recipientName: ceo.fullName,
                        message: `HR audited ${item.employeeName}'s worksheet “${item.taskTitle}” in ${item.departmentName}. CEO approval is required.`,
                        deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                        senderEmail: sender.email, recipientEmail: ceo.email }, ...readDemoInternalNotifications()]);
                }
            }
            setItems((values) => values.map((value) => value.workTaskId === item.workTaskId ? updated : value));
            setMessage(item.auditStatus === "REWORK_ASSIGNED"
                ? "Reworked worksheet audited again and returned to the CEO approval queue."
                : "Worksheet marked audited and sent to the CEO approval queue.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The worksheet could not be audited."); }
        finally { setBusy(""); }
    };

    const requestHrRework = async (item: WorkInsight, reason: string) => {
        if (!reason.trim()) { setError("HR must enter the flaws before returning work to the Team Lead."); return false; }
        setBusy(`${item.workTaskId}:hr-rework`); setError(""); setMessage("");
        try {
            let updated: WorkInsight;
            if (isBackendConfigured) updated = await brainServeApi.requestWorkInsightRework(item.workTaskId, reason.trim());
            else {
                const now = new Date().toISOString();
                updated = { ...item, auditRecordId: item.auditRecordId ?? newClientId(), auditStatus: "HR_REWORK_REQUESTED",
                    reworkRequestedByRole: "HR_ADMIN", reworkReason: reason.trim(), reworkRequestedAt: now,
                    teamLeadReworkGuidance: null, teamLeadRespondedAt: null, reworkCycle: (item.reworkCycle ?? 0) + 1 };
                writeDemoWorkInsights([updated, ...readDemoWorkInsights().filter((value) => value.workTaskId !== item.workTaskId)]);
                writeDemoWorkTasks(readDemoWorkTasks().map((task) => task.id === item.workTaskId
                    ? { ...task, status: "INSIGHT_REWORK_REQUESTED" as const, insightReviewSource: "HR",
                        insightReviewReason: reason.trim(), insightReviewRequestedAt: now,
                        reworkCycle: (task.reworkCycle ?? 0) + 1, approvedAt: null, acknowledgedAt: null }
                    : task));
                const sender = readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                const recipient = readDemoAccounts().find((account) => account.id === item.teamLeadUserId);
                if (sender && recipient) writeDemoInternalNotifications([{ id: newClientId(), senderUserId: sender.id,
                    recipientUserId: recipient.id, senderName: sender.fullName, recipientName: recipient.fullName,
                    message: `HR returned “${item.taskTitle}” for rework. Flaws: ${reason.trim()}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: sender.email, recipientEmail: recipient.email }, ...readDemoInternalNotifications()]);
            }
            setItems((values) => values.map((value) => value.workTaskId === item.workTaskId ? updated : value));
            setMessage("Worksheet returned to the assigned Team Lead with a mandatory rework reason.");
            return true;
        } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "The rework request could not be saved."); return false; }
        finally { setBusy(""); }
    };

    const decide = async (item: WorkInsight, approved: boolean, remarks: string) => {
        if (!item.auditRecordId) return false;
        if (!approved && !remarks.trim()) { setError("CEO must explain the flaws before returning work for rework."); return false; }
        setBusy(item.auditRecordId); setError(""); setMessage("");
        try {
            const updated = isBackendConfigured
                ? await brainServeApi.decideWorkInsight(item.auditRecordId, approved, remarks.trim())
                : { ...item, auditStatus: approved ? "CEO_APPROVED" as const : "CEO_REWORK_REQUESTED" as const,
                    ceoDecidedAt: new Date().toISOString(), ceoRemarks: remarks.trim() || null,
                    reworkRequestedByRole: approved ? item.reworkRequestedByRole : "CEO",
                    reworkReason: approved ? item.reworkReason : remarks.trim(),
                    reworkRequestedAt: approved ? item.reworkRequestedAt : new Date().toISOString(),
                    teamLeadReworkGuidance: approved ? item.teamLeadReworkGuidance : null,
                    teamLeadRespondedAt: approved ? item.teamLeadRespondedAt : null,
                    reworkCycle: approved ? item.reworkCycle : (item.reworkCycle ?? 0) + 1 };
            if (!isBackendConfigured) writeDemoWorkInsights(readDemoWorkInsights().map((value) =>
                value.auditRecordId === item.auditRecordId ? updated : value));
            if (!isBackendConfigured && !approved) {
                const now = new Date().toISOString();
                writeDemoWorkTasks(readDemoWorkTasks().map((task) => task.id === item.workTaskId
                    ? { ...task, status: "INSIGHT_REWORK_REQUESTED" as const, insightReviewSource: "CEO",
                        insightReviewReason: remarks.trim(), insightReviewRequestedAt: now,
                        reworkCycle: (task.reworkCycle ?? 0) + 1, approvedAt: null, acknowledgedAt: null }
                    : task));
                const sender = readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
                const recipient = readDemoAccounts().find((account) => account.id === item.teamLeadUserId);
                if (sender && recipient) writeDemoInternalNotifications([{ id: newClientId(), senderUserId: sender.id,
                    recipientUserId: recipient.id, senderName: sender.fullName, recipientName: recipient.fullName,
                    message: `CEO returned “${item.taskTitle}” for rework. Flaws: ${remarks.trim()}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: sender.email, recipientEmail: recipient.email }, ...readDemoInternalNotifications()]);
            }
            setItems((values) => values.map((value) => value.auditRecordId === item.auditRecordId ? updated : value));
            setMessage(approved ? "Weekly work audit approved and retained for System Admin."
                : "Audit rejected with feedback. The assigned Team Lead now has an actionable rework card.");
            return true;
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The CEO decision could not be saved."); return false; }
        finally { setBusy(""); }
    };

    const openDecision = (item: WorkInsight, kind: "HR_REWORK" | "CEO_REWORK" | "CEO_APPROVE") => {
        setDecisionDialog({ item, kind });
        setDecisionNote(kind === "CEO_APPROVE" ? "" : item.reworkReason ?? "");
        setError(""); setMessage("");
    };

    const submitDecision = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!decisionDialog) return;
        if (decisionDialog.kind !== "CEO_APPROVE" && decisionNote.trim().length < 5) {
            setError("Enter at least 5 characters describing the flaws and required correction."); return;
        }
        const succeeded = decisionDialog.kind === "HR_REWORK"
            ? await requestHrRework(decisionDialog.item, decisionNote)
            : await decide(decisionDialog.item, decisionDialog.kind === "CEO_APPROVE", decisionNote);
        if (succeeded) { setDecisionDialog(null); setDecisionNote(""); }
    };

    const audited = items.filter((item) => item.auditStatus !== "NOT_AUDITED").length;
    const pending = items.filter((item) => item.auditStatus === "PENDING_CEO_APPROVAL").length;
    const rework = items.filter((item) => ["HR_REWORK_REQUESTED", "CEO_REWORK_REQUESTED", "REWORK_ASSIGNED"].includes(item.auditStatus)).length;
    const insightDepartments = [...new Set(items.map((item) => item.departmentName))].sort();
    const visibleItems = items.filter((item) => (statusFilter === "ALL" || item.auditStatus === statusFilter)
        && (departmentFilter === "ALL" || item.departmentName === departmentFilter)
        && `${item.employeeName} ${item.employeeNumber} ${item.taskTitle} ${item.teamLeadName} ${item.departmentName}`.toLowerCase().includes(query.toLowerCase()));
    const decisionCopy = decisionDialog ? decisionDialog.kind === "CEO_APPROVE"
            ? ["Approve weekly work audit", "Confirm that HR evidence and Team Lead verification are sufficient.", "CEO decision note", "Optional governance note", "Approve audit"]
            : decisionDialog.kind === "CEO_REWORK"
                ? ["Reject audit and request rework", "Your feedback will appear immediately in the assigned Team Lead’s Work Board.", "CEO findings", "Describe the flaws, missing evidence and expected correction", "Return for rework"]
                : ["Return worksheet for rework", "HR feedback will be retained and routed to the assigned Team Lead.", "HR findings", "Describe the flaws, missing evidence and expected correction", "Return to Team Lead"]
        : null;
    return <section className="work-insights-page"><PageTitle eyebrow="WEEKLY WORK GOVERNANCE"
                                                              title={role === "System Admin" ? "Retained work insight register" : role === "CEO" ? "Work audit approvals"
                                                                  : role === "Manager" ? "Department work oversight" : "Work insights"}
                                                              detail={role === "HR Admin" ? "Audit completed worksheets or return flawed work to the Team Lead. Reworked delivery follows the same retained approval cycle."
                                                                  : role === "CEO" ? "Approve completed audits or return them with mandatory feedback that becomes actionable for the assigned Team Lead."
                                                                      : role === "Manager" ? "Review HR-audited work and CEO decisions for your assigned department. Manager access is read-only."
                                                                          : "Review weekly employee work, rejection reasons, Team Lead rework plans and final decisions retained for future audits."}
                                                              action={<label className="insight-week-picker">Week commencing<input type="date" value={weekStart}
                                                                                                                                   onChange={(event) => { if (event.target.value) setWeekStart(workWeekStart(event.target.value)); }} /></label>} />
        <section className="work-metrics glass-panel"><div><span>Weekly worksheets</span><strong>{items.length}</strong><small>{weekStart}</small></div><i />
            <div><span>HR reviewed</span><strong>{audited}</strong><small>Retained snapshots</small></div><i />
            <div><span>Awaiting CEO</span><strong>{pending}</strong><small>Decision required</small></div><i />
            <div><span>Rework cycle</span><strong>{rework}</strong><small>Feedback being resolved</small></div></section>
        <article className="panel glass-panel insight-register"><div className="panel-heading"><div><span>WEEKLY WORK TABLE</span><h2>Employee worksheet audit trail</h2><p>Open any row to review the complete approval and rework cycle without crowding the table.</p></div><FileClock size={22} /></div>
            <div className="insight-toolbar"><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, worksheet or Team Lead" /></div><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="ALL">All departments</option>{insightDepartments.map((department) => <option key={department}>{department}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All audit states</option>{(["NOT_AUDITED", "HR_REWORK_REQUESTED", "PENDING_CEO_APPROVAL", "CEO_REWORK_REQUESTED", "REWORK_ASSIGNED", "CEO_APPROVED"] as WorkInsight["auditStatus"][]).map((status) => <option key={status} value={status}>{insightStatusLabel(status)}</option>)}</select></div>
            <div className="records-table-wrap"><table className="records-table work-insight-table"><thead><tr><th>Employee</th><th>Worksheet</th><th>Assigned by</th><th>Department</th><th>Task status</th><th>Audit status</th><th>Action</th></tr></thead>
                {visibleItems.map((item) => <tbody key={item.workTaskId} className={expandedTaskId === item.workTaskId ? "expanded" : ""}><tr><td><strong>{item.employeeName}</strong><small>{item.employeeNumber}</small></td>
                    <td><strong>{item.taskTitle}</strong><small>Week of {item.weekStart}</small></td><td><strong>{item.teamLeadName}</strong><small>Team Lead</small></td>
                    <td><strong>{item.departmentName}</strong><small>{item.departmentId}</small></td><td><span className="insight-pill">{workTaskStatusLabel(item.taskStatus)}</span></td>
                    <td><span className={`insight-pill insight-${item.auditStatus.toLowerCase().replaceAll("_", "-")}`}>{insightStatusLabel(item.auditStatus)}</span><small>Cycle {item.reworkCycle || 0}</small></td>
                    <td><div className="insight-row-actions"><button className="button button-secondary" onClick={() => setExpandedTaskId((value) => value === item.workTaskId ? "" : item.workTaskId)}>{expandedTaskId === item.workTaskId ? "Close details" : "View cycle"}<ChevronRight size={13} /></button>{role === "HR Admin" && ["NOT_AUDITED", "REWORK_ASSIGNED"].includes(item.auditStatus) && ["APPROVED", "ACKNOWLEDGED"].includes(item.taskStatus)
                        ? <div className="insight-actions"><button className="button button-reject" disabled={Boolean(busy)} onClick={() => openDecision(item, "HR_REWORK")}><RotateCcw size={14} /> Reject & rework</button><button className="button button-primary" disabled={Boolean(busy)} onClick={() => void auditTask(item)}><BadgeCheck size={14} />{busy === item.workTaskId ? "Auditing…" : item.auditStatus === "REWORK_ASSIGNED" ? "Re-audit" : "Mark audited"}</button></div>
                        : role === "HR Admin" && item.auditStatus === "NOT_AUDITED" ? <small>Await Team Lead approval</small>
                            : role === "CEO" && item.auditStatus === "PENDING_CEO_APPROVAL" ? <div className="insight-actions"><button className="button button-reject" disabled={Boolean(busy)} onClick={() => openDecision(item, "CEO_REWORK")}><RotateCcw size={14} /> Reject & rework</button><button className="button button-approve" disabled={Boolean(busy)} onClick={() => openDecision(item, "CEO_APPROVE")}><Check size={14} /> Approve</button></div>
                                : <small>{item.auditStatus === "REWORK_ASSIGNED" && ["APPROVED", "ACKNOWLEDGED"].includes(item.taskStatus) ? "Rework ready for HR audit"
                                    : item.auditStatus === "HR_REWORK_REQUESTED" || item.auditStatus === "CEO_REWORK_REQUESTED" ? "Waiting for Team Lead plan"
                                        : item.auditStatus === "REWORK_ASSIGNED" && item.taskStatus === "COMPLETED" ? "Waiting for Team Lead reapproval"
                                            : item.auditStatus === "REWORK_ASSIGNED" ? "Employee rework in progress"
                                                : item.ceoDecidedAt ? `Decided ${new Date(item.ceoDecidedAt).toLocaleDateString("en-IN")}` : "Retained for audit"}</small>}</div></td></tr>{expandedTaskId === item.workTaskId && <tr className="insight-detail-row"><td colSpan={7}><div className="insight-cycle"><header><span><small>AUDIT CYCLE</small><strong>Worksheet governance history</strong></span><b>Cycle {item.reworkCycle || 0}</b></header><div className="insight-cycle-steps"><span className="done"><i><BadgeCheck size={13} /></i><strong>Team Lead review</strong><small>{workTaskStatusLabel(item.taskStatus)}</small></span><b /><span className={item.hrAuditedAt ? "done" : "current"}><i><UserCog size={13} /></i><strong>HR Insights</strong><small>{item.hrAuditedAt ? new Date(item.hrAuditedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Waiting for review"}</small></span><b /><span className={item.auditStatus === "CEO_APPROVED" ? "done" : item.auditStatus === "PENDING_CEO_APPROVAL" ? "current" : item.reworkReason ? "returned" : ""}><i><ShieldCheck size={13} /></i><strong>CEO decision</strong><small>{insightStatusLabel(item.auditStatus)}</small></span><b /><span className={item.teamLeadReworkGuidance ? "done" : item.reworkReason ? "current" : ""}><i><RotateCcw size={13} /></i><strong>Rework response</strong><small>{item.teamLeadReworkGuidance ? "Guidance assigned" : item.reworkReason ? "Waiting for Team Lead" : "Not required"}</small></span></div><div className="insight-evidence-grid"><article><small>Reviewer findings</small><strong>{item.reworkRequestedByRole === "CEO" ? "CEO feedback" : item.reworkRequestedByRole ? "HR feedback" : "No rejection recorded"}</strong><p>{item.reworkReason ?? "This worksheet has not been returned for rework."}</p></article><article><small>Team Lead corrective plan</small><strong>{item.teamLeadReworkGuidance ? item.teamLeadName : "Awaiting response"}</strong><p>{item.teamLeadReworkGuidance ?? "A corrective plan will appear here after the Team Lead responds."}</p></article><article><small>Retention evidence</small><strong>{item.auditRecordId ? "Database snapshot retained" : "Live worksheet"}</strong><p>{item.auditRecordId ? `Audit record ${item.auditRecordId.slice(0, 8).toUpperCase()} · Week ${item.weekStart}` : "HR has not yet created the retained audit snapshot."}</p></article></div></div></td></tr>}</tbody>)}
            </table>{visibleItems.length === 0 && <div className="empty-state table-empty"><FileClock size={28} /><strong>No matching weekly work records</strong><small>{items.length ? "Change the search or filters to see more records." : role === "HR Admin" ? "Worksheets assigned during this week will appear here." : role === "Manager" ? "HR-audited work from your assigned department will appear here." : "HR-audited worksheets will appear after submission."}</small></div>}</div>
        </article>{decisionDialog && decisionCopy && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDecisionDialog(null); }}><section className="modal insight-decision-modal" role="dialog" aria-modal="true" aria-labelledby="insight-decision-title"><header><div><span>INSIGHTS DECISION</span><h2 id="insight-decision-title">{decisionCopy[0]}</h2><p>{decisionCopy[1]}</p></div><button className="icon-button" type="button" onClick={() => setDecisionDialog(null)} aria-label="Close Insights decision"><X size={18} /></button></header><form onSubmit={submitDecision}><div className="decision-work-context"><span className="avatar">{visitorInitials(decisionDialog.item.employeeName)}</span><span><small>{decisionDialog.item.departmentName} · {decisionDialog.item.employeeNumber}</small><strong>{decisionDialog.item.taskTitle}</strong><p>Assigned by {decisionDialog.item.teamLeadName}</p></span><span className={`insight-pill insight-${decisionDialog.item.auditStatus.toLowerCase().replaceAll("_", "-")}`}>{insightStatusLabel(decisionDialog.item.auditStatus)}</span></div><label>{decisionCopy[2]}<textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder={decisionCopy[3]} minLength={decisionDialog.kind === "CEO_APPROVE" ? undefined : 5} maxLength={1000} required={decisionDialog.kind !== "CEO_APPROVE"} autoFocus /></label><div className="decision-policy"><ShieldCheck size={16} /><span><strong>{decisionDialog.kind === "CEO_APPROVE" ? "Final approval" : "Controlled rework"}</strong><small>{decisionDialog.kind === "CEO_APPROVE" ? "This decision closes the active audit cycle and remains visible to System Admin." : "The worksheet is locked until the assigned Team Lead creates employee rework guidance."}</small></span></div><small className="dialog-character-count">{decisionNote.length}/1000</small>{error && <div className="login-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setDecisionDialog(null)}>Cancel</button><button className={`button ${decisionDialog.kind === "CEO_APPROVE" ? "button-approve" : "button-primary"}`} disabled={Boolean(busy)}>{busy ? "Saving…" : decisionCopy[4]}<ArrowRight size={15} /></button></div></form></section></div>}{message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}{error && !decisionDialog && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function AppointmentsView({
                              role,
                              appointments,
                              onCreate,
                              decideAppointment,
                              onSecurityIntake,
                              decideReceptionVisit,
                              forwardReceptionVisit,
                              currentEmployee,
                          }: {
    role: Role;
    appointments: Appointment[];
    onCreate: () => void;
    currentEmployee?: Employee;
    decideAppointment: (
        id: string,
        decision: "approve" | "reject",
    ) => Promise<void>;
    onSecurityIntake: (appointment: Appointment) => void;
    decideReceptionVisit: (
        id: string,
        decision: "verify" | "reject",
    ) => Promise<void>;
    forwardReceptionVisit: (id: string) => Promise<void>;
}) {
    const [filter, setFilter] = useState("All");
    const [query, setQuery] = useState("");
    const todayAppointments = appointments.filter((item) =>
        item.slotStart
            ? officeToday(new Date(item.slotStart)) === officeToday()
            : item.date === "Today",
    );
    const visibleAppointments =
        role === "HR Admin"
            ? todayAppointments.filter(
                (item) =>
                    item.assignedToCurrentActor !== false &&
                    (!currentEmployee?.departmentId ||
                        item.routingDepartmentId === currentEmployee.departmentId),
            )
            : role === "Employee"
                ? currentEmployee
                    ? todayAppointments.filter(
                        (item) =>
                            item.hostEmployeeId ===
                            (currentEmployee.uuid ?? currentEmployee.id) ||
                            item.host.toLowerCase() === currentEmployee.name.toLowerCase(),
                    )
                    : isBackendConfigured
                        ? appointments
                        : []
                : todayAppointments;
    const filterSource =
        filter === "Cancelled"
            ? appointments.filter((item) => item.status === "Cancelled")
            : visibleAppointments;
    const filtered = filterSource.filter(
        (item) =>
            (filter === "All" || item.status === filter) &&
            `${item.visitor} ${item.company} ${item.host} ${item.referenceNumber ?? ""}`
                .toLowerCase()
                .includes(query.toLowerCase()),
    );
    const employeeCards = role === "Employee" ? filtered : [];
    return (
        <>
            <PageTitle
                eyebrow="TODAY'S APPOINTMENTS"
                title={
                    role === "Employee"
                        ? "Your appointments today"
                        : ["Team Lead", "Manager"].includes(role)
                            ? "Today’s department calendar"
                            : "Today’s visits, clearly coordinated"
                }
                detail={
                    role === "Employee"
                        ? "Visitor details forwarded by HR appear here as read-only cards while your Team Lead completes the department decision."
                        : "This operational queue shows only today’s appointments. Use Reports → Explore Records for previous dates, monthly history, custom ranges and exports."
                }
                action={
                    [
                        "Security",
                        "Reception",
                        "HR Admin",
                        "Manager",
                        "Team Lead",
                    ].includes(role) && (
                        <button className="button button-primary" onClick={onCreate}>
                            <Plus size={17} />{" "}
                            {role === "Security"
                                ? "Create walk-in"
                                : ["Manager", "Team Lead"].includes(role)
                                    ? "Request appointment"
                                    : "Register visit"}
                        </button>
                    )
                }
            />
            <div className="toolbar glass-panel">
                <div className="tab-group">
                    {[
                        "All",
                        "Awaiting Security",
                        "Awaiting Reception",
                        "Awaiting HR",
                        "Awaiting Team Lead",
                        "Awaiting Manager",
                        "Awaiting CEO",
                        "Approved",
                        "Checked in",
                        "Cancelled",
                    ].map((item) => (
                        <button
                            key={item}
                            className={filter === item ? "active" : ""}
                            onClick={() => setFilter(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
                <div className="toolbar-search">
                    <Search size={17} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search appointments"
                    />
                </div>
            </div>
            {role === "Employee" && (
                <section
                    className="employee-visitor-cards"
                    aria-label="Visitors coming to meet you"
                >
                    {employeeCards.map((item) => {
                        const securityComplete =
                            Boolean(item.securityIntakeAt) ||
                            !["Pending", "Awaiting Security"].includes(item.status);
                        const receptionComplete =
                            Boolean(item.receptionVerifiedAt) ||
                            !["Pending", "Awaiting Security", "Awaiting Reception"].includes(
                                item.status,
                            );
                        const hrComplete =
                            Boolean(item.hrDecisionAt) ||
                            [
                                "Awaiting Team Lead",
                                "Approved",
                                "Checked in",
                                "Completed",
                                "Rejected",
                            ].includes(item.status);
                        const teamLeadComplete =
                            Boolean(item.teamLeadDecisionAt) ||
                            ["Approved", "Checked in", "Completed", "Rejected"].includes(
                                item.status,
                            );
                        const routeMessage =
                            item.status === "Awaiting Team Lead"
                                ? "HR forwarded this visitor to you. Your department Team Lead is reviewing the request."
                                : item.status === "Approved" || item.status === "Checked in"
                                    ? "The department decision is complete. Prepare to receive this visitor."
                                    : item.status === "Rejected"
                                        ? "This visit was declined. No visitor access should be expected."
                                        : item.status === "Awaiting HR"
                                            ? "Reception verified the visitor. HR review is pending."
                                            : item.status === "Awaiting Reception"
                                                ? "Security recorded the arrival. Reception verification is pending."
                                                : "The visitor request is moving through the BrainServe arrival workflow.";
                        return (
                            <article
                                className="employee-visitor-card glass-panel"
                                key={`employee-card-${item.id}`}
                            >
                                <header>
                                    <span className="avatar">{item.initials}</span>
                                    <span>
                    <small>VISITOR COMING TO MEET YOU</small>
                    <h2>{item.arrivalVisitorName ?? item.visitor}</h2>
                    <p>{item.company}</p>
                  </span>
                                    <StatusPill status={item.status} />
                                </header>
                                <div className="employee-visitor-purpose">
                                    <BriefcaseBusiness size={18} />
                                    <span>
                    <small>Purpose of visit</small>
                    <strong>{item.arrivalPurpose ?? item.purpose}</strong>
                  </span>
                                </div>
                                <div className="employee-visitor-facts">
                  <span>
                    <CalendarDays size={15} />
                    <small>Schedule</small>
                    <strong>
                      {item.date} · {item.time}
                    </strong>
                  </span>
                                    <span>
                    <CircleUserRound size={15} />
                    <small>Contact</small>
                    <strong>
                      {item.visitorEmail || "Not provided"}
                        {item.visitorPhone ? ` · ${item.visitorPhone}` : ""}
                    </strong>
                  </span>
                                    <span>
                    <IdCard size={15} />
                    <small>Reference</small>
                    <strong>{item.referenceNumber ?? item.id}</strong>
                  </span>
                                </div>
                                <div className="employee-visitor-route">
                  <span className={securityComplete ? "done" : ""}>
                    <ShieldCheck size={14} />
                    Security
                  </span>
                                    <i />
                                    <span className={receptionComplete ? "done" : ""}>
                    <BadgeCheck size={14} />
                    Reception
                  </span>
                                    <i />
                                    <span className={hrComplete ? "done" : ""}>
                    <UserCog size={14} />
                    HR
                  </span>
                                    <i />
                                    <span className={teamLeadComplete ? "done" : ""}>
                    <Users size={14} />
                    Team Lead
                  </span>
                                </div>
                                <div
                                    className={`employee-visitor-message status-${item.status.toLowerCase().replaceAll(" ", "-")}`}
                                >
                                    <MessageSquare size={16} />
                                    <span>
                    <strong>
                      {item.status === "Awaiting Team Lead"
                          ? "Forwarded by HR"
                          : "Workflow update"}
                    </strong>
                    <small>{routeMessage}</small>
                  </span>
                                </div>
                            </article>
                        );
                    })}
                    {employeeCards.length === 0 && (
                        <div className="empty-state employee-card-empty">
                            <CalendarDays size={28} />
                            <strong>No visitors are assigned to you</strong>
                            <small>
                                Only appointments linked to your employee profile appear here.
                            </small>
                        </div>
                    )}
                </section>
            )}
            <div className="data-table glass-panel">
                <div className="table-head">
                    <span>Visitor</span>
                    <span>Visit</span>
                    <span>Host</span>
                    <span>Schedule</span>
                    <span>Status</span>
                    <span>Action</span>
                </div>
                {filtered.map((item) => (
                    <div className="table-row" key={item.id}>
                        <div className="person-cell">
                            <span className="avatar">{item.initials}</span>
                            <span>
                <strong>{item.arrivalVisitorName ?? item.visitor}</strong>
                <small>
                  {item.visitorEmail
                      ? `${item.visitorEmail} · ${item.visitorPhone}`
                      : item.arrivalVisitorName
                          ? `Booked as ${item.visitor}`
                          : item.company}
                </small>
              </span>
                        </div>
                        <div>
                            <strong>{item.type}</strong>
                            <small>
                                {item.arrivalPurpose ?? item.purpose}
                                {item.identityDocumentLastFour
                                    ? ` · ${item.identityDocumentType ?? "ID"} ••••${item.identityDocumentLastFour}`
                                    : ""}
                            </small>
                        </div>
                        <div>
                            <strong>{item.host}</strong>
                            <small>{item.referenceNumber ?? "BrainServe"}</small>
                        </div>
                        <div>
                            <strong>{item.date}</strong>
                            <small>
                                {item.time}
                                {item.createdAt
                                    ? ` · requested ${new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`
                                    : ""}
                            </small>
                        </div>
                        <StatusPill status={item.status} />
                        <div className="row-actions">
                            {role === "Security" && item.status === "Awaiting Security" && (
                                <button
                                    className="button button-approve"
                                    onClick={() => onSecurityIntake(item)}
                                >
                                    <IdCard size={15} /> Record arrival
                                </button>
                            )}
                            {role === "Reception" && item.status === "Awaiting Reception" && (
                                <>
                                    <button
                                        className="button button-approve"
                                        onClick={() => void decideReceptionVisit(item.id, "verify")}
                                    >
                                        <Check size={15} /> Verify & route
                                    </button>
                                    <button
                                        className="icon-button reject"
                                        onClick={() => void decideReceptionVisit(item.id, "reject")}
                                        title="Reject arrival"
                                    >
                                        <X size={16} />
                                    </button>
                                </>
                            )}
                            {role === "Reception" &&
                                item.status === "Approved" &&
                                !item.receptionForwardedAt &&
                                (["HR visit", "Interview"].includes(item.type) ||
                                    isCeoApprovalRoute(item)) && (
                                    <button
                                        className="button button-primary"
                                        onClick={() => void forwardReceptionVisit(item.id)}
                                    >
                                        <Send size={15} /> Forward to{" "}
                                        {isCeoApprovalRoute(item) ? "CEO" : "HR"} cabin
                                    </button>
                                )}
                            {role === "Reception" && item.receptionForwardedAt && (
                                <span className="status-pill status-approved">
                  <span />
                  Forwarded
                </span>
                            )}
                            {canDecideVisit(role, item) && (
                                <>
                                    <button
                                        className="icon-button approve"
                                        onClick={() => void decideAppointment(item.id, "approve")}
                                        aria-label={
                                            role === "Manager"
                                                ? "Approve and send to CEO"
                                                : role === "CEO"
                                                    ? "Give final CEO approval"
                                                    : `${role} approve`
                                        }
                                        title={
                                            role === "Manager"
                                                ? "Approve and send to CEO"
                                                : role === "CEO"
                                                    ? "Give final CEO approval"
                                                    : `${role} approve`
                                        }
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button
                                        className="icon-button reject"
                                        onClick={() => void decideAppointment(item.id, "reject")}
                                        title={`${role} reject`}
                                    >
                                        <X size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="empty-state">
                        <Search size={28} />
                        <strong>No matching appointments today</strong>
                        <small>
                            Change the status or search, or use Reports → Explore Records for
                            previous and monthly data.
                        </small>
                    </div>
                )}
            </div>
        </>
    );
}

function EmployeesView({
                           role,
                           employees,
                           departments,
                           staffAccounts,
                           currentEmployee,
                           unassignedAccounts,
                           onAssignDepartment,
                           onAdd,
                           onStatus,
                       }: {
    role: Role;
    employees: Employee[];
    departments: Department[];
    staffAccounts: StaffAccount[];
    currentEmployee?: Employee;
    unassignedAccounts: StaffAccount[];
    onAssignDepartment: (account: StaffAccount) => void;
    onAdd: () => void;
    onStatus: (employee: Employee, status: Employee["status"]) => Promise<void>;
}) {
    const [query, setQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [page, setPage] = useState(0);
    const [pageCount, setPageCount] = useState(1);
    const [totalElements, setTotalElements] = useState(
        isBackendConfigured && ["HR Admin", "Team Lead"].includes(role)
            ? 0
            : employees.length,
    );
    const [backendPageEmployees, setBackendPageEmployees] = useState<Employee[]>(
        [],
    );
    const [pageBusy, setPageBusy] = useState(false);
    const [pageError, setPageError] = useState("");
    const [busyEmployeeId, setBusyEmployeeId] = useState("");
    const [recordEmployee, setRecordEmployee] = useState<Employee | null>(null);
    const departmentScoped = role === "HR Admin" || role === "Team Lead";
    const scopedDepartment = departmentScoped
        ? departments.find((department) => department.id === currentEmployee?.departmentId)
        ?? (departments.length === 1 ? departments[0] : undefined)
        : undefined;
    const scopedDepartmentId = scopedDepartment?.id ?? currentEmployee?.departmentId;
    const loadedEmployees = isBackendConfigured
        ? backendPageEmployees
        : employees;
    const visibleEmployees = useMemo(
        () =>
            departmentScoped
                ? scopedDepartmentId
                    ? loadedEmployees.filter(
                        (employee) => employee.departmentId === scopedDepartmentId,
                    )
                    : []
                : loadedEmployees,
        [departmentScoped, loadedEmployees, scopedDepartmentId],
    );
    const departmentCount = new Set(
        visibleEmployees.map((employee) => employee.department),
    ).size;
    const filtered = useMemo(
        () =>
            visibleEmployees.filter(
                (employee) =>
                    (isBackendConfigured ||
                        `${employee.name} ${employee.department} ${employee.id}`
                            .toLowerCase()
                            .includes(query.toLowerCase())) &&
                    (departmentFilter === "All" ||
                        employee.department === departmentFilter) &&
                    (isBackendConfigured ||
                        statusFilter === "All" ||
                        employee.status === statusFilter),
            ),
        [visibleEmployees, query, departmentFilter, statusFilter],
    );
    useEffect(() => {
        if (!isBackendConfigured) return;
        let active = true;
        const timer = window.setTimeout(async () => {
            setPageBusy(true);
            setPageError("");
            if (departmentScoped && !scopedDepartmentId) {
                setBackendPageEmployees([]);
                setPageCount(1);
                setTotalElements(0);
                setPageBusy(false);
                setPageError(
                    role === "Team Lead"
                        ? "Your Team Lead department assignment could not be resolved. Ask HR to confirm the active assignment, then sign out and sign in again."
                        : "Your HR department assignment could not be resolved. Ask System Admin or CEO to confirm the active assignment, then sign out and sign in again.",
                );
                return;
            }
            try {
                const selectedDepartment = departmentScoped
                    ? scopedDepartmentId
                    : departments.find((item) => item.name === departmentFilter)?.id;
                const result = await brainServeApi.employeePage({
                    query: query.trim() || undefined,
                    departmentId: selectedDepartment,
                    status:
                        statusFilter === "All"
                            ? undefined
                            : statusFilter.toUpperCase().replaceAll(" ", "_"),
                    page,
                    size: 50,
                    sort: "displayName,asc",
                });
                if (!active) return;
                const departmentNames = new Map(
                    departments.map((item) => [item.id, item.name]),
                );
                setBackendPageEmployees(
                    result.content.map((item) => ({
                        id: item.employeeNumber,
                        uuid: item.id,
                        departmentId: item.departmentId,
                        name: item.displayName,
                        initials: visitorInitials(item.displayName),
                        role: item.designation,
                        department: departmentNames.get(item.departmentId) ?? "Unassigned",
                        email: item.officialEmail,
                        lifecycleProtected: item.lifecycleProtected,
                        status: employeeStatusLabel(item.status),
                    })),
                );
                setPageCount(Math.max(1, result.totalPages ?? 1));
                setTotalElements(result.totalElements ?? result.content.length);
            } catch (reason) {
                if (active)
                    setPageError(
                        reason instanceof Error
                            ? reason.message
                            : "Employee page could not be loaded.",
                    );
            } finally {
                if (active) setPageBusy(false);
            }
        }, 250);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [
        departmentFilter,
        departmentScoped,
        departments,
        page,
        query,
        role,
        scopedDepartmentId,
        statusFilter,
    ]);
    const employeeTransitions: Record<Employee["status"], Employee["status"][]> =
        {
            Onboarding: ["Active", "Suspended", "Inactive"],
            Active: ["On leave", "Notice period", "Suspended", "Terminated"],
            "On leave": ["Active", "Notice period", "Suspended"],
            "Notice period": ["Resigned", "Active", "Terminated"],
            Suspended: ["Active", "Terminated", "Inactive"],
            Resigned: ["Inactive"],
            Terminated: ["Inactive"],
            Inactive: [],
        };
    const transitions = (status: Employee["status"]): Employee["status"][] =>
        employeeTransitions[status];
    const directoryOnly = role === "Employee";
    const teamLeadView = role === "Team Lead";
    const applyStatus = async (
        employee: Employee,
        nextStatus: Employee["status"],
    ) => {
        if (!nextStatus) return;
        setBusyEmployeeId(employee.uuid ?? employee.id);
        try {
            await onStatus(employee, nextStatus);
        } finally {
            setBusyEmployeeId("");
        }
    };
    return (
        <>
            <PageTitle
                eyebrow="EMPLOYEE MANAGEMENT"
                title={
                    directoryOnly
                        ? "BrainServe Connect directory"
                        : teamLeadView
                            ? "Your department team"
                            : "Your people, thoughtfully managed"
                }
                detail={
                    directoryOnly
                        ? "Find public contact details for colleagues across BrainServe."
                        : teamLeadView
                            ? "A department-scoped directory for the people and appointments you lead."
                            : "Recruit, place on leave, record notice/resignation and archive access without losing history."
                }
                action={
                    ["HR Admin", "CEO"].includes(role) && (
                        <button className="button button-primary" onClick={onAdd}>
                            <UserPlus size={17} /> Add employee
                        </button>
                    )
                }
            />
            {role === "HR Admin" && (
                <section className="panel glass-panel department-assignment-queue">
                    <div className="panel-heading">
                        <div>
                            <span>APPROVED EMPLOYEE ACCOUNTS</span>
                            <h2>Assign department and create employee ID</h2>
                            <p>
                                After HR approves an Employee login, complete the employee
                                profile here. Department assignment is required before
                                activation and Team Lead promotion.
                            </p>
                        </div>
                        <b>{unassignedAccounts.length}</b>
                    </div>
                    {unassignedAccounts.length ? (
                        <div className="department-assignment-list">
                            {unassignedAccounts.map((account) => (
                                <div key={account.userId}>
                  <span className="avatar">
                    {visitorInitials(account.fullName)}
                  </span>
                                    <span>
                    <strong>{account.fullName}</strong>
                    <small>{account.email} · Approved Employee login</small>
                  </span>
                                    <button
                                        className="button button-primary"
                                        onClick={() => onAssignDepartment(account)}
                                    >
                                        <Building2 size={15} /> Assign department
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="assignment-queue-clear">
                            <CheckCircle2 size={18} />
                            <span>
                <strong>All approved Employee accounts are assigned</strong>
                <small>
                  Newly approved Employee registrations will appear here
                  automatically.
                </small>
              </span>
                        </div>
                    )}
                </section>
            )}
            <section className="employee-summary">
                <div>
                    <strong>{totalElements}</strong>
                    <span>Matching records</span>
                </div>
                <i />
                <div>
                    <strong>{departmentCount}</strong>
                    <span>
            {departmentScoped ? "Assigned department" : "Departments on page"}
          </span>
                </div>
                <i />
                <div>
                    <strong>
                        {
                            visibleEmployees.filter((item) => item.status === "Onboarding")
                                .length
                        }
                    </strong>
                    <span>Onboarding on page</span>
                </div>
                <i />
                <div>
                    <strong>
                        {visibleEmployees.filter((item) => item.status === "Active").length}
                    </strong>
                    <span>Active on page</span>
                </div>
            </section>
            <div className="toolbar glass-panel">
                <div className="toolbar-search wide">
                    <Search size={17} />
                    <input
                        value={query}
                        onChange={(e) => {
                            setPage(0);
                            setQuery(e.target.value);
                        }}
                        placeholder="Search by name or employee ID"
                    />
                </div>
                {departmentScoped ? (
                    <div
                        className="scoped-department-label"
                        aria-label="Assigned department"
                    >
                        {scopedDepartment?.name ?? currentEmployee?.department ?? "Assigned department"}
                    </div>
                ) : (
                    <select
                        value={departmentFilter}
                        onChange={(event) => {
                            setPage(0);
                            setDepartmentFilter(event.target.value);
                        }}
                    >
                        <option value="All">All departments</option>
                        {departments
                            .filter((item) => item.active)
                            .map((department) => (
                                <option key={department.id}>{department.name}</option>
                            ))}
                    </select>
                )}
                <select
                    value={statusFilter}
                    onChange={(event) => {
                        setPage(0);
                        setStatusFilter(event.target.value);
                    }}
                >
                    <option value="All">All statuses</option>
                    {[
                        "Onboarding",
                        "Active",
                        "On leave",
                        "Notice period",
                        "Suspended",
                        "Resigned",
                        "Terminated",
                        "Inactive",
                    ].map((status) => (
                        <option key={status}>{status}</option>
                    ))}
                </select>
            </div>
            {pageError && (
                <div className="login-error" role="alert">
                    {pageError}
                </div>
            )}
            <div className="data-table glass-panel">
                <div className="table-head employee-table">
                    <span>Employee</span>
                    <span>Employee ID</span>
                    <span>Department</span>
                    <span>Designation</span>
                    <span>Status</span>
                    <span>Lifecycle action</span>
                </div>
                {filtered.map((item) => {
                    const busy = busyEmployeeId === (item.uuid ?? item.id);
                    const linkedAccount = staffAccounts.find((account) =>
                        (Boolean(item.uuid) && account.employeeId === item.uuid)
                        || account.email.toLowerCase() === item.email.toLowerCase());
                    const isCompanyExecutive = item.lifecycleProtected
                        || (linkedAccount?.roles.includes("ROLE_CEO") ?? false);
                    return (
                        <div className="table-row employee-table" key={item.id}>
                            <div className="person-cell">
                                <span className="avatar">{item.initials}</span>
                                <span>
                  <strong>{item.name}</strong>
                  <small>{item.email}</small>
                </span>
                            </div>
                            <div>
                                <strong className="mono-text">{item.id}</strong>
                            </div>
                            <div>
                                <strong>{item.department}</strong>
                                <small>Hyderabad HQ</small>
                            </div>
                            <div>
                                <strong>{item.role}</strong>
                                <small>{isCompanyExecutive ? "Company-wide authority · System Admin managed" : "Full time"}</small>
                            </div>
                            <StatusPill status={item.status} />
                            <div className="employee-record-actions">
                                {role === "HR Admin" && !isCompanyExecutive && transitions(item.status).length ? (
                                    <select
                                        aria-label={`Change ${item.name} status`}
                                        value=""
                                        disabled={Boolean(busyEmployeeId)}
                                        onChange={(event) =>
                                            void applyStatus(
                                                item,
                                                event.target.value as Employee["status"],
                                            )
                                        }
                                    >
                                        <option value="" disabled>
                                            {busy ? "Saving…" : "Choose action"}
                                        </option>
                                        {transitions(item.status).map((status) => (
                                            <option key={status} value={status}>
                                                {status === "Terminated"
                                                    ? "Request termination…"
                                                    : status}
                                            </option>
                                        ))}
                                    </select>
                                ) : isCompanyExecutive && role === "HR Admin" ? (
                                    <span className="protected-lifecycle-label"><ShieldCheck size={15} /> Protected</span>
                                ) : null}
                                {["HR Admin", "CEO"].includes(role) && (
                                    <button type="button" className="button button-quiet employee-record-button"
                                            onClick={() => setRecordEmployee(item)}>
                                        <FileText size={14} /> Record
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="empty-state">
                        <Users size={28} />
                        <strong>
                            {pageBusy ? "Loading employees…" : "No matching employees"}
                        </strong>
                    </div>
                )}
                <div className="bounded-pagination page-number-pagination">
                    <button
                        className="button button-secondary"
                        disabled={pageBusy || page === 0}
                        onClick={() => setPage((value) => Math.max(0, value - 1))}
                    >
                        Previous
                    </button>
                    <span>
            Page {page + 1} of {pageCount}
          </span>
                    <button
                        className="button button-secondary"
                        disabled={pageBusy || page + 1 >= pageCount}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
            {recordEmployee && <EmployeeServicePanel employee={recordEmployee} role={role}
                                                     onClose={() => setRecordEmployee(null)} />}
        </>
    );
}

function EmployeeServicePanel({ employee, role, onClose }: {
    employee: Employee; role: Role; onClose: () => void;
}) {
    const employeeId = employee.uuid;
    const [current, setCurrent] = useState<CompensationRecord | null>(null);
    const [history, setHistory] = useState<CompensationRecord[]>([]);
    const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const canWrite = role === "HR Admin";
    const refresh = useCallback(async () => {
        if (!isBackendConfigured || !employeeId) return;
        setBusy("load"); setError("");
        try {
            const [currentResult, historyResult, documentResult] = await Promise.all([
                brainServeApi.currentCompensation(employeeId).catch((reason) => {
                    if (reason instanceof ApiError && reason.status === 404) return null;
                    rethrow(reason);
                }),
                brainServeApi.compensationHistory(employeeId),
                brainServeApi.employeeDocuments(employeeId),
            ]);
            setCurrent(currentResult);
            setHistory(historyResult);
            setDocuments(documentResult);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The employee record could not be loaded.");
        } finally { setBusy(""); }
    }, [employeeId]);
    useEffect(() => {
        const timer = window.setTimeout(() => void refresh(), 0);
        return () => window.clearTimeout(timer);
    }, [refresh]);
    useModalDialog(onClose);
    const money = (value: number, currency = current?.currency ?? "INR") =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
    const createCompensation = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!employeeId) return;
        const data = new FormData(event.currentTarget);
        const amount = (key: string) => Number(data.get(key) || 0);
        setBusy("compensation"); setError(""); setMessage("");
        try {
            const created = await brainServeApi.createCompensation(employeeId, {
                components: {
                    basicSalary: amount("basicSalary"), hra: amount("hra"),
                    transportAllowance: amount("transportAllowance"), medicalAllowance: amount("medicalAllowance"),
                    specialAllowance: amount("specialAllowance"), otherAllowance: amount("otherAllowance"),
                    providentFundDeduction: amount("providentFundDeduction"),
                    professionalTax: amount("professionalTax"), incomeTaxEstimate: amount("incomeTaxEstimate"),
                    otherDeductions: amount("otherDeductions"),
                },
                currency: String(data.get("currency") || "INR"),
                effectiveFrom: String(data.get("effectiveFrom")),
                effectiveTo: String(data.get("effectiveTo") || "") || null,
            });
            setCurrent(created);
            setHistory((items) => [created, ...items.filter((item) => item.id !== created.id)]);
            setMessage("Compensation package saved with backend-calculated totals.");
            event.currentTarget.reset();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Compensation could not be saved.");
        } finally { setBusy(""); }
    };
    const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!employeeId) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        const file = data.get("file");
        if (!(file instanceof File) || file.size === 0) return;
        setBusy("document"); setError(""); setMessage("");
        try {
            const created = await brainServeApi.uploadEmployeeDocument(employeeId,
                String(data.get("category")) as EmployeeDocument["category"], file);
            setDocuments((items) => [created, ...items]);
            setMessage("Document scanned and stored in the private employee record.");
            form.reset();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The document could not be uploaded.");
        } finally { setBusy(""); }
    };
    const downloadDocument = async (item: EmployeeDocument) => {
        setBusy(item.id); setError("");
        try {
            const access = await brainServeApi.employeeDocumentDownload(item.id);
            window.location.assign(access.url);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The secure download link could not be created.");
        } finally { setBusy(""); }
    };
    const deleteDocument = async (item: EmployeeDocument) => {
        setBusy(item.id); setError(""); setMessage("");
        try {
            await brainServeApi.deleteEmployeeDocument(item.id);
            setDocuments((items) => items.filter((document) => document.id !== item.id));
            setMessage(`${item.filename} was removed from the active document record.`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The document could not be deleted.");
        } finally { setBusy(""); }
    };
    return <div className="modal-backdrop" role="presentation">
        <section className="modal employee-service-modal glass-panel" role="dialog" aria-modal="true"
                 aria-labelledby="employee-service-title">
            <header><div><span>EMPLOYEE SERVICE RECORD</span><h2 id="employee-service-title">{employee.name}</h2>
                <p>{employee.id} · {employee.department} · {employee.role}</p></div>
                <button type="button" className="icon-button" onClick={onClose} aria-label="Close employee record"><X size={18} /></button>
            </header>
            {!isBackendConfigured && <div className="governance-connection-note"><LockKeyhole size={18} />
                <span><strong>Backend connection required</strong><small>Compensation and private documents are never stored in browser Preview data.</small></span></div>}
            {isBackendConfigured && !employeeId && <div className="login-error">Refresh the employee directory to load this record’s database ID.</div>}
            {isBackendConfigured && employeeId && <>
                <section className="employee-record-section">
                    <div className="panel-heading"><div><span>COMPENSATION</span><h3>Current package</h3></div>
                        <BriefcaseBusiness size={20} /></div>
                    {current ? <div className="compensation-summary">
                        <span><small>Gross monthly</small><strong>{money(current.grossSalary, current.currency)}</strong></span>
                        <span><small>Net monthly</small><strong>{money(current.netSalary, current.currency)}</strong></span>
                        <span><small>Annual CTC</small><strong>{money(current.annualCtc, current.currency)}</strong></span>
                        <span><small>Effective</small><strong>{current.effectiveFrom}{current.effectiveTo ? ` – ${current.effectiveTo}` : " onward"}</strong></span>
                    </div> : <div className="empty-state compact-empty"><BriefcaseBusiness size={24} />
                        <strong>No active compensation package</strong><small>HR can add the first effective-dated package below.</small></div>}
                    {history.length > 0 && <div className="compensation-history">{history.map((item) =>
                        <div key={item.id}><span><strong>{money(item.netSalary, item.currency)} net</strong>
              <small>{item.effectiveFrom}{item.effectiveTo ? ` – ${item.effectiveTo}` : " · current"}</small></span>
                            <span><strong>{money(item.annualCtc, item.currency)}</strong><small>Annual CTC</small></span></div>)}</div>}
                    {canWrite && <form className="compensation-form" onSubmit={createCompensation}>
                        <div className="modal-form-grid">
                            <label>Basic salary<input name="basicSalary" type="number" min="0" step="0.01" required /></label>
                            <label>HRA<input name="hra" type="number" min="0" step="0.01" required /></label>
                            <label>Transport allowance<input name="transportAllowance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Medical allowance<input name="medicalAllowance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Special allowance<input name="specialAllowance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Other allowance<input name="otherAllowance" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>PF deduction<input name="providentFundDeduction" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Professional tax<input name="professionalTax" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Income-tax estimate<input name="incomeTaxEstimate" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Other deductions<input name="otherDeductions" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                            <label>Currency<select name="currency" defaultValue="INR"><option value="INR">INR</option><option value="USD">USD</option></select></label>
                            <label>Effective from<input name="effectiveFrom" type="date" defaultValue={officeToday()} required /></label>
                            <label>Effective to<input name="effectiveTo" type="date" min={officeToday()} /></label>
                        </div>
                        <button className="button button-primary" disabled={Boolean(busy)}><Plus size={15} />
                            {busy === "compensation" ? "Saving…" : "Save compensation"}</button>
                    </form>}
                </section>
                <section className="employee-record-section">
                    <div className="panel-heading"><div><span>PRIVATE DOCUMENTS</span><h3>Employment record</h3></div><FileText size={20} /></div>
                    {canWrite && <form className="document-upload-form" onSubmit={uploadDocument}>
                        <label>Category<select name="category" defaultValue="EMPLOYMENT"><option value="EMPLOYMENT">Employment</option>
                            <option value="IDENTITY">Identity</option><option value="PHOTO">Photo</option><option value="OTHER">Other</option></select></label>
                        <label>File<input name="file" type="file" accept=".pdf,image/jpeg,image/png" required /></label>
                        <button className="button button-secondary" disabled={Boolean(busy)}><Plus size={15} />
                            {busy === "document" ? "Scanning…" : "Upload securely"}</button>
                    </form>}
                    <div className="employee-document-list">{documents.map((item) => <div key={item.id}>
                        <FileText size={18} /><span><strong>{item.filename}</strong><small>{item.category} · {(item.sizeBytes / 1024).toFixed(1)} KB · {item.status}</small></span>
                        <button type="button" className="button button-quiet" disabled={busy === item.id}
                                onClick={() => void downloadDocument(item)}>Download</button>
                        {canWrite && <button type="button" className="icon-button reject" disabled={busy === item.id}
                                             onClick={() => void deleteDocument(item)} aria-label={`Delete ${item.filename}`}><Trash2 size={15} /></button>}
                    </div>)}{documents.length === 0 && <div className="empty-state compact-empty"><FileText size={24} />
                        <strong>No private documents</strong><small>Files appear here after secure scanning.</small></div>}</div>
                </section>
            </>}
            {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
            {error && <div className="login-error" role="alert">{error}</div>}
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div>
        </section>
    </div>;
}

function TerminationRequestModal({ employee, userEmail, onClose, onSubmitted }: {
    employee: Employee; userEmail: string; onClose: () => void; onSubmitted: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError("");
        const data = new FormData(event.currentTarget);
        const reason = String(data.get("reason") ?? "").trim();
        const effectiveDate = String(data.get("effectiveDate") ?? "");
        try {
            if (isBackendConfigured) {
                if (!employee.uuid) fail("This employee is missing its database identifier. Refresh and try again.");
                await brainServeApi.requestEmployeeTermination(employee.uuid, reason, effectiveDate);
            } else {
                if (readDemoTerminations().some((item) => item.employeeId === (employee.uuid ?? employee.id)
                    && item.status === "PENDING_CEO_APPROVAL")) fail("This employee already has a pending CEO review.");
                const requester = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                const now = new Date().toISOString();
                const created: EmployeeTerminationRequest = { id: newClientId(), employeeId: employee.uuid ?? employee.id,
                    employeeNumber: employee.id, employeeName: employee.name, employeeEmail: employee.email,
                    departmentId: employee.departmentId ?? "", requestedByHrUserId: requester?.id ?? "demo-hr-admin",
                    requestedByHrName: requester?.fullName ?? "Department HR Admin", reason, effectiveDate,
                    status: "PENDING_CEO_APPROVAL", requestedAt: now, decidedByCeoUserId: null,
                    decidedByCeoName: null, decidedAt: null, decisionNote: null };
                writeDemoTerminations([created, ...readDemoTerminations()]);
                writeDemoEssentialLogs([{ id: newClientId(), category: "EMPLOYEE_LIFECYCLE",
                    eventType: "TERMINATION_REQUESTED", subjectType: "EMPLOYEE", subjectId: created.employeeId,
                    referenceId: created.id, actorUserId: created.requestedByHrUserId, approverUserId: null,
                    status: created.status, title: `Termination requested for ${employee.name}`,
                    detail: `${employee.name} (${employee.id}) · ${reason}`, occurredAt: now }, ...readDemoEssentialLogs()]);
                writeDemoInternalNotifications([{ id: newClientId(), senderUserId: created.requestedByHrUserId,
                    recipientUserId: "demo-ceo", senderName: created.requestedByHrName, recipientName: "BrainServe CEO",
                    message: `Termination approval required for ${employee.name} (${employee.id}). Review the request in Terminations.`,
                    priority: "URGENT", category: "ACTION_REQUIRED", conversationKey: `termination:${created.id}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: userEmail, recipientEmail: "ceo@brainserve.in" }, ...readDemoInternalNotifications()]);
            }
            onSubmitted();
        } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "Termination request could not be submitted."); }
        finally { setBusy(false); }
    };
    return <div className="modal-backdrop"><div className="modal termination-modal"><header><div><span>HR TERMINATION REQUEST</span><h2>Send to CEO for approval</h2><p>No access or employment status changes until CEO approves.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit}>
        <div className="modal-review-source"><UserCog size={19} /><span><strong>{employee.name} · {employee.id}</strong><small>{employee.role} · {employee.department} · currently {employee.status.toLowerCase()}</small></span></div>
        <label>Reason for termination<textarea name="reason" minLength={5} maxLength={1000} required placeholder="State the documented business and policy reason." /></label>
        <label>Effective date<input name="effectiveDate" type="date" defaultValue={officeToday()} max={officeToday()} required /></label>
        <div className="decision-policy"><ShieldCheck size={18} /><span><strong>Two-step authorization</strong><small>HR submits this request. CEO decides it. Approval disables the employee login and closes any active Team Lead assignment.</small></span></div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}><Send size={16} />{busy ? "Submitting…" : "Request CEO approval"}</button></div>
    </form></div></div>;
}

function TerminationsView({ role, userEmail, onEmployeeTerminated }: {
    role: Role; userEmail: string; onEmployeeTerminated: (employeeId: string) => void;
}) {
    const [requests, setRequests] = useState<EmployeeTerminationRequest[]>([]);
    const [selected, setSelected] = useState<EmployeeTerminationRequest | null>(null);
    const [decision, setDecision] = useState<"approve" | "reject">("approve");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const values = isBackendConfigured
                    ? role === "HR Admin"
                        ? await brainServeApi.myEmployeeTerminations()
                        : await Promise.all([
                            brainServeApi.pendingEmployeeTerminations(),
                            brainServeApi.employeeTerminationHistory(),
                        ]).then(([pending, history]) => Array.from(
                            new Map([...pending, ...history].map((item) => [item.id, item])).values(),
                        ))
                    : readDemoTerminations();
                if (active) setRequests(values);
            } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Termination requests could not be loaded."); }
        };
        void load(); return () => { active = false; };
    }, [role]);
    const decide = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); if (!selected) return;
        setBusy(true); setError(""); const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
        try {
            let updated: EmployeeTerminationRequest;
            if (isBackendConfigured) updated = await brainServeApi.decideEmployeeTermination(selected.id, decision, note);
            else {
                const ceo = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                const now = new Date().toISOString();
                updated = { ...selected, status: decision === "approve" ? "APPROVED" : "REJECTED",
                    decidedByCeoUserId: ceo?.id ?? "demo-ceo", decidedByCeoName: ceo?.fullName ?? "BrainServe CEO",
                    decidedAt: now, decisionNote: note || null };
                writeDemoTerminations(readDemoTerminations().map((item) => item.id === updated.id ? updated : item));
                if (decision === "approve") {
                    const nextEmployees = readDemoEmployees().map((item) => (item.uuid ?? item.id) === updated.employeeId
                        ? { ...item, status: "Terminated" as const } : item);
                    writeDemoEmployees(nextEmployees);
                    writeDemoAccounts(readDemoAccounts().map((item) => item.employeeId === updated.employeeId
                    || item.email.toLowerCase() === updated.employeeEmail.toLowerCase()
                        ? { ...item, enabled: false, status: "DISABLED" } : item));
                    writeDemoTeamLeadAssignments(readDemoTeamLeadAssignments().map((item) => item.active
                    && item.teamLeadEmployeeId === updated.employeeId
                        ? { ...item, active: false, endedByUserId: updated.decidedByCeoUserId, endedAt: now } : item));
                    onEmployeeTerminated(updated.employeeId);
                }
                writeDemoEssentialLogs([{ id: newClientId(), category: "EMPLOYEE_LIFECYCLE",
                    eventType: decision === "approve" ? "TERMINATION_APPROVED" : "TERMINATION_REJECTED",
                    subjectType: "EMPLOYEE", subjectId: updated.employeeId, referenceId: updated.id,
                    actorUserId: updated.requestedByHrUserId, approverUserId: updated.decidedByCeoUserId,
                    status: updated.status, title: `Termination ${decision === "approve" ? "approved" : "rejected"} for ${updated.employeeName}`,
                    detail: note || updated.reason, occurredAt: now }, ...readDemoEssentialLogs()]);
                writeDemoInternalNotifications([{ id: newClientId(), senderUserId: updated.decidedByCeoUserId ?? "demo-ceo",
                    recipientUserId: updated.requestedByHrUserId, senderName: updated.decidedByCeoName ?? "BrainServe CEO",
                    recipientName: updated.requestedByHrName,
                    message: `CEO ${decision === "approve" ? "approved" : "rejected"} the termination request for ${updated.employeeName}${note ? `: ${note}` : "."}`,
                    priority: "URGENT", category: "ACTION_REQUIRED", conversationKey: `termination:${updated.id}`,
                    deliveryStatus: "DELIVERED", sentAt: now, deliveredAt: now, readAt: null,
                    senderEmail: userEmail, recipientEmail: "hr.admin@brainserve.in" }, ...readDemoInternalNotifications()]);
            }
            setRequests((items) => items.map((item) => item.id === updated.id ? updated : item));
            if (decision === "approve" && isBackendConfigured) onEmployeeTerminated(updated.employeeId);
            setSelected(null);
        } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "CEO decision could not be saved."); }
        finally { setBusy(false); }
    };
    const pending = requests.filter((item) => item.status === "PENDING_CEO_APPROVAL");
    return <><PageTitle eyebrow="EMPLOYEE GOVERNANCE" title={role === "CEO" ? "Termination approvals" : "Termination requests"}
                        detail={role === "CEO" ? "Review HR evidence before employment access is disabled. Every decision becomes an immutable audit and business log." : "Track requests submitted by HR. Employee access remains active until CEO approval."} />
        <section className="employee-summary"><div><strong>{pending.length}</strong><span>Awaiting CEO</span></div><i /><div><strong>{requests.filter((item) => item.status === "APPROVED").length}</strong><span>Approved</span></div><i /><div><strong>{requests.filter((item) => item.status === "REJECTED").length}</strong><span>Rejected</span></div><i /><div><strong>{requests.length}</strong><span>Total retained</span></div></section>
        {error && <div className="login-error" role="alert">{error}</div>}
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>CEO-CONTROLLED LIFECYCLE</span><h2>Employee termination register</h2><p>HR request, CEO decision and effective date remain joined to the employee record.</p></div><b>{requests.length}</b></div><div className="records-table-wrap"><table className="records-table termination-records-table"><thead><tr><th>Employee</th><th>HR request</th><th>Effective date</th><th>Status</th><th>CEO decision</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>{item.employeeName}</strong><small>{item.employeeNumber} · {item.employeeEmail}</small><code>{item.id}</code></td><td><strong>{item.requestedByHrName}</strong><small>{item.reason}</small><small>{new Date(item.requestedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></td><td><strong>{item.effectiveDate}</strong><small>Access changes only after approval</small></td><td><span className={`business-status business-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span></td><td>{role === "CEO" && item.status === "PENDING_CEO_APPROVAL" ? <div className="approval-actions"><button className="button button-reject" onClick={() => { setDecision("reject"); setSelected(item); }}><X size={15} />Reject</button><button className="button button-approve" onClick={() => { setDecision("approve"); setSelected(item); }}><Check size={15} />Approve</button></div> : <><strong>{item.decidedByCeoName ?? "Pending CEO"}</strong><small>{item.decisionNote ?? "No decision note"}</small></>}</td></tr>)}{requests.length === 0 && <tr><td colSpan={5}><div className="empty-state table-empty"><UserCog size={28} /><strong>No termination requests</strong><small>Requests initiated from the HR employee directory will appear here.</small></div></td></tr>}</tbody></table></div></article>
        {selected && <div className="modal-backdrop"><div className="modal termination-modal"><header><div><span>CEO DECISION</span><h2>{decision === "approve" ? "Approve termination" : "Reject termination"}</h2><p>{selected.employeeName} · {selected.employeeNumber}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18} /></button></header><form onSubmit={decide}><div className="modal-review-source"><ShieldCheck size={19} /><span><strong>HR reason</strong><small>{selected.reason}</small></span></div><label>{decision === "approve" ? "Decision note (optional)" : "Rejection reason"}<textarea name="note" minLength={decision === "reject" ? 5 : undefined} maxLength={1000} required={decision === "reject"} placeholder={decision === "approve" ? "Optional governance note" : "Explain what HR must correct or reconsider."} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setSelected(null)}>Cancel</button><button className={`button ${decision === "approve" ? "button-approve" : "button-reject"}`} disabled={busy}>{busy ? "Saving…" : decision === "approve" ? "Approve & disable access" : "Reject request"}</button></div></form></div></div>}
    </>;
}

function VisitorIdentityRegistry() {
    const [query, setQuery] = useState("");
    const [visitors, setVisitors] = useState<VisitorIdentity[]>([]);
    const [selected, setSelected] = useState<VisitorIdentity | null>(null);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const search = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy("search"); setError(""); setSelected(null);
        try {
            const result = await brainServeApi.searchVisitors(query.trim(), 0, 25);
            setVisitors(result.content);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Visitor identities could not be searched.");
        } finally { setBusy(""); }
    };
    const open = async (visitor: VisitorIdentity) => {
        setBusy(visitor.id); setError("");
        try { setSelected(await brainServeApi.visitor(visitor.id)); }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "The visitor identity could not be loaded.");
        } finally { setBusy(""); }
    };
    const verify = async () => {
        if (!selected) return;
        setBusy("verify"); setError("");
        try {
            const verified = await brainServeApi.verifyVisitor(selected.id);
            setSelected(verified);
            setVisitors((items) => items.map((item) => item.id === verified.id ? verified : item));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The visitor identity could not be verified.");
        } finally { setBusy(""); }
    };
    return <article className="panel glass-panel visitor-identity-registry">
        <div className="panel-heading"><div><span>VISITOR IDENTITY SERVICE</span><h2>Find and verify returning visitors</h2>
            <p>Search the PostgreSQL visitor registry by name or email. Verification is audited and never stored in browser Preview data.</p></div><IdCard size={22} /></div>
        <form className="inline-account-form" onSubmit={search}><label>Visitor search<input value={query}
                                                                                            onChange={(event) => setQuery(event.target.value)} minLength={2}
                                                                                            placeholder="Name or email address" required /></label><button className="button button-secondary"
                                                                                                                                                           disabled={busy === "search"}><Search size={16} />{busy === "search" ? "Searching…" : "Search registry"}</button></form>
        <div className="visitor-identity-results">{visitors.map((visitor) => <button type="button"
                                                                                     key={visitor.id} onClick={() => void open(visitor)} disabled={busy === visitor.id}>
            <span className="avatar">{visitorInitials(visitor.name)}</span><span><strong>{visitor.name}</strong>
        <small>{visitor.email} · {visitor.company ?? "Independent visitor"}</small></span>
            <StatusPill status={visitor.identityVerified ? "Verified" : "Pending verification"} />
        </button>)}{visitors.length === 0 && <div className="empty-state compact-empty"><Search size={24} />
            <strong>Search the live visitor registry</strong><small>Registration records appear here after public booking.</small></div>}</div>
        {selected && <div className="visitor-identity-detail"><IdCard size={20} /><span><strong>{selected.name}</strong>
      <small>{selected.phone} · {selected.governmentIdMasked ?? "No government ID supplied"} · consent {selected.consentVersion}</small></span>
            {selected.identityVerified ? <span className="protected-lifecycle-label"><CheckCircle2 size={15} /> Verified</span>
                : <button type="button" className="button button-approve" disabled={busy === "verify"}
                          onClick={() => void verify()}><ShieldCheck size={15} />{busy === "verify" ? "Verifying…" : "Verify identity"}</button>}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function VisitorsView({ role, appointments, accessRecords, onCheckIn, onReferenceCheckIn, onPassCheckIn, onCheckOut,
                          decideReceptionVisit, onRegister }: {
    role: Role; appointments: Appointment[]; accessRecords: AccessRecord[];
    onCheckIn: (id: string) => Promise<void>; onReferenceCheckIn: (reference: string) => Promise<void>;
    onPassCheckIn: (token: string) => Promise<void>; onCheckOut: (id: string) => Promise<void>;
    decideReceptionVisit: (id: string, decision: "verify" | "reject") => Promise<void>; onRegister: () => void;
}) {
    const canProcessAccess = ["Reception", "Security", "CEO"].includes(role);
    const approved = appointments.filter((item) => item.status === "Approved");
    const readyForCheckIn = (item: Appointment) => !["HR visit", "Interview", "CEO visit"].includes(item.type)
        || Boolean(item.receptionForwardedAt);
    const receptionQueue = appointments.filter((item) => item.status === "Awaiting Reception"
        && (item.slotStart ? officeToday(new Date(item.slotStart)) === officeToday() : item.date === "Today"));
    const [renderedAt] = useState(() => Date.now());
    const [reference, setReference] = useState("");
    const [passToken, setPassToken] = useState("");
    const [verifiedPass, setVerifiedPass] = useState<{ referenceNumber: string; visitorName: string; appointmentStatus: string; validUntil: string } | null>(null);
    const [error, setError] = useState("");
    const checkInReference = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError("");
        try { await onReferenceCheckIn(reference); setReference(""); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Check-in failed."); }
    };
    const verifyPass = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError(""); setVerifiedPass(null);
        try {
            if (isBackendConfigured) {
                setVerifiedPass(await brainServeApi.verifyVisitorPass(passToken));
            } else {
                const referenceNumber = passToken.replace("brainserve-demo:", "").trim().toUpperCase();
                if (!/^BSA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(referenceNumber)) fail("This QR pass is invalid.");
                setVerifiedPass({ referenceNumber, visitorName: "Demo visitor", appointmentStatus: "APPROVED",
                    validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() });
            }
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The QR pass could not be verified."); }
    };
    const checkInPass = async () => {
        setError("");
        try { await onPassCheckIn(passToken); setPassToken(""); setVerifiedPass(null); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "QR pass check-in failed."); }
    };
    return <>
        <PageTitle eyebrow={role === "Security" ? "PHYSICAL ACCESS" : "RECEPTION & VISITORS"}
                   title={role === "Security" ? "Everyone inside, accounted for" : "A calm, confident arrival"}
                   detail="Security captures each arrival, Reception verifies it, and CEO visits go directly to the assigned department Manager for approval."
                   action={<button className="button button-primary" onClick={onRegister}><UserPlus size={17} /> {role === "Security" ? "Create walk-in" : "Register visitor"}</button>} />
        <div className="reception-actions">
            <button className="action-tile glass-panel" onClick={onRegister}><span><UserPlus size={24} /></span><div><strong>{role === "Security" ? "Create walk-in appointment" : "Register interview or meeting"}</strong><small>{role === "Security" ? "Capture arrival and notify Reception immediately" : "Start the Security → Reception → approval workflow"}</small></div><ArrowRight size={18} /></button>
            <button className="action-tile glass-panel" onClick={() => document.getElementById("live-occupancy")?.scrollIntoView({ behavior: "smooth", block: "center" })}><span><DoorOpen size={24} /></span><div><strong>Emergency list</strong><small>{accessRecords.length} people currently inside</small></div><ArrowRight size={18} /></button>
        </div>
        {isBackendConfigured && ["Security", "Reception"].includes(role) && <VisitorIdentityRegistry />}
        {role === "Reception" && <article className="panel glass-panel reception-verification-queue"><div className="panel-heading"><div><span>FROM SECURITY</span><h2>Visitors awaiting Reception</h2><p>Review the gate intake and route the verified visitor to the assigned department reviewer.</p></div><b>{receptionQueue.length}</b></div><div className="staff-account-list">{receptionQueue.map((item) => <div className="staff-account-row" key={item.id}><div className="staff-account-head"><span className="avatar">{item.initials}</span><span><strong>{item.arrivalVisitorName ?? item.visitor}</strong><small>{item.referenceNumber} · requested {item.host}</small></span><StatusPill status={item.status} /></div><div className="visitor-route-details"><span><strong>Purpose</strong><small>{item.arrivalPurpose ?? item.purpose}</small></span><span><strong>Received</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : `${item.date}, ${item.time}`}</small></span><span><strong>Identity</strong><small>{item.identityDocumentLastFour ? `${item.identityDocumentType ?? "ID"} ••••${item.identityDocumentLastFour}` : "Not recorded"}</small></span></div><div className="approval-actions"><button className="button button-reject" onClick={() => void decideReceptionVisit(item.id, "reject")}><X size={15} /> Reject</button><button className="button button-approve" onClick={() => void decideReceptionVisit(item.id, "verify")}><Check size={15} /> {item.type === "CEO visit" ? "Verify & route to Manager" : "Verify & route to HR"}</button></div></div>)}{receptionQueue.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>No visitors waiting</strong><small>Security-created arrivals will appear here automatically.</small></div>}</div></article>}
        {canProcessAccess && <div className="access-tools"><form className="inline-account-form panel glass-panel" onSubmit={checkInReference}><label>Appointment reference<input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="BSA-XXXX-XXXX" required /></label><button className="button button-approve"><DoorOpen size={16} /> Check in by reference</button></form><form className="pass-verify-form panel glass-panel" onSubmit={verifyPass}><label>Scanned QR content<input value={passToken} onChange={(event) => setPassToken(event.target.value)} placeholder="Paste the scanned BrainServe pass token" required /></label><button className="button button-secondary"><QrCode size={16} /> Verify signed pass</button>{verifiedPass && <div className="verified-pass"><CheckCircle2 size={19} /><span><strong>{verifiedPass.visitorName}</strong><small>{verifiedPass.referenceNumber} · valid until {formatOfficeTime(verifiedPass.validUntil)}</small></span><button type="button" className="button button-approve" onClick={() => void checkInPass()}>Check in</button></div>}</form>{error && <div className="login-error" role="alert">{error}</div>}</div>}
        <section className="dashboard-grid visitors-grid">
            <article className="panel glass-panel"><div className="panel-heading"><div><span>EXPECTED</span><h2>Approved arrivals</h2></div><b>{approved.length}</b></div><div className="compact-list">{approved.map((item) => <div key={item.id}><time>{item.time}</time><span className="avatar">{item.initials}</span><span><strong>{item.visitor}</strong><small>Meeting {item.host}</small></span>{canProcessAccess && (readyForCheckIn(item) ? <button className="button button-approve" onClick={() => void onCheckIn(item.id)}><LogIn size={15} /> Check in</button> : <span className="status-pill status-pending"><span />Route from Reception first</span>)}</div>)}{approved.length === 0 && <div className="empty-state"><CalendarDays size={26} /><strong>No approved arrivals</strong><small>Approved appointments will appear here.</small></div>}</div></article>
            <article className="panel glass-panel" id="live-occupancy"><div className="panel-heading"><div><span>LIVE OCCUPANCY</span><h2>Currently inside</h2></div><span className="live-badge"><i /> LIVE</span></div>{accessRecords.length ? <div className="inside-list">{accessRecords.map((record) => { const minutes = Math.max(1, Math.floor((renderedAt - new Date(record.checkedInAt).getTime()) / 60000)); return <div key={record.id}><span className="avatar">{visitorInitials(record.visitorName)}</span><span><strong>{record.visitorName}</strong><small>Badge {record.badgeNumber} · in for {minutes} min</small></span>{canProcessAccess && <button className="button button-reject" onClick={() => void onCheckOut(record.appointmentId)}><LogOut size={15} /> Check out</button>}</div>; })}</div> : <div className="empty-state"><DoorOpen size={28} /><strong>No active visitors</strong><small>Checked-in visitors will appear here.</small></div>}</article>
        </section>
    </>;
}

function OrganizationView({ role, userEmail, departments, employees, staffAccounts, summaries, teamLeadAssignments,
                              departmentHrAssignments, onCreate, onToggle, onAddEmployee, onAssignTeamLead, onEndTeamLead,
                              onAssignDepartmentHr, onEndDepartmentHr, onJoinExecutiveDepartment }: {
    role: Role; userEmail: string; departments: Department[]; employees: Employee[]; staffAccounts: StaffAccount[];
    summaries: DepartmentEmployeeSummary[];
    teamLeadAssignments: TeamLeadAssignment[];
    departmentHrAssignments: DepartmentHrAssignment[];
    onCreate: (code: string, name: string) => Promise<Department>; onToggle: (department: Department) => Promise<void>;
    onAddEmployee: (departmentId: string) => void;
    onAssignTeamLead: (departmentId: string, employeeId: string) => Promise<boolean>;
    onEndTeamLead: (assignment: TeamLeadAssignment) => Promise<void>;
    onAssignDepartmentHr: (departmentId: string, hrUserId: string) => Promise<boolean>;
    onEndDepartmentHr: (assignment: DepartmentHrAssignment) => Promise<void>;
    onJoinExecutiveDepartment: (payload: { departmentId: string; phoneNumber: string;
        designation: string; joiningDate: string }) => Promise<boolean>;
}) {
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState("");
    const [expandedDepartment, setExpandedDepartment] = useState<string | null>();
    const [loadingDepartment, setLoadingDepartment] = useState<string>();
    const [rosters, setRosters] = useState<Record<string, DepartmentRosterPage>>({});
    const [backendVisibleDepartments, setBackendVisibleDepartments] = useState<Department[]>([]);
    const [executiveDepartmentId, setExecutiveDepartmentId] = useState("");
    const [executiveBusy, setExecutiveBusy] = useState(false);
    const [message, setMessage] = useState("");
    const demoVisibleDepartments = useMemo(() => {
        if (isBackendConfigured) return [];
        if (role === "CEO") return departments;
        const account = [...readDemoAccounts(), ...staffAccounts].find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
        const accountId = account && "id" in account ? account.id : account?.userId;
        const assignmentDepartmentId = role === "HR Admin"
            ? readDemoDepartmentHrAssignments().find((item) => item.active && item.hrUserId === accountId)?.departmentId
            : role === "Manager"
                ? readDemoManagerAssignments().find((item) => item.active && item.managerUserId === accountId)?.departmentId
                : readDemoTeamLeadAssignments().find((item) => item.active && item.teamLeadUserId === accountId)?.departmentId;
        return departments.filter((item) => item.id === assignmentDepartmentId);
    }, [departments, role, staffAccounts, userEmail]);
    const visibleDepartments = isBackendConfigured ? backendVisibleDepartments : demoVisibleDepartments;
    const executiveEmployee = role === "CEO" ? employees.find((item) => item.email.toLowerCase() === userEmail.toLowerCase()) : undefined;
    useEffect(() => {
        let active = true;
        if (!isBackendConfigured) return () => { active = false; };
        brainServeApi.visibleDepartments().then((items) => { if (active) setBackendVisibleDepartments(items); })
            .catch((reason) => { if (active) { setBackendVisibleDepartments([]); setError(reason instanceof Error ? reason.message : "Your department scope could not be loaded."); } });
        return () => { active = false; };
    }, []);
    const selectedExecutiveDepartmentId = executiveDepartmentId || executiveEmployee?.departmentId
        || visibleDepartments.find((item) => item.active)?.id || "";
    const effectiveExpandedDepartment = expandedDepartment === undefined && role !== "CEO" && visibleDepartments.length === 1
        ? visibleDepartments[0].id : expandedDepartment;
    const visibleDepartmentIds = useMemo(() => new Set(visibleDepartments.map((item) => item.id)), [visibleDepartments]);
    const scopedSummaries = useMemo(() => summaries.filter((item) => visibleDepartmentIds.has(item.departmentId)), [summaries, visibleDepartmentIds]);
    const scopedEmployees = useMemo(() => employees.filter((item) => item.departmentId && visibleDepartmentIds.has(item.departmentId)), [employees, visibleDepartmentIds]);
    const summaryByDepartment = useMemo(() => new Map(scopedSummaries.map((item) => [item.departmentId, item])), [scopedSummaries]);
    const totalEmployees = scopedSummaries.length ? scopedSummaries.reduce((total, item) => total + item.totalEmployees, 0) : scopedEmployees.length;
    const activeEmployees = scopedSummaries.length ? scopedSummaries.reduce((total, item) => total + item.activeEmployees, 0)
        : scopedEmployees.filter((item) => item.status === "Active").length;
    const canCreateDepartment = role === "CEO";
    const canAddEmployee = role === "HR Admin" || role === "CEO";
    const canToggleDepartment = role === "CEO";
    const canManageLead = role === "HR Admin";
    const canManageHr = role === "CEO";
    const loadDepartmentPage = useCallback(async (department: Department, pageNumber = 0, query = "") => {
        if (!isBackendConfigured) {
            const matching = employees.filter((item) => belongsToDepartment(item, department)
                && (!query || `${item.name} ${item.id} ${item.email}`.toLowerCase().includes(query.toLowerCase())));
            const pageSize = 50;
            const pageItems = matching.slice(pageNumber * pageSize, (pageNumber + 1) * pageSize);
            setRosters((current) => ({ ...current, [department.id]: {
                    items: pageItems, page: pageNumber, totalElements: matching.length,
                    totalPages: Math.max(1, Math.ceil(matching.length / pageSize)), query,
                } }));
            return;
        }
        setLoadingDepartment(department.id); setError("");
        try {
            const page = await brainServeApi.employeePage({
                departmentId: department.id, query, page: pageNumber, size: 50, sort: "displayName,asc",
            });
            const items = page.content.map((item) => ({
                id: item.employeeNumber, uuid: item.id, departmentId: item.departmentId,
                name: item.displayName, initials: visitorInitials(item.displayName),
                role: item.designation, department: department.name, email: item.officialEmail,
                status: employeeStatusLabel(item.status),
            }));
            setRosters((current) => ({ ...current, [department.id]: {
                    items, page: page.number ?? pageNumber,
                    totalElements: page.totalElements ?? items.length,
                    totalPages: page.totalPages ?? Math.max(1, Math.ceil(items.length / 50)),
                    query,
                } }));
        } catch (reason) { setError(reason instanceof ApiError ? reason.message : "The department roster could not be loaded."); }
        finally { setLoadingDepartment(undefined); }
    }, [employees]);
    const openDepartment = async (department: Department) => {
        if (effectiveExpandedDepartment === department.id) { setExpandedDepartment(null); return; }
        setExpandedDepartment(department.id);
        if (!rosters[department.id]) await loadDepartmentPage(department);
    };
    useEffect(() => {
        if (!isBackendConfigured || !effectiveExpandedDepartment || rosters[effectiveExpandedDepartment]) return;
        const department = visibleDepartments.find((item) => item.id === effectiveExpandedDepartment);
        if (!department) return;
        const timer = window.setTimeout(() => void loadDepartmentPage(department), 0);
        return () => window.clearTimeout(timer);
    }, [effectiveExpandedDepartment, loadDepartmentPage, rosters, visibleDepartments]);
    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError("");
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            const created = await onCreate(String(data.get("code")), String(data.get("name")));
            if (role === "CEO" && data.get("joinExecutive") === "yes") {
                const joined = await onJoinExecutiveDepartment({ departmentId: created.id, phoneNumber: "",
                    designation: "Chief Executive Officer", joiningDate: officeToday() });
                if (!joined) fail("The department was created, but the CEO profile could not be registered to it.");
                setExecutiveDepartmentId(created.id);
            }
            form.reset(); setShowForm(false); setMessage(data.get("joinExecutive") === "yes"
                ? "Department created and registered as your CEO department."
                : "Department created successfully.");
        }
        catch (reason) { setError(reason instanceof Error ? reason.message : "The department could not be created."); }
    };
    const joinExecutive = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setExecutiveBusy(true); setError(""); setMessage("");
        const data = new FormData(event.currentTarget);
        const ok = await onJoinExecutiveDepartment({ departmentId: String(data.get("departmentId")),
            phoneNumber: String(data.get("phoneNumber") ?? ""), designation: String(data.get("designation")),
            joiningDate: String(data.get("joiningDate")) });
        if (ok) setMessage("Your CEO profile is now registered to the selected department.");
        else setError("The CEO department profile could not be updated.");
        setExecutiveBusy(false);
    };
    return <>
        <PageTitle eyebrow="ORGANIZATION INTELLIGENCE" title="Your company, clearly connected"
                   detail={role === "CEO" ? "Open any department to see its live PostgreSQL-backed team directory and take role-controlled actions." : "Your directory is restricted to the department assigned to your account."}
                   action={canCreateDepartment && <button className="button button-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Add department</button>} />
        <section className="org-overview glass-panel">
            <div><span>Departments</span><strong>{visibleDepartments.length}</strong><small>{visibleDepartments.filter((item) => item.active).length} visible active units</small></div>
            <i /><div><span>Total workforce</span><strong>{totalEmployees}</strong><small>{role === "CEO" ? "Across the organization" : "Within your assigned department"}</small></div>
            <i /><div><span>Active employees</span><strong>{activeEmployees}</strong><small>Available today</small></div>
            <i /><div><span>Leadership access</span><strong>{role === "CEO" ? "CEO" : role === "Manager" ? "MG" : role === "Team Lead" ? "TL" : "HR"}</strong><small>{role === "CEO" ? "Organization-wide access" : "Department-scoped access"}</small></div>
        </section>
        {role === "CEO" && <form className="executive-membership glass-panel" onSubmit={joinExecutive}>
            <div className="executive-membership-copy"><span className="dept-icon"><CircleUserRound size={21} /></span><span><small>MY EXECUTIVE DEPARTMENT</small><strong>{executiveEmployee?.department ?? "Choose your primary department"}</strong><p>Your CEO profile can join or move to any active department without changing organization-wide access.</p></span></div>
            <label>Department<select name="departmentId" value={selectedExecutiveDepartmentId} onChange={(event) => setExecutiveDepartmentId(event.target.value)} required>
                <option value="">Select an active department</option>{visibleDepartments.filter((item) => item.active).map((department) => <option key={department.id} value={department.id}>{department.name} · {department.code}</option>)}
            </select></label>
            <label>Designation<input name="designation" defaultValue={executiveEmployee?.role ?? "Chief Executive Officer"} minLength={2} maxLength={120} required /></label>
            <label>Phone<input name="phoneNumber" maxLength={30} placeholder="Optional contact" /></label>
            <input type="hidden" name="joiningDate" value={officeToday()} />
            <button className="button button-primary" disabled={executiveBusy || !selectedExecutiveDepartmentId}><BadgeCheck size={16} />{executiveBusy ? "Saving…" : executiveEmployee ? "Move my profile" : "Register my profile"}</button>
        </form>}
        {showForm && <form className="staff-create-form panel glass-panel org-create-form" onSubmit={create}>
            <label>Department code<input name="code" minLength={2} maxLength={20} pattern="[A-Za-z0-9_-]+" placeholder="e.g. PRODUCT" required /></label>
            <label>Department name<input name="name" maxLength={120} placeholder="e.g. Product Engineering" required /></label>
            <label className="executive-create-option"><input type="checkbox" name="joinExecutive" value="yes" /> Create and register this as my CEO department</label>
            <button className="button button-primary">Create department</button>
        </form>}
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
        {visibleDepartments.length === 0 && <div className="empty-state org-scope-empty"><Building2 size={28} /><strong>No department is assigned</strong><small>Ask the CEO or System Admin to complete your role and department assignment.</small></div>}
        <div className={`org-grid${role === "CEO" ? "" : " org-grid-focused"}`}>{visibleDepartments.map((department) => {
            const fallbackMembers = employees.filter((employee) => belongsToDepartment(employee, department));
            const summary = summaryByDepartment.get(department.id);
            const memberCount = summary?.totalEmployees ?? fallbackMembers.length;
            const activeCount = summary?.activeEmployees ?? fallbackMembers.filter((item) => item.status === "Active").length;
            const routingDepartment = ["EXEC", "HR"].includes(department.code.toUpperCase());
            const expanded = effectiveExpandedDepartment === department.id;
            const loadedRoster = rosters[department.id];
            const liveMemberById = new Map(fallbackMembers.map((employee) => [employee.uuid ?? employee.id, employee]));
            const roster = loadedRoster
                ? loadedRoster.items.map((employee) => liveMemberById.get(employee.uuid ?? employee.id) ?? employee)
                : fallbackMembers;
            const leadAssignment = teamLeadAssignments.find((item) => item.departmentId === department.id && item.active);
            const leadEmployee = leadAssignment ? employees.find((item) => (item.uuid ?? item.id) === leadAssignment.teamLeadEmployeeId) : undefined;
            const hrAssignment = departmentHrAssignments.find((item) => item.departmentId === department.id && item.active);
            const hrAccount = hrAssignment ? staffAccounts.find((item) => item.userId === hrAssignment.hrUserId) : undefined;
            return <article className={`org-card glass-panel${expanded ? " expanded" : ""}`} key={department.id}>
                <div className="org-card-head"><span className="dept-icon"><Building2 size={21} /></span>
                    <span className="org-status"><i className={department.active ? "active" : ""} />{department.active ? "Active" : "Inactive"}</span></div>
                <small>{department.code}</small><h3>{department.name}</h3>
                <p><CircleUserRound size={15} /> {routingDepartment ? "Protected appointment-routing department" : "BrainServe operating department"}</p>
                <div className="team-lead-badge"><BadgeCheck size={16} /><span><small>TEAM LEAD</small><strong>{leadEmployee?.name ?? (leadAssignment ? "Assigned Team Lead" : "Not assigned")}</strong></span></div>
                <div className="team-lead-badge"><UserCog size={16} /><span><small>DEPARTMENT HR</small><strong>{hrAccount?.fullName ?? (hrAssignment ? "Assigned HR Admin" : "Not assigned")}</strong></span></div>
                <div className="org-card-metrics"><span><strong>{memberCount}</strong><small>People</small></span><span><strong>{activeCount}</strong><small>Active</small></span><span><strong>{summary?.onLeaveEmployees ?? fallbackMembers.filter((item) => item.status === "On leave").length}</strong><small>On leave</small></span></div>
                <div className="org-card-actions">
                    <button className="button button-secondary" onClick={() => void openDepartment(department)} aria-expanded={expanded}><Users size={15} /> {expanded ? "Close team" : "View team"}<ChevronRight size={14} /></button>
                    {canAddEmployee && <button className="button button-secondary" disabled={!department.active} onClick={() => onAddEmployee(department.id)}><UserPlus size={15} /> Add employee</button>}
                    {canToggleDepartment && <button className={department.active ? "button button-reject" : "button button-approve"} disabled={routingDepartment}
                                                    title={routingDepartment ? "Required for CEO and HR appointment routing" : `${department.active ? "Deactivate" : "Activate"} ${department.name}`}
                                                    onClick={() => void onToggle(department)}>{department.active ? "Deactivate" : "Activate"}</button>}
                </div>
                {expanded && <section className="department-roster">
                    <header><div><span>DEPARTMENT DIRECTORY</span><h4>{department.name} team</h4></div><b>{memberCount} people</b></header>
                    <form className="inline-account-form" onSubmit={(event) => {
                        event.preventDefault();
                        const query = String(new FormData(event.currentTarget).get("rosterQuery") ?? "").trim();
                        void loadDepartmentPage(department, 0, query);
                    }}><label>Find a team member<input name="rosterQuery" defaultValue={loadedRoster?.query ?? ""}
                                                       placeholder="Name, employee ID or company email" /></label><button className="button button-secondary"
                                                                                                                          disabled={loadingDepartment === department.id}><Search size={16} /> Search</button></form>
                    {loadingDepartment === department.id ? <div className="org-roster-state"><span className="loading-dot" />Loading live team…</div>
                        : roster.length ? <div className="department-people">{roster.map((employee) => <div key={employee.uuid ?? employee.id}>
                            <span className="avatar">{employee.initials}</span><span><strong>{employee.name}</strong><small>{employee.role} · {employee.email}</small></span>
                            <span className="mono-text">{employee.id}</span><StatusPill status={employee.status} />
                        </div>)}</div> : <div className="org-roster-state"><Users size={24} />No employees are assigned yet.</div>}
                    {loadedRoster && loadedRoster.totalPages > 1 && <div className="table-pagination">
                        <button type="button" className="button button-secondary" disabled={loadedRoster.page === 0
                            || loadingDepartment === department.id}
                                onClick={() => void loadDepartmentPage(department, loadedRoster.page - 1, loadedRoster.query)}>
                            <ArrowLeft size={15} /> Previous
                        </button>
                        <span>Page {loadedRoster.page + 1} of {loadedRoster.totalPages} · {loadedRoster.totalElements.toLocaleString("en-IN")} employees</span>
                        <button type="button" className="button button-secondary"
                                disabled={loadedRoster.page + 1 >= loadedRoster.totalPages || loadingDepartment === department.id}
                                onClick={() => void loadDepartmentPage(department, loadedRoster.page + 1, loadedRoster.query)}>
                            Next <ArrowRight size={15} />
                        </button>
                    </div>}
                    {canManageLead && !routingDepartment && <form className="team-lead-assignment" onSubmit={(event) => {
                        event.preventDefault(); const data = new FormData(event.currentTarget);
                        void onAssignTeamLead(department.id, String(data.get("employeeId")));
                    }}><label>{leadAssignment ? "Replace Team Lead" : "Assign Team Lead"}<select name="employeeId" required defaultValue="">
                        <option value="" disabled>Select an active department employee</option>
                        {roster.filter((item) => item.status === "Active"
                            && (item.uuid ?? item.id) !== leadAssignment?.teamLeadEmployeeId)
                            .map((item) => <option key={item.uuid ?? item.id} value={item.uuid ?? item.id}>{item.name} · {item.role}</option>)}
                    </select><small>{roster.length} member{roster.length === 1 ? "" : "s"} on this page. Search by name, employee ID or email to find another eligible employee.</small></label><button className="button button-primary"><BadgeCheck size={15} /> {leadAssignment ? "Replace lead" : "Assign lead"}</button>
                        {leadAssignment && <button type="button" className="button button-reject" onClick={() => void onEndTeamLead(leadAssignment)}>End assignment</button>}</form>}
                    {canManageHr && <form className="team-lead-assignment" onSubmit={(event) => {
                        event.preventDefault(); const data = new FormData(event.currentTarget);
                        void onAssignDepartmentHr(department.id, String(data.get("hrUserId")));
                    }}><label>{hrAssignment ? "Replace department HR" : "Assign department HR"}<select name="hrUserId" required defaultValue="">
                        <option value="" disabled>Select an active HR Admin</option>
                        {staffAccounts.filter((account) => account.enabled && account.status === "ACTIVE"
                            && account.roles.includes("ROLE_HR_ADMIN") && account.employeeId
                            && account.userId !== hrAssignment?.hrUserId)
                            .map((account) => {
                                const current = departmentHrAssignments.find((assignment) => assignment.active && assignment.hrUserId === account.userId);
                                const currentDepartment = departments.find((item) => item.id === current?.departmentId);
                                return <option key={account.userId} value={account.userId}>{account.fullName} · {currentDepartment ? `currently ${currentDepartment.name}` : "unassigned"}</option>;
                            })}
                    </select><small>Assigned HRs remain selectable. Choosing one transfers their employee profile, visitor queue and work-audit scope to this department.</small></label><button className="button button-primary"><UserCog size={15} /> {hrAssignment ? "Replace / transfer HR" : "Assign / transfer HR"}</button>
                        {hrAssignment && <button type="button" className="button button-reject" onClick={() => void onEndDepartmentHr(hrAssignment)}>End HR assignment</button>}</form>}
                </section>}
            </article>;
        })}</div>
    </>;
}

const historyDatasetsByRole: Record<Role, HistoryDataset[]> = {
    "System Admin": ["VISITS", "EMPLOYEES", "TERMINATIONS", "WORKBOARD", "AUDIT", "CHECKPOINTS", "ESSENTIAL_LOGS"],
    CEO: ["VISITS", "EMPLOYEES", "TERMINATIONS", "WORKBOARD", "AUDIT", "CHECKPOINTS"],
    Manager: ["VISITS", "EMPLOYEES", "WORKBOARD", "CHECKPOINTS"],
    "HR Admin": ["VISITS", "EMPLOYEES", "TERMINATIONS", "WORKBOARD", "AUDIT", "CHECKPOINTS"],
    "Team Lead": ["VISITS", "EMPLOYEES", "WORKBOARD"],
    Reception: ["VISITS", "CHECKPOINTS"],
    Security: ["VISITS", "CHECKPOINTS"],
    Employee: ["VISITS", "WORKBOARD"],
};

const historyDatasetLabels: Record<HistoryDataset, string> = {
    VISITS: "Visits & appointments",
    EMPLOYEES: "Employee records",
    TERMINATIONS: "Termination records",
    WORKBOARD: "Work board activity",
    AUDIT: "Audit trail",
    CHECKPOINTS: "Visitor checkpoints",
    ESSENTIAL_LOGS: "Essential business logs",
};

function HistoryDatasetOptions({ role }: { role: Role }) {
    const allowed = historyDatasetsByRole[role];
    const otherRecords = allowed.filter((dataset) => dataset !== "VISITS");
    return <>
        {allowed.includes("VISITS") && <option value="VISITS">{historyDatasetLabels.VISITS}</option>}
        {otherRecords.length > 0 && <optgroup label="Other records">
            {otherRecords.map((dataset) =>
                <option key={dataset} value={dataset}>{historyDatasetLabels[dataset]}</option>)}
        </optgroup>}
    </>;
}

function previewAppointmentInstant(appointment: Appointment) {
    const persisted = appointment.slotStart ?? appointment.receptionVerifiedAt
        ?? appointment.securityIntakeAt ?? appointment.createdAt;
    if (persisted && !Number.isNaN(new Date(persisted).getTime())) return persisted;
    const match = appointment.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return officeDateTimeToIso(officeToday(), "12:00");
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return officeDateTimeToIso(officeToday(), `${String(hour).padStart(2, "0")}:${match[2]}`);
}

function previewHistoryRows(dataset: HistoryDataset, appointments: Appointment[],
                            accessRecords: AccessRecord[]): HistoryRow[] {
    const monthStart = `${officeToday().slice(0, 8)}01`;
    const rows: HistoryRow[] = dataset === "VISITS"
        ? appointments.map((appointment) => ({
            id: appointment.id, occurredAt: previewAppointmentInstant(appointment), dataset,
            departmentId: appointment.routingDepartmentId ?? null,
            primaryLabel: appointment.referenceNumber ?? appointment.id,
            secondaryLabel: `${appointment.visitor} · ${appointment.host}`,
            status: appointment.status,
            details: { visitType: appointment.type, company: appointment.company, purpose: appointment.purpose },
        }))
        : dataset === "EMPLOYEES"
            ? readDemoEmployees().map((employee, index) => ({
                id: employee.uuid ?? employee.id,
                occurredAt: officeDateTimeToIso(
                    `${monthStart.slice(0, 8)}${String(Math.min(index + 1, 28)).padStart(2, "0")}`, "09:00"),
                dataset, departmentId: employee.departmentId ?? null, primaryLabel: employee.id,
                secondaryLabel: `${employee.name} · ${employee.role}`, status: employee.status,
                details: { email: employee.email, department: employee.department },
            }))
            : dataset === "TERMINATIONS"
                ? readDemoTerminations().map((termination) => ({
                    id: termination.id, occurredAt: termination.requestedAt, dataset,
                    departmentId: termination.departmentId, primaryLabel: termination.employeeNumber,
                    secondaryLabel: `${termination.employeeName} · termination request`, status: termination.status,
                    details: { reason: termination.reason, effectiveDate: termination.effectiveDate,
                        decisionNote: termination.decisionNote },
                }))
                : dataset === "WORKBOARD"
                    ? readDemoWorkTasks().map((task) => ({
                        id: task.id, occurredAt: task.createdAt, dataset, departmentId: task.departmentId,
                        primaryLabel: task.title, secondaryLabel: `${task.departmentBranch} · ${task.employeeId}`,
                        status: task.status, details: { dueDate: task.dueDate, description: task.description },
                    }))
                    : dataset === "AUDIT"
                        ? readDemoAccountLifecycle().map((event) => ({
                            id: event.id, occurredAt: event.occurredAt, dataset, departmentId: null,
                            primaryLabel: event.eventType, secondaryLabel: `${event.targetUserId} · ${event.toStatus}`,
                            status: event.toStatus, details: { fromStatus: event.fromStatus, detail: event.detail },
                        }))
                        : dataset === "CHECKPOINTS"
                            ? accessRecords.map((record) => ({
                                id: record.id, occurredAt: record.checkedOutAt ?? record.checkedInAt, dataset,
                                departmentId: null, primaryLabel: record.badgeNumber,
                                secondaryLabel: `${record.visitorName} · access checkpoint`,
                                status: record.checkedOutAt ? "CHECKED_OUT" : "CHECKED_IN",
                                details: { appointmentId: record.appointmentId, processedBy: record.processedBy,
                                    checkedInAt: record.checkedInAt, checkedOutAt: record.checkedOutAt },
                            }))
                            : readDemoEssentialLogs().map((record) => ({
                                id: record.id, occurredAt: record.occurredAt, dataset, departmentId: null,
                                primaryLabel: record.eventType, secondaryLabel: record.title, status: record.status,
                                details: { category: record.category, subjectType: record.subjectType,
                                    subjectId: record.subjectId, detail: record.detail },
                            }));
    return rows.sort((left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function nextIsoDay(date: string) {
    const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
}

function ScalableReportsView({ role, refreshKey }: { role: Role; refreshKey: number }) {
    const today = officeToday();
    const [dataset, setDataset] = useState<HistoryDataset>(historyDatasetsByRole[role][0]);
    const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
    const [to, setTo] = useState(today);
    const [status, setStatus] = useState("");
    const [query, setQuery] = useState("");
    const [applied, setApplied] = useState({ dataset, from, to, status, query });
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [exports, setExports] = useState<ReportExportJob[]>([]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [section, setSection] = useState<"explore" | "exports">("explore");

    const filters = useCallback((cursor?: string) => ({ dataset: applied.dataset,
        from: `${applied.from}T00:00:00+05:30`, to: `${nextIsoDay(applied.to)}T00:00:00+05:30`,
        status: applied.status || undefined, query: applied.query.trim() || undefined, cursor, size: 50,
    }), [applied]);

    const load = useCallback(async (append = false, cursor?: string) => {
        setBusy(append ? "more" : "history"); setError("");
        try {
            const page = await brainServeApi.history(filters(cursor));
            setRows((current) => append ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor); setHasMore(page.hasMore);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "History could not be loaded."); }
        finally { setBusy(""); }
    }, [filters]);

    const refreshExports = useCallback(async () => {
        try { setExports(await brainServeApi.reportExports()); } catch { /* History remains usable. */ }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => { void load(); void refreshExports(); }, 0);
        return () => window.clearTimeout(timer);
    }, [load, refreshExports, refreshKey]);
    useEffect(() => {
        if (!exports.some((item) => item.status === "QUEUED" || item.status === "RUNNING")) return;
        const timer = window.setInterval(() => void refreshExports(), 4000);
        return () => window.clearInterval(timer);
    }, [exports, refreshExports]);

    const requestExport = async (format: "CSV" | "XLSX") => {
        setBusy(format); setError("");
        try {
            await brainServeApi.requestReportExport({ dataset: applied.dataset, format,
                from: `${applied.from}T00:00:00+05:30`, to: `${nextIsoDay(applied.to)}T00:00:00+05:30`,
                status: applied.status || undefined, query: applied.query.trim() || undefined });
            await refreshExports();
            setSection("exports");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Export could not be queued."); }
        finally { setBusy(""); }
    };

    const retry = async (job: ReportExportJob) => {
        setBusy(job.id); setError("");
        try { await brainServeApi.retryReportExport(job.id); await refreshExports(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Export could not be retried."); }
        finally { setBusy(""); }
    };

    const applyPreset = (days: number) => {
        const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - days + 1);
        setFrom(start.toISOString().slice(0, 10)); setTo(today);
    };

    const download = async (job: ReportExportJob) => {
        setBusy(job.id); setError("");
        try { const access = await brainServeApi.reportExportDownload(job.id); window.location.assign(access.url); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Download link could not be created."); }
        finally { setBusy(""); }
    };

    const detailPreview = (row: HistoryRow) => Object.entries(row.details).filter(([, value]) => value !== null && value !== "")
        .slice(0, 3).map(([key, value]) => `${key.replaceAll(/([A-Z])/g, " $1")}: ${String(value)}`).join(" · ");

    return <><PageTitle eyebrow="ROLE-SCOPED DATA EXPLORER" title="Fast daily and historical records"
                        detail="Server-side filters, cursor pagination and background exports keep multi-year records responsive." />
        <nav className="report-section-tabs" aria-label="Report workspace">
            <button className={section === "explore" ? "active" : ""} onClick={() => setSection("explore")}><Search size={16} /><span><strong>Explore records</strong><small>Filter and review authorized history</small></span></button>
            <button className={section === "exports" ? "active" : ""} onClick={() => setSection("exports")}><FileText size={16} /><span><strong>Export centre</strong><small>{exports.filter((item) => item.status === "QUEUED" || item.status === "RUNNING").length} processing · {exports.filter((item) => item.status === "COMPLETED").length} ready</small></span></button>
        </nav>
        {section === "explore" && <>
            <div className="history-presets" aria-label="Quick date ranges"><span>Quick range</span><button type="button" onClick={() => applyPreset(1)}>Today</button><button type="button" onClick={() => applyPreset(7)}>7 days</button><button type="button" onClick={() => applyPreset(30)}>30 days</button></div>
            <form className="history-filter-panel glass-panel" onSubmit={(event) => { event.preventDefault(); setRows([]); setApplied({ dataset, from, to, status, query }); }}>
                <label>Dataset<select value={dataset} onChange={(event) => { const next = event.target.value as HistoryDataset; setDataset(next); setStatus(""); setRows([]); setApplied({ dataset: next, from, to, status: "", query }); }}>
                    <HistoryDatasetOptions role={role} /></select></label>
                <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} required /></label>
                <label>To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} required /></label>
                <label>Status<input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="All statuses" /></label>
                <label className="history-query">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, visitor, employee or event" /></label>
                <div className="history-filter-actions"><button className="button button-primary" disabled={Boolean(busy)}><Search size={15} />{busy === "history" ? "Loading…" : "Apply filters"}</button>
                    <button type="button" className="button button-secondary" disabled={Boolean(busy)}
                            onClick={() => void load()}><RotateCcw size={15} />Refresh</button></div>
            </form>
            {error && <div className="login-error" role="alert">{error}</div>}
            <section className="history-summary employee-summary"><div><strong>{rows.length}</strong><span>Rows loaded</span></div><i /><div><strong>{hasMore ? "More available" : "All loaded"}</strong><span>Pagination status</span></div><i /><div><strong>{applied.from}</strong><span>Applied start</span></div><i /><div><strong>{applied.to}</strong><span>Applied end</span></div></section>
            <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>{historyDatasetLabels[dataset]}</span><h2>Role-authorized history</h2><p>Only the fields and department scope permitted for {role} are returned by the server.</p></div><div className="history-export-actions"><button className="button button-secondary" disabled={Boolean(busy)} onClick={() => void requestExport("CSV")}><FileText size={15} />{busy === "CSV" ? "Queuing…" : "Export CSV"}</button><button className="button button-primary" disabled={Boolean(busy)} onClick={() => void requestExport("XLSX")}><FileText size={15} />{busy === "XLSX" ? "Queuing…" : "Export XLSX"}</button></div></div>
                <div className="records-table-wrap"><table className="records-table history-table"><thead><tr><th>Occurred</th><th>Record</th><th>Context</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.occurredAt}:${row.id}`}><td><strong>{formatOfficeDate(row.occurredAt)}</strong><small>{formatOfficeTime(row.occurredAt)}</small></td><td><strong>{row.primaryLabel}</strong><code>{row.id}</code></td><td><strong>{row.secondaryLabel}</strong><small>{detailPreview(row) || "No additional detail"}</small></td><td><span className="business-status">{row.status.replaceAll("_", " ")}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan={4}><div className="empty-state table-empty"><FileClock size={28} /><strong>No records match these filters</strong><small>Choose another date range, status or search term.</small></div></td></tr>}</tbody></table></div>
                {hasMore && <div className="history-load-more"><button className="button button-secondary" disabled={Boolean(busy)} onClick={() => void load(true, nextCursor ?? undefined)}>{busy === "more" ? "Loading…" : "Load next 50 records"}</button></div>}
            </article></>}
        {section === "exports" && <article className="panel glass-panel records-panel export-jobs-panel"><div className="panel-heading"><div><span>BACKGROUND EXPORTS</span><h2>Export centre</h2><p>Files are generated securely in the background. Completed downloads expire automatically.</p></div><button className="icon-button" onClick={() => void refreshExports()} aria-label="Refresh exports"><RotateCcw size={17} /></button></div>
            <div className="export-help-strip"><Archive size={18} /><span><strong>No need to keep this page open.</strong><small>You receive an Internal Delivery alert when the file is ready.</small></span></div>
            <div className="export-job-list">{exports.slice(0, 20).map((job) => <div key={job.id}><span className={`export-job-state export-${job.status.toLowerCase()}`}>{job.status}</span><span><strong>{job.dataset.replaceAll("_", " ")} · {job.format}</strong><small>{job.rowCount ? `${job.rowCount.toLocaleString("en-IN")} rows · ` : ""}{formatOfficeDate(job.createdAt)}{job.expiresAt ? ` · expires ${formatOfficeDate(job.expiresAt)}` : ""}</small>{job.errorMessage && <small className="export-error">{job.errorMessage}</small>}</span><div className="export-row-actions">{job.status === "COMPLETED" && <button className="button button-primary" disabled={busy === job.id} onClick={() => void download(job)}>{busy === job.id ? "Preparing…" : "Download"}</button>}{job.status === "FAILED" && <button className="button button-secondary" disabled={busy === job.id} onClick={() => void retry(job)}><RotateCcw size={14} />{busy === job.id ? "Retrying…" : "Retry"}</button>}</div></div>)}{exports.length === 0 && <div className="empty-state"><Archive size={25} /><strong>No exports requested yet</strong><small>Return to Explore records and export the currently applied filters.</small></div>}</div>
        </article>}
    </>;
}

function ReportsView(props: { role: Role; metrics: DashboardMetrics; appointments: Appointment[];
    accessRecords: AccessRecord[]; refreshKey: number; onRefresh: () => void }) {
    const [workspace, setWorkspace] = useState<"overview" | "explore">("overview");
    if (isBackendConfigured) return <ScalableReportsView role={props.role} refreshKey={props.refreshKey} />;
    return <>
        <nav className="report-workspace-nav" aria-label="Reports navigation">
            <button type="button" className={workspace === "overview" ? "active" : ""} onClick={() => setWorkspace("overview")}>
                <FileClock size={17} /><span><strong>Reports overview</strong><small>Current operational totals</small></span>
            </button>
            <button type="button" className={workspace === "explore" ? "active" : ""} onClick={() => setWorkspace("explore")}>
                <Search size={17} /><span><strong>Explore Records</strong><small>Previous, monthly and custom-range data</small></span>
            </button>
        </nav>
        {workspace === "overview"
            ? <LegacyReportsView {...props} />
            : <LegacyExploreRecordsView role={props.role} appointments={props.appointments}
                                        accessRecords={props.accessRecords} onRefresh={props.onRefresh} />}
    </>;
}

function LegacyExploreRecordsView({ role, appointments, accessRecords, onRefresh }: { role: Role;
    appointments: Appointment[]; accessRecords: AccessRecord[]; onRefresh: () => void }) {
    const today = officeToday();
    const [dataset, setDataset] = useState<HistoryDataset>(historyDatasetsByRole[role][0]);
    const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
    const [to, setTo] = useState(today);
    const [status, setStatus] = useState("");
    const [query, setQuery] = useState("");
    const availableRows = previewHistoryRows(dataset, appointments, accessRecords);
    const matches = availableRows.filter((row) => {
        const occurred = officeDateFromInstant(row.occurredAt);
        const dateMatches = occurred >= from && occurred <= to;
        const statusMatches = !status || row.status.toLowerCase() === status.toLowerCase();
        const textMatches = !query.trim()
            || `${row.id} ${row.primaryLabel} ${row.secondaryLabel} ${JSON.stringify(row.details)}`
                .toLowerCase().includes(query.trim().toLowerCase());
        return dateMatches && statusMatches && textMatches;
    });
    const statuses = [...new Set(availableRows.map((row) => row.status))].sort();
    const detailPreview = (row: HistoryRow) => Object.entries(row.details)
        .filter(([, value]) => value !== null && value !== "")
        .slice(0, 3)
        .map(([key, value]) => `${key.replaceAll(/([A-Z])/g, " $1")}: ${
            typeof value === "object" ? JSON.stringify(value) : String(value)}`)
        .join(" · ");
    return <><PageTitle eyebrow="ROLE-SCOPED DATA EXPLORER" title="Explore historical records"
                        detail={`Visits, appointments and other authorized operational records available to ${role}.`} />
        <div className="history-presets" aria-label="Quick date ranges"><span>Quick range</span><button type="button" onClick={() => { setFrom(today); setTo(today); }}>Today</button><button type="button" onClick={() => { const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 6); setFrom(start.toISOString().slice(0, 10)); setTo(today); }}>7 days</button><button type="button" onClick={() => { setFrom(`${today.slice(0, 8)}01`); setTo(today); }}>This month</button></div>
        <div className="history-filter-panel glass-panel">
            <label>Dataset<select value={dataset} onChange={(event) => {
                setDataset(event.target.value as HistoryDataset); setStatus("");
            }}><HistoryDatasetOptions role={role} /></select></label>
            <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="history-query">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, visitor, host or purpose" /></label>
            <div className="history-filter-actions"><button type="button" className="button button-secondary"
                                                            onClick={onRefresh}><RotateCcw size={15} />Refresh records</button></div>
        </div>
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>AUTHORIZED HISTORY</span><h2>{historyDatasetLabels[dataset]}</h2><p>Showing records from {from} through {to}. Role restrictions are preserved.</p></div><b>{matches.length}</b></div>
            <div className="records-table-wrap"><table className="records-table history-table"><thead><tr><th>Occurred</th><th>Record</th><th>Context</th><th>Status</th></tr></thead><tbody>{matches.map((row) => <tr key={`${row.dataset}:${row.id}`}><td><strong>{formatOfficeDate(row.occurredAt)}</strong><small>{formatOfficeTime(row.occurredAt)}</small></td><td><strong>{row.primaryLabel}</strong><code>{row.id}</code></td><td><strong>{row.secondaryLabel}</strong><small>{detailPreview(row) || "No additional detail"}</small></td><td><span className="business-status">{row.status.replaceAll("_", " ")}</span></td></tr>)}{matches.length === 0 && <tr><td colSpan={4}><div className="empty-state table-empty"><FileClock size={28} /><strong>No {historyDatasetLabels[dataset].toLowerCase()} match these filters</strong><small>Try a wider date range, choose another dataset, or clear the status and search filters.</small></div></td></tr>}</tbody></table></div>
        </article></>;
}

function LegacyReportsView({ role, metrics, appointments }: { role: Role; metrics: DashboardMetrics; appointments: Appointment[] }) {
    const now = new Date();
    const [period, setPeriod] = useState(officeYearMonth(now));
    const [records, setRecords] = useState<MonthlyRecords | null>(null);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    useEffect(() => {
        if (role !== "System Admin" || !isBackendConfigured) return;
        let active = true; const [year, month] = period.split("-").map(Number);
        brainServeApi.monthlyRecords(year, month).then((value) => { if (active) setRecords(value); })
            .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Monthly records could not be loaded."); });
        return () => { active = false; };
    }, [period, role]);
    const count = (label: string) => appointments.filter((item) => item.type === label).length;
    const total = Math.max(appointments.length, 1);
    const percentage = (label: string) => Math.round((count(label) / total) * 100);
    const demoVisitorRecords = !isBackendConfigured ? appointments.filter((item) => {
        if (!item.receptionVerifiedAt) return false;
        return officeYearMonth(item.receptionVerifiedAt) === period;
    }).map((item) => ({
        id: item.id, referenceNumber: item.referenceNumber ?? item.id,
        visitorName: item.arrivalVisitorName ?? item.visitor, visitorEmail: item.visitorEmail ?? "",
        visitorPhone: item.visitorPhone ?? "", visitorCompany: item.company, type: item.type.toUpperCase().replaceAll(" ", "_"),
        status: item.status.toUpperCase().replaceAll(" ", "_"), hostEmployeeId: item.hostEmployeeId ?? "",
        hostName: item.host, routingDepartmentId: item.routingDepartmentId ?? null,
        requestedEmployeeId: item.requestedEmployeeId ?? null,
        requestedEmployeeName: item.requestedEmployeeId ? item.host : null,
        slotStart: item.slotStart ?? item.receptionVerifiedAt!,
        purpose: item.arrivalPurpose ?? item.purpose, identityDocumentType: item.identityDocumentType ?? null,
        identityDocumentLastFour: item.identityDocumentLastFour ?? null,
        securityActorId: item.securityIntakeActorId ?? "security-preview", securityIntakeAt: item.securityIntakeAt ?? item.receptionVerifiedAt!,
        receptionActorId: item.receptionVerificationActorId ?? "reception-preview",
        receptionVerifiedAt: item.receptionVerifiedAt!, receptionRemarks: item.receptionVerificationRemarks ?? null,
        hrActorId: item.hrApprovalActorId ?? null, hrDecisionAt: item.hrDecisionAt ?? null,
        teamLeadActorId: item.teamLeadApprovalActorId ?? null,
        teamLeadDecisionAt: item.teamLeadDecisionAt ?? null,
        managerActorId: item.managerApprovalActorId ?? null,
        managerDecisionAt: item.managerDecisionAt ?? null,
        ceoActorId: item.ceoApprovalActorId ?? null, ceoDecisionAt: item.ceoDecisionAt ?? null,
        receptionForwardActorId: item.receptionForwardActorId ?? null,
        receptionForwardedAt: item.receptionForwardedAt ?? null,
        receptionForwardRemarks: item.receptionForwardRemarks ?? null,
        badgeNumber: null, checkedInAt: null, checkedOutAt: null, processedBy: null,
    })) : [];
    const visitorRecords = records?.visitors ?? demoVisitorRecords;
    const demoEmployeeRecords = !isBackendConfigured ? initialEmployees.map((item) => ({ id: item.uuid ?? item.id,
        employeeNumber: item.id, displayName: item.name, officialEmail: item.email, designation: item.role,
        status: item.status.toUpperCase().replaceAll(" ", "_"), joiningDate: "2026-01-06", relievingDate: null })) : [];
    const employeeRecords = records?.employees ?? demoEmployeeRecords;
    const leaveRecords = records?.leaveRequests ?? [];
    const normalizedQuery = query.trim().toLowerCase();
    const filteredVisitors = visitorRecords.filter((item) => !normalizedQuery
        || `${item.visitorName} ${item.visitorCompany ?? ""} ${item.referenceNumber} ${item.hostName} ${item.purpose} ${item.status}`.toLowerCase().includes(normalizedQuery));
    const filteredEmployees = employeeRecords.filter((item) => !normalizedQuery
        || `${item.displayName} ${item.employeeNumber} ${item.officialEmail} ${item.designation} ${item.status}`.toLowerCase().includes(normalizedQuery));
    const filteredLeaves = leaveRecords.filter((item) => !normalizedQuery
        || `${item.employeeId} ${item.reason} ${item.status} ${item.startDate} ${item.endDate}`.toLowerCase().includes(normalizedQuery));
    if (role === "System Admin") return <><PageTitle eyebrow="SYSTEM RECORDS" title="Monthly workforce & visitor register"
                                                     detail="Persisted appointment, employee lifecycle and leave records. Deactivated people remain in history." action={<label className="month-picker">Month<input type="month" value={period} onChange={(event) => { setRecords(null); setError(""); setPeriod(event.target.value); }} /></label>} />
        {error && <div className="login-error" role="alert">{error}</div>}
        <section className="employee-summary records-summary"><div><strong>{records?.visitorCount ?? visitorRecords.length}</strong><span>Reception arrivals</span></div><i /><div><strong>{records?.employeeCount ?? employeeRecords.length}</strong><span>Employee records</span></div><i /><div><strong>{records?.joinedEmployees ?? employeeRecords.length}</strong><span>Joined</span></div><i /><div><strong>{records?.relievedEmployees ?? employeeRecords.filter((item) => item.relievingDate).length}</strong><span>Relieved</span></div><i /><div><strong>{records?.pendingLeaveRequests ?? leaveRecords.filter((item) => item.status === "PENDING").length}</strong><span>Pending leave</span></div></section>
        <div className="toolbar records-toolbar glass-panel"><div className="toolbar-search wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visitor, reference, host, employee or leave reason" /></div><span><FileText size={15} /> {records?.period ?? period} retained records</span></div>
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>MONTHLY VISITOR REGISTER</span><h2>Reception-processed visitors</h2><p>Security, Reception, approval and access details are retained in one export-ready table.</p></div><b>{filteredVisitors.length}</b></div><div className="records-table-wrap"><table className="records-table visitor-records-table"><thead><tr><th>Visitor</th><th>Visit & purpose</th><th>Host & schedule</th><th>Workflow trail</th><th>Access</th><th>Status</th></tr></thead><tbody>{filteredVisitors.map((item) => <tr key={item.id}><td><strong>{item.visitorName}</strong><small>{item.visitorCompany ?? "Independent"}</small><small>{item.visitorEmail}{item.visitorPhone ? ` · ${item.visitorPhone}` : ""}</small><code>{item.referenceNumber}</code></td><td><strong>{item.type.replaceAll("_", " ")}</strong><small>{item.purpose}</small><small>{item.identityDocumentLastFour ? `${item.identityDocumentType ?? "ID"} ••••${item.identityDocumentLastFour}` : "No identity reference retained"}</small></td><td><strong>{item.hostName}</strong><small>{formatOfficeDate(item.slotStart)} · {formatOfficeTime(item.slotStart)}</small><small>Host ID {item.hostEmployeeId}</small></td><td><span className="trail-line"><ShieldCheck size={13} />Security {formatOfficeTime(item.securityIntakeAt)}</span><span className="trail-line"><BadgeCheck size={13} />Reception {formatOfficeTime(item.receptionVerifiedAt)}</span>{item.type === "CEO_VISIT" || item.managerDecisionAt || item.ceoDecisionAt ? <><span className="trail-line"><UserCog size={13} />{item.managerDecisionAt ? `Manager ${formatOfficeTime(item.managerDecisionAt)}` : "Manager pending"}</span><span className="trail-line"><ShieldCheck size={13} />{item.ceoDecisionAt ? `CEO ${formatOfficeTime(item.ceoDecisionAt)}` : "CEO pending"}</span></> : <><span className="trail-line"><UserCog size={13} />{item.hrDecisionAt ? `HR ${formatOfficeTime(item.hrDecisionAt)}` : "HR pending"}</span><span className="trail-line"><Users size={13} />{item.teamLeadDecisionAt ? `Team Lead ${formatOfficeTime(item.teamLeadDecisionAt)}` : "Team Lead —"}</span></>}</td><td><strong>{item.badgeNumber ? `Badge ${item.badgeNumber}` : "No badge"}</strong><small>{item.checkedInAt ? `In ${formatOfficeTime(item.checkedInAt)}` : "Not checked in"}</small><small>{item.checkedOutAt ? `Out ${formatOfficeTime(item.checkedOutAt)}` : "Not checked out"}</small></td><td><StatusPill status={appointmentStatusFromApi(item.status)} /></td></tr>)}{filteredVisitors.length === 0 && <tr><td colSpan={6}><div className="empty-state table-empty"><IdCard size={28} /><strong>No matching Reception-processed visitors</strong><small>Scheduled appointments that never reached Reception are excluded.</small></div></td></tr>}</tbody></table></div></article>
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>EMPLOYEE LIFECYCLE REGISTER</span><h2>Retained workforce records</h2><p>Employment rows remain available after resignation, termination or deactivation.</p></div><b>{filteredEmployees.length}</b></div><div className="records-table-wrap"><table className="records-table"><thead><tr><th>Employee</th><th>Employee ID</th><th>Designation</th><th>Joined</th><th>Relieved</th><th>Status</th></tr></thead><tbody>{filteredEmployees.map((item) => <tr key={item.id}><td><strong>{item.displayName}</strong><small>{item.officialEmail}</small></td><td><code>{item.employeeNumber}</code></td><td><strong>{item.designation}</strong></td><td>{item.joiningDate}</td><td>{item.relievingDate ?? "—"}</td><td><StatusPill status={employeeStatusLabel(item.status)} /></td></tr>)}{filteredEmployees.length === 0 && <tr><td colSpan={6}><div className="empty-state table-empty"><Users size={28} /><strong>No matching employee records</strong></div></td></tr>}</tbody></table></div></article>
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>LEAVE REQUEST REGISTER</span><h2>Monthly leave decisions</h2><p>Requests, decisions and reasons remain linked to the employee record.</p></div><b>{filteredLeaves.length}</b></div><div className="records-table-wrap"><table className="records-table"><thead><tr><th>Employee ID</th><th>Period</th><th>Reason</th><th>Requested</th><th>Decision</th><th>Status</th></tr></thead><tbody>{filteredLeaves.map((item) => <tr key={item.id}><td><code>{item.employeeId}</code></td><td><strong>{item.startDate}</strong><small>to {item.endDate}</small></td><td>{item.reason}</td><td>{formatOfficeDate(item.createdAt)}</td><td>{item.decisionReason ?? "—"}</td><td><StatusPill status={item.status === "PENDING" ? "Pending" : item.status === "APPROVED" ? "Approved" : item.status === "REJECTED" ? "Rejected" : "Cancelled"} /></td></tr>)}{filteredLeaves.length === 0 && <tr><td colSpan={6}><div className="empty-state table-empty"><CalendarDays size={28} /><strong>No matching leave requests</strong><small>Leave records for this month will appear here.</small></div></td></tr>}</tbody></table></div></article></>;
    return <><PageTitle eyebrow="REPORTING & INSIGHTS" title="Current operational picture" detail="Live totals from appointment, employee and reception services." /><div className="report-grid"><article className="panel glass-panel wide-report"><div className="panel-heading"><div><span>APPOINTMENT ACTIVITY</span><h2>Current service totals</h2></div></div><div className="report-number"><strong>{appointments.length}</strong><span>loaded appointments</span><b>{metrics.awaitingApproval} awaiting approval</b></div><div className="employee-summary"><div><strong>{metrics.activeVisits}</strong><span>Active visits</span></div><i /><div><strong>{metrics.visitorsInside}</strong><span>Inside</span></div><i /><div><strong>{metrics.activeEmployees}</strong><span>Active employees</span></div></div></article><article className="panel glass-panel"><div className="panel-heading"><div><span>BY VISIT TYPE</span><h2>Visit mix</h2></div></div><div className="visit-mix"><span className="mix-donut"><strong>{appointments.length}</strong><small>Total</small></span><ul><li><i />Employee visit <b>{percentage("Employee visit")}%</b></li><li><i />Interview <b>{percentage("Interview")}%</b></li><li><i />Client meeting <b>{percentage("Client meeting")}%</b></li><li><i />CEO visit <b>{percentage("CEO visit")}%</b></li></ul></div></article></div></>;
}

function EssentialLogsView() {
    const [records, setRecords] = useState<EssentialLogRecord[]>(() => isBackendConfigured ? [] : readDemoEssentialLogs());
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("");
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = useCallback(async (append = false, cursor?: string) => {
        if (!isBackendConfigured) return;
        setBusy(true); setError("");
        try {
            const page = await brainServeApi.essentialLogs({
                query: query.trim() || undefined, category: category.trim() || undefined,
                status: status.trim() || undefined,
                from: from ? `${from}T00:00:00Z` : undefined,
                to: to ? `${nextIsoDay(to)}T00:00:00Z` : undefined,
                cursor, size: 50,
            });
            setRecords((current) => append ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor); setHasMore(page.hasMore); setTotal(page.total);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Essential logs could not be loaded.");
        } finally { setBusy(false); }
    }, [category, from, query, status, to]);
    useEffect(() => {
        if (!isBackendConfigured) return;
        const timer = window.setTimeout(() => void load(), 250);
        return () => window.clearTimeout(timer);
    }, [load]);
    const categories = [...new Set(records.map((item) => item.category))].sort();
    const filtered = isBackendConfigured ? records : records.filter((item) =>
        (!category || item.category === category) && (!status || item.status === status)
        && `${item.title} ${item.detail} ${item.eventType} ${item.subjectType} ${item.subjectId} ${item.referenceId ?? ""}`
            .toLowerCase().includes(query.trim().toLowerCase()));
    return <><PageTitle eyebrow="SYSTEM ADMIN RECORDS" title="Essential business logs"
                        detail="Database-backed lifecycle decisions retained for governance, investigations and future audits." />
        <section className="employee-summary"><div><strong>{isBackendConfigured ? total : records.length}</strong><span>Matching events</span></div><i /><div><strong>{records.length}</strong><span>Loaded safely</span></div><i /><div><strong>{records.filter((item) => item.status.includes("PENDING")).length}</strong><span>Pending on page</span></div><i /><div><strong>{categories.length}</strong><span>Loaded categories</span></div></section>
        <div className="toolbar glass-panel bounded-filter-bar"><div className="toolbar-search wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, reference, action or detail" /></div><input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" aria-label="Essential log category" /><input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Status" aria-label="Essential log status" /><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From date" /><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To date" /></div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <article className="panel glass-panel records-panel"><div className="panel-heading"><div><span>IMMUTABLE BUSINESS REGISTER</span><h2>Governance events</h2><p>Newest-first cursor paging keeps multi-year history responsive.</p></div><b>{filtered.length} / {isBackendConfigured ? total : filtered.length}</b></div><div className="records-table-wrap"><table className="records-table essential-logs-table"><thead><tr><th>Occurred</th><th>Category & event</th><th>Subject</th><th>Business detail</th><th>Decision</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{formatOfficeDate(item.occurredAt)}</strong><small>{formatOfficeTime(item.occurredAt)}</small></td><td><strong>{item.category.replaceAll("_", " ")}</strong><small>{item.eventType.replaceAll("_", " ")}</small><code>{item.referenceId ?? item.id}</code></td><td><strong>{item.subjectType.replaceAll("_", " ")}</strong><small>{item.subjectId}</small></td><td><strong>{item.title}</strong><small>{item.detail}</small></td><td><span className={`business-status business-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span><small>Actor {item.actorUserId ?? "system"}</small>{item.approverUserId && <small>Approver {item.approverUserId}</small>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={5}><div className="empty-state table-empty"><FileText size={28} /><strong>No essential records found</strong><small>Change the database filters or date range.</small></div></td></tr>}</tbody></table></div>{isBackendConfigured && hasMore && <div className="bounded-pagination"><button className="button button-secondary" disabled={busy || !nextCursor} onClick={() => void load(true, nextCursor ?? undefined)}>{busy ? "Loading…" : "Load 50 more"}</button></div>}</article>
    </>;
}

function AuditView() {
    const [events, setEvents] = useState<Array<{ id: string; occurredAt: string; actorId: string; eventType: string;
        targetType: string; targetId: string; outcome: string; correlationId: string | null }>>(() => !isBackendConfigured
        ? [{ id: "demo-audit", occurredAt: new Date().toISOString(), actorId: "demo-user",
            eventType: "DEMO_WORKSPACE_OPENED", targetType: "WORKSPACE", targetId: "brainserve-demo",
            outcome: "SUCCESS", correlationId: null }]
        : []);
    const [query, setQuery] = useState("");
    const [outcome, setOutcome] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = useCallback(async (append = false, cursor?: string) => {
        if (!isBackendConfigured) return;
        setBusy(true); setError("");
        try {
            const page = await brainServeApi.auditEvents({ query: query.trim() || undefined,
                outcome: outcome || undefined, from: from ? `${from}T00:00:00Z` : undefined,
                to: to ? `${nextIsoDay(to)}T00:00:00Z` : undefined, cursor, size: 50 });
            setEvents((current) => append ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor); setHasMore(page.hasMore); setTotal(page.total);
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : "Audit events could not be loaded.");
        } finally { setBusy(false); }
    }, [from, outcome, query, to]);
    useEffect(() => {
        if (!isBackendConfigured) return;
        const timer = window.setTimeout(() => void load(), 250);
        return () => window.clearTimeout(timer);
    }, [load]);
    const filtered = isBackendConfigured ? events : events.filter((event) =>
        `${event.actorId} ${event.eventType} ${event.targetType} ${event.targetId}`.toLowerCase().includes(query.toLowerCase()));
    return <><PageTitle eyebrow="AUDIT & COMPLIANCE" title="Every privileged action, accountable" detail="Immutable security and business events with correlation-level traceability." /><section className="employee-summary"><div><strong>{isBackendConfigured ? total : filtered.length}</strong><span>Matching events</span></div><i /><div><strong>{filtered.length}</strong><span>Loaded safely</span></div><i /><div><strong>50</strong><span>Records per request</span></div></section><div className="toolbar glass-panel bounded-filter-bar"><div className="toolbar-search wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action or reference" /></div><select value={outcome} onChange={(event) => setOutcome(event.target.value)} aria-label="Audit outcome"><option value="">All outcomes</option><option value="SUCCESS">Success</option><option value="FAILURE">Failure</option><option value="DENIED">Denied</option></select><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="From date" /><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="To date" /></div>{error && <div className="login-error" role="alert">{error}</div>}<div className="audit-list glass-panel">{filtered.map((event) => <div key={event.id}><span className="audit-icon"><ShieldCheck size={19} /></span><span><strong>{event.eventType.replaceAll("_", " ")}</strong><small>{event.actorId} · {event.targetType} {event.targetId}</small></span><code>{event.outcome}</code><time>{formatOfficeTime(event.occurredAt)}<small>{formatOfficeDate(event.occurredAt)}</small></time></div>)}{filtered.length === 0 && <div className="empty-state"><FileClock size={28} /><strong>No audit events found</strong></div>}{isBackendConfigured && hasMore && <div className="bounded-pagination"><button className="button button-secondary" disabled={busy || !nextCursor} onClick={() => void load(true, nextCursor ?? undefined)}>{busy ? "Loading…" : "Load 50 more"}</button></div>}</div></>;
}

function accountVisibleToApprover(account: ProvisioningAccount, role: Role) {
    if (role === "System Admin") {
        return account.status === "PENDING_APPROVAL"
            && account.role === "ROLE_CEO";
    }
    if (role === "CEO") {
        return account.status === "PENDING_APPROVAL"
            && ["ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(account.role);
    }
    if (role === "HR Admin") {
        return account.status === "PENDING_HR_APPROVAL"
            && ["ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(account.role);
    }
    return false;
}

function AccountRecoveryApprovalPanel({ generated, onGeneratedChange }: {
    generated: AccountRecoveryRequest | null;
    onGeneratedChange: (request: AccountRecoveryRequest | null) => void;
}) {
    const [requests, setRequests] = useState<AccountRecoveryRequest[]>(() =>
        isBackendConfigured ? [] : readDemoRecoveryRequests().filter((item) => item.status === "PENDING"));
    const [busyId, setBusyId] = useState("");
    const [copied, setCopied] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const loadRequests = useCallback(async (showError = true) => {
        if (!isBackendConfigured) {
            setRequests(readDemoRecoveryRequests().filter((item) => item.status === "PENDING"));
            setError("");
            return;
        }
        try {
            const items = await brainServeApi.pendingAccountRecoveryRequests();
            setRequests(items);
            setError("");
        } catch (reason) {
            if (showError) {
                setError(reason instanceof ApiError ? reason.message : "Recovery requests could not be loaded.");
            }
        }
    }, []);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => void loadRequests(), 0);
        const timer = window.setInterval(() => void loadRequests(false), 10000);
        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") void loadRequests(false);
        };
        const refreshPreviewStorage = (event: StorageEvent) => {
            if (!isBackendConfigured && event.key === DEMO_RECOVERY_REQUESTS_KEY) void loadRequests(false);
        };
        const refreshPreviewWindow = () => {
            if (!isBackendConfigured) void loadRequests(false);
        };
        window.addEventListener("focus", refreshWhenVisible);
        window.addEventListener("storage", refreshPreviewStorage);
        window.addEventListener("brainserve:demo-recovery-updated", refreshPreviewWindow);
        document.addEventListener("visibilitychange", refreshWhenVisible);
        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(timer);
            window.removeEventListener("focus", refreshWhenVisible);
            window.removeEventListener("storage", refreshPreviewStorage);
            window.removeEventListener("brainserve:demo-recovery-updated", refreshPreviewWindow);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
        };
    }, [loadRequests]);

    useEffect(() => {
        if (!generated?.expiresAt) return;
        const expiresAt = Date.parse(generated.expiresAt);
        if (!Number.isFinite(expiresAt)) return;
        const expiryTimer = window.setTimeout(() => {
            onGeneratedChange(null);
            setCopied(false);
            setMessage("");
            setError("The displayed recovery code has expired.");
        }, Math.max(0, expiresAt - Date.now()));
        return () => window.clearTimeout(expiryTimer);
    }, [generated?.id, generated?.expiresAt, onGeneratedChange]);

    const decide = async (request: AccountRecoveryRequest, decision: "approve" | "reject") => {
        setBusyId(request.id); setError(""); setMessage(""); setCopied(false);
        try {
            let result: AccountRecoveryRequest;
            if (isBackendConfigured) {
                result = await brainServeApi.decideAccountRecovery(request.id, decision,
                    decision === "reject" ? "Rejected after System Admin identity review" : "");
            } else if (decision === "approve") {
                const code = newDemoRecoveryCode();
                const approvedAt = new Date();
                result = { ...request, status: "APPROVED", recoveryCode: code,
                    approvedAt: approvedAt.toISOString(), expiresAt: new Date(approvedAt.getTime() + 30 * 60 * 1000).toISOString() };
                writeDemoRecoveryRequests(readDemoRecoveryRequests().map((item) => item.id === request.id
                    ? { ...result, recoveryCode: code } : item));
            } else {
                result = { ...request, status: "REJECTED", recoveryCode: null };
                writeDemoRecoveryRequests(readDemoRecoveryRequests().map((item) => item.id === request.id
                    ? { ...item, status: "REJECTED", recoveryCode: null } : item));
            }
            setRequests((items) => items.filter((item) => item.id !== request.id));
            if (decision === "approve") {
                if (!result.recoveryCode) {
                    throw new Error("Recovery was approved, but the backend did not return the one-time code.");
                }
                onGeneratedChange(result);
                setMessage(`Recovery approved for ${request.fullName}. Give the code to the verified account owner securely.`);
            } else {
                setMessage(`Recovery request for ${request.fullName} was rejected.`);
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The recovery decision failed.");
        } finally { setBusyId(""); }
    };

    const copyCode = async () => {
        if (!generated?.recoveryCode) return;
        try {
            await navigator.clipboard.writeText(generated.recoveryCode);
            setCopied(true);
        } catch { setError("Copy was blocked by the browser. Select the code and copy it manually."); }
    };

    return <article className="panel glass-panel recovery-approval-panel"><div className="panel-heading"><div><span>ACCOUNT RECOVERY APPROVALS</span><h2>Password & company email requests</h2><p>Verify the requester’s identity before approval. Only the System Admin can issue these one-time codes.</p></div><span className="panel-heading-actions"><b>{requests.length}</b><button type="button" className="button button-secondary" onClick={() => void loadRequests()}><RotateCcw size={15} /> Refresh requests</button></span></div>{generated?.recoveryCode && <div className="recovery-code-card"><span><ShieldCheck size={18} /> APPROVED · AVAILABLE UNTIL DISMISSED OR EXPIRED</span><h3>{generated.fullName}</h3><p>{generated.type === "PASSWORD" ? "Password reset" : "Company email recovery"} · expires {generated.expiresAt ? new Date(generated.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "in 30 minutes"}</p><code>{generated.recoveryCode}</code><div><button type="button" className="button button-secondary" onClick={() => void copyCode()}>{copied ? <Check size={16} /> : <FileText size={16} />}{copied ? "Copied" : "Copy code"}</button><button type="button" className="text-button" onClick={() => { onGeneratedChange(null); setCopied(false); setMessage(""); }}>Dismiss code</button></div><small>The raw code stays only in the current authenticated dashboard memory. It disappears on logout, page reload, manual dismissal or expiry.</small></div>}<div className="staff-account-list">{requests.map((request) => <div className="staff-account-row" key={request.id}><div className="staff-account-head"><span className="role-icon"><Fingerprint size={18} /></span><span><strong>{request.fullName}</strong><small>{request.email} · {request.role.replace("ROLE_", "").replaceAll("_", " ")} · {request.type === "PASSWORD" ? "Password reset" : "Email recovery"}</small></span><span className="status-pill status-pending"><span />Pending</span></div><div className="approval-actions"><button type="button" className="button button-reject" disabled={busyId === request.id} onClick={() => void decide(request, "reject")}><X size={16} /> Reject</button><button type="button" className="button button-approve" disabled={busyId === request.id} onClick={() => void decide(request, "approve")}><Check size={16} /> Verify & issue code</button></div></div>)}{requests.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>No pending recovery requests</strong><small>Password and email recovery approvals will appear here.</small></div>}</div>{message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}{error && <div className="login-error" role="alert">{error}</div>}</article>;
}

function AccountProvisioningPanel({ role, departments: initialApprovalDepartments, onDecision, compact = false }: {
    role: Role; departments: Department[]; onDecision?: () => Promise<void> | void; compact?: boolean;
}) {
    const [accounts, setAccounts] = useState<ProvisioningAccount[]>(() =>
        !isBackendConfigured ? readDemoAccounts().filter((account) => accountVisibleToApprover(account, role)) : []);
    const [approvalDepartments, setApprovalDepartments] = useState<Department[]>(initialApprovalDepartments);
    const [assignedHrDepartmentIds, setAssignedHrDepartmentIds] = useState<Set<string>>(() => new Set(
        (!isBackendConfigured ? readDemoDepartmentHrAssignments() : [])
            .filter((assignment) => assignment.active).map((assignment) => assignment.departmentId)));
    const [assignedManagerDepartmentIds, setAssignedManagerDepartmentIds] = useState<Set<string>>(() => new Set(
        (!isBackendConfigured ? readDemoManagerAssignments() : [])
            .filter((assignment) => assignment.active).map((assignment) => assignment.departmentId)));
    const [hrDrafts, setHrDrafts] = useState<Record<string, HrAccountApprovalInput>>({});
    const [busyId, setBusyId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [previewTemporaryPassword, setPreviewTemporaryPassword] = useState("");
    const [ceoSlotAvailable, setCeoSlotAvailable] = useState(() =>
        !isBackendConfigured && !readDemoAccounts().some((account) => account.role === "ROLE_CEO"
            && ["ACTIVE", "PENDING_APPROVAL"].includes(account.status)));
    const [governingCeoName, setGoverningCeoName] = useState(() =>
        !isBackendConfigured ? readDemoAccounts().find((account) => account.role === "ROLE_CEO"
            && ["ACTIVE", "PENDING_APPROVAL"].includes(account.status))?.fullName ?? "" : "");
    const [createAccountRole, setCreateAccountRole] = useState<
        "ROLE_CEO" | "ROLE_HR_ADMIN" | "ROLE_MANAGER"
    >("ROLE_HR_ADMIN");

    useEffect(() => {
        if (!["System Admin", "CEO", "HR Admin"].includes(role)) return;
        if (!isBackendConfigured) return;
        let active = true;
        const load = async () => {
            try {
                const pending = role === "System Admin"
                    ? await brainServeApi.pendingSystemAdminUsers()
                    : role === "CEO"
                        ? await brainServeApi.pendingCeoUsers()
                        : await brainServeApi.pendingHrUsers();
                if (active) setAccounts(pending);
            } catch (reason) {
                if (active) setError(reason instanceof ApiError ? reason.message : "The approval queue could not be loaded.");
            }
        };
        void load();
        return () => { active = false; };
    }, [role]);

    useEffect(() => {
        if (!isBackendConfigured || !["System Admin", "CEO"].includes(role)) return;
        let active = true;
        Promise.all([brainServeApi.departments(), brainServeApi.departmentHrAssignments(),
            brainServeApi.managerAssignments()])
            .then(([nextDepartments, hrAssignments, managerAssignments]) => {
                if (!active) return;
                setApprovalDepartments(nextDepartments);
                setAssignedHrDepartmentIds(new Set(hrAssignments.filter((assignment) => assignment.active)
                    .map((assignment) => assignment.departmentId)));
                setAssignedManagerDepartmentIds(new Set(managerAssignments.filter((assignment) => assignment.active)
                    .map((assignment) => assignment.departmentId)));
            })
            .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message
                : "Department assignments could not be loaded."); });
        return () => { active = false; };
    }, [role]);

    useEffect(() => {
        if (role !== "System Admin" || !isBackendConfigured) return;
        let active = true;
        brainServeApi.ceoSlot()
            .then((slot) => {
                if (!active) return;
                setCeoSlotAvailable(slot.available);
                setGoverningCeoName(slot.fullName ?? "");
            })
            .catch((reason) => {
                if (active) setError(reason instanceof Error ? reason.message
                    : "CEO governance status could not be loaded.");
            });
        return () => { active = false; };
    }, [role]);

    if (!["System Admin", "CEO", "HR Admin"].includes(role)) return null;

    const createPrivileged = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.currentTarget;
        const data = new FormData(form);

        setBusyId("create-privileged");
        setError("");
        setMessage("");
        setPreviewTemporaryPassword("");

        const fullName = String(data.get("fullName") ?? "").trim();
        const email = String(data.get("email") ?? "").trim().toLowerCase();
        const accountRole = String(data.get("role") ?? "");
        const departmentId = String(data.get("departmentId") ?? "").trim();
        const phoneNumber = String(data.get("phoneNumber") ?? "").trim();
        const designation = String(data.get("designation") ?? "").trim() || "HR Administrator";
        const joiningDate = String(data.get("joiningDate") ?? "").trim();

        const isHrAdmin = accountRole === "ROLE_HR_ADMIN";
        let createdAccountId: string | null = null;

        try {
            if (!fullName) fail("Enter the full name.");
            if (!email) fail("Enter the company email.");
            if (!["ROLE_CEO", "ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(accountRole)) {
                fail("Select CEO, HR Admin or Manager.");
            }
            if (!email.endsWith("@brainserve.in")) {
                fail("Use an official @brainserve.in company email.");
            }

            const onboarding: HrAccountApprovalInput | undefined = isHrAdmin
                ? {
                    departmentId,
                    phoneNumber: phoneNumber || null,
                    designation,
                    joiningDate,
                }
                : undefined;

            if (isHrAdmin) {
                if (!departmentId) fail("Select a department for the HR Admin.");
                if (!designation) fail("Enter the HR Admin designation.");
                if (!joiningDate) fail("Select the HR Admin joining date.");

                const selectedDepartment = approvalDepartments.find(
                    (department) => department.id === departmentId,
                );

                if (!selectedDepartment) {
                    fail("The selected department was not found. Reload the page and select it again.");
                }
                if (!selectedDepartment.active) {
                    fail("The selected department is inactive.");
                }
                if (assignedHrDepartmentIds.has(departmentId)) {
                    fail(`${selectedDepartment.name} already has an active HR Admin.`);
                }
            }

            if (isBackendConfigured) {
                /*
         * STEP 1: Create the pending privileged account.
         */
                const created = await brainServeApi.createPrivilegedAccount(
                    fullName,
                    email,
                    accountRole,
                );

                createdAccountId = created.id;

                /*
         * STEP 2: For HR Admin, immediately approve the account and
         * assign the selected department in the same form submission.
         */
                if (isHrAdmin && onboarding) {
                    await brainServeApi.decideSystemAdminUser(
                        created.id,
                        "approve",
                        onboarding,
                    );

                    setAssignedHrDepartmentIds(
                        (current) => new Set([...current, onboarding.departmentId]),
                    );

                    setMessage(
                        `${fullName} was created, approved and assigned to the selected department as HR Admin.`,
                    );

                    form.reset();
                    setCreateAccountRole("ROLE_HR_ADMIN");
                    await onDecision?.();
                    return;
                }

                /*
         * CEO and Manager keep their existing pending workflow.
         */
                if (accountRole === "ROLE_CEO") {
                    setAccounts((items) => [...items, created]);
                    setCeoSlotAvailable(false);
                    setGoverningCeoName(fullName);
                    setMessage(
                        "The CEO account was created. System Admin approval is still required.",
                    );
                } else {
                    setMessage(
                        "The Manager account was created in pending status and routed for approval.",
                    );
                }

                form.reset();
                setCreateAccountRole("ROLE_HR_ADMIN");
                await onDecision?.();
                return;
            }

            /*
       * Browser-preview workflow.
       */
            const existingAccounts = readDemoAccounts();

            if (existingAccounts.some((account) => account.email.toLowerCase() === email)) {
                fail("An account already exists for this company email.");
            }

            const governingCeo = existingAccounts.find(
                (account) =>
                    account.role === "ROLE_CEO"
                    && ["ACTIVE", "PENDING_APPROVAL"].includes(account.status),
            );

            if (accountRole === "ROLE_CEO" && governingCeo) {
                fail(
                    `BrainServe Connect already has one governing CEO: ${governingCeo.fullName}.`,
                );
            }

            if (
                accountRole !== "ROLE_CEO"
                && !existingAccounts.some(
                    (account) => account.role === "ROLE_CEO" && account.status === "ACTIVE",
                )
            ) {
                fail(
                    "Activate the company CEO before creating an HR Admin or Manager account.",
                );
            }

            const temporaryPassword = newDemoTemporaryPassword();
            const now = new Date().toISOString();

            if (isHrAdmin && onboarding) {
                const department = approvalDepartments.find(
                    (item) => item.id === onboarding.departmentId,
                );

                if (!department) fail("The selected department was not found.");

                const accountId = newClientId();
                const employeeId = newClientId();
                const employeeNumber =
                    `BSPL-${department.code}-${String(Date.now()).slice(-4)}`;

                const previewAccount: DemoProvisioningAccount = {
                    id: accountId,
                    fullName,
                    email,
                    role: "ROLE_HR_ADMIN",
                    status: "ACTIVE",
                    employeeId,
                    createdByUserId: DEMO_SYSTEM_ADMIN.id,
                    approvedByUserId: DEMO_SYSTEM_ADMIN.id,
                    createdAt: now,
                    approvedAt: now,
                    rejectedAt: null,
                    forcePasswordChange: true,
                    passwordHash: await hashDemoPassword(temporaryPassword),
                };

                writeDemoAccounts([...existingAccounts, previewAccount]);

                writeDemoEmployees([
                    ...readDemoEmployees(),
                    {
                        id: employeeNumber,
                        uuid: employeeId,
                        departmentId: onboarding.departmentId,
                        name: fullName,
                        initials: visitorInitials(fullName),
                        role: onboarding.designation,
                        department: department.name,
                        email,
                        status: "Active",
                    },
                ]);

                const nextAssignment: DepartmentHrAssignment = {
                    id: newClientId(),
                    departmentId: onboarding.departmentId,
                    hrUserId: accountId,
                    hrEmployeeId: employeeId,
                    active: true,
                    assignedByUserId: DEMO_SYSTEM_ADMIN.id,
                    assignedAt: now,
                    endedByUserId: null,
                    endedAt: null,
                };

                writeDemoDepartmentHrAssignments([
                    nextAssignment,
                    ...readDemoDepartmentHrAssignments(),
                ]);

                setAssignedHrDepartmentIds(
                    (current) => new Set([...current, onboarding.departmentId]),
                );
                setPreviewTemporaryPassword(temporaryPassword);
                setMessage(
                    `${fullName} was created, approved and assigned to ${department.name} as HR Admin.`,
                );

                form.reset();
                setCreateAccountRole("ROLE_HR_ADMIN");
                await onDecision?.();
                return;
            }

            const previewAccount: DemoProvisioningAccount = {
                id: newClientId(),
                fullName,
                email,
                role: accountRole,
                status: "PENDING_APPROVAL",
                createdByUserId: DEMO_SYSTEM_ADMIN.id,
                approvedByUserId: null,
                createdAt: now,
                approvedAt: null,
                forcePasswordChange: true,
                passwordHash: await hashDemoPassword(temporaryPassword),
            };

            writeDemoAccounts([...existingAccounts, previewAccount]);
            setPreviewTemporaryPassword(temporaryPassword);

            if (accountRole === "ROLE_CEO") {
                setAccounts((items) => [...items, previewAccount]);
                setCeoSlotAvailable(false);
                setGoverningCeoName(fullName);
            }

            setMessage(`${fullName} was created and is waiting for approval.`);

            form.reset();
            setCreateAccountRole("ROLE_HR_ADMIN");
            await onDecision?.();
        } catch (reason) {
            const detail =
                reason instanceof Error
                    ? reason.message
                    : "The account could not be created.";

            setError(
                createdAccountId
                    ? `The account was created, but approval and department assignment failed. Account ID: ${createdAccountId}. ${detail}`
                    : detail,
            );
        } finally {
            setBusyId("");
        }
    };

    const decide = async (account: ProvisioningAccount, decision: "approve" | "reject") => {
        setBusyId(account.id); setError(""); setMessage("");
        try {
            const privilegedOnboarding = decision === "approve"
                && ["ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(account.role);
            const employeeOnboarding = decision === "approve"
                && role === "HR Admin" && account.role === "ROLE_EMPLOYEE";
            const requiresOnboarding = privilegedOnboarding || employeeOnboarding;
            const onboarding = requiresOnboarding ? hrDrafts[account.id] : undefined;
            const accountRoleLabel = account.role === "ROLE_MANAGER" ? "Manager"
                : account.role === "ROLE_EMPLOYEE" ? "Employee" : "HR Admin";
            if (requiresOnboarding
                && (!onboarding?.departmentId || !onboarding.designation.trim() || !onboarding.joiningDate)) {
                fail(`Select an available department, designation and joining date before approving this ${accountRoleLabel}.`);
            }
            if (isBackendConfigured) {
                if (role === "System Admin") await brainServeApi.decideSystemAdminUser(account.id, decision, onboarding);
                else if (role === "CEO") await brainServeApi.decideCeoUser(account.id, decision, onboarding);
                else await brainServeApi.decideHrUser(account.id, decision, onboarding);
            } else {
                let employeeId: string | null = null;
                if (requiresOnboarding && onboarding) {
                    const department = approvalDepartments.find((item) => item.id === onboarding.departmentId);
                    employeeId = newClientId();
                    const employeeNumber = `BSPL-${department?.code ?? "OPS"}-${String(Date.now()).slice(-4)}`;
                    writeDemoEmployees([...readDemoEmployees(), {
                        id: employeeNumber, uuid: employeeId, departmentId: onboarding.departmentId,
                        name: account.fullName, initials: visitorInitials(account.fullName), role: onboarding.designation,
                        department: department?.name ?? "Department", email: account.email, status: "Active",
                    }]);
                    const now = new Date().toISOString();
                    if (account.role === "ROLE_HR_ADMIN") {
                        const nextAssignment: DepartmentHrAssignment = {
                            id: newClientId(), departmentId: onboarding.departmentId, hrUserId: account.id,
                            hrEmployeeId: employeeId, active: true, assignedByUserId: role === "CEO" ? "demo-ceo" : "demo-system-admin",
                            assignedAt: now, endedByUserId: null, endedAt: null,
                        };
                        writeDemoDepartmentHrAssignments([nextAssignment, ...readDemoDepartmentHrAssignments()]);
                        setAssignedHrDepartmentIds((current) => new Set([...current, onboarding.departmentId]));
                    } else if (account.role === "ROLE_MANAGER") {
                        const nextAssignment: ManagerAssignment = {
                            id: newClientId(), departmentId: onboarding.departmentId, managerUserId: account.id,
                            managerEmployeeId: employeeId, active: true,
                            assignedByUserId: role === "CEO" ? "demo-ceo" : "demo-system-admin",
                            assignedAt: now, endedByUserId: null, endedAt: null,
                        };
                        writeDemoManagerAssignments([nextAssignment, ...readDemoManagerAssignments()]);
                        setAssignedManagerDepartmentIds((current) => new Set([...current, onboarding.departmentId]));
                    }
                }
                const updated = readDemoAccounts().map((item) => item.id === account.id ? {
                    ...item,
                    status: decision === "approve" ? "ACTIVE" : "REJECTED",
                    employeeId: employeeId ?? item.employeeId,
                    approvedAt: decision === "approve" ? new Date().toISOString() : null,
                    rejectedAt: decision === "reject" ? new Date().toISOString() : null,
                } : item);
                writeDemoAccounts(updated);
            }
            setAccounts((items) => items.filter((item) => item.id !== account.id));
            if (account.role === "ROLE_CEO") {
                setCeoSlotAvailable(decision === "reject");
                setGoverningCeoName(decision === "approve" ? account.fullName : "");
            }
            if (privilegedOnboarding && onboarding) {
                if (account.role === "ROLE_HR_ADMIN") {
                    setAssignedHrDepartmentIds((current) => new Set([...current, onboarding.departmentId]));
                } else {
                    setAssignedManagerDepartmentIds((current) => new Set([...current, onboarding.departmentId]));
                }
            }
            setMessage(decision === "approve"
                ? requiresOnboarding
                    ? employeeOnboarding
                        ? `${account.fullName} was approved, assigned an employee ID and linked to the selected department.`
                        : `${account.fullName} was approved, linked to an employee ID and assigned as ${accountRoleLabel} for the selected department.`
                    : `${account.fullName} was approved and activated. The account can now sign in.`
                : `${account.fullName} was rejected and cannot sign in.`);
            await onDecision?.();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The approval action failed."); }
        finally { setBusyId(""); }
    };

    const heading = role === "System Admin"
        ? { eyebrow: "SYSTEM ADMIN GOVERNANCE", title: "Single CEO governance", detail: "Create and approve the one company CEO. HR Admin and Manager activation belongs to that CEO company-wide." }
        : role === "CEO"
            ? { eyebrow: "CEO APPROVAL", title: "Company-wide HR and Manager approval", detail: "Review every HR Admin and Manager request regardless of your own working department." }
            : { eyebrow: "HR ADMIN APPROVAL", title: "Staff account approval", detail: "Review Employee, Receptionist and Security registrations only." };
    const queueTitle = role === "System Admin" ? "CEO account request"
        : role === "CEO" ? "HR Admin & Manager requests" : "Employee, Receptionist & Security requests";

    const updateHrDraft = (accountId: string, accountRole: string, patch: Partial<HrAccountApprovalInput>) => {
        setHrDrafts((current) => ({ ...current, [accountId]: {
                departmentId: current[accountId]?.departmentId ?? "",
                phoneNumber: current[accountId]?.phoneNumber ?? "",
                designation: current[accountId]?.designation
                    ?? (accountRole === "ROLE_MANAGER" ? "Department Manager"
                        : accountRole === "ROLE_EMPLOYEE" ? "Employee" : "HR Business Partner"),
                joiningDate: current[accountId]?.joiningDate ?? officeToday(),
                ...patch,
            } }));
    };

    return <section className="provisioning-section">
        {compact
            ? <article className="panel glass-panel"><div className="panel-heading"><div><span>{heading.eyebrow}</span>
                <h2>{heading.title}</h2><p>{heading.detail}</p></div><UserCog size={22} /></div></article>
            : <PageTitle eyebrow={heading.eyebrow} title={heading.title} detail={heading.detail} />}
        {role === "System Admin" && <article className="panel glass-panel">
            <div className="panel-heading"><div><span>CREATE PRIVILEGED ACCOUNT</span><h2>CEO, HR Admin or Manager</h2>
                <p>{isBackendConfigured
                    ? "The generated password is emailed to the user. CEO is a singleton role; HR Admin and Manager requests go only to that CEO."
                    : "Preview mode stores the account in this browser. CEO remains singleton; HR Admin and Manager requests go to the CEO queue."}</p>
            </div><UserCog size={22} /></div>
            <div className="protected-account-note"><ShieldCheck size={19} /><span>
        <strong>{ceoSlotAvailable ? "CEO slot available" : "CEO slot protected"}</strong>
        <small>{ceoSlotAvailable
            ? "Only System Admin can create the first CEO."
            : `${governingCeoName || "The company CEO"} holds the single company-wide approval role.`}</small>
      </span></div>
            <form className="staff-create-form" onSubmit={createPrivileged}>
                <label>
                    Full name
                    <input name="fullName" minLength={2} maxLength={170} required />
                </label>

                <label>
                    Company email
                    <input name="email" type="email" placeholder="name@brainserve.in" required />
                </label>

                <label>
                    Role
                    <select
                        name="role"
                        value={createAccountRole}
                        onChange={(event) => setCreateAccountRole(
                            event.target.value as "ROLE_CEO" | "ROLE_HR_ADMIN" | "ROLE_MANAGER",
                        )}
                    >
                        <option value="ROLE_CEO" disabled={!ceoSlotAvailable}>
                            {ceoSlotAvailable ? "CEO" : "CEO · already assigned"}
                        </option>
                        <option value="ROLE_HR_ADMIN">
                            HR Admin · create, approve and assign
                        </option>
                        <option value="ROLE_MANAGER">
                            Manager · pending approval
                        </option>
                    </select>
                </label>

                {createAccountRole === "ROLE_HR_ADMIN" && (
                    <>
                        <label>
                            Department
                            <select name="departmentId" defaultValue="" required>
                                <option value="">Select department</option>
                                {approvalDepartments
                                    .filter((department) => department.active)
                                    .map((department) => {
                                        const occupied = assignedHrDepartmentIds.has(department.id);
                                        return (
                                            <option
                                                key={department.id}
                                                value={department.id}
                                                disabled={occupied}
                                            >
                                                {department.name} · {department.code}
                                                {occupied ? " · HR already assigned" : ""}
                                            </option>
                                        );
                                    })}
                            </select>
                        </label>

                        <label>
                            Phone number
                            <input
                                name="phoneNumber"
                                type="tel"
                                maxLength={30}
                                placeholder="+91 98765 43210"
                            />
                        </label>

                        <label>
                            Designation
                            <input
                                name="designation"
                                defaultValue="HR Administrator"
                                minLength={2}
                                maxLength={120}
                                required
                            />
                        </label>

                        <label>
                            Joining date
                            <input
                                name="joiningDate"
                                type="date"
                                max={officeToday()}
                                defaultValue={officeToday()}
                                required
                            />
                        </label>
                    </>
                )}

                <button
                    className="button button-primary"
                    disabled={busyId === "create-privileged"}
                >
                    <UserPlus size={16} />
                    {busyId === "create-privileged"
                        ? "Creating and assigning…"
                        : createAccountRole === "ROLE_HR_ADMIN"
                            ? "Create, approve & assign HR Admin"
                            : "Create pending account"}
                </button>
            </form>
            {!isBackendConfigured && previewTemporaryPassword && <div className="recovery-code-card">
                <span><ShieldCheck size={18} /> PREVIEW PASSWORD · SHOWN FOR THIS SESSION</span>
                <h3>Temporary sign-in password</h3>
                <p>No email is sent in Preview mode. Copy this password before dismissing it.</p>
                <code>{previewTemporaryPassword}</code>
                <div><button type="button" className="text-button" onClick={() => setPreviewTemporaryPassword("")}>Dismiss password</button></div>
                <small>This account is available only in this browser profile until the Spring Boot API is connected.</small>
            </div>}
        </article>}
        <article className="panel glass-panel">
            <div className="panel-heading"><div><span>PENDING REQUESTS</span><h2>{queueTitle}</h2>
                <p>{role === "System Admin"
                    ? "Only the first CEO appears here. HR Admin and Manager requests are routed to the CEO."
                    : "HR Admin and Manager approval creates the employee profile and department ownership in the same audited action."}</p>
            </div><b>{accounts.length}</b></div>
            <div className="staff-account-list">{accounts.map((account) => {
                const requiresPrivilegedOnboarding = ["ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(account.role)
                    && ["System Admin", "CEO"].includes(role);
                const requiresEmployeeOnboarding = account.role === "ROLE_EMPLOYEE" && role === "HR Admin";
                const requiresOnboarding = requiresPrivilegedOnboarding || requiresEmployeeOnboarding;
                const accountRoleLabel = account.role === "ROLE_MANAGER" ? "Manager"
                    : account.role === "ROLE_EMPLOYEE" ? "Employee" : "HR Admin";
                const unavailableDepartments = account.role === "ROLE_MANAGER"
                    ? assignedManagerDepartmentIds : assignedHrDepartmentIds;
                const availableDepartments = approvalDepartments.filter((department) => department.active
                    && (requiresEmployeeOnboarding || !unavailableDepartments.has(department.id)));
                const draft = hrDrafts[account.id] ?? {
                    departmentId: "", phoneNumber: "",
                    designation: account.role === "ROLE_MANAGER" ? "Department Manager"
                        : account.role === "ROLE_EMPLOYEE" ? "Employee" : "HR Business Partner",
                    joiningDate: officeToday(),
                };
                return <div className="staff-account-row" key={account.id}>
                    <div className="staff-account-head"><span className="role-icon"><UserCog size={18} /></span><span>
            <strong>{account.fullName}</strong><small>{account.email} · {account.role.replace("ROLE_", "").replaceAll("_", " ")}</small>
          </span><span className="status-pill status-pending"><span />Pending</span></div>
                    {requiresOnboarding && <div className="hr-approval-onboarding">
                        <div className="hr-approval-intro"><Building2 size={18} /><span><strong>Assign department before activation</strong>
              <small>{requiresEmployeeOnboarding
                  ? "This creates the employee ID and links the employee to the selected department."
                  : `This creates the employee ID and makes this person the only active ${accountRoleLabel} for the department.`}</small></span></div>
                        <div className="hr-approval-fields">
                            <label>Department<select value={draft.departmentId}
                                                     onChange={(event) => updateHrDraft(account.id, account.role, { departmentId: event.target.value })} required>
                                <option value="">{requiresEmployeeOnboarding ? "Select department" : "Select an unassigned department"}</option>
                                {availableDepartments.map((department) => <option value={department.id} key={department.id}>
                                    {department.name} · {department.code}
                                </option>)}
                            </select></label>
                            <label>Designation<input value={draft.designation} maxLength={120}
                                                     onChange={(event) => updateHrDraft(account.id, account.role, { designation: event.target.value })} required /></label>
                            <label>Phone number<input value={draft.phoneNumber ?? ""} maxLength={30} placeholder="+91 98765 43210"
                                                      onChange={(event) => updateHrDraft(account.id, account.role, { phoneNumber: event.target.value })} /></label>
                            <label>Joining date<input type="date" max={officeToday()} value={draft.joiningDate}
                                                      onChange={(event) => updateHrDraft(account.id, account.role, { joiningDate: event.target.value })} required /></label>
                        </div>
                        {availableDepartments.length === 0 && <div className="login-error" role="alert">
                            {requiresEmployeeOnboarding
                                ? "No active department is available for employee assignment."
                                : account.role === "ROLE_MANAGER"
                                    ? "Every active department already has a Manager. End an existing assignment before approving another Manager."
                                    : "Every active department already has an HR Admin. End an existing assignment before approving another HR Admin."}
                        </div>}
                    </div>}
                    <div className="approval-actions">
                        <button className="button button-reject" disabled={busyId === account.id}
                                onClick={() => void decide(account, "reject")}><X size={16} /> Reject</button>
                        <button className="button button-approve" disabled={busyId === account.id
                            || (requiresOnboarding && (!draft.departmentId || availableDepartments.length === 0))}
                                onClick={() => void decide(account, "approve")}><Check size={16} />
                            {requiresOnboarding ? "Approve, create ID & assign" : "Approve & activate"}</button>
                    </div>
                </div>;
            })}
                {accounts.length === 0 && <div className="empty-state"><CheckCircle2 size={28} />
                    <strong>No pending account requests</strong><small>The approval queue is clear.</small></div>}
            </div>
        </article>
        {message && <div className="success-banner"><CheckCircle2 size={17} /> {message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </section>;
}

function PasswordChangeCard() {
    const [otpRequested, setOtpRequested] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const requestOtp = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError(""); setMessage("");
        const data = new FormData(event.currentTarget);
        try {
            if (!isBackendConfigured) fail("Connect the Spring backend and SMTP service to change passwords by email OTP.");
            await brainServeApi.requestPasswordChangeOtp(String(data.get("currentPassword")));
            setOtpRequested(true);
            setMessage("A six-digit OTP was sent to your login email and expires in 10 minutes.");
            event.currentTarget.reset();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The OTP could not be sent."); }
        finally { setBusy(false); }
    };

    const confirm = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError(""); setMessage("");
        const form = event.currentTarget;
        const data = new FormData(form);
        const newPassword = String(data.get("newPassword"));
        if (newPassword !== String(data.get("confirmPassword"))) {
            setError("The new password and confirmation do not match.");
            setBusy(false);
            return;
        }
        try {
            if (!isBackendConfigured) fail("Connect the Spring backend to confirm password changes.");
            await brainServeApi.confirmPasswordChange(String(data.get("otp")), newPassword);
            form.reset(); setOtpRequested(false);
            setMessage("Password changed successfully. Other signed-in devices have been logged out.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The password could not be changed."); }
        finally { setBusy(false); }
    };

    return <article className="panel glass-panel"><div className="panel-heading"><div><span>OPTIONAL PASSWORD CHANGE</span><h2>Email OTP confirmation</h2><p>Your current password remains valid until you request an OTP and confirm a new password.</p></div><ShieldCheck size={22} /></div>{!otpRequested ? <form className="inline-account-form" onSubmit={requestOtp}><label>Current password<input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" required /></label><button className="button button-secondary" disabled={busy}><Bell size={16} /> {busy ? "Sending…" : "Email me an OTP"}</button></form> : <form className="staff-create-form" onSubmit={confirm}><label>Six-digit OTP<input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required /></label><label>New password<input name="newPassword" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} maxLength={64} autoComplete="new-password" required /></label><button className="button button-primary" disabled={busy}><ShieldCheck size={16} /> {busy ? "Confirming…" : "Confirm password change"}</button></form>}<div className="password-policy">12-64 characters · uppercase · lowercase · number · special character · no spaces</div>{message && <div className="success-banner"><CheckCircle2 size={17} /> {message}</div>}{error && <div className="login-error" role="alert">{error}</div>}</article>;
}

function InternalNotificationsView({ role, userEmail, onUnreadChange }: {
    role: Role; userEmail: string; onUnreadChange: (count: number) => void;
}) {
    const [recipients, setRecipients] = useState<InternalNotificationRecipient[]>([]);
    const [inbox, setInbox] = useState<InternalNotification[]>([]);
    const [sent, setSent] = useState<InternalNotification[]>([]);
    const [archive, setArchive] = useState<InternalNotification[]>([]);
    const [archivePage, setArchivePage] = useState(0);
    const [archiveHasMore, setArchiveHasMore] = useState(false);
    const [archiveSort, setArchiveSort] = useState<"NEWEST" | "OLDEST" | "PRIORITY">("NEWEST");
    const [recipientId, setRecipientId] = useState("");
    const [draft, setDraft] = useState("");
    const [priority, setPriority] = useState<NonNullable<InternalNotification["priority"]>>("NORMAL");
    const [category, setCategory] = useState<NonNullable<InternalNotification["category"]>>("GENERAL");
    const [tab, setTab] = useState<"priority" | "conversations" | "sent" | "archive">("priority");
    const [filter, setFilter] = useState<"ALL" | "UNREAD" | "URGENT" | "HIGH">("ALL");
    const [query, setQuery] = useState("");
    const [selectedConversation, setSelectedConversation] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const loadData = useCallback(async () => {
        try {
            const [nextRecipients, nextInbox, nextSent, nextArchive] = isBackendConfigured
                ? await Promise.all([brainServeApi.internalNotificationRecipients(), brainServeApi.internalNotificationInbox(),
                    brainServeApi.internalNotificationSent(), brainServeApi.internalNotificationArchive()])
                : (() => {
                    const all = readDemoInternalNotifications();
                    const today = officeToday();
                    const isToday = (item: InternalNotification) => officeToday(new Date(item.sentAt)) === today;
                    return [demoInternalRecipients(role, userEmail), all.filter((item) => item.recipientEmail === userEmail && isToday(item)),
                        all.filter((item) => item.senderEmail === userEmail && isToday(item)),
                        all.filter((item) => (item.senderEmail === userEmail || item.recipientEmail === userEmail) && !isToday(item))] as const;
                })();
            setRecipients(nextRecipients); setInbox(nextInbox); setSent(nextSent); setArchive(nextArchive);
            setArchivePage(0); setArchiveHasMore(isBackendConfigured && nextArchive.length === 50);
            setRecipientId((current) => nextRecipients.some((item) => item.userId === current)
                ? current : nextRecipients[0]?.userId ?? "");
            onUnreadChange(nextInbox.filter((item) => !item.readAt).length);
            setError("");
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : "Internal notifications could not be loaded.");
        }
    }, [onUnreadChange, role, userEmail]);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => void loadData(), 0);
        const timer = window.setInterval(() => void loadData(), 10000);
        const refresh = () => void loadData();
        const refreshFromStorage = (event: StorageEvent) => {
            if (!event.key || [DEMO_ACCOUNTS_KEY, DEMO_INTERNAL_NOTIFICATIONS_KEY].includes(event.key)) refresh();
        };
        const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
        window.addEventListener("focus", refresh);
        window.addEventListener("storage", refreshFromStorage);
        window.addEventListener("brainserve:demo-accounts-updated", refresh);
        window.addEventListener("brainserve:demo-internal-notifications-updated", refresh);
        document.addEventListener("visibilitychange", refreshWhenVisible);
        return () => {
            window.clearTimeout(initialLoad); window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("storage", refreshFromStorage);
            window.removeEventListener("brainserve:demo-accounts-updated", refresh);
            window.removeEventListener("brainserve:demo-internal-notifications-updated", refresh);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
        };
    }, [loadData]);

    const sendCall = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError(""); setMessage("");
        const recipient = recipients.find((item) => item.userId === recipientId);
        if (!recipient || draft.trim().length < 2) { setError("Choose a recipient and enter a message."); setBusy(false); return; }
        try {
            let created: InternalNotification;
            if (isBackendConfigured) created = await brainServeApi.sendInternalNotification(recipient.userId, draft.trim(), priority, category);
            else {
                const now = new Date().toISOString();
                const demo: DemoInternalNotification = {
                    id: newClientId(), senderUserId: userEmail, recipientUserId: recipient.userId,
                    senderName: demoSenderName(role, userEmail), recipientName: recipient.fullName,
                    message: draft.trim().replace(/\s+/g, " "), priority, category,
                    conversationKey: [userEmail, recipient.userId].sort().join(":"), deliveryStatus: "DELIVERED", sentAt: now,
                    deliveredAt: now, readAt: null, senderEmail: userEmail, recipientEmail: recipient.email,
                };
                writeDemoInternalNotifications([demo, ...readDemoInternalNotifications()]);
                created = demo;
            }
            setSent((items) => [created, ...items]); setDraft(""); setTab("conversations");
            setSelectedConversation(created.conversationKey ?? [created.senderUserId, created.recipientUserId].sort().join(":"));
            setMessage(`${priority === "URGENT" ? "Urgent" : priority === "HIGH" ? "High-priority" : "Message"} call sent to ${recipient.fullName}.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The internal call could not be sent."); }
        finally { setBusy(false); }
    };

    const markRead = async (notification: InternalNotification) => {
        if (notification.readAt) return;
        try {
            const updated = isBackendConfigured
                ? await brainServeApi.markInternalNotificationRead(notification.id)
                : { ...notification, deliveryStatus: "DELIVERED" as const, readAt: new Date().toISOString() };
            if (!isBackendConfigured) {
                writeDemoInternalNotifications(readDemoInternalNotifications().map((item) => item.id === updated.id
                    ? { ...item, ...updated, senderEmail: item.senderEmail, recipientEmail: item.recipientEmail } : item));
            }
            setInbox((items) => items.map((item) => item.id === updated.id ? updated : item));
            onUnreadChange(inbox.filter((item) => item.id !== updated.id && !item.readAt).length);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The notification could not be marked as read."); }
    };

    const deleteArchived = async (notification: InternalNotification) => {
        if (officeToday(new Date(notification.sentAt)) === officeToday()) {
            setError("Today's messages cannot be deleted."); return;
        }
        if (!window.confirm("Delete this archived message? System Admin will retain an immutable deletion log.")) return;
        try {
            if (isBackendConfigured) await brainServeApi.deleteInternalNotification(notification.id);
            else {
                writeDemoInternalNotifications(readDemoInternalNotifications().filter((item) => item.id !== notification.id));
                writeDemoEssentialLogs([{ id: newClientId(), category: "INTERNAL_COMMUNICATION", eventType: "ARCHIVED_MESSAGE_DELETED",
                    subjectType: "INTERNAL_NOTIFICATION", subjectId: notification.id, referenceId: notification.conversationKey ?? null,
                    actorUserId: userEmail, approverUserId: null, status: "DELETED", title: "Archived internal message deleted",
                    detail: `${notification.senderName} → ${notification.recipientName} · ${notification.sentAt} · ${notification.message}`,
                    occurredAt: new Date().toISOString() }, ...readDemoEssentialLogs()]);
            }
            setArchive((items) => items.filter((item) => item.id !== notification.id));
            setMessage("Archived message deleted. An immutable System Admin log was created."); setError("");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The archived message could not be deleted."); }
    };

    const loadMoreArchive = async () => {
        if (!isBackendConfigured || busy) return;
        setBusy(true); setError("");
        try {
            const nextPage = archivePage + 1; const nextItems = await brainServeApi.internalNotificationArchive(nextPage, 50);
            setArchive((items) => [...items, ...nextItems.filter((next) => !items.some((item) => item.id === next.id))]);
            setArchivePage(nextPage); setArchiveHasMore(nextItems.length === 50);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "More archived messages could not be loaded."); }
        finally { setBusy(false); }
    };

    const selectedRecipient = recipients.find((item) => item.userId === recipientId);
    const replyingToCeo = role === "HR Admin" && selectedRecipient?.roles.includes("ROLE_CEO");
    const quickMessages = role === "CEO" ? ["Please come to my cabin.", "Please meet me when you are free."]
        : replyingToCeo ? ["I’m coming.", "I’ll be there shortly."]
            : role === "HR Admin" ? ["Please come to the HR cabin.", "Please report to reception."]
                : role === "Reception" ? ["Acknowledged. Reception will coordinate this.", "The visitor has arrived at Reception.", "I’ll notify you when they are ready."]
                    : ["Could you please meet me in HR?", "I need to discuss an HR matter."];

    const priorityRank = (value?: InternalNotification["priority"]) => value === "URGENT" ? 3 : value === "HIGH" ? 2 : 1;
    const messageKey = (item: InternalNotification) => item.conversationKey
        ?? [item.senderUserId, item.recipientUserId].sort().join(":");
    const incomingIds = useMemo(() => new Set(inbox.map((item) => item.id)), [inbox]);
    const sortedInbox = useMemo(() => [...inbox].sort((left, right) => {
        if (Boolean(left.readAt) !== Boolean(right.readAt)) return left.readAt ? 1 : -1;
        const priorityDifference = priorityRank(right.priority) - priorityRank(left.priority);
        return priorityDifference || new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime();
    }), [inbox]);
    const priorityInbox = useMemo(() => sortedInbox.filter((item) => {
        const matchesQuery = !query.trim() || `${item.senderName} ${item.message} ${item.category ?? "GENERAL"}`
            .toLowerCase().includes(query.trim().toLowerCase());
        const matchesFilter = filter === "ALL" || (filter === "UNREAD" && !item.readAt)
            || item.priority === filter;
        return matchesQuery && matchesFilter;
    }), [filter, query, sortedInbox]);
    const allMessages = useMemo(() => [...inbox, ...sent]
        .sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()), [inbox, sent]);
    const conversations = useMemo(() => {
        const grouped = new Map<string, { key: string; name: string; latest: InternalNotification;
            roles: string[]; unread: number; priority: number }>();
        allMessages.forEach((item) => {
            const key = messageKey(item); const incoming = incomingIds.has(item.id);
            const current = grouped.get(key); const nextRank = priorityRank(item.priority);
            grouped.set(key, { key, name: incoming ? item.senderName : item.recipientName, latest: item,
                roles: incoming ? item.senderRoles ?? [] : item.recipientRoles ?? [],
                unread: (current?.unread ?? 0) + (incoming && !item.readAt ? 1 : 0),
                priority: Math.max(current?.priority ?? 0, nextRank) });
        });
        return [...grouped.values()].filter((item) => !query.trim()
            || `${item.name} ${item.latest.message}`.toLowerCase().includes(query.trim().toLowerCase()))
            .sort((left, right) => right.unread - left.unread || right.priority - left.priority
                || new Date(right.latest.sentAt).getTime() - new Date(left.latest.sentAt).getTime());
    }, [allMessages, incomingIds, query]);
    const activeConversation = selectedConversation || conversations[0]?.key || "";
    const thread = allMessages.filter((item) => messageKey(item) === activeConversation);
    const sentVisible = [...sent].filter((item) => !query.trim()
        || `${item.recipientName} ${item.message}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
    const archivedVisible = [...archive].filter((item) => !query.trim()
        || `${item.senderName} ${item.recipientName} ${item.message} ${item.category ?? "GENERAL"}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((left, right) => archiveSort === "OLDEST"
            ? new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
            : archiveSort === "PRIORITY"
                ? priorityRank(right.priority) - priorityRank(left.priority) || new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime()
                : new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
    const reply = (item: InternalNotification) => {
        const recipient = recipients.find((value) => value.userId === item.senderUserId);
        if (!recipient) return;
        setRecipientId(recipient.userId); setPriority(item.priority ?? "NORMAL");
        setCategory(item.category ?? "GENERAL"); setDraft("");
        document.getElementById("internal-message-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const renderMessage = (item: InternalNotification, incoming: boolean, archived = false) => {
        const participantRoles = incoming ? item.senderRoles ?? [] : item.recipientRoles ?? [];
        const participantRole = participantRoles.map(readableNotificationRole).join(", ");
        const categoryLabel = (item.category ?? "GENERAL").replaceAll("_", " ");
        return <article
            className={`${!item.readAt && incoming ? "internal-message unread" : "internal-message"} priority-${(item.priority ?? "NORMAL").toLowerCase()}`} key={item.id}>
            <span className="avatar">{visitorInitials(incoming ? item.senderName : item.recipientName)}</span>
            <div><header><span><strong>{incoming ? item.senderName : item.recipientName}</strong><small>{participantRole ? `${participantRole} · ${categoryLabel}` : categoryLabel}</small></span><time>{new Date(item.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></header>
                <p>{item.message}</p><footer><span className={`message-priority priority-badge-${(item.priority ?? "NORMAL").toLowerCase()}`}>{item.priority ?? "NORMAL"}</span><span className={`delivery-${item.deliveryStatus.toLowerCase()}`}>{item.deliveryStatus.toLowerCase()}</span>
                    <span className="message-actions">{incoming && !archived && <button type="button" onClick={() => reply(item)}>Reply</button>}{incoming && !item.readAt && !archived && <button type="button" onClick={() => void markRead(item)}>Mark read</button>}{archived && <button type="button" className="message-delete" aria-label={`Delete archived message from ${item.senderName}`} title="Delete this old message" onClick={() => void deleteArchived(item)}><Trash2 size={14} /> Delete old message</button>}</span></footer></div>
        </article>;
    };

    return <section className="internal-notifications-page">
        <PageTitle eyebrow="BRAINSERVE INTERNAL DELIVERY" title="Priority calls & conversations"
                   detail="Today’s urgent and unread requests rise to the top. Earlier messages are stored safely in Archive." />
        <div className="notification-attention glass-panel"><div><strong>{inbox.filter((item) => !item.readAt).length}</strong><span>Unread</span><small>Needs acknowledgement</small></div><i /><div><strong>{inbox.filter((item) => item.priority === "URGENT" && !item.readAt).length}</strong><span>Urgent</span><small>Handle first</small></div><i /><div><strong>{conversations.length}</strong><span>Conversations</span><small>Grouped by person</small></div></div>
        <div className="notification-workspace">
            <article className="panel glass-panel notification-composer" id="internal-message-composer">
                <div className="panel-heading"><div><span>NEW INTERNAL DELIVERY</span><h2>Send a prioritized call</h2><p>Add purpose and urgency so the recipient knows what to handle first.</p></div><Send size={21} /></div>
                {recipients.length ? <form onSubmit={sendCall}>
                    <label>Recipient<select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required>
                        {recipients.map((recipient) => <option value={recipient.userId} key={recipient.userId}>{recipient.fullName} · {recipient.roles.map(readableNotificationRole).join(", ")}</option>)}
                    </select></label>
                    <div className="notification-routing-fields"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as NonNullable<InternalNotification["priority"]>)}><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label>Purpose<select value={category} onChange={(event) => setCategory(event.target.value as NonNullable<InternalNotification["category"]>)}><option value="GENERAL">General</option><option value="ACTION_REQUIRED">Action required</option><option value="VISITOR">Visitor coordination</option><option value="WORK">Work update</option><option value="INSIGHT">Insight review</option><option value="LEAVE">Leave</option></select></label></div>
                    <label>Message<textarea value={draft} onChange={(event) => setDraft(event.target.value)} minLength={2} maxLength={500}
                                            placeholder="For example: Please come to my cabin." required /></label>
                    <div className="quick-message-list">{quickMessages.map((value) => <button type="button" key={value} onClick={() => setDraft(value)}>{value}</button>)}</div>
                    <div className="message-limit"><span>{priority === "URGENT" ? "Urgent messages are placed first" : "BrainServe Connect real-time delivery"}</span><span>{draft.length}/500</span></div>
                    <button className="button button-primary" disabled={busy}><Send size={16} />{busy ? "Sending…" : "Send internal call"}</button>
                </form> : <div className="empty-state notification-policy-empty"><MessageSquare size={28} /><strong>No sending route for this role</strong>
                    <small>No active permitted recipients are available for your role.</small></div>}
            </article>

            <article className="panel glass-panel notification-inbox-panel">
                <div className="notification-day-banner"><CalendarDays size={16} /><span><strong>Today · {formatOfficeDate(new Date().toISOString())}</strong><small>Only today’s messages appear in the operational inbox.</small></span><button type="button" className="archive-shortcut" onClick={() => setTab("archive")}><Archive size={14} />Old messages{archive.length > 0 && <b>{archive.length}{archiveHasMore ? "+" : ""}</b>}</button></div>
                <div className="notification-tabs"><button className={tab === "priority" ? "active" : ""} onClick={() => setTab("priority")}><Bell size={16} />Priority inbox{inbox.filter((item) => !item.readAt).length > 0 && <b>{inbox.filter((item) => !item.readAt).length}</b>}</button><button className={tab === "conversations" ? "active" : ""} onClick={() => setTab("conversations")}><MessageSquare size={16} />Today’s conversations</button><button className={tab === "sent" ? "active" : ""} onClick={() => setTab("sent")}><Send size={16} />Sent today</button><button className={tab === "archive" ? "active" : ""} onClick={() => setTab("archive")}><Archive size={16} />Archive</button></div>
                <div className="notification-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or message text" />{tab === "priority" && <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">All priorities</option><option value="UNREAD">Unread only</option><option value="URGENT">Urgent</option><option value="HIGH">High</option></select>}{tab === "archive" && <select value={archiveSort} onChange={(event) => setArchiveSort(event.target.value as typeof archiveSort)}><option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option><option value="PRIORITY">Priority first</option></select>}</div>
                {tab === "priority" && <div className="internal-message-list">{priorityInbox.map((item) => renderMessage(item, true))}{priorityInbox.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>Your priority queue is clear</strong><small>Try another filter or wait for a new internal delivery.</small></div>}</div>}
                {tab === "sent" && <div className="internal-message-list">{sentVisible.map((item) => renderMessage(item, false))}{sentVisible.length === 0 && <div className="empty-state"><Send size={28} /><strong>No sent calls found</strong><small>New internal calls remain searchable here.</small></div>}</div>}
                {tab === "archive" && <div className="internal-message-list"><div className="archive-policy-note"><Archive size={16} /><span><strong>Previous messages · {archive.length}{archiveHasMore ? "+" : ""}</strong><small>Use Delete on any old message. Today’s messages are protected and cannot be deleted.</small></span></div>{archivedVisible.map((item) => renderMessage(item, false, true))}{archive.length > 0 && archivedVisible.length === 0 && <div className="empty-state"><Search size={28} /><strong>No archived messages match your search</strong><small>Clear the search or choose another sorting option.</small></div>}{archive.length === 0 && <div className="empty-state"><Archive size={28} /><strong>No archived messages</strong><small>Messages move here automatically after the office day ends.</small></div>}{archiveHasMore && <button type="button" className="button button-secondary archive-load-more" disabled={busy} onClick={() => void loadMoreArchive()}>{busy ? "Loading…" : "Load 50 more messages"}</button>}</div>}
                {tab === "conversations" && <div className="conversation-layout"><div className="conversation-list">{conversations.map((conversation) => <button className={activeConversation === conversation.key ? "active" : ""} key={conversation.key} onClick={() => setSelectedConversation(conversation.key)}><span className="avatar">{visitorInitials(conversation.name)}</span><span><strong>{conversation.name}</strong><small>{conversation.roles.length ? `${conversation.roles.map(readableNotificationRole).join(", ")} · ${conversation.latest.message}` : conversation.latest.message}</small></span>{conversation.unread > 0 && <b>{conversation.unread}</b>}</button>)}{conversations.length === 0 && <div className="empty-state"><MessageSquare size={26} /><strong>No conversations</strong></div>}</div><div className="conversation-thread">{thread.map((item) => renderMessage(item, incomingIds.has(item.id)))}{thread.length === 0 && <div className="empty-state"><Inbox size={28} /><strong>Select a conversation</strong><small>The complete message history will appear here.</small></div>}</div></div>}
            </article>
        </div>
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
        {(["Team Lead", "HR Admin", "CEO"] as Role[]).includes(role)
            && <ResourceDiscussionWorkspace role={role} recipients={recipients} />}
        {(["Employee", "HR Admin"] as Role[]).includes(role) && <LeaveWorkspace role={role} />}
    </section>;
}

function ResourceDiscussionWorkspace({ role, recipients }: { role: Role;
    recipients: InternalNotificationRecipient[] }) {
    const [items, setItems] = useState<ResourceDiscussion[]>([]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const hrRecipients = recipients.filter((item) => item.roles.includes("ROLE_HR_ADMIN"));
    const [minimumMeeting] = useState(() => {
        const value = new Date(Date.now() + 60 * 60 * 1000);
        return new Date(value.getTime() - value.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
    });

    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        try { setItems(await brainServeApi.resourceDiscussions()); setError(""); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Resource discussions could not be loaded."); }
    }, []);

    useEffect(() => { const initial = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(initial); }, [load]);

    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        setBusy("create"); setError(""); setMessage("");
        const payload = {
            hrRecipientUserId: String(data.get("hrRecipientUserId")), projectName: String(data.get("projectName")),
            requiredRoles: String(data.get("requiredRoles")), requestedHeadcount: Number(data.get("requestedHeadcount")),
            priority: String(data.get("priority")), preferredAt: new Date(String(data.get("preferredAt"))).toISOString(),
            justification: String(data.get("justification")),
        };
        try {
            const created = isBackendConfigured ? await brainServeApi.createResourceDiscussion(payload) : {
                id: newClientId(), requestedByUserId: "demo-team-lead", departmentId: "TECH", ...payload,
                status: "REQUESTED" as const, hrResponse: null, scheduledAt: null, hrDecidedAt: null,
                completedAt: null, createdAt: new Date().toISOString(), version: 0,
            } as ResourceDiscussion;
            setItems((current) => [created, ...current]); form.reset();
            setMessage("Resource discussion sent to HR through BrainServe Internal Calls.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Resource discussion could not be created."); }
        finally { setBusy(""); }
    };

    const hrAction = async (item: ResourceDiscussion, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const action = (submitter?.value ?? "REQUEST_INFORMATION") as "SCHEDULE" | "REQUEST_INFORMATION" | "DECLINE";
        const scheduledValue = String(data.get("scheduledAt") ?? "");
        setBusy(item.id); setError(""); setMessage("");
        try {
            const updated = isBackendConfigured
                ? await brainServeApi.decideResourceDiscussion(item.id, action, String(data.get("response")),
                    action === "SCHEDULE" && scheduledValue ? new Date(scheduledValue).toISOString() : null)
                : { ...item, status: action === "SCHEDULE" ? "SCHEDULED" as const
                        : action === "DECLINE" ? "DECLINED" as const : "NEEDS_INFORMATION" as const,
                    hrResponse: String(data.get("response")), scheduledAt: action === "SCHEDULE" && scheduledValue
                        ? new Date(scheduledValue).toISOString() : null, hrDecidedAt: new Date().toISOString() };
            setItems((current) => current.map((value) => value.id === item.id ? updated : value));
            setMessage(`Resource discussion ${action.toLowerCase().replaceAll("_", " ")} update sent to the Team Lead.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "HR action could not be saved."); }
        finally { setBusy(""); }
    };

    const complete = async (item: ResourceDiscussion) => {
        setBusy(item.id); setError("");
        try {
            const updated = isBackendConfigured ? await brainServeApi.completeResourceDiscussion(item.id)
                : { ...item, status: "COMPLETED" as const, completedAt: new Date().toISOString() };
            setItems((current) => current.map((value) => value.id === item.id ? updated : value));
            setMessage("Discussion marked completed and the other participant was notified.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Discussion could not be completed."); }
        finally { setBusy(""); }
    };

    const revise = async (item: ResourceDiscussion, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(item.id); setError("");
        const payload = { requiredRoles: String(data.get("requiredRoles")),
            requestedHeadcount: Number(data.get("requestedHeadcount")),
            preferredAt: new Date(String(data.get("preferredAt"))).toISOString(),
            justification: String(data.get("justification")) };
        try {
            const updated = isBackendConfigured ? await brainServeApi.reviseResourceDiscussion(item.id, payload)
                : { ...item, ...payload, status: "REQUESTED" as const, hrResponse: null, hrDecidedAt: null };
            setItems((current) => current.map((value) => value.id === item.id ? updated : value));
            setMessage("Updated resource details sent back to HR.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Resource details could not be revised."); }
        finally { setBusy(""); }
    };

    return <article className="panel glass-panel resource-discussion-panel">
        <div className="panel-heading"><div><span>PROJECT RESOURCE PLANNING</span><h2>{role === "Team Lead"
            ? "Discuss project resources with HR" : role === "HR Admin" ? "HR resource discussion queue"
                : "Resource planning visibility"}</h2><p>Structured requests, meeting decisions, real-time notifications and audit history remain connected.</p></div><BriefcaseBusiness size={22} /></div>
        {role === "Team Lead" && (hrRecipients.length ? <form className="resource-discussion-form" onSubmit={create}>
            <label>HR partner<select name="hrRecipientUserId" required>{hrRecipients.map((recipient) =>
                <option value={recipient.userId} key={recipient.userId}>{recipient.fullName} · {recipient.email}</option>)}</select></label>
            <label>Project name<input name="projectName" minLength={2} maxLength={160} required placeholder="Customer analytics platform" /></label>
            <label>Required roles or skills<input name="requiredRoles" maxLength={500} required placeholder="2 Java developers, 1 QA engineer" /></label>
            <label>Headcount<input name="requestedHeadcount" type="number" min={1} max={100} defaultValue={1} required /></label>
            <label>Priority<select name="priority" defaultValue="NORMAL"><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
            <label>Preferred discussion time<input name="preferredAt" type="datetime-local" min={minimumMeeting} required /></label>
            <label className="full-field">Business justification<textarea name="justification" minLength={5} maxLength={1000} required placeholder="Explain workload, delivery date and why these resources are needed." /></label>
            <button className="button button-primary" disabled={busy === "create"}><Send size={16} />{busy === "create" ? "Sending…" : "Send resource request"}</button>
        </form> : <div className="empty-state"><Users size={27} /><strong>No active HR recipient</strong><small>An active HR Admin account is required.</small></div>)}
        <div className="resource-discussion-list">{items.map((item) => <section key={item.id} className={`resource-discussion-card priority-${item.priority.toLowerCase()}`}>
            <header><span><small>{item.priority} PRIORITY · {item.id.slice(0, 8).toUpperCase()}</small><strong>{item.projectName}</strong></span><code>{item.status.replaceAll("_", " ")}</code></header>
            <div className="resource-facts"><span><Users size={15} /><strong>{item.requestedHeadcount}</strong> requested</span><span><Clock3 size={15} />Preferred {new Date(item.preferredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></div>
            <p><strong>Skills:</strong> {item.requiredRoles}</p><p>{item.justification}</p>
            {item.hrResponse && <div className="resource-response"><strong>HR response</strong><span>{item.hrResponse}</span>{item.scheduledAt && <small>Meeting: {new Date(item.scheduledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</small>}</div>}
            {role === "HR Admin" && item.status === "REQUESTED" && <form className="resource-decision-form" onSubmit={(event) => void hrAction(item, event)}>
                <label>Response<textarea name="response" maxLength={1000} placeholder="Add meeting details, questions or decline reason." /></label>
                <label>Meeting time<input name="scheduledAt" type="datetime-local" min={minimumMeeting} /></label>
                <div><button className="button button-approve" name="action" value="SCHEDULE" disabled={busy === item.id}>Schedule</button><button className="button button-secondary" name="action" value="REQUEST_INFORMATION" disabled={busy === item.id}>Request details</button><button className="button button-reject" name="action" value="DECLINE" disabled={busy === item.id}>Decline</button></div>
            </form>}
            {["Team Lead", "HR Admin"].includes(role) && item.status === "SCHEDULED" && <button className="button button-secondary" disabled={busy === item.id} onClick={() => void complete(item)}><CheckCircle2 size={15} /> Mark discussion complete</button>}
            {role === "Team Lead" && item.status === "NEEDS_INFORMATION" && <form className="resource-revision-form" onSubmit={(event) => void revise(item, event)}>
                <strong>Provide the details requested by HR</strong><label>Updated skills<input name="requiredRoles" defaultValue={item.requiredRoles} maxLength={500} required /></label><label>Headcount<input name="requestedHeadcount" type="number" min={1} max={100} defaultValue={item.requestedHeadcount} required /></label><label>Preferred time<input name="preferredAt" type="datetime-local" min={minimumMeeting} required /></label><label className="full-field">Updated justification<textarea name="justification" defaultValue={item.justification} minLength={5} maxLength={1000} required /></label><button className="button button-primary" disabled={busy === item.id}><Send size={15} /> Resubmit to HR</button>
            </form>}
        </section>)}{items.length === 0 && <div className="empty-state"><BriefcaseBusiness size={28} /><strong>No resource discussions yet</strong><small>{role === "Team Lead" ? "Create the first structured request above." : "New Team Lead requests will appear here."}</small></div>}</div>
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}{error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function LeaveWorkspace({ role }: { role: Role }) {
    const [items, setItems] = useState<LeaveRequest[]>([]); const [error, setError] = useState("");
    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        try { setItems(role === "HR Admin" ? await brainServeApi.pendingLeaveRequests() : await brainServeApi.myLeaveRequests()); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Leave records could not be loaded."); }
    }, [role]);
    useEffect(() => { const initialLoad = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(initialLoad); }, [load]);
    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setError("");
        try { await brainServeApi.createLeaveRequest(String(data.get("startDate")), String(data.get("endDate")), String(data.get("reason"))); form.reset(); await load(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Leave request could not be submitted."); }
    };
    const decide = async (id: string, decision: "approve" | "reject") => {
        try { await brainServeApi.decideLeaveRequest(id, decision, decision === "approve" ? "Approved by HR Admin" : "Rejected by HR Admin"); await load(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Leave decision failed."); }
    };
    const minDate = officeToday();
    return <article className="panel glass-panel leave-panel"><div className="panel-heading"><div><span>PERSISTED LEAVE WORKFLOW</span><h2>{role === "Employee" ? "Request leave from HR" : "HR leave approval queue"}</h2><p>Requests, decisions and BrainServe Internal Calls updates are retained in the System Admin monthly register.</p></div><FileClock size={21} /></div>
        {role === "Employee" && <form className="staff-create-form" onSubmit={create}><label>From<input name="startDate" type="date" min={minDate} required /></label><label>To<input name="endDate" type="date" min={minDate} required /></label><label>Reason<textarea name="reason" minLength={5} maxLength={1000} required /></label><button className="button button-primary"><Send size={16} /> Send to HR</button></form>}
        <div className="record-list">{items.map((item) => <div key={item.id}><span><strong>{item.startDate} → {item.endDate}</strong><small>{item.reason}</small></span><code>{item.status}</code>{role === "HR Admin" && item.status === "PENDING" && <span className="approval-actions"><button className="button button-approve" onClick={() => void decide(item.id, "approve")}>Approve</button><button className="button button-reject" onClick={() => void decide(item.id, "reject")}>Reject</button></span>}</div>)}{items.length === 0 && <div className="empty-state"><FileClock size={27} /><strong>No leave requests</strong></div>}</div>
        {error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

type SettingsSection = "company" | "identity" | "roles" | "policy" | "notifications" | "privacy";

const fallbackSettings: WorkspaceSetting[] = [
    { key: "COMPANY.NAME", value: "BrainServe Connect", type: "STRING", description: "Public company display name", version: 0 },
    { key: "COMPANY.EMAIL_DOMAIN", value: "brainserve.in", type: "STRING", description: "Official staff email domain", version: 0 },
    { key: "COMPANY.HQ_ADDRESS", value: "Hyderabad, Telangana, India", type: "STRING", description: "Primary visitor arrival address", version: 0 },
    { key: "COMPANY.SUPPORT_EMAIL", value: "support@brainserve.in", type: "STRING", description: "Visitor support contact", version: 0 },
    { key: "APPOINTMENT.SLOT_MINUTES", value: "30", type: "INTEGER", description: "Appointment duration in minutes", version: 0 },
    { key: "APPOINTMENT.MAX_ADVANCE_DAYS", value: "90", type: "INTEGER", description: "Maximum booking window in days", version: 0 },
    { key: "APPOINTMENT.MIN_LEAD_MINUTES", value: "10", type: "INTEGER", description: "Minimum time before a same-day appointment", version: 0 },
    { key: "APPOINTMENT.CHECK_IN_EARLY_MINUTES", value: "30", type: "INTEGER", description: "QR pass early check-in window", version: 0 },
    { key: "APPOINTMENT.QR_EXPIRY_MINUTES_AFTER_END", value: "120", type: "INTEGER", description: "QR pass expiry after visit end", version: 0 },
    { key: "NOTIFICATION.APPOINTMENT_EMAIL_ENABLED", value: "true", type: "BOOLEAN", description: "Booking and verification email", version: 0 },
    { key: "NOTIFICATION.APPROVAL_EMAIL_ENABLED", value: "true", type: "BOOLEAN", description: "Manager, HR and CEO approval alerts", version: 0 },
    { key: "NOTIFICATION.SECURITY_ALERT_EMAIL_ENABLED", value: "true", type: "BOOLEAN", description: "Rejected access security alerts", version: 0 },
    { key: "PRIVACY.CONSENT_VERSION", value: "2026.1", type: "STRING", description: "Active visitor consent version", version: 0 },
];

const fallbackRoles: RoleDefinition[] = [
    { role: "ROLE_SYSTEM_ADMIN", defaultPermissions: ["ROLE_MANAGE", "SYSTEM_CONFIGURE", "AUDIT_VIEW"] },
    { role: "ROLE_CEO", defaultPermissions: ["CEO_VISIT_APPROVE", "COMPANY_PROFILE_MANAGE", "APPOINTMENT_POLICY_MANAGE", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND", "AUDIT_VIEW"] },
    { role: "ROLE_MANAGER", defaultPermissions: ["MANAGER_VISIT_APPROVE", "EMPLOYEE_READ", "REPORT_VIEW", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { role: "ROLE_HR_ADMIN", defaultPermissions: ["STAFF_ACCOUNT_APPROVE", "STAFF_ACCOUNT_MANAGE", "HR_VISIT_APPROVE", "EMPLOYEE_CREATE", "WORK_TASK_READ", "WORK_TASK_PERFORMANCE_READ", "APPOINTMENT_POLICY_MANAGE", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { role: "ROLE_TEAM_LEAD", defaultPermissions: ["TEAM_LEAD_DIRECTORY_VIEW", "TEAM_LEAD_VISIT_APPROVE", "WORK_TASK_READ", "WORK_TASK_CREATE", "WORK_TASK_PROGRESS", "WORK_TASK_REVIEW", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { role: "ROLE_EMPLOYEE", defaultPermissions: ["EMPLOYEE_READ", "WORK_TASK_READ", "WORK_TASK_PROGRESS", "INTERNAL_NOTIFICATION_READ", "INTERNAL_NOTIFICATION_SEND"] },
    { role: "ROLE_RECEPTIONIST", defaultPermissions: ["EMPLOYEE_READ", "VISITOR_REGISTER", "RECEPTION_VISIT_VERIFY", "VISITOR_CHECK_IN", "VISITOR_CHECK_OUT", "QR_PASS_VERIFY", "INTERNAL_NOTIFICATION_READ"] },
    { role: "ROLE_SECURITY", defaultPermissions: ["SECURITY_VISITOR_INTAKE", "VISITOR_CHECK_IN", "VISITOR_CHECK_OUT", "QR_PASS_VERIFY"] },
];

function OperationalRoleTransitionPanel({ actorRole, departments, managerAssignments, onChanged }: {
    actorRole: "CEO" | "System Admin";
    departments: Department[];
    managerAssignments: ManagerAssignment[];
    onChanged: () => Promise<void>;
}) {
    const [candidates, setCandidates] = useState<Array<{ userId: string; employeeId: string;
        fullName: string; email: string; role: string; departmentId: string }>>([]);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [successionCandidates, setSuccessionCandidates] = useState<Array<{ userId: string; employeeId: string;
        fullName: string; email: string; role: string; departmentId: string }>>([]);

    const load = useCallback(async (search = "") => {
        setError("");
        try {
            if (isBackendConfigured) {
                setCandidates((await brainServeApi.operationalRoleCandidates(search)).content);
            } else {
                const operationalRoles = ["ROLE_EMPLOYEE", "ROLE_TEAM_LEAD", "ROLE_HR_ADMIN", "ROLE_MANAGER"];
                setCandidates(readDemoAccounts().filter((account) => account.employeeId
                    && ((account.status === "ACTIVE" && operationalRoles.includes(account.role))
                        || (actorRole === "System Admin" && account.role === "ROLE_CEO"
                            && ["ACTIVE", "REJECTED", "DISABLED"].includes(account.status)))
                    && (!search || `${account.fullName} ${account.email}`.toLowerCase().includes(search.toLowerCase())))
                    .map((account) => ({ userId: account.id, employeeId: account.employeeId as string,
                        fullName: account.fullName, email: account.email, role: account.role,
                        departmentId: employeesDepartment(account.employeeId as string, departments) })));
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Role-transition candidates could not be loaded.");
        }
    }, [actorRole, departments]);

    useEffect(() => { const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer); }, [load]);

    useEffect(() => {
        if (actorRole !== "System Admin" || !isBackendConfigured) return;
        let active = true;
        brainServeApi.operationalRoleCandidates("").then((page) => {
            if (active) setSuccessionCandidates(page.content);
        }).catch((reason) => {
            if (active) setError(reason instanceof Error ? reason.message
                : "CEO succession candidates could not be loaded.");
        });
        return () => { active = false; };
    }, [actorRole]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const userId = String(data.get("userId"));
        const targetRole = String(data.get("role")) as "ROLE_EMPLOYEE" | "ROLE_TEAM_LEAD" | "ROLE_HR_ADMIN" | "ROLE_MANAGER";
        const departmentId = String(data.get("departmentId"));
        const reason = String(data.get("reason"));
        const candidate = candidates.find((item) => item.userId === userId);
        if (!candidate) { setError("Select an active employee-linked account."); return; }
        setBusy(true); setError(""); setMessage("");
        try {
            if (isBackendConfigured) {
                await brainServeApi.transitionOperationalRole(userId, targetRole, departmentId, reason);
            } else {
                const supportedRoles = ["ROLE_EMPLOYEE", "ROLE_TEAM_LEAD", "ROLE_HR_ADMIN", "ROLE_MANAGER"];
                const targetAccount = readDemoAccounts().find((account) => account.id === userId);
                const department = readDemoDepartments().find((item) => item.id === departmentId && item.active);
                const formerCeoTransition = targetAccount?.role === "ROLE_CEO";
                const eligibleSource = targetAccount && (supportedRoles.includes(targetAccount.role)
                    && targetAccount.status === "ACTIVE"
                    || formerCeoTransition && actorRole === "System Admin"
                    && ["ACTIVE", "REJECTED", "DISABLED"].includes(targetAccount.status));
                if (!targetAccount || !eligibleSource || !targetAccount.employeeId
                    || !supportedRoles.includes(targetRole)) {
                    fail("Select one active employee-linked operational account.");
                }
                if (formerCeoTransition && targetRole !== "ROLE_MANAGER") {
                    fail("A former CEO can transition only to Manager.");
                }
                if (formerCeoTransition && !readDemoAccounts().some((account) => account.id !== userId
                    && account.role === "ROLE_CEO" && account.status === "ACTIVE")) {
                    fail("Activate the successor CEO before moving the current CEO to Manager.");
                }
                if (!department) fail("Select an active department.");
                if (targetAccount.role === targetRole) {
                    fail(`Select a different role for ${candidate.fullName}.`);
                }

                const currentTeamLeads = readDemoTeamLeadAssignments();
                const currentDepartmentHrs = readDemoDepartmentHrAssignments();
                const currentManagers = readDemoManagerAssignments();
                const occupied = targetRole === "ROLE_TEAM_LEAD"
                    ? currentTeamLeads.some((item) => item.active && item.departmentId === departmentId
                        && item.teamLeadUserId !== userId)
                    : targetRole === "ROLE_HR_ADMIN"
                        ? currentDepartmentHrs.some((item) => item.active && item.departmentId === departmentId
                            && item.hrUserId !== userId)
                        : targetRole === "ROLE_MANAGER"
                            ? currentManagers.some((item) => item.active && item.departmentId === departmentId
                                && item.managerUserId !== userId)
                            : false;
                if (occupied) {
                    fail(`The selected department already has an active ${targetRole
                        .replace("ROLE_", "").replaceAll("_", " ")}.`);
                }

                const now = new Date().toISOString();
                const actorUserId = actorRole === "System Admin" ? DEMO_SYSTEM_ADMIN.id : "demo-ceo";
                let nextTeamLeads = currentTeamLeads.map((item) =>
                    item.active && item.teamLeadUserId === userId
                        ? { ...item, active: false, endedByUserId: actorUserId, endedAt: now } : item);
                let nextDepartmentHrs = currentDepartmentHrs.map((item) =>
                    item.active && item.hrUserId === userId
                        ? { ...item, active: false, endedByUserId: actorUserId, endedAt: now } : item);
                let nextManagers = currentManagers.map((item) =>
                    item.active && item.managerUserId === userId
                        ? { ...item, active: false, endedByUserId: actorUserId, endedAt: now } : item);

                if (targetRole === "ROLE_TEAM_LEAD") {
                    nextTeamLeads = [{
                        id: newClientId(), departmentId, teamLeadUserId: userId,
                        teamLeadEmployeeId: targetAccount.employeeId, active: true,
                        assignedByUserId: actorUserId, assignedAt: now, endedByUserId: null, endedAt: null,
                    }, ...nextTeamLeads];
                } else if (targetRole === "ROLE_HR_ADMIN") {
                    nextDepartmentHrs = [{
                        id: newClientId(), departmentId, hrUserId: userId,
                        hrEmployeeId: targetAccount.employeeId, active: true,
                        assignedByUserId: actorUserId, assignedAt: now, endedByUserId: null, endedAt: null,
                    }, ...nextDepartmentHrs];
                } else if (targetRole === "ROLE_MANAGER") {
                    nextManagers = [{
                        id: newClientId(), departmentId, managerUserId: userId,
                        managerEmployeeId: targetAccount.employeeId, active: true,
                        assignedByUserId: actorUserId, assignedAt: now, endedByUserId: null, endedAt: null,
                    }, ...nextManagers];
                }

                const employee = readDemoEmployees().find((item) =>
                    (item.uuid ?? item.id) === targetAccount.employeeId);
                if (!employee || employee.status !== "Active") {
                    fail("Only an active employee profile can receive the Manager position.");
                }
                const nextDesignation = targetRole === "ROLE_MANAGER" ? "Department Manager"
                    : targetRole === "ROLE_HR_ADMIN" ? "HR Business Partner"
                        : targetRole === "ROLE_TEAM_LEAD" ? "Team Lead" : null;
                const nextEmployees = readDemoEmployees().map((item) =>
                    (item.uuid ?? item.id) === targetAccount.employeeId
                        ? { ...item, departmentId, department: department.name,
                            role: nextDesignation ?? item.role, status: "Active" as const } : item);
                const nextAccounts = readDemoAccounts().map((account) =>
                    account.id === userId ? { ...account, role: targetRole, status: "ACTIVE",
                        rejectedAt: null } : account);

                // Compute and validate every next collection before committing any local
                // write. The account write is last and is the session-revocation signal.
                writeDemoTeamLeadAssignments(nextTeamLeads);
                writeDemoDepartmentHrAssignments(nextDepartmentHrs);
                writeDemoManagerAssignments(nextManagers);
                writeDemoEmployees(nextEmployees);
                writeDemoAccounts(nextAccounts);
            }
            await onChanged();
            setMessage(`${candidate.fullName} changed from ${candidate.role.replace("ROLE_", "").replaceAll("_", " ")} to ${targetRole.replace("ROLE_", "").replaceAll("_", " ")}. Existing sessions were revoked and the department assignment was updated atomically.`);
            form.reset(); setQuery(""); await load();
        } catch (reasonValue) {
            setError(reasonValue instanceof Error ? reasonValue.message : "The operational role could not be changed.");
        } finally { setBusy(false); }
    };

    const submitSuccession = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const currentCeoUserId = String(data.get("currentCeoUserId"));
        const successorUserId = String(data.get("successorUserId"));
        const formerCeoDepartmentId = String(data.get("formerCeoDepartmentId"));
        const reason = String(data.get("reason"));
        setBusy(true); setError(""); setMessage("");
        try {
            await brainServeApi.succeedChiefExecutive(
                currentCeoUserId, successorUserId, formerCeoDepartmentId, reason);
            await onChanged();
            const refreshed = await brainServeApi.operationalRoleCandidates("");
            setSuccessionCandidates(refreshed.content);
            setMessage("CEO succession completed atomically. Both sessions were revoked, the successor now has company-wide CEO authority, and the former CEO is the selected department Manager.");
            form.reset();
        } catch (reasonValue) {
            setError(reasonValue instanceof Error ? reasonValue.message
                : "CEO succession could not be completed.");
        } finally { setBusy(false); }
    };

    return <article className="panel glass-panel team-lead-access-card">
        <div className="panel-heading"><div><span>SINGLE-ROLE TRANSITION</span><h2>Change operational role safely</h2><p>CEO or System Admin can move an active operational account into one new role and department. System Admin can also move a former CEO to Manager after a successor CEO is active.</p></div><ShieldCheck size={22} /></div>
        <div className="team-lead-access-note"><BadgeCheck size={17} /><span><strong>One account · one role · one department assignment</strong><small>Old Team Lead, HR or Manager ownership is ended, custom permission overrides are cleared, and refresh sessions are revoked before the new access becomes effective.</small></span></div>
        <form className="staff-create-form team-lead-access-form" onSubmit={submit}>
            <label>Find account<div className="directory-search-row"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or company email" /><button type="button" className="button button-secondary" disabled={busy} onClick={() => void load(query)}><Search size={15} /> Search</button></div></label>
            <label>Account<select name="userId" required defaultValue=""><option value="">Select active account</option>{candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.fullName} · {candidate.role.replace("ROLE_", "").replaceAll("_", " ")}</option>)}</select></label>
            <label>New role<select name="role" required defaultValue="ROLE_MANAGER"><option value="ROLE_MANAGER">Manager</option><option value="ROLE_HR_ADMIN">HR Admin</option><option value="ROLE_TEAM_LEAD">Team Lead</option><option value="ROLE_EMPLOYEE">Employee</option></select></label>
            <label>Department<select name="departmentId" required defaultValue=""><option value="">Select active department</option>{departments.filter((item) => item.active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label>Reason<textarea name="reason" required minLength={5} maxLength={500} placeholder="Explain the approved responsibility change." /></label>
            <button className="button button-primary" disabled={busy}><UserCog size={16} />{busy ? "Changing role…" : "Apply role transition"}</button>
        </form>
        <div className="active-team-lead-list">{managerAssignments.filter((item) => item.active).map((assignment) => <span key={assignment.id}><BadgeCheck size={14} /><strong>{departments.find((item) => item.id === assignment.departmentId)?.name ?? "Department"}</strong><small>Assigned Manager</small></span>)}{managerAssignments.every((item) => !item.active) && <small>No department Managers assigned yet.</small>}</div>
        {actorRole === "System Admin" && <div className="ceo-succession-section">
            <div className="panel-heading"><div><span>ATOMIC CEO SUCCESSION</span><h2>Transfer company CEO authority</h2><p>The successor receives the CEO role in the same transaction that moves the current CEO to Manager. Existing leadership assignments and both sessions are ended safely.</p></div><ShieldCheck size={22} /></div>
            <form className="staff-create-form team-lead-access-form" onSubmit={submitSuccession}>
                <label>Current CEO<select name="currentCeoUserId" required defaultValue=""><option value="">Select current CEO</option>{successionCandidates.filter((item) => item.role === "ROLE_CEO").map((item) => <option key={item.userId} value={item.userId}>{item.fullName} · {item.email}</option>)}</select></label>
                <label>Successor CEO<select name="successorUserId" required defaultValue=""><option value="">Select active successor</option>{successionCandidates.filter((item) => ["ROLE_EMPLOYEE", "ROLE_TEAM_LEAD", "ROLE_HR_ADMIN", "ROLE_MANAGER"].includes(item.role)).map((item) => <option key={item.userId} value={item.userId}>{item.fullName} · {item.role.replace("ROLE_", "").replaceAll("_", " ")}</option>)}</select></label>
                <label>Former CEO Manager department<select name="formerCeoDepartmentId" required defaultValue=""><option value="">Select active department</option>{departments.filter((item) => item.active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
                <label>Succession reason<textarea name="reason" required minLength={5} maxLength={500} placeholder="Record the approved executive handover." /></label>
                <button className="button button-primary" disabled={busy}><UserCog size={16} />{busy ? "Transferring authority…" : "Complete CEO succession"}</button>
            </form>
        </div>}
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function employeesDepartment(employeeId: string, departments: Department[]) {
    return readDemoEmployees().find((employee) => (employee.uuid ?? employee.id) === employeeId)?.departmentId
        ?? departments.find((department) => department.active)?.id ?? "";
}

function IntegrationStatusPanel() {
    const [overview, setOverview] = useState<IntegrationOverview | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        setBusy(true); setError("");
        try { setOverview(await brainServeApi.integrationHealth()); }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Integration health could not be loaded.");
        } finally { setBusy(false); }
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer); }, [load]);
    return <article className="panel glass-panel integration-status-panel">
        <div className="panel-heading"><div><span>FULL-STACK READINESS</span><h2>Connected service health</h2>
            <p>Live checks for PostgreSQL, Redis, internal delivery, SMTP, private object storage and malware scanning.</p></div>
            <button type="button" className="button button-secondary" disabled={busy || !isBackendConfigured}
                    onClick={() => void load()}><RotateCcw size={15} />{busy ? "Checking…" : "Check services"}</button></div>
        {!isBackendConfigured && <div className="governance-connection-note"><LockKeyhole size={18} /><span>
      <strong>Backend URL not configured</strong><small>Set NEXT_PUBLIC_API_BASE_URL to activate the live service checks.</small></span></div>}
        {overview && <><div className={`integration-overall status-${overview.status.toLowerCase()}`}>
            <ShieldCheck size={18} /><span><strong>{overview.status === "READY" ? "All required services are ready" : "One or more services require attention"}</strong>
        <small>Checked {new Date(overview.checkedAt).toLocaleString("en-IN")}</small></span></div>
            <div className="integration-service-grid">{overview.services.map((service) => <div key={service.name}
                                                                                               className={service.ready ? "ready" : "degraded"}><span><i /><strong>{service.name}</strong></span>
                <small>{service.purpose}</small><small>{service.detail} · {service.latencyMs} ms</small></div>)}</div></>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function ManagerDepartmentAssignmentPanel({ departments, assignments, onChanged }: {
    departments: Department[]; assignments: ManagerAssignment[]; onChanged: () => Promise<void>;
}) {
    const [candidates, setCandidates] = useState<Array<{ userId: string; employeeId: string;
        fullName: string; email: string; currentDepartmentId: string | null;
        currentDepartmentCode: string | null; currentDepartmentName: string | null }>>([]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        try { setCandidates(await brainServeApi.managerCandidates()); }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Manager candidates could not be loaded.");
        }
    }, []);
    useEffect(() => {
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [load]);
    const assign = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy("assign"); setError(""); setMessage("");
        try {
            await brainServeApi.assignManager(String(data.get("departmentId")), String(data.get("managerUserId")));
            setMessage("The Manager and employee profile were moved to the selected department atomically.");
            form.reset(); await Promise.all([load(), onChanged()]);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The Manager could not be assigned.");
        } finally { setBusy(""); }
    };
    const end = async (assignment: ManagerAssignment) => {
        setBusy(assignment.id); setError(""); setMessage("");
        try {
            await brainServeApi.endManagerAssignment(assignment.id);
            setMessage("The Manager assignment ended. Assign a replacement before routing a CEO visit to this department.");
            await Promise.all([load(), onChanged()]);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The Manager assignment could not be ended.");
        } finally { setBusy(""); }
    };
    const candidateName = (userId: string) =>
        candidates.find((candidate) => candidate.userId === userId)?.fullName ?? "Assigned Manager";
    return <article className="panel glass-panel team-lead-access-card">
        <div className="panel-heading"><div><span>MANAGER DEPARTMENT OWNERSHIP</span><h2>Move an existing Manager</h2>
            <p>Use this after a Manager role exists. The assignment and linked employee department change in one backend transaction.</p></div><Building2 size={22} /></div>
        {!isBackendConfigured ? <div className="governance-connection-note"><LockKeyhole size={18} /><span>
      <strong>Backend connection required</strong><small>Manager ownership is never simulated in Preview data.</small></span></div>
            : <form className="staff-create-form team-lead-access-form" onSubmit={assign}>
                <label>Manager<select name="managerUserId" required defaultValue=""><option value="">Select active Manager</option>
                    {candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>
                        {candidate.fullName} · {candidate.currentDepartmentName ?? "unassigned"}</option>)}</select></label>
                <label>Department<select name="departmentId" required defaultValue=""><option value="">Select active department</option>
                    {departments.filter((department) => department.active).map((department) =>
                        <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
                <button className="button button-primary" disabled={busy === "assign"}><BadgeCheck size={15} />
                    {busy === "assign" ? "Assigning…" : "Assign Manager"}</button>
            </form>}
        <div className="active-team-lead-list">{assignments.filter((item) => item.active).map((assignment) =>
            <span key={assignment.id}><BadgeCheck size={14} /><strong>
        {departments.find((item) => item.id === assignment.departmentId)?.name ?? "Department"}</strong>
        <small>{candidateName(assignment.managerUserId)}</small>
                {isBackendConfigured && <button type="button" className="button button-quiet"
                                                disabled={busy === assignment.id} onClick={() => void end(assignment)}>End</button>}</span>)}
            {assignments.every((item) => !item.active) && <small>No department Managers assigned yet.</small>}</div>
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function SettingsView({ role, userEmail, accounts, departments, employees, teamLeadAssignments, onAddEmployee, onAssignTeamLead,
                          departmentHrAssignments, managerAssignments, approvedRecovery, onApprovedRecoveryChange,
                          onRoleAssignmentChanged,
                          onCreate, onChangeEmail, onResetPassword, onSetEnabled, onUpdatePermissions }: {
    role: Role; userEmail: string; accounts: StaffAccount[]; departments: Department[]; employees: Employee[];
    teamLeadAssignments: TeamLeadAssignment[]; departmentHrAssignments: DepartmentHrAssignment[];
    managerAssignments: ManagerAssignment[];
    approvedRecovery: AccountRecoveryRequest | null;
    onApprovedRecoveryChange: (request: AccountRecoveryRequest | null) => void;
    onRoleAssignmentChanged: () => Promise<void>;
    onAddEmployee: () => void;
    onAssignTeamLead: (departmentId: string, employeeId: string) => Promise<boolean>;
    onCreate: (email: string, password: string, role: string) => Promise<void>;
    onChangeEmail: (userId: string, email: string) => Promise<void>;
    onResetPassword: (userId: string, password: string) => Promise<void>;
    onSetEnabled: (userId: string, enabled: boolean) => Promise<void>;
    onUpdatePermissions: (userId: string, grants: string[], denies: string[]) => Promise<void>;
}) {
    const [section, setSection] = useState<SettingsSection>("identity");
    const [settings, setSettings] = useState<WorkspaceSetting[]>(() => isBackendConfigured ? [] : fallbackSettings);
    const [roles, setRoles] = useState<RoleDefinition[]>(() => isBackendConfigured ? [] : fallbackRoles);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busyKey, setBusyKey] = useState("");
    const [teamLeadDepartmentId, setTeamLeadDepartmentId] = useState("");
    const [teamLeadQuery, setTeamLeadQuery] = useState("");
    const [teamLeadCandidates, setTeamLeadCandidates] = useState<Employee[]>([]);
    const [teamLeadCandidatesLoading, setTeamLeadCandidatesLoading] = useState(false);
    const [teamLeadCandidatesError, setTeamLeadCandidatesError] = useState("");
    const [managedAccounts, setManagedAccounts] = useState<StaffAccount[]>(accounts);
    const [managedAccountPage, setManagedAccountPage] = useState(0);
    const [managedAccountTotalPages, setManagedAccountTotalPages] = useState(1);
    const [managedAccountTotal, setManagedAccountTotal] = useState(accounts.length);
    const [managedAccountQuery, setManagedAccountQuery] = useState("");
    const [managedAccountsLoading, setManagedAccountsLoading] = useState(false);
    const allowedRoles = [["ROLE_RECEPTIONIST", "Receptionist"], ["ROLE_SECURITY", "Security"]];
    const nav: Array<[SettingsSection, typeof Building2, string]> = [
        ["company", Building2, "Company profile"], ["identity", Fingerprint, "Identity & access"],
        ["roles", UserCog, "Roles & responsibilities"], ["policy", CalendarDays, "Appointment policy"],
        ["notifications", Bell, "Notifications"], ["privacy", ShieldCheck, "Privacy & retention"],
    ];

    useEffect(() => {
        if (!isBackendConfigured) return;
        let active = true;
        const loadSettings = role === "System Admin"
            ? brainServeApi.systemSettings()
            : brainServeApi.workspaceSettings();
        loadSettings.then((items) => { if (active) setSettings(items); })
            .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Workspace settings could not be loaded."); });
        if (["System Admin", "HR Admin"].includes(role)) {
            brainServeApi.roleDefinitions().then((items) => { if (active) setRoles(items); })
                .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Role definitions could not be loaded."); });
        }
        return () => { active = false; };
    }, [role]);

    const canEdit = (key: string) => role === "System Admin"
        || (role === "CEO" && ["COMPANY.", "APPOINTMENT.", "APPROVAL.", "NOTIFICATION.", "PRIVACY.", "VISITOR.RETENTION"].some((prefix) => key.startsWith(prefix)))
        || (role === "HR Admin" && ["APPOINTMENT.", "APPROVAL.", "NOTIFICATION.", "PRIVACY.", "VISITOR.RETENTION"].some((prefix) => key.startsWith(prefix)));

    const loadManagedAccounts = useCallback(async (pageNumber = 0, query = "") => {
        if (role !== "HR Admin") return;
        if (!isBackendConfigured) {
            const matching = accounts.filter((account) => !query
                || `${account.fullName} ${account.email}`.toLowerCase().includes(query.toLowerCase()));
            setManagedAccounts(matching.slice(pageNumber * 25, (pageNumber + 1) * 25));
            setManagedAccountPage(pageNumber); setManagedAccountTotal(matching.length);
            setManagedAccountTotalPages(Math.max(1, Math.ceil(matching.length / 25)));
            return;
        }
        setManagedAccountsLoading(true);
        try {
            const page = await brainServeApi.staffAccountPage({ query, page: pageNumber, size: 25 });
            setManagedAccounts(page.content); setManagedAccountPage(page.number ?? pageNumber);
            setManagedAccountTotal(page.totalElements ?? page.content.length);
            setManagedAccountTotalPages(page.totalPages ?? 1);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Managed staff accounts could not be loaded.");
        } finally { setManagedAccountsLoading(false); }
    }, [accounts, role]);

    useEffect(() => {
        if (role !== "HR Admin") return;
        const timer = window.setTimeout(() => void loadManagedAccounts(0, ""), 0);
        return () => window.clearTimeout(timer);
    }, [loadManagedAccounts, role]);

    const loadTeamLeadCandidates = useCallback(async (departmentId: string, query = "") => {
        if (!departmentId) { setTeamLeadCandidates([]); setTeamLeadCandidatesError(""); setError(""); return; }
        setTeamLeadCandidatesLoading(true);
        setTeamLeadCandidatesError("");
        setError("");
        try {
            const department = departments.find((item) => item.id === departmentId);
            if (isBackendConfigured) {
                const page = await brainServeApi.employeePage({
                    departmentId, query, status: "ACTIVE", page: 0, size: 50, sort: "displayName,asc",
                });
                setTeamLeadCandidates(page.content.map((employee) => ({
                    id: employee.employeeNumber, uuid: employee.id, departmentId: employee.departmentId,
                    name: employee.displayName, initials: visitorInitials(employee.displayName),
                    role: employee.designation, department: department?.name ?? "Department",
                    email: employee.officialEmail, status: employeeStatusLabel(employee.status),
                })));
            } else {
                setTeamLeadCandidates(employees.filter((employee) => employee.status === "Active"
                    && employee.departmentId === departmentId
                    && (!query || `${employee.name} ${employee.id} ${employee.email}`.toLowerCase()
                        .includes(query.toLowerCase()))).slice(0, 50));
            }
        } catch (reason) {
            setTeamLeadCandidates([]);
            const message = reason instanceof Error ? reason.message : "Team Lead candidates could not be loaded.";
            setTeamLeadCandidatesError(message);
            setError(message);
        } finally { setTeamLeadCandidatesLoading(false); }
    }, [departments, employees]);

    useEffect(() => {
        if (!isBackendConfigured || !teamLeadDepartmentId) return;
        const timer = window.setTimeout(() => void loadTeamLeadCandidates(teamLeadDepartmentId), 0);
        return () => window.clearTimeout(timer);
    }, [loadTeamLeadCandidates, teamLeadDepartmentId]);

    const updateSetting = async (key: string, value: string) => {
        setBusyKey(key); setError(""); setMessage("");
        try {
            const updated = isBackendConfigured
                ? role === "System Admin"
                    ? await brainServeApi.updateSystemSetting(key, value)
                    : await brainServeApi.updateWorkspaceSetting(key, value)
                : { ...(settings.find((item) => item.key === key) as WorkspaceSetting), value };
            setSettings((items) => items.map((item) => item.key === key ? updated : item));
            setMessage("Workspace setting saved and recorded in the audit trail.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The setting could not be saved."); }
        finally { setBusyKey(""); }
    };

    const  create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError(""); setMessage("");
        const form = event.currentTarget; const data = new FormData(form);
        try {
            await onCreate(String(data.get("email")), String(data.get("password")), String(data.get("role")));
            form.reset(); setMessage("Access-only login created and sent to the HR Admin approval queue.");
        } catch (reason) { setError(reason instanceof ApiError ? reason.message : "The staff account could not be created."); }
    };

    const assignTeamLeadAccess = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError(""); setMessage("");
        const form = event.currentTarget; const data = new FormData(form);
        const departmentId = String(data.get("departmentId"));
        const employeeId = String(data.get("employeeId"));
        if (!departmentId || !employeeId) { setError("Select an active department and an approved employee login."); return; }
        setBusyKey("team-lead-assignment");
        try {
            const assigned = await onAssignTeamLead(departmentId, employeeId);
            if (assigned) {
                const employee = [...teamLeadCandidates, ...employees]
                    .find((item) => (item.uuid ?? item.id) === employeeId);
                const department = departments.find((item) => item.id === departmentId);
                setMessage(`${employee?.name ?? "Employee"} now has Team Lead access for ${department?.name ?? "the selected department"}. Their existing login credentials remain unchanged.`);
                form.reset(); setTeamLeadDepartmentId(""); setTeamLeadCandidates([]); setTeamLeadQuery("");
            }
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Team Lead access could not be created."); }
        finally { setBusyKey(""); }
    };

    const activeLeadEmployeeIds = new Set(teamLeadAssignments.filter((item) => item.active)
        .map((item) => item.teamLeadEmployeeId));
    const currentAccount = accounts.find((account) => account.email.toLowerCase() === userEmail.toLowerCase());
    const currentHrUserId = currentAccount?.userId ?? (!isBackendConfigured
        ? readDemoAccounts().find((account) => account.email.toLowerCase() === userEmail.toLowerCase())?.id
        : undefined);
    const assignedHrDepartmentId = role === "HR Admin" ? departmentHrAssignments
        .find((assignment) => assignment.active && assignment.hrUserId === currentHrUserId)?.departmentId : undefined;
    const assignableTeamLeadDepartments = departments.filter((department) => department.active
        && (role !== "HR Admin" || department.id === assignedHrDepartmentId));
    const selectedTeamLeadDepartment = departments.find((department) => department.id === teamLeadDepartmentId);
    const candidatePool = isBackendConfigured || teamLeadCandidates.length || teamLeadQuery
        ? teamLeadCandidates : employees;
    const selectedDepartmentEmployees = selectedTeamLeadDepartment
        ? candidatePool.filter((employee) => belongsToDepartment(employee, selectedTeamLeadDepartment)) : [];
    const eligibleTeamLeadEmployees = candidatePool.filter((employee) => employee.status === "Active"
        && Boolean(employee.uuid ?? employee.id)
        && !activeLeadEmployeeIds.has(employee.uuid ?? employee.id)
        && (!selectedTeamLeadDepartment || belongsToDepartment(employee, selectedTeamLeadDepartment)));

    const changeOwnEmail = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setError(""); setMessage("");
        const form = event.currentTarget; const data = new FormData(form);
        try {
            if (!isBackendConfigured) fail("Connect the Spring backend to change the stored login email.");
            await brainServeApi.changeMyEmail(String(data.get("currentPassword")), String(data.get("newEmail")));
            setMessage("Your company email was updated. Sign in again with the new email."); form.reset();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Your email could not be updated."); }
    };

    const settingPanel = (title: string, eyebrow: string, detail: string, keys: string[]) => <article className="panel glass-panel"><div className="panel-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></div><div className="setting-list">{keys.map((key) => { const item = settings.find((value) => value.key === key); return item ? <SettingControl key={`${key}:${item.version}:${item.value}`} setting={item} disabled={!canEdit(key) || busyKey === key} onSave={updateSetting} /> : null; })}</div></article>;

    return <><PageTitle eyebrow="WORKSPACE ADMINISTRATION" title="BrainServe Connect controls" detail="Company identity, role-scoped access, appointment rules, notifications and privacy settings backed by the Spring service." />
        {role === "System Admin" && <IntegrationStatusPanel />}
        <div className="settings-grid"><article className="settings-nav glass-panel">{nav.map(([id, Icon, label]) => <button type="button" className={section === id ? "active" : ""} key={id} onClick={() => { setSection(id); setError(""); setMessage(""); }}><Icon size={18} />{label}<ChevronRight size={16} /></button>)}</article><div className="identity-settings">
            {section === "company" && settingPanel("Company profile", "ORGANIZATION IDENTITY", "These values drive the public visitor experience and official support details.", ["COMPANY.NAME", "COMPANY.EMAIL_DOMAIN", "COMPANY.HQ_ADDRESS", "COMPANY.SUPPORT_EMAIL"])}
            {section === "identity" && <>
                <article className="panel glass-panel"><div className="panel-heading"><div><span>YOUR STAFF IDENTITY</span><h2>Company login</h2><p>Current login: <strong>{userEmail}</strong>. Your authenticated role is locked to <strong>{role}</strong>.</p></div><LockKeyhole size={22} /></div>{role !== "System Admin" && <form className="inline-account-form" onSubmit={changeOwnEmail}><label>New company email<input name="newEmail" type="email" placeholder="name@brainserve.in" required /></label><label>Current password<input name="currentPassword" type="password" minLength={8} required /></label><button className="button button-secondary"><Fingerprint size={16} /> Update my email</button></form>}</article>
                <PasswordChangeCard />
                {role === "System Admin" && <AccountRecoveryApprovalPanel
                    generated={approvedRecovery} onGeneratedChange={onApprovedRecoveryChange} />}
                {role === "HR Admin" ? <>
                    <article className="panel glass-panel"><div className="panel-heading"><div><span>CREATE EMPLOYEE</span><h2>Employee profile and department</h2><p>Create the employee profile, assign the HR Admin&apos;s department and generate the employee ID in one flow.</p></div><Building2 size={22} /></div><div className="team-lead-access-note"><BadgeCheck size={17} /><span><strong>Department assignment is mandatory</strong><small>The employee form includes department, designation and joining date. If HR manages one department, it is selected automatically.</small></span></div><button type="button" className="button button-primary" onClick={onAddEmployee} disabled={!departments.some((item) => item.active)}><UserPlus size={16} /> Add employee &amp; assign department</button>{!departments.some((item) => item.active) && <div className="login-error" role="alert">No active department is available. Ask the CEO or System Admin to assign this HR Admin to a department.</div>}</article>
                    <article className="panel glass-panel"><div className="panel-heading"><div><span>CREATE ACCESS-ONLY LOGIN</span><h2>Receptionist or Security</h2><p>These roles do not belong to an employee department. Each login remains pending until an HR Admin approves it.</p></div></div><form className="staff-create-form" onSubmit={create}><label>Company email<input name="email" type="email" placeholder="name@brainserve.in" required /></label><label>Temporary password<input name="password" type="password" minLength={12} placeholder="Minimum 12 characters" required /></label><label>Role<select name="role">{allowedRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button button-primary"><UserPlus size={16} /> Create login</button></form></article>
                    <article className="panel glass-panel team-lead-access-card"><div className="panel-heading"><div><span>CREATE TEAM LEAD ACCESS</span><h2>Promote an approved employee</h2><p>A Team Lead keeps their existing company email and password. HR assigns one active employee login to one department.</p></div><BadgeCheck size={22} /></div>
                        <div className="team-lead-access-note"><ShieldCheck size={17} /><span><strong>Employees only — Security and Receptionist are excluded</strong><small>Only an active, approved Employee login from the selected department can appear here. Promotion revokes existing refresh sessions and the next sign-in opens Team Lead access for that department.</small></span></div>
                        <form className="staff-create-form team-lead-access-form" onSubmit={assignTeamLeadAccess}>
                            <label>Department<select name="departmentId" value={teamLeadDepartmentId} onChange={(event) => { setTeamLeadDepartmentId(event.target.value); setTeamLeadCandidates([]); setTeamLeadCandidatesError(""); setError(""); setTeamLeadQuery(""); }} required disabled={assignableTeamLeadDepartments.length === 0}><option value="">{assignableTeamLeadDepartments.length ? "Select your assigned department" : "No HR department assignment"}</option>{assignableTeamLeadDepartments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
                            <label>Find approved Employee<div className="directory-search-row"><input value={teamLeadQuery} onChange={(event) => setTeamLeadQuery(event.target.value)} placeholder="Name, employee ID or company email" /><button type="button" className="button button-secondary" disabled={!teamLeadDepartmentId || teamLeadCandidatesLoading} onClick={() => void loadTeamLeadCandidates(teamLeadDepartmentId, teamLeadQuery)}><Search size={15} />{teamLeadCandidatesLoading ? "Searching…" : "Search"}</button></div></label>
                            <label>Approved Employee login<select name="employeeId" defaultValue="" key={`${teamLeadDepartmentId}:${teamLeadQuery}`} required disabled={teamLeadCandidatesLoading || Boolean(teamLeadCandidatesError)}><option value="">{teamLeadCandidatesLoading ? "Loading eligible employees…" : teamLeadCandidatesError ? "Employee list could not be loaded" : eligibleTeamLeadEmployees.length ? "Select an Employee in this department" : teamLeadCandidates.length ? "All active employees are already Team Leads" : "No active employees in this department"}</option>{eligibleTeamLeadEmployees.map((employee) => <option value={employee.uuid ?? employee.id} key={employee.uuid ?? employee.id}>{employee.name} · Employee · {employee.department}</option>)}</select></label>
                            {teamLeadCandidatesError && <div className="login-error" role="alert">{teamLeadCandidatesError}</div>}
                            <button className="button button-primary" disabled={busyKey === "team-lead-assignment" || !teamLeadDepartmentId || eligibleTeamLeadEmployees.length === 0 || Boolean(teamLeadCandidatesError)}><BadgeCheck size={16} /> {busyKey === "team-lead-assignment" ? "Creating access…" : "Create Team Lead access"}</button>
                        </form>
                        {selectedTeamLeadDepartment && <div className="team-lead-readiness"><Users size={16} /><span><strong>{selectedDepartmentEmployees.length} matching member{selectedDepartmentEmployees.length === 1 ? "" : "s"} · {eligibleTeamLeadEmployees.length} available for validation</strong><small>The backend confirms the selected employee has an active approved Employee login in your department before promotion.</small></span></div>}
                        <div className="active-team-lead-list">{teamLeadAssignments.filter((item) => item.active).map((assignment) => { const department = departments.find((item) => item.id === assignment.departmentId); const employee = employees.find((item) => (item.uuid ?? item.id) === assignment.teamLeadEmployeeId); return <span key={assignment.id}><BadgeCheck size={14} /><strong>{department?.name ?? "Department"}</strong><small>{employee?.name ?? "Assigned Team Lead"}</small></span>; })}{teamLeadAssignments.every((item) => !item.active) && <small>No Team Lead assignments yet.</small>}</div>
                    </article>
                    <article className="panel glass-panel"><div className="panel-heading"><div><span>MANAGED ACCOUNTS</span><h2>HR staff directory</h2><p>Search and manage one bounded department page at a time. Pending accounts must still use the HR approval action.</p></div><b>{managedAccountTotal.toLocaleString("en-IN")}</b></div>
                        <form className="inline-account-form" onSubmit={(event) => { event.preventDefault(); void loadManagedAccounts(0, managedAccountQuery); }}>
                            <label>Find account<input value={managedAccountQuery} onChange={(event) => setManagedAccountQuery(event.target.value)} placeholder="Name or company email" /></label>
                            <button className="button button-secondary" disabled={managedAccountsLoading}><Search size={16} />{managedAccountsLoading ? "Searching…" : "Search"}</button>
                        </form>
                        <div className="staff-account-list">{managedAccounts.map((account) => <StaffAccountRow key={account.userId} account={account}
                                                                                                               onChangeEmail={async (userId, email) => { await onChangeEmail(userId, email); await loadManagedAccounts(managedAccountPage, managedAccountQuery); }}
                                                                                                               onResetPassword={async (userId, password) => { await onResetPassword(userId, password); await loadManagedAccounts(managedAccountPage, managedAccountQuery); }}
                                                                                                               onSetEnabled={async (userId, enabled) => { await onSetEnabled(userId, enabled); await loadManagedAccounts(managedAccountPage, managedAccountQuery); }} />)}
                            {managedAccounts.length === 0 && <div className="empty-state"><UserCog size={28} /><strong>No managed accounts found</strong><small>Change the search or create the first staff login above.</small></div>}</div>
                        {managedAccountTotalPages > 1 && <div className="table-pagination"><button type="button" className="button button-secondary"
                                                                                                   disabled={managedAccountPage === 0 || managedAccountsLoading}
                                                                                                   onClick={() => void loadManagedAccounts(managedAccountPage - 1, managedAccountQuery)}><ArrowLeft size={15} /> Previous</button>
                            <span>Page {managedAccountPage + 1} of {managedAccountTotalPages}</span><button type="button" className="button button-secondary"
                                                                                                            disabled={managedAccountPage + 1 >= managedAccountTotalPages || managedAccountsLoading}
                                                                                                            onClick={() => void loadManagedAccounts(managedAccountPage + 1, managedAccountQuery)}>Next <ArrowRight size={15} /></button></div>}
                    </article>
                </> : <><article className="panel glass-panel scope-card"><div className="panel-heading"><div><span>APPROVAL SCOPE</span><h2>{role === "CEO" ? "CEO approves every HR Admin and Manager request" : "System Admin creates and approves only the single CEO"}</h2><p>{role === "CEO" ? "Your department is a work assignment only; CEO governance remains company-wide." : "HR Admin and Manager activation is routed to the CEO. Employee, Receptionist and Security accounts remain controlled by their HR Admin."}</p></div><ShieldCheck size={22} /></div></article><HrLifecyclePanel /></>}
            </>}
            {section === "roles" && <>{(["CEO", "HR Admin"] as Role[]).includes(role) && <RoleAssignmentChangePanel
                role={role as "CEO" | "HR Admin"} userEmail={userEmail} accounts={accounts} departments={departments} employees={employees}
                teamLeadAssignments={teamLeadAssignments} departmentHrAssignments={departmentHrAssignments}
                onChanged={onRoleAssignmentChanged} />}
                <article className="panel glass-panel permission-panel"><div className="panel-heading"><div><span>ROLE DEFINITIONS</span><h2>Eight locked BrainServe Connect roles</h2><p>Roles remain locked after login. Department ownership changes through the approval ledger above; default permissions stay enforced at every backend endpoint.</p></div><b>{roles.length}</b></div><div className="role-definition-list">{roles.map((definition) => <div key={definition.role}><span className="role-icon"><UserCog size={18} /></span><span><strong>{definition.role.replace("ROLE_", "").replaceAll("_", " ")}</strong><small>{definition.defaultPermissions.length} default permissions</small></span><div>{definition.defaultPermissions.slice(0, 6).map((permission) => <code key={permission}>{permission.replaceAll("_", " ")}</code>)}{definition.defaultPermissions.length > 6 && <code>+{definition.defaultPermissions.length - 6} more</code>}</div></div>)}</div></article>{role === "HR Admin" && <AccountPermissionEditor accounts={managedAccounts} roles={roles} onUpdate={onUpdatePermissions} />}</>}
            {section === "roles" && ["CEO", "System Admin"].includes(role) && <OperationalRoleTransitionPanel
                actorRole={role as "CEO" | "System Admin"} departments={departments}
                managerAssignments={managerAssignments} onChanged={onRoleAssignmentChanged} />}
            {section === "roles" && ["CEO", "System Admin"].includes(role) && <ManagerDepartmentAssignmentPanel
                departments={departments} assignments={managerAssignments} onChanged={onRoleAssignmentChanged} />}
            {section === "policy" && settingPanel("Appointment and QR pass policy", "VISITOR WORKFLOW", "Booking duration, same-day lead time, advance window and signed pass validity are enforced by backend services.", ["APPOINTMENT.SLOT_MINUTES", "APPOINTMENT.MAX_ADVANCE_DAYS", "APPOINTMENT.MIN_LEAD_MINUTES", "APPOINTMENT.CHECK_IN_EARLY_MINUTES", "APPOINTMENT.QR_EXPIRY_MINUTES_AFTER_END"])}
            {section === "notifications" && <>{settingPanel("Notification delivery", "EMAIL & ALERTS", "Control transactional booking, approval and security alert email.", ["NOTIFICATION.APPOINTMENT_EMAIL_ENABLED", "NOTIFICATION.APPROVAL_EMAIL_ENABLED", "NOTIFICATION.SECURITY_ALERT_EMAIL_ENABLED"])}<article className="panel glass-panel"><div className="panel-heading"><div><span>BRAINSERVE CONNECT INTERNAL CALLS</span><h2>Prioritized, role-controlled conversations</h2><p>Unread and urgent requests rise first. Department-bound routes are restricted to the sender’s assigned department.</p></div><MessageSquare size={22} /></div><div className="notification-route-grid"><span><strong>CEO</strong><ChevronRight size={14} />Manager · HR Admin · Team Lead · Receptionist</span><span><strong>Manager</strong><ChevronRight size={14} />CEO · same-department HR · Receptionist</span><span><strong>HR Admin</strong><ChevronRight size={14} />CEO · same-department Team Lead and Employee · Receptionist</span><span><strong>Team Lead</strong><ChevronRight size={14} />same-department HR · Receptionist</span><span><strong>Employee</strong><ChevronRight size={14} />same-department HR</span><span><strong>Receptionist</strong><ChevronRight size={14} />CEO · Manager · HR Admin · Team Lead</span></div></article></>}
            {section === "privacy" && <>{settingPanel("Privacy and consent", "DATA GOVERNANCE", "Apply the consent version used across the service. Dataset retention is managed in the governed lifecycle below.", ["PRIVACY.CONSENT_VERSION"])}{role === "System Admin" && <DataGovernancePanel />}</>}
            {message && <div className="success-banner"><CheckCircle2 size={17} /> {message}</div>}{error && <div className="login-error" role="alert">{error}</div>}
        </div></div></>;
}

function DataGovernancePanel() {
    const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
    const [manifests, setManifests] = useState<ArchiveManifest[]>([]);
    const [holds, setHolds] = useState<DataLegalHold[]>([]);
    const [ledgerEntries, setLedgerEntries] = useState<GovernanceLedgerEntry[]>([]);
    const [overview, setOverview] = useState<GovernanceOverview | null>(null);
    const [holdScope, setHoldScope] = useState<DataLegalHold["scopeType"]>("DATASET");
    const [releaseReasons, setReleaseReasons] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        try {
            const [nextPolicies, nextManifests, nextHolds, nextOverview, nextLedger] = await Promise.all([
                brainServeApi.retentionPolicies(), brainServeApi.archiveManifests(), brainServeApi.dataLegalHolds(),
                brainServeApi.governanceOverview(), brainServeApi.governanceLedger(50),
            ]);
            setPolicies(nextPolicies); setManifests(nextManifests); setHolds(nextHolds);
            setOverview(nextOverview); setLedgerEntries(nextLedger.items); setError("");
        }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Data-governance settings could not be loaded."); }
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
    const save = async (policy: RetentionPolicy, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(policy.dataset); setError(""); setMessage("");
        const data = new FormData(event.currentTarget);
        try {
            const updated = await brainServeApi.updateRetentionPolicy(policy.dataset, {
                hotDays: Number(data.get("hotDays")), warmMonths: Number(data.get("warmMonths")),
                archiveYears: Number(data.get("archiveYears")),
                disposalAction: String(data.get("disposalAction")) as RetentionPolicy["disposalAction"],
                enabled: data.get("enabled") === "on",
            });
            setPolicies((items) => items.map((item) => item.dataset === updated.dataset ? updated : item));
            setMessage(`${updated.dataset.replaceAll("_", " ")} retention policy saved.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Retention policy could not be saved."); }
        finally { setBusy(""); }
    };

    const createHold = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy("create-hold"); setError(""); setMessage("");
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        try {
            const created = await brainServeApi.createDataLegalHold({
                dataset: String(form.get("dataset")), holdKind: String(form.get("holdKind")) as DataLegalHold["holdKind"],
                scopeType: holdScope, scopeRef: holdScope === "DATASET" ? null : String(form.get("scopeRef") ?? "").trim(),
                caseReference: String(form.get("caseReference")), reason: String(form.get("reason")),
                reviewOn: String(form.get("reviewOn") ?? "") || null,
            });
            setHolds((items) => [created, ...items]); setMessage("The hold is active. Archive removal and disposal are blocked.");
            formElement.reset(); setHoldScope("DATASET"); await load();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The legal hold could not be placed."); }
        finally { setBusy(""); }
    };

    const releaseHold = async (hold: DataLegalHold) => {
        const reason = releaseReasons[hold.id]?.trim();
        if (!reason) { setError("Enter a release reason before releasing the hold."); return; }
        setBusy(`release:${hold.id}`); setError(""); setMessage("");
        try {
            const released = await brainServeApi.releaseDataLegalHold(hold.id, reason);
            setHolds((items) => items.map((item) => item.id === released.id ? released : item));
            setReleaseReasons((items) => ({ ...items, [hold.id]: "" }));
            setMessage("The hold was formally released and the lifecycle may resume."); await load();
        } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "The hold could not be released."); }
        finally { setBusy(""); }
    };

    const activeHolds = holds.filter((item) => !item.releasedAt);
    const verifiedArchives = manifests.filter((item) => ["VERIFIED", "DATABASE_REMOVED"].includes(item.status)).length;
    return <div className="governance-workspace">
        <article className="panel glass-panel governance-panel"><div className="panel-heading"><div><span>HOT · WARM · ENCRYPTED COLD STORAGE</span><h2>Database history lifecycle</h2><p>Each dataset has its own retention clock. A partition is removed only after AES-256-GCM archival, checksum verification and a successful restore test.</p></div><Archive size={22} /></div>
            {!isBackendConfigured && <div className="governance-connection-note"><LockKeyhole size={18} /><span><strong>Backend connection required</strong><small>Retention policies, legal holds and the immutable ledger are intentionally never stored in browser preview data.</small></span></div>}
            <div className="governance-manifest-summary"><span><strong>{overview?.activeHolds ?? activeHolds.length}</strong><small>Active holds</small></span><span><strong>{verifiedArchives}</strong><small>Restore-tested archives</small></span><span><strong>{overview?.pendingBackupExpiries ?? 0}</strong><small>Backup expiries pending</small></span><span className={overview?.ledgerIntegrityValid === false ? "governance-warning" : ""}><strong>{overview ? (overview.ledgerIntegrityValid ? "Healthy" : "Review") : "—"}</strong><small>Ledger integrity · {overview?.ledgerEntriesChecked ?? 0} entries</small></span></div>
            <div className="governance-policy-list">{policies.map((policy) => <form key={`${policy.dataset}:${policy.updatedAt}`} onSubmit={(event) => void save(policy, event)}><header><strong>{policy.dataset.replaceAll("_", " ")}</strong><label><input name="enabled" type="checkbox" defaultChecked={policy.enabled} /> Enabled</label></header><div><label>Hot days<input name="hotDays" type="number" min={1} max={3650} defaultValue={policy.hotDays} required /></label><label>Warm months<input name="warmMonths" type="number" min={1} max={240} defaultValue={policy.warmMonths} required /></label><label>Archive years<input name="archiveYears" type="number" min={1} max={25} defaultValue={policy.archiveYears} required /></label><label>At expiry<select name="disposalAction" defaultValue={policy.disposalAction}><option value="ANONYMIZE">Anonymize</option><option value="DELETE">Secure delete</option></select></label><button className="button button-secondary" disabled={busy === policy.dataset}>{busy === policy.dataset ? "Saving…" : "Save policy"}</button></div></form>)}</div>
        </article>

        <article className="panel glass-panel governance-panel"><div className="panel-heading"><div><span>LEGAL HOLD · INVESTIGATION</span><h2>Preservation controls</h2><p>An active hold overrides every retention deadline. Dataset holds are broad; partition and subject holds preserve a specific evidence scope.</p></div><ShieldCheck size={22} /></div>
            <form className="governance-hold-form" onSubmit={(event) => void createHold(event)}>
                <label>Dataset<select name="dataset" required><option value="">Select dataset</option>{policies.map((policy) => <option key={policy.dataset} value={policy.dataset}>{policy.dataset.replaceAll("_", " ")}</option>)}</select></label>
                <label>Hold type<select name="holdKind" defaultValue="LEGAL_HOLD"><option value="LEGAL_HOLD">Legal hold</option><option value="ACTIVE_INVESTIGATION">Active investigation</option></select></label>
                <label>Scope<select name="scopeType" value={holdScope} onChange={(event) => setHoldScope(event.target.value as DataLegalHold["scopeType"])}><option value="DATASET">Entire dataset</option><option value="PARTITION">Archive partition</option><option value="SUBJECT">Specific record/person</option></select></label>
                {holdScope !== "DATASET" && <label>Scope reference<input name="scopeRef" placeholder={holdScope === "PARTITION" ? "employee_history_event_2026_07" : "Record UUID"} required /></label>}
                <label>Case reference<input name="caseReference" maxLength={120} placeholder="CASE-2026-001" required /></label>
                <label>Review date<input name="reviewOn" type="date" /></label>
                <label className="governance-hold-reason">Reason<textarea name="reason" maxLength={1200} placeholder="Why this data must be preserved" required /></label>
                <button className="button button-primary" disabled={busy === "create-hold"}><LockKeyhole size={15} />{busy === "create-hold" ? "Placing hold…" : "Place hold"}</button>
            </form>
            <div className="governance-hold-list">{activeHolds.map((hold) => <div key={hold.id}><span><strong>{hold.caseReference} · {hold.dataset.replaceAll("_", " ")}</strong><small>{hold.holdKind.replaceAll("_", " ")} · {hold.scopeType.replaceAll("_", " ")}{hold.scopeRef ? ` · ${hold.scopeRef}` : ""}</small><small>{hold.reason}</small></span><div><input aria-label={`Release reason for ${hold.caseReference}`} value={releaseReasons[hold.id] ?? ""} onChange={(event) => setReleaseReasons((items) => ({ ...items, [hold.id]: event.target.value }))} placeholder="Formal release reason" /><button type="button" className="button button-secondary" disabled={busy === `release:${hold.id}`} onClick={() => void releaseHold(hold)}>{busy === `release:${hold.id}` ? "Releasing…" : "Release hold"}</button></div></div>)}{activeHolds.length === 0 && <div className="empty-state"><ShieldCheck size={25} /><strong>No active legal holds</strong><small>Eligible records can follow their configured lifecycle.</small></div>}</div>
        </article>

        <article className="panel glass-panel governance-panel"><div className="panel-heading"><div><span>ARCHIVE EVIDENCE</span><h2>Verification and removal status</h2><p>Checksums, encryption-key versions, restore results, database removal and backup expiry remain visible without exposing archive contents.</p></div><FileClock size={22} /></div>
            <div className="governance-manifest-table">{manifests.slice(0, 20).map((item) => <div key={item.partitionName}><span><strong>{item.dataset.replaceAll("_", " ")}</strong><small>{item.periodStart} → {item.periodEnd}</small></span><span><strong>{item.rowCount.toLocaleString("en-IN")} rows</strong><small>{item.encryptionAlgorithm ?? "Awaiting encryption"}{item.encryptionKeyVersion ? ` · ${item.encryptionKeyVersion}` : ""}</small></span><span className={`governance-status status-${item.status.toLowerCase()}`}><strong>{item.status.replaceAll("_", " ")}</strong><small>{item.holdBlocked ? "Blocked by active hold" : item.restoreTestedAt ? "Restore tested" : item.lastError ?? "Lifecycle pending"}</small></span></div>)}{manifests.length === 0 && <div className="empty-state"><Archive size={25} /><strong>No archive manifests yet</strong><small>The scheduled discovery creates manifests when monthly history becomes eligible.</small></div>}</div>
        </article>

        <article className="panel glass-panel governance-panel"><div className="panel-heading"><div><span>APPEND-ONLY EVIDENCE</span><h2>Immutable governance ledger</h2><p>Policy changes, holds, archive verification, database removal, anonymization, deletion and backup expiry are hash chained and protected from update or deletion.</p></div><Fingerprint size={22} /></div>
            <div className="governance-ledger-list">{ledgerEntries.slice(0, 20).map((entry) => <div key={entry.id}><code>#{entry.sequence}</code><span><strong>{entry.actionType.replaceAll("_", " ")}</strong><small>{entry.dataset.replaceAll("_", " ")} · {entry.targetRef}</small></span><span><strong>{entry.outcome}</strong><small>{new Date(entry.occurredAt).toLocaleString("en-IN")} · {entry.entryHash.slice(0, 12)}…</small></span></div>)}{ledgerEntries.length === 0 && <div className="empty-state"><Fingerprint size={25} /><strong>No governance actions recorded</strong><small>The first policy, hold or lifecycle action starts the immutable chain.</small></div>}</div>
        </article>
        {message && <div className="success-banner"><CheckCircle2 size={17} /> {message}</div>}
        {error && <div className="login-error" role="alert">{error}</div>}
    </div>;
}

function RoleAssignmentChangePanel({ role, userEmail, accounts, departments, employees, teamLeadAssignments,
                                       departmentHrAssignments, onChanged }: { role: "CEO" | "HR Admin"; userEmail: string;
    accounts: StaffAccount[]; departments: Department[]; employees: Employee[];
    teamLeadAssignments: TeamLeadAssignment[]; departmentHrAssignments: DepartmentHrAssignment[];
    onChanged: () => Promise<void> }) {
    const [requests, setRequests] = useState<RoleDepartmentChangeRequest[]>(() => {
        if (isBackendConfigured) return [];
        const actor = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
        return readDemoRoleDepartmentChanges().filter((item) => item.status === "PENDING"
            && (role === "CEO" ? item.requesterRole === "HR_ADMIN"
                : item.requesterRole === "TEAM_LEAD" && readDemoDepartmentHrAssignments().some((assignment) =>
                assignment.active && assignment.departmentId === item.targetDepartmentId
                && assignment.hrUserId === (actor?.id ?? "demo-hr-admin"))));
    });
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        if (!isBackendConfigured) return;
        try { setRequests(await brainServeApi.pendingRoleDepartmentChanges()); setError(""); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Role assignment requests could not be loaded."); }
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

    const accountName = (userId: string) => accounts.find((item) => item.userId === userId)?.fullName
        ?? readDemoAccounts().find((item) => item.id === userId)?.fullName;

    const applyDemoApproval = (request: RoleDepartmentChangeRequest,
                               resolution: "MOVE" | "REPLACE" | "SWAP") => {
        const now = new Date().toISOString();
        const actor = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
        const actorId = actor?.id ?? (role === "CEO" ? "demo-ceo" : "demo-hr-admin");
        if (request.requesterRole === "HR_ADMIN") {
            let workforce = readDemoEmployees();
            let allAccounts = readDemoAccounts();
            let current = readDemoDepartmentHrAssignments().find((item) => item.active && item.hrUserId === request.requesterUserId);
            const target = readDemoDepartmentHrAssignments().find((item) => item.active && item.departmentId === request.targetDepartmentId
                && item.hrUserId !== request.requesterUserId);
            let employeeId = current?.hrEmployeeId ?? request.requesterEmployeeId ?? undefined;
            if (!employeeId) {
                const account = allAccounts.find((item) => item.id === request.requesterUserId);
                const department = departments.find((item) => item.id === request.targetDepartmentId);
                employeeId = newClientId();
                const employee: Employee = { id: `BSPL-${department?.code ?? "HR"}-${newClientId().replaceAll("-", "").slice(-4).toUpperCase()}`,
                    uuid: employeeId, departmentId: request.targetDepartmentId, name: request.requesterName,
                    initials: visitorInitials(request.requesterName), role: "HR Admin", department: department?.name ?? "Department",
                    email: request.requesterEmail, status: "Active" };
                workforce = [employee, ...workforce];
                if (account) allAccounts = allAccounts.map((item) => item.id === account.id ? { ...item, employeeId } : item);
            }
            const sourceDepartmentId = current?.departmentId ?? request.fromDepartmentId;
            let assignments = readDemoDepartmentHrAssignments().map((item) => item.active
            && (item.hrUserId === request.requesterUserId || item.departmentId === request.targetDepartmentId)
                ? { ...item, active: false, endedByUserId: actorId, endedAt: now } : item);
            workforce = workforce.map((item) => (item.uuid ?? item.id) === employeeId
                ? { ...item, departmentId: request.targetDepartmentId,
                    department: departments.find((value) => value.id === request.targetDepartmentId)?.name ?? item.department } : item);
            assignments = [{ id: newClientId(), departmentId: request.targetDepartmentId,
                hrUserId: request.requesterUserId, hrEmployeeId: employeeId, active: true,
                assignedByUserId: actorId, assignedAt: now, endedByUserId: null, endedAt: null }, ...assignments];
            if (resolution === "SWAP" && target) {
                if (!sourceDepartmentId) fail("This HR Admin has no source department to swap.");
                workforce = workforce.map((item) => (item.uuid ?? item.id) === target.hrEmployeeId
                    ? { ...item, departmentId: sourceDepartmentId,
                        department: departments.find((value) => value.id === sourceDepartmentId)?.name ?? item.department } : item);
                assignments = [{ id: newClientId(), departmentId: sourceDepartmentId,
                    hrUserId: target.hrUserId, hrEmployeeId: target.hrEmployeeId, active: true,
                    assignedByUserId: actorId, assignedAt: now, endedByUserId: null, endedAt: null }, ...assignments];
            }
            writeDemoEmployees(workforce); writeDemoAccounts(allAccounts); writeDemoDepartmentHrAssignments(assignments);
            current = assignments.find((item) => item.active && item.hrUserId === request.requesterUserId);
            if (!current) fail("The HR assignment could not be updated.");
        } else {
            const current = readDemoTeamLeadAssignments().find((item) => item.active && item.teamLeadUserId === request.requesterUserId);
            if (!current) fail("The Team Lead has no active source assignment.");
            const target = readDemoTeamLeadAssignments().find((item) => item.active
                && item.departmentId === request.targetDepartmentId && item.teamLeadUserId !== request.requesterUserId);
            let assignments = readDemoTeamLeadAssignments().map((item) => item.active
            && (item.teamLeadUserId === request.requesterUserId || item.departmentId === request.targetDepartmentId)
                ? { ...item, active: false, endedByUserId: actorId, endedAt: now } : item);
            let workforce = readDemoEmployees().map((item) => (item.uuid ?? item.id) === current.teamLeadEmployeeId
                ? { ...item, departmentId: request.targetDepartmentId,
                    department: departments.find((value) => value.id === request.targetDepartmentId)?.name ?? item.department } : item);
            assignments = [{ id: newClientId(), departmentId: request.targetDepartmentId,
                teamLeadUserId: request.requesterUserId, teamLeadEmployeeId: current.teamLeadEmployeeId,
                active: true, assignedByUserId: actorId, assignedAt: now, endedByUserId: null, endedAt: null }, ...assignments];
            if (resolution === "SWAP" && target) {
                workforce = workforce.map((item) => (item.uuid ?? item.id) === target.teamLeadEmployeeId
                    ? { ...item, departmentId: current.departmentId,
                        department: departments.find((value) => value.id === current.departmentId)?.name ?? item.department } : item);
                assignments = [{ id: newClientId(), departmentId: current.departmentId,
                    teamLeadUserId: target.teamLeadUserId, teamLeadEmployeeId: target.teamLeadEmployeeId,
                    active: true, assignedByUserId: actorId, assignedAt: now, endedByUserId: null, endedAt: null }, ...assignments];
            } else if (target) {
                const targetEmployee = workforce.find((item) => (item.uuid ?? item.id) === target.teamLeadEmployeeId);
                if (targetEmployee) writeDemoAccounts(readDemoAccounts().map((item) => item.email.toLowerCase() === targetEmployee.email.toLowerCase()
                    ? { ...item, role: "ROLE_EMPLOYEE" } : item));
            }
            writeDemoEmployees(workforce); writeDemoTeamLeadAssignments(assignments);
        }
        return { ...request, status: "APPROVED" as const, resolution, decidedByUserId: actorId,
            decidedAt: now, decisionNote: "Approved through Roles & responsibilities" };
    };

    const decide = async (request: RoleDepartmentChangeRequest, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(request.id); setError(""); setMessage("");
        const data = new FormData(event.currentTarget);
        const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? "approve";
        const note = String(data.get("note") ?? "").trim();
        try {
            let updated: RoleDepartmentChangeRequest;
            if (action === "reject") {
                if (note.length < 5) fail("Enter a rejection reason containing at least 5 characters.");
                updated = isBackendConfigured ? await brainServeApi.rejectRoleDepartmentChange(request.id, note)
                    : { ...request, status: "REJECTED" as const, decisionNote: note,
                        decidedByUserId: role === "CEO" ? "demo-ceo" : "demo-hr-admin", decidedAt: new Date().toISOString() };
            } else {
                const resolution = request.targetOccupied ? String(data.get("resolution")) as "REPLACE" | "SWAP" : "MOVE";
                updated = isBackendConfigured ? await brainServeApi.approveRoleDepartmentChange(request.id, resolution, note)
                    : applyDemoApproval(request, resolution);
            }
            if (!isBackendConfigured) writeDemoRoleDepartmentChanges(readDemoRoleDepartmentChanges()
                .map((item) => item.id === request.id ? updated : item));
            if (!isBackendConfigured) {
                const actor = readDemoAccounts().find((item) => item.email.toLowerCase() === userEmail.toLowerCase());
                const now = new Date().toISOString();
                writeDemoInternalNotifications([{ id: newClientId(), senderUserId: actor?.id ?? userEmail,
                    recipientUserId: request.requesterUserId, senderName: actor?.fullName ?? role,
                    recipientName: request.requesterName,
                    message: `Your ${request.requesterRole === "HR_ADMIN" ? "HR Admin" : "Team Lead"} department change to ${request.targetDepartmentName} was ${updated.status.toLowerCase()}${updated.resolution ? ` using ${updated.resolution.toLowerCase()}` : ""}${updated.decisionNote ? `: ${updated.decisionNote}` : "."}`,
                    priority: "HIGH", category: "ACTION_REQUIRED",
                    conversationKey: `role-department-change:${request.id}`, deliveryStatus: "DELIVERED",
                    sentAt: now, deliveredAt: now, readAt: null, senderEmail: userEmail,
                    recipientEmail: request.requesterEmail }, ...readDemoInternalNotifications()]);
            }
            setRequests((items) => items.filter((item) => item.id !== request.id));
            await onChanged();
            setMessage(`${request.requesterName}’s department change was ${updated.status.toLowerCase()}.`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "The role assignment decision could not be saved."); }
        finally { setBusy(""); }
    };

    const assignments = role === "CEO" ? departmentHrAssignments.filter((item) => item.active)
            .map((item) => ({ id: item.id, userId: item.hrUserId, employeeId: item.hrEmployeeId,
                name: accountName(item.hrUserId) ?? "HR Admin", departmentId: item.departmentId }))
        : teamLeadAssignments.filter((item) => item.active).map((item) => ({ id: item.id,
            userId: item.teamLeadUserId, employeeId: item.teamLeadEmployeeId,
            name: employees.find((employee) => (employee.uuid ?? employee.id) === item.teamLeadEmployeeId)?.name ?? "Team Lead",
            departmentId: item.departmentId }));

    return <article className="panel glass-panel role-assignment-ledger"><div className="panel-heading"><div><span>ROLE ASSIGNMENT LEDGER</span><h2>{role === "CEO" ? "HR details & department ownership" : "Team Lead details & department ownership"}</h2><p>{role === "CEO" ? "Review HR requests, see current department ownership, and resolve occupied departments explicitly." : "Review Team Lead requests addressed to your department and protect one-lead-per-department ownership."}</p></div><UserCog size={23} /></div>
        <div className="role-assignment-directory">{assignments.map((assignment) => { const department = departments.find((item) => item.id === assignment.departmentId); return <div key={assignment.id}><span className="avatar">{visitorInitials(assignment.name)}</span><span><strong>{assignment.name}</strong><small>{department?.name ?? "Department"} · {role === "CEO" ? "HR Admin" : "Team Lead"}</small></span><code>{department?.code ?? "—"}</code><StatusPill status="Active" /></div>; })}{assignments.length === 0 && <div className="empty-state"><Users size={26} /><strong>No active role assignments</strong></div>}</div>
        <div className="assignment-request-heading"><span><strong>Pending change requests</strong><small>Every decision is retained in the audit trail and sent through BrainServe Internal Delivery.</small></span><b>{requests.length}</b></div>
        <div className="assignment-request-list">{requests.map((request) => <form key={request.id} onSubmit={(event) => void decide(request, event)}><header><span className="avatar">{visitorInitials(request.requesterName)}</span><span><strong>{request.requesterName}</strong><small>{request.requesterEmail} · {request.requesterRole.replaceAll("_", " ")}</small></span><span className="status-pill status-pending"><span />Pending</span></header><div className="assignment-route"><span><small>FROM</small><strong>{request.fromDepartmentName ?? "Unassigned"}</strong></span><ArrowRight size={19} /><span><small>TO</small><strong>{request.targetDepartmentName}</strong></span></div><p>{request.reason}</p>{request.targetOccupied && <div className="role-conflict-warning"><ShieldCheck size={17} /><span><strong>Occupied by {request.targetOccupantName ?? "another role owner"}</strong><small>Choose a safe reassignment action before approval.</small></span></div>}<div className="assignment-decision-fields">{request.targetOccupied && <label>Change option<select name="resolution" defaultValue="SWAP"><option value="SWAP">Swap both department assignments</option><option value="REPLACE">Replace current role owner</option></select></label>}<label>Decision note<input name="note" maxLength={500} placeholder="Required when rejecting; optional when approving" /></label></div><div className="assignment-decision-actions"><button className="button button-approve" value="approve" disabled={busy === request.id}><CheckCircle2 size={15} />Approve {request.targetOccupied ? "change" : "move"}</button><button className="button button-reject" value="reject" disabled={busy === request.id}><X size={15} />Reject</button></div></form>)}{requests.length === 0 && <div className="assignment-queue-clear"><CheckCircle2 size={18} /><span><strong>No department changes await your decision</strong><small>New requests will appear here in requested order.</small></span></div>}</div>
        {message && <div className="success-banner"><CheckCircle2 size={17} />{message}</div>}{error && <div className="login-error" role="alert">{error}</div>}
    </article>;
}

function SettingControl({ setting, disabled, onSave }: { setting: WorkspaceSetting; disabled: boolean; onSave: (key: string, value: string) => Promise<void> }) {
    const [value, setValue] = useState(setting.value);
    if (setting.type === "BOOLEAN") return <label className="setting-toggle"><span><strong>{setting.description}</strong><small>{setting.key}</small></span><input type="checkbox" checked={value === "true"} disabled={disabled} onChange={(event) => { const next = String(event.target.checked); setValue(next); void onSave(setting.key, next); }} /><i /></label>;
    return <div className="setting-row"><span><strong>{setting.description}</strong><small>{setting.key}</small></span><input type={setting.type === "INTEGER" ? "number" : "text"} value={value} disabled={disabled} min={setting.type === "INTEGER" ? 0 : undefined} onChange={(event) => setValue(event.target.value)} /><button className="button button-secondary" disabled={disabled || value === setting.value || !value.trim()} onClick={() => void onSave(setting.key, value)}>Save</button></div>;
}

function HrLifecyclePanel() {
    const [accounts, setAccounts] = useState<HrLifecycleAccount[]>([]); const [error, setError] = useState("");
    useEffect(() => { if (!isBackendConfigured) return; let active = true;
        brainServeApi.hrLifecycleAccounts().then((items) => { if (active) setAccounts(items); })
            .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "HR accounts could not be loaded."); });
        return () => { active = false; }; }, []);
    return <article className="panel glass-panel"><div className="panel-heading"><div><span>HR IDENTITY DIRECTORY</span><h2>HR account status</h2><p>Direct deactivation is retired. HR closes their account through My profile, CEO completes business review, and System Admin performs Deactivate &amp; archive in Account lifecycle.</p></div><UserCog size={22} /></div><div className="record-list">{accounts.map((account) => <div key={account.userId}><span><strong>{account.fullName}</strong><small>{account.email}</small></span><code>{account.status.replaceAll("_", " ")}</code><span className={account.enabled ? "closure-status closure-active" : "closure-status closure-rejected"}>{account.enabled ? "ACTIVE" : "INACTIVE"}</span></div>)}{accounts.length === 0 && <div className="empty-state"><UserCog size={28} /><strong>No HR accounts found</strong></div>}</div>{error && <div className="login-error" role="alert">{error}</div>}</article>;
}

function AccountPermissionEditor({ accounts, roles, onUpdate }: { accounts: StaffAccount[]; roles: RoleDefinition[]; onUpdate: (userId: string, grants: string[], denies: string[]) => Promise<void> }) {
    const [selectedId, setSelectedId] = useState(accounts[0]?.userId ?? "");
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const account = accounts.find((item) => item.userId === selectedId) ?? accounts[0];
    const lowerRoles = roles.filter((item) => ["ROLE_TEAM_LEAD", "ROLE_EMPLOYEE", "ROLE_RECEPTIONIST", "ROLE_SECURITY"].includes(item.role));
    const manageable = [...new Set(lowerRoles.flatMap((item) => item.defaultPermissions))].sort();
    const defaults = new Set(roles.find((item) => item.role === account?.roles[0])?.defaultPermissions ?? []);
    const toggle = async (permission: string, enabled: boolean) => {
        if (!account) return;
        const grants = new Set(account.grantedPermissions); const denies = new Set(account.deniedPermissions);
        if (enabled) { denies.delete(permission); if (!defaults.has(permission)) grants.add(permission); }
        else { grants.delete(permission); if (defaults.has(permission)) denies.add(permission); }
        setBusy(permission); setError("");
        try { await onUpdate(account.userId, [...grants], [...denies]); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Permission update failed."); }
        finally { setBusy(""); }
    };
    return <article className="panel glass-panel"><div className="panel-heading"><div><span>INDIVIDUAL OVERRIDES</span><h2>HR-controlled key permissions</h2><p>Approve lower-role accounts in the HR queue, then grant or deny only operational permissions within HR scope.</p></div><ShieldCheck size={22} /></div>{accounts.length ? <><label className="account-select">Managed account<select value={account?.userId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{accounts.map((item) => <option value={item.userId} key={item.userId}>{item.fullName} · {item.roles[0].replace("ROLE_", "")}</option>)}</select></label><div className="permission-check-grid">{manageable.map((permission) => <label key={permission}><input type="checkbox" checked={account?.effectivePermissions.includes(permission) ?? false} disabled={Boolean(busy)} onChange={(event) => void toggle(permission, event.target.checked)} /><span><strong>{permission.replaceAll("_", " ")}</strong><small>{defaults.has(permission) ? "Role default" : "Optional grant"}</small></span></label>)}</div>{error && <div className="login-error" role="alert">{error}</div>}</> : <div className="empty-state"><UserCog size={28} /><strong>No HR-managed accounts</strong><small>Employee, Receptionist and Security accounts appear here after creation.</small></div>}</article>;
}

function StaffAccountRow({ account, onChangeEmail, onResetPassword, onSetEnabled }: {
    account: StaffAccount;
    onChangeEmail: (userId: string, email: string) => Promise<void>;
    onResetPassword: (userId: string, password: string) => Promise<void>;
    onSetEnabled: (userId: string, enabled: boolean) => Promise<void>;
}) {
    const [email, setEmail] = useState(account.email);
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const pending = account.status === "PENDING_APPROVAL" || account.status === "PENDING_HR_APPROVAL";
    const perform = async (action: () => Promise<void>, success: string) => {
        setBusy(true); setMessage("");
        try { await action(); setMessage(success); } catch (reason) { setMessage(reason instanceof ApiError ? reason.message : "Update failed."); }
        finally { setBusy(false); }
    };
    const needsDepartment = account.enabled && account.roles.length === 1 && account.roles[0] === "ROLE_EMPLOYEE" && !account.employeeId;
    return <div className="staff-account-row"><div className="staff-account-head"><span className="role-icon"><UserCog size={18} /></span><span><strong>{account.roles.map((item) => item.replace("ROLE_", "").replaceAll("_", " ")).join(", ")}</strong><small>{account.status.replaceAll("_", " ")}{account.forcePasswordChange ? " · password change required" : ""}{needsDepartment ? " · department assignment required" : ""}</small></span><span className={`status-pill ${pending || needsDepartment ? "status-pending" : account.enabled ? "status-active" : "status-on-leave"}`}><span />{pending ? "Pending approval" : needsDepartment ? "Needs department" : account.enabled ? "Active" : "Disabled"}</span></div><div className="staff-account-controls"><label>Login email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button button-secondary" disabled={busy || email === account.email} onClick={() => void perform(() => onChangeEmail(account.userId, email), "Email updated.")}>Save email</button><label>New temporary password<input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 12 characters" /></label><button className="button button-secondary" disabled={busy || password.length < 12} onClick={() => void perform(() => onResetPassword(account.userId, password), "Password reset.")}>Reset password</button>{!pending && <button className={account.enabled ? "button button-reject" : "button button-approve"} disabled={busy} onClick={() => void perform(() => onSetEnabled(account.userId, !account.enabled), account.enabled ? "Account disabled." : "Account enabled.")}>{account.enabled ? "Disable" : "Enable"}</button>}</div>{pending && <small className="account-message">Use the HR approval queue to activate this account.</small>}{needsDepartment && <small className="account-message">Open Employees and assign this approved login to a department.</small>}{message && <small className="account-message">{message}</small>}</div>;
}

function EmployeeModal({ departments, employees, teamLeadAssignments, account, initialDepartmentId, error, onClose, onSubmit }: {
    departments: Department[]; employees: Employee[]; teamLeadAssignments: TeamLeadAssignment[]; account?: StaffAccount;
    initialDepartmentId?: string; error?: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
    useModalDialog(onClose);
    const joiningDate = nextBusinessDays(1)[0];
    const activeDepartments = useMemo(() => departments.filter((item) => item.active), [departments]);
    const [departmentId, setDepartmentId] = useState(() => {
        if (initialDepartmentId && activeDepartments.some((item) => item.id === initialDepartmentId)) {
            return initialDepartmentId;
        }
        return activeDepartments.length === 1 ? activeDepartments[0].id : "";
    });
    const selectedDepartmentId = activeDepartments.some((item) => item.id === departmentId)
        ? departmentId : activeDepartments.length === 1 ? activeDepartments[0].id : "";
    const activeLeadAssignment = teamLeadAssignments.find((assignment) => assignment.active
        && assignment.departmentId === selectedDepartmentId);
    const departmentTeamLead = employees.find((employee) => (employee.uuid ?? employee.id)
        === activeLeadAssignment?.teamLeadEmployeeId);
    const teamLeadLabel = !selectedDepartmentId ? "Select a department first"
        : departmentTeamLead ? `${departmentTeamLead.name} · Team Lead`
            : activeLeadAssignment ? "Assigned Team Lead"
                : "No Team Lead assigned";
    return <div className="modal-backdrop" role="presentation"><section className="modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title"><header><div><span>{account ? "DEPARTMENT ASSIGNMENT" : "EMPLOYEE ONBOARDING"}</span><h2 id="employee-modal-title">{account ? "Complete approved employee profile" : "Add a new employee"}</h2><p>{account ? "Assign the approved login to a department. BrainServe then links the employee ID to this account." : "The employee ID is generated safely after submission."}</p></div><button className="icon-button" onClick={onClose} aria-label="Close employee form"><X size={19} /></button></header>{account && <div className="approved-account-banner"><BadgeCheck size={18} /><span><strong>Approved Employee login</strong><small>{account.email} · account role remains Employee until an eligible Team Lead promotion</small></span></div>}<form onSubmit={onSubmit}>{error && <div className="login-error" role="alert">{error}</div>}{activeDepartments.length === 0 && <div className="login-error" role="alert">No active department is available for this account. Ask the CEO or System Admin to complete the HR department assignment.</div>}<div className="modal-form-grid"><label>Full name<input name="name" required minLength={2} maxLength={170} defaultValue={account?.fullName ?? ""} placeholder="Employee’s full name" /></label><label>Official email<input name="email" type="email" required readOnly={Boolean(account)} defaultValue={account?.email ?? ""} placeholder="name@brainserve.in" /></label><label>Phone number<input name="phone" placeholder="+91 98765 43210" /></label><label>Department<select name="departmentId" value={selectedDepartmentId} onChange={(event) => setDepartmentId(event.target.value)} required disabled={activeDepartments.length === 0}><option value="">{activeDepartments.length ? "Select a department" : "No active department available"}</option>{activeDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Designation<input name="designation" required placeholder="e.g. Software Engineer" /></label><label>Joining date<input name="joiningDate" type="date" min={joiningDate} defaultValue={joiningDate} required /></label><label>Department Team Lead<input value={teamLeadLabel} readOnly aria-readonly="true" /><small>Resolved automatically from the active Team Lead assignment for this department.</small></label></div><div className="employee-id-preview"><Fingerprint size={21} /><span><small>GENERATED EMPLOYEE ID</small><strong>BSPL-XXXX-####</strong></span><small>Concurrency-safe sequence</small></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={activeDepartments.length === 0 || !selectedDepartmentId}><UserPlus size={17} /> {account ? "Assign department & create ID" : "Create employee"}</button></div></form></section></div>;
}

function PrivacyCentreModal({ onClose }: { onClose: () => void }) {
    useModalDialog(onClose);
    return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="modal glass-panel privacy-centre-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-centre-title">
            <header><div><span>PRIVACY CENTRE</span><h2 id="privacy-centre-title">How BrainServe Connect protects visitor data</h2><p>Operational privacy controls enforced across appointments, QR passes and access records.</p></div><button className="icon-button" onClick={onClose} aria-label="Close privacy centre"><X size={19} /></button></header>
            <div className="privacy-centre-content">
                <article><ShieldCheck size={20} /><span><strong>Purpose-limited collection</strong><small>Visitor identity and contact details are collected only to coordinate, approve and secure the requested visit.</small></span></article>
                <article><LockKeyhole size={20} /><span><strong>Role-scoped access</strong><small>Signed-in roles are locked server-side. Reception, HR, CEO and Security only see actions authorized for their duties.</small></span></article>
                <article><QrCode size={20} /><span><strong>Signed, expiring visitor passes</strong><small>QR content is generated by the backend, signed against tampering and checked against appointment status and validity.</small></span></article>
                <article><FileClock size={20} /><span><strong>Audited retention</strong><small>Privileged changes are recorded, while retention and active consent versions are controlled from workspace settings.</small></span></article>
                <div className="privacy-contact"><MessageSquare size={18} /><span><strong>Questions or a privacy request?</strong><small>Contact the company support address configured in Company profile.</small></span></div>
            </div>
            <footer className="privacy-centre-actions"><button className="button button-primary" onClick={onClose}>I understand</button></footer>
        </section>
    </div>;
}

function SecurityIntakeModal({
                                 appointment,
                                 onClose,
                                 onSubmit,
                             }: {
    appointment: Appointment;
    onClose: () => void;
    onSubmit: (
        id: string,
        input: SecurityIntakeInput,
    ) => Promise<void>;
}) {
    useModalDialog(onClose);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setBusy(true);
        setError("");

        const data = new FormData(event.currentTarget);
        const lastFour = String(
            data.get("identityDocumentLastFour"),
        )
            .trim()
            .toUpperCase();

        try {
            await onSubmit(appointment.id, {
                visitorName: String(
                    data.get("visitorName"),
                ).trim(),
                purpose: String(
                    data.get("purpose"),
                ).trim(),
                identityDocumentType:
                    String(
                        data.get("identityDocumentType"),
                    ).trim() || null,
                identityDocumentLastFour:
                    lastFour || null,
                notes:
                    String(data.get("notes")).trim() ||
                    null,
            });
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "Security intake could not be saved.",
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                className="modal glass-panel visit-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="security-intake-title"
            >
                <header>
                    <div>
                        <span>SECURITY ARRIVAL INTAKE</span>

                        <h2 id="security-intake-title">
                            Record who has arrived
                        </h2>

                        <p>
                            {appointment.referenceNumber ??
                                appointment.id}{" "}
                            · booked for {appointment.host}.
                            Saving this sends Reception a
                            BrainServe Internal Calls update.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="icon-button"
                        onClick={onClose}
                        aria-label="Close security intake"
                    >
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={submit}>
                    <div className="visit-modal-body">
                        <div className="modal-form-grid">
                            <label>
                                Visitor name at gate

                                <input
                                    name="visitorName"
                                    required
                                    minLength={2}
                                    maxLength={170}
                                    defaultValue={
                                        appointment.visitor
                                    }
                                />
                            </label>

                            <label>
                                Identity document

                                <select
                                    name="identityDocumentType"
                                    defaultValue=""
                                >
                                    <option value="">
                                        Not provided
                                    </option>
                                    <option>Passport</option>
                                    <option>Aadhaar</option>
                                    <option>
                                        Driving licence
                                    </option>
                                    <option>Company ID</option>
                                    <option>
                                        Other government ID
                                    </option>
                                </select>
                            </label>

                            <label>
                                Last four characters

                                <input
                                    name="identityDocumentLastFour"
                                    minLength={4}
                                    maxLength={4}
                                    pattern="[A-Za-z0-9]{4}"
                                    placeholder="A123"
                                    autoComplete="off"
                                />
                            </label>

                            <label className="full-field">
                                Purpose confirmed at gate

                                <textarea
                                    name="purpose"
                                    required
                                    minLength={5}
                                    maxLength={1000}
                                    defaultValue={
                                        appointment.purpose
                                    }
                                />
                            </label>

                            <label className="full-field">
                                Security notes

                                <textarea
                                    name="notes"
                                    maxLength={500}
                                    placeholder="Photo identity matched, vehicle number, accessibility assistance…"
                                />
                            </label>
                        </div>

                        {error && (
                            <div
                                className="login-error"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="button button-secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="button button-primary"
                            disabled={busy}
                        >
                            <Send size={17} />

                            {busy
                                ? "Recording…"
                                : "Record & notify Reception"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
function VisitRegistrationModal({
                                    employees,
                                    departments,
                                    securityMode,
                                    onClose,
                                    onSubmit,
                                }: {
    employees: Employee[];
    departments: Department[];
    securityMode: boolean;
    onClose: () => void;
    onSubmit: (input: ReceptionVisitInput) => Promise<void>;
}) {
    useModalDialog(onClose);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [visitType, setVisitType] = useState("Interview");
    const [hostEmployeeId, setHostEmployeeId] = useState("");
    const [routingDepartmentId, setRoutingDepartmentId] = useState("");
    const [requestedEmployeeId, setRequestedEmployeeId] = useState("");
    const [directoryEmployees, setDirectoryEmployees] = useState<Employee[]>([]);
    const [employeeQuery, setEmployeeQuery] = useState("");
    const [employeeDirectoryLoading, setEmployeeDirectoryLoading] =
        useState(false);
    const dates = useMemo(
        () => appointmentDates(8, visitType === "Emergency visit"),
        [visitType],
    );
    const [visitDate, setVisitDate] = useState(
        () => appointmentDates(8, false)[0],
    );
    const [slots, setSlots] = useState<AvailableSlot[]>([]);
    const [slotStart, setSlotStart] = useState("");
    const [loadingSlots, setLoadingSlots] = useState(false);
    const requiredCategory = hostCategoryForVisit(visitType);
    const requiredCategories = hostCategoriesForVisit(visitType);
    const inferredCategory = (employee: Employee): PublicHost["category"] => {
        if (employee.hostCategory) return employee.hostCategory;
        const searchable = `${employee.role} ${employee.department}`.toLowerCase();
        return searchable.includes("chief executive") ||
        searchable.includes("executive office")
            ? "CEO"
            : searchable.includes("human resources") ||
            /(^|\s)hr(\s|$)/.test(searchable)
                ? "HR"
                : searchable.includes("team lead") ||
                /(^|\s)lead(\s|$)/.test(searchable)
                    ? "TEAM_LEAD"
                    : "EMPLOYEE";
    };
    const eligibleEmployees = useMemo(
        () =>
            employees.filter((employee) => {
                if (employee.status !== "Active") return false;
                if (!requiredCategories.includes(inferredCategory(employee)))
                    return false;
                return (
                    !routingDepartmentId ||
                    inferredCategory(employee) === "CEO" ||
                    employee.departmentId === routingDepartmentId
                );
            }),
        [employees, requiredCategories, routingDepartmentId],
    );
    // The CEO-managed department directory is the source of truth. A department must remain visible
    // even before an HR/Team Lead is assigned; host eligibility is validated independently below.
    const departmentOptions = useMemo(
        () =>
            departments
                .filter((department) => department.active)
                .sort((left, right) => left.name.localeCompare(right.name)),
        [departments],
    );
    const loadDepartmentEmployees = useCallback(
        async (query = "") => {
            if (!routingDepartmentId) {
                setDirectoryEmployees([]);
                return;
            }
            setEmployeeDirectoryLoading(true);
            try {
                const department = departments.find(
                    (item) => item.id === routingDepartmentId,
                );
                const next = isBackendConfigured
                    ? (
                        await brainServeApi.publicEmployees(routingDepartmentId, query)
                    ).content.map((employee) => ({
                        id: employee.id,
                        uuid: employee.id,
                        departmentId: employee.departmentId,
                        name: employee.displayName,
                        initials: visitorInitials(employee.displayName),
                        role: employee.designation,
                        department: department?.name ?? "Department",
                        email: "",
                        status: "Active" as const,
                        hostCategory: "EMPLOYEE" as const,
                    }))
                    : employees
                        .filter(
                            (employee) =>
                                employee.status === "Active" &&
                                employee.departmentId === routingDepartmentId &&
                                inferredCategory(employee) === "EMPLOYEE" &&
                                (!query ||
                                    `${employee.name} ${employee.id}`
                                        .toLowerCase()
                                        .includes(query.toLowerCase())),
                        )
                        .slice(0, 25);
                setDirectoryEmployees(next);
                setRequestedEmployeeId((current) =>
                    next.some((item) => (item.uuid ?? item.id) === current)
                        ? current
                        : "",
                );
            } catch (reason) {
                setDirectoryEmployees([]);
                setError(
                    reason instanceof Error
                        ? reason.message
                        : "The department employee directory could not be loaded.",
                );
            } finally {
                setEmployeeDirectoryLoading(false);
            }
        },
        [departments, employees, routingDepartmentId],
    );

    useEffect(() => {
        if (visitType !== "Employee meeting" || !routingDepartmentId) return;
        const timer = window.setTimeout(() => void loadDepartmentEmployees(), 0);
        return () => window.clearTimeout(timer);
    }, [loadDepartmentEmployees, routingDepartmentId, visitType]);

    useEffect(() => {
        if (!hostEmployeeId || !visitDate) return;
        let active = true;
        const load = async () => {
            try {
                const result = isBackendConfigured
                    ? await brainServeApi.availableSlots(
                        hostEmployeeId,
                        visitDate,
                        appointmentTypeCode(visitType),
                    )
                    : fallbackSlots(visitDate);
                if (!active) return;
                setSlots(result);
                setSlotStart(result[0]?.start ?? "");
            } catch (reason) {
                if (active) {
                    setSlots([]);
                    setSlotStart("");
                    setError(
                        reason instanceof ApiError
                            ? reason.message
                            : "Available appointment times could not be loaded.",
                    );
                }
            } finally {
                if (active) setLoadingSlots(false);
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [hostEmployeeId, visitDate, visitType]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(event.currentTarget);
        const selectedSlot = slots.find((slot) => slot.start === slotStart);
        const selectedHost = eligibleEmployees.find(
            (employee) => (employee.uuid ?? employee.id) === hostEmployeeId,
        );
        if (!selectedHost || !selectedSlot) {
            setBusy(false);
            setError("Select an eligible host and an available future time.");
            return;
        }
        try {
            await onSubmit({
                visitorName: String(data.get("visitorName")),
                visitorEmail: String(data.get("visitorEmail")),
                visitorPhone: String(data.get("visitorPhone")),
                visitorCompany: String(data.get("visitorCompany")),
                visitType,
                hostEmployeeId,
                hostCategory: inferredCategory(selectedHost),
                routingDepartmentId,
                requestedEmployeeId:
                    visitType === "Employee meeting" ? requestedEmployeeId : null,
                slotStart: selectedSlot.start,
                slotEnd: selectedSlot.end,
                purpose: String(data.get("purpose")),
                identityDocumentType: securityMode
                    ? String(data.get("identityDocumentType") || "") || null
                    : null,
                identityDocumentLastFour: securityMode
                    ? String(data.get("identityDocumentLastFour") || "") || null
                    : null,
                notes: securityMode ? String(data.get("notes") || "") || null : null,
            });
        } catch (reason) {
            setError(
                reason instanceof ApiError
                    ? reason.message
                    : "The visit could not be submitted.",
            );
        } finally {
            setBusy(false);
        }
    };
    const selectedHost = eligibleEmployees.find(
        (employee) => (employee.uuid ?? employee.id) === hostEmployeeId,
    );
    const ceoApprovalRoute =
        visitType === "CEO visit" ||
        (visitType === "Emergency visit" &&
            Boolean(selectedHost && inferredCategory(selectedHost) === "CEO"));
    return (
        <div className="modal-backdrop" role="presentation">
            <section
                className="modal glass-panel visit-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="visit-modal-title"
            >
                <header>
                    <div>
            <span>
              {securityMode ? "SECURITY WALK-IN" : "VISITOR REGISTRATION"}
            </span>
                        <h2 id="visit-modal-title">
                            {securityMode
                                ? "Create walk-in appointment"
                                : "Register interview or meeting"}
                        </h2>
                        <p>
                            {securityMode
                                ? "Capture the visitor and identity details, then notify Reception for verification."
                                : "After contact verification, Security records arrival and Reception routes the approval."}
                        </p>
                    </div>
                    <button
                        className="icon-button"
                        onClick={onClose}
                        aria-label="Close visitor form"
                    >
                        <X size={19} />
                    </button>
                </header>
                <form onSubmit={submit}>
                    <div className="visit-modal-body">
                        <div className="modal-form-grid">
                        <label>
                            Visitor name
                            <input
                                name="visitorName"
                                required
                                minLength={2}
                                maxLength={170}
                                placeholder="Full name"
                            />
                        </label>
                        <label>
                            Company
                            <input
                                name="visitorCompany"
                                maxLength={170}
                                placeholder="Company or Independent"
                            />
                        </label>
                        <label>
                            Visitor email
                            <input
                                name="visitorEmail"
                                type="email"
                                required
                                placeholder="visitor@example.com"
                            />
                        </label>
                        <label>
                            Mobile number
                            <input
                                name="visitorPhone"
                                required
                                minLength={8}
                                maxLength={32}
                                placeholder="+91 98765 43210"
                            />
                        </label>
                        <label>
                            Visit type
                            <select
                                value={visitType}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setVisitType(next);
                                    setRoutingDepartmentId("");
                                    setRequestedEmployeeId("");
                                    setDirectoryEmployees([]);
                                    setEmployeeQuery("");
                                    setHostEmployeeId("");
                                    setVisitDate(
                                        appointmentDates(8, next === "Emergency visit")[0],
                                    );
                                    setSlots([]);
                                    setSlotStart("");
                                    setLoadingSlots(false);
                                    setError("");
                                }}
                            >
                                <option>Interview</option>
                                <option>Emergency visit</option>
                                <option>Employee meeting</option>
                                <option>HR visit</option>
                                <option>CEO visit</option>
                                <option>Client meeting</option>
                            </select>
                        </label>
                        <label>
                            Routing department
                            <select
                                value={routingDepartmentId}
                                onChange={(event) => {
                                    setRoutingDepartmentId(event.target.value);
                                    setRequestedEmployeeId("");
                                    setDirectoryEmployees([]);
                                    setEmployeeQuery("");
                                    setHostEmployeeId("");
                                    setSlots([]);
                                    setSlotStart("");
                                }}
                                required
                            >
                                <option value="">Select department</option>
                                {departmentOptions.map((department) => (
                                    <option value={department.id} key={department.id}>
                                        {department.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {visitType === "Employee meeting" && (
                            <>
                                <label>
                                    Find employee
                                    <div className="directory-search-row">
                                        <input
                                            value={employeeQuery}
                                            onChange={(event) => setEmployeeQuery(event.target.value)}
                                            placeholder="Name or employee ID"
                                        />
                                        <button
                                            type="button"
                                            className="button button-secondary"
                                            disabled={
                                                employeeDirectoryLoading || !routingDepartmentId
                                            }
                                            onClick={() =>
                                                void loadDepartmentEmployees(employeeQuery)
                                            }
                                        >
                                            <Search size={15} />
                                            {employeeDirectoryLoading ? "Searching…" : "Search"}
                                        </button>
                                    </div>
                                </label>
                                <label>
                                    Employee to meet
                                    <select
                                        value={requestedEmployeeId}
                                        onChange={(event) =>
                                            setRequestedEmployeeId(event.target.value)
                                        }
                                        required
                                        disabled={employeeDirectoryLoading}
                                    >
                                        <option value="">
                                            {employeeDirectoryLoading
                                                ? "Loading department employees…"
                                                : "Select department employee"}
                                        </option>
                                        {directoryEmployees.map((employee) => (
                                            <option
                                                value={employee.uuid ?? employee.id}
                                                key={employee.uuid ?? employee.id}
                                            >
                                                {employee.name} · {employee.role}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </>
                        )}
                        <label>
                            Eligible host
                            <select
                                value={hostEmployeeId}
                                onChange={(event) => {
                                    setHostEmployeeId(event.target.value);
                                    setSlots([]);
                                    setSlotStart("");
                                    setLoadingSlots(Boolean(event.target.value));
                                    setError("");
                                }}
                                required
                            >
                                <option value="">
                                    {eligibleEmployees.length
                                        ? "Select an eligible active host"
                                        : `No assigned ${requiredCategory ?? "CEO or HR"} host available`}
                                </option>
                                {eligibleEmployees.map((employee) => (
                                    <option
                                        value={employee.uuid ?? employee.id}
                                        key={employee.uuid ?? employee.id}
                                    >
                                        {employee.name} · {employee.role} · {employee.department}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Appointment date
                            <select
                                value={visitDate}
                                onChange={(event) => {
                                    setVisitDate(event.target.value);
                                    setSlots([]);
                                    setSlotStart("");
                                    setLoadingSlots(Boolean(hostEmployeeId));
                                    setError("");
                                }}
                            >
                                {dates.map((date) => (
                                    <option key={date} value={date}>
                                        {date === officeToday() ? "Today · " : ""}
                                        {formatOfficeDate(officeDateTimeToIso(date, "12:00"))}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Available time
                            <select
                                value={slotStart}
                                onChange={(event) => setSlotStart(event.target.value)}
                                required
                                disabled={loadingSlots || !hostEmployeeId}
                            >
                                <option value="">
                                    {loadingSlots
                                        ? "Loading availability…"
                                        : slots.length
                                            ? "Select a time"
                                            : "No future slots available"}
                                </option>
                                {slots.map((slot) => (
                                    <option key={slot.start} value={slot.start}>
                                        {formatOfficeTime(slot.start)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {securityMode && (
                            <>
                                <label>
                                    Identity document
                                    <select name="identityDocumentType" defaultValue="AADHAAR">
                                        <option value="AADHAAR">Aadhaar</option>
                                        <option value="PASSPORT">Passport</option>
                                        <option value="DRIVING_LICENCE">Driving licence</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </label>
                                <label>
                                    Document last four
                                    <input
                                        name="identityDocumentLastFour"
                                        pattern="[A-Za-z0-9]{4}"
                                        minLength={4}
                                        maxLength={4}
                                        placeholder="1234"
                                        required
                                    />
                                </label>
                                <label className="full-field">
                                    Security notes
                                    <textarea
                                        name="notes"
                                        maxLength={500}
                                        placeholder="Identity matched, items carried, or other arrival notes"
                                    />
                                </label>
                            </>
                        )}
                        <label className="full-field">
                            Purpose
                            <textarea
                                name="purpose"
                                required
                                minLength={5}
                                maxLength={1000}
                                placeholder="Reason for interview or meeting"
                            />
                        </label>
                    </div>
                    <div className="approval-chain">
            <span>
              <IdCard size={16} /> Security intake
            </span>
                        <i />
                        <span>
              <BadgeCheck size={16} /> Reception verify
            </span>
                        <i />
                        <span>
              <UserCog size={16} />{" "}
                            {ceoApprovalRoute ? "Department Manager" : "Department HR"}
            </span>
                        {ceoApprovalRoute && (
                            <>
                                <i />
                                <span>
                  <ShieldCheck size={16} /> CEO final approval
                </span>
                            </>
                        )}
                    </div>
                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="button button-secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            className="button button-primary"
                            disabled={busy || loadingSlots || !slotStart}
                        >
                            <ArrowRight size={17} />{" "}
                            {busy
                                ? "Submitting…"
                                : securityMode
                                    ? "Create & notify Reception"
                                    : "Submit visit"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export function BrainServeApp({ browserPreviewEnabled = false }: {
    browserPreviewEnabled?: boolean;
}) {
    if (!isBackendConfigured && !browserPreviewEnabled) {
        return (
            <main className="login-page">
                <section className="login-card glass-panel" role="alert">
                    <div className="login-card-head">
                        <span className="avatar large">BS</span>
                        <div>
                            <small>BRAINSERVE CONNECT</small>
                            <h2>Service temporarily unavailable</h2>
                            <p>
                                Secure sign-in requires the BrainServe backend. Preview authentication and
                                browser-stored accounts are disabled.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        );
    }
    return <BackendBrainServeApp browserPreviewEnabled={browserPreviewEnabled} />;
}

export default BrainServeApp;

function BackendBrainServeApp({ browserPreviewEnabled = false }: {
    browserPreviewEnabled?: boolean;
}) {
    const [screen, setScreen] = useState<Screen>("welcome");
    const [role, setRole] = useState<Role | null>(() => isBackendConfigured ? null : "HR Admin");
    const [userEmail, setUserEmail] = useState(() => isBackendConfigured ? "" : "hr.admin@brainserve.in");
    const [restoringSession, setRestoringSession] = useState(true);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [sessionMessage, setSessionMessage] = useState("");
    useEffect(
        () =>
            onAuthSessionExpired(() => {
                writePreviewWorkspaceSession(null);
                setMustChangePassword(false);
                setCurrentPassword("");
                setSessionMessage(
                    "Your login changed, expired or was revoked. Sign in again to load the current role and permissions.",
                );
                setScreen("login");
            }),
        [],
    );
    useEffect(() => {
        let active = true;
        const restore = async () => {
            if (isBackendConfigured && hasAuthSession()) {
                try {
                    const profile = await brainServeApi.me();
                    if (!active) return;
                    const restoredRole = primaryRoleFromAuthorities(profile.roles);
                    if (!restoredRole) fail("Unsupported role");
                    setRole(restoredRole);
                    setUserEmail(profile.email);
                    setMustChangePassword(profile.forcePasswordChange);
                    setScreen("app");
                } catch {
                    setAccessToken(null);
                    if (active) setScreen("login");
                }
            } else if (!isBackendConfigured) {
                const previewSession = readPreviewWorkspaceSession();
                if (active && previewSession) {
                    const currentAccount = readDemoAccounts().find((account) =>
                        account.status === "ACTIVE"
                        && account.email.toLowerCase() === previewSession.email.toLowerCase()
                        && roleFromAuthority(account.role) === previewSession.role);
                    if (currentAccount) {
                        setRole(previewSession.role);
                        setUserEmail(currentAccount.email);
                        setScreen("app");
                    } else {
                        writePreviewWorkspaceSession(null);
                        setSessionMessage("This account is no longer active or its role changed. Sign in again.");
                        setScreen("login");
                    }
                }
            }
            if (active) setRestoringSession(false);
        };
        void restore();
        return () => {
            active = false;
        };
    }, []);
    if (restoringSession)
        return (
            <main className="login-page">
                <section className="login-card glass-panel">
                    <div className="login-card-head">
                        <span className="avatar large">BS</span>
                        <div>
                            <small>BRAINSERVE CONNECT</small>
                            <h2>Restoring your session…</h2>
                            <p>Verifying your current role and permissions.</p>
                        </div>
                    </div>
                </section>
            </main>
        );
    if (mustChangePassword)
        return (
            <ForcedPasswordChange
                email={userEmail}
                currentPassword={currentPassword}
                onComplete={() => {
                    setAccessToken(null);
                    writePreviewWorkspaceSession(null);
                    setMustChangePassword(false);
                    setCurrentPassword("");
                    setScreen("login");
                }}
                onLogout={() => {
                    setAccessToken(null);
                    writePreviewWorkspaceSession(null);
                    setMustChangePassword(false);
                    setCurrentPassword("");
                    setScreen("login");
                }}
            />
        );
    if (screen === "welcome") return <Welcome onNavigate={setScreen} />;
    if (screen === "book") return <BookingFlow onNavigate={setScreen} />;
    if (screen === "track") return <TrackAppointment onNavigate={setScreen} />;
    if (screen === "register")
        return <AccountRegistration onNavigate={setScreen} />;
    if (screen === "forgot-password")
        return <AccountRecovery type="PASSWORD" onNavigate={setScreen} />;
    if (screen === "forgot-email")
        return <AccountRecovery type="EMAIL" onNavigate={setScreen} />;
    if (screen === "login" || !role || !userEmail)
        return (
            <Login
                browserPreviewEnabled={browserPreviewEnabled}
                sessionMessage={sessionMessage}
                onLogin={(nextRole, email, forcePasswordChange, password) => {
                    setSessionMessage("");
                    if (!isBackendConfigured && !forcePasswordChange)
                        writePreviewWorkspaceSession({ role: nextRole, email });
                    else writePreviewWorkspaceSession(null);
                    setRole(nextRole);
                    setUserEmail(email);
                    setMustChangePassword(forcePasswordChange);
                    setCurrentPassword(forcePasswordChange ? password : "");
                    setScreen("app");
                }}
                onNavigate={setScreen}
            />
        );
    return (
        <DashboardApp
            role={role}
            userEmail={userEmail}
            onLogout={async () => {
                try {
                    await brainServeApi.logout();
                } finally {
                    writePreviewWorkspaceSession(null);
                    setScreen("welcome");
                }
            }}
        />
    );
}
