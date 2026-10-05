import io
import unittest
from PIL import Image
from app import app,database
import test_saves

class ForumTests(unittest.TestCase):
    setUp=test_saves.SaveTests.setUp
    tearDown=test_saves.SaveTests.tearDown
    login_as=test_saves.SaveTests.login_as
    def send(self,client,path,data,files=False):
        with client.session_transaction() as s:token=s['csrf_token']
        kwargs={'data':data,'content_type':'multipart/form-data'} if files else {'json':data}
        return client.post('/api/forum'+path,headers={'X-CSRF-Token':token},**kwargs)
    def photo(self):
        image=Image.new('RGB',(2200,1400),(120,170,100));out=io.BytesIO();image.save(out,'JPEG');out.seek(0);return out
    def test_public_feed_photo_comment_and_login_restoration(self):
        uid=self.login_as(self.a,'Alice')
        response=self.send(self.a,'/posts',{'display_name':'爱丽丝','body':'我是 Alice 🌿 <script> / "','photos':(self.photo(),'photo.jpg')},True)
        self.assertEqual(response.status_code,201)
        pid=response.json['id'];feed=self.b.get('/api/forum/posts').json['posts']
        self.assertEqual(feed[0]['display_name'],'爱丽丝');self.assertIn('<script>',feed[0]['body'])
        self.assertIsInstance(feed[0]['created'],float)
        picture=self.b.get(feed[0]['images'][0]);self.assertEqual(picture.mimetype,'image/jpeg')
        decoded=Image.open(io.BytesIO(picture.data));self.assertLessEqual(max(decoded.size),1600)
        self.assertEqual(self.send(self.b,f'/posts/{pid}/comments',{'body':'Guest'}).status_code,401)
        self.login_as(self.b,'Bob')
        self.assertEqual(self.send(self.b,f'/posts/{pid}/comments',{'body':'你好 🌍 <>&','user_id':uid}).status_code,201)
        comment=self.a.get(f'/api/forum/posts/{pid}/comments').json['comments'][0]
        self.assertEqual((comment['display_name'],comment['body']),('Bob','你好 🌍 <>&'))
        self.assertEqual(self.a.get('/api/forum/posts').json['posts'][0]['comment_count'],1)
        with self.a.session_transaction() as s:s.clear()
        self.a.get('/forum');self.assertEqual(len(self.a.get('/api/forum/posts').json['posts']),1)
        self.assertEqual(len(self.a.get(f'/api/forum/posts/{pid}/comments').json['comments']),1)
        with database() as db:self.assertEqual(db.execute('SELECT user_id FROM forum_comments').fetchone()[0],2)
    def test_validation_csrf_and_images(self):
        self.assertEqual(self.send(self.a,'/posts',{'body':'x'},True).status_code,401)
        self.login_as(self.a,'Alice')
        for data in [{'body':''},{'body':'x'*4001},{'display_name':'','body':'x'}]:
            self.assertEqual(self.send(self.a,'/posts',data,True).status_code,400)
        self.assertEqual(self.a.post('/api/forum/posts',data={'body':'x'}).status_code,400)
        self.assertEqual(self.send(self.a,'/posts',{'body':'x','photos':(io.BytesIO(b'<svg>script</svg>'),'fake.jpg')},True).status_code,400)
        self.assertEqual(self.send(self.a,'/posts',{'body':'x','photos':(io.BytesIO(b'x'*(4*1024*1024+1)),'huge.jpg')},True).status_code,400)
        pid=self.send(self.a,'/posts',{'body':'hello'},True).json['id']
        self.assertEqual(self.send(self.a,'/posts',{'body':'too soon'},True).status_code,429)
        self.assertEqual(self.send(self.a,f'/posts/{pid}/comments',{'body':'x'*1001}).status_code,400)
        self.assertEqual(self.send(self.a,'/posts/999/comments',{'body':'hello'}).status_code,404)
        self.assertEqual(self.a.get('/api/forum/images/999').status_code,404)
    def test_pagination_does_not_duplicate_posts(self):
        uid=self.login_as(self.a,'Alice')
        with database() as db:
            for i in range(23):db.execute('INSERT INTO forum_posts(user_id,display_name,body,created) VALUES(?,?,?,?)',(uid,'Alice',str(i),i))
        first=self.b.get('/api/forum/posts').json
        second=self.b.get('/api/forum/posts?before='+str(first['next'])).json
        self.assertEqual((len(first['posts']),len(second['posts'])),(20,3))
        self.assertFalse({p['id'] for p in first['posts']} & {p['id'] for p in second['posts']})

    def test_account_return_destination_is_local_forum_only(self):
        self.a.get('/register?next=/forum')
        with self.a.session_transaction() as s:token=s['csrf_token']
        result=self.a.post('/register?next=/forum',data={'username':'ForumReturn','password':'safe-test-password','csrf_token':token})
        self.assertEqual(result.location,'/forum')
        self.assertEqual(self.a.get('/login?next=https://example.com').location,'/account')
        self.assertIn('next=/forum',self.b.get('/login?next=/forum').text)
