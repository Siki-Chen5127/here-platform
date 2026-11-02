import os
import re
import tempfile
from unittest.mock import patch

os.environ["HERE_ENVIRONMENT"] = "test"
os.environ["HERE_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["HERE_JWT_SECRET"] = "test-secret-that-is-long-enough-for-api-tests"
os.environ["HERE_AUTO_CREATE_SCHEMA"] = "true"
os.environ["HERE_BOOTSTRAP_ADMIN"] = "true"
os.environ["HERE_BOOTSTRAP_ADMIN_PASSWORD"] = "ChangeMe123!"
os.environ["HERE_UPLOAD_DIR"] = tempfile.mkdtemp(prefix="here-api-test-uploads-")

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import (
    ConsultationAssignment,
    StaffProfile,
    StaffUser,
    StudentProfile,
    StudentUser,
    WorkOrder,
)
from app.security import hash_password, hash_password_reset_token, verify_password


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("StrongPass123!")
    second = hash_password("StrongPass123!")

    assert first != second
    assert verify_password("StrongPass123!", first)
    assert not verify_password("wrong-password", first)


def test_staff_and_mobile_end_to_end_flow():
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["database"] == "sqlite"

        unauthorized = client.get("/api/v1/workorders")
        assert unauthorized.status_code == 401

        with SessionLocal() as session:
            routing_counselor = StaffUser(
                email="routing-counselor@here.edu",
                password_hash=hash_password("Routing123!"),
                name="分派辅导员",
                role="counselor",
                department="学生工作部",
            )
            session.add(routing_counselor)
            session.flush()
            session.add(
                StaffProfile(
                    staff_user_id=routing_counselor.id,
                    real_name="分派辅导员",
                    display_name="分派辅导员",
                    phone="13700000000",
                    organization="测试大学",
                    department="学生工作部",
                    college="信息学院",
                    employee_number="ROUTE001",
                )
            )
            session.commit()
            routing_counselor_id = routing_counselor.id

        colleges = client.get("/api/v1/auth/mobile/registration-colleges")
        assert colleges.status_code == 200
        assert colleges.json() == {"colleges": ["信息学院"]}

        registration = client.post(
            "/api/v1/auth/mobile/register",
            json={
                "phone": "13800000000",
                "password": "StudentPass123!",
                "display_name": "测试学生",
                "college": "信息学院",
            },
        )
        assert registration.status_code == 201
        student_token = registration.json()["access_token"]
        student_id = registration.json()["user"]["id"]

        second_registration = client.post(
            "/api/v1/auth/mobile/register",
            json={
                "phone": "13800000001",
                "password": "StudentPass123!",
                "display_name": "第二名学生",
                "college": "信息学院",
            },
        )
        assert second_registration.status_code == 201
        with SessionLocal() as session:
            profiles_without_number = list(
                session.scalars(
                    select(StudentProfile).where(StudentProfile.student_number.is_(None))
                )
            )
            assert len(profiles_without_number) == 2

        alert = client.post(
            "/api/v1/mobile/alerts",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "client_event_id": "mobile-alert-001",
                "category": "sos",
                "severity": "critical",
                "description": "移动端测试预警",
                "latitude": 31.2304,
                "longitude": 121.4737,
            },
        )
        assert alert.status_code == 201
        work_order_id = alert.json()["work_order_id"]
        assert re.fullmatch(r"WO-\d{8}-\d{6}", alert.json()["work_order_number"])
        assert alert.json()["assigned_counselor_id"] == routing_counselor_id

        duplicate = client.post(
            "/api/v1/mobile/alerts",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "client_event_id": "mobile-alert-001",
                "category": "sos",
                "severity": "critical",
            },
        )
        assert duplicate.status_code == 201
        assert duplicate.json()["status"] == "duplicate"

        staff_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "admin@here.edu", "password": "ChangeMe123!"},
        )
        assert staff_login.status_code == 200
        staff_token = staff_login.json()["access_token"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        admin_dashboard = client.get("/api/v1/dashboard", headers=staff_headers)
        assert admin_dashboard.status_code == 200
        assert admin_dashboard.json()["role"] == "admin"

        admin_work_orders = client.get("/api/v1/workorders", headers=staff_headers)
        assert admin_work_orders.status_code == 403

        counselor_created = client.post(
            "/api/v1/admin/staff",
            headers=staff_headers,
            json={
                "email": "counselor@here.edu",
                "password": "Counselor123!",
                "name": "测试辅导员",
                "role": "counselor",
                "department": "信息学院",
            },
        )
        assert counselor_created.status_code == 201

        psychologist_created = client.post(
            "/api/v1/admin/staff",
            headers=staff_headers,
            json={
                "email": "psychologist@here.edu",
                "password": "Psychologist123!",
                "name": "测试咨询师",
                "role": "psychologist",
                "department": "心理健康教育中心",
            },
        )
        assert psychologist_created.status_code == 201

        director_created = client.post(
            "/api/v1/admin/staff",
            headers=staff_headers,
            json={
                "email": "director@here.edu",
                "password": "Director123!",
                "name": "测试中心负责人",
                "role": "center_director",
                "department": "心理健康教育中心",
            },
        )
        assert director_created.status_code == 201

        with SessionLocal() as session:
            counselor = session.scalar(
                select(StaffUser).where(StaffUser.email == "counselor@here.edu")
            )
            student = session.get(StudentUser, student_id)
            work_order = session.get(WorkOrder, work_order_id)
            profile = session.scalar(
                select(StudentProfile).where(StudentProfile.student_id == student.id)
            )
            assert profile is not None
            assert profile.college == "信息学院"
            assert profile.counselor_id == routing_counselor_id
            profile.student_number = "20260001"
            profile.major = "计算机科学与技术"
            profile.class_name = "计科2601"
            profile.counselor_id = counselor.id
            work_order.assignee_id = counselor.id
            session.commit()

        counselor_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "counselor@here.edu", "password": "Counselor123!"},
        )
        assert counselor_login.status_code == 200
        counselor_headers = {
            "Authorization": f"Bearer {counselor_login.json()['access_token']}"
        }

        students = client.get("/api/v1/students", headers=counselor_headers)
        assert students.status_code == 200
        assert students.json()[0]["studentNumber"] == "20260001"

        work_orders = client.get("/api/v1/workorders", headers=counselor_headers)
        assert work_orders.status_code == 200
        assert work_orders.json()[0]["id"] == work_order_id
        assert work_orders.json()[0]["number"] == alert.json()["work_order_number"]
        assert work_orders.json()[0]["student"] == "测试学生"
        assert work_orders.json()[0]["studentPhone"] == "13800000000"

        summary = client.get("/api/v1/workorders/summary", headers=counselor_headers)
        assert summary.status_code == 200
        assert summary.json()["pending"] == 1

        available_psychologists = client.get(
            "/api/v1/staff/psychologists",
            headers=counselor_headers,
        )
        assert available_psychologists.status_code == 200
        psychologist_id = available_psychologists.json()[0]["id"]
        assert available_psychologists.json()[0]["name"] == "测试咨询师"

        referred = client.post(
            f"/api/v1/workorders/{work_order_id}/refer",
            headers=counselor_headers,
            json={
                "psychologist_id": psychologist_id,
                "basis": "student_consent",
                "note": "已完成电话确认，请进一步开展专业评估",
            },
        )
        assert referred.status_code == 200
        assert referred.json()["psychologistId"] == psychologist_id

        summary = client.get("/api/v1/workorders/summary", headers=counselor_headers)
        assert summary.status_code == 200
        assert summary.json()["pending"] == 0

        archives = client.get("/api/v1/intervention-archives", headers=counselor_headers)
        assert archives.status_code == 200
        assert archives.json() == []

        forbidden_audit = client.get("/api/v1/audit-logs", headers=counselor_headers)
        assert forbidden_audit.status_code == 403

        draft = client.post(
            "/api/v1/knowledge/submissions",
            headers=counselor_headers,
            data={
                "name": "学生危机上报流程",
                "category": "工作流程",
                "domain": "psychology",
                "description": "辅导员提交的测试资料",
                "source_url": "https://example.edu/policy",
            },
            files={"file": ("workflow.txt", b"test content", "text/plain")},
        )
        assert draft.status_code == 201
        document_id = draft.json()["id"]
        assert draft.json()["status"] == "draft"

        updated_draft = client.patch(
            f"/api/v1/knowledge/submissions/{document_id}",
            headers=counselor_headers,
            json={
                "name": "学生危机上报与转介流程",
                "category": "工作流程",
                "domain": "psychology",
                "description": "更新后的测试资料",
                "source_url": "https://example.edu/policy",
            },
        )
        assert updated_draft.status_code == 200

        submitted = client.post(
            f"/api/v1/knowledge/submissions/{document_id}/submit",
            headers=counselor_headers,
        )
        assert submitted.status_code == 200
        assert submitted.json()["status"] == "submitted"

        locked_after_submit = client.patch(
            f"/api/v1/knowledge/submissions/{document_id}",
            headers=counselor_headers,
            json={
                "name": "不能修改",
                "category": "工作流程",
                "domain": "psychology",
            },
        )
        assert locked_after_submit.status_code == 409

        psychologist_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "psychologist@here.edu", "password": "Psychologist123!"},
        )
        assert psychologist_login.status_code == 200
        psychologist_headers = {
            "Authorization": f"Bearer {psychologist_login.json()['access_token']}"
        }

        counselor_tracks_referral = client.get(
            "/api/v1/workorders",
            headers=counselor_headers,
        )
        assert counselor_tracks_referral.status_code == 200
        assert counselor_tracks_referral.json()[0]["status"] == "referred"
        assert counselor_tracks_referral.json()[0]["assigneeName"] == "测试咨询师"

        psychologist_work_orders = client.get(
            "/api/v1/workorders",
            headers=psychologist_headers,
        )
        assert psychologist_work_orders.status_code == 200
        assert psychologist_work_orders.json()[0]["id"] == work_order_id
        assert psychologist_work_orders.json()[0]["status"] == "referred"
        assert psychologist_work_orders.json()[0]["studentPhone"] == "13800000000"

        resolved = client.post(
            f"/api/v1/workorders/{work_order_id}/resolve",
            headers=psychologist_headers,
            json={"note": "已完成专业评估并建立后续服务计划"},
        )
        assert resolved.status_code == 200
        psychologist_summary = client.get(
            "/api/v1/workorders/summary",
            headers=psychologist_headers,
        )
        assert psychologist_summary.status_code == 200
        assert psychologist_summary.json()["pending"] == 0

        consultations = client.get("/api/v1/consultations", headers=psychologist_headers)
        assert consultations.status_code == 200
        assert consultations.json()[0]["student"] == "测试学生"
        assert consultations.json()[0]["phone"] == "13800000000"
        assert consultations.json()[0]["status"] == "completed"

        counselor_completed_orders = client.get(
            "/api/v1/workorders", headers=counselor_headers
        )
        assert counselor_completed_orders.json()[0]["status"] == "resolved"
        archives = client.get("/api/v1/intervention-archives", headers=counselor_headers)
        assert archives.status_code == 200
        assert archives.json()[0]["actionType"] == "resolve"
        assert archives.json()[0]["staff"] == "测试咨询师"
        assert archives.json()[0]["workOrderNumber"] == alert.json()["work_order_number"]

        psychologist_students = client.get("/api/v1/students", headers=psychologist_headers)
        assert psychologist_students.status_code == 403

        psychologist_submissions = client.get(
            "/api/v1/knowledge/submissions",
            headers=psychologist_headers,
        )
        assert psychologist_submissions.status_code == 200
        assert psychologist_submissions.json() == []

        director_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "director@here.edu", "password": "Director123!"},
        )
        assert director_login.status_code == 200
        director_headers = {
            "Authorization": f"Bearer {director_login.json()['access_token']}"
        }

        pending_reviews = client.get(
            "/api/v1/knowledge/submissions",
            headers=director_headers,
        )
        assert pending_reviews.status_code == 200
        assert pending_reviews.json()[0]["id"] == document_id

        approved = client.post(
            f"/api/v1/knowledge/submissions/{document_id}/review",
            headers=director_headers,
            json={"action": "approve", "note": "内容与来源符合发布要求"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        published = client.post(
            f"/api/v1/knowledge/submissions/{document_id}/publish",
            headers=director_headers,
        )
        assert published.status_code == 200
        assert published.json()["status"] == "published"
        assert published.json()["graphStatus"] == "queued"

        administrative_draft = client.post(
            "/api/v1/knowledge/submissions",
            headers=counselor_headers,
            data={
                "name": "学生请假管理规定",
                "category": "学生工作制度",
                "domain": "student_affairs",
            },
            files={"file": ("leave-policy.txt", b"policy", "text/plain")},
        )
        assert administrative_draft.status_code == 201
        administrative_id = administrative_draft.json()["id"]
        administrative_submitted = client.post(
            f"/api/v1/knowledge/submissions/{administrative_id}/submit",
            headers=counselor_headers,
        )
        assert administrative_submitted.status_code == 200
        director_cannot_review_administrative = client.post(
            f"/api/v1/knowledge/submissions/{administrative_id}/review",
            headers=director_headers,
            json={"action": "approve"},
        )
        assert director_cannot_review_administrative.status_code == 403

        admin_pending_reviews = client.get(
            "/api/v1/knowledge/submissions",
            headers=staff_headers,
        )
        assert admin_pending_reviews.status_code == 200
        assert administrative_id in {item["id"] for item in admin_pending_reviews.json()}
        admin_approved_administrative = client.post(
            f"/api/v1/knowledge/submissions/{administrative_id}/review",
            headers=staff_headers,
            json={"action": "approve", "note": "学生工作政策内容有效"},
        )
        assert admin_approved_administrative.status_code == 200
        assert admin_approved_administrative.json()["status"] == "approved"

        review_summary = client.get("/api/v1/admin/review-summary", headers=staff_headers)
        assert review_summary.status_code == 200
        assert set(review_summary.json()) == {
            "staffApplications",
            "knowledgeSubmissions",
            "total",
        }

        admin_legacy_upload = client.post(
            "/api/v1/knowledge/upload",
            headers=staff_headers,
        )
        assert admin_legacy_upload.status_code == 410

        published_library = client.get(
            "/api/v1/knowledge/published",
            headers=staff_headers,
        )
        assert published_library.status_code == 200
        assert published_library.json()[0]["id"] == document_id

        counselor_cannot_manage_library = client.get(
            "/api/v1/knowledge/admin/documents",
            headers=counselor_headers,
        )
        assert counselor_cannot_manage_library.status_code == 403
        counselor_cannot_batch_library = client.post(
            "/api/v1/knowledge/admin/documents/batch",
            headers=counselor_headers,
            json={"document_ids": [document_id], "action": "archive"},
        )
        assert counselor_cannot_batch_library.status_code == 403

        admin_document = client.post(
            "/api/v1/knowledge/admin/documents",
            headers=staff_headers,
            data={
                "name": "管理员导入指南.pdf",
                "category": "危机干预指南",
                "description": "管理员知识库管理测试",
            },
            files={"file": ("guide.pdf", b"%PDF-1.4 admin", "application/pdf")},
        )
        assert admin_document.status_code == 201
        admin_document_id = admin_document.json()["id"]
        assert admin_document.json()["status"] == "published"

        admin_document_updated = client.patch(
            f"/api/v1/knowledge/admin/documents/{admin_document_id}",
            headers=staff_headers,
            json={
                "name": "管理员导入指南（修订）.pdf",
                "category": "危机干预指南",
                "description": "已修改资料说明",
            },
        )
        assert admin_document_updated.status_code == 200

        admin_document_replaced = client.put(
            f"/api/v1/knowledge/admin/documents/{admin_document_id}/file",
            headers=staff_headers,
            files={"file": ("guide-v2.pdf", b"%PDF-1.4 admin-v2", "application/pdf")},
        )
        assert admin_document_replaced.status_code == 200
        assert admin_document_replaced.json()["version"] == 2

        graph_retry = client.post(
            f"/api/v1/knowledge/admin/documents/{admin_document_id}/graph/retry",
            headers=staff_headers,
        )
        assert graph_retry.status_code == 200
        assert graph_retry.json()["graphStatus"] == "queued"

        archived = client.post(
            f"/api/v1/knowledge/admin/documents/{admin_document_id}/archive",
            headers=staff_headers,
        )
        assert archived.status_code == 200
        assert archived.json()["status"] == "archived"

        restored = client.post(
            f"/api/v1/knowledge/admin/documents/{admin_document_id}/restore",
            headers=staff_headers,
        )
        assert restored.status_code == 200
        assert restored.json()["status"] == "published"

        batch_archived = client.post(
            "/api/v1/knowledge/admin/documents/batch",
            headers=staff_headers,
            json={
                "document_ids": [document_id, admin_document_id],
                "action": "archive",
            },
        )
        assert batch_archived.status_code == 200
        assert batch_archived.json()["processed"] == 2

        batch_restored = client.post(
            "/api/v1/knowledge/admin/documents/batch",
            headers=staff_headers,
            json={
                "document_ids": [document_id, admin_document_id],
                "action": "restore",
            },
        )
        assert batch_restored.status_code == 200
        assert batch_restored.json()["processed"] == 2

        invalid_applicant_registration = client.post(
            "/api/v1/auth/staff/register",
            json={
                "email": "not-an-email",
                "password": "short",
                "name": "   ",
                "requested_role": "counselor",
            },
        )
        assert invalid_applicant_registration.status_code == 422
        assert isinstance(invalid_applicant_registration.json()["detail"], list)

        applicant_registration = client.post(
            "/api/v1/auth/staff/register",
            json={
                "email": "new-counselor@here.edu",
                "password": "Applicant123!",
                "name": "申请人",
                "requested_role": "counselor",
            },
        )
        assert applicant_registration.status_code == 201
        assert applicant_registration.json()["user"]["accountStatus"] == "profile_incomplete"
        applicant_headers = {
            "Authorization": f"Bearer {applicant_registration.json()['access_token']}"
        }
        applicant_cannot_access_dashboard = client.get(
            "/api/v1/dashboard",
            headers=applicant_headers,
        )
        assert applicant_cannot_access_dashboard.status_code == 403

        application = client.post(
            "/api/v1/staff/applications",
            headers=applicant_headers,
            data={
                "email": "new-counselor@here.edu",
                "real_name": "王申请",
                "display_name": "王老师",
                "phone": "13900000000",
                "organization": "测试大学",
                "department": "学生工作部",
                "college": "信息学院",
                "employee_number": "T2026001",
                "requested_role": "counselor",
                "id_number": "420101199001011234",
            },
            files=[("proofs", ("employment.pdf", b"%PDF proof", "application/pdf"))],
        )
        assert application.status_code == 201
        application_id = application.json()["id"]
        assert application.json()["status"] == "pending_review"
        assert application.json()["profile"]["idNumberMasked"].endswith("1234")
        assert application.json()["credentials"][0]["name"] == "employment.pdf"

        pending_applications = client.get(
            "/api/v1/admin/staff-applications",
            headers=staff_headers,
        )
        assert pending_applications.status_code == 200
        assert pending_applications.json()[0]["id"] == application_id

        returned_application = client.post(
            f"/api/v1/admin/staff-applications/{application_id}/review",
            headers=staff_headers,
            json={"action": "request_changes", "note": "请修改登录邮箱"},
        )
        assert returned_application.status_code == 200
        assert returned_application.json()["status"] == "changes_requested"

        returned_profile = client.get("/api/v1/staff/profile", headers=applicant_headers)
        assert returned_profile.status_code == 200
        retained_credential_id = returned_profile.json()["latestApplication"]["credentials"][0]["id"]

        resubmitted_application = client.post(
            "/api/v1/staff/applications",
            headers=applicant_headers,
            data={
                "email": "approved-counselor@here.edu",
                "real_name": "王申请",
                "display_name": "王老师",
                "phone": "13900000000",
                "organization": "测试大学",
                "department": "学生工作部",
                "college": "信息学院",
                "employee_number": "T2026001",
                "requested_role": "counselor",
                "id_number": "420101199001011234",
                "reuse_credential_ids": retained_credential_id,
            },
        )
        assert resubmitted_application.status_code == 201
        application_id = resubmitted_application.json()["id"]
        assert resubmitted_application.json()["profile"]["email"] == "approved-counselor@here.edu"
        assert resubmitted_application.json()["credentials"][0]["name"] == "employment.pdf"

        approved_application = client.post(
            f"/api/v1/admin/staff-applications/{application_id}/review",
            headers=staff_headers,
            json={"action": "approve", "note": "任职证明有效"},
        )
        assert approved_application.status_code == 200

        approved_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "approved-counselor@here.edu", "password": "Applicant123!"},
        )
        assert approved_login.status_code == 200
        assert approved_login.json()["user"]["accountStatus"] == "active"
        old_email_login = client.post(
            "/api/v1/auth/staff/login",
            json={"email": "new-counselor@here.edu", "password": "Applicant123!"},
        )
        assert old_email_login.status_code == 401
        approved_headers = {
            "Authorization": f"Bearer {approved_login.json()['access_token']}"
        }
        approved_profile = client.get("/api/v1/staff/profile", headers=approved_headers)
        assert approved_profile.status_code == 200
        assert approved_profile.json()["profile"]["displayName"] == "王老师"

        changed_password = client.post(
            "/api/v1/auth/staff/password/change",
            headers=approved_headers,
            json={
                "current_password": "Applicant123!",
                "new_password": "ApplicantChanged123!",
            },
        )
        assert changed_password.status_code == 200
        invalidated_session = client.get("/api/v1/staff/profile", headers=approved_headers)
        assert invalidated_session.status_code == 401
        changed_login = client.post(
            "/api/v1/auth/staff/login",
            json={
                "email": "approved-counselor@here.edu",
                "password": "ApplicantChanged123!",
            },
        )
        assert changed_login.status_code == 200

        known_reset_token = "test-reset-token-that-is-long-enough-123456789"
        with patch(
            "app.routers.auth.create_password_reset_token",
            return_value=(known_reset_token, hash_password_reset_token(known_reset_token)),
        ):
            reset_request = client.post(
                "/api/v1/auth/staff/password-reset/request",
                json={"email": "approved-counselor@here.edu"},
            )
        assert reset_request.status_code == 200
        assert reset_request.json()["debugToken"] is None
        reset_confirm = client.post(
            "/api/v1/auth/staff/password-reset/confirm",
            json={"token": known_reset_token, "new_password": "ApplicantReset123!"},
        )
        assert reset_confirm.status_code == 200
        reused_reset_token = client.post(
            "/api/v1/auth/staff/password-reset/confirm",
            json={"token": known_reset_token, "new_password": "ShouldNotWork123!"},
        )
        assert reused_reset_token.status_code == 400

        closed_account = client.post(
            f"/api/v1/admin/staff/{approved_login.json()['user']['id']}/close",
            headers=staff_headers,
            json={"reason": "测试账号完成验收"},
        )
        assert closed_account.status_code == 200
        closed_login = client.post(
            "/api/v1/auth/staff/login",
            json={
                "email": "approved-counselor@here.edu",
                "password": "ApplicantReset123!",
            },
        )
        assert closed_login.status_code == 403
        visible_staff = client.get("/api/v1/admin/staff", headers=staff_headers)
        assert visible_staff.status_code == 200
        assert approved_login.json()["user"]["id"] not in {
            item["id"] for item in visible_staff.json()
        }

        paged_audit_logs = client.get(
            "/api/v1/audit-logs",
            headers=staff_headers,
            params={"page": 1, "page_size": 10},
        )
        assert paged_audit_logs.status_code == 200
        assert paged_audit_logs.json()["page"] == 1
        assert len(paged_audit_logs.json()["items"]) <= 10
        searched_audit_logs = client.get(
            "/api/v1/audit-logs",
            headers=staff_headers,
            params={"page": 1, "page_size": 10, "search": "修改登录密码"},
        )
        assert searched_audit_logs.status_code == 200
        assert searched_audit_logs.json()["total"] >= 1
        assert {
            item["action"] for item in searched_audit_logs.json()["items"]
        } == {"staff.password.change"}

        audit_logs = client.get("/api/v1/audit-logs", headers=staff_headers)
        assert audit_logs.status_code == 200
        actions = {row["action"] for row in audit_logs.json()}
        assert "work_order.refer" in actions
        assert "work_order.resolve" in actions
        assert "knowledge.publish" in actions
        assert "knowledge.admin.create" in actions
        assert "staff.application.approve" in actions
        assert "staff.password.change" in actions
        assert "staff.password.reset" in actions
        assert "staff.close" in actions
        readable_entry = next(
            row for row in audit_logs.json() if row["action"] == "knowledge.admin.create"
        )
        assert readable_entry["actorName"] == "系统管理员"
        assert readable_entry["actorAccount"] == "admin@here.edu"
        assert readable_entry["actionLabel"] == "管理员导入知识资料"
        assert readable_entry["resourceName"] == "管理员导入指南（修订）.pdf"
