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
    text = db.StringProperty(multiline=True, default='')

    x = db.IntegerProperty(required=True, default=0)
    y = db.IntegerProperty(required=True, default=0)
    z = db.IntegerProperty(default=0)

    width = db.IntegerProperty(required=True, default=100)
    height = db.IntegerProperty(required=True, default=100)

    # "color" is the CSS class applied to the note object
    color = db.StringProperty(default='yellow')

    creation_datetime = db.DateTimeProperty(auto_now_add=True)
    last_modified_datetime = db.DateTimeProperty(auto_now=True)

    def to_json(self):
        d = {}
        d['id'] = self.key().id()
        for attr in ['text', 'x', 'y', 'z', 'width', 'height', 'color', 'creation_datetime', 'last_modified_datetime']:
            d[attr] = getattr(self, attr)

        # Setting a default value for object that don't have it
        if not d['color']:
            d['color'] = 'yellow'

        return d


class BaseHandler(webapp.RequestHandler):
    @property
    def logout_url(self):
        return users.create_logout_url(self.request.uri)

    def return_json(self, obj):
        '''Convenience function that generates and writes JSON output.'''

        self.response.headers['Content-Type'] = 'application/json'
        json.dump(obj, cls=ExtensibleJSONEncoder, fp=self.response.out)

    def get_ancestor(self):
        return db.Key.from_path('User', users.get_current_user().email())


class MainPage(BaseHandler):
    def get(self):
        notes = StickyNote.all().ancestor(self.get_ancestor())

        template_values = {
            'user': users.get_current_user(),
            'logout_url': self.logout_url,
        }
        path = get_path('templates', 'index.html')

        self.response.out.write(template.render(path, template_values))


class GetNotes(BaseHandler):
    def get(self):
        '''Receives: nothing
        Returns: JSON array of all notes.
        '''

        notes = StickyNote.all().ancestor(self.get_ancestor())
        self.return_json(notes)


class AddNote(BaseHandler):
    def post(self):
        '''Optionally receives: text,color,x,y,z,width,height
        Returns: JSON representation of the new note.

        Creates a new note.
        '''

        string_properties = ['text', 'color']
        integer_properties = ['x', 'y', 'z', 'width', 'height']
        d = {}

        # Getting all parameters from the request
        for attr in string_properties:
            value = self.request.get(attr, None)
            if value is not None:
                d[attr] = value
        for attr in integer_properties:
            value = self.request.get(attr, None)
            if value is not None:
                d[attr] = int(value)

        note = StickyNote(
            parent=self.get_ancestor(),
            user=users.get_current_user(),
            **d
        )

        note.put()
        self.return_json(note)


class DeleteNote(BaseHandler):
    def post(self):
        '''Receives: id
        Returns: nothing.

        Deletes the Note.
        (if it fails, it sends 404 or 403 response)
        '''

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


class EditNote(BaseHandler):
    def post(self):
        '''Receives: id
        Optionally receives: text,color,x,y,z,width,height
        Returns: JSON representation of the updated note.

        Edits any attribute of the note.
        '''

        id = int(self.request.get('id'))
        note = StickyNote.get_by_id(id, parent=self.get_ancestor())

        if note is None:
            self.error(404)
            return
        elif note.user != users.get_current_user():
            self.error(403)
            return

        string_properties = ['text', 'color']
        for attr in string_properties:
            new_value = self.request.get(attr, None)
            if new_value is not None:
                setattr(note, attr, new_value)

        integer_properties = ['x', 'y', 'z', 'width', 'height']
        for attr in integer_properties:
            new_value = self.request.get(attr, None)
            if new_value is not None:
                # Converting string to integer...
                new_value = int(new_value)
                # Let's just avoid negative coordinates, okay?
                new_value = max(0, new_value)

                setattr(note, attr, new_value)

        note.put()

        self.return_json(note)


application = webapp.WSGIApplication(
    [
        ('/', MainPage),
        ('/ajax/get_notes', GetNotes),
        ('/ajax/add_note', AddNote),
        ('/ajax/delete_note', DeleteNote),
        ('/ajax/edit_note', EditNote),
    ],
    debug=True
)


def main():
    run_wsgi_app(application)

if __name__ == '__main__':
    main()
