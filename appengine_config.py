# -*- coding: utf-8 -*-
# vi:ts=4 sw=4 et

def webapp_add_wsgi_middleware(app):
    from google.appengine.ext.appstats import recording
    app = recording.appstats_wsgi_middleware(app)
    return app
