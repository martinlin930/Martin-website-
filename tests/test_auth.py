import re
import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import app


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        app.config.update(TESTING=True, DATABASE=str(Path(self.temp.name) / 'users.sqlite3'))
        self.client = app.test_client()

    def tearDown(self):
        self.temp.cleanup()

    def submit(self, route, **data):
        page = self.client.get(route)
        token = re.search(r'name="csrf_token" value="([^"]+)"', page.text)[1]
        return self.client.post(route, data={**data, 'csrf_token': token})

    def register(self):
        return self.submit('/register', username='visitor', password='valid-password')

    def logout(self):
        page = self.client.get('/account')
        token = re.search(r'name="csrf_token" value="([^"]+)"', page.text)[1]
        return self.client.post('/logout', data={'csrf_token': token})

    def test_register_login_logout_and_storage(self):
        self.assertEqual(self.client.get('/account').location, '/login')
        self.assertEqual(self.register().location, '/account')
        self.assertIn('visitor', self.client.get('/account').text)
        with sqlite3.connect(app.config['DATABASE']) as db:
            stored = db.execute('SELECT password_hash FROM users').fetchone()[0]
        self.assertNotIn('valid-password', stored)
        self.assertTrue(stored.startswith('scrypt:'))
        self.assertEqual(self.logout().location, '/')
        self.assertEqual(self.client.get('/account').location, '/login')
        result = self.submit('/login', username='visitor', password='wrong-password')
        self.assertIn('Incorrect username or password.', result.text)
        self.assertEqual(self.client.get('/account').location, '/login')
        self.assertEqual(self.submit('/login', username='visitor', password='valid-password').location, '/account')

    def test_duplicate_short_password_and_csrf(self):
        self.assertEqual(self.client.post('/register', data={'username': 'x', 'password': 'password'}).status_code, 400)
        self.assertIn('at least 8 characters', self.submit('/register', username='x', password='short').text)
        self.register()
        self.assertEqual(self.client.post('/logout').status_code, 400)
        self.logout()
        self.assertIn('already taken', self.register().text)

    def test_failed_attempt_limit(self):
        self.register()
        self.logout()
        for _ in range(10):
            self.assertEqual(self.submit('/login', username='visitor', password='incorrect').status_code, 200)
        self.assertEqual(self.submit('/login', username='visitor', password='valid-password').status_code, 429)

    def test_public_pages_and_escaped_username(self):
        self.assertEqual(self.client.get('/').status_code, 200)
        self.assertEqual(self.client.get('/work').status_code, 200)
        self.submit('/register', username='<script>alert(1)</script>', password='valid-password')
        page = self.client.get('/account').text
        self.assertIn('&lt;script&gt;', page)
        self.assertNotIn('<script>alert(1)</script>', page)


if __name__ == '__main__':
    unittest.main()
