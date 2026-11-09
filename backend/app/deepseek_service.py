from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx

from .config import get_settings


@dataclass(frozen=True)
class DeepSeekResult:
    content: str
    model: str
    reasoning_content: str = ""


class DeepSeekServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


async def create_deepseek_completion(
    *,
    system_prompt: str,
    messages: list[dict[str, str]],
    temperature: float,
    thinking: bool = False,
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
    if thinking:
        payload.pop("temperature", None)
        payload.update({
            "thinking": {"type": "enabled"},
            "reasoning_effort": "low",
            "max_tokens": 8192,
        })

    request_timeout = 120.0 if thinking else 45.0
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(request_timeout, connect=10.0)) as client:
            response = await asyncio.wait_for(client.post(
                f"{settings.deepseek_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ), timeout=request_timeout)
    except (asyncio.TimeoutError, httpx.TimeoutException) as error:
        raise DeepSeekServiceError("AI 回复超时，请稍后重试或缩短问题", status_code=504) from error
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
        choice = data["choices"][0]
        message = choice["message"]
        content = message.get("content") or ""
        reasoning = message.get("reasoning_content") or ""
        if not isinstance(content, str) or not isinstance(reasoning, str):
            raise ValueError("Unexpected AI response format")
        content = content.strip()
        reasoning = reasoning.strip()
    except (KeyError, IndexError, TypeError, ValueError, AttributeError) as error:
        raise DeepSeekServiceError("AI 服务返回了无法识别的内容", status_code=502) from error
    if choice.get("finish_reason") == "length":
        raise DeepSeekServiceError("本次生成达到长度上限，请缩短问题后重试", status_code=502)
    if not content:
        raise DeepSeekServiceError("AI 服务未返回有效内容", status_code=502)
    return DeepSeekResult(
        content=content,
        model=str(data.get("model") or settings.deepseek_model),
        reasoning_content=reasoning,
    )
