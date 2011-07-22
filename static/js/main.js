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
		note_div.setAttribute('class', 'note');
		note_div.style.left = obj.x + 'px';
		note_div.style.top = obj.y + 'px';
		note_div.style.width = obj.width + 'px';
		note_div.style.height = obj.height + 'px';
		note_div.style.zIndex = obj.z;

		note_div.addEventListener('dragstart', events.dragstart_experiment, false);

		var text_div = document.createElement('div');
		text_div.setAttribute('class', 'text');

		var text = document.createTextNode(obj.text);

		text_div.appendChild(text);
		note_div.appendChild(text_div);

		return note_div;
	},

	'create_notes_from_array': function(json_obj) {
		// Receives an Array of Notes, and then creates and attaches each note
		// to the document tree.

		var wall = document.getElementsByClassName('wall')[0];
		var i;
		for (i = 0; i < json_obj.length; i++) {
			wall.appendChild(frontend.new_note_element(json_obj[i]));
		}
	}

};



backend = {
	// Backend functions care about server communication, and about calling the
	// frontend functions after a server response.

	// Using only one XHR object for reloading
	'XHR_reload': null,

	'reload_notes_using_ajax': function() {
		// Tries reloading all notes from server, using AJAX.

		if (backend.XHR_reload) {
			backend.XHR_reload.abort();
		} else {
			backend.XHR_reload = new XMLHttpRequest();
		}

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

	'move_note_ajax_post': function(id, x, y, z) {
		// Huh... I don't know... This function isn't used yet.

		var XHR = new XMLHttpRequest();
		var formdata = new FormData();

		formdata.append('id', id);
		formdata.append('x', x);
		formdata.append('y', y);
		formdata.append('z', z);

		XHR.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var json_obj = JSON.parse(this.responseText);
				// TODO: implement me...
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

	'dragstart_experiment': function(ev) {
		console.log("dragstart", this, ev);
		ev.stopPropagation(); // not really needed, but it makes sense here.

		ev.dataTransfer.setData('text/plain', 'Blah blah');
	},

	'dragenter_experiment': function(ev) {
		//console.log("dragenter", this, ev);
	},


	'accepting_drag': function(ev) {
		// This function is a dragover event handler

		// In this context, preventDefault() means YesIamAcceptingTheDragPlease()
		ev.preventDefault();

		// stopPropagation() doesn't seem really needed, though.
		ev.stopPropagation();
	},

	'drop_experiment': function(ev) {
		// Only one of stopPropagation() or preventDefault() is actually needed
		ev.stopPropagation();
		ev.preventDefault();

		var tmp = document.createElement('div');
		var rect = this.getBoundingClientRect();
		var left = ev.clientX - rect.left - this.clientLeft + this.scrollLeft;
		var top = ev.clientY - rect.top - this.clientTop + this.scrollTop;
		tmp.setAttribute('style', 'position:absolute; width: 2px; height: 2px; top: '+top+'px; left: '+left+'px; background: red;');
		this.appendChild(tmp);
	},


	'on_load_handler': function() {
		var button = document.getElementById('load_from_ajax_button');
		if (button) {
			button.addEventListener('click', backend.reload_notes_using_ajax, false);
		}

		button = document.getElementById('clear_wall');
		if (button) {
			button.addEventListener('click', frontend.clear_wall, false);
		}



		var wall = document.getElementsByClassName('wall')[0];
		wall.addEventListener('dragover', events.accepting_drag, false);
		wall.addEventListener('dragenter', events.dragenter_experiment, false);
		wall.addEventListener('drop', events.drop_experiment, false);
	}

};

window.addEventListener('load', events.on_load_handler, false);
