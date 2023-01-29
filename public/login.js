async function on_open() {
	document.getElementById('loginBtn').addEventListener('click', () => handle_login());

	// creates the options for the get api request
	const getOptions = {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	}
	const getRes = await fetch('/api/update_users', getOptions);
	const getResult = await getRes;
}

async function handle_login() {
	username = document.getElementById("username").value;
	password = document.getElementById("password").value;

	if (username == "" || password == "" ) {
		alert("Please enter username and password.");		
	} else {
		const data = {username, password};

		const postOptions = {
			method: 'POST', 
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		}

		const getRes = await fetch('/api/validate_user', postOptions);
		const getResult = await getRes.json();
		console.log(getResult);
		localStorage.setItem("currentlyLoggedIn", JSON.stringify(getResult));
	}
}