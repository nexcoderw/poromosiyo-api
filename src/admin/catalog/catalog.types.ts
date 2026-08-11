export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminProductResponse = {
  id: string;
  categoryId: string;
  brandId: string | null;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  currency: string;
  originalPrice: string;
  sellingPrice: string;
  discountPercentage: string;
  status:
    | 'DRAFT'
    | 'ACTIVE'
    | 'ARCHIVED';
  isFeatured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
  brand: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  } | null;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }>;
};
