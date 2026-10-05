import json, unittest
from unittest.mock import patch
from pathlib import Path
from app import app,database
import test_saves
class AnimalTests(unittest.TestCase):
 setUp=test_saves.SaveTests.setUp
 tearDown=test_saves.SaveTests.tearDown
 login_as=test_saves.SaveTests.login_as
 post=test_saves.SaveTests.post
 def prepare(self):
  uid=self.login_as(self.a,'Alice');joined=self.post(self.a,'join',{'nickname':'A'}).json
  spot=json.loads(Path('static/animal-spots.json').read_text())[0]
  self.post(self.a,'state',{'x':spot['x'],'z':spot['z']})
  return uid,spot
 def action(self,action,kind='Cow',**extra):return self.post(self.a,'animal',{'action':action,'kind':kind,'name':'小牛',**extra})
 def test_adopt_feed_level_and_return_login(self):
  uid,spot=self.prepare();self.assertEqual(self.action('adopt').status_code,200)
  with database() as db:db.execute('UPDATE game_saves SET dog_food=10 WHERE user_id=?',(uid,))
  for i in range(4):
   with patch('animals.time') as clock:
    clock.time.return_value=2000000000+i*6;r=self.action('feed')
   self.assertEqual(r.status_code,200)
  self.assertEqual(r.json['animals']['Cow']['xp'],100);self.assertEqual(r.json['pet']['food'],6)
  self.post(self.a,'leave',{})
  self.login_as(self.b,'Alice');joined=self.post(self.b,'join',{'nickname':'A'}).json
  self.assertEqual(joined['animals']['Cow']['name'],'小牛');self.assertEqual(joined['animals']['Cow']['xp'],100)
  self.assertEqual(self.post(self.b,'state',{}).json['animals']['active'],'Cow')
 def test_constraints_cooldown_and_isolation(self):
  uid,spot=self.prepare()
  self.assertEqual(self.action('adopt',kind='Dragon').status_code,400)
  self.assertEqual(self.action('adopt',kind='Horse').status_code,400)
  self.assertEqual(self.action('adopt',name='').status_code,400)
  self.action('adopt')
  self.assertEqual(self.action('feed').status_code,400)
  self.assertEqual(self.action('pet',xp=99999,user_id=2).json['animals']['Cow']['xp'],5)
  self.assertEqual(self.action('pet').status_code,429)
  self.login_as(self.b,'Bob');joined=self.post(self.b,'join',{'nickname':'B'}).json
  self.assertEqual(joined['animals'],{})
  guest=app.test_client();guest.get('/world');self.post(guest,'join',{'nickname':'G'})
  self.assertEqual(self.post(guest,'animal',{'action':'adopt','kind':'Cow','name':'X'}).status_code,401)
 def test_level_cap_switch_species_and_rename_keeps_progress(self):
  uid,spot=self.prepare();self.action('adopt')
  with database() as db:db.execute('UPDATE game_saves SET animal_pets=?,dog_food=2 WHERE user_id=?',(json.dumps({'active':'Cow','Cow':{'name':'小牛','xp':9999,'interaction_at':0}}),uid))
  self.assertEqual(self.action('feed').json['animals']['Cow']['xp'],10000)
  r=self.action('adopt',name='大牛');self.assertEqual(r.json['animals']['Cow']['xp'],10000)
  spots=json.loads(Path('static/animal-spots.json').read_text());horse=next(s for s in spots if s['kind']=='Horse')
  self.post(self.a,'state',{'x':horse['x'],'z':horse['z']});r=self.action('adopt',kind='Horse',name='小马')
  self.assertEqual(r.json['animals']['active'],'Horse');self.assertEqual(r.json['animals']['Cow']['xp'],10000)
  self.assertEqual(self.action('feed',kind='Cow').status_code,400)
  r=self.action('adopt',kind='Cow');self.assertEqual(r.json['animals']['active'],'Cow')
