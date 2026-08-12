import 'dotenv/config';

import {
  PrismaService,
} from '@poromosiyo/db';

async function main():
  Promise<void> {
  process.env
    .DATABASE_CONNECT_ON_INIT =
    'false';

  const bucket =
    process.env
      .GCS_IMAGE_BUCKET
      ?.trim();

  if (!bucket) {
    throw new Error(
      'GCS_IMAGE_BUCKET is required.',
    );
  }

  const publicBase =
    process.env
      .GCS_IMAGE_PUBLIC_BASE_URL
      ?.trim()
      .replace(
        /\/+$/,
        '',
      );

  const allowedPrefixes =
    [
      `https://storage.googleapis.com/${bucket}/`,

      ...(publicBase
        ? [
            `${publicBase}/`,
          ]
        : []),
    ];

  const prisma =
    new PrismaService();

  try {
    await prisma
      .$connect();

    const [
      categories,
      brands,
      stores,
      productImages,
    ] =
      await Promise.all([
        prisma.category
          .findMany({
            where: {
              image: {
                not:
                  null,
              },
            },

            select: {
              id: true,
              image: true,
            },
          }),

        prisma.brand
          .findMany({
            where: {
              logo: {
                not:
                  null,
              },
            },

            select: {
              id: true,
              logo: true,
            },
          }),

        prisma.store
          .findMany({
            where: {
              logo: {
                not:
                  null,
              },
            },

            select: {
              id: true,
              logo: true,
            },
          }),

        prisma.productImage
          .findMany({
            select: {
              id: true,
              url: true,
            },
          }),
      ]);

    const invalid:
      string[] = [];

    for (
      const item
      of categories
    ) {
      if (
        item.image &&
        !isAllowed(
          item.image,
          allowedPrefixes,
        )
      ) {
        invalid.push(
          `category:${item.id}`,
        );
      }
    }

    for (
      const item
      of brands
    ) {
      if (
        item.logo &&
        !isAllowed(
          item.logo,
          allowedPrefixes,
        )
      ) {
        invalid.push(
          `brand:${item.id}`,
        );
      }
    }

    for (
      const item
      of stores
    ) {
      if (
        item.logo &&
        !isAllowed(
          item.logo,
          allowedPrefixes,
        )
      ) {
        invalid.push(
          `store:${item.id}`,
        );
      }
    }

    for (
      const item
      of productImages
    ) {
      if (
        !isAllowed(
          item.url,
          allowedPrefixes,
        )
      ) {
        invalid.push(
          `product-image:${item.id}`,
        );
      }
    }

    if (
      invalid.length >
      0
    ) {
      throw new Error(
        [
          `${invalid.length} catalog media record(s) still reference unmanaged/external images.`,
          ...invalid.slice(
            0,
            20,
          ),
        ].join(
          '\n',
        ),
      );
    }

    console.log(
      'All Poromosiyo catalog media references use managed public GCS/CDN URLs.',
    );
  } finally {
    await prisma
      .$disconnect();
  }
}

function isAllowed(
  value: string,
  prefixes:
    readonly string[],
): boolean {
  return prefixes.some(
    (
      prefix,
    ) =>
      value.startsWith(
        prefix,
      ),
  );
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error(
      'Catalog media verification failed.',
    );

    console.error(
      error instanceof
        Error
        ? error.message
        : String(
            error,
          ),
    );

    process.exitCode =
      1;
  },
);
