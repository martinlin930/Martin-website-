import tempfile
import unittest
from pathlib import Path
from app import app

class WorldTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        app.config.update(TESTING=True,DATABASE=str(Path(self.temp.name)/'world.sqlite3'))
        self.a=app.test_client();self.b=app.test_client()
        for c in (self.a,self.b):
            c.get('/world')
    def tearDown(self):self.temp.cleanup()
    def post(self,c,path,body):
        with c.session_transaction() as s:token=s['csrf_token']
        return c.post('/api/world/'+path,json=body,headers={'X-CSRF-Token':token})
    def test_multiplayer_chat_leave(self):
        self.assertEqual(self.post(self.a,'state',{}).status_code,401)
        self.post(self.a,'join',{'nickname':'Alice'});self.post(self.b,'join',{'nickname':'Bob'})
        self.post(self.a,'state',{'x':3,'z':4})
        state=self.post(self.b,'state',{}).json
        self.assertEqual(state['players'][0]['nickname'],'Alice')
        self.assertEqual(state['players'][0]['x'],3)
        self.assertEqual(self.post(self.a,'chat',{'message':'Hello'}).status_code,200)
        self.assertEqual(self.post(self.b,'state',{}).json['messages'][0]['body'],'Hello')
        self.assertEqual(self.post(self.a,'chat',{'message':'Again'}).status_code,429)
        self.post(self.a,'leave',{})
        self.assertEqual(self.post(self.b,'state',{}).json['players'],[])
    def test_validation(self):
        self.assertEqual(self.post(self.a,'join',{'nickname':' '}).status_code,400)
        self.post(self.a,'join',{'nickname':'Alice'})
        self.assertEqual(self.post(self.a,'state',{'x':'bad'}).status_code,400)
        self.assertEqual(self.post(self.a,'chat',{'message':'x'*241}).status_code,400)
        self.assertEqual(self.a.post('/api/world/chat',json={'message':'Hi'}).status_code,400)
