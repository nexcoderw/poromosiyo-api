import { Injectable } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import { ImageStorageService } from '../../storage/image-storage.service';
import type { AuthPrincipal } from '../types/auth.types';

@Injectable()
export class ProfileImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async update(principal: AuthPrincipal, file: Express.Multer.File) {
    const slug = principal.fullName || principal.email.split('@')[0] || 'user';
    const objectPath = await this.imageStorage.store({
      file,
      owner: 'profiles',
      ownerId: principal.id,
      slug,
    });

    let user;

    try {
      user = await this.prisma.user.update({
        where: { id: principal.id },
        data: { image: objectPath },
        select: { id: true, image: true },
      });
    } catch (error) {
      await this.imageStorage.delete(objectPath);
      throw error;
    }

    await this.imageStorage.delete(principal.image);
    return user;
  }
}
