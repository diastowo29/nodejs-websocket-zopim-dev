const axios = require('axios');
let pingEndpoint = 'https://' + process.env.APP_NAME + '.herokuapp.com/zopim/ping'
axios({
	method: 'GET',
	url: pingEndpoint
}).then((response) => {
	console.log('===== PING =====');
	console.log(response.data);
})