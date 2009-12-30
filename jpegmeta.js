/*
Copyright (c) 2009 Ben Leslie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
/*
This JavaScript library is used to parse meta-data from Images.
*/

if (!this.JpegMeta) {
    this.JpegMeta = {};
}

(function () {

    /* Some useful constants */
    var SOI_MARKER = '\xff\xd8';
    var DELIM = 0xff;
    var EOI = 0xd9;
    var SOS = 0xda;

    /* Rational number */
    function Rational(num, den) {
	this.num = num;
	this.den = den || 1;
	return this;
    }
    Rational.prototype.toString = function () {
	if (this.num === 0) {
	    return "" + this.num
	}
	if (this.den === 1) {
	    return "" + this.num;
	}
	return this.num + "/" + this.den;
    }


    /* 
       parse an unsigned number of size bytes at offset in some binary string data.
       If endian
       is "<" parse the data as little endian, if endian
       is ">" parse as big-endian.
    */
    function parseNum(endian, data, offset, size) {
	var i;
	var ret;
	var big_endian = (endian === ">");
	if (offset === undefined) offset = 0;
	if (size === undefined) size = data.length - offset;
	for (big_endian ? i = offset : i = offset + size - 1; 
	     big_endian ? i < offset + size : i >= offset; 
	     big_endian ? i++ : i--) {
	    ret <<= 8;
	    ret += data.charCodeAt(i);
	}
	return ret;
    }

    /* 
       parse an signed number of size bytes at offset in some binary string data.
       If endian
       is "<" parse the data as little endian, if endian
       is ">" parse as big-endian.
    */
    function parseSnum(endian, data, offset, size) {
	var i;
	var ret;
	var neg;
	var big_endian = (endian === ">");
	if (offset === undefined) offset = 0;
	if (size === undefined) size = data.length - offset;
	for (big_endian ? i = offset : i = offset + size - 1; 
	     big_endian ? i < offset + size : i >= offset; 
	     big_endian ? i++ : i--) {
	    if (neg === undefined) {
		/* Negative if top bit is set */
		neg = (data.charCodeAt(i) & 0x80) === 0x80;
	    }
	    ret <<= 8;
	    /* If it is negative we invert the bits */
	    ret += neg ? ~data.charCodeAt(i) & 0xff: data.charCodeAt(i);
	}
	if (neg) {
	    /* If it is negative we do two's complement */
	    ret += 1;
	    ret *= -1;
	}
	return ret;
    }

    console.log("Big: " + parseNum(">", "\xff\x00"));
    console.log("Little: " + parseNum("<", "\xff\x00"));
    console.log("blah: " + parseSnum(">", "\xff"));
    console.log("blah16: " + parseSnum(">", "\xff\xf0"));
    console.log("blah16: " + parseSnum("<", "\xff\xf0"));

    var markers = {
	/* Start Of Frame markers, non-differential, Huffman coding */
	0xc0: ["SOF0", sofHandler, "Baseline DCT"],
	0xc1: ["SOF1", sofHandler, "Extended sequential DCT"],
	0xc2: ["SOF2", sofHandler, "Progressive DCT"],
	0xc3: ["SOF3", sofHandler, "Lossless (sequential)"],

	/* Start Of Frame markers, differential, Huffman coding */
	0xc5: ["SOF5", sofHandler, "Differential sequential DCT"],
	0xc6: ["SOF6", sofHandler, "Differential progressive DCT"],
	0xc7: ["SOF7", sofHandler, "Differential lossless (sequential)"],

	/* Start Of Frame markers, non-differential, arithmetic coding */
	0xc8: ["JPG", null, "Reserved for JPEG extensions"],
	0xc9: ["SOF9", sofHandler, "Extended sequential DCT"],
	0xca: ["SOF10", sofHandler, "Progressive DCT"],
	0xcb: ["SOF11", sofHandler, "Lossless (sequential)"],

	/* Start Of Frame markers, differential, arithmetic coding */
	0xcd: ["SOF13", sofHandler, "Differential sequential DCT"],
	0xce: ["SOF14", sofHandler, "Differential progressive DCT"],
	0xcf: ["SOF15", sofHandler, "Differential lossless (sequential)"],

	/* Huffman table specification */
	0xc4: ["DHT", null, "Define Huffman table(s)"],
	0xcc: ["DAC", null, "Define arithmetic coding conditioning(s)"],

	/* Restart interval termination" */
	0xd0: ["RST0", null, "Restart with modulo 8 count “0”"],
	0xd1: ["RST1", null, "Restart with modulo 8 count “1”"],
	0xd2: ["RST2", null, "Restart with modulo 8 count “2”"],
	0xd3: ["RST3", null, "Restart with modulo 8 count “3”"],
	0xd4: ["RST4", null, "Restart with modulo 8 count “4”"],
	0xd5: ["RST5", null, "Restart with modulo 8 count “5”"],
	0xd6: ["RST6", null, "Restart with modulo 8 count “6”"],
	0xd7: ["RST7", null, "Restart with modulo 8 count “7”"],

	/* Other markers */
	0xd8: ["SOI", null, "Start of image"],
	0xd9: ["EOI", null, "End of image"],
	0xda: ["SOS", null, "Start of scan"],
	0xdb: ["DQT", null, "Define quantization table(s)"],
	0xdc: ["DNL", null, "Define number of lines"],
	0xdd: ["DRI", null, "Define restart interval"],
	0xde: ["DHP", null, "Define hierarchical progression"],
	0xdf: ["EXP", null, "Expand reference component(s)"],
	0xe0: ["APP0", app0Handler, "Reserved for application segments"],
	0xe1: ["APP1", app1Handler],
	0xe2: ["APP2", null],
	0xe3: ["APP3", null],
	0xe4: ["APP4", null],
	0xe5: ["APP5", null],
	0xe6: ["APP6", null],
	0xe7: ["APP7", null],
	0xe8: ["APP8", null],
	0xe9: ["APP9", null],
	0xea: ["APP10", null],
	0xeb: ["APP11", null],
	0xec: ["APP12", null],
	0xed: ["APP13", null],
	0xee: ["APP14", null],
	0xef: ["APP15", null],
	0xf0: ["JPG0", null], /* Reserved for JPEG extensions */
	0xf1: ["JPG1", null],
	0xf2: ["JPG2", null],
	0xf3: ["JPG3", null],
	0xf4: ["JPG4", null],
	0xf5: ["JPG5", null],
	0xf6: ["JPG6", null],
	0xf7: ["JPG7", null],
	0xf8: ["JPG8", null],
	0xf9: ["JPG9", null],
	0xfa: ["JPG10", null],
	0xfb: ["JPG11", null],
	0xfc: ["JPG12", null],
	0xfd: ["JPG13", null],
	0xfe: ["COM", null], /* Comment */

	/* Reserved markers */
	0x01: ["JPG13", null], /* For temporary private use in arithmetic coding */
	/* 02 -> bf are reserverd */
    }
    function sofHandler (mark, pos) {
	if (this.general !== undefined) {
	    throw Error("Unexpected multiple-frame image");
	}

	this.general = {};
	this.general.depth = parseNum(">", this.binary_data, pos, 1);
	this.general.pixelHeight = parseNum(">", this.binary_data, pos + 1, 2);
	this.general.pixelWidth = parseNum(">", this.binary_data, pos + 3, 2);
	this.general.type = markers[mark][2];

	console.log("Found SOF: " + this);
    }

    /* JFIF related code */
    var JFIF_IDENT = "JFIF\x00";
    var JFXX_IDENT = "JFXX\x00";

    function JfifSegment() {
	return this;
    }
    JfifSegment.prototype.toString = function() {
	return "[JfifSegment: ver: " + this.version_major + "." + this.version_minor + 
	    " Units: " + this.units + 
	    " Xdensity: " + this.Xdensity + 
	    " Ydensity: " + this.Ydensity +
	    " Xthumbnail: " + this.Xthumbnail +
	    " Ythumbnail: " + this.Ythumbnail + "]";
    }

    function jfifHandler(mark, pos) {
	if (this.jfif !== undefined) {
	    throw Error("Multiple JFIF segments found");
	}
	this.jfif = new JfifSegment();
	this.jfif.version_major = this.binary_data.charCodeAt(pos + 5);
	this.jfif.version_minor = this.binary_data.charCodeAt(pos + 6);
	this.jfif.units = this.binary_data.charCodeAt(pos + 7);
	this.jfif.Xdensity = parseNum(">", this.binary_data, pos + 8, 2);
	this.jfif.Ydensity = parseNum(">", this.binary_data, pos + 10, 2);
	this.jfif.Xthumbnail = parseNum(">", this.binary_data, pos + 12, 1);
	this.jfif.Ythumbnail = parseNum(">", this.binary_data, pos + 13, 1);
	console.log("Found JFIF: " + this.jfif);
    }

    function app0Handler(mark, pos) {
	var ident = this.binary_data.slice(pos, pos + 5);
	if (ident == JFIF_IDENT) {
	    jfifHandler.call(this, mark, pos);
	} else if (ident == JFXX_IDENT) {
	    /* Don't handle JFXX Ident yet */
	} else {
	    /* Don't know about other idents */
	}
    }


    /* EXIF handler */
    var EXIF_IDENT = "Exif\x00";

    var types = {
	1 : ["BYTE", 1],
	2 : ["ASCII", 1],
	3 : ["SHORT", 2],
	4 : ["LONG", 4],
	5 : ["RATIONAL", 8],
	6 : ["SBYTE", 1],
	7 : ["UNDEFINED", 1],
	8 : ["SSHORT", 2],
	9 : ["SLONG", 4],
	10 : ["SRATIONAL", 8],
	11 : ["FLOAT", 4],
	12 : ["DOUBLE", 8],
    };

    var tifftags = {
	/* A. Tags relating to image data structure */
	256 : ["Image width", "ImageWidth"],
	257 : ["Image height", "ImageLength"],
	258 : ["Number of bits per component", "BitsPerSample"],
	259 : ["Compression scheme", "Compression", 
	       {1 : "uncompressed", 6 : "JPEG compression" }],
	262 : ["Pixel composition", "PhotmetricInerpretation",
	       {2 : "RGB", 6 : "YCbCr"}],
	274 : ["Orientation of image", "Orientation",
	       /* FIXME: Check the mirror-image / reverse encoding and rotation */
	       {1 : "Normal", 2 : "Reverse?", 
		3 : "Upside-down", 4 : "Upside-down Reverse",
		5 : "90 degree CW", 6 : "90 degree CW reverse",
		7 : "90 degree CCW", 8 : "90 degree CCW reverse",}],
	277 : ["Number of components", "SamplesPerPixel"],
	284 : ["Image data arrangement", "PlanarConfiguration",
	       {1 : "chunky format", 2 : "planar format"}],
	530 : ["Subsampling ratio of Y to C", "YCbCrSubSampling"],
	531 : ["Y and C positioning", "YCbCrPositioning",
	       {1 : "centered", 2 : "co-sited"}],
	282 : ["Image resolution in width direction", "XResolution"],
	283 : ["Image resolution in height direction", "YResolution"],
	296 : ["Unit of X and Y resolution", "ResolutionUnit",
	       {2 : "inches", 3 : "centimeters"}],
	/* B. Tags realting to recording offset */
	273 : ["Image data location", "StripOffsets"],
	278 : ["Number of rows per strip", "RowsPerStrip"],
	279 : ["Bytes per compressed strip", "StripByteCounts"],
	513 : ["Offset to JPEG SOI", "JPEGInterchangeFormat"],
	514 : ["Bytes of JPEG Data", "JPEGInterchangeFormatLength"],
	/* C. Tags relating to image data characteristics */
	301 : ["Transfer function", "TransferFunction"],
	318 : ["White point chromaticity", "WhitePoint"],
	319 : ["Chromaticities of primaries", "PrimaryChromaticities"],
	529 : ["Color space transformation matrix coefficients", "YCbCrCoefficients"],
	532 : ["Pair of black and white reference values", "ReferenceBlackWhite"],
	/* D. Other tags */
	306 : ["File change date and time", "DateTime"],
	270 : ["Image title", "ImageDescription"],
	271 : ["Manufacturer of image input equipment", "Make"],
	272 : ["Model of image input equipment", "Model"],
	305 : ["Software used", "Software"],
	315 : ["Person who created the image", "Artist"],
	316 : ["The computer and/or operating system in use at the time of image creation", "HostComputer"],
	33432 : ["Copyright holder", "Copyright"],

	34665 : ["Exif tag", "ExifIfdPointer"],
	34853 : ["GPS tag", "GPSInfoIfdPointer"],
    };

    var exiftags = {
	/* Tag Support Levels (2) - 0th IFX Exif Private Tags */
	/* A. Tags Relating to Version */
	36864 : ["Exif Version", "ExifVersion"],
	40960 : ["Supported Flashpix version", "FlashpixVersion"],

	/* B. Tag Relating to Image Data Characteristics */
	40961 : ["Color space information", "ColorSpace"],

	/* C. Tags Relating to Image Configuration */
	37121 : ["Meaning of each component", "ComponentsConfiguration"],
	37122 : ["Image compression mode", "CompressedBitsPerPixel"],
	40962 : ["Valid image width", "PixelXDimension"],
	40963 : ["Valid image height", "PixelYDimension"],

	/* D. Tags Relating to User Information */
	37500 : ["Manufacturer notes", "MakerNote"],
	37510 : ["User comments", "UserComment"],

	/* E. Tag Relating to Related File Information */
	40964 : ["Related audio file", "RelatedSoundFile"],
	
	/* F. Tags Relating to Date and Time */
	36867 : ["Date and time original image was generated", "DateTimeOriginal"],
	36868 : ["Date and time image was made digital data", "DateTimeDigitized"],
	37520 : ["DateTime subseconds", "SubSecTime"],
	37521 : ["DateTimeOriginal subseconds", "SubSecTimeOriginal"],
	37522 : ["DateTimeDigitized subseconds", "SubSecTimeDigitized"],

	/* G. Tags Relating to Picture-Taking Conditions */
	33434 : ["Exposure time", "ExposureTime"],
	33437 : ["F number", "FNumber"],
	34850 : ["Exposure program", "ExposureProgram"],
	34852 : ["Spectral sensitivity", "SpectralSensitivity"],
	34855 : ["ISO speed ratings", "ISOSpeedRatings"],
	34856 : ["Optoelectric coefficient", "OECF"],
	37377 : ["Shutter speed",  "ShutterSpeedValue"],
	37378 : ["Aperture", "ApertureValue"],
	37379 : ["Brightness", "BrightnessValue"],
	37380 : ["Exposure bais", "ExposureBiasValue"],
	37381 : ["Maximum lens aperture", "MaxApertureValue"],
	37382 : ["Subject distance", "SubjectDistance"],
	37383 : ["Metering mode", "MeteringMode"],
	37384 : ["Light source", "LightSource"],
	37385 : ["Flash", "Flash"],
	37386 : ["Lens focal length", "FocalLength"],
	37396 : ["Subject area", "SubjectArea"],
	41483 : ["Flash energy", "FlashEnergy"],
	41484 : ["Spatial frequency response", "SpatialFrequencyResponse"],
	41486 : ["Focal plan X resolution", "FocalPlaneXResolution"],
	41487 : ["Focal plan Y resolution", "FocalPlaneYResolution"],
	41488 : ["Focal plan resolution unit", "FocalPlaneResolutionUnit"],
	41492 : ["Subject location", "SubjectLocation"],
	41493 : ["Exposure index", "ExposureIndex"],
	41495 : ["Sensing method", "SensingMethod"],
	41728 : ["File source", "FileSource"],
	41729 : ["Scene type", "SceneType"],
	41730 : ["CFA pattern", "CFAPattern"],
	41985 : ["Custom image processing", "CustomRendered"],
	41986 : ["Exposure mode", "Exposure Mode"],
	41987 : ["White balance", "WhiteBalance"],
	41988 : ["Digital zoom ratio", "DigitalZoomRatio"],
	41990 : ["Scene capture type", "SceneCaptureType"],
	41991 : ["Gain control", "GainControl"],
	41992 : ["Contrast", "Contrast"],
	41993 : ["Saturation", "Saturation"],
	41994 : ["Sharpness", "Sharpness"],
	41995 : ["Device settings description", "DeviceSettingDescription"],
	41996 : ["Subject distance range", "SubjectDistanceRange"],
	
	/* H. Other Tags */
	42016 : ["Unique image ID", "ImageUniqueID"],

	40965 : ["Interoperability tag", "InteroperabilityIFDPointer"],
    }

    var gpstags = {
	/* A. Tags Relating to GPS */
	0 : ["GPS tag version", "GPSVersionID"],
	1 : ["North or South Latitude", "GPSLatitudeRef"],
	2 : ["Latitude", "GPSLatitude"],
	3 : ["East or West Longitude", "GPSLongitudeRef"],
	4 : ["Longitude", "GPSLongitude"],
	5 : ["Altitude reference", "GPSAltitudeRef"],
	6 : ["Altitude", "GPSAltitude"],
	7 : ["GPS time (atomic clock)", "GPSTimeStamp"],
	8 : ["GPS satellites usedd for measurement", "GPSSatellites"],
	9 : ["GPS receiver status", "GPSStatus"],
	10 : ["GPS mesaurement mode", "GPSMeasureMode"],
	11 : ["Measurement precision", "GPSDOP"],
	12 : ["Speed unit", "GPSSpeedRef"],
	13 : ["Speed of GPS receiver", "GPSSpeed"],
	14 : ["Reference for direction of movement", "GPSTrackRef"],
	15 : ["Direction of movement", "GPSTrack"],
	16 : ["Reference for direction of image", "GPSImgDirectionRef"],
	17 : ["Direction of image", "GPSImgDirection"],
	18 : ["Geodetic survey data used", "GPSMapDatum"],
	19 : ["Reference for latitude of destination", "GPSDestLatitudeRef"],
	20 : ["Latitude of destination", "GPSDestLatitude"],
	21 : ["Reference for longitude of destination", "GPSDestLongitudeRef"],
	22 : ["Longitude of destination", "GPSDestLongitude"],
	23 : ["Reference for bearing of destination", "GPSDestBearingRef"],
	24 : ["Bearing of destination", "GPSDestBearing"],
	25 : ["Reference for distance to destination", "GPSDestDistanceRef"],
	26 : ["Distance to destination", "GPSDestDistance"],
	27 : ["Name of GPS processing method", "GPSProcessingMethod"],
	28 : ["Name of GPS area", "GPSAreaInformation"],
	29 : ["GPS Date", "GPSDateStamp"],
	30 : ["GPS differential correction", "GPSDifferential"],
    }

    function ExifSegment() {
	return this;
    }
    ExifSegment.prototype.toString = function() {
	return "[ExifSegment]";
    }

    function parseIfd(endian, binary_data, base, ifd_offset, tags) {
	var num_fields = parseNum(endian, binary_data, base + ifd_offset, 2);
	/* Per tag variables */
	var i, j;
	var tag_base;
	var tag_field;
	var type, type_field, type_size;
	var num_values;
	var value_offset;
	var value;
	var _val;
	var num;
	var den;

	var ifd = {};
	
	console.log("# fields: " + num_fields);
	
	for (var i = 0; i < num_fields; i++) {
	    /* parse the field */
	    tag_base = base + ifd_offset + 2 + (i * 12);
	    tag_field = parseNum(endian, binary_data, tag_base, 2);
	    type_field = parseNum(endian, binary_data, tag_base + 2, 2);
	    num_values = parseNum(endian, binary_data, tag_base + 4, 4);
	    value_offset = parseNum(endian, binary_data, tag_base + 8, 4);
	    if (types[type_field] === undefined) {
		continue;
	    }
	    type = types[type_field][0];
	    type_size = types[type_field][1];

	    if (type_size * num_values <= 4) {
		/* Data is in-line */
		value_offset = tag_base + 8;
	    } else {
		value_offset = base + value_offset;
	    }

	    /* Read the value */
	    if (type == "UNDEFINED") {
		value = binary_data.slice(value_offset, value_offset + num_values);
	    } else if (type == "ASCII") {
		value = binary_data.slice(value_offset, value_offset + num_values);
		/* strip trail nul */
	    } else {
		value = new Array();
		for (j = 0; j < num_values; j++, value_offset += type_size) {
		    if (type == "BYTE" || type == "SHORT" || type == "LONG") {
			value.push(parseNum(endian, binary_data, value_offset, type_size));
		    }
		    if (type == "SBYTE" || type == "SSHORT" || type == "SLONG") {
			value.push(parseSnum(endian, binary_data, value_offset, type_size));
		    }
		    if (type == "RATIONAL") {
			num = parseNum(endian, binary_data, value_offset, 4);
			den = parseNum(endian, binary_data, value_offset + 4, 4);
			value.push(new Rational(num, den));
		    }
		    if (type == "SRATIONAL") {
			num = parseSnum(endian, binary_data, value_offset, 4);
			den = parseSnum(endian, binary_data, value_offset + 4, 4);
			value.push(new Rational(num, den));
		    }
		    value.push();
		}
		if (num_values === 1) {
		    value = value[0];
		}
	    }

	    ifd[tags[tag_field][1]] = value;

	    console.log("Field: " + tags[tag_field][0] + "(" + tag_field + ")" + 
			" type: " + type + " num_values: " + 
			num_values + " value: " + value);

	}
	ifd.nextIfdPointer = parseNum(endian, base + ifd_offset + 2 + (num_fields * 12), 4);
	
	return ifd;
    }

    function exifHandler(mark, pos) {
	if (this.exif !== undefined) {
	    throw new Error("Multiple JFIF segments found");
	}

	/* Parse this TIFF header */
	var endian;
	var magic_field;
	var ifd_offset;
	var primary_ifd, exif_ifd, gps_ifd;
	var endian_field = this.binary_data.slice(pos, pos + 2);

	/* Trivia: This 'I' is for Intel, the 'M' is for Motorola */
	if (endian_field === "II") {
	    endian = "<";
	} else if (endian_field === "MM") {
	    endian = ">";
	} else {
	    throw new Error("Malformed TIFF meta-data. Unknown endianess: " + endian_field);
	}

	magic_field = parseNum(endian, this.binary_data, pos + 2, 2);

	if (magic_field !== 42) {
	    throw new Error("Malformed TIFF meta-data. Bad magic: " + magic_field);
	}

	ifd_offset = parseNum(endian, this.binary_data, pos + 4, 4);

	/* Parse 0th IFD */
	console.log("Parsing at offset: " + ifd_offset);
	primary_ifd = parseIfd(endian, this.binary_data, pos, ifd_offset, tifftags);

	if (primary_ifd.ExifIfdPointer) {
	    console.log("Parsing Exif at offset: " + primary_ifd.ExifIfdPointer);
	    exif_ifd = parseIfd(endian, this.binary_data, pos, primary_ifd.ExifIfdPointer, exiftags);
	}

	if (primary_ifd.GPSInfoIfdPointer) {
	    console.log("Parsing GPS at offset: " + primary_ifd.GPSInfoIfdPointer);
	    gps_ifd = parseIfd(endian, this.binary_data, pos, primary_ifd.GPSInfoIfdPointer, gpstags);
	}

	if (primary_ifd.nextIfdPointer) {
	    console.log("Can't handle multiple TIFF IFDs");
	}

	//this.exif = new ExifSegment();
	
	//console.log("Found JFIF: " + this.jfif);
    }

    function app1Handler(mark, pos) {
	var ident = this.binary_data.slice(pos, pos + 5);
	if (ident == EXIF_IDENT) {
	    exifHandler.call(this, mark, pos + 6);
	} else {
	    /* Don't know about other idents */
	}
    }



    JpegMeta.JpegFile = function (binary_data, filename) {
	/* Change this to EOI if we want to parse. */
	var break_segment = SOS;

	this.binary_data = binary_data;
	this.filename = filename;

	/* Go through and parse. */
	var pos = 0;
	var pos_start_of_segment = 0;
	var delim;
	var mark;
	var _mark;
	var segsize;
	var headersize;
	var mark_code;
	var mark_fn;

	if (this.binary_data.slice(0, 2) !== SOI_MARKER) {
	    throw new Error("Doesn't look like a JPEG file. First two bytes are " + 
			    this.binary_data.charCodeAt(0) + "," + 
			    this.binary_data.charCodeAt(1) + ".");
	}

	pos += 2;

	while (1) {
	    delim = this.binary_data.charCodeAt(pos++);
	    mark = this.binary_data.charCodeAt(pos++);

	    pos_start_of_segment = pos;

	    if (delim != DELIM) {
		console.log("Unexpected");
		break;
	    }

	    if (mark === break_segment) {
		break;
	    }

	    headersize = parseNum(">", this.binary_data, pos, 2);

	    /* Find the end */
	    pos += headersize;
	    while (pos < this.binary_data.length) {
		delim = this.binary_data.charCodeAt(pos++);
		if (delim == DELIM) {
		    _mark = this.binary_data.charCodeAt(pos++);
		    if (_mark != 0x0) {
			pos -= 2;
			break;
		    }
		}
	    }

	    segsize = pos - pos_start_of_segment;

	    if (markers[mark]) {
		mark_code = markers[mark][0];
		mark_fn = markers[mark][1];
	    } else {
		mark_code = "UNKN";
		mark_fn = undefined;
	    }
	    
	    console.log("Segsize: " + segsize + " Headersize: " + headersize + " Segment: " + mark_code);

	    if (mark_fn) {
		mark_fn.call(this, mark, pos_start_of_segment + 2);
	    }

	}

	if (this.general === undefined) {
	    throw Error("Invalid JPEG file.");
	}

	return this;
    }

    JpegMeta.JpegFile.prototype.toString = function () {
	return "[JpegFile " + this.filename + " " + 
	    this.general.type + " " + 
	    this.general.pixelWidth + "x" + 
	    this.general.pixelHeight +
	    " Depth: " + this.general.depth + "]";
    }

}());
