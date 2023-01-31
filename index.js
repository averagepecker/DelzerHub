// Initialize employee list object
let employeeList = {};
// Initialize eventData list object
let eventData = {};

main();

function main(){
	const bcrypt = require("bcrypt");

	const Datastore = require('nedb'); // database requirement
	// creating database
	const userDB = new Datastore('user.db');
	userDB.loadDatabase();
	const timeOffDB = new Datastore('timeOff.db');
	timeOffDB.loadDatabase();
	const jobSchedulingDB = new Datastore('jobScheduling.db');
	jobSchedulingDB.loadDatabase();

	const express = require('express');
	const app = express();
	require('dotenv').config();
	const port = process.env.PORT || 3000;

	app.listen(port, () => console.log(`app listening at ${port}`));
	app.use(express.static('public'));
	app.use(express.json({limit: '100mb'}));

	/*LOGIN API REQUESTS*/
	app.get('/api/update_users', (req, res) => {
		updateUsers();
		const timestamp = Date.now();
		res.json({
      		status:'success',
    		timestamp: timestamp
    	});
	});

	app.post('/api/validate_user', (req, res) => {
		const data = req.body;
		validateUser(data, data => {
			res.end(data);
		})
	});

	/*EDIT USER API REQUESTS*/
	app.post('/api/update_username', (req, res) => {
		userDB.loadDatabase();
		const data = req.body;

		userDB.findOne({username: `${data.username}`}, function(err, doc) {
			if (err) throw new Error(err);

			if (doc == null || doc == undefined) {
				userDB.update({_id: `${data.tsheetsid}`}, {$set: {username: `${data.username}`}}, {}, function(err, numReplaced){
					if(err) throw new Error(err);
					console.log(`${data.firstname} ${data.lastname} updated their username to ${data.username}.`)
				});
				res.json({
			      status:'success'
			      
		    	});

		    } else {
		    	res.json({
		    		status:'invalid'
		    	})
		    }
		});
	});

	app.post('/api/update_password', (req, res) => {
		userDB.loadDatabase();
		const data = req.body;

		bcrypt.genSalt(10, (err, salt) => {
   			bcrypt.hash(data.password, salt, function(err, hash) {
   				userDB.update({_id: `${data.tsheetsid}`}, {$set: {password: `${hash}`}}, {}, function(err, numReplaced){
   					if (err) throw new Error(err);

 						res.json({
				      status:'success'
			    	});
   				});			
   			});
		});

	});

	/*THESE API REQUESTS ARE FOR TIME OFF CALENDAR*/
	app.get('/api/eventData_time_off_calendar', (req, res) =>{
		getTimeOffData(data =>{
			res.end(JSON.stringify(data));
		})
	});

	app.post('/api/add_time_off_request', (req, res) => {
		// the data from the request
		const data = req.body; 
		const timestamp = Date.now();
		data.timestamp = timestamp;

		// Runs the tsheets request function to send request to tsheets
		sendTsheetsRequest(data);

		let title = `${data.firstname} ${data.lastname} requests this time off`;
		let title2 = `Thank you for your time off request`;

		// creates the content for the email to managers
		let content1 = `${data.firstname} ${data.lastname} has submitted a request to take time off from ${data.startDate} to ${data.endDate}\nHis reason is: ${data.reason}\n`;

		// Runs the function to send an email to the managers
		//sendEmail('kian.moriarty@delzerbiz.com, john@delzerbiz.com, jim@delzerbiz.com', title, content1);

		// creates the content for the user response
		let content2 = `Thank you ${data.firstname} ${data.lastname}, your request has successfully been submitted.\n\n${data.startDate} to ${data.endDate}\nReason:\n${data.reason}`;

		userDB.findOne({_id: `${data.tsheetsid}`}, function(err, doc) {
			if (err) throw new Error(err);
			// Runs the function to send an email to the user
			sendEmail(doc.email, title2, content2);
		});


		res.json({
			status: 'success',
			timestamp: timestamp,
		});

	});
  
  app.post('/api/delete_time_off_request', (req, res) => {
  		timeOffDB.loadDatabase();
    	const data = req.body;
    	const timestamp = Date.now();
    
    	timeOffDB.remove({ _id: `${data.dbId}` }, {}, function (err, numRemoved) {
    		if (err) throw new Error(err);
      		console.log(`${data.dbId} was deleted`);
    	});
    
    	res.json({
      		status:'success',
    		timestamp: timestamp
    	});
  	});
  
	app.post('/api/update_time_off_request', (req, res) => {
		timeOffDB.loadDatabase();
    const data = req.body;
    const timestamp = Date.now();
    
    timeOffDB.update({ _id: `${data.dbId}` }, { $set: { startDate: `${data.startDate}`, endDate: `${data.endDate}`, reason: `${data.reason}`}}, {}, function(err, numReplaced){
      console.log(`${data.dbId} was updated.`)
    })
  
    res.json({
      status:'success',
      timestamp: timestamp
  	});
	});

	app.post('/api/approve_time_off_request', (req, res) => {
		timeOffDB.loadDatabase();
    const data = req.body;

    timeOffDB.update({_id: `${data.dbId}`}, {$set: { approved: `${data.newApproved}`}}, {}, function(err, numReplaced){
    	if (err) throw new Error(err);
    	timeOffDB.findOne({_id: `${data.dbId}`}, function(errr, doc){
    		if (errr) throw new Error(errr);
    		userDB.findOne({_id: `${doc.tsheetsid}`}, function(error, user){
    			if (error) throw new Error(error);

    			let approved
    			if (data.approved == 'true'){
    				approved = 'approved';
    			} else {
    				approved = 'unapproved';
    			}

    			let title = `${data.firstname} ${data.lastname} has ${approved} your time off request.`;
    			let content = `Your request to leave from ${doc.startDate} to ${doc.endDate} was ${approved}.`;
    			sendEmail(user.email, title, content);
    		})
    	})
		});

		res.json({
			status:'success'
		});
  });

	/*THESE API REQUESTS ARE FOR JOB SCHEDULING WEB PAGE*/
	app.get('/api/eventData_job_scheduling', (req, res) =>{
		getJobSchedulingData(data =>{
			res.end(JSON.stringify(data));
		})
	});

	app.post('/api/add_job_scheduling', (req, res) => {
		// the data from the request
		const data = req.body; 
		const timestamp = Date.now();
		data.timestamp = timestamp;

		// this creates the title of the event
		let title = `${data.custName} ${data.jobAddress} ${data.jobType} (${data.startDate} - ${data.endDate})`;

		// saves request to database
		jobSchedulingDB.insert(data);
		
		// creates the content for the email to managers
		let content1 = `${data.empName} has scheduled a job from ${data.startDate} to ${data.endDate}\nThe job is for ${data.custName} at ${data.jobAddress}.\nBrief Description:\n${data.description}`;

		// Runs the function to send an email to the managers
		sendEmail('kian.moriarty@delzerbiz.com', title, content1);

		// creates the content for the user response
		let content2 = `Thank you ${data.empName}, the job at ${data.jobAddress} for ${data.custName} has successfully been scheduled.`;

		userDB.findOne({_id: `${data.tsheetsid}`}, function(err, doc){
			if (err) throw new Error(err);
			if (doc != null || doc != undefined){
				// Runs the function to send an email to the user
				sendEmail(doc.email, title ,content2);
			}
		})
			

		res.json({
			status: 'success',
			timestamp: timestamp,
		});

	});

	app.post('/api/delete_job_scheduling', (req, res) => {
			jobSchedulingDB.loadDatabase();
    	const data = req.body;
    	const timestamp = Date.now();
    
    	jobSchedulingDB.remove({ _id: `${data.dbId}` }, {}, function (err, numRemoved) {
    		if (err) throw new Error(err);
      		console.log(`${data.dbId} was deleted`);
    	});
    
    	res.json({
      		status:'success',
      		timestamp: timestamp
    	});
  	});
  
  app.post('/api/update_job-scheduling', (req, res) => {
  		jobSchedulingDB.loadDatabase();
	    const data = req.body;
	    const timestamp = Date.now();
    
    	jobSchedulingDB.update({ _id: `${data.dbId}` }, { $set: { startDate: `${data.startDate}`, endDate: `${data.endDate}`, jobType: `${data.jobType}`, description: `${data.description}`}}, {}, function(err, numReplaced){
      		console.log(`${data.dbId} was updated.`)
    	})
    
    	res.json({
      		status:'success',
      		timestamp: timestamp
    	});
  	});

  /*DISPATCH CALL IN FORM API REQUESTS*/
  app.get('/api/get_admin', (req, res) => {
  	userDB.loadDatabase();
  	userDB.find({$not: {workEmail: ""}}, function(err, docs){
  		if (docs != null || docs != undefined){
  			res.end(JSON.stringify(docs)):
  		} else {
  			res.json({
  				status: 'failure'
  			})
  		}
  	});
  }

}

/*UNIVERSAL FUCNTIONS*/
// Function to send email
function sendEmail(to, title, content){

	// requires built nodemailer module
	let nodemailer = require('nodemailer');

	// initializes transporter to send email
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'DDI.TimeOff.Request@gmail.com',
			pass: 'vszefhnvbqkcoyuz'
		}
	});

	// creates the mail options to send the email
	let mailOptions = {
		from: 'DDI.TimeOff.Request@gmail.com', // from address
		to: to, // main manager address
		subject: title, // subject line
		text: content // content of email
	}

	// sends the email
	transporter.sendMail(mailOptions, function(err, info){
		if (err) throw new Error(err);
	});
}

// function to get tsheets api token
function getToken(){

	// requires built in fyle system module
	const fs = require('fs');

	// reads token file
	const buffer = fs.readFileSync('token.txt');
	const fileContent = buffer.toString();

	// returns token
	return fileContent;
}

/*THESE FUNCTIONS ARE FOR THE LOGIN PAGE*/
async function validateUser(data, _callback){
	const Datastore = require('nedb'); // database requirement
	// creating database
	const bcrypt = require('bcrypt');
	const userDB = new Datastore('user.db');
	userDB.loadDatabase();

	let result = new Promise((resolve, reject) => {
		userDB.findOne({$or: [{username: `${data.username}`}, {email: `${data.username}`}]}, function (err, doc){
			if (err) throw new Error(err);
			if (doc != null || doc != undefined) {
				bcrypt.compare(data.password, doc.password, function(err, result) {
					if (result) {				
						const loggingDB = new Datastore('loggingData.db');
						loggingDB.loadDatabase();
						const timestamp = Date.now();
						let user = {'tsheetsid': doc._id, 'username':doc.username, 'firstname': doc.firstname, 'lastname': doc.lastname};
						let loggInfo = {'username': doc.username, 'timestamp': timestamp};
						loggingDB.insert(loggInfo);
						return resolve(user);
					} else {
						return resolve(null);
					}
				});
			};
		});
	});
	let foundUser = await result;
	_callback(JSON.stringify(foundUser));
}

// asynchronous function to request employee info from tsheets
async function updateUsers(){
	const Datastore = require('nedb'); // database requirement
	// creating database
	const userDB = new Datastore('user.db');
	userDB.loadDatabase();

	const bcrypt = require("bcrypt");

	// requires built in request module 
	const request = require("request");
	// gets token
	const token = getToken();
	let moreData = true;
	let i = 1;
	while (moreData) {
		// creates options for get api request page i
		const options = { 
			method: 'GET',
	  		url: 'https://rest.tsheets.com/api/v1/users',
	  		qs: {
	  			page: i
	  		},
	  		headers: {
	   	  		'Authorization': token
	   		}
	   	};

	   	// promises result from tsheets api
	   	const result = new Promise((resolve, reject) => {

	   		// requests employee info from tsheets api
			request(options, function (err, response, body){
				if (err) throw new Error(err); // throws error if request fails
				// returns the result
				let result = JSON.parse(body)
				return resolve(result);

			});

		});
		let data = await result;
	   	let results = data.results;
	   	let users = results.users;
	   	let userKeys = Object.keys(users);
	   	for (let k = 0; k < userKeys.length; k++){
	   		let id = userKeys[k];
	   		let fname = users[id].first_name;
	   		let lname = users[id].last_name;
	   		let email = users[id].email;
	   		let workemail = "";
	   		let password = fname + "54321#";

	   		let user = {'_id':id, 'username':email, 'firstname':fname, 'lastname':lname, 'email':email, 'workemail':workemail, 'password': password};

	   		const result = new Promise((resolve, reject) => {
	   			userDB.findOne({ firstname: fname, lastname: lname}, function (err, doc){
					if (err) throw new Error(err);
					let res = doc;
					return resolve(res);
				});
	   		});

	   		let userFound = await result;
   			if (userFound == null){
				let pword = new Promise((resolve, reject) => {
					bcrypt.genSalt(10, (err, salt) => {
			   			bcrypt.hash(password, salt, function(err, hash) {
			   				let res = hash;
			   				return resolve(hash);
			   			});
					});
				});

				let hashPass = await pword;
				user.password = hashPass;
				
				let insert = new Promise((resolve, reject) => {
					userDB.insert(user);
					return resolve(true);
				});
				let finished = await insert;
	   		} else {
	   			if (userFound.email != user.email) {
	   				let update = new Promise((resolve, reject) => {
	   					userDB.update({ _id: user._id }, { $set: { email: user.email }}, {}, function(err, numReplaced){
	    				});
	    				return resolve(true);
	   				})
	   				let finished = await update;
	   			}
	   		}
	   	}

	   	//checks for more data
	   	let more = JSON.stringify(data.more);
		more = more.toLowerCase();
		if (more == 'false'){
			moreData = false;
		}
		i++;
	}
}

/*THESE FUNCTIONS ARE FOR THE TIME OFF CALENDAR*/
// asynchronous function to grab time off requests from db
async function getTimeOffData(_callback){

  const Datastore = require('nedb'); // database requirement
  // creating database
  const database = new Datastore('timeOff.db');
  database.loadDatabase();
  
	const result = new Promise((resolve, reject) => {
		database.find({}, function(err, docs){
			if (err) throw new Error(err);
			let eventList = [];
			for (let i = 0; i < Object.keys(docs).length; i++){
				let objectValue = {};
				objectValue['ID'] = docs[i]._id;
				objectValue['firstname'] = docs[i].firstname;
				objectValue['lastname'] = docs[i].lastname;
        objectValue['tsheetsid'] = docs[i].tsheetsid;
				objectValue['startDate'] = docs[i].startDate;
				objectValue['endDate'] = docs[i].endDate;
				objectValue['reason'] = docs[i].reason;
				objectValue['approved'] = docs[i].approved;
				eventList.push(objectValue);
			}
			let events = eventList;
			return resolve(events);
		});
	});

	let data = await result;
	_callback(data);
}

// function to send a time off request to tsheets
async function sendTsheetsRequest(data){
	const Datastore = require('nedb'); // database requirement
	// creating database
	const timeOffDB = new Datastore('timeOff.db');
	timeOffDB.loadDatabase();

	// initializes the start and end dates with the built in date class 
	const startDate = new Date(data.startDate + "T00:00:00");
	const endDate = new Date(data.endDate + "T00:00:00");

	// requires the built in request module
	const request = require('request');
	// gets the token
	const token = getToken();
	// runs the createRequest body function to create the body of the api request
	const requestBody = createRequestBody(data.tsheetsid, startDate, endDate, data.reason);
	// creates the options for the tsheets api post request
	const options = {
		method: 'POST',
		url: 'https://rest.tsheets.com/api/v1/time_off_requests',
		headers: {
			'Authorization': token,
			'Content-Type': 'application/json'
		},
		body: requestBody
	};

	// sends the request to the tsheets api
	let result = new Promise((resolve, reject) => {
		request(options, function (err, response, body){
			if (err) throw new Error(err); // throws error if request fails
			let bod = JSON.parse(body);
			let res = bod.supplemental_data.time_off_request_entries
			if (res != null && res != undefined) {
				let ids = Object.keys(res);
				let id = "";

				for (let i = 0; i < ids.length; i++){
					if (i == ids.length - 1) {
						id += ids[i];
					} else {
						id += ids[i] + ",";
					};
				}
				return resolve(id);
			}
		});
	});
	let tsEntryId = await result;

	let dbEntry = {'_id':tsEntryId, 'firstname':data.firstname, 'lastname':data.lastname, 'tsheetsid':data.tsheetsid, 'startDate':data.startDate, 'endDate':data.endDate, 'reason':data.reason, 'approved': data.approved}

	//saves request to database
	timeOffDB.insert(dbEntry);
}

// function to create the request body for the time off request
function createRequestBody(id, startDate, endDate, reason){

	// initializes date with the built in date class as the start date
	const date = new Date(startDate.getTime());
	// initializes the dates array to hold all of the given dates between the start and the end
	const dates = [];
	// initializes empty requestBody string this was done to allow concatenation when iterating with the while loop
	let requestBody = '';

	// while loop to get every date in between/including the start and end dates and put them in the dates array
	while (date <= endDate) {
		// this code sets the format of the dates to YYYY-MM-DD
		let day = date.getDate(); // gets the day
		let month = date.getMonth() + 1; // gets the month
		let year = date.getFullYear(); // gets the year
		if (month < 10) month = "0" + month; // adds a 0 if the month is less than 10 ex. 9 becomes 09
		if (day < 10) day = "0" + day; // adds a 0 if the day is less than 10 ex. 6 becomes 06

		let formattedDate = year + '-' + month + '-' + day; // formats to YYYY-MM-DD
		dates.push(formattedDate); // pushes the formatted date into the dates array
    date.setDate(date.getDate() + 1); // sets the date 
	}

	// for loop to create the individual request entries (every date needs a separate entry)
	for (let i = 0; i < dates.length; i++){
		
		// determines if this is the last entry
		if (i < dates.length - 1){
			requestBody +=`{
						"time_off_request_id": 621501856,
						"status": "pending",
						"entry_method": "manual",
						"duration": 28800,
						"date": "${dates[i]}",
						"jobcode_id": 61004502
					}, `
		} else { 
			requestBody +=`{
						"time_off_request_id": 621501856,
						"status": "pending",
						"entry_method": "manual",
						"duration": 28800,
						"date": "${dates[i]}",
						"jobcode_id": 61004502
					}]
				}]
			}`
		}
	}

	// creates the header for the request body
	let body = `	{
		"data": [{
			"time_off_request_notes": [{
				"note": "${reason}"
			}],
			"user_id": ${id},
			"time_off_request_entries": [`

	// concatenates the individual requests to the header
	body += requestBody;

	// returns the complete request body
	return body;
}

/*THESE FUNCTIONS ARE FOR THE JOB SCHEDULING CALENDAR*/
// asynchronous function to grab job scheduling requests from db
async function getJobSchedulingData(_callback){

  const Datastore = require('nedb'); // database requirement
  // creating database
  const database = new Datastore('jobScheduling.db');
  database.loadDatabase();
  
	const result = new Promise((resolve, reject) => {
		database.find({}, function(err, docs){
			if (err) throw new Error(err);
			let eventList = [];
			for (let i = 0; i < Object.keys(docs).length; i++){
				let objectValue = {};
				objectValue['ID'] = docs[i]._id;
				objectValue['custName'] = docs[i].custName;
				objectValue['jobAddress'] = docs[i].jobAddress;
    		objectValue['contName'] = docs[i].contName;
    		objectValue['contPhone'] = docs[i].contPhone;
    		objectValue['contEmail'] = docs[i].contEmail;
    		objectValue['tsheetsid'] = docs[i].tsheetsid;
    		objectValue['empName'] = docs[i].empName;
				objectValue['startDate'] = docs[i].startDate;
				objectValue['endDate'] = docs[i].endDate;
    		objectValue['jobType'] = docs[i].jobType;
				objectValue['description'] = docs[i].description;
				eventList.push(objectValue);
			}
			let events = eventList;
			return resolve(events);
		});
	});
	let data = await result;
	_callback(data);
}