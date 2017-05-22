// File handling module
var fs = require('fs');

// Date module
require('datejs');

// Stream for writing to file
var stream = fs.createWriteStream('loadLog')

// Set this to the resolution in seconds per reading
var resolution = 30 * 60;	// 30 minutes

// Set this to the number of seconds of readings to have
var length = 60 * 60 * 24 * 3;	// 3 days

// Set this to the starting year of the data
var beginYear = 2017;

if (resolution == 0) {
	console.log("[ERROR] Resolution is 0, cannot create log, exiting...");
	process.exit();
}

// The initial date object set at first moment of given year
var date = Date.parse('01/01/' + beginYear + ' 00:00:00');
var begin = date;
var end = new Date(date).add(length).seconds();

createLog();

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Creates the log using a file stream writer and mindful of drain events
 */
function createLog() {
	var ok = stream.write('Time Stamp,PV Generation (Wh),Facility Load (Wh),Storage Generation (Wh)\n', 'utf8');
	do {
		// Create the timestamp by stripping the ISO string of unnecessary chars
		var ts = date.toString('M/d/yy H:mm');

		// Get a random number for the loads
		var facilityLoad = randRange(-10000, 10000);
		var pvLoad = randRange(0, 10000);
		var storageGen = pvLoad - facilityLoad;

		// Assemble the final string
		var finalStr = ts + ',' + pvLoad.toString() + ',' + facilityLoad.toString() + ',' + storageGen.toString() + '\n';

		// Write to the stream and check if previous string was written
		ok = stream.write(finalStr, 'utf8');

		// Compute the next timestamp
		date.add(resolution).seconds();
	} while ((Date.compare(date, end) == -1) && ok);

	if (Date.compare(date, end) == -1) {
		stream.once('drain', createLog);
	} else {
		stream.end();
	}
}