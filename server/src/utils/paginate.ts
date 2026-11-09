export interface PageQuery { page: number; limit: number; }
export function paginate(query: PageQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(50, Math.max(1, query.limit || 20));
  return { page, limit, skip: (page - 1) * limit };
}
export function buildMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}