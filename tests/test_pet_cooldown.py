import unittest,time
from unittest.mock import patch
import test_saves
from app import database
class PetCooldownTests(unittest.TestCase):
 setUp=test_saves.SaveTests.setUp;tearDown=test_saves.SaveTests.tearDown;post=test_saves.SaveTests.post;login_as=test_saves.SaveTests.login_as
 def test_rounded_database_timestamp_does_not_block_feeding(self):
  uid=self.login_as(self.a,'Feeder');self.post(self.a,'join',{'nickname':'A'})
  stamp=time.time()-10
  with database() as db:db.execute('UPDATE game_saves SET dog_name=?,dog_food=3,dog_interaction_at=? WHERE user_id=?',('Dog',stamp,uid))
  class RoundedRow(dict):pass
  from app import database as real_database
  from contextlib import contextmanager
  @contextmanager
  def rounded_database():
   with real_database() as db:
    class Connection:
     def execute(self,query,args=()):
      result=db.execute(query,args)
      if query.startswith('SELECT * FROM game_saves'):
       class Result:
        def fetchone(self):
         row=RoundedRow(result.fetchone());row['dog_interaction_at']=float(format(row['dog_interaction_at'],'.15g'));return row
       return Result()
      return result
    yield Connection()
  with patch('app.database',rounded_database),patch('app.time.time',return_value=stamp+10):
   response=self.post(self.a,'pet-action',{'action':'feed'})
   self.assertEqual(response.status_code,200,response.json);self.assertEqual(response.json['pet']['food'],2);self.assertEqual(response.json['pet']['xp'],25)
   self.assertEqual(self.post(self.a,'pet-action',{'action':'feed'}).status_code,429)
 def test_waiting_five_seconds_allows_another_feed(self):
  uid=self.login_as(self.a,'RepeatFeeder');self.post(self.a,'join',{'nickname':'A'})
  with database() as db:db.execute('UPDATE game_saves SET dog_name=?,dog_food=2 WHERE user_id=?',('Dog',uid))
  now=time.time()
  with patch('app.time.time',return_value=now):self.assertEqual(self.post(self.a,'pet-action',{'action':'feed'}).status_code,200)
  with patch('app.time.time',return_value=now+4):self.assertEqual(self.post(self.a,'pet-action',{'action':'feed'}).status_code,429)
  with patch('app.time.time',return_value=now+5):
   response=self.post(self.a,'pet-action',{'action':'feed'});self.assertEqual(response.status_code,200);self.assertEqual(response.json['pet']['food'],0);self.assertEqual(response.json['pet']['xp'],50)
