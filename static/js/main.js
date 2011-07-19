// JSLint comments:
/*global document, window, XMLHttpRequest */
/*jslint sloppy: true, white: true, onevar: false, plusplus: true, maxerr: 50, maxlen: 78, indent: 4 */


var XHR_instance;


function clear_wall() {
	var notes = document.querySelectorAll('.wall > .note');
	var i;
	for (i = 0; i < notes.length; i++) {
		notes[i].parentNode.removeChild(notes[i]);
	}
}

function new_note_element(obj) {
	var note_div = document.createElement('div');
	note_div.setAttribute('draggable', 'true');
	note_div.setAttribute('class', 'note');
	note_div.style.left = obj.x + 'px';
	note_div.style.top = obj.y + 'px';
	note_div.style.width = obj.width + 'px';
	note_div.style.height = obj.height + 'px';
	note_div.style.zIndex = obj.z;

	var text_div = document.createElement('div');
	text_div.setAttribute('class', 'text');

	var text = document.createTextNode(obj.text);

	text_div.appendChild(text);
	note_div.appendChild(text_div);

	return note_div;
}

function create_notes_from_json(json_obj) {
	var wall = document.getElementsByClassName('wall')[0];
	var i;
	for (i = 0; i < json_obj.length; i++) {
		wall.appendChild(new_note_element(json_obj[i]));
	}
}


function load_from_ajax() {
	if (XHR_instance) {
		XHR_instance.abort();
	} else {
		XHR_instance = new XMLHttpRequest();
	}

	XHR_instance.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			var json_obj = JSON.parse(this.responseText);

			clear_wall();
			create_notes_from_json(json_obj);
		}
		// else... do nothing
	};

	XHR_instance.open('GET', '/ajax/get_notes');
	XHR_instance.send();
}


function accepting_drag(ev) {
	ev.preventDefault();
}

function drop_experiment(ev) {
	var tmp = document.createElement('div');
	var rect = this.getBoundingClientRect();
	var left = ev.clientX - rect.left - this.clientLeft;
	var top = ev.clientY - rect.top - this.clientTop;
	tmp.setAttribute('style', 'position:absolute; width: 2px; height: 2px; top: '+top+'px; left: '+left+'px; background: red;');
	this.appendChild(tmp);
}


function on_load_handler() {
	var button = document.getElementById('load_from_ajax_button');
	if (button) {
		button.addEventListener('click', load_from_ajax, false);
	}

	button = document.getElementById('clear_wall');
	if (button) {
		button.addEventListener('click', clear_wall, false);
	}



	var wall = document.getElementsByClassName('wall')[0];
	wall.addEventListener('dragover', accepting_drag, false);
	wall.addEventListener('drop', drop_experiment, false);
}

window.addEventListener('load', on_load_handler, false);
