const axios = require('axios');
console.log(process.env);
axios({
	method: 'GET',
	url: 'https://connector-zopimkata-dev.herokuapp.com/zopim/ping'
}).then((response) => {
	console.log(response.data);
})