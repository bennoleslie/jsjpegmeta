(function () {
    /* Imports */
    var $j = this.JpegMeta.JpegFile;

    /* Implementation */
    function $(x) {
        return document.getElementById(x);
    }

    function dragEnterHandler(e) {
	e.preventDefault();
    }

    function dragOverHandler(e) {
	e.preventDefault();
    }

    function dropHandler(e) {
	e.preventDefault();
	loadFiles(e.dataTransfer.files);
    }

    function strComp(a, b) {
	return (a > b) ? 1 : (a == b) ? 0 : -1;
    }

    function loadFiles(files) {
	var dataurl_reader = new FileReader();

	function display(data, filename) {
	    var jpeg = new $j(data, filename);
	    var groups = new Array;
	    var props;
	    var group;
	    var prop;
	    $("status").innerHTML += "JPEG File " + jpeg + "<br />";

	    if (jpeg.gps && jpeg.gps.longitude) {
		$("status").innerHTML += "<a href='http://maps.google.com/?q=" + jpeg.gps.latitude + "," + jpeg.gps.longitude + "&amp;spn=0.05,0.05&amp;t=h&amp;om=1&amp;hl=en' target='_blank'>Locate on map</a> (opens a new window) <br />";
	    }

	    for (group in jpeg.metaGroups) {
                if (jpeg.metaGroups.hasOwnProperty(group)) {
		    groups.push(jpeg.metaGroups[group]);
                }
	    }

	    groups.sort(function (a, b) {
		if (a.description == "General") {
		    return -1;
		} else if (b.description == "General") {
		    return 1;
		} else {
		    return strComp(a.description, b.description);
		}
	    });

	    for (var i = 0; i < groups.length; i++) {
                group = groups[i];
		props = new Array();
		$("status").innerHTML += "<strong>" + group.description + "</strong><br />";
		for (prop in group.metaProps) {
                    if (group.metaProps.hasOwnProperty(prop)) {
		        props.push(group.metaProps[prop]);
                    }
		}
		props.sort(function (a, b) { return strComp(a.description, b.description); });
		for (var j = 0; j < props.length; j++) {
                    prop = props[j];
		    $("status").innerHTML += "<em>" + prop.description + ":</em> " + prop.value + "<br />";
		}
	    }
	}

	dataurl_reader.onloadend = function() {
	    $("img").src = this.result;
            display(atob(this.result.replace(/^.*?,/,'')), files[0]);
	}

	$("status").innerHTML = "";
	$("img").src = "";
	dataurl_reader.readAsDataURL(files[0]);
	$("form").reset();
    }

    window.onload = function() {
	var drop_el = $("dropbox");
	var file_el = $("fileWidget");
	drop_el.addEventListener("dragenter", dragEnterHandler, false);
	drop_el.addEventListener("dragover", dragOverHandler, true);
	drop_el.addEventListener("drop", dropHandler, true);
	file_el.addEventListener("change", function() { loadFiles(this.files); }, true);
    }
    /* No exports */
})();
