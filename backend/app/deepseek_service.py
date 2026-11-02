from __future__ import annotations

from dataclasses import dataclass

import httpx

from .config import get_settings


@dataclass(frozen=True)
class DeepSeekResult:
    content: str
    model: str


class DeepSeekServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


async def create_deepseek_completion(
    *,
    system_prompt: str,
    messages: list[dict[str, str]],
    temperature: float,
) -> DeepSeekResult:
    settings = get_settings()
    if not settings.deepseek_api_key:
        raise DeepSeekServiceError("AI 服务尚未配置，请联系管理员")

    payload = {
        "model": settings.deepseek_model,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "temperature": temperature,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                f"{settings.deepseek_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.RequestError as error:
        raise DeepSeekServiceError("AI 服务暂时无法连接，请稍后重试") from error

    if response.status_code in {401, 403}:
        raise DeepSeekServiceError("AI 服务配置无效，请联系管理员")
    if response.status_code == 429:
        raise DeepSeekServiceError("AI 服务当前繁忙，请稍后重试", status_code=429)
    if response.status_code >= 400:
        raise DeepSeekServiceError("AI 服务返回异常，请稍后重试", status_code=502)

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError, ValueError, AttributeError) as error:
        raise DeepSeekServiceError("AI 服务返回了无法识别的内容", status_code=502) from error
    if not content:
        raise DeepSeekServiceError("AI 服务未返回有效内容", status_code=502)
    return DeepSeekResult(content=content, model=str(data.get("model") or settings.deepseek_model))
