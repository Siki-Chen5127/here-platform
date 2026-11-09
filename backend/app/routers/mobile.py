from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deepseek_service import DeepSeekServiceError, create_deepseek_completion
from ..dependencies import get_current_student
from ..models import (
    Alert,
    LocationEvent,
    StaffProfile,
    StaffUser,
    StudentProfile,
    StudentUser,
    WorkOrder,
)
from ..schemas import (
    AlertCreate,
    LocationEventCreate,
    MobileAiChatRequest,
    MobileAiResponse,
    MobileProfileUpdate,
    MobileSafetyAnalysisRequest,
)


router = APIRouter(prefix="/mobile", tags=["mobile"])


CHAT_SYSTEM_PROMPT = """你是 HERE 暖心助手，面向校园用户提供简短、温暖、有同理心的心理支持。
不要诊断疾病，不要声称你能实时监控或代替医生。优先倾听和提供可执行的小步骤。
如果用户表达自伤、自杀、伤害他人或正在遭遇现实危险，应明确建议立即联系身边可信任的人、学校专业人员，
并根据紧急程度拨打 110 或 120；不要只提供安慰。使用自然、简洁的中文回复。"""

SAFETY_ANALYSIS_SYSTEM_PROMPT = """你是 HERE 个人安全顾问。根据匿名统计数据给出不超过 300 字的中文建议。
不要诊断心理或身体疾病，不要虚构数据；风险较高时明确建议联系学校工作人员或可信任的人。"""


def _raise_ai_http_error(error: DeepSeekServiceError) -> None:
    raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.post("/ai/chat", response_model=MobileAiResponse)
async def chat_with_ai(
    payload: MobileAiChatRequest,
    _student: StudentUser = Depends(get_current_student),
) -> MobileAiResponse:
    try:
        result = await create_deepseek_completion(
            system_prompt=CHAT_SYSTEM_PROMPT,
            messages=[message.model_dump() for message in payload.messages],
            temperature=0.8,
            thinking=True,
        )
    except DeepSeekServiceError as error:
        _raise_ai_http_error(error)
    return MobileAiResponse(
        content=result.content,
        model=result.model,
        reasoning_content=result.reasoning_content,
    )


@router.post("/ai/safety-analysis", response_model=MobileAiResponse)
async def create_safety_analysis(
    payload: MobileSafetyAnalysisRequest,
    _student: StudentUser = Depends(get_current_student),
) -> MobileAiResponse:
    summary = (
        f"安全评分：{payload.safety_score}/100；"
        f"近 7 天报警：{payload.alert_count} 次；"
        f"夜间活动时段：{payload.night_trip_count} 个；"
        f"活跃时长：{payload.active_hours:.1f} 小时。"
    )
    try:
        result = await create_deepseek_completion(
            system_prompt=SAFETY_ANALYSIS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": summary}],
            temperature=0.7,
        )
    except DeepSeekServiceError as error:
        _raise_ai_http_error(error)
    return MobileAiResponse(content=result.content, model=result.model)


def _find_college_counselor(
    session: Session,
    college: str,
) -> StaffUser | None:
    rows = session.execute(
        select(StaffUser)
        .join(StaffProfile, StaffProfile.staff_user_id == StaffUser.id)
        .where(
            StaffUser.role == "counselor",
            StaffUser.is_active == 1,
            StaffUser.account_status == "active",
            StaffProfile.college == college,
        )
    ).scalars().all()
    if not rows:
        return None

    counselor_ids = [counselor.id for counselor in rows]
    workloads = dict(
        session.execute(
            select(WorkOrder.assignee_id, func.count(WorkOrder.id))
            .where(
                WorkOrder.assignee_id.in_(counselor_ids),
                WorkOrder.status != "resolved",
            )
            .group_by(WorkOrder.assignee_id)
        ).all()
    )
    return min(rows, key=lambda counselor: (workloads.get(counselor.id, 0), counselor.created_at))


@router.get("/profile")
def get_mobile_profile(
    student: StudentUser = Depends(get_current_student),
    session: Session = Depends(get_db),
) -> dict[str, str | None]:
    profile = session.scalar(
        select(StudentProfile).where(StudentProfile.student_id == student.id)
    )
    return {
        "displayName": student.display_name,
        "phone": student.phone,
        "college": profile.college if profile else None,
    }


@router.patch("/profile")
def update_mobile_profile(
    payload: MobileProfileUpdate,
    student: StudentUser = Depends(get_current_student),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    college = payload.college.strip()
    if not college:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="请选择所属学院")
    if not session.scalar(
        select(StaffUser.id)
        .join(StaffProfile, StaffProfile.staff_user_id == StaffUser.id)
        .where(
            StaffUser.role == "counselor",
            StaffUser.is_active == 1,
            StaffUser.account_status == "active",
            StaffProfile.college == college,
        )
        .limit(1)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该学院暂未配置可接收预警的辅导员，请联系学校管理员",
        )

    student.display_name = payload.display_name.strip()
    profile = session.scalar(
        select(StudentProfile).where(StudentProfile.student_id == student.id)
    )
    if profile is None:
        profile = StudentProfile(student_id=student.id)
        session.add(profile)
    profile.college = college
    session.commit()
    return {"status": "updated", "displayName": student.display_name, "college": college}


def _next_work_order_number(session: Session) -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"WO-{day}-"

    if session.get_bind().dialect.name == "mssql":
        lock_result = session.scalar(
            text(
                """
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock
                    @Resource = :resource,
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction',
                    @LockTimeout = 5000;
                SELECT @result;
                """
            ),
            {"resource": f"here:work-order-number:{day}"},
        )
        if lock_result is None or lock_result < 0:
            raise RuntimeError("无法取得工单编号生成锁")

    latest = session.scalar(
        select(WorkOrder.business_number)
        .where(WorkOrder.business_number.like(f"{prefix}%"))
        .order_by(WorkOrder.business_number.desc())
        .limit(1)
    )
    sequence = int(latest.rsplit("-", 1)[-1]) + 1 if latest else 1
    return f"{prefix}{sequence:06d}"


@router.post("/location-events", status_code=status.HTTP_202_ACCEPTED)
def create_location_event(
    payload: LocationEventCreate,
    student: StudentUser = Depends(get_current_student),
    session: Session = Depends(get_db),
) -> dict[str, str | int]:
    existing = session.scalar(
        select(LocationEvent).where(
            LocationEvent.student_id == student.id,
            LocationEvent.client_event_id == payload.client_event_id,
        )
    )
    if existing:
        return {"status": "duplicate", "id": existing.id}

    event = LocationEvent(
        student_id=student.id,
        client_event_id=payload.client_event_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        address=payload.address,
        recorded_at=payload.recorded_at,
    )
    session.add(event)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        duplicate = session.scalar(
            select(LocationEvent).where(
                LocationEvent.student_id == student.id,
                LocationEvent.client_event_id == payload.client_event_id,
            )
        )
        return {"status": "duplicate", "id": duplicate.id if duplicate else 0}
    session.refresh(event)
    return {"status": "accepted", "id": event.id}


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertCreate,
    student: StudentUser = Depends(get_current_student),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    existing = session.scalar(
        select(Alert).where(
            Alert.student_id == student.id,
            Alert.client_event_id == payload.client_event_id,
        )
    )
    if existing:
        return {"status": "duplicate", "alert_id": existing.id}

    profile = session.scalar(
        select(StudentProfile).where(StudentProfile.student_id == student.id)
    )
    if profile is None or not profile.college:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="请先在个人档案中填写所属学院，再提交预警",
        )
    counselor = _find_college_counselor(session, profile.college)
    if counselor is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="所属学院暂无可接收预警的辅导员，请联系学校管理员",
        )

    alert = Alert(
        student_id=student.id,
        client_event_id=payload.client_event_id,
        category=payload.category,
        severity=payload.severity,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    session.add(alert)
    session.flush()

    work_order = WorkOrder(
        alert_id=alert.id,
        business_number=_next_work_order_number(session),
        assignee_id=counselor.id,
        priority=payload.severity,
        summary=payload.description or f"{payload.category} 预警",
    )
    profile.counselor_id = counselor.id
    session.add(work_order)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        duplicate = session.scalar(
            select(Alert).where(
                Alert.student_id == student.id,
                Alert.client_event_id == payload.client_event_id,
            )
        )
        return {
            "status": "duplicate",
            "alert_id": duplicate.id if duplicate else "",
        }
    return {
        "status": "created",
        "alert_id": alert.id,
        "work_order_id": work_order.id,
        "work_order_number": work_order.business_number,
        "assigned_counselor_id": counselor.id,
        "assigned_counselor_name": counselor.name,
    }
