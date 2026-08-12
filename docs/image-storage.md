# Image Storage

Poromosiyo stores uploaded image binaries in the private Google Cloud Storage
bucket configured by `GCS_IMAGE_BUCKET`. MySQL stores only the object path; it
must never store a Base64 data URL or image bytes.

## Object layout

```text
products/<product-id>/<product-slug>-<timestamp>-<uuid>.webp
profiles/<user-id>/<user-slug>-<timestamp>-<uuid>.webp
stores/<store-id>/<store-slug>-<timestamp>-<uuid>.webp
```

Names are derived from the owning record and include a timestamp and UUID to
avoid collisions. Replacing a profile or store image deletes the previous
managed object after the database update succeeds. Deleting a product image or
store also removes its managed object.

## Upload contract

Send `multipart/form-data` with the file in the `image` field. The API accepts
JPEG, PNG, WebP, HEIC, and HEIF input up to 12 MB. It validates the actual image,
applies EXIF rotation, constrains it to 1600 by 1600 pixels, and encodes WebP at
quality 82. If needed, it progressively reduces quality and dimensions to keep
the stored object at or below 500 KB.

A product may have between one and ten images. Product image metadata can be
sent as additional multipart fields. Image paths cannot be supplied in JSON.

Upload endpoints:

- `POST /api/v1/admin/products/:productId/images`
- `PATCH /api/v1/admin/stores/:id/logo`
- `POST /api/v1/auth/me/image`
- `POST /api/v1/admin/me/image`

## Authentication and permissions

The API uses Google Application Default Credentials. For local development,
run `gcloud auth application-default login`. In deployed environments, attach a
dedicated service account to the runtime instead of storing a key in this
repository. Grant it only the permissions required to create and delete objects
in `poromosiyo-images` (the Storage Object User role at bucket scope).

The bucket is private. API responses contain the stored object path; consumers
must not construct public URLs for it. A signed/read endpoint should be added
when image delivery is introduced.
