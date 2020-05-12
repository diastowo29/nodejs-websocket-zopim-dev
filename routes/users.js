var express = require('express')
const { zp_session } = require('../sequelizes')
var router = express.Router()
const WebSocket = require('ws');

/* GET users listing. */
router.get('/', function(req, res, next) {
	res.send('respond with a resource');
});

router.get('/sessions', function(req, res, next) {
	zp_session.findAll().then( zp_session_data => {
		res.status(200).send({zp_session_data});
	})
});


module.exports = router;