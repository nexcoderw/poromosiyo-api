import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  IMAGE_UPLOAD_MAX_BYTES,
} from './image-storage.constants';

export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    files: 1,
    fileSize: IMAGE_UPLOAD_MAX_BYTES,
  },
  fileFilter: (_request, file, callback) => {
    if (!ACCEPTED_IMAGE_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      callback(
        new BadRequestException(
          'Upload a JPEG, PNG, WebP, HEIC, or HEIF image.',
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};
