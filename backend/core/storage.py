"""
storage.py — Unified Storage Interface

Provides a common interface for file operations, switching between
local filesystem and Google Cloud Storage (GCS).
"""

import os
import io
import logging
from pathlib import Path
from typing import Union, Optional

from google.cloud import storage
from google.api_core import exceptions

logger = logging.getLogger(__name__)

# Config
STORAGE_MODE = os.getenv("STORAGE_MODE", "local").lower()  # 'local' or 'gcs'
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")

class BaseStorage:
    def read_text(self, path: Union[str, Path]) -> str:
        raise NotImplementedError

    def read_bytes(self, path: Union[str, Path]) -> bytes:
        raise NotImplementedError

    def write_text(self, path: Union[str, Path], content: str):
        raise NotImplementedError

    def write_bytes(self, path: Union[str, Path], content: bytes):
        raise NotImplementedError

    def delete(self, path: Union[str, Path]):
        raise NotImplementedError

    def exists(self, path: Union[str, Path]) -> bool:
        raise NotImplementedError

    def list_files(self, prefix: Union[str, Path], pattern: str = "*") -> list[Path]:
        raise NotImplementedError

class LocalStorage(BaseStorage):
    def read_text(self, path: Union[str, Path]) -> str:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def read_bytes(self, path: Union[str, Path]) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def write_text(self, path: Union[str, Path], content: str):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)

    def write_bytes(self, path: Union[str, Path], content: bytes):
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "wb") as f:
            f.write(content)

    def delete(self, path: Union[str, Path]):
        p = Path(path)
        if p.exists():
            p.unlink()

    def exists(self, path: Union[str, Path]) -> bool:
        return Path(path).exists()

    def list_files(self, prefix: Union[str, Path], pattern: str = "*") -> list[Path]:
        return list(Path(prefix).glob(pattern))

class GCSStorage(BaseStorage):
    def __init__(self, bucket_name: str):
        self.client = storage.Client()
        self.bucket_name = bucket_name
        self.bucket = self.client.bucket(bucket_name)

    def _get_blob_name(self, path: Union[str, Path]) -> str:
        # Convert path like 'data/raw/1_match.json' to 'data/raw/1_match.json' string
        return str(path).replace("\\", "/")

    def read_text(self, path: Union[str, Path]) -> str:
        blob = self.bucket.blob(self._get_blob_name(path))
        return blob.download_as_text()

    def read_bytes(self, path: Union[str, Path]) -> bytes:
        blob = self.bucket.blob(self._get_blob_name(path))
        return blob.download_as_bytes()

    def write_text(self, path: Union[str, Path], content: str):
        blob = self.bucket.blob(self._get_blob_name(path))
        blob.upload_from_string(content)

    def write_bytes(self, path: Union[str, Path], content: bytes):
        blob = self.bucket.blob(self._get_blob_name(path))
        blob.upload_from_string(content, content_type="application/octet-stream")

    def delete(self, path: Union[str, Path]):
        blob = self.bucket.blob(self._get_blob_name(path))
        if blob.exists():
            blob.delete()

    def exists(self, path: Union[str, Path]) -> bool:
        blob = self.bucket.blob(self._get_blob_name(path))
        return blob.exists()

    def list_files(self, prefix: Union[str, Path], pattern: str = "*") -> list[Path]:
        # Simple pattern support for GCS (mostly checking for file suffix)
        suffix = pattern.replace("*", "")
        blobs = self.client.list_blobs(self.bucket_name, prefix=self._get_blob_name(prefix))
        
        results = []
        for b in blobs:
            if b.name.endswith(suffix):
                results.append(Path(b.name))
        return results

# Factory
def get_storage() -> BaseStorage:
    if STORAGE_MODE == "gcs":
        if not GCS_BUCKET_NAME:
            logger.warning("STORAGE_MODE is GCS but GCS_BUCKET_NAME is not set. Falling back to local.")
            return LocalStorage()
        try:
            return GCSStorage(GCS_BUCKET_NAME)
        except Exception as e:
            logger.error(f"Failed to initialize GCS storage: {e}. Falling back to local.")
            return LocalStorage()
    return LocalStorage()

# Singleton instance
storage_provider = get_storage()
