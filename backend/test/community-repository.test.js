const test = require('node:test');
const assert = require('node:assert/strict');

let createCommunityRepository;
try {
  ({ createCommunityRepository } = require('../src/repositories/community-repository'));
} catch (error) {
  if (
    error.code !== 'MODULE_NOT_FOUND' ||
    !error.message.includes('../src/repositories/community-repository')
  ) {
    throw error;
  }
}

function createRepository(pool) {
  assert.equal(typeof createCommunityRepository, 'function');
  return createCommunityRepository({ pool });
}

test('findSubject binds the requested ID and returns no row for an unknown subject', async () => {
  let call;
  const repository = createRepository({
    async execute(sql, params) {
      call = { sql, params };
      return [[], []];
    }
  });

  assert.equal(await repository.findSubject('7'), null);
  assert.match(call.sql, /WHERE id = \?/);
  assert.deepEqual(call.params, ['7']);
});

test('findPost binds the post ID and returns null for an unknown post', async () => {
  let call;
  const repository = createRepository({
    async execute(sql, params) {
      call = { sql, params };
      return [[], []];
    }
  });
  assert.equal(typeof repository.findPost, 'function');

  assert.equal(await repository.findPost('51'), null);
  assert.match(call.sql, /FROM class_posts\s+WHERE id = \?/);
  assert.deepEqual(call.params, ['51']);
});

test('listReviews binds subject and pagination and returns newest rows with a count', async () => {
  const calls = [];
  const rows = [{
    id: '18',
    subject_id: '7',
    user_id: '42',
    author_name: 'Nguyen Van A',
    author_university: 'UIT'
  }];
  const repository = createRepository({
    async execute(sql, params) {
      calls.push({ sql, params });
      return calls.length === 1
        ? [[{ total: 25 }], []]
        : [rows, []];
    }
  });

  const result = await repository.listReviews('7', 20, 20);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, ['7']);
  assert.match(calls[1].sql, /LEFT JOIN users u ON u\.id = course_reviews\.user_id/);
  assert.match(calls[1].sql, /u\.full_name AS author_name/);
  assert.match(calls[1].sql, /ORDER BY (?:course_reviews\.)?created_at DESC, (?:course_reviews\.)?id DESC/);
  assert.deepEqual(calls[1].params, ['7', '20', '20']);
  assert.deepEqual(result, { rows, total: 25 });
});

test('createReview binds the authenticated owner and all review values', async () => {
  const calls = [];
  const row = {
    id: '18',
    subject_id: '7',
    user_id: '42',
    rating: 5
  };
  const repository = createRepository({
    async execute(sql, params) {
      calls.push({ sql, params });
      return calls.length === 1
        ? [{ insertId: '18' }, []]
        : [[row], []];
    }
  });

  const result = await repository.createReview('42', '7', {
    lecturerName: 'Dr. Nguyen',
    rating: 5,
    difficulty: 3,
    attendanceRequired: true,
    gradingNotes: null,
    materialsNotes: 'Lecture notes',
    content: 'Clear course'
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO course_reviews/);
  assert.deepEqual(calls[0].params, [
    '7',
    '42',
    'Dr. Nguyen',
    5,
    3,
    true,
    null,
    'Lecture notes',
    'Clear course'
  ]);
  assert.deepEqual(result, row);
});

test('updateMyReview and deleteMyReview restrict mutations to user and subject', async () => {
  const calls = [];
  const row = { id: '18', subject_id: '7', user_id: '42', content: 'Updated', author_name: 'Nguyen Van A' };
  const repository = createRepository({
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('UPDATE course_reviews')) return [{ affectedRows: 1 }, []];
      if (sql.includes('SELECT')) return [[row], []];
      return [{ affectedRows: 1 }, []];
    }
  });

  assert.deepEqual(
    await repository.updateMyReview('42', '7', { content: 'Updated' }),
    row
  );
  assert.equal(await repository.deleteMyReview('42', '7'), true);

  assert.match(calls[0].sql, /WHERE user_id = \? AND subject_id = \?/);
  assert.deepEqual(calls[0].params, ['Updated', '42', '7']);
  assert.match(calls[1].sql, /LEFT JOIN users u ON u\.id = course_reviews\.user_id/);
  assert.match(calls[1].sql, /WHERE (?:course_reviews\.)?user_id = \? AND (?:course_reviews\.)?subject_id = \?/);
  assert.deepEqual(calls[1].params, ['42', '7']);
});

test('createPost locks the class mapping and inserts the authenticated owner transactionally', async () => {
  const calls = [];
  let committed = false;
  let released = false;
  const row = {
    id: '51',
    subject_id: '7',
    class_code: '23DTH1A',
    user_id: '42',
    author_name: 'Nguyen Van A',
    author_university: 'UIT',
    title: 'Find a project group',
    content: 'Looking for teammates.',
    upvote_count: 0,
    created_at: '2026-11-18 10:00:00.000'
  };
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() { released = true; },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT subject_id') && sql.includes('FROM class_sections')) {
        return [[{ subject_id: '7' }], []];
      }
      if (sql.includes('INSERT INTO class_sections')) return [{ affectedRows: 1 }, []];
      if (sql.includes('INSERT INTO class_posts')) return [{ insertId: '51' }, []];
      if (sql.includes('FROM class_posts') && /WHERE (?:class_posts\.)?id = \?/.test(sql)) {
        return [[row], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    async getConnection() { return connection; }
  });
  assert.equal(typeof repository.createPost, 'function');

  const result = await repository.createPost('42', '23DTH1A', {
    subjectId: '7',
    title: row.title,
    content: row.content
  });

  assert.equal(committed, true);
  assert.equal(released, true);
  assert.deepEqual(result, row);
  assert.match(calls[0].sql, /INSERT INTO class_sections/);
  assert.deepEqual(calls[0].params, ['23DTH1A', '7']);
  assert.match(calls[1].sql, /WHERE class_code = \?\s+FOR UPDATE/);
  assert.deepEqual(calls[1].params, ['23DTH1A']);
  assert.match(calls[2].sql, /INSERT INTO class_posts/);
  assert.deepEqual(calls[2].params, ['7', '23DTH1A', '42', row.title, row.content]);
  assert.match(calls[3].sql, /LEFT JOIN users u ON u\.id = class_posts\.user_id/);
});

test('createPost rolls back when a class code is already mapped to another subject', async () => {
  let committed = false;
  let rolledBack = false;
  let postInserted = false;
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() { rolledBack = true; },
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT subject_id') && sql.includes('FROM class_sections')) {
        return [[{ subject_id: '8' }], []];
      }
      if (sql.includes('INSERT INTO class_sections')) return [{ affectedRows: 0 }, []];
      if (sql.includes('INSERT INTO class_posts')) postInserted = true;
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.createPost, 'function');

  await assert.rejects(
    repository.createPost('42', '23DTH1A', {
      subjectId: '7',
      title: 'Question',
      content: 'Question content'
    }),
    error => error.code === 'CLASS_SUBJECT_CONFLICT' && error.status === 409
  );
  assert.equal(rolledBack, true);
  assert.equal(committed, false);
  assert.equal(postInserted, false);
});

test('togglePostVote locks the post and atomically increments a new vote', async () => {
  const calls = [];
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM class_posts') && sql.includes('FOR UPDATE')) {
        return [[{ id: '51', class_code: '23DTH1A', upvote_count: 3 }], []];
      }
      if (sql.includes('FROM post_votes')) return [[], []];
      if (sql.includes('INSERT INTO post_votes')) return [{ insertId: '90' }, []];
      if (sql.includes('UPDATE class_posts')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.togglePostVote, 'function');

  const result = await repository.togglePostVote('42', '51');

  assert.deepEqual(result, {
    upvoted: true,
    upvoteCount: 4,
    classCode: '23DTH1A'
  });
  assert.equal(committed, true);
  assert.match(calls[0].sql, /WHERE id = \?\s+FOR UPDATE/);
  assert.deepEqual(calls[0].params, ['51']);
  assert.deepEqual(calls[1].params, ['51', '42']);
  assert.deepEqual(calls[2].params, ['51', '42']);
  assert.match(calls[3].sql, /upvote_count = upvote_count \+ 1/);
  assert.deepEqual(calls[3].params, ['51']);
});

test('togglePostVote removes an existing vote without making the counter negative', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM class_posts') && sql.includes('FOR UPDATE')) {
        return [[{ id: '51', class_code: '23DTH1A', upvote_count: 0 }], []];
      }
      if (sql.includes('FROM post_votes')) return [[{ id: '90' }], []];
      if (sql.includes('DELETE FROM post_votes')) return [{ affectedRows: 1 }, []];
      if (sql.includes('UPDATE class_posts')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.togglePostVote, 'function');

  const result = await repository.togglePostVote('42', '51');

  assert.deepEqual(result, {
    upvoted: false,
    upvoteCount: 0,
    classCode: '23DTH1A'
  });
  assert.match(calls[2].sql, /DELETE FROM post_votes/);
  assert.deepEqual(calls[2].params, ['51', '42']);
  assert.match(calls[3].sql, /IF\(upvote_count > 0, upvote_count - 1, 0\)/);
});

test('listComments sorts oldest first and binds post pagination', async () => {
  const calls = [];
  const rows = [{ id: '61', post_id: '51', user_id: '42', author_name: 'Nguyen Van A', author_university: 'UIT' }];
  const repository = createRepository({
    async execute(sql, params) {
      calls.push({ sql, params });
      return calls.length === 1
        ? [[{ total: 1 }], []]
        : [rows, []];
    }
  });
  assert.equal(typeof repository.listComments, 'function');

  const result = await repository.listComments('51', 0, 20);

  assert.match(calls[1].sql, /LEFT JOIN users u ON u\.id = post_comments\.user_id/);
  assert.match(calls[1].sql, /ORDER BY (?:post_comments\.)?created_at ASC, (?:post_comments\.)?id ASC/);
  assert.deepEqual(calls[1].params, ['51', '20', '0']);
  assert.deepEqual(result, { rows, total: 1 });
});

test('createComment rechecks and locks the post before inserting the caller-owned comment', async () => {
  const calls = [];
  let committed = false;
  const row = {
    id: '61',
    post_id: '51',
    user_id: '42',
    author_name: 'Nguyen Van A',
    author_university: 'UIT',
    content: 'I can join.',
    upvote_count: 0,
    created_at: '2026-11-18 11:00:00.000'
  };
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT id') && sql.includes('FROM class_posts')) {
        return [[{ id: '51' }], []];
      }
      if (sql.includes('INSERT INTO post_comments')) return [{ insertId: '61' }, []];
      if (sql.includes('FROM post_comments') && /WHERE (?:post_comments\.)?id = \?/.test(sql)) {
        return [[row], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.createComment, 'function');

  const result = await repository.createComment('42', '51', { content: row.content });

  assert.equal(committed, true);
  assert.deepEqual(result, row);
  assert.match(calls[0].sql, /WHERE id = \?\s+FOR UPDATE/);
  assert.deepEqual(calls[0].params, ['51']);
  assert.deepEqual(calls[1].params, ['51', '42', row.content]);
  assert.match(calls[2].sql, /LEFT JOIN users u ON u\.id = post_comments\.user_id/);
});

test('toggleCommentVote writes the vote and count in one locked transaction', async () => {
  const calls = [];
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM post_comments') && sql.includes('FOR UPDATE')) {
        return [[{ id: '61', upvote_count: 1 }], []];
      }
      if (sql.includes('FROM comment_votes')) return [[], []];
      if (sql.includes('INSERT INTO comment_votes')) return [{ insertId: '91' }, []];
      if (sql.includes('UPDATE post_comments')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.toggleCommentVote, 'function');

  const result = await repository.toggleCommentVote('42', '61');

  assert.deepEqual(result, { upvoted: true, upvoteCount: 2 });
  assert.equal(committed, true);
  assert.match(calls[0].sql, /WHERE id = \?\s+FOR UPDATE/);
  assert.deepEqual(calls[0].params, ['61']);
  assert.deepEqual(calls[1].params, ['61', '42']);
  assert.deepEqual(calls[2].params, ['61', '42']);
  assert.match(calls[3].sql, /upvote_count = upvote_count \+ 1/);
});

test('deleteMyPost requires the authenticated owner and returns the section code', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT class_code') && sql.includes('FROM class_posts')) {
        return [[{ class_code: '23DTH1A' }], []];
      }
      if (sql.includes('DELETE FROM class_posts')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const repository = createRepository({
    getConnection: async () => connection
  });
  assert.equal(typeof repository.deleteMyPost, 'function');

  assert.equal(await repository.deleteMyPost('42', '51'), '23DTH1A');
  assert.deepEqual(calls[0].params, ['51', '42']);
  assert.match(calls[0].sql, /WHERE id = \? AND user_id = \?\s+FOR UPDATE/);
  assert.deepEqual(calls[1].params, ['51', '42']);
});

test('listPosts joins users for authorName and authorUniversity and binds class pagination', async () => {
  const calls = [];
  const rows = [{
    id: '51',
    subject_id: '7',
    class_code: '23DTH1A',
    user_id: '42',
    author_name: 'Nguyen Van A',
    author_university: 'UIT'
  }];
  const repository = createRepository({
    async execute(sql, params) {
      calls.push({ sql, params });
      return calls.length === 1
        ? [[{ total: 3 }], []]
        : [rows, []];
    }
  });

  const result = await repository.listPosts('23DTH1A', 0, 20);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, ['23DTH1A']);
  assert.match(calls[1].sql, /LEFT JOIN users u ON u\.id = class_posts\.user_id/);
  assert.match(calls[1].sql, /u\.full_name AS author_name/);
  assert.match(calls[1].sql, /u\.university AS author_university/);
  assert.deepEqual(calls[1].params, ['23DTH1A', '20', '0']);
  assert.deepEqual(result, { rows, total: 3 });
});
