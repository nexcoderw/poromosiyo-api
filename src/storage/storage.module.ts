import { Global, Module } from '@nestjs/common';

import { ImageStorageService } from './image-storage.service';

@Global()
@Module({
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class StorageModule {}
