// JSLint comments:
/*global document, window, XMLHttpRequest, console, FormData */
/*jslint undef: true, sloppy: true, white: true, onevar: false, plusplus: true, maxerr: 50, maxlen: 120, indent: 4 */


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
//
// innerHTML (AKA the fastest way to wipe the contents of an element)
// http://www.w3.org/TR/html5/apis-in-html-documents.html#innerhtml
// https://developer.mozilla.org/en/DOM:element.innerHTML


function get_MouseEvent_coordinates_relative_to_element(ev, elem, internal_coordinates) {
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

var available_note_colors = [
	// ['value', 'Pretty name']
	['yellow', 'Yellow'],
	['pink',   'Pink'],
	['red',    'Red'],
	['green',  'Green'],
	['blue',   'Blue']
];
var available_note_sizes = [
    // The order of each pair is important!
	// (else, the mouse-over effect won't work correctly, as the bigger size
	// will be on top of the smaller one)
	//
	// [width, height],
	[ 50,  50],
	[ 50, 100],
	[100,  50],
	[100, 100],
	[100, 150],
	[150, 100],
	[150, 150],
	[200, 200]
];
var default_note_width = 100;
var default_note_height = 100;

var state, frontend, backend, events;

state = {
	// "state" contains variables about the current interface state.
	// Mostly useful while editing a Note.

	'is_editing': false,
	'edit_note_id': null,
	'edit_note_elem': null
};


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

	'create_note_element': function(obj) {
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

		note_div.dataset.note_color = obj.color;
		note_div.classList.add(obj.color);

		note_div.style.left = obj.x + 'px';
		note_div.style.top = obj.y + 'px';
		note_div.style.width = obj.width + 'px';
		note_div.style.height = obj.height + 'px';
		note_div.style.zIndex = obj.z;

		note_div.addEventListener('click', events.note_on_click, false);
		note_div.addEventListener('dblclick', events.note_on_dblclick, false);
		note_div.addEventListener('dragstart', events.note_on_dragstart, false);
		note_div.addEventListener('dragend', events.note_on_dragend, false);

		var text_div = document.createElement('p');
		text_div.classList.add('text');

		var text = document.createTextNode(obj.text);

		text_div.appendChild(text);
		note_div.appendChild(text_div);

		return note_div;
	},

	'create_notes_from_array': function(note_array) {
		// Receives an Array of Notes, and then creates and attaches each note
		// to the document tree.

		var wall = document.getElementsByClassName('wall')[0];
		var i;
		for (i = 0; i < note_array.length; i++) {
			wall.appendChild(frontend.create_note_element(note_array[i]));
		}
	},

	'get_max_note_zIndex': function() {
		// Returns the maximum z-index value for all current notes

		var notes = document.querySelectorAll('.wall > .note');
		var max = 0;
		var i;
		for (i = 0; i < notes.length; i++) {
			var zIndex = parseInt(notes[i].style.zIndex, 10);
			if (zIndex > max) {
				max = zIndex;
			}
		}
		return max;
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
			'x': parseInt(elem.style.left, 10),
			'y': parseInt(elem.style.top, 10),
			'z': parseInt(elem.style.zIndex, 10),
			'width': parseInt(elem.style.width, 10),
			'height': parseInt(elem.style.height, 10),
			'text': frontend.get_text_from_note_element(elem),
			'color': elem.dataset.note_color
		};
		return obj;
	},

	'change_color_of_note_element': function(elem, new_color) {
		// Receives a .note HTML element and changes its color

		elem.classList.remove(elem.dataset.note_color);
		elem.classList.add(new_color);
		elem.dataset.note_color = new_color;
	},

	'add_or_update_note': function(note_obj) {
		// Receives a Note object, delete the note from the wall (if it
		// exists), and then appends a new .note element
		//
		// For convenience, also returns the created .note element.

		frontend.delete_note_by_id(note_obj.id);

		var wall = document.getElementsByClassName('wall')[0];
		var note_elem = frontend.create_note_element(note_obj);
		wall.appendChild(note_elem);

		return note_elem;
	},

	'delete_note_by_id': function(id) {
		// Deletes the .note element given its id.
		// If no element exists, do nothing.

		var elem = document.getElementById('note_' + id);
		if (elem) {
			if (state.is_editing && state.edit_note_id == id) {
				frontend.stop_editing_note();
			}

			elem.parentNode.removeChild(elem);
		}
	},

	'start_editing_note_elem': function(note_elem) {
		var id = note_elem.dataset.note_id;

		if (state.is_editing) {
			if (state.edit_note_id == id) {
				// I'm already editing this note! What do you want to do?
				return;
			}
			// Let's save the previous note
			backend.save_edit_using_ajax();
			frontend.stop_editing_note();
		}

		// Start editing...
		state.is_editing = true;
		state.edit_note_id = id;
		state.edit_note_elem = note_elem;

		note_elem.classList.add('being_edited');

		var edit_toolbar = document.getElementById('edit_toolbar');
		note_elem.appendChild(edit_toolbar);

		var note_color_select = document.getElementById('note_color_select');
		note_color_select.value = note_elem.dataset.note_color;

		var text_textarea = document.createElement('textarea');
		text_textarea.id = 'text_textarea';
		text_textarea.value = frontend.get_text_from_note_element(note_elem);
		note_elem.appendChild(text_textarea);
		text_textarea.focus();
	},

	'stop_editing_note': function() {
		// Only cleans the interface (and the state)
		// The saving must be done elsewhere.

		if (state.is_editing) {
			state.edit_note_elem.classList.remove('being_edited');

			var edit_toolbar = document.getElementById('edit_toolbar');
			document.documentElement.appendChild(edit_toolbar);

			var text_textarea = document.getElementById('text_textarea');
			text_textarea.parentNode.removeChild(text_textarea);

			var resize_interface = document.getElementById('resize_interface');
			if (resize_interface) {
				resize_interface.parentNode.removeChild(resize_interface);
			}

			state.is_editing = false;
			state.edit_note_id = null;
			state.edit_note_elem = null;
		}
	},

	'fill_note_color_select_with_choices': function() {
		var note_color_select = document.getElementById('note_color_select');
		if (note_color_select) {
			note_color_select.innerHTML = '';

			var i;
			for (i = 0; i < available_note_colors.length; i++) {
				var option = document.createElement('option');
				option.setAttribute('value', available_note_colors[i][0]);
				option.appendChild(
					document.createTextNode(available_note_colors[i][1])
				);
				note_color_select.appendChild(option);
			}
		}
	},

	'create_resize_note_interface': function() {
		// Creates and returns a nice interface for resizing a Note.

		// Deleting any old "#resize_interface" that might still exist
		var resize_interface = document.getElementById('resize_interface');
		if (resize_interface && resize_interface.parentNode) {
			resize_interface.parentNode.removeChild(resize_interface);
		}

		resize_interface = document.createElement('div');
		resize_interface.id = 'resize_interface';

		var i;
		for (i = 0; i < available_note_sizes.length; i++) {
			var width = available_note_sizes[i][0];
			var height = available_note_sizes[i][1];

			var size = document.createElement('div');
			size.classList.add('size');
			size.style.width = width + 'px';
			size.style.height = height + 'px';

			size.addEventListener('click', events.resize_size_on_click, false);

			// Inserting at the reverse order
			//resize_interface.appendChild(size);
			resize_interface.insertBefore(size, resize_interface.firstChild);
		}

		return resize_interface;
	},

	'add_resize_interface_to_note_being_edited': function() {
		if (state.is_editing) {
			var resize_interface = frontend.create_resize_note_interface();
			state.edit_note_elem.appendChild(resize_interface);
		}
	},

	'update_color_of_note_being_edited': function(new_color) {
		if (state.is_editing) {
			frontend.change_color_of_note_element(state.edit_note_elem, new_color);
		}
	},

	'resize_note_being_edited': function(width, height) {
		// Resizes the .note element, and does nothing else.
		// The new size will be saved whenever the edit is finalized.
		if (state.is_editing) {
			state.edit_note_elem.style.width = width + 'px';
			state.edit_note_elem.style.height = height + 'px';
		}
	}
};


backend = {
	// Backend functions care about server communication, and about calling the
	// frontend functions after a server response.

	'reuse_XHR': function(name) {
		// Aborts an ongoing XHR, if it exists.
		// Else, creates a new XHR with this name.
		// For convenience, also returns the XHR object.

		if (backend[name]) {
			backend[name].abort();
		} else {
			backend[name] = new XMLHttpRequest();
		}

		return backend[name];
	},

	'reload_notes_using_ajax': function() {
		// Tries reloading all notes from server

		var XHR = backend.reuse_XHR('XHR_reload');

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);

				frontend.clear_wall();
				frontend.create_notes_from_array(json_obj);
			}
			// else... do nothing
		};

		XHR.open('GET', '/ajax/get_notes');
		XHR.send();
	},

	'create_new_note_using_ajax': function(note_obj, callback) {
		// Creates a new Note at the desired position.
		// If text is null, use some pre-defined text.
		//
		// Also has a callback function that can be called after the note is
		// created.

		var formdata = new FormData();
		if(notNone(note_obj.text))   formdata.append('text',   note_obj.text);
		if(notNone(note_obj.color))  formdata.append('color',  note_obj.color);
		if(notNone(note_obj.x))      formdata.append('x',      note_obj.x);
		if(notNone(note_obj.y))      formdata.append('y',      note_obj.y);
		if(notNone(note_obj.z))      formdata.append('z',      note_obj.z);
		if(notNone(note_obj.width))  formdata.append('width',  note_obj.width);
		if(notNone(note_obj.height)) formdata.append('height', note_obj.height);

		var XHR = backend.reuse_XHR('XHR_create');

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);
				var note_elem = frontend.add_or_update_note(json_obj);
				if (callback) {
					callback(json_obj, note_elem);
				}
			}
			// else... do nothing
		};

		XHR.open('POST', '/ajax/add_note');
		XHR.send(formdata);
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

		XHR.open('POST', '/ajax/edit_note');
		XHR.send(formdata);
	},

	'save_edit_using_ajax': function() {
		// Saves whatever Note is beind edited, and stop editing.

		if (!state.is_editing) {
			return;
		}

		// I believe it's better to not reuse XHR for this function.
		// Am I right?
		var XHR = new XMLHttpRequest();

		var note_elem = state.edit_note_elem;
		var text_textarea = document.getElementById('text_textarea');
		var note_color_select = document.getElementById('note_color_select');

		var formdata = new FormData();
		formdata.append('id', state.edit_note_id);
		formdata.append('text', text_textarea.value);
		formdata.append('color', note_color_select.value);
		formdata.append('width', parseInt(note_elem.style.width, 10));
		formdata.append('height', parseInt(note_elem.style.height, 10));

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);
				frontend.add_or_update_note(json_obj);
			}
			// else... do nothing
		};

		XHR.open('POST', '/ajax/edit_note');
		XHR.send(formdata);
	},

	'delete_note_using_ajax': function(id) {
		// Deletes a note using AJAX

		// I believe it's better to not reuse XHR for this function.
		// Am I right?
		var XHR = new XMLHttpRequest();

		var formdata = new FormData();
		formdata.append('id', id);

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				// The response is empty, no need to parse anything
				frontend.delete_note_by_id(id);
			}
			// else... do nothing
		};

		XHR.open('POST', '/ajax/delete_note');
		XHR.send(formdata);
	}
};


events = {
	// These functions handle all UI events, and usually call other functions
	// from the backend and frontend.

	'note_color_select_on_input': function(ev) {
		frontend.update_color_of_note_being_edited(this.value);
	},

	'resize_note_button_on_click': function(ev) {
		frontend.add_resize_interface_to_note_being_edited();
	},

	'resize_size_on_click': function(ev) {
		var width = parseInt(this.style.width, 10);
		var height = parseInt(this.style.height, 10);
		frontend.resize_note_being_edited(width, height);

		var resize_interface = document.getElementById('resize_interface');
		resize_interface.parentNode.removeChild(resize_interface);
	},

	'note_on_click': function(ev) {
		if (this.classList.contains('being_edited')) {
			// I'm already being edited, let's avoid this propagating to the
			// wall element.
			ev.stopPropagation();
		}
	},

	'note_on_dblclick': function(ev) {
		ev.stopPropagation();

		if (this.classList.contains('being_edited')) {
			// I'm already being edited
			return;
		}

		frontend.start_editing_note_elem(this);
	},

	'note_on_dragstart': function(ev) {
		if (this.classList.contains('being_edited')) {
			// This element is being edited! Do NOT drag it around!
			ev.preventDefault();
			return;
		}

		ev.stopPropagation(); // not really needed, but it makes sense here.

		document.documentElement.classList.add('there_is_a_note_being_dragged');
		this.classList.add('being_dragged');

		// (Re)building the Note object from the element
		var note_obj = frontend.get_note_obj_from_note_element(this);

		// Storing the mouse position relative to this element
		var coords = get_MouseEvent_coordinates_relative_to_element(ev, this, false);
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

	'note_on_dragend': function(ev) {
		document.documentElement.classList.remove('there_is_a_note_being_dragged');
		this.classList.remove('being_dragged');
	},


	'trash_icon_on_dragenter': function(ev) {
		document.documentElement.classList.add('something_is_being_dragged_to_the_trash');
	},

	'trash_icon_on_dragleave': function(ev) {
		document.documentElement.classList.remove('something_is_being_dragged_to_the_trash');
	},

	'trash_icon_on_dragover': function(ev) {
		// For now, let's just accept ANYTHING, and mark as "move" instead of
		// "copy". This function might be smarter someday in future.
		// Probably when Chrome issue 31037 has been fixed...

		ev.dataTransfer.dropEffect = 'move';
		ev.preventDefault();
		ev.stopPropagation();
	},

	'trash_icon_on_drop': function(ev) {
		document.documentElement.classList.remove('something_is_being_dragged_to_the_trash');

		var note_mime_type = NoteMIMEType;
		if (has_chrome_issue_31037) {
			note_mime_type = 'text/plain';
		}
		var note_obj_string = ev.dataTransfer.getData(note_mime_type);
		var note_obj = JSON.parse(note_obj_string);
		backend.delete_note_using_ajax(note_obj.id);
	},


	'wall_on_click': function(ev) {
		backend.save_edit_using_ajax();
	},

	'wall_on_dblclick': function(ev) {
		ev.stopPropagation();

		var coords = get_MouseEvent_coordinates_relative_to_element(ev, this, true);

		var width = default_note_width;
		var height = default_note_height;
		var x = Math.round(coords.x - width/2);
		var y = Math.round(coords.y - width/2);

		backend.create_new_note_using_ajax({
			'x': x,
			'y': y,
			'z': frontend.get_max_note_zIndex(),
			'width': width,
			'height': height
		}, function(note_obj, note_elem) {
			frontend.start_editing_note_elem(note_elem);
		});
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

		var coords = get_MouseEvent_coordinates_relative_to_element(ev, this, true);

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
			// (but, before that, need to add support for multiple walls!)

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
				var width = default_note_width;
				var height = default_note_height;
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


	'window_on_load': function() {
		backend.reload_notes_using_ajax();

		frontend.fill_note_color_select_with_choices();

		var reload_button = document.getElementById('reload_button');
		reload_button.addEventListener('click', backend.reload_notes_using_ajax, false);

		var resize_note_button = document.getElementById('resize_note_button');
		resize_note_button.addEventListener('click', events.resize_note_button_on_click, false);

		var note_color_select = document.getElementById('note_color_select');
		note_color_select.addEventListener('change', events.note_color_select_on_input, false);
		note_color_select.addEventListener('input', events.note_color_select_on_input, false);

		var wall = document.getElementsByClassName('wall')[0];
		wall.addEventListener('click', events.wall_on_click, false);
		wall.addEventListener('dblclick', events.wall_on_dblclick, false);
		wall.addEventListener('dragover', events.wall_on_dragover, false);
		wall.addEventListener('drop', events.wall_on_drop, false);

		var trash_icon = document.getElementById('trash_icon');
		trash_icon.addEventListener('dragenter', events.trash_icon_on_dragenter, false);
		trash_icon.addEventListener('dragleave', events.trash_icon_on_dragleave, false);
		trash_icon.addEventListener('dragover', events.trash_icon_on_dragover, false);
		trash_icon.addEventListener('drop', events.trash_icon_on_drop, false);
	}
};


window.addEventListener('load', events.window_on_load, false);
