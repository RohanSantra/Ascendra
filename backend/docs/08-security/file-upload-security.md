# File upload security

## Current implementation scope

Course-material upload handling is implemented under `src/modules/courseMaterials/`. The module separates upload initiation, upload confirmation, material metadata, storage access and archival. `CourseMaterialUploadIntent` stores organization/course/uploader context, Cloudinary public ID, resource type, file metadata, status and expiry.

Organization logo and evidence file metadata also appear in their respective models. This does not mean all those modules expose the same upload API.

## Security controls to verify

Before changing upload behavior, inspect the current storage adapter and validation schemas for:
- Organization/course ownership checks.
- Uploader authorization.
- Allowed MIME types and resource types.
- Maximum file size.
- Upload-intent status and expiry.
- Confirmation that the uploaded asset matches the intent.
- Safe storage key/asset ID handling.
- Access authorization before returning a material URL or access result.
- Archive/delete behavior and external asset cleanup.

Organization settings include maximum upload size and allowed MIME types. Confirm how the course-material service applies those settings before relying on them as an enforced boundary.

## Storage model

MongoDB stores metadata and storage identifiers; the binary asset is stored outside MongoDB. Never place Cloudinary API secrets or signed credentials in public responses or logs.

## Not asserted

This document does not claim malware scanning, content-disarm/reconstruction, antivirus integration, or universal file validation across every module unless such behavior is present in the specific storage/service code.
