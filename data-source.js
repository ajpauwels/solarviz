// CSV requires
const parse = require('csv-parse');
const fs = require('fs');
const transform = require('stream-transform');

// MongoDB requires
const MongoClient = require('mongodb').MongoClient;

// Enhance the Date class
require('datejs');

// The DataSource object will handle retrieving and storing data points from various sources 
var DataSource = {
	mongoDB: null,
	mongoURL: "mongodb://admin:CaIO8n1IvvPGLa09UFEZiTTLieaLWsCE@ds139198.mlab.com:39198/solarviz"
};

DataSource.getMongoCollectionNames = function getMongoCollectionNames(cb) {
	// If the database never connected, do so now and then return to the task at hand
	if (this.mongoDB == null) {
		connectToMongo(this.mongoURL, (err) => {
			if (err) {
				cb(err, null, 0);
				return;
			}

			this.getMongoCollectionNames(cb);
		});
		return;
	}

	var db = this.mongoDB;

	db.listCollections().toArray((err, colls) => {
		if (err) {
			cb(err, null);
			return;
		}

		colls = colls.filter((elem, i) => {
			return elem.name != 'system.indexes';
		}).map((elem, i) => {
			return elem.name;
		});

		cb(null, colls);
	});
}

/**
 * Attempts to retrieve data within the given range and at the given resolution from a
 * MongoDB store
 * 
 * @param collectionName The name of the MongoDB collection in which the data is stored
 * @param begin A Date object specifying the start of the range
 * @param end A Date object specifying the end of the range
 * @param targetRes A number representing the interval in milliseconds between each data point
 * @param max The maximum number of records to return
 * @param cb A callback function which receives as parameters: error, records, actual resolution
 *			 Error is non-null if an error was encountered during processing
 *			 Records is the array of data points (JSON objects with timestamp and load value)
 *			 Actual resolution is the resolution of the data points
 */
DataSource.getMongoData = function getMongoData(collectionName, begin, end, targetRes, max, cb) {
	// If the database never connected, do so now and then return to the task at hand
	if (this.mongoDB == null) {
		connectToMongo(this.mongoURL, (err) => {
			if (err) {
				cb(err, null, 0);
				return;
			}

			this.getMongoData(collectionName, begin, end, targetRes, max, cb);
		});
		return;
	}

	// Get the database and collection from which data will be pulled
	var db = this.mongoDB;
	var coll = db.collection(collectionName);

	// If a time range has been specified, add it to the query
	var mongoTimestampRange = {};
	if (begin) {
		mongoTimestampRange.ts = mongoTimestampRange.ts || {};
		mongoTimestampRange.ts["$gte"] = begin.getTime();
	}

	if (end) {
		mongoTimestampRange.ts = mongoTimestampRange.ts || {};
		mongoTimestampRange.ts["$lte"] = end.getTime();
	}

	// Perform the query using the specified time range, sort it, and then process the results
	coll.find(
		mongoTimestampRange
	).sort().toArray((err, docs) => {
		// This array will store the final processed output, based on targetRes and max
		var output = [];

		// Stores the original resolution of the points
		var fileResMillis = 0;

		// Only process if there was more than one point
		if (docs.length > 1) {
			// Grab the first two timestamps to determine resolution
			var p1ts = docs[0].ts;
			var p2ts = docs[1].ts;

			// Compute the resolution and the interval between each data point based on targetRes
			fileResMillis = p2ts - p1ts;
			var recsPerTargetRes = targetRes > 0 ? Math.ceil(targetRes / fileResMillis) : 1;

			// Keep only those data points which match targetRes, and don't go above max
			for (var i = 0; i < docs.length && output.length < max; ++i) {
				if (i % recsPerTargetRes == 0) {
					output.push(docs[i]);
				}
			}
		}
		// If there were zero or one points, return that
		else {
			output = docs;
		}

		// Call the callback with the data and actual resolution used
		cb(null, output, fileResMillis * recsPerTargetRes, fileResMillis);
	});
}

/**
 * Attempts to retrieve data within the given range and at the given resolution from a
 * CSV file
 * 
 * @param begin A Date object specifying the start of the range
 * @param end A Date object specifying the end of the range
 * @param targetRes A number representing the interval in milliseconds between each data point
 * @param cb A callback function which receives as parameters: error, records, actual resolution
 *			 Error is non-null if an error was encountered during processing
 *			 Records is the array of data points (JSON objects with timestamp and load value)
 *			 Actual resolution is the resolution of the data points
 */
DataSource.getCSVData = function getCSVData(fp, begin, end, targetRes, max, cb) {
	// Create our CSV parser
	var parser = parse({
		delimiter: ',',
		columns: ['ts', 'pvLoad', 'facilityLoad', 'storageGen']
	});

	// Define the CSV input file stream, skip the header
	var input = fs.createReadStream(fp, { start: 73 });

	// Array to store all of our data points
	var output = [];

	// Tracks the index of the record in the file (each record separated by newline)
	var i = 0;

	// Stores the number of actual records between each desired record
	var recsPerTargetRes = 1;

	// Counts up when to get the next record
	var nextCountup = 0;

	// The CSV file's resolution in milliseconds
	var fileResMillis;

	// The very first and second record in the file
	var firstTS, secondTS;

	// Parses each record and determines whether or not to keep
	var transformer = transform(function(record) {
		// Don't process the data point if we already have the max number of points requested
		if (max != null && output.length >= max) return;

		// Convert the date string to a Date object Iassumes any timestamp is in UTC)
		var date = Date.parse(record.ts + 'Z');

		// If the record for some reason wasn't properly formatted, return
		if (date == null) return;

		if (DataSource.isDateInRange(date, begin, end)) {
			// Create the record object
			record.ts = date.getTime();

			// Store the first record in the file for computing time resolution
			if (i == 0) {
				firstTS = date;
			}
			// Store the second record in the file and compute time resolution
			else if (i == 1) {
				secondTS = date;

				fileResMillis = secondTS.getTime() - firstTS.getTime();

				recsPerTargetRes = targetRes > 0 ? Math.ceil(targetRes / fileResMillis) : 1;
			}

			// Indicate one more record has been processed
			nextCountup++;

			// Only include points at the desired interval
			if (nextCountup == recsPerTargetRes) {
				record.pvLoad = parseInt(record.pvLoad);
				record.facilityLoad = parseInt(record.facilityLoad);
				record.storageGen = parseInt(record.storageGen);
				output.push(record);
				nextCountup = 0;
			}
			++i;
		}
	}, { parallel: 10 });

	// Add the finish listener
	input.on('close', () => {
		cb(null, output, fileResMillis * recsPerTargetRes);
	});

	// Catch any errors
	input.on('error', (err) => {
		cb(err, null, 0);
	});

	// Perform the read and parse operation
	input
		.pipe(parser)
		.on('error', (err) => {
			cb(err, null, 0);
		})
		.pipe(transformer);
}

/**
 * Takes in a path to a CSV file and parses the data into MongoDB.
 *
 * @param fp Path to the CSV file that will be processed
 * @param cb Callback function receives only an error parameter, which is only non-null
 * 			 if an error occurred, and null otherwise
 */
DataSource.CSVtoMongo = function CSVtoMongo(fp, cb) {
	// Connect to MongoDB if not yet connected
	if (this.mongoDB == null) {
		connectToMongo(this.mongoURL, (err) => {
			if (err) {
				console.log("[ERROR] Could not connect to MongoDB database: " + err);
				cb(err);
				return;
			}
			this.CSVtoMongo(fp, cb);
		});
		return;
	}

	// Parse the data
	this.getCSVData(fp, null, null, null, null, (err, data, actualRes) => {
		if (err) {
			console.log("[ERROR] There was an error retrieving the CSV data: " + err);
			cb(err);
			return;
		}

		var db = this.mongoDB;
		var cleanedFp = fp.split('/');
		cleanedFp = cleanedFp[cleanedFp.length - 1];
		if (cleanedFp.slice(-4) == '.csv') cleanedFp = cleanedFp.slice(0, -4);
		var coll = db.collection(cleanedFp);

		coll.insertMany(data, (err, result) => {
			if (err) {
				cb(err);
				return;
			}

			coll.createIndex(
				{ 'ts': 1 },
				{ 'unique': true },
				(err, results) => {
					if (err) {
						cb(err);
						return;
					}

					cb(null);
				}
			);
		});
	});
}

/**
 * Checks if the given date object is within begin and end. If begin and end
 * are both null, any date is in range. If begin is null, any date before end
 * is in range. If end is null, any date after begin is in range. If neither begin
 * nor end are null, any date after begin and before end is in range. The left and
 * right bounds are inclusive.
 *
 * @param date The date object to check
 * @param begin The date object specifying the left bound
 * @param end The date object specifying the right bound
 *
 * @return True if in range, false otherwise
 */
DataSource.isDateInRange = function isDateInRange(date, begin, end) {
	var inRange;

	if (begin == null && end == null) {
		inRange = true;
	}
	else if (begin == null) {
		inRange = date.isBefore(end) || date.equals(end);
	}
	else if (end == null) {
		inRange = date.isAfter(begin) || date.equals(begin);
	} else {
		inRange = date.between(begin, end);
	}

	return inRange;
}

/**
 * Connects to MongoDb at the specified URL.
 *
 * @param url The URL to the MongoDB
 * @param cb A callback function, receives just an error parameter which is null
 *			 if the function connected successfully
 */
function connectToMongo(url, cb) {
	DataSource.url = url;
	DataSource.db = null;
	MongoClient.connect(url, (err, db) => {
		if (err) {
			console.log("[ERROR] Could not connect to MongoDB database: " + err);
			DataSource.mongoDB = null;
			cb(err);
			return;
		}
		console.log("[INFO] Connected to MongoDB database");
		DataSource.mongoDB = db;
		cb(null);
	});
}

module.exports = DataSource;