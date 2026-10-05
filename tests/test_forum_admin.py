import unittest
from app import app,database
import test_forum

class ForumAdminTests(unittest.TestCase):
    setUp=test_forum.ForumTests.setUp
    tearDown=test_forum.ForumTests.tearDown
    login_as=test_forum.ForumTests.login_as
    send=test_forum.ForumTests.send
    photo=test_forum.ForumTests.photo
    def set_admin(self,client):
        uid=self.login_as(client,'MartinLin')
        with database() as db:db.execute('UPDATE users SET is_admin=1 WHERE id=?',(uid,))
        return uid
    def seed_post(self):
        self.login_as(self.a,'Alice')
        pid=self.send(self.a,'/posts',{'body':'普通用户的动态','photos':(self.photo(),'photo.jpg')},True).json['id']
        cid=self.send(self.a,f'/posts/{pid}/comments',{'body':'评论'}).json['id']
        image=self.a.get('/api/forum/posts').json['posts'][0]['images'][0]
        return pid,cid,image
    def test_admin_deletion_hides_post_comments_and_image_and_survives_restart(self):
        pid,cid,image=self.seed_post();uid=self.set_admin(self.b)
        self.assertIn('window.forumAdmin=true',self.b.get('/forum').text)
        self.assertEqual(self.send(self.b,f'/posts/{pid}/delete',{}).status_code,200)
        self.assertEqual(self.a.get('/api/forum/posts').json['posts'],[])
        self.assertEqual(self.a.get(f'/api/forum/posts/{pid}/comments').status_code,404)
        self.assertEqual(self.a.get(image).status_code,404)
        self.assertEqual(self.send(self.a,f'/posts/{pid}/comments',{'body':'不能添加'}).status_code,404)
        with database() as db:
            row=db.execute('SELECT deleted_at,deleted_by FROM forum_posts WHERE id=?',(pid,)).fetchone()
            self.assertGreater(row['deleted_at'],0);self.assertEqual(row['deleted_by'],uid)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM forum_images').fetchone()[0],1)
        self.assertEqual(self.send(self.b,f'/posts/{pid}/delete',{}).status_code,404)
    def test_comment_deletion_updates_count_and_keeps_post(self):
        pid,cid,image=self.seed_post();self.set_admin(self.b)
        self.assertEqual(self.send(self.b,f'/comments/{cid}/delete',{}).status_code,200)
        self.assertEqual(self.a.get(f'/api/forum/posts/{pid}/comments').json['comments'],[])
        self.assertEqual(self.a.get('/api/forum/posts').json['posts'][0]['comment_count'],0)
        self.assertEqual(self.a.get(image).status_code,200)
    def test_guest_and_ordinary_user_cannot_delete_or_claim_role(self):
        pid,cid,image=self.seed_post();self.b.get('/forum')
        self.assertEqual(self.send(self.b,f'/posts/{pid}/delete',{}).status_code,401)
        self.assertEqual(self.send(self.a,f'/posts/{pid}/delete',{'is_admin':1}).status_code,403)
        self.assertEqual(self.send(self.a,f'/comments/{cid}/delete',{'username':'MartinLin'}).status_code,403)
        with self.a.session_transaction() as s:s['username']='MartinLin';s['is_admin']=True
        self.assertEqual(self.send(self.a,f'/posts/{pid}/delete',{}).status_code,403)
        self.assertIn('window.forumAdmin=false',self.a.get('/forum').text)
        self.assertEqual(len(self.a.get('/api/forum/posts').json['posts']),1)
    def test_csrf_and_revoked_admin_are_checked_for_every_action(self):
        pid,cid,image=self.seed_post();uid=self.set_admin(self.b)
        self.assertEqual(self.b.post(f'/api/forum/posts/{pid}/delete').status_code,400)
        with database() as db:db.execute('UPDATE users SET is_admin=0 WHERE id=?',(uid,))
        self.assertEqual(self.send(self.b,f'/posts/{pid}/delete',{}).status_code,403)
    def test_registration_cannot_request_admin(self):
        self.b.get('/register')
        with self.b.session_transaction() as s:token=s['csrf_token']
        response=self.b.post('/register',data={'username':'NewUser','password':'test-pass-123','is_admin':'1','csrf_token':token})
        self.assertEqual(response.status_code,302)
        with database() as db:self.assertEqual(db.execute('SELECT is_admin FROM users WHERE username=?',('NewUser',)).fetchone()['is_admin'],0)
