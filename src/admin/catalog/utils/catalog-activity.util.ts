import type { SessionMetadata } from '../../../auth/types/auth.types';

export function createCatalogActivityData(input: {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  description: string;
  metadata: SessionMetadata;
}) {
  return {
    subjectUserId: input.actorId,

    actorUserId: input.actorId,

    action: input.action,

    resourceType: input.resourceType,

    resourceId: input.resourceId,

    description: input.description,

    ipAddress: input.metadata.ipAddress,

    userAgent: input.metadata.userAgent,
  };
}
