from __future__ import annotations

import smtplib
from email.message import EmailMessage

from .config import get_settings


def send_password_reset_email(recipient: str, token: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from:
        return False

    reset_url = f"{settings.frontend_url}/?reset_token={token}"
    message = EmailMessage()
    message["Subject"] = "HERE 工作平台密码重置"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(
        "你申请了 HERE 工作平台密码重置。\n\n"
        f"请在 30 分钟内打开以下链接：\n{reset_url}\n\n"
        "如果不是你本人操作，请忽略此邮件。"
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return True
