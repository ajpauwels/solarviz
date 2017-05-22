// c3.js object which stores and creates the chart
var chart = {};

// Array stores all operations to create new data sets on the graph
var operations = [];

/**
 * Wait for the DOM to load in order to:
 * 	- Setup change binding on the data, range, and resolution selections
 *	- Setup bindings on the upload button
 *	- Setup the initial graph with a default data set
 */
window.onload = function() {
	// Retrieve various UI elements
	var uploadBtn = document.getElementById('upload-input');
	var updateBtn = document.getElementById('update-btn');
	var dataSelector = document.getElementById('data-select');
	var beginDateSelector = document.getElementById('begin-date');
	var endDateSelector = document.getElementById('end-date');
	var resolutionNumberValue = document.getElementById('resolution');
	var resolutionUnitSelect = document.getElementById('resolution-unit-select');

	// When the update graph button is pressed, update the graph and disable the button
	updateBtn.addEventListener('click', () => {
		updateGraph(true);
		updateBtn.setAttribute('disabled', true);
	})

	// When the begin date is updated, enable the update graph button
	beginDateSelector.addEventListener('input', () => {
		updateBtn.removeAttribute('disabled');
	});

	// When the end date is updated, enable the update graph button
	endDateSelector.addEventListener('input', () => {
		updateBtn.removeAttribute('disabled');
	});

	// When a data set is selected, update the graph requesting the full data and disable the update button
	dataSelector.addEventListener('change', () => {
		updateGraph(false);
		updateBtn.setAttribute('disabled', true);
	});

	// When the resolution value is updated, enable the update graph button
	resolutionNumberValue.addEventListener('input', () => {
		updateBtn.removeAttribute('disabled');
	});

	// When the resolution unit is updated, enable the update graph button
	resolutionUnitSelect.addEventListener('change', () => {
		updateBtn.removeAttribute('disabled');
	});

	// When a CSV file is selected for upload, send it to the server asynchronously via /upload
	uploadBtn.addEventListener('change', (e) => {
		// Check browser compatibility
		if (!FormData) {
			console.log("[ERROR] Browser too old to support AJAX file upload");
			return;
		}

		// fileResults contains the selected file contents, fileNames just contains the name of the data set
		var fileResults = [];
		var fileNames = [];

		// Go through each selected file to upload
		for (var i = 0; i < uploadBtn.files.length; ++i) {
			// Retrieve the file and its name
			var file = uploadBtn.files[i];
			var reader = new FileReader();

			// Add the name to the array
			fileNames.push(file.name);

			// Read the selected file
			reader.readAsText(file, 'UTF-8');
			reader.onload = (e) => {
				// Push the read contents to the array
				fileResults.push(e.target.result);

				// If all files have been processed, send them all to the server
				if (fileResults.length == uploadBtn.files.length) {
					var httpReq = new XMLHttpRequest();
					var formData = new FormData();
					formData.append("files[]", fileResults);
					formData.append("fileNames[]", fileNames);

					// Error out if an AJAX req could not be created
					if (!httpReq) {
						console.log('[ERROR] Could not create an AJAX request');
						return;
					}

					// Process the response
					httpReq.onreadystatechange = () => {
						if (httpReq.readyState == XMLHttpRequest.DONE) {
							// On success, update the data set selector and graph to reflect the uploaded data
							if (httpReq.status == 200) {
								var respObj = JSON.parse(httpReq.responseText);
								var defaultSet = fileNames[0];

								if (defaultSet.slice(-4) == '.csv') {
									defaultSet = defaultSet.substring(0, defaultSet.length - 4);
								}

								setDataSets(respObj.files, defaultSet);
								updateGraph(false);
							}
							// On failure, output the error
							else {

							}
						}
					}

					httpReq.open('post', '/upload', true);
					httpReq.send(formData);
				}
			}
		}
	});

	updateGraph(false);
}

/**
 * Takes in an array of data set names and an optional name to use as the default,
 * and updates the data set selector to contain these names with the
 * appropriate default selected.
 *
 * @param dataSetNames The array of data set names
 * @param defaultName The data set to use as default
 */
function setDataSets(dataSetNames, defaultName) {
	var dataSetSelector = document.getElementById('data-select');

	var newInnerHTML = "";

	for (var i = 0; i < dataSetNames.length; ++i) {
		var name = dataSetNames[i];

		if (defaultName && name == defaultName) {
			newInnerHTML += '<option class="data-option" selected>' + dataSetNames[i] + '</option>';
		} else {
			newInnerHTML += '<option class="data-option">' + dataSetNames[i] + '</option>';
		}
	}

	dataSetSelector.innerHTML = newInnerHTML;
}

/**
 * Removes all operations from the UI
 */
function clearAllOperations() {
	var operationsFieldset = document.getElementById('operations-fields');
	var allOperations = document.getElementsByClassName('operation-form-group');

	while (allOperations.length > 0) {
		operationsFieldset.removeChild(allOperations[0]);
	}
}

/**
 * Takes in a list of data sets and adds a new operations field to the
 * list of operations, using the list of names to populate the select
 * of data sets
 *
 * @param names The names of the data sets
 */
function addOperation(names) {
	var opNumber = document.getElementsByClassName('operation-form-group').length + 1;
	var newFormgroupDiv = document.createElement('div');
	var showOpCheckbox = document.createElement('input');
	var formgroupLabel = document.createElement('label');
	var leftDataSelectorDiv = document.createElement('div');
	var rightDataSelectorDiv = document.createElement('div');
	var operationSelectorDiv = document.createElement('div');
	var leftDataSelector = document.createElement('select');
	var rightDataSelector = document.createElement('select');
	var operationSelector = document.createElement('select');
	var plusOption = document.createElement('option');
	var minusOption = document.createElement('option');
	var multOption = document.createElement('option');
	var divOption = document.createElement('option');
	plusOption.value = '+';
	plusOption.text = '+';
	minusOption.value = '-';
	minusOption.text = '-';
	multOption.value = '*';
	multOption.text = '*';
	divOption.value = '/';
	divOption.text = '/';

	formgroupLabel.innerHTML = '#' + opNumber;

	operationSelector.add(plusOption);
	operationSelector.add(minusOption);
	operationSelector.add(multOption);
	operationSelector.add(divOption);

	for (var i = 0; i < names.length; ++i) {
		var newOption1 = document.createElement('option');
		var newOption2 = document.createElement('option');
		newOption1.value = names[i];
		newOption1.text = names[i];
		newOption2.value = names[i];
		newOption2.text = names[i];
		leftDataSelector.add(newOption1);
		rightDataSelector.add(newOption2);
	}

	showOpCheckbox.type = 'checkbox';
	showOpCheckbox.id = 'op-' + opNumber + '-checkbox';
	formgroupLabel.addEventListener('click', () => {
		if (showOpCheckbox.checked) {
			updateOperationOnChart(opNumber);
		} else {
			removeOperationFromChart(opNumber);
		}
	});

	newFormgroupDiv.className = "form-group operation-form-group";
	showOpCheckbox.className = "operation-show-checkbox col-md-1";
	formgroupLabel.className = "col-md-2 control-label";
	formgroupLabel.htmlFor = "op-" + opNumber + '-checkbox';
	leftDataSelectorDiv.className = "col-md-3";
	operationSelectorDiv.className = "col-md-1";
	rightDataSelectorDiv.className = "col-md-3";
	leftDataSelector.className = "form-control operation-" + opNumber + "-data-selector";
	operationSelector.className = "form-control operation-" + opNumber + "-operator-selector";
	rightDataSelector.className = "form-control operation-" + opNumber + "-data-selector";

	formgroupLabel.insertBefore(showOpCheckbox, formgroupLabel.firstChild);
	leftDataSelectorDiv.appendChild(leftDataSelector);
	rightDataSelectorDiv.appendChild(rightDataSelector);
	operationSelectorDiv.appendChild(operationSelector);

	newFormgroupDiv.appendChild(formgroupLabel);
	newFormgroupDiv.appendChild(leftDataSelectorDiv);
	newFormgroupDiv.appendChild(operationSelectorDiv);
	newFormgroupDiv.appendChild(rightDataSelectorDiv);

	var allOperations = document.getElementById('operations-fields');
	allOperations.insertBefore(newFormgroupDiv, document.getElementById('new-op-div'));
}

/**
 * Removes the specified operation number from display in the chart
 *
 * @param num The operation number
 */
function removeOperationFromChart(num) {
	chart.load({
		unload: [ '#' + num ]
	});
}

/**
 * Takes in the number of an operation and updates that operation
 * on the graph. The number is an index, with operation #1 = 1, etc
 *
 * @param num The operation number
 */
function updateOperationOnChart(num) {
	var allOps = document.getElementsByClassName('operation-form-group');

	// Don't do anything if there is no specified operation of that number
	if (num > allOps.length) return;

	var opElem = allOps[num - 1];
	var dataSelectors = document.getElementsByClassName('operation-' + num + '-data-selector');
	var leftDataSelector = dataSelectors[0];
	var rightDataSelector = dataSelectors[1];
	var opSelector = document.getElementsByClassName('operation-' + num + '-operator-selector')[0];
	var leftDataSetName, rightDataSetName, opSymbol;
	var leftDataSet, rightDataSet;

	// If no data set selected or no operation selected, return
	if (leftDataSelector.selectedIndex == -1 || rightDataSelector.selectedIndex == -1 || opSelector.selectedIndex == -1) return;
	leftDataSetName = leftDataSelector.options[leftDataSelector.selectedIndex].value;
	rightDataSetName = rightDataSelector.options[rightDataSelector.selectedIndex].value;
	opSymbol = opSelector.options[opSelector.selectedIndex].value;

	var allDataArrays = chart.internal.data.targets;

	for (var i = 0; i < allDataArrays.length && (!leftDataSet || !rightDataSet); ++i) {
		var dataObj = allDataArrays[i];

		if (leftDataSetName == dataObj.id) {
			leftDataSet = dataObj.values;
		}
		if (rightDataSetName == dataObj.id) {
			rightDataSet = dataObj.values;
		}
	}

	var newDataSet = [ '#' + num ];
	var numPoints = leftDataSet.length < rightDataSet.length ? leftDataSet.length : rightDataSet.length;
	for (var i = 0; i < numPoints; ++i) {
		var computedValue;
		switch (opSymbol) {
			case '+':
				computedValue = leftDataSet[i].value + rightDataSet[i].value;
				break;

			case '-':
				computedValue = leftDataSet[i].value - rightDataSet[i].value;
				break;

			case '*':
				computedValue = leftDataSet[i].value * rightDataSet[i].value;
				break;

			case '/':
				computedValue = leftDataSet[i].value / rightDataSet[i].value;
				break;
			default:
				computedValue = 0;
				console.log("[ERROR] Unrecognized operation");
		}
		newDataSet.push(computedValue);
	}
	chart.load({
		columns: [
			newDataSet
		]
	});
}

/**
 * Determines the most logical numerical value and unit for a resolution
 * given the resolution in milliseconds. The selected unit will be the one
 * which which has highest magnitude with a numerical value >= 1
 *
 * @param resInMillis The resolution in milliseconds
 */
function determineBestResolutionUnit(resInMillis) {
	var resObj = {};

	if (resInMillis < 1000) {
		resObj.value = resInMillis;
		resObj.unit = "millis";
	}
	else if (resInMillis < 1000 * 60) {
		resObj.value = resInMillis / 1000.0;
		resObj.unit = "secs";
	}
	else if (resInMillis < 1000 * 60 * 60) {
		resObj.value = resInMillis / (1000.0 * 60.0);
		resObj.unit = "mins";
	}
	else if (resInMillis < 1000 * 60 * 60 * 60) {
		resObj.value = resInMillis / (1000.0 * 60.0 * 60.0);
		resObj.unit = "hrs";
	}
	else if (resInMillis < 1000 * 60 * 60 * 60 * 24) {
		resObj.value = resInMillis / (1000.0 * 60.0 * 60.0 * 24.0);
		resObj.unit = "days";
	}

	return resObj;
}

/**
 * Takes in a resolution in milliseconds and updates the resolution
 * value and unit fields in the UI accordingly
 *
 * @param resInMillis The resolution in milliseconds
 */
function setResolution(resInMillis) {
	var resNumberInput = document.getElementById('resolution');
	var resUnitSelect = document.getElementById('resolution-unit-select');
	var resObj = determineBestResolutionUnit(resInMillis);

	resNumberInput.value = resObj.value;
	resUnitSelect.value = resObj.unit;
}

/**
 * Takes in a begin and end date and updates the begin and end date
 * selection fields in the UI accordingly
 *
 * @param beginDate Date object that defines the left bound of the range
 * @param endDate Date object that defines the right bound of the range
 */
function setRange(beginDate, endDate) {
	var beginDateSelector = document.getElementById('begin-date');
	var endDateSelector = document.getElementById('end-date');

	beginDateSelector.valueAsDate = beginDate;
	endDateSelector.valueAsDate = endDate;
}

function updateSummaryStats(xVals, yVals, domain, originalRes) {
	// If there are no timestamps or no data points, don't bother with trying to compute indices
	if (xVals.length <= 1 || yVals.length == 0) {
		setOriginalResolutionStat(originalRes, origResElem);
		peakEnergyElem.innerHTML = "N/A";
		consumptionElem.innerHTML = "N/A";
		return;
	}

	var firstPt = xVals[1];
	var lastPt = xVals[xVals.length - 1];
	var beginRange = domain[0];
	var endRange = domain[1];
	var beginIndex = 1;
	var endIndex = 1;

	if (xVals.length > 2) {
		var resInMillis = xVals[2].getTime() - firstPt.getTime();
		beginIndex = Math.floor((beginRange.getTime() - firstPt.getTime()) / resInMillis) + 1;
		endIndex = (xVals.length - 1) + Math.floor((endRange.getTime() - lastPt.getTime()) / resInMillis);
	}

	if (beginIndex < 1) beginIndex = 1;
	if (endIndex >= xVals.length) endIndex = xVals.length - 1;

	for (var i = 0; i < yVals.length; ++i) {
		var data = yVals[i];
		var statUIBlock = document.getElementById(i + '-stats');
		if (!statUIBlock) {
			var newDiv = document.createElement('div');
			newDiv.id = i + '-stats';

			var header = document.createElement('p');
			header.className = 'bold';
			header.innerHTML = data[0];

			var origResP = document.createElement('p');
			origResP.className = 'col-md-12';
			origResP.id = i + '-orig-res-stat';
			origResP.innerHTML = "Original resolution: <span class='bold'></span>";

			var peakPowerP = document.createElement('p');
			peakPowerP.className = 'col-md-12';
			peakPowerP.id = i + '-peak-power-stat';
			peakPowerP.innerHTML = "Peak power usage: <span class='bold'></span>";

			var totalEnergyConsumptionP = document.createElement('p');
			totalEnergyConsumptionP.className = 'col-md-12';
			totalEnergyConsumptionP.id = i + '-total-energy-consumption-stat';
			totalEnergyConsumptionP.innerHTML = "Total energy consumption: <span class='bold'></span>";

			newDiv.appendChild(header);
			newDiv.appendChild(origResP);
			newDiv.appendChild(peakPowerP);
			newDiv.appendChild(totalEnergyConsumptionP);
			document.getElementById('summary-stats-field').appendChild(newDiv);
		}
		var origResElem = document.getElementById(i + '-orig-res-stat').getElementsByTagName('span')[0];
		var peakEnergyElem = document.getElementById(i + '-peak-power-stat').getElementsByTagName('span')[0];
		var consumptionElem = document.getElementById(i + '-total-energy-consumption-stat').getElementsByTagName('span')[0];
		setOriginalResolutionStat(originalRes, origResElem);
		setPeakEnergyUsageStat(xVals, data, beginIndex, endIndex, peakEnergyElem);
		setTotalEnergyConsumptionStat(xVals, data, beginIndex, endIndex, consumptionElem);
	}
}

/**
 * Sets the total energy consumption stat in the UI to the given value.
 * Assumes inputted data is in Wh and converts to kWh.
 *
 * @param points The array of points to compute and display total energy consumption for
 * @param res The number of milliseconds between each point
 * @param htmlElem The element whose inner HTML will be replaced to display this information
 */
function setTotalEnergyConsumptionStat(xVals, yVals, beginIndex, endIndex, htmlElem) {
	if (beginIndex == endIndex) {
		htmlElem.innerHTML = "N/A";
		return;
	}

	var res = xVals[endIndex].getTime() - xVals[endIndex - 1].getTime();
	var totalConsumption = 0;

	for (var i = beginIndex + 1; i <= endIndex; ++i) {
		var prevPt = { ts: xVals[i].getTime(), value: yVals[i - 1] };
		var nextPt = { ts: xVals[i].getTime(), value: yVals[i] };

		var valsEql = prevPt.value == nextPt.value;
		var signFlip = (prevPt.value != 0) && (nextPt.value != 0) && Math.sign(prevPt.value) != Math.sign(nextPt.value);
		if (!valsEql) {
			if (signFlip) {
				var xValAt0 = prevPt.ts - prevPt.value * ((nextPt.ts - prevPt.ts) / (nextPt.value - prevPt.value));
				var t1Height = prevPt.value;
				var t1Width = (xValAt0 - prevPt.ts) / 3600000;
				var t2Height = nextPt.value;
				var t2Width = (nextPt.ts - xValAt0) / 3600000;

				totalConsumption += t1Width * t1Height * 0.5;
				totalConsumption += t2Width * t2Height * 0.5;
			} else {
				var width = res / 3600000;
				var triangleHeight = Math.abs(prevPt.value - nextPt.value);
				var rectHeight = prevPt.value < nextPt.value ? prevPt.value : nextPt.value;
				var sign = Math.sign(prevPt.value) == 0 ? Math.sign(nextPt.value) : Math.sign(prevPt.value);

				totalConsumption += width * triangleHeight * 0.5 * sign;
				totalConsumption += width * rectHeight;
			}
		} else {
			totalConsumption += prevPt.value * (res / 3600000);
		}
	}

	htmlElem.innerHTML = Math.floor((totalConsumption / 1000) + 0.5) + ' kWh';
}

/**
 * Sets the peak energy usage stat in the UI given an array of points.
 * Finds the point with the highest facility load and displays its timestamp
 * and value.
 *
 * @param points The array of points to display the max value of
 * @param htmlElem The element whose inner HTML will be replaced to display this information
 */
function setPeakEnergyUsageStat(xVals, yVals, beginIndex, endIndex, htmlElem) {
	var valStr = "N/A";

	if (xVals.length > 1 && yVals.length > 1) {
		var peakEnergy = {
							ts: xVals[beginIndex].getTime(),
							value: yVals[beginIndex]
						 };
		for (var i = beginIndex; i <= endIndex; ++i) {
			var dataPoint = yVals[i];

			if (dataPoint > peakEnergy.value) {
				peakEnergy.ts = xVals[i].getTime();
				peakEnergy.value = dataPoint;
			}
		}

		valStr = Math.floor((peakEnergy.value / 1000) + 0.5) + ' kW';
		valStr += ' on ' + tsToString(peakEnergy.ts);
	}

	htmlElem.innerHTML = valStr;
}

/**
 * Sets the original resolution in the UI to the given value
 *
 * @param newOrigRes The new value
 * @param htmlElem The element whose inner HTML will be replaced to display this information
 */
function setOriginalResolutionStat(newOrigRes, htmlElem) {
	// Take care of original resolution
	var origStr = "N/A";
	if (newOrigRes) {
		var resObj = determineBestResolutionUnit(newOrigRes);
		origStr = resObj.value + ' ' + resObj.unit;
	}
	htmlElem.innerHTML = origStr;
}

/**
 * Takes in a UTC timestamp and returns a formatted date string to be used
 * for any timestamps in the UI
 *
 * @param utcMillis The UTC timestamp in milliseconds
 */
function tsToString(utcMillis) {
	// The date object is in UTC
	var date = new Date(utcMillis);

	// Create the string with leading zeroes
	var string = date.getUTCFullYear() + '-';
	string += ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-';
	string += ('0' + date.getUTCDate()).slice(-2) + ' ';
	string += ('0' + date.getUTCHours()).slice(-2) + ':';
	string += ('0' + date.getUTCMinutes()).slice(-2) + ':';
	string += ('0' + date.getUTCSeconds()).slice(-2);
	return string;
}

/**
 * Updates the graph, uses the parameters defined in the UI only if instructed
 * to do so
 *
 * @param useOptions If true, applies the UI parameters to the data
 */
function updateGraph(useOptions) {
	var dataSelector = document.getElementById('data-select');
	var beginDateSelector = document.getElementById('begin-date');
	var endDateSelector = document.getElementById('end-date');
	var resolutionNumberValue = document.getElementById('resolution');
	var resolutionUnitSelect = document.getElementById('resolution-unit-select');

	var beginDateValue = beginDateSelector.value;
	var beginYear = beginDateValue.substring(0, 4);
	var beginMonth = parseInt(beginDateValue.substring(5, 7)) - 1;
	var beginDay = beginDateValue.substring(8, 10);

	var endDateValue = endDateSelector.value;
	var endYear = endDateValue.substring(0, 4);
	var endMonth = parseInt(endDateValue.substring(5, 7)) - 1;
	var endDay = endDateValue.substring(8, 10);

	var dataSource = dataSelector.value;
	var beginDate = new Date(beginYear, beginMonth, beginDay, 0, 0, 0, 0);
	var endDate = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
	var resolutionVal = resolutionNumberValue.value;
	var resolutionUnitVal = resolutionUnitSelect.value;
	var resolutionUnitMultiplier = -1;

	// Only use date values if they're valid
	beginDate = Date.parse(beginDate) ? new Date(beginDate.getTime() - (beginDate.getTimezoneOffset() * 60 * 1000)) : null;
	endDate  = Date.parse(endDate) ? new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60 * 1000)) : null;

	// Target resolution for the API is in milliseconds, this converts the value to millis
	switch (resolutionUnitVal) {
		case "millis":
			resolutionUnitMultiplier = 1;
			break;
		case "secs":
			resolutionUnitMultiplier = 1000;
			break;
		case "mins":
			resolutionUnitMultiplier = 1000 * 60;
			break;
		case "hrs":
			resolutionUnitMultiplier = 1000 * 60 * 60;
			break;
		case "days":
			resolutionUnitMultiplier = 1000 * 60 * 60 * 24;
			break;
	}

	// Only use resolution if it's greater than zero
	resolutionVal = resolutionVal > 0 ? resolutionVal * resolutionUnitMultiplier : null;

	getData(dataSource, useOptions && beginDate ? beginDate : null, useOptions && endDate ? endDate : null, useOptions && resolutionVal ? resolutionVal : null, (err, data) => {
		if (err) {
			console.log('[ERROR] ' + err);

			if (data) {
				console.log('[ERROR] ' + data.error);
			}

			return;
		}

		if (data.points.length == 0) {
			console.log('[ERROR] No data points found');
			return;
		}

		var firstTS = data.points[0].ts;
		var lastTS = data.points[data.points.length - 1].ts;

		var firstDate = new Date(firstTS);
		var lastDate = new Date(lastTS);

		setRange(firstDate, lastDate);
		setResolution(data.actual_res);
		drawGraph(data);
	});
}

/**
 * Requests data points from the server with the given parameters
 *
 * @param src The name of the dataset to source points from (required)
 * @param begin A Date object specifying when the points should start (can be null,
 *				in which case the start point is the first point in the dataset)
 * @param end A Date object specifying when the points should end (can be null,
 *			  in which case the end point is the last point in the dataset)
 * @param res The desired data resolution in milliseconds (can be null, in which case
 *			  all the points in the specified range are used)
 * @param cb A callback function which receives the following parameters: error, data
 *			 - Error is non-null if an error was returned
 *			 - Data is the returned data, and is non-null even when there is an error if the error
 *			   was caused by the server
 */
function getData(src, begin, end, res, cb) {
	var xmlhttp = new XMLHttpRequest();

	if (!xmlhttp) {
		cb("Failed to make AJAX request", null);
	}

	xmlhttp.onreadystatechange = () => {
		if (xmlhttp.readyState == XMLHttpRequest.DONE) {
			var obj = JSON.parse(xmlhttp.responseText);
			if (xmlhttp.status == 200) {
				cb(null, obj);
			} else {
				cb("Received non-200 request status, actual status: " + xmlhttp.status, obj);
			}
		}
	}

	var url = '/api/load?';

	if (!src) {
		cb("Was not given a data source", null);
	}

	url += 'src=' + src;
	url += '&max=300';
	if (begin) url += '&from=' + begin.getTime();
	if (end) url += '&to=' + end.getTime();
	if (res) url += '&resolution=' + res;

	xmlhttp.open('GET', url, true);
	xmlhttp.send();
}

/**
 * Draws the graph using the given data
 *
 * @param data A JSON object containing an array called 'points',
 *			   where each element of the array is a JSON object
 			   with the fields ts and load
 */
function drawGraph(data) {
	var xVals = ['x'];
	var pvLoadVals = ['PV Load'];
	var facilityLoadVals = ['Facility Load'];
	var storageGenVals = ['Storage Generation'];
	var newOpBtn = document.getElementById('new-op-btn');
	var newOpBtnClone = newOpBtn.cloneNode(true);
	newOpBtn.parentNode.replaceChild(newOpBtnClone, newOpBtn);

	// Populate the data array
	for (var i = 0; i < data.points.length; ++i) {
		var p = data.points[i];

		xVals.push(new Date(p.ts));
		pvLoadVals.push(p.pvLoad);
		facilityLoadVals.push(p.facilityLoad);
		storageGenVals.push(p.storageGen);
	}
	var allData = [ pvLoadVals, facilityLoadVals, storageGenVals ];

	chart = c3.generate({
		oninit: () => {
			var domain = [ xVals[1], xVals[xVals.length - 1] ];
			updateSummaryStats(xVals, allData, domain, data.original_res);
		},
		data: {
			x: 'x',
			xFormat: '%Y%m%d%H%M%S',
			columns: [
				xVals,
				pvLoadVals,
				facilityLoadVals,
				storageGenVals
			],
			onmouseover: function(d) {
				var index = d.index;
				var className = ".c3-circle-" + index;
				$(className).show();
			},
			onmouseout: function(d) {
				var index = d.index;
				var className = "#chart .c3-circles .c3-circle-" + index;
				$(className).hide();
			}
		},
		axis: {
			x: {
				type: 'timeseries',
				tick: {
					format: function(x) {
						return tsToString(x.getTime());
					}
				},
				label: {
					text: 'Timestamp',
					position: 'outer-middle'
				}
			},
			y: {
				label: {
					text: 'Load (W)',
					position: 'outer-middle'
				}
			}
		},
		subchart: {
			show: true,
			onbrush: (d) => {
				updateSummaryStats(xVals, allData, d, data.original_res);
			}
		}
	});

	// When the new operation button is pressed, add a new operation to the UI
	newOpBtnClone.addEventListener('click', () => {
		var allDataSets = chart.internal.data.targets;
		var allNames = [];
		for (var i = 0; i < allDataSets.length; ++i) {
			allNames.push(allDataSets[i].id);
		}
		addOperation(allNames);
	});

	clearAllOperations();
	addOperation([pvLoadVals[0], facilityLoadVals[0], storageGenVals[0]]);
}