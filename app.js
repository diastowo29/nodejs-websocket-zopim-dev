var createError = require('http-errors');
const request = require("superagent");
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const { zp_session } = require('./sequelizes')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var Queue = require('bull');

var app = express();

const axios = require('axios');
const WebSocket = require('ws');

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});

var newWs;
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/', indexRouter);
// app.use('/zopim', usersRouter);

// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// // error handler
// app.use(function(err, req, res, next) {
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   res.status(err.status || 500);
//   res.render('error');
// });

const ACCESS_TOKEN = "";
var chatQue = new Queue('chatque', process.env.REDIS_URL);

const CHAT_API_URL = "https://chat-api.zopim.com/graphql/request";
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
    
const channelsToBeTransferred = [];

app.post('/zopim/fromkata', function(req, res, next) {
	zp_session.findAll().then( zp_session_data => {
		let websocket_url = zp_session_data[0].websocket_url;
		let newMessage = req.body.messages[0].content;
		let channel_id = req.body.userId;

		console.log(newMessage);
		newWs.send(JSON.stringify(sendMsgPayload(channel_id, newMessage, true)));
		if (newMessage.toLowerCase().startsWith('duh maaf')) {
			newWs.send(JSON.stringify(sendBotDontGetPayload(channel_id)));
		}
	});
	res.status(200).send({});
});

app.get('/zopim/close', function(req, res, next) {
  if (newWs !== undefined) {
    newWs.close();
    zp_session.destroy({
      where: {},
      truncate: true
    });
    doDetachEventListeners(newWs);
  }
  res.status(200).send({
    websocket: 'disconnected'
  });
})

app.get('/zopim/bully', async (req, res, next) => {
  const job = await chatQue.add({
    foo: 'bar'
  });
  res.status(200).send({
    websocket: 'disconnected'
  });
})

app.get('/zopim/ping', function(req, res, next) {
  zp_session.findAll().then( zp_session_data => {
    console.log(zp_session_data.length);
    let ws_status = '';
    if (zp_session_data.length == 0) {
      ws_status = 'disconnected';
    } else {
      ws_status = 'connected';
    }
    res.status(200).send({
      status: ws_status
    });
  });
});

chatQue.process(async (job) => {
  console.log('job processed');
})

chatQue.on('completed', (job, result) => {
  console.log('job completed');
})

app.post('/zopim/connect', function(req, res, next) {
	let newZdToken = req.body.token;

  if (newWs !== undefined) {
    newWs.close();
    doDetachEventListeners(newWs);
  }

  zp_session.destroy({
    where: {},
    truncate: true
  })

	console.log('token: ' + newZdToken)
	let startAgentSessionQueryPayload = startAgentSessionPayload(newZdToken);
	axios({
	  method: 'POST',
	  url: CHAT_API_URL,
	  data: {
	  	query: startAgentSessionQueryPayload
	  }
	}).then((response) => {
		let newAgentSessionResponse = response.data.data.startAgentSession
		newWs = new WebSocket(newAgentSessionResponse.websocket_url);
		zp_session.create({
			session_id: newAgentSessionResponse.session_id,
	        client_id: newAgentSessionResponse.client_id,
	        token: newZdToken,
	        chat_api_url: CHAT_API_URL,
	        websocket_url: newAgentSessionResponse.websocket_url
	    }).then( zp_session_created => {
	    	console.log('zp_session_created success');
	    })

		doAttachEventListeners(newWs);
		res.status(200).send({
			status: 'connected'
		})
	})
})

function doAttachEventListeners(ws) {
	ws.addListener("open", doHandleOpen);
	ws.addListener("close", doHandleClose);
	ws.addListener("message", doHandleMessage);
}

function doDetachEventListeners(ws) {
  ws.removeListener("open", doHandleOpen);
  ws.removeListener("close", doHandleClose);
  ws.removeListener("message", doHandleMessage);
}

function doHandleOpen() {
  console.log('=== Web Socket is OPENING ===');
    /************************
     * PING for prevent  *
     * timed out *
     ************************/
     pingInterval = setInterval(() => {
  		// console.log('PINGs');
  		newWs.send(
  			JSON.stringify({
  				sig: "PING",
  				payload: +new Date()
  			})
			);
  	}, 5000);


    /************************
     * Agent status to ONLINE *
     ************************/
    newWs.send(JSON.stringify(udpateAgentStatusPayload()));
    console.log("[updateAgentStatus] Request sent");

    /************************
     * Message subscription *
     ************************/
    newWs.send(JSON.stringify(subsMsgPayload()));
    console.log("[message] Subscription request sent");
}

function doHandleMessage(message) {
	const data = JSON.parse(message);

  	// Listen to successful message subscription request
    if (data.id === REQUEST_ID.MESSAGE_SUBSCRIPTION) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[message] Failed to subscribe to message");
      } else {
        messageSubscriptionId = data.payload.data.subscription_id;
        console.log("[message] Successfully subscribe to message");
      }
    }

    // Listen to successful update agent status request
    if (data.id === REQUEST_ID.UPDATE_AGENT_STATUS) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[updateAgentStatus] Failed to update agent status");
      } else {
        console.log("[updateAgentStatus] Successfully update agent status");
      }
    }

    if (data.id === REQUEST_ID.SEND_MESSAGE) {
      if (data.payload.errors && data.payload.errors.length > 0) {
      	console.log(data.payload.errors)
        console.log("[sendMessage] Failed to send message to visitor");
      } else {
        console.log("[sendMessage] Successfully to send message to visitor");
      }
    }

    if (data.id === REQUEST_ID.SEND_QUICK_REPLIES) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[sendQuickReplies] Failed to send message to visitor");
      } else {
        console.log(
          "[sendQuickReplies] Successfully to send message to visitor"
        );
      }
    }

    if (data.id === REQUEST_ID.TRANSFER_TO_DEPARTMENT) {
      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log(
          "[transferToDepartment] Failed to transfer visitor to a department"
        );
      } else {
        console.log(
          "[transferToDepartment] Successfully to transfer visitor to a department"
        );
      }
    }

    if (data.id === REQUEST_ID.GET_DEPARTMENTS) {
      const channelToBeTransferred = channelsToBeTransferred.pop();

      if (data.payload.errors && data.payload.errors.length > 0) {
        console.log("[getDepartments] Failed to get departments info");
      } else {
        console.log("[getDepartments] Successfully to get departments info");

        const allDepartments = data.payload.data.departments.edges;
        const onlineDepartments = allDepartments.filter(
          department => department.node.status === "ONLINE"
        );

        if (onlineDepartments.length > 0) {
          const pickRandomDepartment = Math.floor(
            Math.random() * onlineDepartments.length
          );
          const onlineDepartment = onlineDepartments[pickRandomDepartment].node;
          var newMessage = "Kamu akan kami arahkan ke  " + onlineDepartment.name + " department secepatnya!";

          /********************************************************
           * Notify visitor that they are going to be transferred *
           ********************************************************/
          newWs.send(JSON.stringify(sendMsgPayload(channelToBeTransferred, newMessage, true)));

          /***********************************
           *Transfer channel to a department *
           ***********************************/
          const transferToDepartmentQuery = {
            payload: {
              query: `mutation {
                                transferToDepartment(
                                    channel_id: "${channelToBeTransferred}", 
                                    department_id: "${onlineDepartment.id}",
                                    leave: true) {
                                    success
                                }
                            }`
            },
            type: "request",
            id: REQUEST_ID.TRANSFER_TO_DEPARTMENT
          };

          newWs.send(JSON.stringify(transferToDepartmentQuery));
        } else {

          var newMessage = "Maaf, sepertinya hanya aku yang sedang online hehe";
          /****************************************************
           * Notify visitor that there is no online department*
           ****************************************************/
          newWs.send(JSON.stringify(sendMsgPayload(channelToBeTransferred, newMessage, true)));
        }
      }
    }

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

        if (chatMessage.content.toLowerCase().includes("button")) {
        	console.log('transfers');
        	newWs.send(JSON.stringify(sendButtonMsgPayload(chatMessage.channel.id)));
        } else if (chatMessage.content.toLowerCase().includes("hubungkan ke agent asli")) {
        	console.log('ice cream');
        	newWs.send(JSON.stringify(getDepartmentsPayload()));
        	channelsToBeTransferred.push(chatMessage.channel.id);
        } else {
        	// console.log(data.payload.data)
        	// console.log(data.payload.data.message.node.channel)
        	// console.log(data.payload.data.message.node.from)

        	// newWs.send(JSON.stringify(sendBotFailMsgPayload(chatMessage.channel.id)));
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
    				newWs.send(JSON.stringify(sendBotFailMsgPayload(chatMessage.channel.id)));
    			});
        }
      }
    }
}

function doHandleClose() {
	console.log('=== Web Socket is CLOSING ===');
}

function startAgentSessionPayload (ACCESS_TOKEN) {
	const startAgentSessionPayload = `mutation {
        startAgentSession(access_token: "${ACCESS_TOKEN}") {
            websocket_url
            session_id
            client_id
        }
    }`;
    return startAgentSessionPayload;
}

function udpateAgentStatusPayload () {
  	const updateAgentStatusQuery = {
      payload: {
        query: `mutation {
                    updateAgentStatus(status: ONLINE) {
                        node {
                            id
                        }
                    }
                }`
      },
      type: "request",
      id: REQUEST_ID.UPDATE_AGENT_STATUS
    };
    return updateAgentStatusQuery;
}

function sendMsgPayload (channel_id, message, backoff) {
	const sendMessageQuery = {
		payload: {
			query: `mutation {
				sendMessage(
				backoff: ${backoff}
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
	return sendMessageQuery;	
}

function subsMsgPayload () {
	const messageSubscriptionQuery = {
      payload: {
        query: `subscription {
                    message {
                        node {
                            id
                            content
                            channel {
                                id
                            }
                            from {
                                __typename
                                display_name
                            }
                        }
                    }
                }`
      },
      type: "request",
      id: REQUEST_ID.MESSAGE_SUBSCRIPTION
    };
    return messageSubscriptionQuery;
}

function sendBotFailMsgPayload (channel_id) {
	const sendQuickRepliesQuery = {
        payload: {
          query: `mutation {
                            sendQuickReplies(
                                channel_id: "${channel_id}",
                                msg: "Oops, sepertinya bot kita sedang bermasalah, kamu mau gak kita hubungkan ke Agent beneran?",
                                quick_replies: [
                                    {
                                        action: {
                                            value: "Hubungkan ke Agent asli"
                                        },
                                        text: "Hubungkan"
                                    },
                                    {
                                        action: {
                                            value: "Gak usah gpp kok"
                                        },
                                        text: "Gausah"
                                    }
                                ],
                                fallback: {
                                    msg: "Oops, sepertinya bot kita sedang bermasalah, kamu mau gak kita hubungkan ke Agent beneran?"
                                    options: [
                                        "Hubungkan",
                                        "Gausah"
                                    ]
                                }
                            ) {
                                success
                            }
                        }`
        },
        type: "request",
        id: REQUEST_ID.SEND_QUICK_REPLIES
    };
	return sendQuickRepliesQuery;
}

function sendBotDontGetPayload (channel_id) {
	const sendQuickRepliesQuery = {
        payload: {
          query: `mutation {
                            sendQuickReplies(
                                channel_id: "${channel_id}",
                                msg: "Mau aku arahkan ke agent asli?",
                                quick_replies: [
                                    {
                                        action: {
                                            value: "Hubungkan ke Agent asli"
                                        },
                                        text: "Hubungkan"
                                    },
                                    {
                                        action: {
                                            value: "Gak usah gpp kok"
                                        },
                                        text: "Gausah"
                                    }
                                ],
                                fallback: {
                                    msg: "fallback - Mau aku arahkan ke agent asli?"
                                    options: [
                                        "Hubungkan",
                                        "Gausah"
                                    ]
                                }
                            ) {
                                success
                            }
                        }`
        },
        type: "request",
        id: REQUEST_ID.SEND_QUICK_REPLIES
    };
	return sendQuickRepliesQuery;
}

function sendButtonMsgPayload (channel_id) {
	const sendButtonReplyQuery = {
        payload: {
          query: `mutation {
                            sendButtonTemplate(
                                channel_id: "${channel_id}",
                                msg: "Test button template reply?",
                                buttons: [
                                    {
                                        action: {
                                            value: "Hubungkan ke Agent asli"
                                        },
                                        text: "Hubungkan"
                                    },
                                    {
                                        action: {
                                            value: "Gak usah gpp kok"
                                        },
                                        text: "Gausah"
                                    }
                                ],
                                fallback: {
                                    msg: "fallback - Test button template reply?"
                                    options: [
                                        "Hubungkan",
                                        "Gausah"
                                    ]
                                }
                            ) {
                                success
                            }
                        }`
        },
        type: "request",
        id: REQUEST_ID.SEND_QUICK_REPLIES
    };
	return sendButtonReplyQuery;
}

function getDepartmentsPayload () {
	const getDepartmentsQuery = {
        payload: {
          query: `query {
                            departments {
                                edges {
                                    node {
                                        id
                                        name
                                        status
                                    }
                                }
                            }
                        }`
        },
        type: "request",
        id: REQUEST_ID.GET_DEPARTMENTS
    };
    return getDepartmentsQuery;
}

// startAgentSession();

// keep the script running
process.stdin.resume();

module.exports = app;
