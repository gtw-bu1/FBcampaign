import test from 'node:test';
import assert from 'node:assert/strict';
import { validPostId, isAlbumPhotoPost } from '../api/delete-post.js';

test('刪除端點只接受合法貼文編號', () => {
  assert.equal(validPostId('284455941624148_1572308271600147'), true);
  assert.equal(validPostId('1572308271600147'), true);
  assert.equal(validPostId('123'), false);
  assert.equal(validPostId('123456/../me'), false);
  assert.equal(validPostId(''), false);
  assert.equal(validPostId(null), false);
});

test('認出「相簿照片型」貼文:貼文編號尾碼就是照片 fbid', () => {
  // 2026-11-25 真實資料:舊版排程發出來的那則,看不到的就是這種
  const broken = {
    id: '284455941624148_1572308271600147',
    permalink_url: 'https://www.facebook.com/photo.php?fbid=1572308271600147&set=a.603936908437293&type=3',
    attachments: { data: [{ media_type: 'photo', url: 'https://www.facebook.com/photo.php?fbid=1572308271600147&set=a.603936908437293&type=3' }] }
  };
  assert.equal(isAlbumPhotoPost(broken), true);

  // 正常動態貼文:貼文編號與照片 fbid 不同,permalink 是 /posts/
  const good = {
    id: '284455941624148_1579963497501291',
    permalink_url: 'https://www.facebook.com/1572421051588869/posts/1579963497501291',
    attachments: { data: [{ media_type: 'photo', url: 'https://www.facebook.com/photo.php?fbid=1579963467501294&set=a.603936908437293&type=3' }] }
  };
  assert.equal(isAlbumPhotoPost(good), false);

  assert.equal(isAlbumPhotoPost(null), false);
  assert.equal(isAlbumPhotoPost({ id: '1_2' }), false);
});
