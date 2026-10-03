import io
from typing import BinaryIO

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings


class MinIOAdapter:
    def __init__(self):
        self.endpoint_url = settings.STORAGE_ENDPOINT
        self.access_key = settings.STORAGE_ACCESS_KEY
        self.secret_key = settings.STORAGE_SECRET_KEY
        self.bucket = settings.STORAGE_BUCKET
        self.region = settings.STORAGE_REGION

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            config=Config(signature_version="s3v4"),
        )

    def ensure_bucket_exists(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                self.client.create_bucket(Bucket=self.bucket)
            else:
                raise

    def put_object(
        self,
        object_key: str,
        data: bytes | BinaryIO,
        content_type: str = "application/octet-stream",
    ) -> dict:
        self.ensure_bucket_exists()
        if isinstance(data, bytes):
            body = io.BytesIO(data)
        else:
            body = data

        response = self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=body,
            ContentType=content_type,
        )
        return {
            "bucket": self.bucket,
            "object_key": object_key,
            "etag": response.get("ETag", "").strip('"'),
            "version_id": response.get("VersionId"),
        }

    def get_object(self, object_key: str) -> tuple[bytes, str]:
        response = self.client.get_object(Bucket=self.bucket, Key=object_key)
        content = response["Body"].read()
        content_type = response.get("ContentType", "application/octet-stream")
        return content, content_type

    def stat_object(self, object_key: str) -> dict:
        response = self.client.head_object(Bucket=self.bucket, Key=object_key)
        return {
            "size": response.get("ContentLength", 0),
            "content_type": response.get("ContentType"),
            "etag": response.get("ETag", "").strip('"'),
            "last_modified": response.get("LastModified"),
        }

    def delete_object(self, object_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)

    def check_readiness(self) -> tuple[bool, str]:
        try:
            self.ensure_bucket_exists()
            return True, "Storage connected"
        except Exception as e:
            return False, f"Storage error: {str(e)}"


storage_adapter = MinIOAdapter()
