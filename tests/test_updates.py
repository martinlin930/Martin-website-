import unittest
import test_world
from app import app,APP_VERSION
class UpdateTests(unittest.TestCase):
 setUp=test_world.WorldTests.setUp;tearDown=test_world.WorldTests.tearDown;post=test_world.WorldTests.post
 def test_version_endpoint_is_public_and_uncached(self):
  r=self.a.get('/api/version');self.assertEqual(r.status_code,200);self.assertEqual(r.json['version'],APP_VERSION);self.assertEqual(r.headers['Cache-Control'],'no-store')
 def test_pages_include_white_update_curtain_and_bootstrap(self):
  for route in ['/','/world','/forum','/login','/work']:
   r=self.a.get(route);self.assertEqual(r.status_code,200);self.assertIn('content:"Updating"',r.text);self.assertIn('auto-update.js',r.text);self.assertIn(APP_VERSION,r.text);self.assertEqual(r.headers['Cache-Control'],'no-cache')
 def test_world_state_notifies_players_about_the_version(self):
  self.post(self.a,'join',{'nickname':'Player','avatar':'r2-001'});r=self.post(self.a,'state',{});self.assertEqual(r.json['version'],APP_VERSION)
