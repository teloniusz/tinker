import unittest
from datetime import datetime
from unittest import mock
from unittest.mock import patch, MagicMock
from flask_socketio import SocketIO
from flask import json

from app import app as flask_app
from app.base.views import wshello, Versions


class TestBase(unittest.TestCase):
    @patch('app.base.views.db')
    def test_app_get(self, mock_db):
        # given app
        mock_version = MagicMock()
        mock_version.version = '1.0'
        mock_version.modified.strftime.return_value = '2023-05-08 14:30:00'
        mock_db.query.return_value.order_by.return_value.limit.return_value.one_or_none.return_value = mock_version

        # execute
        with flask_app.test_client() as test_client:
            response = test_client.get("/api/base/")
            data = json.loads(response.data)

            # assert
            self.assertEqual(response.status_code, 200)
            self.assertTrue(all(key in data for key in ('message', 'modified', 'version')))

    def test_app_post(self):
        # given app

        # execute
        with flask_app.test_client() as test_client:
            response = test_client.post("api/base/")

            # assert
            self.assertEqual(response.status_code, 405)

    @mock.patch('app.base.views.fs')
    @mock.patch('app.base.views.Versions')
    @unittest.skip("need to setup socketio differently")
    def test_ws_hello(self, versions, fs):
        flask_app.sio = SocketIO(flask_app)
        with mock.patch.object(flask_app, 'sio') as sio:
            data = {'data': ["some", "data"]}
            with self.subTest('no data in db'):
                fs.current_user = None
                sio.emit.reset_mock()
                versions.query.order_by.return_value.first.reset_mock()
                versions.query.order_by.return_value.first.return_value = None
                wshello(data)
                sio.emit.assert_called_once_with('hello_response',
                                                 {'message': 'Hello, world, ' + str(data["data"]) + ', you are: None'})
                versions.query.order_by.return_value.first.assert_called_once()

            with self.subTest('version and user data in the db'):
                fs.current_user = 'some user'
                created = datetime(2020, 10, 1, 11, 15)
                modified = datetime(2020, 10, 10, 15, 11)
                sio.emit.reset_mock()
                versions.query.order_by.return_value.first.reset_mock()
                versions.query.order_by.return_value.first.return_value = Versions(version='1.2.3', created=created,
                                                                                   modified=modified)
                wshello(data)
                versions.query.order_by.return_value.first.assert_called_once()
                sio.emit.assert_called_once_with('hello_response', {
                    'message': 'Hello, world, you sent: ' + repr(data['data']) + ', you are: some user',
                    'version': '1.2.3',
                    'modified': modified.strftime('%F %T')
                })


if __name__ == '__main__':
    unittest.main()
