import hashlib
import uuid

from app.storage.minio_adapter import storage_adapter


def test_storage_put_get_and_hash():
    test_data = f"NghiaTrang Test Content - {uuid.uuid4()}".encode("utf-8")
    expected_sha256 = hashlib.sha256(test_data).hexdigest()
    object_key = f"test/m01_verify_{uuid.uuid4().hex}.txt"

    # Put
    put_result = storage_adapter.put_object(
        object_key=object_key,
        data=test_data,
        content_type="text/plain; charset=utf-8",
    )
    assert put_result["object_key"] == object_key
    assert put_result["bucket"] == storage_adapter.bucket

    # Stat
    stat_result = storage_adapter.stat_object(object_key)
    assert stat_result["size"] == len(test_data)

    # Get
    downloaded_data, content_type = storage_adapter.get_object(object_key)
    assert downloaded_data == test_data
    downloaded_sha256 = hashlib.sha256(downloaded_data).hexdigest()
    assert downloaded_sha256 == expected_sha256

    # Cleanup
    storage_adapter.delete_object(object_key)
