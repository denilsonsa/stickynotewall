#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vi:ts=4 sw=4 et

import datetime
import os.path

try:
    import json
except ImportError:
    import simplejson as json

from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.ext.webapp.util import login_required


class ExtensibleJSONEncoder(json.JSONEncoder):
    '''If an object has a .to_json() method, calls it.

    Also implements support for iterables and datetime/date/time.
    '''

    def default(self, obj):
        # Support for .to_json() method in arbitrary objects
        if hasattr(obj, 'to_json'):
            method = getattr(obj, 'to_json')
            if callable(method):
                return method()

        # Support for datetime, date, time
        if isinstance(obj, datetime.datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S')
        elif isinstance(obj, datetime.date):
            return obj.strftime('%Y-%m-%d')
        elif isinstance(obj, datetime.time):
            return obj.strftime('%H:%M:%S')

        # Support for iterables. Code from:
        # http://docs.python.org/library/json.html#json.JSONEncoder.default
        try:
            iterable = iter(obj)
        except TypeError:
            pass
        else:
            return list(iterable)

        # Fallback
        return json.JSONEncoder.default(self, obj)


def get_path(*args):
    '''Convenience function to return the actual path for some file.'''

    return os.path.join(os.path.dirname(__file__), *args)


#class User(db.Model):
#    user = db.UserProperty()


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

    def to_json(self):
        d = {}
        d['id'] = self.key().id()
        for attr in ['text', 'x', 'y', 'z', 'width', 'height', 'creation_datetime', 'last_modified_datetime']:
            d[attr] = getattr(self, attr)
        return d


class BaseHandler(webapp.RequestHandler):
    @property
    def logout_url(self):
        return users.create_logout_url(self.request.uri)

    def return_json(self, obj):
        '''Convenience function that generates and writes JSON output.'''

        json.dump(obj, cls=ExtensibleJSONEncoder, fp=self.response.out)

    def get_ancestor(self):
        return db.Key.from_path('User', users.get_current_user().email())


class MainPage(BaseHandler):
    def get(self):
        notes = StickyNote.all().ancestor(self.get_ancestor())

        template_values = {
            'user': users.get_current_user(),
            'logout_url': self.logout_url,
            'notes': notes,
        }
        path = get_path('templates', 'index.html')

        self.response.out.write(template.render(path, template_values))


class GetNotes(BaseHandler):
    def get(self):
        notes = StickyNote.all().ancestor(self.get_ancestor())

        self.return_json(notes)


class AddNote(BaseHandler):
    def post(self):
        note = StickyNote(
            parent=self.get_ancestor(),
            user=users.get_current_user(),

            text=self.request.get('text'),

            x=int(self.request.get('x')),
            y=int(self.request.get('y')),
            z=int(self.request.get('z')),

            width=int(self.request.get('width')),
            height=int(self.request.get('height')),
        )

        note.put()

        self.redirect('/')


class DeleteNote(BaseHandler):
    def post(self):
        id = int(self.request.get('id'))
        note = StickyNote.get_by_id(id, parent=self.get_ancestor())

        if note is None:
            self.error(404)
            return
        elif note.user != users.get_current_user():
            self.error(403)
            return

        note.delete()

        # return nothing


class MoveNote(BaseHandler):
    def post(self):
        id = int(self.request.get('id'))
        x = int(self.request.get('x'))
        y = int(self.request.get('y'))
        z = int(self.request.get('z'))

        note = StickyNote.get_by_id(id, parent=self.get_ancestor())

        if note is None:
            self.error(404)
            return
        elif note.user != users.get_current_user():
            self.error(403)
            return

        note.x = x
        note.y = y
        note.z = z
        note.put()

        self.return_json(note)


application = webapp.WSGIApplication(
    [
        ('/', MainPage),
        ('/ajax/get_notes', GetNotes),
        ('/ajax/move_note', MoveNote),
        ('/add_note', AddNote),
        ('/delete_note', DeleteNote),
    ],
    debug=True
)


def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()
