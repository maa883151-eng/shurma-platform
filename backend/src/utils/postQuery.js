// Shared SELECT fragment for enriched posts.
// Expects the viewer's user id as the FIRST bound parameter ($1).
const POST_FIELDS = `
  p.*, u.name, u.username, u.avatar, u.is_verified,
  (SELECT reaction FROM likes l WHERE l.user_id=$1 AND l.post_id=p.id) AS my_reaction,
  EXISTS(SELECT 1 FROM likes l WHERE l.user_id=$1 AND l.post_id=p.id) AS is_liked,
  COALESCE((SELECT json_object_agg(r.reaction, r.cnt)
            FROM (SELECT reaction, COUNT(*)::int AS cnt FROM likes WHERE post_id=p.id GROUP BY reaction) r),
           '{}'::json) AS reactions,
  EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id=$1 AND b.post_id=p.id) AS is_bookmarked,
  (SELECT row_to_json(o) FROM (
     SELECT op.id, op.user_id, op.content, op.image_url, op.created_at,
            ou.name, ou.username, ou.avatar, ou.is_verified
     FROM posts op JOIN users ou ON ou.id = op.user_id
     WHERE op.id = p.repost_of
  ) o) AS original_post
`;

const POST_JOIN = `FROM posts p JOIN users u ON u.id = p.user_id`;

module.exports = { POST_FIELDS, POST_JOIN };
