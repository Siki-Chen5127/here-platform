from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_student
from ..models import Alert, LocationEvent, StudentUser, WorkOrder
from ..schemas import AlertCreate, LocationEventCreate


router = APIRouter(prefix="/mobile", tags=["mobile"])


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
        priority=payload.severity,
        summary=payload.description or f"{payload.category} 预警",
    )
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
    }
