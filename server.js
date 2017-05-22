// process.env.TZ = 'Europe/London';
// Required modules
var express = require('express');
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var favicon = require('serve-favicon');
require('datejs');

// Multi-part form upload setup
var multerStorage = multer.diskStorage({
	destination: function(req, file, cb) {
		cb(null, 'data/');
	},
	filename: function(req, file, cb) {
		console.log("[INFO] file.fieldname: " + file.fieldname);
		cb(null, file.fieldname);
	}
});
var upload = multer({ storage: multerStorage })

var DataSource = require('./data-source.js');
var pathToCSV = './data/';

// Global vars
var app = express();					// The express app
var PORT = process.env.PORT || 8080;	// Port to listen on

// Static file routing
app.use(express.static('public'));

// Serve up the favicon
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// Middleware
app.set('views', 'public');
app.set('view engine', 'pug');

// Routing
app.get('/', (req, res) => {
	DataSource.getMongoCollectionNames((err, names) => {
		if (err) {
			console.log("[ERROR] Could not read available data sets: " + err.toString());
			res.render('index', { 'msg': 'Could not retrieve data sets' });
		}

		res.render('index', { 'files': names });
	});
});

app.get('/api/load', (req, res) => {
	res.setHeader('Content-Type', 'application/json');

	if (!req.query.src) {
		console.log("[ERROR] No data source provided in request");
		res.status(400).send(JSON.stringify({ status: 0, error: "No src parameter provided" }));
		return;
	}

	var src = req.query.src;
	var dateFrom = req.query.from ? new Date(parseInt(req.query.from)) : null;
	var dateTo = req.query.to ? new Date(parseInt(req.query.to)) : null;
	var resolution = req.query.resolution ? parseInt(req.query.resolution) : 0;
	var max = req.query.max ? parseInt(req.query.max) : 300;

	DataSource.getMongoData(src, dateFrom, dateTo, resolution, max, (err, output, actualRes, origRes) => {
		if (err) {
			res.status(500).send(JSON.stringify({ status: 0, error: "Server error: check logs" }));
		} else {
			respObj = { status: 1, actual_res: actualRes, original_res: origRes, points: output }
			res.status(200).send(respObj);
		}
	});
});

app.get('/api/datasets', (req, res) => {
	res.setHeader('Content-Type', 'application/json');

	DataSource.getMongoCollectionNames((err, names) => {
		if (err) {
			console.log("[ERROR] Could not read available data sets: " + err.toString());
			res.status(500).send(JSON.stringify({ status: 0, error: 'Server error: check logs' }));
		}
		console.log("BLAH");

		res.status(200).send(JSON.stringify({ status: 1, files: names }));
	});
});

app.post('/upload', upload.single(), (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	var fileData = req.body.files;
	var fileNames = req.body.fileNames;

	// Counts how many of the uploaded files have been written
	var writeCount = 0;

	// Keeps track of any errors that occurred along the way
	var writeErrOccurred = false;

	for (var i = 0; i < fileData.length; ++i) {
		var index = i;
		var fn = fileNames[index];

		// Add the CSV extension
		if (fn.substring(fn.length - 4, fn.length) != '.csv') {
			fn += '.csv';
		}

		// Write the data to file
		fs.writeFile('./data/' + fn, fileData[index], (err) => {
			if (err) {
				console.log("[ERROR] Could not write file: " + err);
				writeErrOccurred = true; 
				return;
			}

			DataSource.CSVtoMongo('./data/' + fn, (err) => {
				if (err) {
					console.log("[ERROR] Could not convert CSV to mongo: " + err);
					writeErrOccurred = true;
				} else {
					console.log("[INFO] Converted CSV file to MongoDB");
				}

				if ((index + 1) == fileData.length) {
					if (writeErrOccurred) {
						res.status(500).send(JSON.stringify({ status: 0, error: 'Server error: check logs' }));
						return;
					}

					DataSource.getMongoCollectionNames((err, names) => {
						if (err) {
							console.log("[ERROR] Could not read available data sets: " + err.toString());
							res.status(500).send(JSON.stringify({ status: 0, error: 'Server error: check logs' }));
						}

						res.status(200).send(JSON.stringify({ status: 1, files: names }));
					});
				}
			});
		});
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`Started listening on port ${PORT}`);
	console.log('Press Ctrl+C to quit\n');
});

// Helpers
function getCSVFileNames(cb) {
	fs.readdir(pathToCSV, (err, files) => {
		if (err) {
			cb(err, null);
		}

		var cleanFiles = files.filter((file) => {
			var ext = file.substring(file.length - 3).toLowerCase();
			return ext == 'csv'
		}).map((file) => {
			return file.substring(0, file.length - 4);
		});

		cb(null, cleanFiles);
	})
}