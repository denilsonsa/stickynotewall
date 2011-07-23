// JSLint comments:
/*global document, window, XMLHttpRequest, console, FormData */
/*jslint undef: true, sloppy: true, white: true, onevar: false, plusplus: true, maxerr: 50, maxlen: 78, indent: 4 */


// document.querySelectorAll()
// http://www.w3.org/TR/selectors-api/
// https://developer.mozilla.org/En/DOM/Document.querySelectorAll
//
// window.XMLHttpRequest
// http://www.w3.org/TR/XMLHttpRequest/
// https://developer.mozilla.org/en/xmlhttprequest
// https://developer.mozilla.org/En/Using_XMLHttpRequest
//
// FormData
// http://dev.w3.org/2006/webapi/XMLHttpRequest-2/#the-formdata-interface
// https://developer.mozilla.org/en/XMLHttpRequest/FormData
// https://developer.mozilla.org/En/XMLHttpRequest/Using_XMLHttpRequest#Using_FormData_objects
// http://hacks.mozilla.org/2010/07/firefox-4-formdata-and-the-new-file-url-object/
//
// Element.getBoundingClientRect(), Element.clientLeft, Element.clientTop
// http://www.w3.org/TR/cssom-view/#extensions-to-the-element-interface
// https://developer.mozilla.org/en/DOM/element.getBoundingClientRect
//
// MouseEvent.clientX, MouseEvent.clientY
// http://www.w3.org/TR/2000/REC-DOM-Level-2-Events-20001113/events.html#Events-eventgroupings-mouseevents
// https://developer.mozilla.org/en/DOM/Event/UIEvent/MouseEvent
//
// Drag and drop
// http://dev.w3.org/html5/spec/dnd.html
// http://www.whatwg.org/specs/web-apps/current-work/multipage/dnd.html#dnd
// https://developer.mozilla.org/En/DragDrop/Drag_Operations
// https://developer.mozilla.org/En/DragDrop/DataTransfer
// http://www.html5rocks.com/en/tutorials/dnd/basics/
//
// Custom data-* attributes
// http://dev.w3.org/html5/spec/elements.html#embedding-custom-non-visible-data-with-the-data-attributes
// https://developer.mozilla.org/en/DOM/element.dataset
// element.dataset has been supported in Firefox starting on version 5
//
// element.classList
// http://www.whatwg.org/specs/web-apps/current-work/multipage/urls.html#domtokenlist
// http://www.whatwg.org/specs/web-apps/current-work/multipage/elements.html#dom-classlist
// https://developer.mozilla.org/en/DOM/element.classList
//
// Node.textContent
// http://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-textContent
// https://developer.mozilla.org/En/DOM/Node.textContent


function MouseEvent_coordinates_relative_to_element(ev, elem, internal_coordinates) {
	// Receives a MouseEvent and a HTML element, and calculates the event
	// coordinates relative to the element.
	//
	// If "internal_coordinates" is true, returns coordinates for something
	// intended to be positioned inside the element.
	// If "internal_coordinates" is false, returns coordinates for positioning
	// the element itself.

	// This code is probably the same as retrieving ev.offsetX or ev.layerX,
	// but these properties are non-standard.

	var rect = elem.getBoundingClientRect();
	var x, y;

	if (internal_coordinates) {
		x = ev.clientX - rect.left - elem.clientLeft + elem.scrollLeft;
		y = ev.clientY - rect.top  - elem.clientTop  + elem.scrollTop;
	} else {
		x = ev.clientX - rect.left;
		y = ev.clientY - rect.top;
	}

	return { 'x': x, 'y': y };
}

function notNone(value) {
	// Returns true if value is not "null" and not "undefined".
	// Just a little convenience function

	return (value !== null) && (value !== undefined);
}


var NoteMIMEType = 'application/x-notewall.note+json';
var has_chrome_issue_31037 = false;

var frontend, backend, events;


frontend = {
	// Frontend functions care about HTML elements.
	// They know nothing about server communication.

	'clear_wall': function() {
		// Removes all .note elements from the .wall element.
		// Useful before reloading all notes.

		var notes = document.querySelectorAll('.wall > .note');
		var i;
		for (i = 0; i < notes.length; i++) {
			notes[i].parentNode.removeChild(notes[i]);
		}
	},

	'new_note_element': function(obj) {
		// Receives a Note JavaScript object and creates the HTML elements that
		// represent such object.
		//
		// Returns the created .note element (which must later be added to the
		// document tree)

		var note_div = document.createElement('div');

		note_div.setAttribute('draggable', 'true');
		note_div.classList.add('note');

		note_div.dataset.note_id = obj.id;
		note_div.id = "note_" + obj.id;

		note_div.style.left = obj.x + 'px';
		note_div.style.top = obj.y + 'px';
		note_div.style.width = obj.width + 'px';
		note_div.style.height = obj.height + 'px';
		note_div.style.zIndex = obj.z;

		note_div.addEventListener('dragstart', events.note_on_dragstart, false);

		var text_div = document.createElement('p');
		text_div.classList.add('text');

		var text = document.createTextNode(obj.text);

		text_div.appendChild(text);
		note_div.appendChild(text_div);

		return note_div;
	},

	'get_text_from_note_element': function(elem) {
		// Receives a .note HTML element and extracts the text from it.

		var text_elem = elem.querySelector('.text');
		if (text_elem) {
			return text_elem.textContent;
		} else {
			return '';
		}
	},
	'get_note_obj_from_note_element': function(elem) {
		// Receives a .note HTML element and returns a Note object.

		var obj = {
			'id': elem.dataset.note_id,
			'x': parseInt(elem.style.left),
			'y': parseInt(elem.style.top),
			'z': parseInt(elem.style.zIndex),
			'width': parseInt(elem.style.width),
			'height': parseInt(elem.style.height),
			'text': frontend.get_text_from_note_element(elem)
		};
		return obj;
	},

	'clear_color_from_note_element': function(elem) {
		// Receives a .note HTML element and removes all color-related classes
		// from it.

		var color_classes = [
			'yellow',
			'pink',
			'red',
			'green',
			'blue'
		];
		var i;
		for (i = 0; i < color_classes.length; i++) {
			elem.classList.remove(color_classes[i]);
		}
	},

	'create_notes_from_array': function(note_array) {
		// Receives an Array of Notes, and then creates and attaches each note
		// to the document tree.

		var wall = document.getElementsByClassName('wall')[0];
		var i;
		for (i = 0; i < note_array.length; i++) {
			wall.appendChild(frontend.new_note_element(note_array[i]));
		}
	},

	'add_or_update_note': function(note_obj) {
		// Receives a Note object, delete the note from the wall (if it
		// exists), and then appends a new .note element

		frontend.delete_note_by_id(note_obj.id);

		var wall = document.getElementsByClassName('wall')[0];
		wall.appendChild(frontend.new_note_element(note_obj));
	},

	'delete_note_by_id': function(id) {
		// Deletes the .note element given its id.
		// If no element exists, do nothing.

		var elem = document.getElementById('note_' + id);
		if (elem) {
			elem.parentNode.removeChild(elem);
		}
	},

	'get_max_note_zIndex': function() {
		// Returns the maximum z-index value for all current notes

		var notes = document.querySelectorAll('.wall > .note');
		var max = 0;
		var i;
		for (i = 0; i < notes.length; i++) {
			zIndex = parseInt(notes[i].style.zIndex);
			if (zIndex > max) {
				max = zIndex;
			}
		}
		return max;
	}
};


backend = {
	// Backend functions care about server communication, and about calling the
	// frontend functions after a server response.

	// Using only one XHR object for reloading
	'XHR_reload': null,
	// Using only one XHR object for creating a note
	'XHR_create': null,

	'reuse_XHR': function(name) {
		// Aborts an ongoing XHR, if it exists.
		// Else, creates a new XHR with this name.

		if (backend[name]) {
			backend[name].abort();
		} else {
			backend[name] = new XMLHttpRequest();
		}
	},

	'reload_notes_using_ajax': function() {
		// Tries reloading all notes from server

		backend.reuse_XHR('XHR_reload');

		backend.XHR_reload.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);

				frontend.clear_wall();
				frontend.create_notes_from_array(json_obj);
			}
			// else... do nothing
		};

		backend.XHR_reload.open('GET', '/ajax/get_notes');
		backend.XHR_reload.send();
	},

	'create_new_note_using_ajax': function(note_obj) {
		// Creates a new Note at the desired position.
		// If text is null, use some pre-defined text.

		var formdata = new FormData();
		if(notNone(note_obj.text))   formdata.append('text',   note_obj.text);
		if(notNone(note_obj.x))      formdata.append('x',      note_obj.x);
		if(notNone(note_obj.y))      formdata.append('y',      note_obj.y);
		if(notNone(note_obj.z))      formdata.append('z',      note_obj.z);
		if(notNone(note_obj.width))  formdata.append('width',  note_obj.width);
		if(notNone(note_obj.height)) formdata.append('height', note_obj.height);

		backend.reuse_XHR('XHR_create');

		backend.XHR_create.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);
				frontend.add_or_update_note(json_obj);
			}
			// else... do nothing
		};

		backend.XHR_create.open('POST', '/ajax/add_note');
		backend.XHR_create.send(formdata);
	},

	'move_note_using_ajax': function(id, x, y, z) {
		// Moves a note using AJAX, and updates the note position.

		// I believe it's better to not reuse XHR for this function.
		// Am I right?
		var XHR = new XMLHttpRequest();

		var formdata = new FormData();
		formdata.append('id', id);
		formdata.append('x', x);
		formdata.append('y', y);
		formdata.append('z', z);

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);
				frontend.add_or_update_note(json_obj);
			}
			// else... do nothing
		};

		XHR.open('POST', '/ajax/move_note');
		XHR.send(formdata);
	}
};


events = {
	// These functions handle all UI events, and usually call other functions
	// from the backend and frontend.

	'note_on_dragstart': function(ev) {
		ev.stopPropagation(); // not really needed, but it makes sense here.

		// If preventDefault() is added, the user won't be able to drag the
		// element!
		// ev.preventDefault();

		// (Re)building the Note object from the element
		var note_obj = frontend.get_note_obj_from_note_element(this);

		// Storing the mouse position relative to this element
		var coords = MouseEvent_coordinates_relative_to_element(ev, this, false);
		note_obj.mouse_x = coords.x;
		note_obj.mouse_y = coords.y;

		// Storing the note data in more than one format
		//
		// By the way, that MIME Type is something I made up and seems to make
		// sense for me, but I don't know if that is adequate.
		// http://stackoverflow.com/questions/6767128/what-format-mime-type-should-i-use-for-html5-drag-and-drop-operations
		ev.dataTransfer.setData(NoteMIMEType, JSON.stringify(note_obj));
		ev.dataTransfer.setData('text/plain', note_obj.text);

		if (!ev.dataTransfer.getData(NoteMIMEType)) {
			// Detecting Chrome bug (or lack of feature)
			// http://code.google.com/p/chromium/issues/detail?id=31037
			console.log('Chrome issue 31037 detected!');
			has_chrome_issue_31037 = true;
			// Falling back to storing the JSON data as text/plain, to work
			// around Chrome issue.
			ev.dataTransfer.setData('text/plain', JSON.stringify(note_obj));
		}

		ev.dataTransfer.effectAllowed = 'copyMove';
	},

	'note_on_dblclick': function(ev) {
		ev.stopPropagation();
	},

	'wall_on_dragover': function(ev) {
		// For now, let's just accept ANYTHING, and mark as "move" instead of
		// "copy". This function might be smarter someday in future.

		ev.dataTransfer.dropEffect = 'move';

		// On dragover, preventDefault() means YesIamAcceptingTheDragPlease()
		// Note that just stopPropagation() doesn't work; preventDefault() must
		// be called in order to accept the drag.
		ev.preventDefault();

		// stopPropagation() isn't needed, though.
		ev.stopPropagation();
	},

	'wall_on_drop': function(ev) {
		// Only one of stopPropagation() or preventDefault() is actually needed
		ev.stopPropagation();
		ev.preventDefault();

		var coords = MouseEvent_coordinates_relative_to_element(ev, this, true);

		var note_mime_type = NoteMIMEType;
		if (has_chrome_issue_31037) {
			note_mime_type = 'text/plain';
		}
		var note_obj_string = ev.dataTransfer.getData(note_mime_type);
		var note_obj;
		try {
			note_obj = JSON.parse(note_obj_string);

			// The user dropped a Note object! Let's handle that!
			// (or, something that might be a note object)


			// For now, let's just MOVE a note that is currently attached to
			// this wall.
			// TODO: add support for copying/moving notes between walls.

			var x = coords.x;
			var y = coords.y;
			if (note_obj.mouse_x) {
				x -= note_obj.mouse_x;
			}
			if (note_obj.mouse_y) {
				y -= note_obj.mouse_y;
			}
			var z = frontend.get_max_note_zIndex();
			z += 1;

			backend.move_note_using_ajax(note_obj.id, x, y, z);

		} catch (e) {
			// Let's fall back to creating a note with the dropped text
			var text = ev.dataTransfer.getData('text/plain');
			if (text) {
				var width = 50;
				var height = 50;
				var x = Math.round(coords.x - width/2);
				var y = Math.round(coords.y - width/2);

				backend.create_new_note_using_ajax({
					'text': text,
					'x': x,
					'y': y,
					'z': frontend.get_max_note_zIndex(),
					'width': width,
					'height': height
				});
			}
		}
	},

	'wall_on_dblclick': function(ev) {
		ev.stopPropagation();

		var coords = MouseEvent_coordinates_relative_to_element(ev, this, true);

		var width = 50;
		var height = 50;
		var x = Math.round(coords.x - width/2);
		var y = Math.round(coords.y - width/2);

		backend.create_new_note_using_ajax({
			'x': x,
			'y': y,
			'z': frontend.get_max_note_zIndex(),
			'width': width,
			'height': height
		});
	},

	'window_on_load': function() {
		// Loading the notes on page load:
		backend.reload_notes_using_ajax();

		// TODO: rename this to "refresh" button
		var button = document.getElementById('reload_button');
		if (button) {
			button.addEventListener('click', backend.reload_notes_using_ajax, false);
		}

		var wall = document.getElementsByClassName('wall')[0];
		wall.addEventListener('dragover', events.wall_on_dragover, false);
		wall.addEventListener('drop', events.wall_on_drop, false);
		wall.addEventListener('dblclick', events.wall_on_dblclick, false);
	}
};


window.addEventListener('load', events.window_on_load, false);
