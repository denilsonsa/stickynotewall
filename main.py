#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vi:ts=4 sw=4 et

import os.path

from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext.webapp.util import login_required


def get_path(*args):
    '''Convenience function to return the actual path for some file.'''

    return os.path.join(os.path.dirname(__file__), *args)


class StickyNote(db.Model):
    user = db.UserProperty()

    # StringProperty is a "short string", limited to 500 chars
    # TextProperty is a "long string", limited a megabyte
    text = db.StringProperty(multiline=True)

    x = db.IntegerProperty(required=True)
    y = db.IntegerProperty(required=True)
    z = db.IntegerProperty(default=0)

    width = db.IntegerProperty(required=True)
    height = db.IntegerProperty(required=True)

    creation_datetime = db.DateTimeProperty(auto_now_add=True)
    last_modified_datetime = db.DateTimeProperty(auto_now=True)


class BaseHandler(webapp.RequestHandler):
    def requires_login(self):
        '''Redirects the user to the login page, if needed.'''

        self.user = users.get_current_user()
        if not self.user:
            self.redirect(users.create_login_url(self.request.uri))

        self.logout_url = users.create_logout_url(self.request.uri)


class MainPage(BaseHandler):
    def get(self):
        self.requires_login()

        notes = StickyNote.all().filter('user =', self.user) 

        template_values = {
            'user': self.user,
            'logout_url': self.logout_url,
            'notes': notes,
        }
        path = get_path('templates', 'index.html')

        self.response.out.write(template.render(path, template_values))


class AddNote(BaseHandler):
    def post(self):
        self.requires_login()

        note = StickyNote(
            user=self.user,

            text=self.request.get('text'),

            x=int(self.request.get('x')),
            y=int(self.request.get('y')),
            z=int(self.request.get('z')),

            width=int(self.request.get('width')),
            height=int(self.request.get('height')),
        )

        note.put()

        self.redirect('/')


application = webapp.WSGIApplication(
    [
        ('/', MainPage),
        ('/add_note', AddNote),
    ],
    debug=True
)


def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()
