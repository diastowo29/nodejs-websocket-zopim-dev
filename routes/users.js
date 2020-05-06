var express = require('express')
const { zp_session } = require('../sequelizes')
var router = express.Router()
const WebSocket = require('ws');

const REQUEST_ID = {
  MESSAGE_SUBSCRIPTION: 1,
  UPDATE_AGENT_STATUS: 2,
  SEND_MESSAGE: 3,
  GET_DEPARTMENTS: 4,
  TRANSFER_TO_DEPARTMENT: 5,
  SEND_QUICK_REPLIES: 6
};
const SUBSCRIPTION_DATA_SIGNAL = "DATA";
const TYPE = {
  VISITOR: "Visitor"
};

/* GET users listing. */
router.get('/', function(req, res, next) {
	res.send('respond with a resource');
});

router.get('/sessions', function(req, res, next) {
	zp_session.findAll().then( zp_session_data => {
		res.status(200).send({zp_session_data});
	})
});

router.post('/fromkata', function(req, res, next) {
	zp_session.findAll().then( zp_session_data => {
		let websocket_url = zp_session_data[0].websocket_url;
		let message = req.body.messages[0].content;
		let channel_id = req.body.userId;

		const ws = new WebSocket(websocket_url);

		ws.on('open', function open() {
			// ws.send('something');
			const sendMessageQuery = {
				payload: {
					query: `mutation {
						sendMessage(
						channel_id: "${channel_id}",
						msg: "${message}"
						) {
							success
						}
					}`
				},
				type: "request",
				id: REQUEST_ID.SEND_MESSAGE
			};
			ws.send(JSON.stringify(sendMessageQuery));
			// ws.close();
		});

		ws.on('message', function incoming(data) {
			if (
				data.sig === SUBSCRIPTION_DATA_SIGNAL &&
				data.subscription_id === messageSubscriptionId &&
				data.payload.data
		    ) {
		      const chatMessage = data.payload.data.message.node;
		      const sender = chatMessage.from;

		      if (sender.__typename === TYPE.VISITOR) {
		        console.log(
		          `[message] Received: '${chatMessage.content}' from: '${
		            sender.display_name
		          }'`
		        );

		        if (chatMessage.content.toLowerCase().includes("transfer")) {
		          channelsToBeTransferred.push(chatMessage.channel.id);

		          /*****************************************************************
		           * Get current departments information for transferring the chat *
		           *****************************************************************/
		          // const getDepartmentsQuery = {
		          //   payload: {
		          //     query: `query {
		          //                       departments {
		          //                           edges {
		          //                               node {
		          //                                   id
		          //                                   name
		          //                                   status
		          //                               }
		          //                           }
		          //                       }
		          //                   }`
		          //   },
		          //   type: "request",
		          //   id: REQUEST_ID.GET_DEPARTMENTS
		          // };

		          // webSocket.send(JSON.stringify(getDepartmentsQuery));
		        } else if (
		          chatMessage.content.toLowerCase().startsWith("what ice cream flavor")
		        ) {
		          /*********************************
		           * Send quick replies to visitor *
		           *********************************/
		          // const sendQuickRepliesQuery = {
		          //   payload: {
		          //     query: `mutation {
		          //                       sendQuickReplies(
		          //                           channel_id: "${chatMessage.channel.id}",
		          //                           msg: "We have the following options. Which one is your favorite?",
		          //                           quick_replies: [
		          //                               {
		          //                                   action: {
		          //                                       value: "My favorite is chocolate"
		          //                                   },
		          //                                   text: "Chocolate"
		          //                               },
		          //                               {
		          //                                   action: {
		          //                                       value: "My favorite is vanilla"
		          //                                   },
		          //                                   text: "Vanilla"
		          //                               },
		          //                               {
		          //                                   action: {
		          //                                       value: "My favorite is cookies and cream"
		          //                                   },
		          //                                   text: "Cookies and cream"
		          //                               },
		          //                               {
		          //                                   action: {
		          //                                       value: "My favorite is coconut"
		          //                                   },
		          //                                   text: "Coconut"
		          //                               },
		          //                               {
		          //                                   action: {
		          //                                       value: "My favorite is salted caramel"
		          //                                   },
		          //                                   text: "Salted caramel"
		          //                               }
		          //                           ],
		          //                           fallback: {
		          //                               msg: "We have the following options. Which one is your favorite?"
		          //                               options: [
		          //                                   "Chocolate",
		          //                                   "Vanilla",
		          //                                   "Cookies and cream",
		          //                                   "Coconut",
		          //                                   "Salted caramel"
		          //                               ]
		          //                           }
		          //                       ) {
		          //                           success
		          //                       }
		          //                   }`
		          //   },
		          //   type: "request",
		          //   id: REQUEST_ID.SEND_QUICK_REPLIES
		          // };

		          // webSocket.send(JSON.stringify(sendQuickRepliesQuery));
		        } else {
		          axios({
					  method: 'POST',
					  url: "https://kanal.kata.ai/receive_message/e6e922f5-d901-4f94-ae08-83e52960857d",
					  data: {
					  	userId: chatMessage.channel.id,
					  	messages: [{
					  		type: "text",
					  		content: chatMessage.content
					  	}]
					  }
					}).then((response) => {
						console.log('chat sent to kata')
					}, (error) => {
						console.log('error')
						console.log(error.response.status)
					});
		        }
		      }
		    }
		});

		res.status(200).send({});
	})
})

router.post('/send', function(req, res, next) {

	zp_session.findAll().then( zp_session_data => {
		let websocket_url = zp_session_data[0].websocket_url;
		let message = req.body.message;
		let channel_id = req.body.channel_id;

		const ws = new WebSocket(websocket_url);

		ws.on('open', function open() {
		  // ws.send('something');
		  const sendMessageQuery = {
	        payload: {
	          query: `mutation {
	                            sendMessage(
	                                channel_id: "${channel_id}",
	                                msg: "${message}"
	                            ) {
	                                success
	                            }
	                        }`
	        },
	        type: "request",
	        id: REQUEST_ID.SEND_MESSAGE
	      };

	      ws.send(JSON.stringify(sendMessageQuery));
		});
		res.status(200).send({});
	})
})

module.exports = router;
