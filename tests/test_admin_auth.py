import importlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Request, Response


app_module = importlib.import_module("src.app")


def make_request(session_id=None):
    headers = []
    if session_id:
        headers.append(
            (b"cookie", f"teacher_session={session_id}".encode("ascii"))
        )
    return Request({"type": "http", "headers": headers})


class TeacherAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.credentials_file = Path(self.temp_directory.name) / "teachers.json"

    def tearDown(self):
        self.temp_directory.cleanup()

    def write_teacher(self, password="correct-password"):
        self.credentials_file.write_text(
            json.dumps(
                {
                    "teachers": [
                        {
                            "username": "teacher",
                            "password_hash": app_module.hash_teacher_password(password),
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

    def test_password_hash_verifies_without_storing_plaintext(self):
        password_hash = app_module.hash_teacher_password("correct-password")

        self.assertNotIn("correct-password", password_hash)
        self.assertTrue(
            app_module.verify_teacher_password("correct-password", password_hash)
        )
        self.assertFalse(
            app_module.verify_teacher_password("wrong-password", password_hash)
        )

    def test_login_creates_a_session_and_logout_revokes_it(self):
        self.write_teacher()
        response = Response()

        with patch.object(app_module, "TEACHER_CREDENTIALS_FILE", self.credentials_file):
            app_module.login_teacher(
                app_module.TeacherLogin(
                    username="teacher",
                    password="correct-password",
                ),
                response,
            )

        cookie = response.headers["set-cookie"].split(";", 1)[0]
        session_id = cookie.split("=", 1)[1]
        request = make_request(session_id)
        self.assertEqual(app_module.require_teacher(request), "teacher")

        app_module.logout_teacher(request, Response())
        with self.assertRaises(HTTPException) as error:
            app_module.require_teacher(request)
        self.assertEqual(error.exception.status_code, 401)

    def test_invalid_password_is_rejected(self):
        self.write_teacher()

        with patch.object(app_module, "TEACHER_CREDENTIALS_FILE", self.credentials_file):
            with self.assertRaises(HTTPException) as error:
                app_module.login_teacher(
                    app_module.TeacherLogin(
                        username="teacher",
                        password="wrong-password",
                    ),
                    Response(),
                )

        self.assertEqual(error.exception.status_code, 401)

    def test_registration_routes_require_teacher_authentication(self):
        protected_routes = {
            (route.path, method): route
            for route in app_module.app.routes
            if hasattr(route, "dependant")
            for method in route.methods
        }

        for path, method in (
            ("/activities/{activity_name}/signup", "POST"),
            ("/activities/{activity_name}/unregister", "DELETE"),
        ):
            dependencies = protected_routes[(path, method)].dependant.dependencies
            self.assertIn(
                app_module.require_teacher,
                [dependency.call for dependency in dependencies],
            )

    def test_missing_teacher_configuration_fails_closed(self):
        with patch.object(
            app_module,
            "TEACHER_CREDENTIALS_FILE",
            self.credentials_file,
        ):
            with self.assertRaises(HTTPException) as error:
                app_module.load_teacher_credentials()

        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
