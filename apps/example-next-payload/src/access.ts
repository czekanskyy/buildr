import type { Access, PayloadRequest } from 'payload';

export type Role = 'admin' | 'editor' | 'author';

export const roleOf = (req: PayloadRequest): Role | undefined =>
  (req.user as { role?: Role } | null | undefined)?.role;

export const isAdmin: Access = ({ req }) => roleOf(req) === 'admin';
export const isSignedIn: Access = ({ req }) => Boolean(req.user);
export const canPublish = ({ req }: { req: PayloadRequest }): boolean => {
  const role = roleOf(req);
  return role === 'admin' || role === 'editor';
};

/** Everyone reads what is published; a signed-in user reads drafts too. */
export const readPublished: Access = ({ req }) =>
  req.user ? true : { _status: { equals: 'published' } };

export const readAll: Access = () => true;
