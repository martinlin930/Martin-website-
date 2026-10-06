import os, tempfile, unittest
os.environ['DATABASE_PATH']=tempfile.mktemp(suffix='.sqlite3')
os.environ['SECRET_KEY']='temporary-gallery-test-key'
os.environ.pop('DATABASE_URL',None)
from app import app, database

class GalleryTest(unittest.TestCase):
    def client(self):
        c=app.test_client()
        self.assertEqual(c.get('/gallery').status_code,200)
        with c.session_transaction() as s: token=s['csrf_token']
        c.token=token
        return c
    def post(self,c,path,data):
        return c.post('/api/'+path,json=data,headers={'X-CSRF-Token':c.token})
    def join(self,c):
        r=self.post(c,'gallery/join',{'nickname':'你好🙂','avatar':'r2-005'})
        self.assertEqual(r.status_code,200)
        return r.json['id']
    def state(self,c,pid,**kwargs):
        return self.post(c,'gallery/state',dict(player_id=pid,x=-19,z=-14,yaw=0,pitch=0,jump=0,running=False,music_muted=False,**kwargs))
    def test_multiplayer_and_security(self):
        a,b=self.client(),self.client(); pa,pb=self.join(a),self.join(b)
        self.assertEqual(self.state(a,pa).json['players'][0]['id'],pb)
        self.assertEqual(self.state(b,pa).status_code,401)
        r=self.post(a,'gallery/chat',{'player_id':pa,'message':'中文🙂 <script> hello! 日本語'})
        self.assertEqual(r.status_code,200)
        self.assertEqual(self.state(b,pb).json['messages'][-1]['body'],'中文🙂 <script> hello! 日本語')
        self.assertEqual(self.post(a,'gallery/state',{'player_id':pa,'x':float('nan')}).status_code,400)
        self.assertEqual(a.post('/api/gallery/chat',json={'player_id':pa,'message':'x'}).status_code,400)
        self.post(a,'gallery/leave',{'player_id':pa});self.post(b,'gallery/leave',{'player_id':pb})
    def test_saved_separate_from_town(self):
        c=self.client()
        with database() as db:
            uid=db.execute("INSERT INTO users(username,password_hash) VALUES('gallery-test','unused') RETURNING id").fetchone()['id']
            db.execute('INSERT INTO game_saves(user_id,nickname,avatar,x,z,yaw,updated) VALUES(?,?,?,?,?,?,?)',(uid,'Town','r2-001',100,-100,0,1))
        with c.session_transaction() as s: s['user_id']=uid;s['username']='gallery-test'
        pid=self.join(c)
        self.assertEqual(self.post(c,'gallery/state',dict(player_id=pid,x=-18,z=-13,yaw=1,pitch=.2,jump=0,running=False,music_muted=False)).status_code,200)
        self.post(c,'gallery/leave',{'player_id':pid})
        next_join=self.post(c,'gallery/join',{'nickname':'回来','avatar':'r2-006'}).json
        self.assertEqual(next_join['state']['x'],-18)
        self.assertEqual(next_join['state']['pitch'],.2)
        with database() as db: self.assertEqual(db.execute('SELECT x FROM game_saves WHERE user_id=?',(uid,)).fetchone()['x'],100)
        self.assertEqual(c.get('/work').location,'/gallery')

if __name__=='__main__': unittest.main()
