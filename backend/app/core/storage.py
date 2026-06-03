"""Camada de storage de objetos — disco local OU S3-compatível (Cloudflare R2).

Toda imagem (portfólio, flash art, atendimento) é gravada e lida por aqui. O
backend escolhe o backend em tempo de import:

  - Se OBJECT_STORAGE_BUCKET + OBJECT_STORAGE_ENDPOINT estiverem definidos →
    usa R2 (boto3, assinatura s3v4). Os arquivos sobrevivem à recriação da VM.
  - Caso contrário → disco local sob STORAGE_PATH (dev e fallback).

A "key" é sempre relativa, no formato `uploads/<estudio_id>/<tipo>/<nome>` — a
mesma em ambos os backends, então a migração de disco→R2 é uma cópia 1:1 e as
linhas do banco (que guardam só o nome do arquivo) continuam válidas.

As imagens são servidas SEMPRE pelo nosso domínio (proxy same-origin) para
respeitar o CSP `img-src 'self'` do frontend — por isso lemos os bytes e
devolvemos um Response, em vez de redirecionar para a URL do R2.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Protocol, runtime_checkable

from starlette.concurrency import run_in_threadpool

from app.core.config import settings

_DEFAULT_CT = "application/octet-stream"


class ObjetoNaoEncontradoError(Exception):
    """Levantada quando a key não existe no storage."""


def _content_type_por_key(key: str) -> str:
    return mimetypes.guess_type(key)[0] or _DEFAULT_CT


@runtime_checkable
class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> None: ...
    def read(self, key: str) -> tuple[bytes, str]: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...
    def list_keys(self, prefix: str) -> list[str]: ...


class LocalStorage:
    """Backend de disco — usado em dev e como fallback.

    Lê STORAGE_PATH dinamicamente (não captura no construtor) para respeitar
    overrides de configuração feitos após o import (ex.: testes).
    """

    def _path(self, key: str) -> Path:
        return Path(settings.STORAGE_PATH) / key

    def save(self, key: str, data: bytes, content_type: str) -> None:
        destino = self._path(key)
        destino.parent.mkdir(parents=True, exist_ok=True)
        with open(destino, "wb") as f:
            f.write(data)

    def read(self, key: str) -> tuple[bytes, str]:
        p = self._path(key)
        if not p.exists() or not p.is_file():
            raise ObjetoNaoEncontradoError(key)
        return p.read_bytes(), _content_type_por_key(key)

    def exists(self, key: str) -> bool:
        p = self._path(key)
        return p.exists() and p.is_file()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def list_keys(self, prefix: str) -> list[str]:
        base = self._path(prefix)
        if not base.exists() or not base.is_dir():
            return []
        return [
            f"{prefix.rstrip('/')}/{f.name}"
            for f in base.iterdir()
            if f.is_file()
        ]


class R2Storage:
    """Backend S3-compatível (Cloudflare R2). boto3 importado preguiçosamente."""

    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> None:
        import boto3
        from botocore.config import Config

        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
        )

    def save(self, key: str, data: bytes, content_type: str) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type or _DEFAULT_CT,
        )

    def read(self, key: str) -> tuple[bytes, str]:
        from botocore.exceptions import ClientError

        try:
            obj = self._client.get_object(Bucket=self._bucket, Key=key)
        except ClientError as e:  # noqa: PERF203
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404", "NotFound"):
                raise ObjetoNaoEncontradoError(key) from e
            raise
        body = obj["Body"].read()
        return body, obj.get("ContentType") or _content_type_por_key(key)

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)

    def list_keys(self, prefix: str) -> list[str]:
        normalizado = prefix if prefix.endswith("/") else f"{prefix}/"
        paginator = self._client.get_paginator("list_objects_v2")
        keys: list[str] = []
        for page in paginator.paginate(Bucket=self._bucket, Prefix=normalizado):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        return keys


class _R2ComFallbackLocal:
    """R2 como primário, com fallback de LEITURA para o disco local.

    Usado na transição disco→R2 (zero-downtime): novas escritas vão para o R2;
    imagens antigas que ainda estão no volume continuam sendo servidas até a
    migração concluir. `delete` remove dos dois (LGPD/limpeza). Quando a migração
    termina, o fallback simplesmente nunca é acionado — é seguro mantê-lo.
    """

    def __init__(self, primario: StorageBackend, fallback: StorageBackend) -> None:
        self._primario = primario
        self._fallback = fallback

    def save(self, key: str, data: bytes, content_type: str) -> None:
        self._primario.save(key, data, content_type)

    def read(self, key: str) -> tuple[bytes, str]:
        try:
            return self._primario.read(key)
        except ObjetoNaoEncontradoError:
            return self._fallback.read(key)  # relança se também faltar no disco

    def exists(self, key: str) -> bool:
        return self._primario.exists(key) or self._fallback.exists(key)

    def delete(self, key: str) -> None:
        self._primario.delete(key)
        try:
            self._fallback.delete(key)  # best-effort: não falha se já não existir
        except Exception:  # noqa: BLE001
            pass

    def list_keys(self, prefix: str) -> list[str]:
        return self._primario.list_keys(prefix)


def _construir_backend() -> StorageBackend:
    if settings.OBJECT_STORAGE_BUCKET and settings.OBJECT_STORAGE_ENDPOINT:
        r2 = R2Storage(
            endpoint=settings.OBJECT_STORAGE_ENDPOINT,
            access_key=settings.OBJECT_STORAGE_ACCESS_KEY,
            secret_key=settings.OBJECT_STORAGE_SECRET_KEY,
            bucket=settings.OBJECT_STORAGE_BUCKET,
        )
        # Durante a transição, leituras que faltarem no R2 caem para o disco.
        return _R2ComFallbackLocal(r2, LocalStorage())
    return LocalStorage()


storage: StorageBackend = _construir_backend()


def montar_key(*partes: str) -> str:
    """Monta a key canônica `uploads/<...>` a partir de segmentos."""
    return "/".join(["uploads", *[p.strip("/") for p in partes if p]])


# ── Wrappers assíncronos (boto3 é síncrono → roda em threadpool) ──────────────


async def salvar_objeto(key: str, data: bytes, content_type: str) -> None:
    await run_in_threadpool(storage.save, key, data, content_type)


async def ler_objeto(key: str) -> tuple[bytes, str]:
    return await run_in_threadpool(storage.read, key)


async def remover_objeto(key: str) -> None:
    await run_in_threadpool(storage.delete, key)


async def listar_objetos(prefix: str) -> list[str]:
    return await run_in_threadpool(storage.list_keys, prefix)


async def resposta_imagem(key: str):
    """Lê o objeto e devolve um Response servido pelo nosso domínio (same-origin).

    Mantém o CSP `img-src 'self'` do frontend válido. 404 se a key não existir.
    """
    from fastapi import HTTPException, Response

    try:
        data, content_type = await ler_objeto(key)
    except ObjetoNaoEncontradoError as e:
        raise HTTPException(404, "Arquivo nao encontrado") from e
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
