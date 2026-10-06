import unittest
from app import database
from test_forum import ForumTests

class AvatarFrameTests(unittest.TestCase):
    setUp=ForumTests.setUp
    tearDown=ForumTests.tearDown
    login_as=ForumTests.login_as
    send=ForumTests.send
    def test_existing_content_uses_account_frame_not_display_name(self):
        uid=self.login_as(self.a,'hi')
        pid=self.send(self.a,'/posts',{'display_name':'Different nickname','body':'Existing post'},True).json['id']
        self.send(self.a,f'/posts/{pid}/comments',{'body':'Existing comment'})
        with database() as db:db.execute("UPDATE users SET avatar_frame='pig' WHERE id=?",(uid,))
        post=self.b.get('/api/forum/posts').json['posts'][0]
        self.assertEqual((post['avatar_frame'],post['avatar_label']),('pig','hi'))
        self.assertEqual(post['display_name'],'Different nickname')
        comment=self.b.get(f'/api/forum/posts/{pid}/comments').json['comments'][0]
        self.assertEqual((comment['avatar_frame'],comment['avatar_label']),('pig','hi'))
        self.login_as(self.b,'Other')
        self.send(self.b,'/posts',{'display_name':'hi','body':'No frame','avatar_frame':'pig'},True)
        self.assertEqual(self.a.get('/api/forum/posts').json['posts'][0]['avatar_frame'],'')
        for path in ['/forum','/account']:
            page=self.a.get(path)
            self.assertEqual(page.status_code,200)
            self.assertIn('/static/avatar-frames/pig.png',page.text)
            self.assertIn('avatar-center">hi',page.text)
    def test_unknown_frame_keys_are_not_exposed(self):
        uid=self.login_as(self.a,'Other')
        with database() as db:db.execute("UPDATE users SET avatar_frame='https://untrusted.invalid/' WHERE id=?",(uid,))
        self.send(self.a,'/posts',{'body':'No unknown asset'},True)
        post=self.b.get('/api/forum/posts').json['posts'][0]
        self.assertEqual((post['avatar_frame'],post['avatar_label']),('',''))
