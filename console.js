const axios = require('axios');

axios({
	method: 'GET',
	url: 'https://connector-zopimkata-dev.herokuapp.com/zopim/ping'
}).then((response) => {
	console.log(response);
})